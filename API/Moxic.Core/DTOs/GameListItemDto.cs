using Moxic.Shared.Enums;

namespace Moxic.Core.DTOs;

public class GameListItemDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal OriginalPrice { get; set; }
    public decimal SalePrice { get; set; }
    public string Genre { get; set; } = string.Empty;
    public string Tags { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime? ReleaseDate { get; set; }
    public string? CoverImageUrl { get; set; }
}
