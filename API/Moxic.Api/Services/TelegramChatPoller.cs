using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Moxic.Core.Entities;
using Moxic.Infrastructure.Data;
using Moxic.Shared.Enums;

namespace Moxic.Api.Services;

/// <summary>
/// Long-polls the Telegram bot. Linked admin chats answer customers by replying to a forwarded
/// message (or "/r CODE text"); "/link CODE" links a new admin chat using a code from the admin panel.
/// </summary>
public class TelegramChatPoller : BackgroundService
{
    public static string LinkCacheKey(string code) => $"tg-link:{code}";

    private static readonly System.Text.RegularExpressions.Regex OrderCodeRegex =
        new(@"MOXIC-\d{8}-[A-Z0-9]{5}", System.Text.RegularExpressions.RegexOptions.IgnoreCase);

    private readonly TelegramBot _bot;
    private readonly IServiceScopeFactory _scopes;
    private readonly IMemoryCache _cache;
    private readonly ILogger<TelegramChatPoller> _logger;

    public TelegramChatPoller(TelegramBot bot, IServiceScopeFactory scopes, IMemoryCache cache, ILogger<TelegramChatPoller> logger)
    {
        _bot = bot;
        _scopes = scopes;
        _cache = cache;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        if (!_bot.Enabled)
        {
            _logger.LogInformation("Telegram chat disabled (no Telegram:BotToken)");
            return;
        }
        await Task.Delay(TimeSpan.FromSeconds(5), ct);
        try { await _bot.DeleteWebhookAsync(ct); } catch { /* polling still works if no webhook */ }

        long offset = 0;
        while (!ct.IsCancellationRequested)
        {
            try
            {
                var updates = await _bot.GetUpdatesAsync(offset, 30, ct);
                if (updates == null)
                {
                    await Task.Delay(TimeSpan.FromSeconds(10), ct);
                    continue;
                }
                foreach (var u in updates)
                {
                    offset = Math.Max(offset, u!["update_id"]!.GetValue<long>() + 1);
                    try
                    {
                        if (u["message"] is { } msg) await HandleAsync(msg, ct);
                        else if (u["callback_query"] is { } cb) await HandleCallbackAsync(cb, ct);
                    }
                    catch (Exception ex) { _logger.LogWarning(ex, "Telegram update handling failed"); }
                }
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { break; }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Telegram polling error");
                await Task.Delay(TimeSpan.FromSeconds(10), ct);
            }
        }
    }

