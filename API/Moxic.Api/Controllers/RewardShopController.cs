using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Moxic.Api.Services;
using Moxic.Core.Entities;
using Moxic.Infrastructure.Data;
using Moxic.Shared.Enums;

namespace Moxic.Api.Controllers;

/// <summary>Points shop ("Đổi điểm") for customers + item management for admins.</summary>
[ApiController]
public class RewardShopController : ControllerBase
{
    private readonly MoxicDbContext _db;
    private readonly RewardShopService _shop;
    private readonly PointsService _points;

    public RewardShopController(MoxicDbContext db, RewardShopService shop, PointsService points)
    {
        _db = db;
        _shop = shop;
        _points = points;
    }

    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty;

    private async Task<Dictionary<Guid, string>> CaseNamesAsync(IEnumerable<Guid?> ids)
    {
        var list = ids.Where(i => i != null).Select(i => i!.Value).Distinct().ToList();
        if (list.Count == 0) return new();
        return await _db.SpinCases.AsNoTracking().Where(c => list.Contains(c.Id)).ToDictionaryAsync(c => c.Id, c => c.Name);
    }

    // GET /api/rewards/shop — public catalog; signed-in customers also get their balance + per-item usage
    [HttpGet("api/rewards/shop")]
    public async Task<IActionResult> Catalog()
    {
        var items = await _db.RewardItems.AsNoTracking().Where(i => i.IsActive)
            .OrderBy(i => i.DisplayOrder).ThenBy(i => i.PointsCost).ToListAsync();
        var cases = await CaseNamesAsync(items.Select(i => i.SpinCaseId));

        string? userId = null;
        var auth = await HttpContext.AuthenticateAsync(CustomerAuthRules.Scheme);
        if (auth.Succeeded && auth.Principal?.IsInRole(CustomerAuthRules.CustomerRole) == true)
            userId = auth.Principal.FindFirstValue(ClaimTypes.NameIdentifier);

        int? balance = null;
        var mine = new Dictionary<Guid, int>();
        if (userId != null)
        {
            balance = await _points.GetBalanceAsync(userId);
            mine = await _db.RewardRedemptions.AsNoTracking().Where(r => r.UserId == userId)
                .GroupBy(r => r.RewardItemId).Select(g => new { g.Key, N = g.Count() })
                .ToDictionaryAsync(x => x.Key, x => x.N);
        }

        return Ok(new
        {
            balance,
            items = items.Select(i => new
            {
                i.Id, i.Name, i.Description, Kind = i.Kind.ToString(), i.PointsCost,
                DiscountType = i.DiscountType?.ToString(), i.DiscountValue, i.DiscountMaxAmount, i.DiscountMinOrderAmount,
                CaseName = i.SpinCaseId != null ? cases.GetValueOrDefault(i.SpinCaseId.Value) : null,
                i.ValidDays,
                Remaining = i.Stock == null ? (int?)null : Math.Max(0, i.Stock.Value - i.RedeemedCount),
                i.PerUserLimit,
                MyRedeemed = mine.GetValueOrDefault(i.Id),
            }),
        });
    }

    // POST /api/rewards/shop/{id}/redeem
    [HttpPost("api/rewards/shop/{id:guid}/redeem")]
    [Authorize(AuthenticationSchemes = CustomerAuthRules.Scheme, Roles = CustomerAuthRules.CustomerRole)]
    [EnableRateLimiting(CouponRules.RateLimitPolicy)]
    public async Task<IActionResult> Redeem(Guid id)
    {
        var r = await _shop.RedeemAsync(UserId, id);
        if (!r.Ok) return BadRequest(new { error = r.Error, balance = r.Balance });
        string? slug = null;
        if (r.Redemption!.SpinCodeId != null)
            slug = await _db.SpinCodes.AsNoTracking().Where(c => c.Id == r.Redemption.SpinCodeId).Select(c => c.Case!.Slug).FirstOrDefaultAsync();
        return Ok(new
        {
            balance = r.Balance,
            code = r.Redemption.IssuedCode,
            kind = r.Redemption.Kind.ToString(),
            expiresAt = r.Redemption.ExpiresAt,
            caseSlug = slug,
        });
    }

