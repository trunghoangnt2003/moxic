namespace Moxic.Core.Entities;

/// <summary>A browser/PWA Web Push subscription for a customer (one per device/browser).</summary>
public class WebPushSubscription
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string Endpoint { get; set; } = string.Empty;
    public string P256dh { get; set; } = string.Empty;
    public string Auth { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
