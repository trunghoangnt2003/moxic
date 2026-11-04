using System.Security.Cryptography;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Moxic.Api.Services;
using Moxic.Core.Interfaces;
using Moxic.Infrastructure.Data;
using Moxic.Shared.Enums;

namespace Moxic.Api.Controllers;

public static class GiftRules
{
    private const string Alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

    /// <summary>Unguessable, URL-safe gift token (~140 bits).</summary>
    public static string NewToken() => RandomNumberGenerator.GetString(Alphabet, 24);

    public static string? Clean(string? s, int max)
    {
        var t = s?.Trim();
        if (string.IsNullOrEmpty(t)) return null;
        return t.Length > max ? t[..max] : t;
    }

    /// <summary>Recipient may (re)enter Xbox details until the shop starts installing.</summary>
    public static bool CanClaim(OrderStatus status, bool claimed) =>
        status is OrderStatus.Pending or OrderStatus.AwaitingConfirmation or OrderStatus.Verifying or OrderStatus.ActionRequired;
}

public record GiftClaimRequest(string XboxEmail, string XboxPassword, string? Phone);

/// <summary>Public gift link: the recipient sees the gift and enters their own Xbox account.</summary>
[ApiController]
[Route("api/gifts")]
public class GiftsController : ControllerBase
{
    private readonly MoxicDbContext _db;
    private readonly IMinioService _minio;
    private readonly IDataProtectionProvider _dataProtection;
    private readonly NotificationService _notifications;
    private readonly ILogger<GiftsController> _logger;

    public GiftsController(MoxicDbContext db, IMinioService minio, IDataProtectionProvider dataProtection, NotificationService notifications, ILogger<GiftsController> logger)
    {
        _db = db;
        _minio = minio;
        _dataProtection = dataProtection;
        _notifications = notifications;
        _logger = logger;
    }

    private static bool ValidToken(string token) => token.Length == 24 && token.All(char.IsAsciiLetterOrDigit);

    // GET /api/gifts/{token}
    [HttpGet("{token}")]
    [EnableRateLimiting(CouponRules.RateLimitPolicy)]
    public async Task<IActionResult> Get(string token)
    {
        if (!ValidToken(token)) return NotFound(new { error = "Không tìm thấy quà tặng" });
        var order = await _db.Orders.AsNoTracking().Include(o => o.Details)
            .FirstOrDefaultAsync(o => o.IsGift && o.GiftToken == token);
        if (order == null) return NotFound(new { error = "Không tìm thấy quà tặng" });

        var gameIds = order.Details.Select(d => d.GameId).Distinct().ToList();
        var media = await _db.GameMedias.AsNoTracking()
            .Where(m => gameIds.Contains(m.GameId) && !m.ObjectKey.EndsWith(".mp4") && !m.ObjectKey.EndsWith(".webm"))
            .OrderByDescending(m => m.IsPrimary).ThenBy(m => m.DisplayOrder)
            .Select(m => new { m.GameId, m.ObjectKey })
            .ToListAsync();

        var items = new List<object>();
        foreach (var d in order.Details)
        {
            string? cover = null;
            var key = media.FirstOrDefault(m => m.GameId == d.GameId)?.ObjectKey;
            if (key != null)
            {
                try { cover = await _minio.GetPresignedUrlAsync(LuckySpinRules.GameBucket, key); } catch { }
            }
            items.Add(new { d.GameId, d.GameName, d.EditionName, CoverUrl = cover });
        }

        var claimed = order.GiftClaimedAt != null;
        return Ok(new
        {
            FromName = order.GiftFromName,
            RecipientName = order.GiftRecipientName,
            Message = order.GiftMessage,
            Items = items,
            Status = order.Status.ToString(),
            Paid = order.Status is OrderStatus.Verifying or OrderStatus.Installing or OrderStatus.Completed or OrderStatus.ActionRequired,
            Claimed = claimed,
            ClaimedAt = order.GiftClaimedAt,
            // Only a hint of the account already entered — never the full email or password.
            XboxEmailHint = claimed ? MaskEmail(order.CustomerXboxEmail) : null,
            CanClaim = GiftRules.CanClaim(order.Status, claimed),
            CreatedAt = order.CreatedAt,
        });
    }

    // POST /api/gifts/{token}/claim
    [HttpPost("{token}/claim")]
    [EnableRateLimiting(CustomerAuthRules.RateLimitPolicy)]
    public async Task<IActionResult> Claim(string token, [FromBody] GiftClaimRequest req)
    {
        if (!ValidToken(token)) return NotFound(new { error = "Không tìm thấy quà tặng" });
        var email = req.XboxEmail?.Trim() ?? "";
        if (email.Length is < 5 or > 200 || !email.Contains('@'))
            return BadRequest(new { error = "Email tài khoản Xbox không hợp lệ" });
        if (string.IsNullOrWhiteSpace(req.XboxPassword) || req.XboxPassword.Length > 200)
            return BadRequest(new { error = "Nhập mật khẩu tài khoản Xbox" });
        var phone = GiftRules.Clean(req.Phone, 20);

        var order = await _db.Orders.FirstOrDefaultAsync(o => o.IsGift && o.GiftToken == token);
        if (order == null) return NotFound(new { error = "Không tìm thấy quà tặng" });
        if (!GiftRules.CanClaim(order.Status, order.GiftClaimedAt != null))
            return BadRequest(new { error = order.Status == OrderStatus.Cancelled ? "Đơn quà tặng này đã bị hủy" : "Quà đã được nhận và đang được xử lý" });

        var protector = _dataProtection.CreateProtector("XboxPassword");
        order.CustomerXboxEmail = email;
        order.CustomerXboxPasswordEncrypted = Convert.ToBase64String(protector.Protect(System.Text.Encoding.UTF8.GetBytes(req.XboxPassword)));
        order.GiftRecipientPhone = phone;
        var firstClaim = order.GiftClaimedAt == null;
        order.GiftClaimedAt = DateTime.UtcNow;
        if (order.Status == OrderStatus.ActionRequired) order.Status = OrderStatus.Verifying;
        order.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        var scopes = HttpContext.RequestServices.GetRequiredService<IServiceScopeFactory>();
        TelegramOrderNotifier.RefreshInBackground(scopes, order.Id, _logger);
        TelegramOrderNotifier.NotifyInBackground(scopes, order.Id,
            firstClaim ? "🎁 Người nhận quà đã nhập TK Xbox" : "🎁 Người nhận quà đã CẬP NHẬT TK Xbox", log: _logger);

        if (firstClaim && !string.IsNullOrEmpty(order.CustomerId))
        {
            try
            {
                await _notifications.AddAsync(order.CustomerId, "order",
                    $"🎁 {order.GiftRecipientName ?? "Người nhận"} đã nhận quà",
                    $"Đơn {order.OrderCode}: người nhận đã nhập tài khoản Xbox. Moxic sẽ cài game sau khi xác nhận thanh toán.",
                    $"/account/orders/{order.OrderCode}");
            }
            catch (Exception ex) { _logger.LogWarning(ex, "Gift claim notification failed for {code}", order.OrderCode); }
        }

        return Ok(new { message = "Đã nhận quà! Moxic sẽ cài game vào tài khoản của bạn sớm nhất." });
    }

    private static string MaskEmail(string email)
    {
        var at = email.IndexOf('@');
        if (at <= 0) return "***";
        var name = email[..at];
        return (name.Length <= 2 ? name[..1] : name[..2]) + "***" + email[at..];
    }
}
