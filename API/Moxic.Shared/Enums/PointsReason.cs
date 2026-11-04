namespace Moxic.Shared.Enums;

/// <summary>Why a customer's points balance changed (PointsTransactions ledger).</summary>
public enum PointsReason
{
    /// <summary>Credit for an order that reached Completed (RefId = order id).</summary>
    OrderCompleted,

    /// <summary>Spent to open a Points case (RefId = spin id).</summary>
    CaseOpen,

    /// <summary>Manual adjustment by an admin (RefId null, CreatedBy = admin).</summary>
    AdminAdjust,

    /// <summary>Daily check-in (RefId = checkin:{userId}:{yyyy-MM-dd}).</summary>
    CheckIn,

    /// <summary>One-time mission reward (RefId = mission:{key}:{userId}).</summary>
    Mission,

    /// <summary>Referral reward to referrer or referee (RefId = ref:{role}:{refereeUserId}).</summary>
    Referral,

    /// <summary>Spent in the points shop (RefId = redeem:{redemptionId}).</summary>
    Redeem
}
