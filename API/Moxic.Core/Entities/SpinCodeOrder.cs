namespace Moxic.Core.Entities;

/// <summary>
/// A customer buying spins for a code case by bank transfer. The transfer content is <see cref="Code"/>
/// (e.g. MXS7K2P9QRT); when SePay reports enough money with that content, a <see cref="SpinCode"/>
/// with <see cref="Quantity"/> uses is issued to the customer.
/// </summary>
public class SpinCodeOrder
{
    public Guid Id { get; set; }

    /// <summary>Transfer content, unique, "MXS" + 8 characters.</summary>
    public string Code { get; set; } = string.Empty;

    public string UserId { get; set; } = string.Empty;
    public Guid CaseId { get; set; }
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal Amount { get; set; }

    /// <summary>Pending | Paid | Cancelled.</summary>
    public string Status { get; set; } = "Pending";

    public Guid? SpinCodeId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? PaidAt { get; set; }

    public SpinCase? Case { get; set; }
    public SpinCode? SpinCode { get; set; }
}
