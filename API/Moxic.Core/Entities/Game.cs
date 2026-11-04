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
    /// <summary>Microsoft Store product id ("bigId", e.g. 9NBLGGH4R2R6) for price tracking.</summary>
    public string? XboxProductId { get; set; }
    /// <summary>Store region used for the Xbox price reference (ISO-2, lower case). Default "us".</summary>
    public string? PriceRegion { get; set; }
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
