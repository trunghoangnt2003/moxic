using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Moxic.Api.Services;
using Moxic.Core.Entities;
using Moxic.Core.Interfaces;
using Moxic.Infrastructure.Data;

namespace Moxic.Api.Controllers;

public record CreateRentalRequest(Guid GameId, Guid PlanId, string? Phone);
public record ExtendRentalRequest(Guid PlanId);

/// <summary>Customer-facing game rental: plans/availability (public) and the customer's rentals.</summary>
[Route("api/rentals")]
[ApiController]
public class RentalsController : ControllerBase
{
    private readonly MoxicDbContext _db;
    private readonly RentalService _rentals;
    private readonly UserManager<IdentityUser> _users;
    private readonly IMinioService _minio;

    public RentalsController(MoxicDbContext db, RentalService rentals, UserManager<IdentityUser> users, IMinioService minio)
    {
        _db = db;
        _rentals = rentals;
        _users = users;
        _minio = minio;
    }

    private string? UserId => User.FindFirstValue(ClaimTypes.NameIdentifier);

    // GET /api/rentals/games/{gameId} — plans + live availability (public)
    [HttpGet("games/{gameId:guid}")]
    public async Task<IActionResult> GamePlans(Guid gameId)
    {
        var plans = await _db.RentalPlans.AsNoTracking()
            .Where(p => p.GameId == gameId && p.IsActive)
            .OrderBy(p => p.Days)
            .Select(p => new { p.Id, p.Days, p.Price })
            .ToListAsync();
        var (total, free) = await _rentals.GetAvailabilityAsync(gameId);
        return Ok(new { plans, totalSlots = total, freeSlots = free, rentable = plans.Count > 0 && total > 0 });
    }

    // POST /api/rentals — reserve a slot and create a pending rental
    [HttpPost]
    [Authorize(AuthenticationSchemes = CustomerAuthRules.Scheme, Roles = CustomerAuthRules.CustomerRole)]
    [EnableRateLimiting(CouponRules.RateLimitPolicy)]
    public async Task<IActionResult> Create([FromBody] CreateRentalRequest request)
    {
        var user = await _users.FindByIdAsync(UserId ?? string.Empty);
        if (user == null || !user.EmailConfirmed) return Forbid(CustomerAuthRules.Scheme);

        var plan = await _db.RentalPlans.AsNoTracking().Include(p => p.Game)
            .FirstOrDefaultAsync(p => p.Id == request.PlanId && p.GameId == request.GameId && p.IsActive);
        if (plan == null) return BadRequest(new { error = "Gói thuê không còn khả dụng." });

        var openCount = await _db.RentalOrders.CountAsync(r => r.CustomerId == user.Id && r.Kind == "Rental"
            && (r.Status == RentalStatus.PendingPayment || r.Status == RentalStatus.AwaitingConfirmation));
        if (openCount >= 3) return BadRequest(new { error = "Bạn đang có quá nhiều đơn thuê chờ thanh toán. Vui lòng hoàn tất hoặc hủy bớt." });

        var phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim()[..Math.Min(request.Phone.Trim().Length, 20)];

        await using var tx = await _db.Database.BeginTransactionAsync();
        var assetId = await _rentals.ReserveAssetAsync(plan.GameId);
        if (assetId == null)
        {
            await tx.RollbackAsync();
            return Conflict(new { error = "Game này tạm hết slot cho thuê. Vui lòng quay lại sau hoặc liên hệ Moxic.", code = "NO_SLOT" });
        }

        var now = DateTime.UtcNow;
        var rental = new RentalOrder
        {
            Id = Guid.NewGuid(),
            Code = RentalService.NewCode(),
            Kind = "Rental",
            CustomerId = user.Id,
            CustomerEmail = user.Email ?? string.Empty,
            CustomerPhone = phone,
            GameId = plan.GameId,
            GameName = plan.Game.Name,
            PlanId = plan.Id,
            Days = plan.Days,
            Price = plan.Price,
            Status = RentalStatus.PendingPayment,
            AssetId = assetId,
            CreatedAt = now,
            UpdatedAt = now,
        };
        _db.RentalOrders.Add(rental);
        await _db.SaveChangesAsync();
        await tx.CommitAsync();

        return Ok(new { code = rental.Code });
    }

