using Microsoft.EntityFrameworkCore;
using Moxic.Api.Models;
using Moxic.Core.Entities;
using Moxic.Infrastructure.Data;
using Moxic.Shared.Enums;
using static Moxic.Api.Services.CouponRules;

namespace Moxic.Api.Services;

/// <summary>
/// Coupon pricing, preview, redemption, release, claim and wallet. This service never begins a
/// transaction — callers own it (PointsService pattern), so a redemption commits or rolls back
/// together with the order, and a release together with the cancellation.
/// </summary>
public class CouponService
{
    private readonly MoxicDbContext _db;
    private readonly ILogger<CouponService> _logger;

    public CouponService(MoxicDbContext db, ILogger<CouponService> logger)
    {
        _db = db;
        _logger = logger;
    }

    private static CouponEvaluation Fail(string code, string error) =>
        new(false, code, error, 0m, 0m, 0m, 0m);

    /// <summary>
    /// Prices cart lines from Game.SalePrice (client prices are never trusted). Lines keep the
    /// request order; duplicates stay separate lines.
    /// </summary>
    /// <summary>
    /// Prices cart lines server-side. A line with an edition is priced from that (active) edition;
    /// a game that has active editions but no edition chosen falls back to its default edition;
    /// a game without editions is priced from Game.SalePrice. Client prices are never trusted.
    /// </summary>
    public async Task<(List<PricedLine>? Lines, string? Error)> PriceLinesAsync(IReadOnlyList<(Guid GameId, Guid? EditionId)> items)
    {
        if (items.Count == 0) return (null, "Giỏ hàng trống");
        if (items.Count > MaxCartItems) return (null, "Giỏ hàng quá lớn.");

        var distinct = items.Select(i => i.GameId).Distinct().ToList();
        var games = await _db.Games.AsNoTracking()
            .Where(g => distinct.Contains(g.Id))
            .Select(g => new { g.Id, g.Name, g.SalePrice, g.OriginalPrice })
            .ToDictionaryAsync(g => g.Id);
        var editions = await _db.GameEditions.AsNoTracking()
            .Where(e => distinct.Contains(e.GameId) && e.IsActive)
            .OrderByDescending(e => e.IsDefault).ThenBy(e => e.DisplayOrder)
            .Select(e => new { e.Id, e.GameId, e.Name, e.SalePrice, e.OriginalPrice })
            .ToListAsync();

        var lines = new List<PricedLine>(items.Count);
        foreach (var (gameId, editionId) in items)
        {
            if (!games.TryGetValue(gameId, out var g))
                return (null, "Một số game trong giỏ hàng không còn bán, vui lòng cập nhật giỏ hàng.");

            var gameEditions = editions.Where(e => e.GameId == gameId).ToList();
            if (gameEditions.Count == 0)
            {
                lines.Add(new PricedLine(g.Id, g.Name, g.SalePrice, ListPrice: g.OriginalPrice));
                continue;
            }

            var edition = editionId.HasValue ? gameEditions.FirstOrDefault(e => e.Id == editionId.Value) : gameEditions[0];
            if (edition == null)
                return (null, $"Phiên bản đã chọn của \"{g.Name}\" không còn bán, vui lòng chọn lại.");
            lines.Add(new PricedLine(g.Id, $"{g.Name} — {edition.Name}", edition.SalePrice, edition.Id, edition.Name, edition.OriginalPrice));
        }
        return (lines, null);
    }

    private Task<int> CountActiveRedemptionsAsync(Guid couponId, string userId) =>
        _db.CouponRedemptions.AsNoTracking()
            .CountAsync(r => r.CouponId == couponId && r.UserId == userId && r.ReleasedAt == null);

    private async Task<string?> ResolveGameNameAsync(Guid? gameId, IReadOnlyList<PricedLine>? lines)
    {
        if (gameId == null) return null;
        var fromCart = lines?.FirstOrDefault(l => l.GameId == gameId.Value)?.GameName;
        if (fromCart != null) return fromCart;
        return await _db.Games.AsNoTracking()
            .Where(g => g.Id == gameId.Value)
            .Select(g => g.Name)
            .FirstOrDefaultAsync();
    }

