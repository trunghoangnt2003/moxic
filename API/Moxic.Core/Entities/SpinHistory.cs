using Moxic.Shared.Enums;

namespace Moxic.Core.Entities;

public class SpinHistory
{
    public Guid Id { get; set; }
    public Guid? SpinCodeId { get; set; }
    /// <summary>Spin code text for Code opens; empty string for FreeInterval/Points opens.</summary>
    public string CodeText { get; set; } = string.Empty;

    // Case snapshot (CaseId is set to NULL if the case is deleted; CaseName stays)
    public Guid? CaseId { get; set; }
    public string? CaseName { get; set; }
    public SpinCaseOpenMethod? OpenMethod { get; set; }

    /// <summary>Customer who opened (any method) when logged in. UserEmail is admin-only.</summary>
    public string? UserId { get; set; }
    public string? UserEmail { get; set; }

    public int PointsSpent { get; set; }

    /// <summary>Rarity tier of the won prize at open time (common..legendary).</summary>
    public string? Rarity { get; set; }

    // Prize snapshot (kept even if the prize is later edited/deleted)
    public Guid? PrizeId { get; set; }
    public string PrizeName { get; set; } = string.Empty;
    public SpinPrizeType PrizeType { get; set; }
    public Guid? GameId { get; set; }

    /// <summary>Unique reward code for Discount/Game wins; null for Luck.</summary>
    public string? RewardCode { get; set; }

    public bool IsClaimed { get; set; }
    public DateTime? ClaimedAt { get; set; }
    public string? ClientIp { get; set; }
    public DateTime CreatedAt { get; set; }
}