    // GET /api/rentals/mine
    [HttpGet("mine")]
    [Authorize(AuthenticationSchemes = CustomerAuthRules.Scheme, Roles = CustomerAuthRules.CustomerRole)]
    public async Task<IActionResult> Mine()
    {
        var rows = await _db.RentalOrders.AsNoTracking()
            .Where(r => r.CustomerId == UserId && r.Kind == "Rental")
            .OrderByDescending(r => r.CreatedAt)
            .Take(100)
            .Select(r => new { r.Code, r.GameId, r.GameName, r.Days, r.Price, r.Status, r.StartsAt, r.EndsAt, r.CreatedAt })
            .ToListAsync();
        var covers = await CoversAsync(rows.Select(r => r.GameId));
        return Ok(rows.Select(r => new
        {
            r.Code, r.GameId, r.GameName, r.Days, r.Price, r.Status, r.StartsAt, r.EndsAt, r.CreatedAt,
            coverUrl = covers.GetValueOrDefault(r.GameId),
        }));
    }

    // GET /api/rentals/{code} — owner only; credentials only while Active
    [HttpGet("{code}")]
    [Authorize(AuthenticationSchemes = CustomerAuthRules.Scheme, Roles = CustomerAuthRules.CustomerRole)]
    public async Task<IActionResult> Get(string code)
    {
        var r = await _db.RentalOrders.AsNoTracking().Include(x => x.Asset)
            .FirstOrDefaultAsync(x => x.Code == code && x.CustomerId == UserId && x.Kind == "Rental");
        if (r == null) return NotFound(new { error = "Không tìm thấy đơn thuê." });

        var extensions = await _db.RentalOrders.AsNoTracking()
            .Where(x => x.ParentId == r.Id)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new { x.Code, x.Days, x.Price, x.Status, x.CreatedAt })
            .ToListAsync();
        var plans = await _db.RentalPlans.AsNoTracking()
            .Where(p => p.GameId == r.GameId && p.IsActive).OrderBy(p => p.Days)
            .Select(p => new { p.Id, p.Days, p.Price }).ToListAsync();
        var covers = await CoversAsync(new[] { r.GameId });

        object? credentials = null;
        if (r.Status == RentalStatus.Active && r.Asset != null)
            credentials = new { email = r.Asset.LoginEmail, password = _rentals.Unprotect(r.Asset.PasswordEncrypted) };