    private async Task HandleAsync(JsonNode msg, CancellationToken ct)
    {
        var chatId = msg["chat"]!["id"]!.GetValue<long>();
        var text = msg["text"]?.GetValue<string>()?.Trim();
        var from = msg["from"];
        var fromName = string.Join(" ", new[] { from?["first_name"]?.GetValue<string>(), from?["last_name"]?.GetValue<string>() }.Where(s => !string.IsNullOrEmpty(s)));
        if (string.IsNullOrEmpty(fromName)) fromName = "Admin";

        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MoxicDbContext>();
        var chat = scope.ServiceProvider.GetRequiredService<ChatService>();
        var linked = await db.TelegramAdminChats.AnyAsync(a => a.ChatId == chatId, ct);

        // /link CODE — code generated in the admin panel (10 min)
        if (text != null && text.StartsWith("/link", StringComparison.OrdinalIgnoreCase))
        {
            var code = text[5..].Trim().ToUpperInvariant();
            if (code.Length > 0 && _cache.TryGetValue(LinkCacheKey(code), out _))
            {
                _cache.Remove(LinkCacheKey(code));
                if (!linked)
                {
                    db.TelegramAdminChats.Add(new TelegramAdminChat { ChatId = chatId, Name = ChatService.Clean(fromName, 100), LinkedAt = DateTime.UtcNow });
                    await db.SaveChangesAsync(ct);
                }
                await _bot.SendAsync(chatId, "✅ Đã liên kết! Tin nhắn chat của khách trên moxic.co sẽ được gửi về đây.\nBấm <b>Reply</b> vào tin của khách để trả lời.", ct: ct);
            }
            else await _bot.SendAsync(chatId, "❌ Mã liên kết không đúng hoặc đã hết hạn. Tạo mã mới trong trang admin → Chat.", ct: ct);
            return;
        }

        if (!linked)
        {
            await _bot.SendAsync(chatId, "👋 Đây là bot hỗ trợ của <b>Moxic GameStore</b>.\nCần hỗ trợ? Chat với shop tại https://moxic.co", ct: ct);
            return;
        }

        if (string.IsNullOrEmpty(text))
        {
            await _bot.SendAsync(chatId, "Hiện chỉ hỗ trợ trả lời bằng chữ.", ct: ct);
            return;
        }
        if (text.StartsWith("/start") || text.StartsWith("/help"))
        {
            await _bot.SendAsync(chatId,
                "<b>Chat khách:</b> bấm <b>Reply</b> vào tin của khách để trả lời, hoặc <code>/r MÃ nội dung</code>.\n" +
                "<b>Đơn hàng:</b>\n/cho — các đơn đang cần xử lý\n/don MOXIC-… — xem 1 đơn (hoặc gửi thẳng mã đơn)\nBấm nút dưới mỗi đơn để đổi trạng thái.", ct: ct);
            return;
        }

        var replyTo = msg["reply_to_message"]?["message_id"]?.GetValue<long>();
        var orders = scope.ServiceProvider.GetRequiredService<TelegramOrderNotifier>();
        if (text.StartsWith("/cho", StringComparison.OrdinalIgnoreCase))
        {
            var open = new[] { OrderStatus.AwaitingConfirmation, OrderStatus.Verifying, OrderStatus.ActionRequired, OrderStatus.Installing, OrderStatus.Pending };
            var since = DateTime.UtcNow.AddDays(-3);
            var list = await db.Orders.AsNoTracking().Include(o => o.Details)
                .Where(o => open.Contains(o.Status) && (o.Status != OrderStatus.Pending || o.CreatedAt >= since))
                .OrderBy(o => o.Status == OrderStatus.Pending).ThenBy(o => o.CreatedAt).Take(10).ToListAsync(ct);
            if (list.Count == 0) await _bot.SendAsync(chatId, "✨ Không có đơn nào cần xử lý.", ct: ct);
            foreach (var o in list) await orders.SendCardAsync(chatId, o);
            return;
        }
        var codeMatch = OrderCodeRegex.Match(text);
        if (replyTo == null && (text.StartsWith("/don", StringComparison.OrdinalIgnoreCase) || (codeMatch.Success && codeMatch.Length == text.Length)))
        {
            if (!codeMatch.Success)
            {
                await _bot.SendAsync(chatId, "Cú pháp: <code>/don MOXIC-20261104-ABCDE</code>", ct: ct);
                return;
            }
            var oc = codeMatch.Value.ToUpperInvariant();
            var found = await db.Orders.AsNoTracking().Include(x => x.Details).FirstOrDefaultAsync(x => x.OrderCode == oc, ct);
            if (found == null) await _bot.SendAsync(chatId, $"Không tìm thấy đơn {TelegramBot.Html(oc)}", ct: ct);
            else await orders.SendCardAsync(chatId, found);
            return;
        }

        ChatThread? thread = null;
        var body = text;
        if (replyTo != null)
        {
            var threadId = await db.ChatTelegramRefs.Where(r => r.TelegramChatId == chatId && r.TelegramMessageId == replyTo)
                .Select(r => (Guid?)r.ThreadId).FirstOrDefaultAsync(ct);
            if (threadId != null) thread = await db.ChatThreads.FirstOrDefaultAsync(t => t.Id == threadId, ct);
        }
        else if (text.StartsWith("/r ", StringComparison.OrdinalIgnoreCase))
        {
            var parts = text[3..].Trim().Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length == 2)
            {
                var code = parts[0].TrimStart('#').ToUpperInvariant();
                thread = await db.ChatThreads.FirstOrDefaultAsync(t => t.Code == code, ct);
                body = parts[1];
            }
        }

        if (thread == null)
        {
            await _bot.SendAsync(chatId, "⚠️ Không biết gửi cho khách nào. Hãy <b>Reply</b> đúng tin nhắn của khách, hoặc dùng <code>/r MÃ nội dung</code>.", ct: ct);
            return;
        }

