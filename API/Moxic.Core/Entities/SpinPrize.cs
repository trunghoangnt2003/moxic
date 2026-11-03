using Moxic.Shared.Enums;

namespace Moxic.Core.Entities;

public class SpinPrize
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public SpinPrizeType Type { get; set; } = SpinPrizeType.Luck;
    public Guid? GameId { get; set; }

    /// <summary>Odds in percent (0.01 .. 100.00, precision 5,2).</summary>
    public decimal Probability { get; set; }

    public bool IsActive { get; set; } = true;
    public int DisplayOrder { get; set; } = 0;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Navigation
    public Game? Game { get; set; }
}
