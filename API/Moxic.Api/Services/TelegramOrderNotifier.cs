using System.Globalization;
using System.Text;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Moxic.Core.Entities;
using Moxic.Core.Interfaces;
using Moxic.Infrastructure.Data;
using Moxic.Shared.Enums;

namespace Moxic.Api.Services;

/// <summary>
/// Order cards in the admins' Telegram: posted on new order / payment proof / gift claim, with action
/// buttons; every posted card is edited in place whenever the order changes (from Telegram or the admin panel).
/// Callback data: "o{op}:{orderId:N}" — ops: v Verifying, i Installing, c Completed, a ActionRequired,
/// x ask-cancel, X confirm-cancel, r refresh, k show Xbox credentials (self-destructing message).
/// </summary>
public class TelegramOrderNotifier
{
    private static readonly CultureInfo Vi = CultureInfo.GetCultureInfo("vi-VN");
    private static readonly TimeSpan VnOffset = TimeSpan.FromHours(7);

    private readonly MoxicDbContext _db;
    private readonly TelegramBot _bot;
    private readonly IMinioService _minio;
    private readonly IConfiguration _config;
    private readonly IDataProtectionProvider _dp;
    private readonly ILogger<TelegramOrderNotifier> _logger;

    public TelegramOrderNotifier(MoxicDbContext db, TelegramBot bot, IMinioService minio, IConfiguration config, IDataProtectionProvider dp, ILogger<TelegramOrderNotifier> logger)
    {
        _db = db;
        _bot = bot;
        _minio = minio;
        _config = config;
        _dp = dp;
        _logger = logger;
    }

    // ---- fire-and-forget helpers (callers' request scope may end before Telegram answers) ----

    public static void NotifyInBackground(IServiceScopeFactory scopes, Guid orderId, string headline, bool withProof = false, ILogger? log = null) =>
        _ = Task.Run(async () =>
        {
            try
            {
                using var scope = scopes.CreateScope();
                await scope.ServiceProvider.GetRequiredService<TelegramOrderNotifier>().NotifyAsync(orderId, headline, withProof);
            }
            catch (Exception ex) { log?.LogWarning(ex, "Telegram order notify failed"); }
        });

    public static void RefreshInBackground(IServiceScopeFactory scopes, Guid orderId, ILogger? log = null) =>
        _ = Task.Run(async () =>
        {
            try
            {
                using var scope = scopes.CreateScope();
                await scope.ServiceProvider.GetRequiredService<TelegramOrderNotifier>().RefreshAsync(orderId);
            }
            catch (Exception ex) { log?.LogWarning(ex, "Telegram order refresh failed"); }
        });

    public static string StatusLabel(OrderStatus s) => s switch
    {
        OrderStatus.Pending => "🟡 Chờ thanh toán",
        OrderStatus.AwaitingConfirmation => "🟠 Đã gửi ảnh CK — chờ duyệt",
        OrderStatus.Verifying => "🔵 Đã nhận tiền — chờ cài",
        OrderStatus.Installing => "🔧 Đang cài đặt",
        OrderStatus.ActionRequired => "⚠️ Cần khách cập nhật TK Xbox",
        OrderStatus.Completed => "🎉 Hoàn tất",
        OrderStatus.Cancelled => "❌ Đã hủy",
        _ => s.ToString(),
    };

    private static string Vnd(decimal v) => v.ToString("N0", Vi) + "đ";
    private static string H(string? s) => TelegramBot.Html(s);

    private async Task<Order?> LoadAsync(Guid id) =>
        await _db.Orders.AsNoTracking().Include(o => o.Details).FirstOrDefaultAsync(o => o.Id == id);

