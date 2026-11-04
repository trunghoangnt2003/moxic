using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Moxic.Core.Entities;
using Moxic.Infrastructure.Data;
using Moxic.Shared.Enums;

namespace Moxic.Api.Services;

/// <summary>
/// Loyalty points: every balance change is a single conditional UPDATE on CustomerProfiles plus a
/// PointsTransactions ledger row. This service never begins a transaction — callers own it, so the
/// balance change commits (or rolls back) together with the operation that caused it.
/// After our UPDATE the row stays locked until commit, so re-reading Points returns our value.
/// </summary>
public class PointsService
{
    private readonly MoxicDbContext _db;
    private readonly UserManager<IdentityUser> _userManager;
    private readonly ILogger<PointsService> _logger;

    public PointsService(MoxicDbContext db, UserManager<IdentityUser> userManager, ILogger<PointsService> logger)
    {
        _db = db;
        _userManager = userManager;
        _logger = logger;
    }

    /// <summary>
    /// Credits the sum of the order games' RewardPoints (read at completion time) to the linked
    /// customer: Order.CustomerId, else the verified customer whose email equals the order's Xbox
    /// email. Exactly once per order: the conditional `PointsAwardedAt == null` claim plus the unique
    /// (Reason, RefId) ledger index. Returns the credited amount (0 when nothing was credited).
    /// </summary>
    public async Task<int> AwardForCompletedOrderAsync(Order order)
    {
        var user = await ResolveOrderCustomerAsync(order);
        if (user == null) return 0;

        var gameIds = await _db.OrderDetails.AsNoTracking()
            .Where(d => d.OrderId == order.Id)
            .Select(d => d.GameId)
            .ToListAsync();
        if (gameIds.Count == 0) return 0;

        var basePoints = await _db.Games.AsNoTracking()
            .Where(g => gameIds.Contains(g.Id))
            .SumAsync(g => g.RewardPoints);

        // Membership tier bonus (tier from lifetime spend on paid orders).
        var tier = LoyaltyRules.TierFor(await LifetimeSpentAsync(user));
        var points = (int)Math.Round(basePoints * tier.PointsMultiplier, MidpointRounding.AwayFromZero);

        // Referral payout on the referee's first completed order (independent of game points).
        await PayReferralIfDueAsync(user.Id, order.OrderCode);
        if (points <= 0) return 0;

        var now = DateTime.UtcNow;
        var claimed = await _db.Orders
            .Where(o => o.Id == order.Id && o.PointsAwardedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(o => o.PointsAwardedAt, now));
        if (claimed == 0) return 0;

        await EnsureProfileAsync(user, now);
        await _db.CustomerProfiles
            .Where(p => p.UserId == user.Id)
            .ExecuteUpdateAsync(s => s
                .SetProperty(p => p.Points, p => p.Points + points)
                .SetProperty(p => p.UpdatedAt, now));
        var balance = await GetBalanceAsync(user.Id);

        _db.PointsTransactions.Add(new PointsTransaction
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Delta = points,
            Reason = PointsReason.OrderCompleted,
            RefId = order.Id.ToString(),
            Note = tier.PointsMultiplier > 1 ? $"{order.OrderCode} · hạng {tier.Name} x{tier.PointsMultiplier:0.##}" : order.OrderCode,
            BalanceAfter = balance,
            CreatedAt = now
        });
        await _db.SaveChangesAsync();
        return points;
    }

    /// <summary>
    /// Atomic spend: `UPDATE ... SET Points = Points - cost WHERE UserId = x AND Points >= cost`.
    /// Returns (false, current balance) when the balance is short.
    /// </summary>
    public async Task<(bool Ok, int Balance)> TrySpendAsync(string userId, int cost, string refId, string note)
    {
        if (cost < 1) return (false, await GetBalanceAsync(userId));

        var now = DateTime.UtcNow;
        var affected = await _db.CustomerProfiles
            .Where(p => p.UserId == userId && p.Points >= cost)
            .ExecuteUpdateAsync(s => s
                .SetProperty(p => p.Points, p => p.Points - cost)
                .SetProperty(p => p.UpdatedAt, now));
        if (affected == 0) return (false, await GetBalanceAsync(userId));

        var balance = await GetBalanceAsync(userId);
        _db.PointsTransactions.Add(new PointsTransaction
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Delta = -cost,
            Reason = PointsReason.CaseOpen,
            RefId = refId,
            Note = Truncate(note, 200),
            BalanceAfter = balance,
            CreatedAt = now
        });
        await _db.SaveChangesAsync();
        return (true, balance);
    }

    /// <summary>Manual admin adjustment; never lets the balance go below 0.</summary>
    public async Task<(bool Ok, int Balance, PointsTransaction? Tx)> AdjustAsync(string userId, int delta, string note, string? actor)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return (false, 0, null);

        var now = DateTime.UtcNow;
        await EnsureProfileAsync(user, now);

        var affected = await _db.CustomerProfiles
            .Where(p => p.UserId == userId && p.Points + delta >= 0)
            .ExecuteUpdateAsync(s => s
                .SetProperty(p => p.Points, p => p.Points + delta)
                .SetProperty(p => p.UpdatedAt, now));
        if (affected == 0) return (false, await GetBalanceAsync(userId), null);

        var balance = await GetBalanceAsync(userId);
        var tx = new PointsTransaction
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Delta = delta,
            Reason = PointsReason.AdminAdjust,
            RefId = null,
            Note = Truncate(note, 200),
            BalanceAfter = balance,
            CreatedBy = actor == null ? null : Truncate(actor, 256),
            CreatedAt = now
        };
        _db.PointsTransactions.Add(tx);
        await _db.SaveChangesAsync();
        _logger.LogInformation("Admin {Actor} adjusted points of {UserId} by {Delta} (balance {Balance})", actor, userId, delta, balance);
        return (true, balance, tx);
    }

    /// <summary>
    /// Idempotent credit for check-ins, missions and referrals: skipped when a ledger row with the
    /// same (Reason, RefId) already exists; the unique index is the backstop under races (callers
    /// run this inside their transaction, so a duplicate rolls the balance change back too).
    /// Returns the new balance, or null when it was already credited.
    /// </summary>
    public async Task<int?> CreditOnceAsync(string userId, int delta, PointsReason reason, string refId, string note)
    {
        if (delta <= 0) return null;
        if (await _db.PointsTransactions.AnyAsync(t => t.Reason == reason && t.RefId == refId)) return null;
        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return null;
        var now = DateTime.UtcNow;
        await EnsureProfileAsync(user, now);
        await _db.CustomerProfiles.Where(p => p.UserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Points, p => p.Points + delta).SetProperty(p => p.UpdatedAt, now));
        var balance = await GetBalanceAsync(userId);
        _db.PointsTransactions.Add(new PointsTransaction
        {
            Id = Guid.NewGuid(), UserId = userId, Delta = delta, Reason = reason, RefId = refId,
            Note = Truncate(note, 200), BalanceAfter = balance, CreatedAt = now,
        });
        await _db.SaveChangesAsync();
        return balance;
    }

    /// <summary>Total of the customer's paid/fulfilled orders (by account or verified email).</summary>
    public async Task<decimal> LifetimeSpentAsync(IdentityUser user)
    {
        var email = (user.Email ?? string.Empty).ToLower();
        return await _db.Orders.AsNoTracking()
            .Where(o => (o.CustomerId == user.Id || o.CustomerXboxEmail.ToLower() == email) && CommunityService.PaidStatuses.Contains(o.Status))
            .SumAsync(o => (decimal?)o.TotalAmount) ?? 0m;
    }

    /// <summary>Pays referrer + referee once, when a referred customer completes an order.</summary>
    private async Task PayReferralIfDueAsync(string refereeId, string orderCode)
    {
        var now = DateTime.UtcNow;
        var referrerId = await _db.CustomerProfiles.AsNoTracking()
            .Where(p => p.UserId == refereeId && p.ReferredByUserId != null && p.ReferralRewardedAt == null)
            .Select(p => p.ReferredByUserId).FirstOrDefaultAsync();
        if (referrerId == null) return;
        var claimed = await _db.CustomerProfiles
            .Where(p => p.UserId == refereeId && p.ReferralRewardedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.ReferralRewardedAt, now));
        if (claimed == 0) return;
        await CreditOnceAsync(referrerId, LoyaltyRules.ReferrerReward, PointsReason.Referral, $"ref:referrer:{refereeId}", $"Bạn bè hoàn tất đơn {orderCode}");
        await CreditOnceAsync(refereeId, LoyaltyRules.RefereeReward, PointsReason.Referral, $"ref:referee:{refereeId}", "Thưởng được giới thiệu");
    }

    public async Task<int> GetBalanceAsync(string userId) =>
        await _db.CustomerProfiles.AsNoTracking()
            .Where(p => p.UserId == userId)
            .Select(p => (int?)p.Points)
            .FirstOrDefaultAsync() ?? 0;

    private async Task<IdentityUser?> ResolveOrderCustomerAsync(Order order)
    {
        if (!string.IsNullOrEmpty(order.CustomerId))
        {
            var byId = await _userManager.FindByIdAsync(order.CustomerId);
            if (await IsVerifiedCustomerAsync(byId)) return byId;
        }

        var email = order.CustomerXboxEmail?.Trim();
        if (string.IsNullOrEmpty(email)) return null;
        var byEmail = await _userManager.FindByEmailAsync(email);
        return await IsVerifiedCustomerAsync(byEmail) ? byEmail : null;
    }

    private async Task<bool> IsVerifiedCustomerAsync(IdentityUser? user) =>
        user != null && user.EmailConfirmed && await _userManager.IsInRoleAsync(user, CustomerAuthRules.CustomerRole);

    /// <summary>Creates the CustomerProfile row when missing (race-safe ON CONFLICT DO NOTHING).</summary>
    private async Task EnsureProfileAsync(IdentityUser user, DateTime now)
    {
        var local = (user.Email ?? user.UserName ?? string.Empty).Split('@')[0].Trim();
        var displayName = string.IsNullOrEmpty(local) ? "Khách" : Truncate(local, CustomerAuthRules.DisplayNameMax);
        await _db.Database.ExecuteSqlAsync($"""
            INSERT INTO "CustomerProfiles" ("UserId", "DisplayName", "Points", "PriceAlerts", "CreatedAt", "UpdatedAt")
            VALUES ({user.Id}, {displayName}, 0, TRUE, {now}, {now})
            ON CONFLICT ("UserId") DO NOTHING
            """);
    }

    private static string Truncate(string value, int max) => value.Length > max ? value[..max] : value;
}
