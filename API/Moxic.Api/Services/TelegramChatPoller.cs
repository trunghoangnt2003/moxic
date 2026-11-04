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

    /// <summary>How long a customer tab stays after /exit.</summary>
    public static readonly TimeSpan TabCloseDelay = TimeSpan.FromHours(3);

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
        var chatNode = msg["chat"]!;
        var chatId = chatNode["id"]!.GetValue<long>();
        var isPrivate = chatNode["type"]?.GetValue<string>() == "private";
        var isForum = chatNode["is_forum"]?.GetValue<bool>() == true;
        var chatTitle = chatNode["title"]?.GetValue<string>();
        var text = msg["text"]?.GetValue<string>()?.Trim();
        var from = msg["from"];
        var fromName = string.Join(" ", new[] { from?["first_name"]?.GetValue<string>(), from?["last_name"]?.GetValue<string>() }.Where(s => !string.IsNullOrEmpty(s)));
        if (string.IsNullOrEmpty(fromName)) fromName = "Admin";

        // Topic the message was posted in (forum groups); bot answers land in the same topic.
        long? topic = msg["is_topic_message"]?.GetValue<bool>() == true ? msg["message_thread_id"]?.GetValue<long>() : null;
        Task<long?> Say(string html) => _bot.SendAsync(chatId, html, ct: ct, threadId: topic);

        // In groups commands may arrive as "/cmd@BotName args".
        if (text != null && text.StartsWith('/'))
        {
            var at = text.IndexOf('@');
            var sp = text.IndexOf(' ');
            if (at > 0 && (sp < 0 || at < sp)) text = text[..at] + (sp > 0 ? text[sp..] : "");
        }

        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MoxicDbContext>();
        var chat = scope.ServiceProvider.GetRequiredService<ChatService>();

        // A group upgraded to a supergroup (e.g. when Topics are turned on) gets a new id — follow it.
        var migrateTo = msg["migrate_to_chat_id"]?.GetValue<long>();
        if (migrateTo != null)
        {
            var old = await db.TelegramAdminChats.FirstOrDefaultAsync(a => a.ChatId == chatId, ct);
            if (old != null && !await db.TelegramAdminChats.AnyAsync(a => a.ChatId == migrateTo, ct))
            {
                db.TelegramAdminChats.Remove(old);
                db.TelegramAdminChats.Add(new TelegramAdminChat { ChatId = migrateTo.Value, Name = old.Name, LinkedAt = old.LinkedAt });
                await db.SaveChangesAsync(ct);
                _logger.LogInformation("Telegram admin chat migrated {Old} → {New}", chatId, migrateTo);
            }
            return;
        }

        var link = await db.TelegramAdminChats.FirstOrDefaultAsync(a => a.ChatId == chatId, ct);

        // /link CODE — code generated in the admin panel (10 min)
        if (text != null && text.StartsWith("/link", StringComparison.OrdinalIgnoreCase))
        {
            var code = text[5..].Trim().ToUpperInvariant();
            if (code.Length > 0 && _cache.TryGetValue(LinkCacheKey(code), out _))
            {
                _cache.Remove(LinkCacheKey(code));
                if (link == null)
                {
                    link = new TelegramAdminChat { ChatId = chatId, Name = ChatService.Clean(isPrivate ? fromName : chatTitle ?? fromName, 100), LinkedAt = DateTime.UtcNow };
                    db.TelegramAdminChats.Add(link);
                    await db.SaveChangesAsync(ct);
                }
                if (isPrivate)
                    await Say("✅ Đã liên kết! Tin nhắn khách và đơn hàng mới sẽ được gửi về đây.\nGõ /help để xem hướng dẫn.");
                else
                    await SetupTopicsAsync(db, link, isForum, ct);
            }
            else await Say("❌ Mã liên kết không đúng hoặc đã hết hạn. Tạo mã mới trong trang admin → Chat → Telegram.");
            return;
        }

        if (link == null)
        {
            // Only answer strangers in private; stay quiet in random groups.
            if (isPrivate)
                await Say("👋 Đây là bot hỗ trợ của <b>Moxic GameStore</b>.\nCần hỗ trợ? Chat với shop tại https://moxic.co");
            return;
        }

        if (string.IsNullOrEmpty(text))
        {
            if (isPrivate) await Say("Hiện chỉ hỗ trợ trả lời bằng chữ.");
            return;
        }
        if (text.StartsWith("/setup", StringComparison.OrdinalIgnoreCase))
        {
            if (isPrivate) await Say("Lệnh /setup dùng trong nhóm để tạo các tab Đơn hàng / Tin nhắn.");
            else await SetupTopicsAsync(db, link, isForum, ct);
            return;
        }
        if (text.StartsWith("/start") || text.StartsWith("/help"))
        {
            await Say(
                "<b>💬 Tin nhắn khách:</b> mỗi khách có tab riêng (bot tự tạo khi khách nhắn) — gõ thẳng trong tab để trả lời, /exit khi xong. Ngoài tab: Reply tin của khách hoặc <code>/r MÃ nội dung</code>.\n" +
                "<b>🛒 Đơn hàng:</b>\n/cho — các đơn đang cần xử lý\n/don MOXIC-… — xem 1 đơn\nBấm nút dưới mỗi đơn để đổi trạng thái. 🔑 gửi TK Xbox riêng cho người bấm (cần mở chat riêng với bot và bấm Start 1 lần).\n" +
                "<b>Nhóm:</b> /setup — tạo lại các tab Đơn hàng / Tin nhắn.");
            return;
        }

        var replyTo = msg["reply_to_message"]?["message_id"]?.GetValue<long>();
        // In a topic, an ordinary message "replies" to the topic's root message — that's not a real reply.
        if (replyTo != null && topic != null && replyTo == topic) replyTo = null;

        var orders = scope.ServiceProvider.GetRequiredService<TelegramOrderNotifier>();
        if (text.StartsWith("/cho", StringComparison.OrdinalIgnoreCase))
        {
            var open = new[] { OrderStatus.AwaitingConfirmation, OrderStatus.Verifying, OrderStatus.ActionRequired, OrderStatus.Installing, OrderStatus.Pending };
            var since = DateTime.UtcNow.AddDays(-3);
            var list = await db.Orders.AsNoTracking().Include(o => o.Details)
                .Where(o => open.Contains(o.Status) && (o.Status != OrderStatus.Pending || o.CreatedAt >= since))
                .OrderBy(o => o.Status == OrderStatus.Pending).ThenBy(o => o.CreatedAt).Take(10).ToListAsync(ct);
            if (list.Count == 0) await Say("✨ Không có đơn nào cần xử lý.");
            foreach (var o in list) await orders.SendCardAsync(chatId, o, topic);
            return;
        }
        var codeMatch = OrderCodeRegex.Match(text);
        if (replyTo == null && (text.StartsWith("/don", StringComparison.OrdinalIgnoreCase) || (codeMatch.Success && codeMatch.Length == text.Length)))
        {
            if (!codeMatch.Success)
            {
                await Say("Cú pháp: <code>/don MOXIC-20261104-ABCDE</code>");
                return;
            }
            var oc = codeMatch.Value.ToUpperInvariant();
            var found = await db.Orders.AsNoTracking().Include(x => x.Details).FirstOrDefaultAsync(x => x.OrderCode == oc, ct);
            if (found == null) await Say($"Không tìm thấy đơn {TelegramBot.Html(oc)}");
            else await orders.SendCardAsync(chatId, found, topic);
            return;
        }

        // Inside a customer's own tab: every message goes to that customer; /exit closes the tab.
        ChatThread? tabThread = topic == null ? null
            : await db.ChatThreads.FirstOrDefaultAsync(t => t.TgTopicChatId == chatId && t.TgTopicId == topic, ct);
        if (tabThread != null && text.StartsWith("/exit", StringComparison.OrdinalIgnoreCase))
        {
            tabThread.TgTopicCloseAt = DateTime.UtcNow.Add(TabCloseDelay);
            await db.SaveChangesAsync(ct);
            await Say($"👋 Đã kết thúc hỗ trợ. Tab này tự xóa sau {TabCloseDelay.TotalHours:0} tiếng. Nếu khách nhắn lại trước đó, tab sẽ mở lại.");
            return;
        }

        // /tab — move a conversation into its own tab (reply to a customer message, or /tab CODE)
        if (text.StartsWith("/tab", StringComparison.OrdinalIgnoreCase))
        {
            ChatThread? target = null;
            var arg = text[4..].Trim().TrimStart('#').ToUpperInvariant();
            if (arg.Length > 0) target = await db.ChatThreads.FirstOrDefaultAsync(t => t.Code == arg, ct);
            else if (replyTo != null)
            {
                var tid = await db.ChatTelegramRefs.Where(r => r.TelegramChatId == chatId && r.TelegramMessageId == replyTo)
                    .Select(r => (Guid?)r.ThreadId).FirstOrDefaultAsync(ct);
                if (tid != null) target = await db.ChatThreads.FirstOrDefaultAsync(t => t.Id == tid, ct);
            }
            if (target == null)
            {
                await Say("Dùng: <b>Reply</b> vào tin của khách rồi gõ /tab — hoặc <code>/tab MÃ</code> (mã #XXXX trong tin).");
                return;
            }
            if (!isForum)
            {
                await Say("Nhóm cần bật <b>Chủ đề (Topics)</b> để tách tab riêng.");
                return;
            }
            await OpenTabAsync(db, chat, target, chatId, ct);
            return;
        }

        ChatThread? thread = tabThread;
        var body = text;
        if (thread != null && text.StartsWith('/') && !text.StartsWith("/r ", StringComparison.OrdinalIgnoreCase))
        {
            await Say("Lệnh không hỗ trợ trong tab khách. Gõ nội dung để trả lời khách, /exit để kết thúc.");
            return;
        }
        if (thread != null) { /* typed directly in the customer's tab */ }
        else if (replyTo != null)
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
            // Staff talk freely in group topics; only complain when it looked like an answer to a customer.
            if (isPrivate || text.StartsWith("/r", StringComparison.OrdinalIgnoreCase))
                await Say("⚠️ Không biết gửi cho khách nào. Hãy <b>Reply</b> đúng tin nhắn của khách, hoặc dùng <code>/r MÃ nội dung</code>.");
            return;
        }

        body = body.Length > ChatService.MaxText ? body[..ChatService.MaxText] : body;
        await chat.AddAdminMessageAsync(thread, body, "telegram");
        var mid = msg["message_id"]!.GetValue<long>();
        await _bot.ReactAsync(chatId, mid, "👍", ct); // "sent to the customer"
        // Map the admin's own message too, so replying to it keeps the conversation going.
        db.ChatTelegramRefs.Add(new ChatTelegramRef { TelegramChatId = chatId, TelegramMessageId = mid, ThreadId = thread.Id, CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync(ct);
        await chat.EchoAdminReplyAsync(thread, body, chatId, fromName);
    }

    /// <summary>
    /// In a group with Topics: creates "🛒 Đơn hàng" and "💬 Tin nhắn khách" tabs and routes messages there.
    /// Without Topics (or without the "Manage topics" right) everything goes to the main chat.
    /// </summary>
    private async Task SetupTopicsAsync(MoxicDbContext db, TelegramAdminChat link, bool isForum, CancellationToken ct)
    {
        if (!isForum)
        {
            link.OrdersTopicId = null;
            link.ChatTopicId = null;
            await db.SaveChangesAsync(ct);
            await _bot.SendAsync(link.ChatId,
                "✅ Đã liên kết nhóm! Đơn hàng và tin nhắn khách sẽ gửi vào đây.\n\n" +
                "💡 Muốn chia thành tab riêng (Đơn hàng / Tin nhắn): vào <b>Cài đặt nhóm → bật Chủ đề (Topics)</b>, " +
                "cho bot làm <b>Quản trị viên</b> với quyền <b>Quản lý chủ đề</b>, rồi gõ /setup.", ct: ct);
            return;
        }

        var orders = await _bot.CreateTopicAsync(link.ChatId, "🛒 Đơn hàng", 16766590, ct);
        var chats = await _bot.CreateTopicAsync(link.ChatId, "💬 Tin nhắn khách", 7322096, ct);
        if (orders == null || chats == null)
        {
            await _bot.SendAsync(link.ChatId,
                "⚠️ Bot chưa tạo được tab. Hãy cho bot làm <b>Quản trị viên</b> với quyền <b>Quản lý chủ đề</b>, rồi gõ /setup.", ct: ct);
            return;
        }
        link.OrdersTopicId = orders;
        link.ChatTopicId = chats;
        await db.SaveChangesAsync(ct);
        await _bot.SendAsync(link.ChatId, "✅ Đơn hàng mới, ảnh chuyển khoản và các nút xử lý sẽ vào tab này.\nGõ /cho để xem các đơn đang cần xử lý.", ct: ct, threadId: orders);
        await _bot.SendAsync(link.ChatId, "✅ Mỗi khách nhắn trên moxic.co sẽ có <b>tab riêng</b> (bot tự tạo). Tab này là mục lục — bấm \"mở tab\" để nhảy tới khách.\nTrong tab của khách: gõ thẳng để trả lời (bot thả 👍 khi đã gửi), /exit khi xong.", ct: ct, threadId: chats);
    }

    /// <summary>Creates "💬 Name #CODE" tab for one conversation and replays its recent history there.</summary>
    private async Task OpenTabAsync(MoxicDbContext db, ChatService chat, ChatThread t, long chatId, CancellationToken ct)
    {
        if (t.TgTopicId != null && t.TgTopicChatId == chatId)
        {
            t.TgTopicCloseAt = null;
            await db.SaveChangesAsync(ct);
            await _bot.SendAsync(chatId, "📌 Khách này đã có tab riêng — tiếp tục hỗ trợ ở đó nhé.", ct: ct, threadId: t.TgTopicId);
            return;
        }

        string? who = t.Name;
        if (string.IsNullOrWhiteSpace(who) && t.UserId != null)
            who = await db.CustomerProfiles.AsNoTracking().Where(p => p.UserId == t.UserId).Select(p => p.DisplayName).FirstOrDefaultAsync(ct);
        if (string.IsNullOrWhiteSpace(who)) who = t.Contact ?? "Khách";
        var name = $"💬 {who} #{t.Code}";
        if (name.Length > 120) name = name[..120];

        var topicId = await _bot.CreateTopicAsync(chatId, name, 9367192, ct);
        if (topicId == null)
        {
            await _bot.SendAsync(chatId, "⚠️ Không tạo được tab. Bot cần quyền <b>Quản lý chủ đề</b>.", ct: ct);
            return;
        }
        t.TgTopicChatId = chatId;
        t.TgTopicId = topicId;
        t.TgTopicCloseAt = null;
        await db.SaveChangesAsync(ct);

        var history = await db.ChatMessages.AsNoTracking().Where(m => m.ThreadId == t.Id)
            .OrderByDescending(m => m.CreatedAt).Take(15).ToListAsync(ct);
        history.Reverse();
        var sb = new System.Text.StringBuilder($"{await chat.HeaderPublicAsync(t)}\n\n<b>15 tin gần nhất:</b>\n");
        foreach (var m in history)
            sb.Append($"{(m.FromAdmin ? "🛡" : "👤")} {(m.CreatedAt + TimeSpan.FromHours(7)):dd/MM HH:mm} — {TelegramBot.Html(m.Text.Length > 300 ? m.Text[..300] + "…" : m.Text)}\n");
        sb.Append("\n✍️ Gõ thẳng trong tab này để trả lời khách (không cần Reply). /exit khi xong — tab tự xóa sau 3 tiếng; không hoạt động 24h cũng tự xóa.");
        var mid = await _bot.SendAsync(chatId, sb.ToString(), ct: ct, threadId: topicId);
        if (mid != null)
        {
            db.ChatTelegramRefs.Add(new ChatTelegramRef { TelegramChatId = chatId, TelegramMessageId = mid.Value, ThreadId = t.Id, CreatedAt = DateTime.UtcNow });
            await db.SaveChangesAsync(ct);
        }
        var link = await db.TelegramAdminChats.AsNoTracking().FirstOrDefaultAsync(a => a.ChatId == chatId, ct);
        var note = await _bot.SendAsync(chatId, $"➡️ Đã chuyển <code>#{t.Code}</code> ({TelegramBot.Html(who)}) sang tab riêng.", ct: ct, threadId: link?.ChatTopicId);
        if (note != null)
        {
            // Tracked so the 24h cleanup removes it too.
            db.ChatTelegramRefs.Add(new ChatTelegramRef { TelegramChatId = chatId, TelegramMessageId = note.Value, ThreadId = t.Id, CreatedAt = DateTime.UtcNow });
            await db.SaveChangesAsync(ct);
        }
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
            case 'd':
            {
                var rd = await scope.ServiceProvider.GetRequiredService<OrderStatusService>().MarkDownloadingAsync(orderId);
                await _bot.AnswerCallbackAsync(cbId, rd.Ok ? "⬇️ Đã báo khách: đang tải game" : rd.Error, !rd.Ok, ct);
                var fr = await cards.FindAsync(orderId);
                if (fr != null) await _bot.EditAsync(chatId.Value, messageId.Value, cards.CardText(fr, null), cards.Buttons(fr), ct);
                return;
            }
            case 'k':
            {
                var userId = cb["from"]?["id"]?.GetValue<long>();
                var cardTopic = message?["is_topic_message"]?.GetValue<bool>() == true ? message?["message_thread_id"]?.GetValue<long>() : null;
                var dm = await cards.SendCredentialsAsync(chatId.Value, order, messageId.Value, userId, cardTopic);
                await _bot.AnswerCallbackAsync(cbId,
                    dm || userId == chatId ? "Đã gửi TK Xbox (tự xóa sau 2 phút)" : "Đã gửi trong nhóm. Mở chat riêng với bot, bấm Start để lần sau nhận riêng.",
                    ct: ct);
                return;
            }
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