    public string CardText(Order o, string? headline)
    {
        var sb = new StringBuilder();
        if (headline != null) sb.Append($"<b>{H(headline)}</b>\n");
        sb.Append($"📦 <code>{H(o.OrderCode)}</code>\n");
        sb.Append($"{StatusLabel(o.Status)}\n");
        sb.Append($"💰 <b>{Vnd(o.TotalAmount)}</b>");
        if (o.DiscountAmount > 0) sb.Append($" (giảm {Vnd(o.DiscountAmount)}{(o.CouponCode != null ? $", mã {H(o.CouponCode)}" : "")})");
        sb.Append($" · {(o.PaymentMethod == PaymentMethod.Crypto ? "Crypto" : "Chuyển khoản")}\n");
        foreach (var d in o.Details)
            sb.Append($"🎮 {H(d.GameName)}{(d.EditionName != null && !d.GameName.Contains(d.EditionName) ? $" ({H(d.EditionName)})" : "")} — {Vnd(d.Price)}\n");
        sb.Append($"📞 <code>{H(o.CustomerPhone)}</code>");
        if (!string.IsNullOrWhiteSpace(o.CustomerZalo)) sb.Append($" · Zalo/FB: {H(o.CustomerZalo)}");
        sb.Append('\n');
        if (o.IsGift)
        {
            sb.Append($"🎁 Quà cho <b>{H(o.GiftRecipientName ?? "?")}</b>");
            sb.Append(o.GiftClaimedAt != null
                ? $" — đã nhận{(o.GiftRecipientPhone != null ? $" · SĐT người nhận <code>{H(o.GiftRecipientPhone)}</code>" : "")}\n"
                : " — <i>chưa mở quà (chưa có TK Xbox)</i>\n");
        }
        if (!string.IsNullOrEmpty(o.CustomerXboxEmail)) sb.Append($"🎮 Xbox: <code>{H(o.CustomerXboxEmail)}</code>\n");
        if (o.Status == OrderStatus.Cancelled && o.CancellationReason != null) sb.Append($"Lý do hủy: {H(o.CancellationReason)}\n");
        sb.Append($"🕒 {(o.CreatedAt + VnOffset):dd/MM HH:mm}");
        if (o.UpdatedAt - o.CreatedAt > TimeSpan.FromMinutes(1)) sb.Append($" · cập nhật {(o.UpdatedAt + VnOffset):dd/MM HH:mm}");
        return sb.ToString();
    }

    public object Buttons(Order o, bool confirmCancel = false)
    {
        var id = o.Id.ToString("N");
        var rows = new List<List<(string, string?, string?)>>();
        if (confirmCancel)
        {
            rows.Add([("⚠️ Xác nhận HỦY đơn", $"oX:{id}", null), ("↩️ Không", $"or:{id}", null)]);
            return TelegramBot.Keyboard(rows);
        }
        switch (o.Status)
        {
            case OrderStatus.Pending:
            case OrderStatus.AwaitingConfirmation:
                rows.Add([("✅ Đã nhận tiền", $"ov:{id}", null), ("❌ Hủy", $"ox:{id}", null)]);
                break;
            case OrderStatus.Verifying:
                rows.Add([("🔧 Bắt đầu cài", $"oi:{id}", null), ("⚠️ Sai TK Xbox", $"oa:{id}", null)]);
                rows.Add([("❌ Hủy", $"ox:{id}", null)]);
                break;
            case OrderStatus.Installing:
                rows.Add([("🎉 Hoàn tất", $"oc:{id}", null), ("↩️ Về chờ cài", $"ov:{id}", null)]);
                break;
            case OrderStatus.ActionRequired:
                rows.Add([("✅ Khách đã cập nhật", $"ov:{id}", null), ("❌ Hủy", $"ox:{id}", null)]);
                break;
        }
        var extra = new List<(string, string?, string?)>();
        if (!string.IsNullOrEmpty(o.CustomerXboxPasswordEncrypted) && o.Status is not (OrderStatus.Completed or OrderStatus.Cancelled))
            extra.Add(("🔑 Xem TK Xbox", $"ok:{id}", null));
        extra.Add(("🔄", $"or:{id}", null));
        rows.Add(extra);
        return TelegramBot.Keyboard(rows);
    }

