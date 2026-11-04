namespace Moxic.Core.DTOs;

public class GameListItemDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal OriginalPrice { get; set; }
    public decimal SalePrice { get; set; }
    public List<GenreDto> Genres { get; set; } = new();
    public List<TagDto> Tags { get; set; } = new();
    public string Status { get; set; } = string.Empty;
    public DateTime? ReleaseDate { get; set; }
    public string? CoverImageUrl { get; set; }
    /// <summary>Copies sold in paid/fulfilled orders (social proof).</summary>
    public int SoldCount { get; set; }
    public string ProductType { get; set; } = "Game";
    public string? Region { get; set; }
    public string? Publisher { get; set; }
    /// <summary>Number of active editions; &gt; 1 shows "Từ …" pricing.</summary>
    public int EditionCount { get; set; }
    /// <summary>Cheapest active rental plan, when the game can be rented.</summary>
    public decimal? RentFrom { get; set; }
}
