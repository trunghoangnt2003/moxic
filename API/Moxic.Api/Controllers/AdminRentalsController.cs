using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moxic.Api.Services;
using Moxic.Core.Entities;
using Moxic.Core.Interfaces;
using Moxic.Infrastructure.Data;

namespace Moxic.Api.Controllers;

public record AdminRentalCancelRequest(string? Reason);
public record AdminRentalAssetRequest(Guid AssetId);
public record RentalAssetUpsertRequest(string? Label, string? LoginEmail, string? Password, string? Notes, int Slots, bool IsActive, List<Guid>? GameIds);
public record RentalPlanItem(Guid? Id, int Days, decimal Price, bool IsActive);

/// <summary>Admin: rental orders, rental assets (shop accounts) and rental plans per game.</summary>
[Route("api/admin")]
[ApiController]
[Authorize(Roles = "Admin")]
public class AdminRentalsController : ControllerBase
{
    private readonly MoxicDbContext _db;
    private readonly RentalService _rentals;
    private readonly IBackgroundEmailQueue _emails;

    public AdminRentalsController(MoxicDbContext db, RentalService rentals, IBackgroundEmailQueue emails)
    {
        _db = db;
        _rentals = rentals;
        _emails = emails;
    }

    // ───────────── Orders ─────────────

