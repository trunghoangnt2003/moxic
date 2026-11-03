using System.Security.Cryptography;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Moxic.Core.Entities;
using Moxic.Infrastructure.Data;
using Moxic.Shared.Enums;

namespace Moxic.Api.Services;

public enum OtpCheckResult
{
    Valid,
    Invalid,
    Expired
}

/// <summary>
/// Issues and verifies 6-digit customer OTPs. Codes come from the CSPRNG
/// (<see cref="RandomNumberGenerator"/>), are stored hashed (PBKDF2 via IPasswordHasher),
/// expire after 15 minutes, die after 5 wrong attempts and have a 60 s resend cooldown.
/// </summary>
public class CustomerOtpService
{
    private readonly MoxicDbContext _db;
    private readonly IPasswordHasher<IdentityUser> _hasher;

    public CustomerOtpService(MoxicDbContext db, IPasswordHasher<IdentityUser> hasher)
    {
        _db = db;
        _hasher = hasher;
    }

    /// <summary>
    /// Returns the plain code to email, or null when the newest code for this user+purpose
    /// is younger than the resend cooldown (nothing is issued then).
    /// </summary>
    public async Task<string?> IssueAsync(IdentityUser user, CustomerOtpPurpose purpose)
    {
        var now = DateTime.UtcNow;
        var latestCreatedAt = await _db.CustomerOtpCodes
            .Where(c => c.UserId == user.Id && c.Purpose == purpose)
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => (DateTime?)c.CreatedAt)
            .FirstOrDefaultAsync();

        if (latestCreatedAt.HasValue && now - latestCreatedAt.Value < CustomerAuthRules.OtpResendCooldown)
            return null;

        await _db.CustomerOtpCodes
            .Where(c => c.UserId == user.Id && c.Purpose == purpose)
            .ExecuteDeleteAsync();

        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        _db.CustomerOtpCodes.Add(new CustomerOtpCode
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Purpose = purpose,
            CodeHash = _hasher.HashPassword(user, code),
            ExpiresAt = now.Add(CustomerAuthRules.OtpLifetime),
            FailedAttempts = 0,
            CreatedAt = now
        });
        await _db.SaveChangesAsync();
        return code;
    }

    public async Task<OtpCheckResult> VerifyAsync(IdentityUser user, CustomerOtpPurpose purpose, string? code)
    {
        var digits = new string((code ?? string.Empty).Where(char.IsAsciiDigit).ToArray());

        var otp = await _db.CustomerOtpCodes
            .AsNoTracking()
            .Where(c => c.UserId == user.Id && c.Purpose == purpose && c.ConsumedAt == null)
            .OrderByDescending(c => c.CreatedAt)
            .FirstOrDefaultAsync();

        var now = DateTime.UtcNow;
        const int maxAttempts = CustomerAuthRules.OtpMaxAttempts;
        if (otp == null || otp.ExpiresAt <= now || otp.FailedAttempts >= maxAttempts)
            return OtpCheckResult.Expired;

        var id = otp.Id;
        if (digits.Length == 6 && _hasher.VerifyHashedPassword(user, otp.CodeHash, digits) != PasswordVerificationResult.Failed)
        {
            // Conditional single-row UPDATE: concurrent requests cannot both consume the code.
            var consumed = await _db.CustomerOtpCodes
                .Where(c => c.Id == id && c.ConsumedAt == null && c.FailedAttempts < maxAttempts)
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.ConsumedAt, now));
            return consumed == 1 ? OtpCheckResult.Valid : OtpCheckResult.Expired;
        }

        // Atomic increment so parallel wrong guesses cannot exceed the attempt cap.
        await _db.CustomerOtpCodes
            .Where(c => c.Id == id)
            .ExecuteUpdateAsync(s => s.SetProperty(c => c.FailedAttempts, c => c.FailedAttempts + 1));
        var attempts = await _db.CustomerOtpCodes
            .Where(c => c.Id == id)
            .Select(c => c.FailedAttempts)
            .FirstOrDefaultAsync();
        return attempts >= maxAttempts ? OtpCheckResult.Expired : OtpCheckResult.Invalid;
    }
}
