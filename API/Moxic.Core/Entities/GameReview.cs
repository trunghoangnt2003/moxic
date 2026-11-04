namespace Moxic.Core.Entities;

public class GameReview
{
    public Guid Id { get; set; }
    public Guid GameId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public int Rating { get; set; }
    public string Content { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    /// <summary>Author account (null for legacy/anonymous reviews).</summary>
    public string? UserId { get; set; }
    /// <summary>Author has a paid order containing this game.</summary>
    public bool IsVerifiedPurchase { get; set; }
    /// <summary>Hidden by moderation.</summary>
    public bool IsHidden { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public Game Game { get; set; } = null!;
}
