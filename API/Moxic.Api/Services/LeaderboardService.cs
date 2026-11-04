using Microsoft.EntityFrameworkCore;
using Moxic.Core.Entities;
using Moxic.Infrastructure.Data;
using Moxic.Shared.Enums;

namespace Moxic.Api.Services;

public record LeaderboardRow(int Rank, string UserId, string DisplayName, int Score);

/// <summary>
/// Monthly community leaderboards (Vietnam calendar month):
/// referrers — friends whose first order completed; reviewers — real reviews (verified purchase counts double);
/// gamers — games bought. Top 3 of each board win points and a badge when the month closes.
/// </summary>
public class LeaderboardService
{
    public static readonly string[] Boards = ["referrers", "reviewers", "gamers"];
    public static readonly int[] Prizes = [500, 300, 150];
    public const int MinReviewLength = 30;
    private static readonly TimeSpan Vn = TimeSpan.FromHours(7);

    private readonly MoxicDbContext _db;
    public LeaderboardService(MoxicDbContext db) => _db = db;

    public static string MonthKey(DateTime utc) => (utc + Vn).ToString("yyyy-MM");

    /// <summary>UTC bounds of the Vietnam calendar month containing <paramref name="utc"/>.</summary>
    public static (DateTime Start, DateTime End) MonthBounds(DateTime utc)
    {
        var local = utc + Vn;
        var start = new DateTime(local.Year, local.Month, 1, 0, 0, 0, DateTimeKind.Utc) - Vn;
        return (start, start.AddMonths(1));
    }

    public static string BoardTitle(string board) => board switch
    {
        "referrers" => "Đại sứ giới thiệu",
        "reviewers" => "Cây bút đánh giá",
        _ => "Game thủ của tháng",
    };

    /// <summary>Full ranking (score ≥ 1) for one board in [start, end).</summary>
    public async Task<List<LeaderboardRow>> RankAsync(string board, DateTime start, DateTime end)
    {
        List<(string UserId, int Score)> scores;
        switch (board)
        {
            case "referrers":
                scores = (await _db.CustomerProfiles.AsNoTracking()
                        .Where(p => p.ReferredByUserId != null && p.ReferralRewardedAt >= start && p.ReferralRewardedAt < end)
                        .GroupBy(p => p.ReferredByUserId!)
                        .Select(g => new { g.Key, N = g.Count() })
                        .ToListAsync())
                    .Select(x => (x.Key, x.N)).ToList();
                break;
            case "reviewers":
                scores = (await _db.GameReviews.AsNoTracking()
                        .Where(r => r.UserId != null && !r.IsHidden && r.CreatedAt >= start && r.CreatedAt < end && r.Content.Length >= MinReviewLength)
                        .GroupBy(r => r.UserId!)
                        .Select(g => new { g.Key, N = g.Sum(r => r.IsVerifiedPurchase ? 2 : 1) })
                        .ToListAsync())
                    .Select(x => (x.Key, x.N)).ToList();
                break;
            default:
                var paid = CommunityService.PaidStatuses;
                scores = (await _db.OrderDetails.AsNoTracking()
                        .Where(d => d.Order.CustomerId != null && paid.Contains(d.Order.Status)
                                    && (d.Order.PaidAt ?? d.Order.CreatedAt) >= start && (d.Order.PaidAt ?? d.Order.CreatedAt) < end)
                        .GroupBy(d => d.Order.CustomerId!)
                        .Select(g => new { g.Key, N = g.Count() })
                        .ToListAsync())
                    .Select(x => (x.Key, x.N)).ToList();
                break;
        }

        var ids = scores.Select(s => s.UserId).ToList();
        var names = await _db.CustomerProfiles.AsNoTracking().Where(p => ids.Contains(p.UserId))
            .ToDictionaryAsync(p => p.UserId, p => p.DisplayName);
        return scores
            .Where(s => s.Score > 0 && names.ContainsKey(s.UserId))
            // Ties: whoever got there first isn't tracked cheaply — break by name for a stable order.
            .OrderByDescending(s => s.Score).ThenBy(s => names[s.UserId])
            .Select((s, i) => new LeaderboardRow(i + 1, s.UserId, string.IsNullOrWhiteSpace(names[s.UserId]) ? "Game thủ" : names[s.UserId], s.Score))
            .ToList();
    }

