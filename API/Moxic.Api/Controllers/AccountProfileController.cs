using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Moxic.Api.Services;
using Moxic.Core.Entities;
using Moxic.Core.Interfaces;
using Moxic.Infrastructure.Data;
using Moxic.Shared.Enums;

namespace Moxic.Api.Controllers;

public record ProfileUpdateRequest(string? DisplayName, bool? PriceAlerts);
public record ChangePasswordRequest(string? CurrentPassword, string? NewPassword);

/// <summary>"Tài khoản của tôi": profile, password and the game library.</summary>
[Route("api/account")]
[ApiController]
[Authorize(AuthenticationSchemes = CustomerAuthRules.Scheme, Roles = CustomerAuthRules.CustomerRole)]
public class AccountProfileController : ControllerBase
{
    private readonly MoxicDbContext _db;
    private readonly UserManager<IdentityUser> _users;
    private readonly IUserClaimsPrincipalFactory<IdentityUser> _claims;
    private readonly IMinioService _minio;

    public AccountProfileController(MoxicDbContext db, UserManager<IdentityUser> users, IUserClaimsPrincipalFactory<IdentityUser> claims, IMinioService minio)
    {
        _db = db;
        _users = users;
        _claims = claims;
        _minio = minio;
    }

    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty;

    // GET /api/account/profile
    [HttpGet("profile")]
    public async Task<IActionResult> Profile()
    {
        var user = await _users.FindByIdAsync(UserId);
        if (user == null) return NotFound();
        var profile = await _db.CustomerProfiles.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == UserId);
        var email = (user.Email ?? string.Empty).ToLower();
        var orders = _db.Orders.AsNoTracking().Where(o => o.CustomerId == UserId || o.CustomerXboxEmail.ToLower() == email);
        return Ok(new
        {
            email = user.Email,
            displayName = profile?.DisplayName ?? string.Empty,
            points = profile?.Points ?? 0,
            priceAlerts = profile?.PriceAlerts ?? true,
            memberSince = profile?.CreatedAt,
            stats = new
            {
                orders = await orders.CountAsync(),
                spent = await orders.Where(o => CommunityService.PaidStatuses.Contains(o.Status)).SumAsync(o => (decimal?)o.TotalAmount) ?? 0,
                wishlist = await _db.WishlistItems.CountAsync(w => w.UserId == UserId),
                activeRentals = await _db.RentalOrders.CountAsync(r => r.CustomerId == UserId && r.Status == RentalStatus.Active),
                reviews = await _db.GameReviews.CountAsync(r => r.UserId == UserId),
            },
        });
    }

    // PUT /api/account/profile { displayName?, priceAlerts? }
    [HttpPut("profile")]
    public async Task<IActionResult> UpdateProfile([FromBody] ProfileUpdateRequest request)
    {
        var profile = await _db.CustomerProfiles.FirstOrDefaultAsync(p => p.UserId == UserId);
        if (profile == null) return NotFound(new { error = "Không tìm thấy hồ sơ." });
        if (request.DisplayName != null)
        {
            var name = request.DisplayName.Trim();
            if (name.Length < 2 || name.Length > 50) return BadRequest(new { error = "Tên hiển thị phải từ 2–50 ký tự." });
            profile.DisplayName = name;
        }
        if (request.PriceAlerts.HasValue) profile.PriceAlerts = request.PriceAlerts.Value;
        profile.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // POST /api/account/change-password { currentPassword, newPassword }
    [HttpPost("change-password")]
    [EnableRateLimiting(CustomerAuthRules.RateLimitPolicy)]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        var user = await _users.FindByIdAsync(UserId);
        if (user == null) return NotFound();
        if (string.IsNullOrEmpty(request.CurrentPassword) || string.IsNullOrEmpty(request.NewPassword))
            return BadRequest(new { error = "Vui lòng nhập đủ mật khẩu hiện tại và mật khẩu mới." });
        var result = await _users.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
        if (!result.Succeeded)
        {
            if (result.Errors.Any(e => e.Code == "PasswordMismatch")) return BadRequest(new { error = "Mật khẩu hiện tại không đúng." });
            return BadRequest(new { error = CustomerAuthRules.TranslateIdentityErrors(result.Errors) });
        }
        // The security stamp changed: other sessions end; re-issue this one.
        var principal = await _claims.CreateAsync(user);
        await HttpContext.SignInAsync(CustomerAuthRules.Scheme,
            new ClaimsPrincipal(new ClaimsIdentity(principal.Claims, CustomerAuthRules.Scheme)),
            new AuthenticationProperties { IsPersistent = true });
        return NoContent();
    }

    // GET /api/account/library — games owned (paid orders) + current rentals
    [HttpGet("library")]
    public async Task<IActionResult> Library()
    {
        var user = await _users.FindByIdAsync(UserId);
        if (user == null) return NotFound();
        var email = (user.Email ?? string.Empty).ToLower();

        var lines = await _db.OrderDetails.AsNoTracking()
            .Where(d => (d.Order.CustomerId == UserId || d.Order.CustomerXboxEmail.ToLower() == email)
                        && CommunityService.PaidStatuses.Contains(d.Order.Status))
            .OrderByDescending(d => d.Order.CreatedAt)
            .Select(d => new { d.GameId, Name = d.Game.Name, d.EditionName, d.Order.OrderCode, d.Order.Status, d.Order.CreatedAt })
            .ToListAsync();
        var owned = lines.GroupBy(l => l.GameId).Select(g => g.First()).ToList();

        var rentals = await _db.RentalOrders.AsNoTracking()
            .Where(r => r.CustomerId == UserId && r.Kind == "Rental" && (r.Status == RentalStatus.Active || r.Status == RentalStatus.Expired))
            .OrderBy(r => r.EndsAt)
            .Select(r => new { r.Code, r.GameId, r.GameName, r.Status, r.EndsAt })
            .ToListAsync();

        var covers = await CoversAsync(owned.Select(o => o.GameId).Concat(rentals.Select(r => r.GameId)));
        return Ok(new
        {
            owned = owned.Select(o => new
            {
                o.GameId, o.Name, o.EditionName, o.OrderCode, purchasedAt = o.CreatedAt,
                installStatus = o.Status == OrderStatus.Completed ? "Installed" : o.Status == OrderStatus.ActionRequired ? "ActionRequired" : "Installing",
                coverUrl = covers.GetValueOrDefault(o.GameId),
            }),
            rentals = rentals.Select(r => new { r.Code, r.GameId, r.GameName, r.Status, r.EndsAt, coverUrl = covers.GetValueOrDefault(r.GameId) }),
        });
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