        return Ok(new
        {
            r.Code, r.GameId, r.GameName, r.Days, r.Price, r.Status, r.StartsAt, r.EndsAt, r.CreatedAt, r.CancelReason,
            payBefore = r.Status == RentalStatus.PendingPayment ? r.CreatedAt + RentalService.PaymentHold : (DateTime?)null,
            coverUrl = covers.GetValueOrDefault(r.GameId),
            credentials,
            extensions,
            plans,
            canExtend = (r.Status == RentalStatus.Active || r.Status == RentalStatus.Expired)
                        && !extensions.Any(e => e.Status == RentalStatus.PendingPayment || e.Status == RentalStatus.AwaitingConfirmation),
        });
    }

    // POST /api/rentals/{code}/paid — customer says they transferred (rental or extension code)
    [HttpPost("{code}/paid")]
    [Authorize(AuthenticationSchemes = CustomerAuthRules.Scheme, Roles = CustomerAuthRules.CustomerRole)]
    public async Task<IActionResult> MarkPaid(string code)
    {
        var updated = await _db.RentalOrders
            .Where(x => x.Code == code && x.CustomerId == UserId && x.Status == RentalStatus.PendingPayment)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, RentalStatus.AwaitingConfirmation).SetProperty(x => x.UpdatedAt, DateTime.UtcNow));
        return updated == 0 ? BadRequest(new { error = "Đơn không ở trạng thái chờ thanh toán." }) : NoContent();
    }

    // POST /api/rentals/{code}/cancel — customer cancels own unpaid rental/extension
    [HttpPost("{code}/cancel")]
    [Authorize(AuthenticationSchemes = CustomerAuthRules.Scheme, Roles = CustomerAuthRules.CustomerRole)]
    public async Task<IActionResult> Cancel(string code)
    {
        var updated = await _db.RentalOrders
            .Where(x => x.Code == code && x.CustomerId == UserId && x.Status == RentalStatus.PendingPayment)
            .ExecuteUpdateAsync(s => s
                .SetProperty(x => x.Status, RentalStatus.Cancelled)
                .SetProperty(x => x.CancelReason, "Khách hủy")
                .SetProperty(x => x.UpdatedAt, DateTime.UtcNow));
        return updated == 0 ? BadRequest(new { error = "Chỉ hủy được đơn đang chờ thanh toán." }) : NoContent();
    }

    // POST /api/rentals/{code}/extend { planId } — creates a pending extension order
    [HttpPost("{code}/extend")]
    [Authorize(AuthenticationSchemes = CustomerAuthRules.Scheme, Roles = CustomerAuthRules.CustomerRole)]
    [EnableRateLimiting(CouponRules.RateLimitPolicy)]
    public async Task<IActionResult> Extend(string code, [FromBody] ExtendRentalRequest request)
    {
        var parent = await _db.RentalOrders.FirstOrDefaultAsync(x => x.Code == code && x.CustomerId == UserId && x.Kind == "Rental");
        if (parent == null) return NotFound(new { error = "Không tìm thấy đơn thuê." });
        if (parent.Status != RentalStatus.Active && parent.Status != RentalStatus.Expired)
            return BadRequest(new { error = "Chỉ gia hạn được đơn đang thuê hoặc vừa hết hạn (chưa thu hồi)." });
        if (await _db.RentalOrders.AnyAsync(x => x.ParentId == parent.Id
                && (x.Status == RentalStatus.PendingPayment || x.Status == RentalStatus.AwaitingConfirmation)))
            return BadRequest(new { error = "Bạn đã có một yêu cầu gia hạn đang chờ thanh toán." });

        var plan = await _db.RentalPlans.AsNoTracking().FirstOrDefaultAsync(p => p.Id == request.PlanId && p.GameId == parent.GameId && p.IsActive);
        if (plan == null) return BadRequest(new { error = "Gói gia hạn không hợp lệ." });

        var now = DateTime.UtcNow;
        var ext = new RentalOrder
        {
            Id = Guid.NewGuid(),
            Code = RentalService.NewCode("EXT"),
            Kind = "Extension",
            ParentId = parent.Id,
            CustomerId = parent.CustomerId,
            CustomerEmail = parent.CustomerEmail,
            CustomerPhone = parent.CustomerPhone,
            GameId = parent.GameId,
            GameName = parent.GameName,
            PlanId = plan.Id,
            Days = plan.Days,
            Price = plan.Price,
            Status = RentalStatus.PendingPayment,
            CreatedAt = now,
            UpdatedAt = now,
        };
        _db.RentalOrders.Add(ext);
        await _db.SaveChangesAsync();
        return Ok(new { code = ext.Code, price = ext.Price, days = ext.Days });
    }

    private async Task<Dictionary<Guid, string?>> CoversAsync(IEnumerable<Guid> gameIds)
    {
        var ids = gameIds.Distinct().ToList();
        var media = await _db.GameMedias.AsNoTracking()
            .Where(m => ids.Contains(m.GameId))
            .OrderByDescending(m => m.IsPrimary).ThenBy(m => m.DisplayOrder)
            .Select(m => new { m.GameId, m.ObjectKey })
            .ToListAsync();
        var result = new Dictionary<Guid, string?>();
        foreach (var id in ids)
        {
            var key = media.FirstOrDefault(m => m.GameId == id)?.ObjectKey;
            string? url = null;
            if (key != null)
            {
                try { url = await _minio.GetPresignedUrlAsync(LuckySpinRules.GameBucket, key); } catch { }
            }
            result[id] = url;
        }
        return result;
    }
}
