namespace Moxic.Core.Entities;

/// <summary>Singleton row with storefront floating-contact settings.</summary>
public class ContactSetting
{
    public int Id { get; set; }
    public string? MessengerUrl { get; set; }

    /// <summary>Either an absolute http/https URL or a phone number (resolved to https://zalo.me/{digits}).</summary>
    public string? Zalo { get; set; }

    public string? PhoneNumber { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
