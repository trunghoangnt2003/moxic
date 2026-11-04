using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moxic.Api.Services;
using Moxic.Core.DTOs;
using Moxic.Core.Entities;
using Moxic.Core.Interfaces;
using Moxic.Infrastructure.Data;

namespace Moxic.Api.Controllers;

/// <summary>
/// Discovery: similar games, "also bought", personalised "Dành cho bạn" and the release calendar.
/// Pure content/co-purchase scoring on our own data — no external services.
/// </summary>
[ApiController]
public class DiscoveryController : ControllerBase
{
    private readonly MoxicDbContext _db;
    private readonly IMinioService _minio;
    private readonly CommunityService _community;

    public DiscoveryController(MoxicDbContext db, IMinioService minio, CommunityService community)
    {
        _db = db;
        _minio = minio;
        _community = community;
    }

    private record Profile(Guid Id, string Name, string ProductType, string? Publisher, decimal SalePrice, decimal OriginalPrice, bool IsFeatured, DateTime? ReleaseDate, HashSet<Guid> Genres, HashSet<Guid> Tags);

    private async Task<List<Profile>> LoadProfilesAsync() =>
        (await _db.Games.AsNoTracking()
            .Select(g => new { g.Id, g.Name, g.ProductType, g.Publisher, g.SalePrice, g.OriginalPrice, g.IsFeatured, g.ReleaseDate, Genres = g.Genres.Select(x => x.Id).ToList(), Tags = g.Tags.Select(x => x.Id).ToList() })
            .ToListAsync())
        .Select(g => new Profile(g.Id, g.Name, g.ProductType, g.Publisher, g.SalePrice, g.OriginalPrice, g.IsFeatured, g.ReleaseDate, g.Genres.ToHashSet(), g.Tags.ToHashSet()))
        .ToList();

    private static double Similarity(Profile a, Profile b)
    {
        double s = a.Genres.Intersect(b.Genres).Count() * 3 + a.Tags.Intersect(b.Tags).Count() * 1.5;
        if (a.Publisher != null && a.Publisher == b.Publisher) s += 2;
        if (a.ProductType == b.ProductType) s += 1;
        return s;
    }

    // GET /api/games/{id}/similar
    [HttpGet("api/games/{id:guid}/similar")]
    public async Task<IActionResult> Similar(Guid id, [FromQuery] int limit = 8)
    {
        var all = await LoadProfilesAsync();
        var me = all.FirstOrDefault(g => g.Id == id);
        if (me == null) return NotFound();
        var ids = all.Where(g => g.Id != id)
            .Select(g => (g.Id, Score: Similarity(me, g) + (g.IsFeatured ? 0.3 : 0)))
            .Where(x => x.Score > 0)
            .OrderByDescending(x => x.Score)
            .Take(Math.Clamp(limit, 1, 20))
            .Select(x => x.Id).ToList();
        return Ok(await ToItemsAsync(ids));
    }

    // GET /api/games/{id}/also-bought — co-purchases in paid orders
    [HttpGet("api/games/{id:guid}/also-bought")]
    public async Task<IActionResult> AlsoBought(Guid id, [FromQuery] int limit = 8)
    {
        var orderIds = _db.OrderDetails.Where(d => d.GameId == id && CommunityService.PaidStatuses.Contains(d.Order.Status)).Select(d => d.OrderId);
        var ids = await _db.OrderDetails.AsNoTracking()
            .Where(d => orderIds.Contains(d.OrderId) && d.GameId != id)
            .GroupBy(d => d.GameId)
            .OrderByDescending(g => g.Count())
            .Take(Math.Clamp(limit, 1, 20))
            .Select(g => g.Key)
            .ToListAsync();
        return Ok(await ToItemsAsync(ids));
    }

