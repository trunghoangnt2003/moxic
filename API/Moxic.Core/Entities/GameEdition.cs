namespace Moxic.Core.Entities;

/// <summary>
/// A purchasable edition of a game (Standard / Deluxe / Ultimate …) with its own price.
/// Games without editions are sold at Game.SalePrice as before.
/// </summary>
public class GameEdition
{
    public Guid Id { get; set; }
    public Guid GameId { get; set; }
    public Game Game { get; set; } = null!;

    public string Name { get; set; } = string.Empty;
    /// <summary>What the edition includes — one item per line (shown as a comparison list).</summary>
    public string? Includes { get; set; }

    public decimal OriginalPrice { get; set; }
    public decimal SalePrice { get; set; }

    public bool IsDefault { get; set; }
    public bool IsActive { get; set; } = true;
    public int DisplayOrder { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
