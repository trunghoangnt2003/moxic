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

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
