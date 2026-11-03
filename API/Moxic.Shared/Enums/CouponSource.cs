namespace Moxic.Shared.Enums;

/// <summary>Where a coupon came from.</summary>
public enum CouponSource
{
    /// <summary>Admin-created event/promo code (anyone logged in may use it, subject to limits).</summary>
    Event,

    /// <summary>Issued by a Lucky Spin Discount prize; bound to one account (OwnerUserId).</summary>
    SpinReward
}
