namespace Moxic.Core.Entities;

/// <summary>An incoming bank transfer reported by the payment-notification provider (SePay webhook).</summary>
public class BankTransaction
{
    public Guid Id { get; set; }
    public string Provider { get; set; } = "sepay";

    /// <summary>Provider's transaction id — unique, makes webhook retries idempotent.</summary>
    public string ProviderTxnId { get; set; } = string.Empty;

    public decimal Amount { get; set; }
    public string? Content { get; set; }
    public string? Gateway { get; set; }
    public string? AccountNumber { get; set; }
    public string? ReferenceCode { get; set; }
    public DateTime? TransactionDate { get; set; }

    /// <summary>Matched, Underpaid, AlreadyPaid, Unmatched, Manual.</summary>
    public string Status { get; set; } = "Unmatched";
    public Guid? OrderId { get; set; }
    public string? OrderCode { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }
}
