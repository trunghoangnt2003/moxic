using System.Net.Mail;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace Moxic.Api.Services;

/// <summary>
/// Constants and pure helpers for storefront customer accounts. Customers use their own
/// cookie scheme (MoxicCustomer) so they never share a session with the admin
/// (Identity.Application / MoxicAuthCookie) scheme.
/// </summary>
public static class CustomerAuthRules
{
    public const string Scheme = "MoxicCustomer";
    public const string CookieName = "MoxicCustomer";
    public const string CustomerRole = "Customer";
    public const string AdminRole = "Admin";
    public const string RateLimitPolicy = "customer-auth";

    public static readonly TimeSpan OtpLifetime = TimeSpan.FromMinutes(15);
    public const int OtpMaxAttempts = 5;
    public static readonly TimeSpan OtpResendCooldown = TimeSpan.FromSeconds(60);

    public const int DisplayNameMin = 2;
    public const int DisplayNameMax = 50;
    private const int EmailMax = 200;

    /// <summary>Trimmed email, or null when missing / invalid / too long.</summary>
    public static string? NormalizeEmail(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var email = raw.Trim();
        if (email.Length > EmailMax) return null;
        if (!MailAddress.TryCreate(email, out var parsed)) return null;
        // Reject display-name forms like "Name <a@b.c>" — the address must be the whole input.
        if (!string.Equals(parsed.Address, email, StringComparison.OrdinalIgnoreCase)) return null;
        return email;
    }

    /// <summary>Collapse Identity errors into a single Vietnamese message.</summary>
    public static string TranslateIdentityErrors(IEnumerable<IdentityError> errors)
    {
        var messages = new List<string>();
        foreach (var error in errors)
        {
            var msg = error.Code switch
            {
                "PasswordTooShort" => "Mật khẩu phải có ít nhất 8 ký tự.",
                "PasswordRequiresDigit" => "Mật khẩu phải chứa ít nhất 1 chữ số.",
                "DuplicateEmail" or "DuplicateUserName" => "Email này đã được đăng ký.",
                "InvalidEmail" or "InvalidUserName" => "Email không hợp lệ.",
                _ => "Không thể xử lý yêu cầu. Vui lòng thử lại."
            };
            if (!messages.Contains(msg)) messages.Add(msg);
        }
        return messages.Count == 0 ? "Không thể xử lý yêu cầu. Vui lòng thử lại." : string.Join(" ", messages);
    }

    /// <summary>
    /// Cookie OnValidatePrincipal for the customer scheme: rejects the cookie when the user
    /// is gone or the security stamp changed (e.g. after a password reset).
    /// Deliberately NOT SecurityStampValidator — that one signs out the admin Identity scheme.
    /// </summary>
    public static async Task ValidatePrincipalAsync(CookieValidatePrincipalContext context)
    {
        var principal = context.Principal;
        var userId = principal?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
        {
            await RejectAsync(context);
            return;
        }

        var services = context.HttpContext.RequestServices;
        var userManager = services.GetRequiredService<UserManager<IdentityUser>>();
        var stampClaimType = services.GetRequiredService<IOptions<IdentityOptions>>().Value.ClaimsIdentity.SecurityStampClaimType;

        var user = await userManager.FindByIdAsync(userId);
        if (user == null)
        {
            await RejectAsync(context);
            return;
        }

        var cookieStamp = principal!.FindFirstValue(stampClaimType);
        var currentStamp = await userManager.GetSecurityStampAsync(user);
        if (!string.Equals(cookieStamp, currentStamp, StringComparison.Ordinal))
        {
            await RejectAsync(context);
        }
    }

    private static async Task RejectAsync(CookieValidatePrincipalContext context)
    {
        context.RejectPrincipal();
        await context.HttpContext.SignOutAsync(Scheme);
    }
}
