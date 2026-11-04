using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Moxic.Api.Services;
using Moxic.Core.Interfaces;
using Moxic.Infrastructure.Data;
using Moxic.Shared.Enums;

namespace Moxic.Api.Controllers;

public record RecentPurchaseDto(string Buyer, Guid GameId, string GameName, string? CoverUrl, DateTime At);

/// <summary>Public social proof: recent real purchases (no PII — masked account name or "Một khách hàng").</summary>
[Route("api/activity")]
[ApiController]
public class ActivityController : ControllerBase
{
    private static readonly OrderStatus[] PaidStatuses =
    {
        OrderStatus.Verifying, OrderStatus.Installing, OrderStatus.ActionRequired, OrderStatus.Completed,
    };

    private readonly MoxicDbContext _db;
    private readonly IMinioService _minio;
    private readonly IMemoryCache _cache;

    public ActivityController(MoxicDbContext db, IMinioService minio, IMemoryCache cache)
    {
        _db = db;
        _minio = minio;
        _cache = cache;
    }

    // GET /api/activity/recent-purchases
    [HttpGet("recent-purchases")]
    public async Task<IActionResult> RecentPurchases()
    {
        var items = await _cache.GetOrCreateAsync("activity:recent-purchases", async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(60);
            var since = DateTime.UtcNow.AddDays(-14);

            var rows = await (
                from d in _db.OrderDetails.AsNoTracking()
                join o in _db.Orders.AsNoTracking() on d.OrderId equals o.Id
                where PaidStatuses.Contains(o.Status) && o.CreatedAt >= since
                join p in _db.CustomerProfiles.AsNoTracking() on o.CustomerId equals p.UserId into profiles
                from p in profiles.DefaultIfEmpty()
                orderby o.CreatedAt descending
                select new { d.GameId, d.GameName, o.CreatedAt, Name = p != null ? p.DisplayName : null })
                .Take(12)
                .ToListAsync();

            var gameIds = rows.Select(r => r.GameId).Distinct().ToList();
            var media = await _db.GameMedias.AsNoTracking()
                .Where(m => gameIds.Contains(m.GameId))
                .OrderByDescending(m => m.IsPrimary).ThenBy(m => m.DisplayOrder)
                .Select(m => new { m.GameId, m.ObjectKey })
                .ToListAsync();
            var covers = new Dictionary<Guid, string?>();
            foreach (var id in gameIds)
            {
                var key = media.FirstOrDefault(m => m.GameId == id)?.ObjectKey;
                string? url = null;
                if (key != null)
                {
                    try { url = await _minio.GetPresignedUrlAsync(LuckySpinRules.GameBucket, key); } catch { }
                }
                covers[id] = url;
            }

            return rows.Select(r => new RecentPurchaseDto(
                string.IsNullOrWhiteSpace(r.Name) ? "Một khách hàng" : LuckySpinRules.MaskDisplayName(r.Name),
                r.GameId, r.GameName, covers.GetValueOrDefault(r.GameId), r.CreatedAt)).ToList();
        });

        return Ok(new { items, serverNow = DateTime.UtcNow });
    }
}
