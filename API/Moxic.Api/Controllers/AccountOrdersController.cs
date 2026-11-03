using System.Linq.Expressions;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moxic.Api.Models;
using Moxic.Api.Services;
using Moxic.Core.Entities;
using Moxic.Core.Interfaces;
using Moxic.Infrastructure.Data;

namespace Moxic.Api.Controllers;

/// <summary>
/// "Lịch sử mua hàng" for logged-in, verified customers. An order belongs to the customer when
/// it was placed while logged in (CustomerId) or its Xbox email equals the verified account
/// email (case-insensitive, so orders placed before the account existed are included).
/// Explicit projections only — Xbox password fields and admin notes are never read.
/// </summary>
[Route("api/account/orders")]
[ApiController]
[Authorize(AuthenticationSchemes = CustomerAuthRules.Scheme, Roles = CustomerAuthRules.CustomerRole)]
public class AccountOrdersController : ControllerBase
{
    private const string GameBucket = "moxic-games";

    private readonly MoxicDbContext _db;
    private readonly UserManager<IdentityUser> _userManager;
    private readonly IMinioService _minio;

    public AccountOrdersController(MoxicDbContext db, UserManager<IdentityUser> userManager, IMinioService minio)
    {
        _db = db;
        _userManager = userManager;
        _minio = minio;
    }

    // GET /api/account/orders?page=1&pageSize=20
    [HttpGet]
    public async Task<IActionResult> GetOrders([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var owner = await ResolveOwnerAsync();
        if (owner == null) return Forbid(CustomerAuthRules.Scheme);

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 50);

        var query = _db.Orders.AsNoTracking().Where(OwnedBy(owner.Value.UserId, owner.Value.EmailLower));
        var total = await query.CountAsync();

        var rows = await query
            .OrderByDescending(o => o.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(o => new OrderRow(
                o.OrderCode,
                o.Status.ToString(),
                o.PaymentMethod.ToString(),
                o.TotalAmount,
                o.DiscountAmount,
                o.CouponCode,
                o.CreatedAt,
                o.UpdatedAt,
                o.Details.Select(d => new ItemRow(d.GameId, d.GameName, d.Price)).ToList()))
            .ToListAsync();

        var covers = await ResolveCoversAsync(rows.SelectMany(r => r.Items).Select(i => i.GameId));

        var items = rows.Select(r => new AccountOrderSummaryDto
        {
            OrderCode = r.OrderCode,
            Status = r.Status,
            PaymentMethod = r.PaymentMethod,
            TotalAmount = r.TotalAmount,
            SubtotalAmount = r.TotalAmount + r.DiscountAmount,
            DiscountAmount = r.DiscountAmount,
            CouponCode = r.CouponCode,
            CreatedAt = r.CreatedAt,
            UpdatedAt = r.UpdatedAt,
            Items = MapItems(r.Items, covers)
        }).ToList();

        return Ok(new AccountOrdersResponse(items, total, page, pageSize));
    }

    // GET /api/account/orders/{orderCode}
    [HttpGet("{orderCode}")]
    public async Task<IActionResult> GetOrder(string orderCode)
    {
        var owner = await ResolveOwnerAsync();
        if (owner == null) return Forbid(CustomerAuthRules.Scheme);

        var code = (orderCode ?? string.Empty).Trim();
        var row = await _db.Orders.AsNoTracking()
            .Where(OwnedBy(owner.Value.UserId, owner.Value.EmailLower))
            .Where(o => o.OrderCode == code)
            .Select(o => new
            {
                o.OrderCode,
                Status = o.Status.ToString(),
                PaymentMethod = o.PaymentMethod.ToString(),
                o.TotalAmount,
                o.DiscountAmount,
                o.CouponCode,
                o.CreatedAt,
                o.UpdatedAt,
                o.CustomerXboxEmail,
                o.CancellationReason,
                o.IsClientConfirmed,
                HasPaymentProof = o.PaymentProofObjectKey != null,
                Items = o.Details.Select(d => new ItemRow(d.GameId, d.GameName, d.Price)).ToList()
            })
            .FirstOrDefaultAsync();

        if (row == null)
            return NotFound(new { error = "Không tìm thấy đơn hàng" });

        var covers = await ResolveCoversAsync(row.Items.Select(i => i.GameId));

        return Ok(new AccountOrderDetailDto
        {
            OrderCode = row.OrderCode,
            Status = row.Status,
            PaymentMethod = row.PaymentMethod,
            TotalAmount = row.TotalAmount,
            SubtotalAmount = row.TotalAmount + row.DiscountAmount,
            DiscountAmount = row.DiscountAmount,
            CouponCode = row.CouponCode,
            CreatedAt = row.CreatedAt,
            UpdatedAt = row.UpdatedAt,
            Items = MapItems(row.Items, covers),
            XboxEmail = row.CustomerXboxEmail,
            CancellationReason = row.CancellationReason,
            IsClientConfirmed = row.IsClientConfirmed,
            HasPaymentProof = row.HasPaymentProof
        });
    }

    // ---- helpers ----

    private sealed record ItemRow(Guid GameId, string GameName, decimal Price);

    private sealed record OrderRow(
        string OrderCode,
        string Status,
        string PaymentMethod,
        decimal TotalAmount,
        decimal DiscountAmount,
        string? CouponCode,
        DateTime CreatedAt,
        DateTime UpdatedAt,
        List<ItemRow> Items);

    /// <summary>The caller's user id + lowercased verified email, or null when unverified / missing.</summary>
    private async Task<(string UserId, string EmailLower)?> ResolveOwnerAsync()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return null;
        var user = await _userManager.FindByIdAsync(userId);
        if (user == null || !user.EmailConfirmed || string.IsNullOrWhiteSpace(user.Email)) return null;
        return (userId, user.Email.Trim().ToLowerInvariant());
    }

    private static Expression<Func<Order, bool>> OwnedBy(string userId, string emailLower) =>
        o => o.CustomerId == userId || o.CustomerXboxEmail.ToLower() == emailLower;

    private static List<AccountOrderItemDto> MapItems(IEnumerable<ItemRow> items, IReadOnlyDictionary<Guid, string?> covers) =>
        items.Select(i => new AccountOrderItemDto(i.GameId, i.GameName, i.Price, covers.GetValueOrDefault(i.GameId))).ToList();

    /// <summary>Primary GameMedia (fallback: first by DisplayOrder) presigned per game; failures yield null.</summary>
    private async Task<IReadOnlyDictionary<Guid, string?>> ResolveCoversAsync(IEnumerable<Guid> gameIds)
    {
        var ids = gameIds.Distinct().ToList();
        var result = new Dictionary<Guid, string?>();
        if (ids.Count == 0) return result;

        var medias = await _db.GameMedias.AsNoTracking()
            .Where(m => ids.Contains(m.GameId))
            .OrderByDescending(m => m.IsPrimary)
            .ThenBy(m => m.DisplayOrder)
            .Select(m => new { m.GameId, m.ObjectKey })
            .ToListAsync();

        foreach (var media in medias)
        {
            if (result.ContainsKey(media.GameId)) continue;
            string? url = null;
            try { url = await _minio.GetPresignedUrlAsync(GameBucket, media.ObjectKey); } catch { }
            result[media.GameId] = url;
        }
        return result;
    }
}
