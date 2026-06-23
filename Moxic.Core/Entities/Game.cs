namespace Moxic.Core.Entities;

using Moxic.Shared.Enums;

public class Game
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal OriginalPrice { get; set; }
    public decimal SalePrice { get; set; }
    public string Genre { get; set; } = string.Empty;
    public string Tags { get; set; } = string.Empty; // comma-separated: "Hot", "Sắp ra mắt"
    public GameStatus Status { get; set; } = GameStatus.Available;
    public DateTime? ReleaseDate { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Navigation
    public ICollection<GameMedia> Media { get; set; } = new List<GameMedia>();
}
