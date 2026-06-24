using Moxic.Core.Entities;

namespace Moxic.Core.DTOs;

public class GameDetailDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal OriginalPrice { get; set; }
    public decimal SalePrice { get; set; }
    public string Genre { get; set; } = string.Empty;
    public string Tags { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime? ReleaseDate { get; set; }
    public List<GameMediaDto> Media { get; set; } = new();
    public List<GameRating> Ratings { get; set; } = new();
    public SystemRequirementData? SystemRequirements { get; set; }
    public List<Guid> RelatedGameIds { get; set; } = new();
}

public class GameMediaDto
{
    public Guid Id { get; set; }
    public string ObjectKey { get; set; } = string.Empty;
    public bool IsPrimary { get; set; }
    public int DisplayOrder { get; set; }
    public string? PresignedUrl { get; set; }
}
