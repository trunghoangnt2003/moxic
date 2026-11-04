namespace Moxic.Core.Entities;

/// <summary>Discussion comment on a game page. One reply level (ParentId = top-level comment).</summary>
public class GameComment
{
    public Guid Id { get; set; }
    public Guid GameId { get; set; }
    public Guid? ParentId { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public bool IsHidden { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>A user report on a review or comment ("Review" | "Comment").</summary>
public class ContentReport
{
    public Guid Id { get; set; }
    public string TargetType { get; set; } = "Comment";
    public Guid TargetId { get; set; }
    public string? ReporterUserId { get; set; }
    public string? ReporterIp { get; set; }
    /// <summary>"Spam" | "Offensive" | "Scam" | "Spoiler" | "Other".</summary>
    public string Reason { get; set; } = "Other";
    public string? Note { get; set; }
    /// <summary>"Open" | "Hidden" | "Dismissed".</summary>
    public string Status { get; set; } = "Open";
    public DateTime CreatedAt { get; set; }
    public DateTime? ResolvedAt { get; set; }
}
