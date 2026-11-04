using Moxic.Shared.Enums;

namespace Moxic.Core.Entities;

public class SpinPrize
{
    public Guid Id { get; set; }

    /// <summary>Owning case; each case validates its own 100% total.</summary>
    public Guid CaseId { get; set; }

    public string Name { get; set; } = string.Empty;
    /// <summary>English name for /en; empty = the game's English name (game prizes) or the Vietnamese.</summary>
    public string? NameEn { get; set; }
    public SpinPrizeType Type { get; set; } = SpinPrizeType.Luck;
    public Guid? GameId { get; set; }

    /// <summary>Odds in percent (0.01 .. 100.00, precision 5,2).</summary>
    public decimal Probability { get; set; }

    public bool IsActive { get; set; } = true;
    public int DisplayOrder { get; set; } = 0;

    /// <summary>Discount prizes: coupon type. Null = legacy/manual (reward code only, no coupon).</summary>
    public CouponDiscountType? DiscountType { get; set; }

    /// <summary>Discount prizes: percent (0..100] or fixed VND amount.</summary>
    public decimal? DiscountValue { get; set; }

    /// <summary>Discount prizes: cap for Percent coupons (VND).</summary>
    public decimal? DiscountMaxAmount { get; set; }

    /// <summary>Discount prizes: minimum applicable subtotal (VND).</summary>
    public decimal? DiscountMinOrderAmount { get; set; }

    /// <summary>Discount prizes: restrict the coupon to one game (separate from GameId so no cover is shown). No FK.</summary>
    public Guid? DiscountGameId { get; set; }

    /// <summary>Discount prizes: coupon validity in days after the win (default 30).</summary>
    public int? DiscountValidDays { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Navigation
    public Game? Game { get; set; }
    public SpinCase? Case { get; set; }
}