    /// <summary>
    /// Read-only preview. An unowned SpinReward coupon previews as usable (it is bound to the
    /// customer at order creation). Returns the coupon and scoped game name for the quote DTO.
    /// </summary>
    public async Task<(CouponEvaluation Eval, Coupon? Coupon, string? GameName)> QuoteAsync(
        string userId, string? rawCode, IReadOnlyList<PricedLine> lines)
    {
        var code = NormalizeCode(rawCode);
        if (code == null) return (Fail(ErrNotFound, MsgNotFound), null, null);

        var coupon = await _db.Coupons.AsNoTracking().FirstOrDefaultAsync(c => c.Code == code);
        if (coupon == null) return (Fail(ErrNotFound, MsgNotFound), null, null);

        var active = await CountActiveRedemptionsAsync(coupon.Id, userId);
        var gameName = await ResolveGameNameAsync(coupon.GameId, lines);
        var eval = Evaluate(coupon, userId, lines, active, DateTime.UtcNow, gameName);
        return (eval, coupon, gameName);
    }

    /// <summary>
    /// Redeems a coupon for a new order. MUST run inside the caller's transaction; the caller rolls
    /// back whenever Eval.Ok is false. Adds a tracked CouponRedemption (inserted by the caller's
    /// SaveChanges together with the order).
    /// </summary>
    public async Task<(CouponEvaluation Eval, Coupon? Coupon)> RedeemAsync(
        string userId, string? rawCode, IReadOnlyList<PricedLine> lines, Guid orderId)
    {
        var now = DateTime.UtcNow;

        // (a) load
        var code = NormalizeCode(rawCode);
        if (code == null) return (Fail(ErrNotFound, MsgNotFound), null);
        var coupon = await _db.Coupons.AsNoTracking().FirstOrDefaultAsync(c => c.Code == code);
        if (coupon == null) return (Fail(ErrNotFound, MsgNotFound), null);

        // (b) an unowned SpinReward coupon is bound to the first customer who uses it
        if (coupon.Source == CouponSource.SpinReward && coupon.OwnerUserId == null)
        {
            if (await BindOwnerAsync(coupon.Id, userId, now))
            {
                coupon.OwnerUserId = userId;
                coupon.ClaimedAt = now;
            }
            else
            {
                var owner = await _db.Coupons.AsNoTracking()
                    .Where(c => c.Id == coupon.Id)
                    .Select(c => c.OwnerUserId)
                    .FirstOrDefaultAsync();
                if (owner != userId) return (Fail(ErrNotOwner, MsgNotOwner), coupon);
                coupon.OwnerUserId = owner;
            }
        }

        // (c) pre-check every rule
        var gameName = await ResolveGameNameAsync(coupon.GameId, lines);
        var active = await CountActiveRedemptionsAsync(coupon.Id, userId);
        var eval = Evaluate(coupon, userId, lines, active, now, gameName);
        if (!eval.Ok) return (eval, coupon);

        // (d) atomic claim of one total use. The WHERE re-checks active/dates/owner/total limit
        // against the latest committed row; concurrent redeemers serialize on the row lock.
        var affected = await _db.Coupons
            .Where(c => c.Id == coupon.Id
                        && c.IsActive
                        && (c.StartsAt == null || c.StartsAt <= now)
                        && (c.ExpiresAt == null || c.ExpiresAt > now)
                        && (c.OwnerUserId == null || c.OwnerUserId == userId)
                        && (c.MaxTotalUses == null || c.UsedCount < c.MaxTotalUses))
            .ExecuteUpdateAsync(s => s
                .SetProperty(c => c.UsedCount, c => c.UsedCount + 1)
                .SetProperty(c => c.UpdatedAt, now));
        if (affected == 0)
        {
            var fresh = await _db.Coupons.AsNoTracking().FirstOrDefaultAsync(c => c.Id == coupon.Id);
            if (fresh == null) return (Fail(ErrNotFound, MsgNotFound), coupon);
            var again = Evaluate(fresh, userId, lines, await CountActiveRedemptionsAsync(fresh.Id, userId), now, gameName);
            return (again.Ok ? Fail(ErrExhausted, MsgExhausted) : again, fresh);
        }

        // (e) per-customer limit. Our UPDATE above holds the coupon row lock until the caller
        // commits, so any concurrent redemption of this coupon by the same customer is either
        // already committed (and visible to this new READ COMMITTED statement) or blocked behind
        // our lock — the recount therefore cannot miss a parallel order.
        var maxPerCustomer = await _db.Coupons.AsNoTracking()
            .Where(c => c.Id == coupon.Id)
            .Select(c => c.MaxUsesPerCustomer)
            .FirstAsync();
        var activeNow = await CountActiveRedemptionsAsync(coupon.Id, userId);
        if (activeNow >= maxPerCustomer) return (Fail(ErrUserLimit, MsgUserLimit), coupon);

        // (f) ledger row, saved by the caller together with the order
        _db.CouponRedemptions.Add(new CouponRedemption
        {
            Id = Guid.NewGuid(),
            CouponId = coupon.Id,
            UserId = userId,
            OrderId = orderId,
            DiscountAmount = eval.DiscountAmount,
            CreatedAt = now
        });
        return (eval, coupon);
    }

