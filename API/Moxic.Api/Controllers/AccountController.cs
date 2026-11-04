using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Moxic.Api.Models;
using Moxic.Api.Services;
using Moxic.Core.Entities;
using Moxic.Core.Interfaces;
using Moxic.Infrastructure.Data;
using Moxic.Shared.Enums;

namespace Moxic.Api.Controllers;

/// <summary>
/// Storefront customer accounts (register / verify email / login / logout / forgot + reset
/// password / me). Customers authenticate with the separate MoxicCustomer cookie scheme;
/// nothing here ever writes the admin Identity.Application cookie.
/// </summary>
[Route("api/account")]
[ApiController]
public class AccountController : ControllerBase
{
    private const string InvalidCredentials = "Email hoặc mật khẩu không đúng.";
    private const string InvalidOrExpiredCode = "Mã không đúng hoặc đã hết hạn.";
    private const string WrongVerificationCode = "Mã xác minh không đúng.";
    private const string ExpiredVerificationCode = "Mã xác minh đã hết hạn hoặc nhập sai quá nhiều lần. Vui lòng gửi lại mã.";

    private readonly UserManager<IdentityUser> _userManager;
    private readonly SignInManager<IdentityUser> _signInManager;
    private readonly RoleManager<IdentityRole> _roleManager;
    private readonly IUserClaimsPrincipalFactory<IdentityUser> _claimsFactory;
    private readonly MoxicDbContext _db;
    private readonly CustomerOtpService _otp;
    private readonly IBackgroundEmailQueue _emailQueue;
    private readonly ILogger<AccountController> _logger;

