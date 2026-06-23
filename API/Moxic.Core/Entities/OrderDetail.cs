namespace Moxic.Core.Entities;

public class OrderDetail
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public Guid GameId { get; set; }
    public string GameName { get; set; } = string.Empty; // Snapshot
    public decimal Price { get; set; } // Snapshot price at purchase

    // Navigation
    public Order Order { get; set; } = null!;
    public Game Game { get; set; } = null!;
}