    /// <summary>Posts a fresh card to every linked admin chat.</summary>
    public async Task NotifyAsync(Guid orderId, string headline, bool withProof)
    {
        if (!_bot.Enabled) return;
        var admins = await _db.TelegramAdminChats.AsNoTracking().Select(a => new { a.ChatId, a.OrdersTopicId }).ToListAsync();
        if (admins.Count == 0) return;
        var o = await LoadAsync(orderId);
        if (o == null) return;

        string? proofUrl = null;
        if (withProof && o.PaymentProofObjectKey != null)
        {
            try { proofUrl = await _minio.GetPresignedUrlAsync(_config.GetValue<string>("Minio:GamesBucket")!, o.PaymentProofObjectKey, 1); }
            catch (Exception ex) { _logger.LogWarning(ex, "Proof URL failed"); }
        }

        var text = CardText(o, headline);
        var markup = Buttons(o);
        foreach (var a in admins)
        {
            var mid = await _bot.SendAsync(a.ChatId, text, markup: markup, threadId: a.OrdersTopicId);
            if (mid == null) continue;
            _db.TelegramOrderMessages.Add(new TelegramOrderMessage { ChatId = a.ChatId, MessageId = mid.Value, OrderId = o.Id, CreatedAt = DateTime.UtcNow });
            if (proofUrl != null)
                await _bot.SendPhotoAsync(a.ChatId, proofUrl, $"📸 Ảnh chuyển khoản <code>{H(o.OrderCode)}</code>", mid, threadId: a.OrdersTopicId);
        }
        await _db.SaveChangesAsync();
    }

    /// <summary>Re-renders every card posted for this order.</summary>
    public async Task RefreshAsync(Guid orderId)
    {
        if (!_bot.Enabled) return;
        var cards = await _db.TelegramOrderMessages.AsNoTracking().Where(m => m.OrderId == orderId)
            .OrderByDescending(m => m.CreatedAt).Take(20).ToListAsync();
        if (cards.Count == 0) return;
        var o = await LoadAsync(orderId);
        if (o == null) return;
        var text = CardText(o, null);
        var markup = Buttons(o);
        foreach (var c in cards) await _bot.EditAsync(c.ChatId, c.MessageId, text, markup);
    }

    /// <summary>Sends the order card to one chat (for /don and /cho) and tracks it.</summary>
    public async Task SendCardAsync(long chatId, Order o, long? threadId = null)
    {
        var mid = await _bot.SendAsync(chatId, CardText(o, null), markup: Buttons(o), threadId: threadId);
        if (mid == null) return;
        _db.TelegramOrderMessages.Add(new TelegramOrderMessage { ChatId = chatId, MessageId = mid.Value, OrderId = o.Id, CreatedAt = DateTime.UtcNow });
        await _db.SaveChangesAsync();
    }

    /// <summary>
    /// Xbox credentials as a spoiler message that deletes itself after 2 minutes. Sent privately to the
    /// admin who pressed the button when possible (they must have opened the bot once); otherwise in the group.
    /// Returns true when it went out as a private message.
    /// </summary>
    public async Task<bool> SendCredentialsAsync(long chatId, Order o, long replyTo, long? userId = null, long? threadId = null)
    {
        string password;
        try
        {
            password = System.Text.Encoding.UTF8.GetString(_dp.CreateProtector("XboxPassword").Unprotect(Convert.FromBase64String(o.CustomerXboxPasswordEncrypted)));
        }
        catch
        {
            password = "*** lỗi giải mã ***";
        }
        var html = $"🔑 <code>{H(o.OrderCode)}</code>\nEmail: <code>{H(o.CustomerXboxEmail)}</code>\nMật khẩu: <tg-spoiler><code>{H(password)}</code></tg-spoiler>\n\n<i>Tin này tự xóa sau 2 phút.</i>";
        var target = chatId;
        long? mid = null;
        var privately = false;
        if (userId != null && userId != chatId)
        {
            mid = await _bot.SendAsync(userId.Value, html);
            if (mid != null)
            {
                target = userId.Value;
                privately = true;
            }
        }
        mid ??= await _bot.SendAsync(chatId, html, replyTo, threadId: threadId);
        _logger.LogInformation("Xbox credentials of {Order} revealed in Telegram chat {Chat}", o.OrderCode, target);
        if (mid != null)
            _ = Task.Run(async () =>
            {
                await Task.Delay(TimeSpan.FromMinutes(2));
                await _bot.DeleteAsync(target, mid.Value);
            });
        return privately;
    }

    public Task<Order?> FindAsync(Guid id) => LoadAsync(id);
}
