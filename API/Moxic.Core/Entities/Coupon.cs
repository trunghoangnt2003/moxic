using Moxic.Shared.Enums;

namespace Moxic.Core.Entities;

/// <summary>
/// A discount code. Event coupons are created by admins; SpinReward coupons are issued by
/// Lucky Spin Discount prizes and bound to one customer account (OwnerUserId).
/// </summary>
public class Coupon
{
    public Guid Id { get; set; }

    /// <summary>Unique, uppercase A-Z0-9 (4..32).</summary>
    public string Code { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;
    public CouponSource Source { get; set; } = CouponSource.Event;
    public CouponDiscountType DiscountType { get; set; } = CouponDiscountType.Percent;

    /// <summary>Percent (0..100] or fixed VND amount.</summary>
    public decimal Value { get; set; }

    /// <summary>Cap for Percent coupons (VND). Always null for Fixed.</summary>
    public decimal? MaxDiscountAmount { get; set; }

    /// <summary>Minimum applicable subtotal (VND) required to use the coupon.</summary>
    public decimal? MinOrderAmount { get; set; }

    /// <summary>When set the discount only applies to lines of this game. No FK (a deleted game matches nothing).</summary>
    public Guid? GameId { get; set; }

    public DateTime? StartsAt { get; set; }
    public DateTime? ExpiresAt { get; set; }

    /// <summary>Total redemption limit across all customers (null = unlimited).</summary>
    public int? MaxTotalUses { get; set; }

    public int MaxUsesPerCustomer { get; set; } = 1;

    /// <summary>Active (non-released) redemptions. Maintained with conditional updates.</summary>
    public int UsedCount { get; set; }

    public bool IsActive { get; set; } = true;

    /// <summary>IdentityUser.Id of the owning customer (SpinReward). No FK.</summary>
    public string? OwnerUserId { get; set; }

    public DateTime? ClaimedAt { get; set; }

    /// <summary>SpinHistory that produced this coupon (SpinReward). No FK.</summary>
    public Guid? SpinHistoryId { get; set; }

    /// <summary>Admin email for Event coupons.</summary>
    public string? CreatedBy { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Navigation
    public ICollection<CouponRedemption> Redemptions { get; set; } = new List<CouponRedemption>();
}
