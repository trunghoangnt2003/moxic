using Moxic.Shared.Enums;

namespace Moxic.Core.Entities;

public class SpinHistory
{
    public Guid Id { get; set; }
    public Guid? SpinCodeId { get; set; }
    public string CodeText { get; set; } = string.Empty;

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
