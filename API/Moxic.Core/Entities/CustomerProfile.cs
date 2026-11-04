namespace Moxic.Core.Entities;

/// <summary>
/// Storefront customer profile, 1:1 with an Identity user (UserId is both PK and FK).
/// Kept as a plain entity so follow-up features (cases / points) can add columns.
/// </summary>
public class CustomerProfile
{
    /// <summary>IdentityUser.Id (PK + FK, cascade delete).</summary>
    public string UserId { get; set; } = string.Empty;

    public string DisplayName { get; set; } = string.Empty;

    /// <summary>Reward points balance — reserved for the cases/points feature.</summary>
    public int Points { get; set; }
    /// <summary>Email me when a wishlisted game drops in price.</summary>
    public bool PriceAlerts { get; set; } = true;
    /// <summary>This customer's personal referral code (lazily generated).</summary>
    public string? ReferralCode { get; set; }
    /// <summary>Who referred this customer (set once, shortly after sign-up).</summary>
    public string? ReferredByUserId { get; set; }
    /// <summary>When the referral reward was paid out (first completed order).</summary>
    public DateTime? ReferralRewardedAt { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
