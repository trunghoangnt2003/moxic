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
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Navigation
    public ICollection<OrderDetail> Details { get; set; } = new List<OrderDetail>();
}
