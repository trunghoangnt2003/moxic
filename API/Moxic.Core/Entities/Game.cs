namespace Moxic.Core.Entities;

using Moxic.Shared.Enums;

public class Game
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal OriginalPrice { get; set; }
    public decimal SalePrice { get; set; }
    public GameStatus Status { get; set; } = GameStatus.Available;
    public DateTime? ReleaseDate { get; set; }
    public bool IsFeatured { get; set; }

    /// <summary>Loyalty points credited when an order containing this game is Completed.</summary>
    public int RewardPoints { get; set; }

    /// <summary>"Game" | "GamePass" | "GiftCard" | "DLC" | "Bundle".</summary>
    public string ProductType { get; set; } = "Game";
    /// <summary>Store region the product is bought in (e.g. "Global", "US", "AR", "TR").</summary>
    public string? Region { get; set; }
    public string? Publisher { get; set; }
    public string? Developer { get; set; }
    public ICollection<GameEdition> Editions { get; set; } = new List<GameEdition>();
    public SystemRequirementData? SystemRequirements { get; set; }
    public List<GameRating> Ratings { get; set; } = new();
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public List<GameReview> Reviews { get; set; } = new();

    // Navigation
    public ICollection<Genre> Genres { get; set; } = new List<Genre>();
    public ICollection<Tag> Tags { get; set; } = new List<Tag>();
    public ICollection<GameMedia> Media { get; set; } = new List<GameMedia>();
}
