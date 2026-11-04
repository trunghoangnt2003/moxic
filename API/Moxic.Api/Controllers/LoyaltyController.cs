using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Moxic.Api.Services;
using Moxic.Core.Entities;
using Moxic.Infrastructure.Data;
using Moxic.Shared.Enums;

namespace Moxic.Api.Controllers;

public record ReferralRequest(string? Code);

/// <summary>"Thành viên": tiers, daily check-in, missions and referrals.</summary>
[ApiController]
public class LoyaltyController : ControllerBase
{
    private readonly MoxicDbContext _db;
    private readonly PointsService _points;
    private readonly UserManager<IdentityUser> _users;

    public LoyaltyController(MoxicDbContext db, PointsService points, UserManager<IdentityUser> users)
    {
        _db = db;
        _points = points;
        _users = users;
    }

    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty;

    // GET /api/loyalty/program — public program description (tiers, rewards)
    [HttpGet("api/loyalty/program")]
    public IActionResult Program() => Ok(new
    {
        tiers = LoyaltyRules.Tiers.Select(t => new { t.Key, t.Name, t.MinSpent, t.PointsMultiplier, t.Perk }),
        checkIn = new { daily = LoyaltyRules.CheckInPoints, weeklyBonus = LoyaltyRules.WeeklyStreakBonus },
        missions = LoyaltyRules.Missions.Select(m => new { m.Key, m.Title, m.Description, m.Points }),
        referral = new { referrer = LoyaltyRules.ReferrerReward, referee = LoyaltyRules.RefereeReward },
    });

    // GET /api/loyalty — the signed-in customer's status
    [HttpGet("api/loyalty")]
    [Authorize(AuthenticationSchemes = CustomerAuthRules.Scheme, Roles = CustomerAuthRules.CustomerRole)]
    public async Task<IActionResult> Status()
    {
        var user = await _users.FindByIdAsync(UserId);
        if (user == null) return NotFound();
        var profile = await EnsureReferralCodeAsync(user.Id);

        var spent = await _points.LifetimeSpentAsync(user);
        var tier = LoyaltyRules.TierFor(spent);
        var next = LoyaltyRules.NextTier(spent);

        var (checkedToday, streak) = await StreakAsync(user.Id);
        // Streak day number that "today" represents, and the 7-day cycle it falls in
        // (so the weekly bonus is always visible on the strip).
        var todayDay = checkedToday ? streak : streak + 1;
        var cycleStart = (todayDay - 1) / 7 * 7 + 1;
        var week = Enumerable.Range(cycleStart, 7).Select(day => new
        {
            day,
            reward = LoyaltyRules.CheckInReward(day, tier),
            done = day < todayDay || (checkedToday && day == todayDay),
            today = day == todayDay,
        });

        var missions = await MissionStatesAsync(user);
        var invited = await _db.CustomerProfiles.AsNoTracking().CountAsync(p => p.ReferredByUserId == user.Id);
        var rewarded = await _db.CustomerProfiles.AsNoTracking().CountAsync(p => p.ReferredByUserId == user.Id && p.ReferralRewardedAt != null);
        var canEnterReferral = profile.ReferredByUserId == null && profile.CreatedAt > DateTime.UtcNow - LoyaltyRules.ReferralWindow
                               && spent == 0;

        return Ok(new
        {
            points = profile.Points,
            tier = new { tier.Key, tier.Name, tier.PointsMultiplier, tier.Perk },
            spent,
            next = next == null ? null : new { next.Key, next.Name, next.MinSpent, remaining = next.MinSpent - spent },
            checkIn = new { checkedToday, streak, todayReward = LoyaltyRules.CheckInReward(checkedToday ? streak : streak + 1, tier), week },
            missions,
            referral = new
            {
                code = profile.ReferralCode,
                invited,
                rewarded,
                referrerReward = LoyaltyRules.ReferrerReward,
                refereeReward = LoyaltyRules.RefereeReward,
                referredBy = profile.ReferredByUserId != null,
                canEnterCode = canEnterReferral,
            },
        });
    }

