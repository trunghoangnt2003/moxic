namespace Moxic.Core.Entities;

using Moxic.Shared.Enums;

public class Order
{
    public Guid Id { get; set; }
    public string OrderCode { get; set; } = string.Empty; // "MOXIC-YYYYMMDD-XXXXX"
    public string CustomerPhone { get; set; } = string.Empty;
    public string CustomerXboxEmail { get; set; } = string.Empty;
    public string CustomerXboxPasswordEncrypted { get; set; } = string.Empty; // AES-256 encrypted
    public string? CustomerZalo { get; set; }
    public decimal TotalAmount { get; set; }
    public OrderStatus Status { get; set; } = OrderStatus.Pending;
    public PaymentMethod PaymentMethod { get; set; } = PaymentMethod.Bank;
    public bool IsClientConfirmed { get; set; }
    public DateTime? ClientConfirmedAt { get; set; }
    public string? Notes { get; set; }
    public string? PaymentProofObjectKey { get; set; }
    public string? CancellationReason { get; set; }

    /// <summary>IdentityUser.Id of the logged-in customer who placed the order (null for guest checkout). No DB FK.</summary>
    public string? CustomerId { get; set; }

    /// <summary>Set once when loyalty points for this order were credited (idempotency guard).</summary>
    public DateTime? PointsAwardedAt { get; set; }

    /// <summary>Coupon applied to this order (FK Coupons, SET NULL on delete). Null when no coupon.</summary>
    public Guid? CouponId { get; set; }

    /// <summary>Snapshot of the coupon code at order time (kept even if the coupon is deleted).</summary>
    public string? CouponCode { get; set; }

    /// <summary>Server-computed discount (VND, whole đồng). TotalAmount = sum(Details.Price) - DiscountAmount.</summary>
    public decimal DiscountAmount { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Navigation
    public ICollection<OrderDetail> Details { get; set; } = new List<OrderDetail>();
}
