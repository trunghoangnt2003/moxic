using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moxic.Api.Models;
using Moxic.Api.Services;
using Moxic.Core.Entities;
using Moxic.Infrastructure.Data;
using Moxic.Shared.Enums;

namespace Moxic.Api.Controllers;

/// <summary>"Mã giảm giá sự kiện": event coupon CRUD, bulk generation, usage and redemptions (+ SpinReward view).</summary>
[Route("api/admin/coupons")]
[ApiController]
[Authorize(Roles = "Admin")]
public class AdminCouponsController : ControllerBase
{
    private readonly MoxicDbContext _db;

    public AdminCouponsController(MoxicDbContext db)
    {
        _db = db;
    }

    // GET /api/admin/coupons?source=Event|SpinReward&search=&page=1&pageSize=50
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? source, [FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var query = _db.Coupons.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(source) && Enum.TryParse<CouponSource>(source, true, out var src))
            query = query.Where(c => c.Source == src);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            if (term.Length > 100) term = term[..100];
            var upper = term.ToUpperInvariant();
            var lower = term.ToLowerInvariant();
            query = query.Where(c => c.Code.Contains(upper) || c.Name.ToLower().Contains(lower));
        }

        var total = await query.CountAsync();
        var coupons = await query
            .OrderByDescending(c => c.CreatedAt)
            .ThenBy(c => c.Code)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var items = await ToDtosAsync(coupons);
        return Ok(new AdminCouponListResponse(items, total, page, pageSize));
    }

    // POST /api/admin/coupons
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] AdminCouponUpsertRequest req)
    {
        var name = NormalizeName(req.Name);
        if (name == null) return BadRequest(new { error = "Vui lòng nhập tên mã (tối đa 100 ký tự)." });

        string code;
        if (string.IsNullOrWhiteSpace(req.Code))
        {
            code = await GenerateUniqueCodeAsync();
        }
        else
        {
            var normalized = CouponRules.NormalizeCode(req.Code);
            if (normalized == null) return BadRequest(new { error = "Mã chỉ gồm chữ A-Z và số, dài 4–32 ký tự." });
            code = normalized;
        }
        if (await CodeTakenAsync(code)) return Conflict(new { error = "Mã đã tồn tại." });

        var (terms, error) = await ValidateCommonAsync(
            req.DiscountType, req.Value, req.MaxDiscountAmount, req.MinOrderAmount, req.GameId,
            req.StartsAt, req.ExpiresAt, req.MaxTotalUses, req.MaxUsesPerCustomer, isCreate: true);
        if (terms == null) return BadRequest(new { error });

        var now = DateTime.UtcNow;
        var coupon = NewEventCoupon(code, name, terms, req.IsActive, now);
        _db.Coupons.Add(coupon);
        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return Conflict(new { error = "Mã đã tồn tại." });
        }

        var dto = (await ToDtosAsync(new List<Coupon> { coupon }))[0];
        return StatusCode(StatusCodes.Status201Created, dto);
    }

    // POST /api/admin/coupons/bulk
    [HttpPost("bulk")]
    public async Task<IActionResult> Bulk([FromBody] AdminCouponBulkRequest req)
    {
        if (req.Count < 1 || req.Count > CouponRules.MaxBulkCount)
            return BadRequest(new { error = $"Số lượng phải từ 1 đến {CouponRules.MaxBulkCount}." });
        var prefix = CouponRules.NormalizePrefix(req.Prefix);
        if (prefix == null) return BadRequest(new { error = "Tiền tố chỉ gồm A-Z và số, tối đa 12 ký tự." });
        var name = NormalizeName(req.Name);
        if (name == null) return BadRequest(new { error = "Vui lòng nhập tên mã (tối đa 100 ký tự)." });

        var (terms, error) = await ValidateCommonAsync(
            req.DiscountType, req.Value, req.MaxDiscountAmount, req.MinOrderAmount, req.GameId,
            req.StartsAt, req.ExpiresAt, req.MaxTotalUses, req.MaxUsesPerCustomer, isCreate: true);
        if (terms == null) return BadRequest(new { error });

        // Generate, then remove collisions with existing coupon / reward codes (one query per round).
        var codes = new HashSet<string>();
        for (var round = 0; round < 5 && codes.Count < req.Count; round++)
        {
            var batch = new HashSet<string>();
            while (codes.Count + batch.Count < req.Count)
            {
                var candidate = CouponRules.GenerateCode(prefix);
                if (!codes.Contains(candidate)) batch.Add(candidate);
            }
            var list = batch.ToList();
            var taken = await _db.Coupons.AsNoTracking().Where(c => list.Contains(c.Code)).Select(c => c.Code)
                .Union(_db.SpinHistories.AsNoTracking().Where(h => h.RewardCode != null && list.Contains(h.RewardCode)).Select(h => h.RewardCode!))
                .ToListAsync();
            foreach (var c in list)
                if (!taken.Contains(c)) codes.Add(c);
        }
        if (codes.Count < req.Count)
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { error = "Không thể tạo đủ mã duy nhất, vui lòng thử lại." });

        var now = DateTime.UtcNow;
        foreach (var code in codes) _db.Coupons.Add(NewEventCoupon(code, name, terms, req.IsActive, now));
        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return Conflict(new { error = "Trùng mã khi tạo hàng loạt, vui lòng thử lại." });
        }

        return Ok(new AdminCouponBulkResponse(codes.Count, codes.ToList()));
    }

    // PUT /api/admin/coupons/{id} — Code and Source are immutable; never touches OwnerUserId/UsedCount.
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] AdminCouponUpsertRequest req)
    {
        var coupon = await _db.Coupons.FirstOrDefaultAsync(c => c.Id == id);
        if (coupon == null) return NotFound(new { error = "Không tìm thấy mã giảm giá." });

        var name = NormalizeName(req.Name);
        if (name == null) return BadRequest(new { error = "Vui lòng nhập tên mã (tối đa 100 ký tự)." });

        var (terms, error) = await ValidateCommonAsync(
            req.DiscountType, req.Value, req.MaxDiscountAmount, req.MinOrderAmount, req.GameId,
            req.StartsAt, req.ExpiresAt, req.MaxTotalUses, req.MaxUsesPerCustomer, isCreate: false);
        if (terms == null) return BadRequest(new { error });
        if (terms.MaxTotalUses.HasValue && terms.MaxTotalUses.Value < coupon.UsedCount)
            return BadRequest(new { error = $"Tổng lượt không được nhỏ hơn số lượt đã dùng ({coupon.UsedCount})." });

        coupon.Name = name;
        coupon.DiscountType = terms.Terms.Type;
        coupon.Value = terms.Terms.Value;
        coupon.MaxDiscountAmount = terms.Terms.MaxDiscountAmount;
        coupon.MinOrderAmount = terms.Terms.MinOrderAmount;
        coupon.GameId = terms.Terms.GameId;
        coupon.StartsAt = terms.StartsAt;
        coupon.ExpiresAt = terms.ExpiresAt;
        coupon.MaxTotalUses = terms.MaxTotalUses;
        coupon.MaxUsesPerCustomer = terms.MaxUsesPerCustomer;
        coupon.IsActive = req.IsActive;
        coupon.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok((await ToDtosAsync(new List<Coupon> { coupon }))[0]);
    }

    // PATCH /api/admin/coupons/{id}/active
    [HttpPatch("{id:guid}/active")]
    public async Task<IActionResult> Toggle(Guid id, [FromBody] ToggleCouponRequest req)
    {
        var coupon = await _db.Coupons.FirstOrDefaultAsync(c => c.Id == id);
        if (coupon == null) return NotFound(new { error = "Không tìm thấy mã giảm giá." });
        coupon.IsActive = req.IsActive;
        coupon.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok((await ToDtosAsync(new List<Coupon> { coupon }))[0]);
    }

    // DELETE /api/admin/coupons/{id} — only unused coupons (the redemption ledger is append-only)
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var coupon = await _db.Coupons.FirstOrDefaultAsync(c => c.Id == id);
        if (coupon == null) return NotFound(new { error = "Không tìm thấy mã giảm giá." });
        if (await _db.CouponRedemptions.AnyAsync(r => r.CouponId == id))
            return Conflict(new { error = "Mã đã có lượt sử dụng — hãy tắt mã thay vì xóa." });

        _db.Coupons.Remove(coupon);
        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return Conflict(new { error = "Mã đã có lượt sử dụng — hãy tắt mã thay vì xóa." });
        }
        return NoContent();
    }

    // GET /api/admin/coupons/{id}/redemptions
    [HttpGet("{id:guid}/redemptions")]
    public async Task<IActionResult> Redemptions(Guid id)
    {
        if (!await _db.Coupons.AsNoTracking().AnyAsync(c => c.Id == id))
            return NotFound(new { error = "Không tìm thấy mã giảm giá." });

        var rows = await (
                from r in _db.CouponRedemptions.AsNoTracking()
                join o in _db.Orders.AsNoTracking() on r.OrderId equals o.Id
                join u in _db.Users.AsNoTracking() on r.UserId equals u.Id into users
                from u in users.DefaultIfEmpty()
                where r.CouponId == id
                orderby r.CreatedAt descending
                select new
                {
                    r.Id,
                    r.OrderId,
                    o.OrderCode,
                    o.Status,
                    Email = u != null ? u.Email : null,
                    r.DiscountAmount,
                    r.CreatedAt,
                    r.ReleasedAt
                })
            .Take(500)
            .ToListAsync();

        return Ok(rows.Select(r => new AdminCouponRedemptionDto(
            r.Id, r.OrderId, r.OrderCode, r.Status.ToString(), r.Email, r.DiscountAmount, r.CreatedAt, r.ReleasedAt)).ToList());
    }

    // ---- helpers ----

    private sealed record ValidatedCoupon(
        CouponRules.CouponTerms Terms, DateTime? StartsAt, DateTime? ExpiresAt, int? MaxTotalUses, int MaxUsesPerCustomer);

    private static string? NormalizeName(string? raw)
    {
        var name = (raw ?? string.Empty).Trim();
        return name.Length is < 1 or > 100 ? null : name;
    }

    private async Task<(ValidatedCoupon? Result, string? Error)> ValidateCommonAsync(
        CouponDiscountType type, decimal value, decimal? max, decimal? min, Guid? gameId,
        DateTime? startsAt, DateTime? expiresAt, int? maxTotalUses, int? maxUsesPerCustomer, bool isCreate)
    {
        if (!Enum.IsDefined(type)) return (null, "Loại giảm giá không hợp lệ.");
        var (terms, termsError) = CouponRules.NormalizeTerms(type, value, max, min, gameId);
        if (terms == null) return (null, termsError);
        if (terms.GameId != null && !await _db.Games.AsNoTracking().AnyAsync(g => g.Id == terms.GameId.Value))
            return (null, "Game không tồn tại.");

        var starts = CouponRules.ToUtc(startsAt);
        var expires = CouponRules.ToUtc(expiresAt);
        if (starts.HasValue && expires.HasValue && expires.Value <= starts.Value)
            return (null, "Thời gian kết thúc phải sau thời gian bắt đầu.");
        if (isCreate && expires.HasValue && expires.Value <= DateTime.UtcNow)
            return (null, "Thời gian kết thúc phải ở tương lai.");

        if (maxTotalUses.HasValue && (maxTotalUses.Value < 1 || maxTotalUses.Value > 1_000_000))
            return (null, "Tổng lượt dùng phải từ 1 đến 1.000.000 (để trống = không giới hạn).");
        var perCustomer = maxUsesPerCustomer ?? 1;
        if (perCustomer < 1 || perCustomer > 100)
            return (null, "Lượt dùng mỗi khách phải từ 1 đến 100.");

        return (new ValidatedCoupon(terms, starts, expires, maxTotalUses, perCustomer), null);
    }

    private Coupon NewEventCoupon(string code, string name, ValidatedCoupon v, bool isActive, DateTime now)
    {
        var createdBy = User.Identity?.Name;
        if (createdBy != null && createdBy.Length > 256) createdBy = createdBy[..256];
        return new Coupon
        {
            Id = Guid.NewGuid(),
            Code = code,
            Name = name,
            Source = CouponSource.Event,
            DiscountType = v.Terms.Type,
            Value = v.Terms.Value,
            MaxDiscountAmount = v.Terms.MaxDiscountAmount,
            MinOrderAmount = v.Terms.MinOrderAmount,
            GameId = v.Terms.GameId,
            StartsAt = v.StartsAt,
            ExpiresAt = v.ExpiresAt,
            MaxTotalUses = v.MaxTotalUses,
            MaxUsesPerCustomer = v.MaxUsesPerCustomer,
            UsedCount = 0,
            IsActive = isActive,
            CreatedBy = createdBy,
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    private async Task<bool> CodeTakenAsync(string code) =>
        await _db.Coupons.AsNoTracking().AnyAsync(c => c.Code == code)
        || await _db.SpinHistories.AsNoTracking().AnyAsync(h => h.RewardCode == code);

    private async Task<string> GenerateUniqueCodeAsync()
    {
        for (var attempt = 0; attempt < 5; attempt++)
        {
            var candidate = CouponRules.GenerateCode(string.Empty);
            if (!await CodeTakenAsync(candidate)) return candidate;
        }
        return CouponRules.GenerateCode(string.Empty);
    }

    /// <summary>Maps coupons with one game-name query and one owner-email query (no N+1).</summary>
    private async Task<List<AdminCouponDto>> ToDtosAsync(List<Coupon> coupons)
    {
        var gameIds = coupons.Where(c => c.GameId != null).Select(c => c.GameId!.Value).Distinct().ToList();
        var games = gameIds.Count == 0
            ? new Dictionary<Guid, string>()
            : await _db.Games.AsNoTracking().Where(g => gameIds.Contains(g.Id)).ToDictionaryAsync(g => g.Id, g => g.Name);

        var ownerIds = coupons.Where(c => c.OwnerUserId != null).Select(c => c.OwnerUserId!).Distinct().ToList();
        var owners = ownerIds.Count == 0
            ? new Dictionary<string, string?>()
            : await _db.Users.AsNoTracking().Where(u => ownerIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.Email);

        return coupons.Select(c => new AdminCouponDto(
            c.Id, c.Code, c.Name, c.Source, c.DiscountType, c.Value, c.MaxDiscountAmount, c.MinOrderAmount,
            c.GameId, c.GameId != null ? games.GetValueOrDefault(c.GameId.Value) : null,
            c.StartsAt, c.ExpiresAt, c.MaxTotalUses, c.MaxUsesPerCustomer, c.UsedCount, c.IsActive,
            c.OwnerUserId, c.OwnerUserId != null ? owners.GetValueOrDefault(c.OwnerUserId) : null,
            c.ClaimedAt, c.SpinHistoryId, c.CreatedBy, c.CreatedAt, c.UpdatedAt)).ToList();
    }
}