    /// <summary>
    /// Releases the order's active redemption exactly once: `ReleasedAt IS NULL` conditional update,
    /// and UsedCount is only decremented when that affected the row. Caller owns the transaction.
    /// </summary>
    public async Task<bool> ReleaseForOrderAsync(Guid orderId, CancellationToken ct = default)
    {
        var redemption = await _db.CouponRedemptions.AsNoTracking()
            .Where(r => r.OrderId == orderId && r.ReleasedAt == null)
            .Select(r => new { r.Id, r.CouponId })
            .FirstOrDefaultAsync(ct);
        if (redemption == null) return false;

        var now = DateTime.UtcNow;
        var released = await _db.CouponRedemptions
            .Where(r => r.Id == redemption.Id && r.ReleasedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.ReleasedAt, now), ct);
        if (released != 1) return false;

        await _db.Coupons
            .Where(c => c.Id == redemption.CouponId && c.UsedCount > 0)
            .ExecuteUpdateAsync(s => s
                .SetProperty(c => c.UsedCount, c => c.UsedCount - 1)
                .SetProperty(c => c.UpdatedAt, now), ct);
        return true;
    }

    /// <summary>Binds an unowned coupon to a customer (and marks its spin history claimed).</summary>
    public async Task<bool> BindOwnerAsync(Guid couponId, string userId, DateTime now)
    {
        var affected = await _db.Coupons
            .Where(c => c.Id == couponId && c.OwnerUserId == null)
            .ExecuteUpdateAsync(s => s
                .SetProperty(c => c.OwnerUserId, userId)
                .SetProperty(c => c.ClaimedAt, now)
                .SetProperty(c => c.UpdatedAt, now));
        if (affected != 1) return false;

        var spinId = await _db.Coupons.AsNoTracking()
            .Where(c => c.Id == couponId)
            .Select(c => c.SpinHistoryId)
            .FirstOrDefaultAsync();
        if (spinId != null)
        {
            await _db.SpinHistories
                .Where(h => h.Id == spinId.Value && !h.IsClaimed)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(h => h.IsClaimed, true)
                    .SetProperty(h => h.ClaimedAt, now));
        }
        return true;
    }

    private static object Err(string code, string error) => new { error, code };

    /// <summary>Claims a SpinReward code into the caller's wallet. Status 200 / 400 / 409.</summary>
    public async Task<(int Status, object Body)> ClaimAsync(string userId, string? rawCode)
    {
        var code = NormalizeCode(rawCode);
        var coupon = code == null ? null : await _db.Coupons.AsNoTracking().FirstOrDefaultAsync(c => c.Code == code);
        if (coupon == null)
        {
            if (code != null)
            {
                var prizeType = await _db.SpinHistories.AsNoTracking()
                    .Where(h => h.RewardCode == code)
                    .Select(h => (SpinPrizeType?)h.PrizeType)
                    .FirstOrDefaultAsync();
                if (prizeType == SpinPrizeType.Discount)
                    return (400, Err("COUPON_LEGACY_REWARD",
                        "Mã thưởng này được phát trước khi có ví mã giảm giá — vui lòng liên hệ Moxic để được hỗ trợ."));
                if (prizeType == SpinPrizeType.Game)
                    return (400, Err("COUPON_GAME_REWARD", "Đây là mã thưởng game — vui lòng liên hệ Moxic để nhận game."));
            }
            return (400, Err(ErrNotFound, "Mã thưởng không hợp lệ."));
        }

        if (coupon.Source == CouponSource.Event)
            return (400, Err("COUPON_EVENT_CODE",
                "Mã giảm giá sự kiện không cần lưu vào ví — hãy nhập trực tiếp khi thanh toán."));

        var now = DateTime.UtcNow;
        var alreadyOwned = coupon.OwnerUserId == userId;
        if (coupon.OwnerUserId == null)
        {
            if (await BindOwnerAsync(coupon.Id, userId, now))
            {
                coupon.OwnerUserId = userId;
                coupon.ClaimedAt = now;
            }
            else
            {
                coupon.OwnerUserId = await _db.Coupons.AsNoTracking()
                    .Where(c => c.Id == coupon.Id)
                    .Select(c => c.OwnerUserId)
                    .FirstOrDefaultAsync();
                alreadyOwned = coupon.OwnerUserId == userId;
            }
        }

        if (coupon.OwnerUserId != userId)
            return (409, Err("COUPON_TAKEN", "Mã thưởng đã được tài khoản khác nhận."));

        var active = await CountActiveRedemptionsAsync(coupon.Id, userId);
        var gameName = await ResolveGameNameAsync(coupon.GameId, null);
        return (200, new ClaimCouponResponse(ToWalletDto(coupon, active, gameName, now), alreadyOwned));
    }

    /// <summary>The caller's own coupons, newest first (max 200). Batched lookups, no N+1.</summary>
    public async Task<List<WalletCouponDto>> GetWalletAsync(string userId)
    {
        var coupons = await _db.Coupons.AsNoTracking()
            .Where(c => c.OwnerUserId == userId)
            .OrderByDescending(c => c.CreatedAt)
            .Take(200)
            .ToListAsync();
        if (coupons.Count == 0) return new List<WalletCouponDto>();

        var ids = coupons.Select(c => c.Id).ToList();
        var activeByCoupon = await _db.CouponRedemptions.AsNoTracking()
            .Where(r => ids.Contains(r.CouponId) && r.UserId == userId && r.ReleasedAt == null)
            .GroupBy(r => r.CouponId)
            .Select(g => new { CouponId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.CouponId, x => x.Count);

        var gameIds = coupons.Where(c => c.GameId != null).Select(c => c.GameId!.Value).Distinct().ToList();
        var gameNames = gameIds.Count == 0
            ? new Dictionary<Guid, string>()
            : await _db.Games.AsNoTracking()
                .Where(g => gameIds.Contains(g.Id))
                .ToDictionaryAsync(g => g.Id, g => g.Name);

        var now = DateTime.UtcNow;
        return coupons.Select(c => ToWalletDto(
                c,
                activeByCoupon.GetValueOrDefault(c.Id),
                c.GameId != null ? gameNames.GetValueOrDefault(c.GameId.Value) : null,
                now))
            .ToList();
    }

    public static WalletCouponDto ToWalletDto(Coupon c, int userActive, string? gameName, DateTime now)
    {
        var usesLeft = IsTotalExhausted(c) ? 0 : Math.Max(0, c.MaxUsesPerCustomer - userActive);
        return new WalletCouponDto(
            c.Id, c.Code, c.Name, c.Source, c.DiscountType, c.Value, c.MaxDiscountAmount, c.MinOrderAmount,
            c.GameId, gameName, c.StartsAt, c.ExpiresAt, WalletStatus(c, userActive, now), usesLeft, c.CreatedAt);
    }

    public static CouponQuoteDto ToQuoteDto(Coupon c, CouponEvaluation e, string? gameName) =>
        new(c.Code, c.Name, c.Source, c.DiscountType, c.Value, c.MaxDiscountAmount, c.MinOrderAmount,
            c.GameId, gameName, c.ExpiresAt, e.Subtotal, e.ApplicableAmount, e.DiscountAmount, e.Total);
}
