namespace Moxic.Core.Entities;

public class GameMedia
{
    public Guid Id { get; set; }
    public Guid GameId { get; set; }
    public string ObjectKey { get; set; } = string.Empty; // MinIO key: games/{game-id}/{filename}
    public bool IsPrimary { get; set; }
    public int DisplayOrder { get; set; }
    public DateTime CreatedAt { get; set; }

    // Navigation
    public Game Game { get; set; } = null!;
}