    // GET /api/rewards/shop/history
    [HttpGet("api/rewards/shop/history")]
    [Authorize(AuthenticationSchemes = CustomerAuthRules.Scheme, Roles = CustomerAuthRules.CustomerRole)]
    public async Task<IActionResult> History()
    {
        var rows = await _db.RewardRedemptions.AsNoTracking().Where(r => r.UserId == UserId)
            .OrderByDescending(r => r.CreatedAt).Take(50).ToListAsync();
        var codeIds = rows.Where(r => r.SpinCodeId != null).Select(r => r.SpinCodeId!.Value).ToList();
        var spin = await _db.SpinCodes.AsNoTracking().Where(c => codeIds.Contains(c.Id))
            .Select(c => new { c.Id, c.UsedCount, c.MaxUses, Slug = c.Case!.Slug }).ToDictionaryAsync(c => c.Id);
        var couponIds = rows.Where(r => r.CouponId != null).Select(r => r.CouponId!.Value).ToList();
        var used = await _db.Coupons.AsNoTracking().Where(c => couponIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, c => c.UsedCount >= (c.MaxTotalUses ?? int.MaxValue));

        return Ok(rows.Select(r => new
        {
            r.Id, r.ItemName, Kind = r.Kind.ToString(), r.PointsSpent, Code = r.IssuedCode, r.ExpiresAt, r.CreatedAt,
            Used = r.SpinCodeId != null ? spin.TryGetValue(r.SpinCodeId.Value, out var s) && s.UsedCount >= s.MaxUses
                 : r.CouponId != null && used.GetValueOrDefault(r.CouponId.Value),
            CaseSlug = r.SpinCodeId != null && spin.TryGetValue(r.SpinCodeId.Value, out var s2) ? s2.Slug : null,
        }));
    }

    // ---------------- admin ----------------

    public record RewardItemRequest(
        string Name, string? Description, string Kind, int PointsCost,
        string? DiscountType, decimal? DiscountValue, decimal? DiscountMaxAmount, decimal? DiscountMinOrderAmount,
        Guid? SpinCaseId, int ValidDays, int? Stock, int? PerUserLimit, bool IsActive, int DisplayOrder);

