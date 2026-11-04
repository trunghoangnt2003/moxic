namespace Moxic.Core.Entities;

public class OrderDetail
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public Guid GameId { get; set; }
    public string GameName { get; set; } = string.Empty; // Snapshot
    public decimal Price { get; set; } // Snapshot price at purchase
    public decimal? ListPrice { get; set; } // Snapshot of the Xbox Store (original) price — "you saved" figures
    public Guid? EditionId { get; set; }
    public string? EditionName { get; set; } // Snapshot

    // Navigation
    public Order Order { get; set; } = null!;
    public Game Game { get; set; } = null!;
}
