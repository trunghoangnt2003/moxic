using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Moxic.Core.Entities;
using Moxic.Infrastructure.Data;

namespace Moxic.Api.Services;

/// <summary>
/// Long-polls the Telegram bot. Linked admin chats answer customers by replying to a forwarded
/// message (or "/r CODE text"); "/link CODE" links a new admin chat using a code from the admin panel.
/// </summary>
public class TelegramChatPoller : BackgroundService
{
    public static string LinkCacheKey(string code) => $"tg-link:{code}";

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
                    var msg = u["message"];
                    if (msg == null) continue;
                    try { await HandleAsync(msg, ct); }
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
            await _bot.SendAsync(chatId, "Bấm <b>Reply</b> vào tin của khách để trả lời, hoặc gõ <code>/r MÃ nội dung</code> (mã là #XXXX trong tin).", ct: ct);
            return;
        }

        ChatThread? thread = null;
        var body = text;
        var replyTo = msg["reply_to_message"]?["message_id"]?.GetValue<long>();
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
}