        body = body.Length > ChatService.MaxText ? body[..ChatService.MaxText] : body;
        await chat.AddAdminMessageAsync(thread, body, "telegram");
        var mid = msg["message_id"]!.GetValue<long>();
        // Map the admin's own message too, so replying to it keeps the conversation going.
        db.ChatTelegramRefs.Add(new ChatTelegramRef { TelegramChatId = chatId, TelegramMessageId = mid, ThreadId = thread.Id, CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync(ct);
        await chat.EchoAdminReplyAsync(thread, body, chatId, fromName);
    }

    /// <summary>Order card buttons. Only linked admin chats may act.</summary>
    private async Task HandleCallbackAsync(JsonNode cb, CancellationToken ct)
    {
        var cbId = cb["id"]!.GetValue<string>();
        var data = cb["data"]?.GetValue<string>() ?? "";
        var message = cb["message"];
        var chatId = message?["chat"]?["id"]?.GetValue<long>();
        var messageId = message?["message_id"]?.GetValue<long>();
        var who = cb["from"]?["first_name"]?.GetValue<string>() ?? "Admin";

        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MoxicDbContext>();
        if (chatId == null || messageId == null || !await db.TelegramAdminChats.AnyAsync(a => a.ChatId == chatId, ct))
        {
            await _bot.AnswerCallbackAsync(cbId, "Không có quyền", true, ct);
            return;
        }
        if (data.Length < 4 || data[0] != 'o' || data[2] != ':' || !Guid.TryParseExact(data[3..], "N", out var orderId))
        {
            await _bot.AnswerCallbackAsync(cbId, null, ct: ct);
            return;
        }

        var cards = scope.ServiceProvider.GetRequiredService<TelegramOrderNotifier>();
        var order = await cards.FindAsync(orderId);
        if (order == null)
        {
            await _bot.AnswerCallbackAsync(cbId, "Không tìm thấy đơn", true, ct);
            return;
        }

        var op = data[1];
        switch (op)
        {
            case 'r':
                await _bot.EditAsync(chatId.Value, messageId.Value, cards.CardText(order, null), cards.Buttons(order), ct);
                await _bot.AnswerCallbackAsync(cbId, "Đã làm mới", ct: ct);
                return;
            case 'x':
                await _bot.EditKeyboardAsync(chatId.Value, messageId.Value, cards.Buttons(order, confirmCancel: true), ct);
                await _bot.AnswerCallbackAsync(cbId, "Bấm xác nhận để hủy đơn", ct: ct);
                return;
            case 'k':
                await cards.SendCredentialsAsync(chatId.Value, order, messageId.Value);
                await _bot.AnswerCallbackAsync(cbId, null, ct: ct);
                return;
        }

        OrderStatus? target = op switch
        {
            'v' => OrderStatus.Verifying,
            'i' => OrderStatus.Installing,
            'c' => OrderStatus.Completed,
            'a' => OrderStatus.ActionRequired,
            'X' => OrderStatus.Cancelled,
            _ => null,
        };
        if (target == null)
        {
            await _bot.AnswerCallbackAsync(cbId, null, ct: ct);
            return;
        }

        var reason = target switch
        {
            OrderStatus.Cancelled => "Đơn hàng đã bị hủy bởi Moxic. Liên hệ shop nếu bạn cần hỗ trợ.",
            OrderStatus.ActionRequired => "Thông tin tài khoản Xbox chưa chính xác — vui lòng kiểm tra và cập nhật.",
            _ => null,
        };
        var statuses = scope.ServiceProvider.GetRequiredService<OrderStatusService>();
        var r = await statuses.ChangeAsync(orderId, target.Value, reason);
        if (!r.Ok)
        {
            await _bot.AnswerCallbackAsync(cbId, r.Error, true, ct);
            // The card may be stale (changed elsewhere) — show the current state.
            var fresh = await cards.FindAsync(orderId);
            if (fresh != null) await _bot.EditAsync(chatId.Value, messageId.Value, cards.CardText(fresh, null), cards.Buttons(fresh), ct);
            return;
        }
        _logger.LogInformation("Order {Order} → {Status} by {Who} via Telegram", order.OrderCode, target, who);
        await _bot.AnswerCallbackAsync(cbId, $"{TelegramOrderNotifier.StatusLabel(target.Value)} ✓", ct: ct);
        // ChangeAsync already refreshes every card in the background; also update this one right away.
        var updated = await cards.FindAsync(orderId);
        if (updated != null) await _bot.EditAsync(chatId.Value, messageId.Value, cards.CardText(updated, $"bởi {who}"), cards.Buttons(updated), ct);
    }
}