    public AccountController(
        UserManager<IdentityUser> userManager,
        SignInManager<IdentityUser> signInManager,
        RoleManager<IdentityRole> roleManager,
        IUserClaimsPrincipalFactory<IdentityUser> claimsFactory,
        MoxicDbContext db,
        CustomerOtpService otp,
        IBackgroundEmailQueue emailQueue,
        ILogger<AccountController> logger)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _roleManager = roleManager;
        _claimsFactory = claimsFactory;
        _db = db;
        _otp = otp;
        _emailQueue = emailQueue;
        _logger = logger;
    }

    // POST /api/account/register
    [HttpPost("register")]
    [EnableRateLimiting(CustomerAuthRules.RateLimitPolicy)]
    public async Task<IActionResult> Register([FromBody] RegisterCustomerRequest? request)
    {
        var email = CustomerAuthRules.NormalizeEmail(request?.Email);
        if (email == null)
            return BadRequest(new { error = "Email không hợp lệ." });

        var displayName = request?.DisplayName?.Trim() ?? string.Empty;
        if (displayName.Length < CustomerAuthRules.DisplayNameMin || displayName.Length > CustomerAuthRules.DisplayNameMax)
            return BadRequest(new { error = "Tên hiển thị phải từ 2 đến 50 ký tự." });

        var password = request?.Password;
        if (string.IsNullOrEmpty(password))
            return BadRequest(new { error = "Vui lòng nhập mật khẩu." });

        await EnsureCustomerRoleAsync();

        var user = await _userManager.FindByEmailAsync(email);
        if (user != null)
        {
            if (!await IsClaimableAsync(user))
                return Conflict(new { error = "Email này đã được đăng ký. Vui lòng đăng nhập." });

            // Re-claim an unverified customer (or a role-less Identity UI user): the new
            // registrant must prove inbox ownership via OTP before they can log in.
            var token = await _userManager.GeneratePasswordResetTokenAsync(user);
            var reset = await _userManager.ResetPasswordAsync(user, token, password);
            if (!reset.Succeeded)
                return BadRequest(new { error = CustomerAuthRules.TranslateIdentityErrors(reset.Errors) });

            user.EmailConfirmed = false;
            await _userManager.UpdateAsync(user);
            if (!await _userManager.IsInRoleAsync(user, CustomerAuthRules.CustomerRole))
                await _userManager.AddToRoleAsync(user, CustomerAuthRules.CustomerRole);

            await UpsertProfileAsync(user.Id, displayName);
        }
        else
        {
            user = new IdentityUser { UserName = email, Email = email, EmailConfirmed = false };
            var created = await _userManager.CreateAsync(user, password);
            if (!created.Succeeded)
            {
                var duplicate = created.Errors.Any(e => e.Code is "DuplicateEmail" or "DuplicateUserName");
                var message = CustomerAuthRules.TranslateIdentityErrors(created.Errors);
                return duplicate
                    ? Conflict(new { error = "Email này đã được đăng ký. Vui lòng đăng nhập." })
                    : BadRequest(new { error = message });
            }

            await _userManager.AddToRoleAsync(user, CustomerAuthRules.CustomerRole);
            await UpsertProfileAsync(user.Id, displayName);
        }

        await SendVerificationCodeAsync(user, displayName);
        return Ok(new { email, requiresVerification = true });
    }

    // POST /api/account/verify-email
    [HttpPost("verify-email")]
    [EnableRateLimiting(CustomerAuthRules.RateLimitPolicy)]
    public async Task<IActionResult> VerifyEmail([FromBody] VerifyEmailRequest? request)
    {
        var email = CustomerAuthRules.NormalizeEmail(request?.Email);
        var user = email == null ? null : await _userManager.FindByEmailAsync(email);
        if (user == null || !await _userManager.IsInRoleAsync(user, CustomerAuthRules.CustomerRole))
            return BadRequest(new { error = "Mã xác minh không đúng hoặc đã hết hạn." });

        if (user.EmailConfirmed)
            return BadRequest(new { error = "Email đã được xác minh. Vui lòng đăng nhập." });

        var result = await _otp.VerifyAsync(user, CustomerOtpPurpose.EmailVerification, request?.Code);
        switch (result)
        {
            case OtpCheckResult.Invalid:
                return BadRequest(new { error = WrongVerificationCode });
            case OtpCheckResult.Expired:
                return BadRequest(new { error = ExpiredVerificationCode });
        }

        user.EmailConfirmed = true;
        await _userManager.UpdateAsync(user);

        await SignInCustomerAsync(user);
        return Ok(await BuildMeAsync(user));
    }

    // POST /api/account/resend-verification
    [HttpPost("resend-verification")]
    [EnableRateLimiting(CustomerAuthRules.RateLimitPolicy)]
    public async Task<IActionResult> ResendVerification([FromBody] EmailOnlyRequest? request)
    {
        var email = CustomerAuthRules.NormalizeEmail(request?.Email);
        if (email != null)
        {
            var user = await _userManager.FindByEmailAsync(email);
            if (user != null && !user.EmailConfirmed && await _userManager.IsInRoleAsync(user, CustomerAuthRules.CustomerRole))
            {
                var profile = await _db.CustomerProfiles.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == user.Id);
                await SendVerificationCodeAsync(user, profile?.DisplayName ?? FallbackDisplayName(user));
            }
        }

        return Ok(new { message = "Nếu email đã đăng ký và chưa xác minh, mã mới đã được gửi." });
    }

    // POST /api/account/login
    [HttpPost("login")]
    [EnableRateLimiting(CustomerAuthRules.RateLimitPolicy)]
    public async Task<IActionResult> Login([FromBody] CustomerLoginRequest? request)
    {
        var email = CustomerAuthRules.NormalizeEmail(request?.Email);
        var password = request?.Password;
        if (email == null || string.IsNullOrEmpty(password))
            return Unauthorized(new { error = InvalidCredentials });

        var user = await _userManager.FindByEmailAsync(email);
        if (user == null || !await _userManager.IsInRoleAsync(user, CustomerAuthRules.CustomerRole))
            return Unauthorized(new { error = InvalidCredentials });

        // Validates password + lockout WITHOUT issuing any cookie (PasswordSignInAsync would
        // write the admin Identity.Application cookie).
        var check = await _signInManager.CheckPasswordSignInAsync(user, password, lockoutOnFailure: true);
        if (check.IsLockedOut && user.LockoutEnd > DateTimeOffset.UtcNow.AddYears(1))
            return StatusCode(StatusCodes.Status423Locked,
                new { error = "Tài khoản đã bị khóa. Vui lòng liên hệ Moxic để được hỗ trợ." });
        if (check.IsLockedOut)
            return StatusCode(StatusCodes.Status423Locked,
                new { error = "Tài khoản tạm khóa do đăng nhập sai nhiều lần. Vui lòng thử lại sau ít phút." });
        if (!check.Succeeded)
            return Unauthorized(new { error = InvalidCredentials });

        if (!user.EmailConfirmed)
        {
            var profile = await _db.CustomerProfiles.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == user.Id);
            await SendVerificationCodeAsync(user, profile?.DisplayName ?? FallbackDisplayName(user));
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                error = "Email chưa được xác minh. Vui lòng nhập mã xác minh đã gửi tới email của bạn.",
                code = "EMAIL_NOT_VERIFIED",
                email = user.Email
            });
        }

        await SignInCustomerAsync(user);
        return Ok(await BuildMeAsync(user));
    }

    // POST /api/account/logout
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CustomerAuthRules.Scheme);
        return NoContent();
    }

    // GET /api/account/me — 204 (not 401) for guests to keep the browser console quiet
    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var auth = await HttpContext.AuthenticateAsync(CustomerAuthRules.Scheme);
        if (!auth.Succeeded || auth.Principal == null || !auth.Principal.IsInRole(CustomerAuthRules.CustomerRole))
            return NoContent();

        var userId = auth.Principal.FindFirstValue(ClaimTypes.NameIdentifier);
        var user = string.IsNullOrEmpty(userId) ? null : await _userManager.FindByIdAsync(userId);
        if (user == null || !user.EmailConfirmed)
            return NoContent();

        return Ok(await BuildMeAsync(user));
    }

    // POST /api/account/forgot-password — identical response whether or not the email exists
    [HttpPost("forgot-password")]
    [EnableRateLimiting(CustomerAuthRules.RateLimitPolicy)]
    public async Task<IActionResult> ForgotPassword([FromBody] EmailOnlyRequest? request)
    {
        var email = CustomerAuthRules.NormalizeEmail(request?.Email);
        if (email != null)
        {
            var user = await _userManager.FindByEmailAsync(email);
            if (user != null && await _userManager.IsInRoleAsync(user, CustomerAuthRules.CustomerRole))
            {
                var code = await _otp.IssueAsync(user, CustomerOtpPurpose.PasswordReset);
                if (code != null)
                {
                    var to = user.Email!;
                    var en = RequestLanguage.IsEnglish;
                    _emailQueue.Enqueue(async (sf, ct) =>
                    {
                        using var scope = sf.CreateScope();
                        var svc = scope.ServiceProvider.GetRequiredService<IEmailService>();
                        await svc.SendPasswordResetCodeAsync(to, code, en);
                    });
                }
            }
        }

        return Ok(new { message = "Nếu email đã đăng ký, mã đặt lại mật khẩu đã được gửi." });
    }

    // POST /api/account/reset-password
    [HttpPost("reset-password")]
    [EnableRateLimiting(CustomerAuthRules.RateLimitPolicy)]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest? request)
    {
        var email = CustomerAuthRules.NormalizeEmail(request?.Email);
        var user = email == null ? null : await _userManager.FindByEmailAsync(email);
        if (user == null || !await _userManager.IsInRoleAsync(user, CustomerAuthRules.CustomerRole))
            return BadRequest(new { error = InvalidOrExpiredCode });

        var newPassword = request?.NewPassword;
        if (string.IsNullOrEmpty(newPassword))
            return BadRequest(new { error = "Vui lòng nhập mật khẩu mới." });

        // Validate the password policy first so a weak password does not burn the OTP.
        var policyErrors = new List<IdentityError>();
        foreach (var validator in _userManager.PasswordValidators)
        {
            var validation = await validator.ValidateAsync(_userManager, user, newPassword);
            if (!validation.Succeeded) policyErrors.AddRange(validation.Errors);
        }
        if (policyErrors.Count > 0)
            return BadRequest(new { error = CustomerAuthRules.TranslateIdentityErrors(policyErrors) });

        var check = await _otp.VerifyAsync(user, CustomerOtpPurpose.PasswordReset, request?.Code);
        switch (check)
        {
            case OtpCheckResult.Invalid:
                return BadRequest(new { error = "Mã không đúng." });
            case OtpCheckResult.Expired:
                return BadRequest(new { error = "Mã đã hết hạn hoặc nhập sai quá nhiều lần. Vui lòng gửi lại mã." });
        }

        // ResetPasswordAsync rotates the security stamp → other customer sessions are rejected.
        var token = await _userManager.GeneratePasswordResetTokenAsync(user);
        var reset = await _userManager.ResetPasswordAsync(user, token, newPassword);
        if (!reset.Succeeded)
            return BadRequest(new { error = CustomerAuthRules.TranslateIdentityErrors(reset.Errors) });

        if (!user.EmailConfirmed)
        {
            // Receiving the code proves inbox ownership.
            user.EmailConfirmed = true;
            await _userManager.UpdateAsync(user);
        }
        await _userManager.SetLockoutEndDateAsync(user, null);
        await _userManager.ResetAccessFailedCountAsync(user);

        return Ok(new { message = "Đặt lại mật khẩu thành công. Vui lòng đăng nhập." });
    }

    // ---- helpers ----

    private async Task EnsureCustomerRoleAsync()
    {
        if (!await _roleManager.RoleExistsAsync(CustomerAuthRules.CustomerRole))
            await _roleManager.CreateAsync(new IdentityRole(CustomerAuthRules.CustomerRole));
    }

    /// <summary>Not an admin AND (not yet a customer OR an unverified customer).</summary>
    private async Task<bool> IsClaimableAsync(IdentityUser user)
    {
        if (await _userManager.IsInRoleAsync(user, CustomerAuthRules.AdminRole)) return false;
        if (!await _userManager.IsInRoleAsync(user, CustomerAuthRules.CustomerRole)) return true;
        return !user.EmailConfirmed;
    }

    private async Task UpsertProfileAsync(string userId, string displayName)
    {
        var now = DateTime.UtcNow;
        var profile = await _db.CustomerProfiles.FirstOrDefaultAsync(p => p.UserId == userId);
        if (profile == null)
        {
            _db.CustomerProfiles.Add(new CustomerProfile
            {
                UserId = userId,
                DisplayName = displayName,
                Lang = RequestLanguage.IsEnglish ? "en" : "vi",
                Points = 0,
                CreatedAt = now,
                UpdatedAt = now
            });
        }
        else
        {
            profile.DisplayName = displayName;
            profile.UpdatedAt = now;
        }
        await _db.SaveChangesAsync();
    }

    private async Task SendVerificationCodeAsync(IdentityUser user, string displayName)
    {
        var code = await _otp.IssueAsync(user, CustomerOtpPurpose.EmailVerification);
        if (code == null) return; // resend cooldown — the previous code is still valid

        var to = user.Email!;
        var name = displayName;
        var en = RequestLanguage.IsEnglish;
        _emailQueue.Enqueue(async (sf, ct) =>
        {
            using var scope = sf.CreateScope();
            var svc = scope.ServiceProvider.GetRequiredService<IEmailService>();
            await svc.SendEmailVerificationCodeAsync(to, name, code, en);
        });
    }

    private async Task SignInCustomerAsync(IdentityUser user)
    {
        // Claims factory adds NameIdentifier, roles and the security-stamp claim
        // (checked by CustomerAuthRules.ValidatePrincipalAsync).
        var factoryPrincipal = await _claimsFactory.CreateAsync(user);
        var identity = new ClaimsIdentity(factoryPrincipal.Claims, CustomerAuthRules.Scheme);
        await HttpContext.SignInAsync(
            CustomerAuthRules.Scheme,
            new ClaimsPrincipal(identity),
            new AuthenticationProperties { IsPersistent = true });
        _logger.LogInformation("Customer {UserId} signed in", user.Id);
        // Remember the site language for emails/notifications sent later.
        var lang = RequestLanguage.IsEnglish ? "en" : "vi";
        await _db.CustomerProfiles.Where(p => p.UserId == user.Id && p.Lang != lang).ExecuteUpdateAsync(s => s.SetProperty(p => p.Lang, lang));
    }

    private async Task<CustomerMeDto> BuildMeAsync(IdentityUser user)
    {
        var profile = await _db.CustomerProfiles.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == user.Id);
        return new CustomerMeDto(
            user.Id,
            user.Email ?? string.Empty,
            profile?.DisplayName ?? FallbackDisplayName(user),
            profile?.Points ?? 0,
            user.EmailConfirmed,
            profile?.CreatedAt ?? DateTime.UtcNow);
    }

    private static string FallbackDisplayName(IdentityUser user)
    {
        var email = user.Email ?? user.UserName ?? string.Empty;
        var at = email.IndexOf('@');
        return at > 0 ? email[..at] : email;
    }
}