    // POST /api/loyalty/check-in
    [HttpPost("api/loyalty/check-in")]
    [Authorize(AuthenticationSchemes = CustomerAuthRules.Scheme, Roles = CustomerAuthRules.CustomerRole)]
    [EnableRateLimiting(CouponRules.RateLimitPolicy)]
    public async Task<IActionResult> CheckIn()
    {
        var user = await _users.FindByIdAsync(UserId);
        if (user == null || !user.EmailConfirmed) return Forbid(CustomerAuthRules.Scheme);
        var (checkedToday, streak) = await StreakAsync(user.Id);
        if (checkedToday) return Conflict(new { error = "Hôm nay bạn đã điểm danh rồi. Quay lại vào ngày mai nhé!" });

        var day = streak + 1;
        var tier = LoyaltyRules.TierFor(await _points.LifetimeSpentAsync(user));
        var reward = LoyaltyRules.CheckInReward(day, tier);
        var today = LoyaltyRules.VnToday();

        await using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            var balance = await _points.CreditOnceAsync(user.Id, reward, PointsReason.CheckIn, $"checkin:{user.Id}:{today:yyyy-MM-dd}",
                day % 7 == 0 ? $"Điểm danh ngày {day} — thưởng tuần" : $"Điểm danh ngày {day}");
            if (balance == null)
            {
                await tx.RollbackAsync();
                return Conflict(new { error = "Hôm nay bạn đã điểm danh rồi." });
            }
            await tx.CommitAsync();
            return Ok(new { reward, streak = day, balance, weekly = day % 7 == 0 });
        }
        catch (DbUpdateException)
        {
            await tx.RollbackAsync();
            return Conflict(new { error = "Hôm nay bạn đã điểm danh rồi." });
        }
    }

    // POST /api/loyalty/missions/{key}/claim
    [HttpPost("api/loyalty/missions/{key}/claim")]
    [Authorize(AuthenticationSchemes = CustomerAuthRules.Scheme, Roles = CustomerAuthRules.CustomerRole)]
    [EnableRateLimiting(CouponRules.RateLimitPolicy)]
    public async Task<IActionResult> ClaimMission(string key)
    {
        var user = await _users.FindByIdAsync(UserId);
        if (user == null) return NotFound();
        var mission = LoyaltyRules.Missions.FirstOrDefault(m => m.Key == key);
        if (mission == null) return NotFound(new { error = "Nhiệm vụ không tồn tại." });
        var states = await MissionStatesAsync(user);
        var state = states.First(s => s.Key == key);
        if (!state.Done) return BadRequest(new { error = "Bạn chưa hoàn thành nhiệm vụ này." });
        if (state.Claimed) return Conflict(new { error = "Bạn đã nhận thưởng nhiệm vụ này." });

        await using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            var balance = await _points.CreditOnceAsync(user.Id, mission.Points, PointsReason.Mission, $"mission:{key}:{user.Id}", $"Nhiệm vụ: {mission.Title}");
            if (balance == null)
            {
                await tx.RollbackAsync();
                return Conflict(new { error = "Bạn đã nhận thưởng nhiệm vụ này." });
            }
            await tx.CommitAsync();
            return Ok(new { reward = mission.Points, balance });
        }
        catch (DbUpdateException)
        {
            await tx.RollbackAsync();
            return Conflict(new { error = "Bạn đã nhận thưởng nhiệm vụ này." });
        }
    }

    // POST /api/loyalty/referral { code } — new customers attach the friend who invited them
    [HttpPost("api/loyalty/referral")]
    [Authorize(AuthenticationSchemes = CustomerAuthRules.Scheme, Roles = CustomerAuthRules.CustomerRole)]
    [EnableRateLimiting(CouponRules.RateLimitPolicy)]
    public async Task<IActionResult> EnterReferral([FromBody] ReferralRequest request)
    {
        var code = (request.Code ?? string.Empty).Trim().ToUpperInvariant();
        if (code.Length < 4 || code.Length > 16) return BadRequest(new { error = "Mã giới thiệu không hợp lệ." });
        var user = await _users.FindByIdAsync(UserId);
        if (user == null) return NotFound();
        var me = await EnsureReferralCodeAsync(user.Id);
        if (me.ReferredByUserId != null) return Conflict(new { error = "Bạn đã nhập mã giới thiệu trước đó." });
        if (me.CreatedAt < DateTime.UtcNow - LoyaltyRules.ReferralWindow)
            return BadRequest(new { error = "Chỉ nhập được mã giới thiệu trong 14 ngày đầu sau khi đăng ký." });
        if (await _points.LifetimeSpentAsync(user) > 0) return BadRequest(new { error = "Mã giới thiệu chỉ áp dụng cho khách chưa có đơn hàng." });

        var referrer = await _db.CustomerProfiles.AsNoTracking().Where(p => p.ReferralCode == code).Select(p => p.UserId).FirstOrDefaultAsync();
        if (referrer == null) return NotFound(new { error = "Không tìm thấy mã giới thiệu." });
        if (referrer == user.Id) return BadRequest(new { error = "Không thể tự giới thiệu chính mình." });

        var updated = await _db.CustomerProfiles.Where(p => p.UserId == user.Id && p.ReferredByUserId == null)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.ReferredByUserId, referrer));
        if (updated == 0) return Conflict(new { error = "Bạn đã nhập mã giới thiệu trước đó." });
        return Ok(new { message = RequestLanguage.T($"Đã ghi nhận! Hoàn tất đơn đầu tiên để bạn nhận {LoyaltyRules.RefereeReward} điểm và người giới thiệu nhận {LoyaltyRules.ReferrerReward} điểm.", $"Done! Complete your first order to get {LoyaltyRules.RefereeReward} points, and your referrer gets {LoyaltyRules.ReferrerReward} points.") });
    }

    // ───────────── helpers ─────────────

    private record MissionState(string Key, string Title, string Description, int Points, string? Link, bool Done, bool Claimed);

    private async Task<List<MissionState>> MissionStatesAsync(IdentityUser user)
    {
        var email = (user.Email ?? string.Empty).ToLower();
        var done = new Dictionary<string, bool>
        {
            ["verify_email"] = user.EmailConfirmed,
            ["first_wishlist"] = await _db.WishlistItems.AnyAsync(w => w.UserId == user.Id),
            ["first_case"] = await _db.SpinHistories.AnyAsync(h => h.UserId == user.Id),
            ["first_review"] = await _db.GameReviews.AnyAsync(r => r.UserId == user.Id && !r.IsHidden),
            ["first_purchase"] = await _db.Orders.AnyAsync(o => (o.CustomerId == user.Id || o.CustomerXboxEmail.ToLower() == email) && o.Status == OrderStatus.Completed),
            ["first_rental"] = await _db.RentalOrders.AnyAsync(r => r.CustomerId == user.Id && r.Kind == "Rental"
                && (r.Status == RentalStatus.Active || r.Status == RentalStatus.Expired || r.Status == RentalStatus.Returned)),
        };
        var prefix = "mission:";
        var claimedRefs = await _db.PointsTransactions.AsNoTracking()
            .Where(t => t.UserId == user.Id && t.Reason == PointsReason.Mission && t.RefId != null && t.RefId.StartsWith(prefix))
            .Select(t => t.RefId!).ToListAsync();
        return LoyaltyRules.Missions.Select(m => new MissionState(m.Key, m.Title, m.Description, m.Points, m.Link,
            done.GetValueOrDefault(m.Key), claimedRefs.Contains($"mission:{m.Key}:{user.Id}"))).ToList();
    }

    /// <summary>(checked in today?, current streak length) from the CheckIn ledger (Vietnam dates).</summary>
    private async Task<(bool CheckedToday, int Streak)> StreakAsync(string userId)
    {
        var refs = await _db.PointsTransactions.AsNoTracking()
            .Where(t => t.UserId == userId && t.Reason == PointsReason.CheckIn)
            .OrderByDescending(t => t.CreatedAt).Take(400)
            .Select(t => t.RefId!).ToListAsync();
        var days = refs.Select(r => DateTime.TryParse(r[(r.LastIndexOf(':') + 1)..], out var d) ? d.Date : (DateTime?)null)
            .Where(d => d != null).Select(d => d!.Value).ToHashSet();
        var today = LoyaltyRules.VnToday();
        var checkedToday = days.Contains(today);
        var cursor = checkedToday ? today : today.AddDays(-1);
        var streak = 0;
        while (days.Contains(cursor)) { streak++; cursor = cursor.AddDays(-1); }
        return (checkedToday, streak);
    }

    private async Task<CustomerProfile> EnsureReferralCodeAsync(string userId)
    {
        var profile = await _db.CustomerProfiles.FirstOrDefaultAsync(p => p.UserId == userId)
                      ?? throw new InvalidOperationException("Profile missing");
        if (profile.ReferralCode != null) return profile;
        for (var i = 0; i < 5; i++)
        {
            var code = "MX" + RandomNumberGenerator.GetString("ABCDEFGHJKMNPQRSTUVWXYZ23456789", 6);
            if (await _db.CustomerProfiles.AnyAsync(p => p.ReferralCode == code)) continue;
            profile.ReferralCode = code;
            try { await _db.SaveChangesAsync(); return profile; }
            catch (DbUpdateException) { profile.ReferralCode = null; }
        }
        return profile;
    }
}
