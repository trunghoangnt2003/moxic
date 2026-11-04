namespace Moxic.Core.Entities;

/// <summary>A game saved to a customer's "Yêu thích" list. PK (UserId, GameId).</summary>
public class WishlistItem
{
    public string UserId { get; set; } = string.Empty;
    public Guid GameId { get; set; }
    public Game Game { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
}
