using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Moxic.Api.Services;
using Moxic.Infrastructure.Data;

namespace Moxic.Api.Controllers;

/// <summary>Monthly leaderboards, lifetime "you saved" stats, and the admin "đang tải game" step.</summary>
[ApiController]
public class LeaderboardController : ControllerBase
{
    private readonly MoxicDbContext _db;
    private readonly LeaderboardService _lb;
    private readonly IMemoryCache _cache;

    public LeaderboardController(MoxicDbContext db, LeaderboardService lb, IMemoryCache cache)
    {
        _db = db;
        _lb = lb;
        _cache = cache;
    }

    private async Task<string?> CustomerIdAsync()
    {
        var auth = await HttpContext.AuthenticateAsync(CustomerAuthRules.Scheme);
        return auth.Succeeded && auth.Principal?.IsInRole(CustomerAuthRules.CustomerRole) == true
            ? auth.Principal.FindFirstValue(ClaimTypes.NameIdentifier)
            : null;
    }

    // GET /api/leaderboard — current month (live, cached 2 min), my ranks, last month's winners
    [HttpGet("api/leaderboard")]
    public async Task<IActionResult> Get()
    {
        var now = DateTime.UtcNow;
        var (start, end) = LeaderboardService.MonthBounds(now);
        var month = LeaderboardService.MonthKey(now);
        var full = await _cache.GetOrCreateAsync($"lb:{month}", async e =>
        {
            e.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(2);
            var dict = new Dictionary<string, List<LeaderboardRow>>();
            foreach (var b in LeaderboardService.Boards) dict[b] = await _lb.RankAsync(b, start, end);
            return dict;
        }) ?? new();

        var me = await CustomerIdAsync();
        var allIds = full.Values.SelectMany(v => v.Take(10)).Select(r => r.UserId);
        var badges = await _lb.BadgesAsync(allIds);

        var prevMonth = LeaderboardService.MonthKey(start.AddDays(-1));
        var winners = await _db.LeaderboardAwards.AsNoTracking().Where(a => a.Month == prevMonth)
            .OrderBy(a => a.Board).ThenBy(a => a.Rank)
            .Select(a => new { a.Board, a.Rank, a.DisplayName, a.Score, a.Points })
            .ToListAsync();

        return Ok(new
        {
            month,
            endsAt = end,
            prizes = LeaderboardService.Prizes,
            boards = LeaderboardService.Boards.Select(b => new
            {
                key = b,
                title = LeaderboardService.BoardTitle(b),
                top = full.GetValueOrDefault(b, new()).Take(10).Select(r => new
                {
                    r.Rank, r.DisplayName, r.Score, isMe = r.UserId == me,
                    badges = badges.GetValueOrDefault(r.UserId) ?? new List<string>(),
                }),
                me = me == null ? null : full.GetValueOrDefault(b, new()).Where(r => r.UserId == me)
                    .Select(r => new { r.Rank, r.Score }).FirstOrDefault(),
                participants = full.GetValueOrDefault(b, new()).Count,
            }),
            lastMonth = new { month = prevMonth, winners },
        });
    }

    // GET /api/account/savings — lifetime "saved vs Xbox Store" + my badges
    [HttpGet("api/account/savings")]
    [Authorize(AuthenticationSchemes = CustomerAuthRules.Scheme, Roles = CustomerAuthRules.CustomerRole)]
    public async Task<IActionResult> Savings()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var email = (User.FindFirstValue(ClaimTypes.Email) ?? (await _db.Users.AsNoTracking().Where(u => u.Id == userId).Select(u => u.Email).FirstOrDefaultAsync()) ?? "").ToLower();
        var paid = CommunityService.PaidStatuses;
        var orders = await _db.Orders.AsNoTracking()
            .Where(o => (o.CustomerId == userId || (email != "" && o.CustomerXboxEmail.ToLower() == email)) && paid.Contains(o.Status) && !o.IsGift)
            .Select(o => new { o.DiscountAmount, Lines = o.Details.Select(d => new { d.Price, d.ListPrice }).ToList() })
            .ToListAsync();
        var saved = orders.Sum(o => OrderSavings.Saved(o.Lines.Select(l => (l.Price, l.ListPrice)), o.DiscountAmount));
        var games = orders.Sum(o => o.Lines.Count);
        var spent = orders.Sum(o => o.Lines.Sum(l => l.Price)) - orders.Sum(o => o.DiscountAmount);
        var badges = (await _lb.BadgesAsync([userId], months: 120)).GetValueOrDefault(userId) ?? new List<string>();
        return Ok(new { saved, games, spent, orders = orders.Count, badges });
    }

    // POST /api/admin/orders/{id}/downloading — Installing sub-step for the live tracker
    [HttpPost("api/admin/orders/{id:guid}/downloading")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Downloading(Guid id, [FromServices] OrderStatusService statuses)
    {
        var r = await statuses.MarkDownloadingAsync(id);
        if (r.NotFound) return NotFound(new { error = r.Error });
        return r.Ok ? NoContent() : BadRequest(new { error = r.Error });
    }
}
