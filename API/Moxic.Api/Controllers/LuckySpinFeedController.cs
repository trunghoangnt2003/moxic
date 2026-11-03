using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Moxic.Api.Models;
using Moxic.Api.Services;
using Moxic.Core.Interfaces;
using Moxic.Infrastructure.Data;
using Moxic.Shared.Enums;

namespace Moxic.Api.Controllers;

/// <summary>
/// Public lucky-spin feeds: the LIVE drops strip (real recent wins, no PII) and the case music list.
/// </summary>
[Route("api/lucky-spin")]
[ApiController]
public class LuckySpinFeedController : ControllerBase
{
    private const string LiveDropsCacheKey = "lucky-spin:live-drops";

    private readonly MoxicDbContext _db;
    private readonly IMinioService _minio;
    private readonly IConfiguration _config;
    private readonly IMemoryCache _cache;

    public LuckySpinFeedController(MoxicDbContext db, IMinioService minio, IConfiguration config, IMemoryCache cache)
    {
        _db = db;
        _minio = minio;
        _config = config;
        _cache = cache;
    }

    // GET /api/lucky-spin/live-drops — cached 5 s server-side, wins younger than 10 s are hidden
    [HttpGet("live-drops")]
    public async Task<IActionResult> GetLiveDrops()
    {
        var response = await _cache.GetOrCreateAsync(LiveDropsCacheKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(LuckySpinRules.LiveDropsCacheSeconds);
            return await BuildLiveDropsAsync();
        });
        return Ok(response);
    }

    // GET /api/lucky-spin/music — enabled tracks with presigned URLs
    [HttpGet("music")]
    public async Task<IActionResult> GetMusic()
    {
        var tracks = await _db.SpinMusicTracks.AsNoTracking()
            .Where(t => t.IsActive)
            .OrderBy(t => t.CreatedAt)
            .Select(t => new { t.Id, t.Name, t.ObjectKey })
            .ToListAsync();

        var bucket = Bucket();
        var expiry = ExpiryHours();
        var result = new List<PublicMusicTrackDto>();
        foreach (var t in tracks)
        {
            try
            {
                var url = await _minio.GetPresignedUrlAsync(bucket, t.ObjectKey, expiry);
                result.Add(new PublicMusicTrackDto(t.Id, t.Name, url));
            }
            catch
            {
                // skip tracks whose presign fails
            }
        }
        return Ok(result);
    }

    private async Task<LiveDropsResponse> BuildLiveDropsAsync()
    {
        var now = DateTime.UtcNow;
        var cutoff = now.AddSeconds(-LuckySpinRules.LiveDropDelaySeconds);

        // Explicit projection: never UserEmail, ClientIp or RewardCode.
        var baseQuery = _db.SpinHistories.AsNoTracking()
            .Where(h => h.PrizeType != SpinPrizeType.Luck && h.CreatedAt <= cutoff);

        var feed = await baseQuery
            .OrderByDescending(h => h.CreatedAt)
            .Take(LuckySpinRules.LiveFeedSize)
            .Select(h => new DropRow(h.Id, h.PrizeName, h.PrizeType, h.Rarity, h.GameId, h.CaseId, h.CaseName, h.UserId, h.CreatedAt))
            .ToListAsync();

        var wow = await baseQuery
            .Where(h => h.Rarity == "epic" || h.Rarity == "legendary")
            .OrderByDescending(h => h.CreatedAt)
            .Take(LuckySpinRules.LiveWowSize)
            .Select(h => new DropRow(h.Id, h.PrizeName, h.PrizeType, h.Rarity, h.GameId, h.CaseId, h.CaseName, h.UserId, h.CreatedAt))
            .ToListAsync();

        var all = feed.Concat(wow).ToList();

        var userIds = all.Where(r => r.UserId != null).Select(r => r.UserId!).Distinct().ToList();
        var names = userIds.Count == 0
            ? new Dictionary<string, string>()
            : await _db.CustomerProfiles.AsNoTracking()
                .Where(p => userIds.Contains(p.UserId))
                .ToDictionaryAsync(p => p.UserId, p => p.DisplayName);

        var caseIds = all.Where(r => r.CaseId != null).Select(r => r.CaseId!.Value).Distinct().ToList();
        var slugs = caseIds.Count == 0
            ? new Dictionary<Guid, string?>()
            : await _db.SpinCases.AsNoTracking()
                .Where(c => caseIds.Contains(c.Id))
                .ToDictionaryAsync(c => c.Id, c => c.IsActive ? c.Slug : null);

        var gameIds = all.Where(r => r.GameId != null).Select(r => r.GameId!.Value).Distinct().ToList();
        var covers = new Dictionary<Guid, string?>();
        if (gameIds.Count > 0)
        {
            var media = await _db.GameMedias.AsNoTracking()
                .Where(m => gameIds.Contains(m.GameId))
                .OrderByDescending(m => m.IsPrimary).ThenBy(m => m.DisplayOrder)
                .Select(m => new { m.GameId, m.ObjectKey })
                .ToListAsync();
            var bucket = Bucket();
            var expiry = ExpiryHours();
            foreach (var g in media.GroupBy(m => m.GameId))
            {
                string? url = null;
                try { url = await _minio.GetPresignedUrlAsync(bucket, g.First().ObjectKey, expiry); } catch { url = null; }
                covers[g.Key] = url;
            }
        }

        LiveDropDto ToDto(DropRow r)
        {
            string winner = "Khách";
            if (r.UserId != null && names.TryGetValue(r.UserId, out var displayName))
            {
                winner = LuckySpinRules.MaskDisplayName(displayName);
            }
            string? slug = null;
            if (r.CaseId != null && slugs.TryGetValue(r.CaseId.Value, out var s)) slug = s;
            string? image = null;
            if (r.GameId != null && covers.TryGetValue(r.GameId.Value, out var cover)) image = cover;

            return new LiveDropDto(
                r.Id,
                r.PrizeName,
                r.PrizeType,
                string.IsNullOrEmpty(r.Rarity) ? "common" : r.Rarity,
                image,
                r.CaseName ?? string.Empty,
                slug,
                winner,
                DateTime.SpecifyKind(r.CreatedAt, DateTimeKind.Utc));
        }

        return new LiveDropsResponse(wow.Select(ToDto).ToList(), feed.Select(ToDto).ToList(), now);
    }

    private string Bucket() => _config.GetValue<string>("Minio:GamesBucket") ?? LuckySpinRules.GameBucket;

    private int ExpiryHours()
    {
        var hours = _config.GetValue<int>("Minio:PresignedUrlExpiryHours");
        return hours > 0 ? hours : 1;
    }

    private sealed record DropRow(
        Guid Id, string PrizeName, SpinPrizeType PrizeType, string? Rarity, Guid? GameId,
        Guid? CaseId, string? CaseName, string? UserId, DateTime CreatedAt);
}
