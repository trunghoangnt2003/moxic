using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moxic.Core.Entities;
using Moxic.Infrastructure.Data;

namespace Moxic.Api.Controllers;

[Route("api/admin/contact-settings")]
[ApiController]
[Authorize(Roles = "Admin")]
public class AdminContactSettingsController : ControllerBase
{
    private readonly MoxicDbContext _db;

    public AdminContactSettingsController(MoxicDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var row = await _db.ContactSettings.AsNoTracking().OrderBy(c => c.Id).FirstOrDefaultAsync();
        return Ok(ToResponse(row));
    }

    [HttpPut]
    public async Task<IActionResult> Put([FromBody] UpdateContactSettingsRequest request)
    {
        var messenger = Blank(request.MessengerUrl);
        var zalo = Blank(request.Zalo);
        var phone = Blank(request.PhoneNumber);

        if (messenger != null && (messenger.Length > 500 || !ContactLinks.IsHttpUrl(messenger)))
            return BadRequest(new { error = "Link Messenger phải là URL hợp lệ bắt đầu bằng http:// hoặc https://." });

        if (zalo != null && (zalo.Length > 500 || !(ContactLinks.IsPhone(zalo) || ContactLinks.IsHttpUrl(zalo))))
            return BadRequest(new { error = "Zalo phải là link http(s) hợp lệ hoặc số điện thoại (8–20 ký tự số)." });

        if (phone != null && !ContactLinks.IsPhone(phone))
            return BadRequest(new { error = "Số điện thoại không hợp lệ (8–20 ký tự gồm số, dấu +, khoảng trắng, dấu chấm hoặc gạch ngang)." });

        var row = await _db.ContactSettings.OrderBy(c => c.Id).FirstOrDefaultAsync();
        if (row == null)
        {
            row = new ContactSetting();
            _db.ContactSettings.Add(row);
        }

        row.MessengerUrl = messenger;
        row.Zalo = zalo;
        row.PhoneNumber = phone;
        row.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(ToResponse(row));
    }

    private static string? Blank(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static object ToResponse(ContactSetting? row) => new
    {
        messengerUrl = row?.MessengerUrl ?? string.Empty,
        zalo = row?.Zalo ?? string.Empty,
        phoneNumber = row?.PhoneNumber ?? string.Empty,
        updatedAt = row?.UpdatedAt
    };
}

public record UpdateContactSettingsRequest(string? MessengerUrl, string? Zalo, string? PhoneNumber);

/// <summary>Validation + href resolution shared by the admin and public contact endpoints.</summary>
public static partial class ContactLinks
{
    [GeneratedRegex(@"^[0-9+ .\-]{8,20}$")]
    private static partial Regex PhoneRegex();

    public static bool IsPhone(string value) => PhoneRegex().IsMatch(value);

    /// <summary>Absolute http/https URI only (rejects javascript:, data:, relative, etc.).</summary>
    public static bool IsHttpUrl(string value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri)
        && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);

    private static string DigitsOnly(string value) => new(value.Where(char.IsAsciiDigit).ToArray());

    public static string? ResolveMessenger(string? stored) =>
        !string.IsNullOrWhiteSpace(stored) && IsHttpUrl(stored.Trim()) ? stored.Trim() : null;

    public static string? ResolveZalo(string? stored)
    {
        if (string.IsNullOrWhiteSpace(stored)) return null;
        var v = stored.Trim();
        if (IsPhone(v))
        {
            var digits = DigitsOnly(v);
            return digits.Length == 0 ? null : $"https://zalo.me/{digits}";
        }
        return IsHttpUrl(v) ? v : null;
    }

    public static string? ResolvePhoneHref(string? stored)
    {
        if (string.IsNullOrWhiteSpace(stored)) return null;
        var v = stored.Trim();
        if (!IsPhone(v)) return null;
        var digits = DigitsOnly(v);
        if (digits.Length == 0) return null;
        return "tel:" + (v.StartsWith('+') ? "+" : string.Empty) + digits;
    }
}
