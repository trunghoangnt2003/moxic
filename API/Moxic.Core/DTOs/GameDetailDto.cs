using Moxic.Core.Entities;

namespace Moxic.Core.DTOs;

public class GameDetailDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal OriginalPrice { get; set; }
    public decimal SalePrice { get; set; }
    public List<GenreDto> Genres { get; set; } = new();
    public List<TagDto> Tags { get; set; } = new();
    public string Status { get; set; } = string.Empty;
    public DateTime? ReleaseDate { get; set; }
    public List<GameMediaDto> Media { get; set; } = new();
    public List<GameRating> Ratings { get; set; } = new();
    public SystemRequirementData? SystemRequirements { get; set; }
    public List<Guid> RelatedGameIds { get; set; } = new();
    public string ProductType { get; set; } = "Game";
    public string? Region { get; set; }
    public string? Publisher { get; set; }
    public string? Developer { get; set; }
    public List<GameEditionDto> Editions { get; set; } = new();

    // Social proof fields
    public int PurchaseCount { get; set; }
    public double StoreRating { get; set; }
    public List<GameReviewDto> Reviews { get; set; } = new();
}

public class GameEditionDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public List<string> Includes { get; set; } = new();
    public decimal OriginalPrice { get; set; }
    public decimal SalePrice { get; set; }
    public bool IsDefault { get; set; }
}

public class GameMediaDto
{
    public Guid Id { get; set; }
    public string ObjectKey { get; set; } = string.Empty;
    public bool IsPrimary { get; set; }
    public int DisplayOrder { get; set; }
    public string? PresignedUrl { get; set; }
}

public class GameReviewDto
{
    public Guid Id { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public int Rating { get; set; }
    public string Content { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
