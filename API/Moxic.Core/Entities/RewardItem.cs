using Moxic.Shared.Enums;

namespace Moxic.Core.Entities;

/// <summary>An item in the points shop ("Đổi điểm"), configured by admins.</summary>
public class RewardItem
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    /// <summary>English text for /en; empty = use the Vietnamese.</summary>
    public string? NameEn { get; set; }
    public string? DescriptionEn { get; set; }
    public RewardKind Kind { get; set; } = RewardKind.Coupon;
    public int PointsCost { get; set; }

    // Coupon terms (Kind = Coupon)
    public CouponDiscountType? DiscountType { get; set; }
    public decimal? DiscountValue { get; set; }
    public decimal? DiscountMaxAmount { get; set; }
    public decimal? DiscountMinOrderAmount { get; set; }

    /// <summary>Lucky-spin case opened by the issued code (Kind = CaseCode). No FK.</summary>
    public Guid? SpinCaseId { get; set; }

    /// <summary>Days the issued coupon / code stays valid.</summary>
    public int ValidDays { get; set; } = 30;

    /// <summary>Total stock (null = unlimited). RedeemedCount is maintained with a conditional update.</summary>
    public int? Stock { get; set; }
    public int RedeemedCount { get; set; }

    /// <summary>Max redemptions per customer (null = unlimited).</summary>
    public int? PerUserLimit { get; set; }

    public bool IsActive { get; set; } = true;
    public int DisplayOrder { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

/// <summary>One points-shop redemption: what was spent and the code that was issued.</summary>
public class RewardRedemption
{
    public Guid Id { get; set; }
    public Guid RewardItemId { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string ItemName { get; set; } = string.Empty;
    public RewardKind Kind { get; set; }
    public int PointsSpent { get; set; }
    public string IssuedCode { get; set; } = string.Empty;
    public Guid? CouponId { get; set; }
    public Guid? SpinCodeId { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; }
}
