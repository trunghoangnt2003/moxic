namespace Moxic.Shared.Enums;

/// <summary>Why a customer's points balance changed (PointsTransactions ledger).</summary>
public enum PointsReason
{
    /// <summary>Credit for an order that reached Completed (RefId = order id).</summary>
    OrderCompleted,

    /// <summary>Spent to open a Points case (RefId = spin id).</summary>
    CaseOpen,

    /// <summary>Manual adjustment by an admin (RefId null, CreatedBy = admin).</summary>
    AdminAdjust
}
