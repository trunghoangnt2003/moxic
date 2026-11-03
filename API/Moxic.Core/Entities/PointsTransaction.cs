using Moxic.Shared.Enums;

namespace Moxic.Core.Entities;

/// <summary>Append-only loyalty points ledger. UNIQUE (Reason, RefId) makes credits idempotent.</summary>
public class PointsTransaction
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public int Delta { get; set; }
    public PointsReason Reason { get; set; }

    /// <summary>Order id (OrderCompleted) or spin id (CaseOpen); null for AdminAdjust.</summary>
    public string? RefId { get; set; }

    public string? Note { get; set; }
    public int BalanceAfter { get; set; }

    /// <summary>Admin email for AdminAdjust. Never returned to customers.</summary>
    public string? CreatedBy { get; set; }

    public DateTime CreatedAt { get; set; }
}
