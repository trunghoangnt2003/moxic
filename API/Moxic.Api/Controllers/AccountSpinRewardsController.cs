using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moxic.Api.Services;
using Moxic.Core.Interfaces;
using Moxic.Infrastructure.Data;
using Moxic.Shared.Enums;

namespace Moxic.Api.Controllers;

/// <summary>What one opening gave the customer and where that prize stands now.</summary>
public record SpinRewardDto(
    Guid Id,
    string CaseName,
    string PrizeName,
    SpinPrizeType PrizeType,
    string? Rarity,
    string? ImageUrl,
    Guid? GameId,
    string? RewardCode,
    /// <summary>NoPrize | Processing | Delivered (handed over by staff) or the coupon's state: ClaimCoupon | Usable | Upcoming | Used | Expired | Inactive.</summary>
    string Status,
    DateTime? ClaimedAt,
    DateTime CreatedAt);

/// <summary>The customer's own lucky-spin wins: what they won and whether Moxic has handed it over.</summary>
[Route("api/account/spin-rewards")]
[ApiController]
[Authorize(AuthenticationSchemes = CustomerAuthRules.Scheme, Roles = CustomerAuthRules.CustomerRole)]
public class AccountSpinRewardsController : ControllerBase
{
    private const int PageSize = 20;
    private readonly MoxicDbContext _db;
    private readonly IMinioService _minio;

    public AccountSpinRewardsController(MoxicDbContext db, IMinioService minio)
    {
        _db = db;
        _minio = minio;
    }

    // GET /api/account/spin-rewards?page=1&all=false — all=true also lists openings that won nothing
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] int page = 1, [FromQuery] bool all = false)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Forbid(CustomerAuthRules.Scheme);
        page = Math.Max(1, page);

        // Their own openings, plus coupons won as a guest and claimed into their wallet later.
        var mine = _db.SpinHistories.AsNoTracking().Where(h => h.UserId == userId
            || _db.Coupons.Any(c => c.SpinHistoryId == h.Id && c.OwnerUserId == userId));
        var pending = await mine.CountAsync(h => h.PrizeType != SpinPrizeType.Luck && !h.IsClaimed
            && !_db.Coupons.Any(c => c.SpinHistoryId == h.Id));

        var query = all ? mine : mine.Where(h => h.PrizeType != SpinPrizeType.Luck);
        var total = await query.CountAsync();
        var rows = await query.OrderByDescending(h => h.CreatedAt).Skip((page - 1) * PageSize).Take(PageSize).ToListAsync();

        var spinIds = rows.Select(r => (Guid?)r.Id).ToList();
        var coupons = await _db.Coupons.AsNoTracking().Where(c => spinIds.Contains(c.SpinHistoryId)).ToListAsync();
        var couponIds = coupons.Select(c => c.Id).ToList();
        var usedByCoupon = await _db.CouponRedemptions.AsNoTracking()
            .Where(r => couponIds.Contains(r.CouponId) && r.UserId == userId && r.ReleasedAt == null)
            .GroupBy(r => r.CouponId).Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count);

        // English names live on the current prize, game and case; the history row keeps the Vietnamese snapshot.
        var prizeIds = rows.Where(r => r.PrizeId != null).Select(r => r.PrizeId!.Value).Distinct().ToList();
        var prizeEn = await _db.SpinPrizes.AsNoTracking().Where(p => prizeIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, p => p.NameEn);
        var caseIds = rows.Where(r => r.CaseId != null).Select(r => r.CaseId!.Value).Distinct().ToList();
        var caseEn = await _db.SpinCases.AsNoTracking().Where(c => caseIds.Contains(c.Id)).ToDictionaryAsync(c => c.Id, c => c.NameEn);
        var gameIds = rows.Where(r => r.GameId != null).Select(r => r.GameId!.Value).Distinct().ToList();
        var games = await _db.Games.AsNoTracking().Where(g => gameIds.Contains(g.Id))
            .Select(g => new
            {
                g.Id,
                g.NameEn,
                Key = g.Media.OrderByDescending(m => m.IsPrimary).ThenBy(m => m.DisplayOrder).Select(m => m.ObjectKey).FirstOrDefault(),
            })
            .ToDictionaryAsync(g => g.Id);

        var now = DateTime.UtcNow;
        var items = new List<SpinRewardDto>(rows.Count);
        foreach (var h in rows)
        {
            var coupon = coupons.FirstOrDefault(c => c.SpinHistoryId == h.Id);
            var status = h.PrizeType == SpinPrizeType.Luck ? "NoPrize"
                : coupon != null
                    ? coupon.OwnerUserId == userId ? CouponRules.WalletStatus(coupon, usedByCoupon.GetValueOrDefault(coupon.Id), now) : "ClaimCoupon"
                    : h.IsClaimed ? "Delivered" : "Processing";

            var game = h.GameId != null ? games.GetValueOrDefault(h.GameId.Value) : null;
            string? image = null;
            if (game?.Key != null)
            {
                try { image = await _minio.GetPresignedUrlAsync(LuckySpinRules.GameBucket, game.Key); } catch { /* the row shows an icon */ }
            }
            var enName = h.PrizeId != null ? prizeEn.GetValueOrDefault(h.PrizeId.Value) : null;

            items.Add(new SpinRewardDto(
                h.Id,
                RequestLanguage.Pick(h.CaseName ?? "", h.CaseId != null ? caseEn.GetValueOrDefault(h.CaseId.Value) : null),
                RequestLanguage.Pick(h.PrizeName, !string.IsNullOrWhiteSpace(enName) ? enName : game?.NameEn ?? coupon?.NameEn),
                h.PrizeType, h.Rarity, image, h.GameId, h.RewardCode, status,
                coupon == null ? h.ClaimedAt : null, h.CreatedAt));
        }

        return Ok(new { items, total, page, pageSize = PageSize, pending });
    }
}