    // GET /api/admin/rentals?status=&search=&page=
    [HttpGet("rentals")]
    public async Task<IActionResult> List([FromQuery] string? status, [FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 30)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var q = _db.RentalOrders.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(status))
        {
            var list = status.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            q = q.Where(r => list.Contains(r.Status));
        }
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            q = q.Where(r => r.Code.ToLower().Contains(s) || r.CustomerEmail.ToLower().Contains(s) || r.GameName.ToLower().Contains(s));
        }

        var total = await q.CountAsync();
        var items = await q
            .OrderBy(r => r.Status == RentalStatus.AwaitingConfirmation ? 0 : r.Status == RentalStatus.Expired ? 1 : r.Status == RentalStatus.PendingPayment ? 2 : r.Status == RentalStatus.Active ? 3 : 4)
            .ThenByDescending(r => r.UpdatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(r => new
            {
                r.Id, r.Code, r.Kind, ParentCode = r.Parent != null ? r.Parent.Code : null,
                r.CustomerEmail, r.CustomerPhone, r.GameId, r.GameName, r.Days, r.Price, r.Status,
                r.AssetId, AssetLabel = r.Asset != null ? r.Asset.Label : (r.Parent != null && r.Parent.Asset != null ? r.Parent.Asset.Label : null),
                r.StartsAt, r.EndsAt, r.PaidAt, r.ReturnedAt, r.CancelReason, r.CreatedAt, r.UpdatedAt,
            })
            .ToListAsync();

        var counts = await _db.RentalOrders.AsNoTracking().GroupBy(r => r.Status).Select(g => new { status = g.Key, count = g.Count() }).ToListAsync();
        return Ok(new { items, total, page, pageSize, counts });
    }

    // POST /api/admin/rentals/{id}/confirm — payment received → deliver (rental) or apply (extension)
    [HttpPost("rentals/{id:guid}/confirm")]
    public async Task<IActionResult> Confirm(Guid id)
    {
        await using var tx = await _db.Database.BeginTransactionAsync();
        var r = await _db.RentalOrders.Include(x => x.Parent).FirstOrDefaultAsync(x => x.Id == id);
        if (r == null) return NotFound(new { error = "Không tìm thấy đơn thuê." });
        if (r.Status != RentalStatus.PendingPayment && r.Status != RentalStatus.AwaitingConfirmation)
            return BadRequest(new { error = "Đơn không ở trạng thái chờ thanh toán." });

        var now = DateTime.UtcNow;
        string notice;
        if (r.Kind == "Extension")
        {
            var parent = r.Parent!;
            if (parent.Status != RentalStatus.Active && parent.Status != RentalStatus.Expired)
                return BadRequest(new { error = "Đơn thuê gốc đã thu hồi/hủy, không thể gia hạn." });
            var baseEnd = parent.EndsAt.HasValue && parent.EndsAt > now ? parent.EndsAt.Value : now;
            parent.EndsAt = baseEnd.AddDays(r.Days);
            parent.Status = RentalStatus.Active;
            parent.ReminderSentAt = null;
            parent.UpdatedAt = now;
            r.Status = RentalStatus.Completed;
            notice = $"Đơn thuê {parent.Code} ({parent.GameName}) đã được gia hạn thêm {r.Days} ngày, hết hạn mới: {ToVn(parent.EndsAt)}.";
        }
        else
        {
            if (r.AssetId == null)
            {
                r.AssetId = await _rentals.ReserveAssetAsync(r.GameId);
                if (r.AssetId == null) return Conflict(new { error = "Không còn tài sản trống cho game này. Hãy thêm tài sản hoặc thu hồi đơn cũ." });
            }
            r.Status = RentalStatus.Active;
            r.StartsAt = now;
            r.EndsAt = now.AddDays(r.Days);
            notice = $"Đơn thuê {r.Code} ({r.GameName}) đã được bàn giao. Thông tin đăng nhập nằm trong mục \"Game đang thuê\" trên moxic.co. Hạn thuê đến {ToVn(r.EndsAt)}.";
        }
        r.PaidAt = now;
        r.UpdatedAt = now;
        await _db.SaveChangesAsync();
        await tx.CommitAsync();

        QueueEmail(r.CustomerEmail, "Thuê game — Moxic GameStore", r.Kind == "Extension" ? "GIA HẠN THÀNH CÔNG" : "ĐÃ BÀN GIAO GAME THUÊ", notice);
        return NoContent();
    }

    // POST /api/admin/rentals/{id}/return — admin changed the account password → slot freed
    [HttpPost("rentals/{id:guid}/return")]
    public async Task<IActionResult> Return(Guid id)
    {
        var now = DateTime.UtcNow;
        var updated = await _db.RentalOrders
            .Where(r => r.Id == id && r.Kind == "Rental" && (r.Status == RentalStatus.Active || r.Status == RentalStatus.Expired))
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.Status, RentalStatus.Returned).SetProperty(r => r.ReturnedAt, now).SetProperty(r => r.UpdatedAt, now));
        if (updated == 0) return BadRequest(new { error = "Chỉ thu hồi được đơn đang thuê hoặc đã hết hạn." });
        // Pending extensions of a reclaimed rental can no longer apply.
        await _db.RentalOrders.Where(r => r.ParentId == id && (r.Status == RentalStatus.PendingPayment || r.Status == RentalStatus.AwaitingConfirmation))
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.Status, RentalStatus.Cancelled).SetProperty(r => r.CancelReason, "Đơn thuê đã thu hồi").SetProperty(r => r.UpdatedAt, now));
        return NoContent();
    }

    // POST /api/admin/rentals/{id}/cancel { reason }
    [HttpPost("rentals/{id:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid id, [FromBody] AdminRentalCancelRequest request)
    {
        var reason = string.IsNullOrWhiteSpace(request.Reason) ? "Admin hủy" : request.Reason.Trim()[..Math.Min(request.Reason.Trim().Length, 300)];
        var r = await _db.RentalOrders.FirstOrDefaultAsync(x => x.Id == id);
        if (r == null) return NotFound(new { error = "Không tìm thấy đơn thuê." });
        if (r.Status != RentalStatus.PendingPayment && r.Status != RentalStatus.AwaitingConfirmation)
            return BadRequest(new { error = "Chỉ hủy được đơn chưa xác nhận thanh toán." });
        r.Status = RentalStatus.Cancelled;
        r.CancelReason = reason;
        r.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        QueueEmail(r.CustomerEmail, "Đơn thuê đã hủy — Moxic GameStore", "ĐƠN THUÊ ĐÃ HỦY", $"Đơn {r.Code} ({r.GameName}) đã bị hủy. Lý do: {reason}.");
        return NoContent();
    }

    // PUT /api/admin/rentals/{id}/asset { assetId } — move a rental to another account
    [HttpPut("rentals/{id:guid}/asset")]
    public async Task<IActionResult> Reassign(Guid id, [FromBody] AdminRentalAssetRequest request)
    {
        var r = await _db.RentalOrders.FirstOrDefaultAsync(x => x.Id == id && x.Kind == "Rental");
        if (r == null) return NotFound(new { error = "Không tìm thấy đơn thuê." });
        if (!RentalStatus.Occupying.Contains(r.Status)) return BadRequest(new { error = "Đơn đã kết thúc." });
        var ok = await _db.RentalAssets.AnyAsync(a => a.Id == request.AssetId && a.IsActive && a.Games.Any(g => g.GameId == r.GameId));
        if (!ok) return BadRequest(new { error = "Tài sản không sở hữu game này hoặc đang tắt." });
        r.AssetId = request.AssetId;
        r.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ───────────── Assets ─────────────

    [HttpGet("rental-assets")]
    public async Task<IActionResult> Assets()
    {
        var items = await _db.RentalAssets.AsNoTracking()
            .OrderBy(a => a.Label)
            .Select(a => new
            {
                a.Id, a.Label, a.LoginEmail, a.Notes, a.Slots, a.IsActive, a.CreatedAt,
                Games = a.Games.Select(g => new { g.GameId, g.Game.Name }).ToList(),
                Used = _db.RentalOrders.Count(r => r.AssetId == a.Id && r.Kind == "Rental" && RentalStatus.Occupying.Contains(r.Status)),
                Active = _db.RentalOrders.Where(r => r.AssetId == a.Id && r.Kind == "Rental" && RentalStatus.Occupying.Contains(r.Status))
                    .Select(r => new { r.Code, r.CustomerEmail, r.GameName, r.Status, r.EndsAt }).ToList(),
            })
            .ToListAsync();
        return Ok(items);
    }

    [HttpGet("rental-assets/{id:guid}/password")]
    public async Task<IActionResult> AssetPassword(Guid id)
    {
        var a = await _db.RentalAssets.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        if (a == null) return NotFound(new { error = "Không tìm thấy tài sản." });
        return Ok(new { password = _rentals.Unprotect(a.PasswordEncrypted) });
    }

    [HttpPost("rental-assets")]
    public Task<IActionResult> CreateAsset([FromBody] RentalAssetUpsertRequest request) => UpsertAsset(null, request);

    [HttpPut("rental-assets/{id:guid}")]
    public Task<IActionResult> UpdateAsset(Guid id, [FromBody] RentalAssetUpsertRequest request) => UpsertAsset(id, request);

    [HttpDelete("rental-assets/{id:guid}")]
    public async Task<IActionResult> DeleteAsset(Guid id)
    {
        if (await _db.RentalOrders.AnyAsync(r => r.AssetId == id && RentalStatus.Occupying.Contains(r.Status)))
            return BadRequest(new { error = "Tài sản đang có khách thuê — hãy thu hồi hoặc chuyển đơn trước." });
        await _db.RentalAssets.Where(a => a.Id == id).ExecuteDeleteAsync();
        return NoContent();
    }

    private async Task<IActionResult> UpsertAsset(Guid? id, RentalAssetUpsertRequest req)
    {
        var label = (req.Label ?? string.Empty).Trim();
        var email = (req.LoginEmail ?? string.Empty).Trim();
        if (label.Length < 1 || label.Length > 60) return BadRequest(new { error = "Tên tài sản phải từ 1–60 ký tự." });
        if (email.Length < 3 || email.Length > 200) return BadRequest(new { error = "Email đăng nhập không hợp lệ." });
        if (req.Slots < 1 || req.Slots > 20) return BadRequest(new { error = "Số slot phải từ 1–20." });

        RentalAsset? asset;
        if (id.HasValue)
        {
            asset = await _db.RentalAssets.Include(a => a.Games).FirstOrDefaultAsync(a => a.Id == id.Value);
            if (asset == null) return NotFound(new { error = "Không tìm thấy tài sản." });
        }
        else
        {
            if (string.IsNullOrEmpty(req.Password)) return BadRequest(new { error = "Vui lòng nhập mật khẩu tài khoản." });
            asset = new RentalAsset { Id = Guid.NewGuid(), CreatedAt = DateTime.UtcNow };
            _db.RentalAssets.Add(asset);
        }

        asset.Label = label;
        asset.LoginEmail = email;
        asset.Notes = string.IsNullOrWhiteSpace(req.Notes) ? null : req.Notes.Trim()[..Math.Min(req.Notes.Trim().Length, 500)];
        asset.Slots = req.Slots;
        asset.IsActive = req.IsActive;
        asset.UpdatedAt = DateTime.UtcNow;
        if (!string.IsNullOrEmpty(req.Password)) asset.PasswordEncrypted = _rentals.Protect(req.Password);

        var gameIds = (req.GameIds ?? new()).Distinct().ToList();
        var valid = await _db.Games.Where(g => gameIds.Contains(g.Id)).Select(g => g.Id).ToListAsync();
        foreach (var stale in asset.Games.Where(g => !valid.Contains(g.GameId)).ToList()) asset.Games.Remove(stale);
        foreach (var gid in valid.Where(g => asset.Games.All(x => x.GameId != g)))
            asset.Games.Add(new RentalAssetGame { AssetId = asset.Id, GameId = gid });

        await _db.SaveChangesAsync();
        return Ok(new { asset.Id });
    }

    // ───────────── Plans ─────────────

    // GET /api/admin/rental-plans — every game with its plans and slot coverage
    [HttpGet("rental-plans")]
    public async Task<IActionResult> PlansOverview()
    {
        var games = await _db.Games.AsNoTracking()
            .OrderBy(g => g.Name)
            .Select(g => new
            {
                g.Id, g.Name,
                Plans = _db.RentalPlans.Where(p => p.GameId == g.Id).OrderBy(p => p.Days)
                    .Select(p => new { p.Id, p.Days, p.Price, p.IsActive }).ToList(),
                Slots = _db.RentalAssets.Where(a => a.IsActive && a.Games.Any(x => x.GameId == g.Id)).Sum(a => (int?)a.Slots) ?? 0,
            })
            .ToListAsync();
        return Ok(games);
    }

    // PUT /api/admin/rental-plans/{gameId} — replace the game's plans
    [HttpPut("rental-plans/{gameId:guid}")]
    public async Task<IActionResult> PutPlans(Guid gameId, [FromBody] List<RentalPlanItem> plans)
    {
        if (!await _db.Games.AnyAsync(g => g.Id == gameId)) return NotFound(new { error = "Không tìm thấy game." });
        if (plans.Count > 10) return BadRequest(new { error = "Tối đa 10 gói." });
        if (plans.Any(p => p.Days < 1 || p.Days > 365 || p.Price < 0)) return BadRequest(new { error = "Số ngày 1–365, giá không âm." });
        if (plans.Select(p => p.Days).Distinct().Count() != plans.Count) return BadRequest(new { error = "Trùng số ngày giữa các gói." });

        var existing = await _db.RentalPlans.Where(p => p.GameId == gameId).ToListAsync();
        var now = DateTime.UtcNow;
        // Plans referenced by orders are deactivated rather than deleted (orders keep PlanId).
        foreach (var e in existing.Where(e => plans.All(p => p.Id != e.Id)))
        {
            if (await _db.RentalOrders.AnyAsync(r => r.PlanId == e.Id)) { e.IsActive = false; e.UpdatedAt = now; }
            else _db.RentalPlans.Remove(e);
        }
        var order = 0;
        foreach (var p in plans.OrderBy(p => p.Days))
        {
            var entity = p.Id.HasValue ? existing.FirstOrDefault(e => e.Id == p.Id.Value) : null;
            if (entity == null)
            {
                entity = new RentalPlan { Id = Guid.NewGuid(), GameId = gameId, CreatedAt = now };
                _db.RentalPlans.Add(entity);
            }
            entity.Days = p.Days;
            entity.Price = p.Price;
            entity.IsActive = p.IsActive;
            entity.DisplayOrder = order++;
            entity.UpdatedAt = now;
        }
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static string ToVn(DateTime? utc) => utc.HasValue ? utc.Value.AddHours(7).ToString("HH:mm dd/MM/yyyy") : "—";

    private void QueueEmail(string to, string subject, string title, string message)
    {
        if (string.IsNullOrWhiteSpace(to)) return;
        _emails.Enqueue(async (sf, ct) =>
        {
            using var scope = sf.CreateScope();
            var svc = scope.ServiceProvider.GetRequiredService<Moxic.Core.Interfaces.IEmailService>();
            await svc.SendNoticeAsync(to, subject, title, message);
        });
    }
}