    /// <summary>Badges ("🏆 Đại sứ giới thiệu #1 · 11/2026") won in the last few months, per user.</summary>
    public async Task<Dictionary<string, List<string>>> BadgesAsync(IEnumerable<string> userIds, int months = 3)
    {
        var ids = userIds.Distinct().ToList();
        if (ids.Count == 0) return new();
        var since = MonthKey(DateTime.UtcNow.AddMonths(-months));
        var awards = await _db.LeaderboardAwards.AsNoTracking()
            .Where(a => ids.Contains(a.UserId) && string.Compare(a.Month, since) > 0)
            .OrderByDescending(a => a.Month).ThenBy(a => a.Rank).ToListAsync();
        return awards.GroupBy(a => a.UserId).ToDictionary(g => g.Key, g => g.Select(Badge).Take(3).ToList());
    }

    public static string Badge(LeaderboardAward a) =>
        $"{(a.Rank == 1 ? "🥇" : a.Rank == 2 ? "🥈" : "🥉")} {BoardTitle(a.Board)} {a.Month[5..]}/{a.Month[..4]}";
}

/// <summary>Closes each month: awards top 3 of every board (points + badge + notification), exactly once.</summary>
public class LeaderboardAwardJob : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<LeaderboardAwardJob> _logger;

    public LeaderboardAwardJob(IServiceScopeFactory scopes, ILogger<LeaderboardAwardJob> logger)
    {
        _scopes = scopes;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        await Task.Delay(TimeSpan.FromMinutes(2), ct);
        while (!ct.IsCancellationRequested)
        {
            try { await AwardPreviousMonthAsync(); }
            catch (Exception ex) { _logger.LogWarning(ex, "Leaderboard award job failed"); }
            await Task.Delay(TimeSpan.FromHours(1), ct);
        }
    }

    private async Task AwardPreviousMonthAsync()
    {
        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MoxicDbContext>();
        var lb = scope.ServiceProvider.GetRequiredService<LeaderboardService>();
        var points = scope.ServiceProvider.GetRequiredService<PointsService>();
        var notifications = scope.ServiceProvider.GetRequiredService<NotificationService>();

        var (thisStart, _) = LeaderboardService.MonthBounds(DateTime.UtcNow);
        var prevStart = LeaderboardService.MonthBounds(thisStart.AddDays(-1)).Start;
        var month = LeaderboardService.MonthKey(prevStart);
        var done = await db.LeaderboardAwards.AsNoTracking().Where(a => a.Month == month).Select(a => new { a.Board, a.Rank }).ToListAsync();
        if (done.Count == LeaderboardService.Boards.Length * LeaderboardService.Prizes.Length) return;

        var any = false;
        foreach (var board in LeaderboardService.Boards)
        {
            var top = (await lb.RankAsync(board, prevStart, thisStart)).Take(LeaderboardService.Prizes.Length).ToList();
            foreach (var row in top)
            {
                if (done.Any(d => d.Board == board && d.Rank == row.Rank)) continue; // already granted (idempotent per slot)
                var prize = LeaderboardService.Prizes[row.Rank - 1];
                var award = new LeaderboardAward
                {
                    Id = Guid.NewGuid(), Month = month, Board = board, Rank = row.Rank, UserId = row.UserId,
                    DisplayName = row.DisplayName.Length > 100 ? row.DisplayName[..100] : row.DisplayName,
                    Score = row.Score, Points = prize, CreatedAt = DateTime.UtcNow,
                };
                db.LeaderboardAwards.Add(award);
                any = true;
                await db.SaveChangesAsync();
                await points.CreditOnceAsync(row.UserId, prize, PointsReason.Leaderboard, $"lb:{month}:{board}:{row.Rank}",
                    $"Top {row.Rank} {LeaderboardService.BoardTitle(board)} tháng {month[5..]}/{month[..4]}");
                await notifications.AddAsync(row.UserId, "points", $"🏆 Bạn đạt Top {row.Rank} — {LeaderboardService.BoardTitle(board)}!",
                    $"Tháng {month[5..]}/{month[..4]}: +{prize} điểm và huy hiệu {LeaderboardService.Badge(award)}.", "/leaderboard");
            }
        }
        if (any) _logger.LogInformation("Leaderboard awards for {Month} granted", month);
    }
}
