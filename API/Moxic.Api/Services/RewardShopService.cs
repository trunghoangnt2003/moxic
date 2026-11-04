using Microsoft.EntityFrameworkCore;
using Moxic.Core.Entities;
using Moxic.Infrastructure.Data;
using Moxic.Shared.Enums;

namespace Moxic.Api.Services;

public record RewardRedeemResult(bool Ok, string? Error, RewardRedemption? Redemption, int Balance);

/// <summary>
/// Points shop: spend points for a wallet coupon or a lucky-spin case code. Stock, per-user limit
/// and the points debit are all claimed atomically inside one transaction.
/// </summary>
public class RewardShopService
{
    private readonly MoxicDbContext _db;
    private readonly PointsService _points;
    private readonly NotificationService _notifications;
    private readonly ILogger<RewardShopService> _logger;

    public RewardShopService(MoxicDbContext db, PointsService points, NotificationService notifications, ILogger<RewardShopService> logger)
    {
        _db = db;
        _points = points;
        _notifications = notifications;
        _logger = logger;
    }

    public async Task<RewardRedeemResult> RedeemAsync(string userId, Guid itemId)
    {
        var item = await _db.RewardItems.AsNoTracking().FirstOrDefaultAsync(i => i.Id == itemId && i.IsActive);
        if (item == null) return new(false, "Phần quà không còn khả dụng", null, await _points.GetBalanceAsync(userId));
        if (item.PointsCost < 1) return new(false, "Phần quà chưa được cấu hình", null, await _points.GetBalanceAsync(userId));

        SpinCase? spinCase = null;
        if (item.Kind == RewardKind.CaseCode)
        {
            spinCase = await _db.SpinCases.AsNoTracking().FirstOrDefaultAsync(c => c.Id == item.SpinCaseId && c.IsActive);
            if (spinCase == null || spinCase.OpenMethod != SpinCaseOpenMethod.Code)
                return new(false, "Hòm quà này tạm ngưng", null, await _points.GetBalanceAsync(userId));
        }
        else if (item.DiscountType == null || item.DiscountValue is not > 0m)
        {
            return new(false, "Phần quà chưa được cấu hình", null, await _points.GetBalanceAsync(userId));
        }

        await using var tx = await _db.Database.BeginTransactionAsync();

        if (item.PerUserLimit is > 0)
        {
            var mine = await _db.RewardRedemptions.CountAsync(r => r.RewardItemId == item.Id && r.UserId == userId);
            if (mine >= item.PerUserLimit)
                return new(false, $"Bạn đã đổi tối đa {item.PerUserLimit} lần phần quà này", null, await _points.GetBalanceAsync(userId));
        }

        var claimed = await _db.RewardItems
            .Where(i => i.Id == item.Id && (i.Stock == null || i.RedeemedCount < i.Stock))
            .ExecuteUpdateAsync(s => s.SetProperty(i => i.RedeemedCount, i => i.RedeemedCount + 1));
        if (claimed == 0)
        {
            await tx.RollbackAsync();
            return new(false, "Phần quà đã hết", null, await _points.GetBalanceAsync(userId));
        }

        var redemptionId = Guid.NewGuid();
        var (ok, balance) = await _points.TrySpendAsync(userId, item.PointsCost, $"redeem:{redemptionId}", $"Đổi điểm: {item.Name}", PointsReason.Redeem);
        if (!ok)
        {
            await tx.RollbackAsync();
            _db.ChangeTracker.Clear();
            var vi = System.Globalization.CultureInfo.GetCultureInfo("vi-VN");
            return new(false, $"Bạn cần {item.PointsCost.ToString("N0", vi)} điểm (hiện có {balance.ToString("N0", vi)})", null, balance);
        }

        var now = DateTime.UtcNow;
        var expires = now.AddDays(Math.Clamp(item.ValidDays, 1, 365));
        var redemption = new RewardRedemption
        {
            Id = redemptionId,
            RewardItemId = item.Id,
            UserId = userId,
            ItemName = item.Name,
            Kind = item.Kind,
            PointsSpent = item.PointsCost,
            ExpiresAt = expires,
            CreatedAt = now,
        };

        if (item.Kind == RewardKind.Coupon)
        {
            var coupon = new Coupon
            {
                Id = Guid.NewGuid(),
                Code = CouponRules.GenerateCode("PT"),
                Name = item.Name.Length > 100 ? item.Name[..100] : item.Name,
                NameEn = string.IsNullOrWhiteSpace(item.NameEn) ? null : item.NameEn,
                Source = CouponSource.PointsReward,
                DiscountType = item.DiscountType!.Value,
                Value = item.DiscountValue!.Value,
                MaxDiscountAmount = item.DiscountType == CouponDiscountType.Percent ? item.DiscountMaxAmount : null,
                MinOrderAmount = item.DiscountMinOrderAmount,
                ExpiresAt = expires,
                MaxTotalUses = 1,
                MaxUsesPerCustomer = 1,
                IsActive = true,
                OwnerUserId = userId,
                ClaimedAt = now,
                CreatedAt = now,
                UpdatedAt = now,
            };
            _db.Coupons.Add(coupon);
            redemption.CouponId = coupon.Id;
            redemption.IssuedCode = coupon.Code;
        }
        else
        {
            var code = new SpinCode
            {
                Id = Guid.NewGuid(),
                CaseId = spinCase!.Id,
                Code = "PT" + LuckySpinRules.GenerateCode(8),
                MaxUses = 1,
                ExpiresAt = expires,
                IsActive = true,
                Note = $"Đổi điểm ({userId})",
                CreatedAt = now,
            };
            _db.SpinCodes.Add(code);
            redemption.SpinCodeId = code.Id;
            redemption.IssuedCode = code.Code;
        }

        _db.RewardRedemptions.Add(redemption);
        await _db.SaveChangesAsync();
        await tx.CommitAsync();

        try
        {
            await _notifications.AddAsync(userId, "points", $"🎁 Đổi thành công: {item.Name}",
                item.Kind == RewardKind.Coupon ? $"Mã {redemption.IssuedCode} đã vào ví mã giảm giá." : $"Mã mở hòm {redemption.IssuedCode}.",
                item.Kind == RewardKind.Coupon ? "/account/coupons" : $"/lucky-spin/{spinCase!.Slug}");
        }
        catch (Exception ex) { _logger.LogWarning(ex, "Redeem notification failed"); }

        return new(true, null, redemption, balance);
    }
}
