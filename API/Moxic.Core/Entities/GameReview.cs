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

    public Game Game { get; set; } = null!;
}