    // GET /api/recommendations?seed=id1,id2 — "Dành cho bạn"
    // Seeds: client-sent recently viewed ids + (when signed in) wishlist and purchases.
    [HttpGet("api/recommendations")]
    public async Task<IActionResult> ForYou([FromQuery] string? seed, [FromQuery] int limit = 12)
    {
        var seeds = new Dictionary<Guid, double>();
        foreach (var s in (seed ?? string.Empty).Split(',', StringSplitOptions.RemoveEmptyEntries).Take(12).Select((v, i) => (v, i)))
            if (Guid.TryParse(s.v, out var g)) seeds[g] = Math.Max(seeds.GetValueOrDefault(g), 1.0 - s.i * 0.05); // recent first

        var owned = new HashSet<Guid>();
        var me = await _community.GetCustomerAsync(HttpContext);
        if (me != null)
        {
            foreach (var w in await _db.WishlistItems.AsNoTracking().Where(w => w.UserId == me.UserId).Select(w => w.GameId).ToListAsync())
                seeds[w] = Math.Max(seeds.GetValueOrDefault(w), 1.5);
            var email = me.Email.ToLower();
            var bought = await _db.OrderDetails.AsNoTracking()
                .Where(d => CommunityService.PaidStatuses.Contains(d.Order.Status) && (d.Order.CustomerId == me.UserId || d.Order.CustomerXboxEmail.ToLower() == email))
                .Select(d => d.GameId).Distinct().ToListAsync();
            foreach (var b in bought)
            {
                owned.Add(b);
                seeds[b] = Math.Max(seeds.GetValueOrDefault(b), 2.0);
            }
        }

        var all = await LoadProfilesAsync();
        var byId = all.ToDictionary(g => g.Id);
        var seedProfiles = seeds.Where(s => byId.ContainsKey(s.Key)).Select(s => (P: byId[s.Key], W: s.Value)).ToList();

        // Popularity prior (paid orders, last 90 days) so cold-start still shows good picks.
        var since = DateTime.UtcNow.AddDays(-90);
        var popularity = await _db.OrderDetails.AsNoTracking()
            .Where(d => CommunityService.PaidStatuses.Contains(d.Order.Status) && d.Order.CreatedAt >= since)
            .GroupBy(d => d.GameId).Select(g => new { g.Key, C = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.C);
        var maxPop = Math.Max(1, popularity.Values.DefaultIfEmpty(0).Max());

        var ranked = all
            .Where(g => !seeds.ContainsKey(g.Id) && !owned.Contains(g.Id))
            .Select(g =>
            {
                var affinity = seedProfiles.Sum(s => Similarity(s.P, g) * s.W);
                var pop = popularity.GetValueOrDefault(g.Id) / (double)maxPop;
                var deal = g.OriginalPrice > 0 ? (double)((g.OriginalPrice - g.SalePrice) / g.OriginalPrice) : 0;
                return (g.Id, Score: affinity + pop * 2 + deal + (g.IsFeatured ? 0.5 : 0));
            })
            .OrderByDescending(x => x.Score)
            .Take(Math.Clamp(limit, 1, 24))
            .Select(x => x.Id).ToList();

        return Ok(new { personalised = seedProfiles.Count > 0, items = await ToItemsAsync(ranked) });
    }

    // GET /api/games/release-calendar — upcoming releases + last 30 days
    [HttpGet("api/games/release-calendar")]
    public async Task<IActionResult> ReleaseCalendar()
    {
        var from = DateTime.UtcNow.Date.AddDays(-30);
        var ids = await _db.Games.AsNoTracking()
            .Where(g => g.ReleaseDate != null && g.ReleaseDate >= from)
            .OrderBy(g => g.ReleaseDate)
            .Take(100)
            .Select(g => g.Id).ToListAsync();
        return Ok(await ToItemsAsync(ids));
    }

    /// <summary>List-item DTOs in the given order (covers presigned).</summary>
    private async Task<List<GameListItemDto>> ToItemsAsync(List<Guid> ids)
    {
        if (ids.Count == 0) return new();
        var games = await _db.Games.AsNoTracking()
            .Where(g => ids.Contains(g.Id))
            .Include(g => g.Media).Include(g => g.Genres)
            .AsSplitQuery()
            .ToListAsync();
        var result = new List<GameListItemDto>();
        foreach (var id in ids)
        {
            var g = games.FirstOrDefault(x => x.Id == id);
            if (g == null) continue;
            var media = g.Media.FirstOrDefault(m => m.IsPrimary) ?? g.Media.OrderBy(m => m.DisplayOrder).FirstOrDefault();
            string? cover = null;
            if (media != null)
            {
                try { cover = await _minio.GetPresignedUrlAsync(LuckySpinRules.GameBucket, media.ObjectKey); } catch { }
            }
            result.Add(new GameListItemDto
            {
                Id = g.Id, Name = g.Name, OriginalPrice = g.OriginalPrice, SalePrice = g.SalePrice,
                Genres = g.Genres.Select(x => new GenreDto(x.Id, x.Name)).ToList(),
                Status = g.Status.ToString(), ReleaseDate = g.ReleaseDate, CoverImageUrl = cover,
                ProductType = g.ProductType, Region = g.Region, Publisher = g.Publisher,
            });
        }
        return result;
    }
}
