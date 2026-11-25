namespace Moxic.Core.Entities;

using Moxic.Shared.Enums;

public class Game
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    /// <summary>English name/description for the /en site; empty = use the Vietnamese ones.</summary>
    public string? NameEn { get; set; }
    public string? DescriptionEn { get; set; }
    public decimal OriginalPrice { get; set; }
    public decimal SalePrice { get; set; }
    public GameStatus Status { get; set; } = GameStatus.Available;
    public DateTime? ReleaseDate { get; set; }
    public bool IsFeatured { get; set; }

    /// <summary>Loyalty points credited when an order containing this game is Completed.</summary>
    public int RewardPoints { get; set; }

    /// <summary>Customers may open share rooms (2 people buy it together) for this game.</summary>
    public bool AllowShare { get; set; }

    /// <summary>Extra amount (VND) added to the game price for a share room (buying together costs Moxic more work).</summary>
    public decimal ShareSurcharge { get; set; }

    /// <summary>False = waiting in the admin review queue (crawled/imported); hidden from every customer query by a global filter.</summary>
    public bool IsPublished { get; set; } = true;

    /// <summary>"Formula" (selling price follows the catalog price formula) | "Manual" (set by hand, never overwritten).</summary>
    public string PriceMode { get; set; } = "Manual";

    /// <summary>Where a crawled/imported game came from: "xbox" | "csv" (null = added by hand).</summary>
    public string? ImportSource { get; set; }

    /// <summary>Position in the Xbox Store "most popular" order at the last crawl (1 = hottest). Drives the "Game hot" filter.</summary>
    public int? PopularityRank { get; set; }

    /// <summary>Xbox image links kept while the game waits for review; downloaded into MinIO only when it is published.</summary>
    public string? XboxPosterUrl { get; set; }
    public string? XboxHeroUrl { get; set; }

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
    /// <summary>Flash sale: when the current discount ends (UTC). Null = no countdown.</summary>
    public DateTime? SaleEndsAt { get; set; }
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
