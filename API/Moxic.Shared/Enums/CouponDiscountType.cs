namespace Moxic.Shared.Enums;

/// <summary>How a coupon discount is computed.</summary>
public enum CouponDiscountType
{
    /// <summary>Value is a percentage (0 &lt; v &lt;= 100) of the applicable amount, optionally capped.</summary>
    Percent,

    /// <summary>Value is a fixed VND amount, capped at the applicable amount.</summary>
    Fixed
}
