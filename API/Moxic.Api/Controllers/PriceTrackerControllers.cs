using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moxic.Api.Services;
using Moxic.Infrastructure.Data;

namespace Moxic.Api.Controllers;

/// <summary>Public price history for the game page chart.</summary>
[Route("api/games/{id:guid}/price-history")]
[ApiController]
public class PriceHistoryController : ControllerBase
{
    private readonly MoxicDbContext _db;

    public PriceHistoryController(MoxicDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> Get(Guid id, [FromQuery] int days = 365)
    {
        days = Math.Clamp(days, 7, 1095);
        var game = await _db.Games.AsNoTracking().Where(g => g.Id == id)
            .Select(g => new { g.SalePrice, g.OriginalPrice, g.PriceRegion }).FirstOrDefaultAsync();
        if (game == null) return NotFound();

        var since = DateTime.UtcNow.AddDays(-days);
        var snaps = await _db.GamePriceSnapshots.AsNoTracking()
            .Where(s => s.GameId == id)
            .OrderBy(s => s.CapturedAt)
            .Select(s => new { s.Source, s.Region, s.Currency, s.BasePrice, s.SalePrice, s.CapturedAt })
            .ToListAsync();

        // Keep the last point before the window so the line starts at the left edge.
        object Series(string source)
        {
            var all = snaps.Where(s => s.Source == source).ToList();
            var inWindow = all.Where(s => s.CapturedAt >= since).ToList();
            var before = all.LastOrDefault(s => s.CapturedAt < since);
            if (before != null) inWindow.Insert(0, before with { CapturedAt = since });
            var low = all.OrderBy(s => s.SalePrice).ThenByDescending(s => s.CapturedAt).FirstOrDefault();
            return new
            {
                region = all.LastOrDefault()?.Region,
                currency = all.LastOrDefault()?.Currency,
                points = inWindow.Select(s => new { at = s.CapturedAt, sale = s.SalePrice, @base = s.BasePrice }),
                lowest = low == null ? null : new { price = low.SalePrice, at = low.CapturedAt },
                highest = all.Count == 0 ? (decimal?)null : all.Max(s => s.SalePrice),
                trackedSince = all.FirstOrDefault()?.CapturedAt,
            };
        }

        var xbox = snaps.Any(s => s.Source == "XboxStore") ? Series("XboxStore") : null;
        return Ok(new { current = game.SalePrice, original = game.OriginalPrice, moxic = Series("Moxic"), xbox, serverNow = DateTime.UtcNow });
    }
}

/// <summary>Admin: tracker status + manual sync.</summary>
[Route("api/admin/price-tracker")]
[ApiController]
[Authorize(Roles = "Admin")]
public class AdminPriceTrackerController : ControllerBase
{
    private readonly MoxicDbContext _db;
    private readonly PriceTrackerService _tracker;

    public AdminPriceTrackerController(MoxicDbContext db, PriceTrackerService tracker)
    {
        _db = db;
        _tracker = tracker;
    }

    [HttpGet]
    public async Task<IActionResult> Status() => Ok(new
    {
        xboxConfigured = _tracker.ApiKey != null,
        trackedGames = await _db.Games.CountAsync(g => g.XboxProductId != null && g.XboxProductId != ""),
        snapshots = await _db.GamePriceSnapshots.CountAsync(),
        lastXboxSyncAt = PriceTrackerService.LastXboxSyncAt,
        lastXboxSyncResult = PriceTrackerService.LastXboxSyncResult,
    });

    [HttpPost("sync")]
    public async Task<IActionResult> Sync(CancellationToken ct)
    {
        var moxic = await _tracker.RecordMoxicPricesAsync(ct);
        var (xbox, error) = await _tracker.SyncXboxAsync(ct);
        var alerts = await _tracker.ProcessPriceAlertsAsync(ct);
        return Ok(new { moxicSnapshots = moxic, xboxSnapshots = xbox, xboxError = error, alertsSent = alerts });
    }
}
