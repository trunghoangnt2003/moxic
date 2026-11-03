using Moxic.Shared.Enums;

namespace Moxic.Core.Entities;

/// <summary>
/// A hashed 6-digit one-time code for email verification or password reset.
/// The plain code is never stored; only the newest unconsumed code per user+purpose is valid.
/// </summary>
public class CustomerOtpCode
{
    public Guid Id { get; set; }

    /// <summary>IdentityUser.Id (FK, cascade delete).</summary>
    public string UserId { get; set; } = string.Empty;

    public CustomerOtpPurpose Purpose { get; set; }

    /// <summary>IPasswordHasher hash of the plain code.</summary>
    public string CodeHash { get; set; } = string.Empty;

    public DateTime ExpiresAt { get; set; }
    public int FailedAttempts { get; set; }
    public DateTime? ConsumedAt { get; set; }
    public DateTime CreatedAt { get; set; }
}
