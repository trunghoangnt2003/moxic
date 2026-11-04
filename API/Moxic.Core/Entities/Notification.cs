namespace Moxic.Core.Entities;

/// <summary>In-app notification for a customer (the navbar bell).</summary>
public class Notification
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    /// <summary>"order" | "rental" | "price" | "points" | "system" — drives the icon.</summary>
    public string Type { get; set; } = "system";
    public string Title { get; set; } = string.Empty;
    public string? Body { get; set; }
    /// <summary>Same-site path to open, e.g. /account/orders/MOXIC-…</summary>
    public string? Link { get; set; }
    public DateTime? ReadAt { get; set; }
    public DateTime CreatedAt { get; set; }
}
