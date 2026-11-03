namespace Moxic.Core.Entities;

/// <summary>
/// Append-only coupon usage ledger: one row per order that used a coupon (UNIQUE OrderId).
/// ReleasedAt is set exactly once when the order is cancelled.
/// </summary>
public class CouponRedemption
{
    public Guid Id { get; set; }
    public Guid CouponId { get; set; }

    /// <summary>IdentityUser.Id of the customer. No FK.</summary>
    public string UserId { get; set; } = string.Empty;

    public Guid OrderId { get; set; }
    public decimal DiscountAmount { get; set; }
    public DateTime CreatedAt { get; set; }

    /// <summary>Set when the order was cancelled and the usage returned to the coupon.</summary>
    public DateTime? ReleasedAt { get; set; }

    // Navigation
    public Coupon? Coupon { get; set; }
    public Order? Order { get; set; }
}