    [HttpGet("api/admin/reward-items")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AdminList()
    {
        var items = await _db.RewardItems.AsNoTracking().OrderBy(i => i.DisplayOrder).ThenBy(i => i.PointsCost).ToListAsync();
        var cases = await _db.SpinCases.AsNoTracking().Where(c => c.OpenMethod == SpinCaseOpenMethod.Code)
            .OrderBy(c => c.DisplayOrder).Select(c => new { c.Id, c.Name, c.IsActive }).ToListAsync();
        var since = DateTime.UtcNow.AddDays(-30);
        var recent = await _db.RewardRedemptions.AsNoTracking().Where(r => r.CreatedAt >= since)
            .GroupBy(r => r.RewardItemId).Select(g => new { g.Key, N = g.Count(), P = g.Sum(x => x.PointsSpent) })
            .ToDictionaryAsync(x => x.Key);
        return Ok(new
        {
            items = items.Select(i => new
            {
                i.Id, i.Name, i.Description, Kind = i.Kind.ToString(), i.PointsCost,
                DiscountType = i.DiscountType?.ToString(), i.DiscountValue, i.DiscountMaxAmount, i.DiscountMinOrderAmount,
                i.SpinCaseId, i.ValidDays, i.Stock, i.RedeemedCount, i.PerUserLimit, i.IsActive, i.DisplayOrder,
                Redeemed30d = recent.TryGetValue(i.Id, out var r) ? r.N : 0,
            }),
            cases,
        });
    }

    private string? Apply(RewardItem item, RewardItemRequest req)
    {
        var name = req.Name?.Trim() ?? "";
        if (name.Length is < 2 or > 100) return "Tên phần quà 2–100 ký tự";
        if (req.PointsCost is < 1 or > 10_000_000) return "Giá điểm không hợp lệ";
        if (!Enum.TryParse<RewardKind>(req.Kind, true, out var kind)) return "Loại phần quà không hợp lệ";
        item.Name = name;
        item.Description = string.IsNullOrWhiteSpace(req.Description) ? null : req.Description.Trim()[..Math.Min(300, req.Description.Trim().Length)];
        item.Kind = kind;
        item.PointsCost = req.PointsCost;
        item.ValidDays = Math.Clamp(req.ValidDays, 1, 365);
        item.Stock = req.Stock is >= 0 ? req.Stock : null;
        item.PerUserLimit = req.PerUserLimit is > 0 ? req.PerUserLimit : null;
        item.IsActive = req.IsActive;
        item.DisplayOrder = req.DisplayOrder;
        if (kind == RewardKind.Coupon)
        {
            if (!Enum.TryParse<CouponDiscountType>(req.DiscountType, true, out var dt)) return "Chọn kiểu giảm giá";
            if (req.DiscountValue is not > 0m) return "Giá trị giảm phải > 0";
            if (dt == CouponDiscountType.Percent && req.DiscountValue > 100m) return "Phần trăm tối đa 100";
            item.DiscountType = dt;
            item.DiscountValue = req.DiscountValue;
            item.DiscountMaxAmount = dt == CouponDiscountType.Percent && req.DiscountMaxAmount is > 0m ? req.DiscountMaxAmount : null;
            item.DiscountMinOrderAmount = req.DiscountMinOrderAmount is > 0m ? req.DiscountMinOrderAmount : null;
            item.SpinCaseId = null;
        }
        else
        {
            if (req.SpinCaseId == null) return "Chọn hòm quà";
            item.SpinCaseId = req.SpinCaseId;
            item.DiscountType = null;
            item.DiscountValue = null;
            item.DiscountMaxAmount = null;
            item.DiscountMinOrderAmount = null;
        }
        item.UpdatedAt = DateTime.UtcNow;
        return null;
    }

    [HttpPost("api/admin/reward-items")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AdminCreate([FromBody] RewardItemRequest req)
    {
        var item = new RewardItem { Id = Guid.NewGuid(), CreatedAt = DateTime.UtcNow };
        var err = Apply(item, req);
        if (err != null) return BadRequest(new { error = err });
        if (item.Kind == RewardKind.CaseCode && !await _db.SpinCases.AnyAsync(c => c.Id == item.SpinCaseId && c.OpenMethod == SpinCaseOpenMethod.Code))
            return BadRequest(new { error = "Hòm phải là loại mở bằng mã" });
        _db.RewardItems.Add(item);
        await _db.SaveChangesAsync();
        return Ok(new { item.Id });
    }

    [HttpPut("api/admin/reward-items/{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AdminUpdate(Guid id, [FromBody] RewardItemRequest req)
    {
        var item = await _db.RewardItems.FirstOrDefaultAsync(i => i.Id == id);
        if (item == null) return NotFound();
        var err = Apply(item, req);
        if (err != null) return BadRequest(new { error = err });
        if (item.Kind == RewardKind.CaseCode && !await _db.SpinCases.AnyAsync(c => c.Id == item.SpinCaseId && c.OpenMethod == SpinCaseOpenMethod.Code))
            return BadRequest(new { error = "Hòm phải là loại mở bằng mã" });
        await _db.SaveChangesAsync();
        return Ok(new { item.Id });
    }

    [HttpDelete("api/admin/reward-items/{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AdminDelete(Guid id)
    {
        // Redemption history keeps the item name snapshot, so the item row can go.
        var n = await _db.RewardItems.Where(i => i.Id == id).ExecuteDeleteAsync();
        return n == 0 ? NotFound() : NoContent();
    }
}
