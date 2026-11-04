using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Moxic.Core.Entities;
using Moxic.Infrastructure.Data;

namespace Moxic.Api.Services;

/// <summary>
/// Live chat: customer messages are stored and forwarded to every linked admin Telegram chat;
/// admins answer by replying in Telegram (TelegramChatPoller) or from the admin inbox.
/// </summary>
public class ChatService
{
    public const int MaxText = 2000;
    private const string CodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private readonly MoxicDbContext _db;
    private readonly TelegramBot _bot;
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<ChatService> _logger;

    public ChatService(MoxicDbContext db, TelegramBot bot, IServiceScopeFactory scopes, ILogger<ChatService> logger)
    {
        _db = db;
        _bot = bot;
        _scopes = scopes;
        _logger = logger;
    }

    public static string HashKey(string key) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(key))).ToLowerInvariant();
    public static string NewKey() => RandomNumberGenerator.GetString("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", 40);

    public static string? Clean(string? s, int max)
    {
        var t = s?.Trim();
        if (string.IsNullOrEmpty(t)) return null;
        return t.Length > max ? t[..max] : t;
    }

    public async Task<bool> IsLiveAsync() => _bot.Enabled && await _db.TelegramAdminChats.AnyAsync();

    public async Task<ChatThread?> FindByKeyAsync(string? key)
    {
        if (string.IsNullOrWhiteSpace(key) || key.Length > 100) return null;
        var hash = HashKey(key.Trim());
        return await _db.ChatThreads.FirstOrDefaultAsync(t => t.AccessKeyHash == hash);
    }

    /// <summary>Creates a thread and returns it with its (one-time visible) secret key.</summary>
    public async Task<(ChatThread Thread, string Key)> CreateThreadAsync(string? userId, string? name, string? contact)
    {
        var key = NewKey();
        string code;
        do code = RandomNumberGenerator.GetString(CodeAlphabet, 4);
        while (await _db.ChatThreads.AnyAsync(t => t.Code == code));
        var now = DateTime.UtcNow;
        var thread = new ChatThread
        {
            Id = Guid.NewGuid(), Code = code, AccessKeyHash = HashKey(key), UserId = userId,
            Name = Clean(name, 60), Contact = Clean(contact, 100), LastMessageAt = now, CreatedAt = now,
        };
        _db.ChatThreads.Add(thread);
        await _db.SaveChangesAsync();
        return (thread, key);
    }

    public async Task<ChatMessage> AddCustomerMessageAsync(ChatThread thread, string text, string? orderCode)
    {
        var now = DateTime.UtcNow;
        if (orderCode != null) thread.OrderCode = orderCode;
        var msg = new ChatMessage
        {
            Id = Guid.NewGuid(), ThreadId = thread.Id, FromAdmin = false, Text = text,
            OrderCode = orderCode ?? thread.OrderCode, CreatedAt = now,
        };
        _db.ChatMessages.Add(msg);
        thread.AdminUnread++;
        thread.LastMessageAt = now;
        await _db.SaveChangesAsync();

        var threadId = thread.Id;
        _ = Task.Run(async () =>
        {
            try
            {
                using var scope = _scopes.CreateScope();
                await scope.ServiceProvider.GetRequiredService<ChatService>().ForwardToTelegramAsync(threadId, text, orderCode);
            }
            catch (Exception ex) { _logger.LogWarning(ex, "Chat forward to Telegram failed"); }
        });
        return msg;
    }

    public async Task<ChatMessage> AddAdminMessageAsync(ChatThread thread, string text, string via)
    {
        var now = DateTime.UtcNow;
        var msg = new ChatMessage
        {
            Id = Guid.NewGuid(), ThreadId = thread.Id, FromAdmin = true, Text = text,
            OrderCode = thread.OrderCode, Via = via, CreatedAt = now,
        };
        _db.ChatMessages.Add(msg);
        thread.CustomerUnread++;
        thread.AdminUnread = 0;
        thread.LastMessageAt = now;
        await _db.SaveChangesAsync();

        if (thread.UserId != null)
        {
            try
            {
                using var scope = _scopes.CreateScope();
                await scope.ServiceProvider.GetRequiredService<NotificationService>().AddAsync(thread.UserId, "chat",
                    "💬 Moxic đã trả lời bạn", text.Length > 140 ? text[..140] + "…" : text, "/?chat=1");
            }
            catch (Exception ex) { _logger.LogWarning(ex, "Chat reply notification failed"); }
        }
        return msg;
    }

    public Task<string> HeaderPublicAsync(ChatThread t) => HeaderAsync(t);

    private async Task<string> HeaderAsync(ChatThread t)
    {
        var sb = new StringBuilder();
        var who = t.Name;
        string? email = null;
        if (t.UserId != null)
        {
            var row = await _db.Users.AsNoTracking().Where(u => u.Id == t.UserId).Select(u => new { u.Email }).FirstOrDefaultAsync();
            email = row?.Email;
            who ??= await _db.CustomerProfiles.AsNoTracking().Where(p => p.UserId == t.UserId).Select(p => p.DisplayName).FirstOrDefaultAsync();
        }
        sb.Append($"💬 <b>{TelegramBot.Html(string.IsNullOrWhiteSpace(who) ? "Khách" : who)}</b> · <code>#{t.Code}</code>");
        if (email != null) sb.Append($"\n👤 {TelegramBot.Html(email)}");
        if (t.Contact != null) sb.Append($"\n📞 {TelegramBot.Html(t.Contact)}");
        if (t.OrderCode != null)
        {
            var o = await _db.Orders.AsNoTracking().Where(x => x.OrderCode == t.OrderCode)
                .Select(x => new { x.Status, x.TotalAmount, x.IsGift, Games = x.Details.Select(d => d.GameName).ToList() }).FirstOrDefaultAsync();
            if (o != null)
            {
                var total = o.TotalAmount.ToString("N0", CultureInfo.GetCultureInfo("vi-VN")) + "đ";
                sb.Append($"\n📦 <code>{TelegramBot.Html(t.OrderCode)}</code> · {o.Status} · {total}{(o.IsGift ? " · 🎁" : "")}");
                sb.Append($"\n🎮 {TelegramBot.Html(string.Join(", ", o.Games))}");
            }
            else sb.Append($"\n📦 {TelegramBot.Html(t.OrderCode)} (không tìm thấy)");
        }
        return sb.ToString();
    }

    private static readonly System.Collections.Concurrent.ConcurrentDictionary<Guid, SemaphoreSlim> ForwardLocks = new();

    /// <summary>t.me link that jumps straight to a topic of a supergroup (-100xxxxxxxxxx → c/xxxxxxxxxx/topic).</summary>
    public static string? TopicLink(long chatId, long topicId)
    {
        var s = chatId.ToString();
        return s.StartsWith("-100") ? $"https://t.me/c/{s[4..]}/{topicId}" : null;
    }

    /// <summary>
    /// Each customer gets their own tab in a group with Topics (created on their first message, and again after
    /// the tab was cleaned up). The shared "Tin nhắn khách" tab only gets a one-line index entry with a jump link.
    /// Returns the tab id, or null when the chat has no Topics / the bot can't create topics.
    /// </summary>
    private async Task<(long? TopicId, bool Created)> EnsureTabAsync(ChatThread t, long chatId, long? indexTopicId)
    {
        if (indexTopicId == null) return (null, false); // not a forum group (or private chat)
        if (t.TgTopicId != null && t.TgTopicChatId == chatId) return (t.TgTopicId, false);
        if (t.TgTopicId != null) return (null, false); // already has a tab in another admin chat

        string? who = t.Name;
        if (string.IsNullOrWhiteSpace(who) && t.UserId != null)
            who = await _db.CustomerProfiles.AsNoTracking().Where(p => p.UserId == t.UserId).Select(p => p.DisplayName).FirstOrDefaultAsync();
        if (string.IsNullOrWhiteSpace(who)) who = t.Contact ?? "Khách";
        var name = $"💬 {who} #{t.Code}";
        if (name.Length > 120) name = name[..120];

        var topicId = await _bot.CreateTopicAsync(chatId, name, 9367192);
        if (topicId == null) return (null, false);
        await _db.ChatThreads.Where(x => x.Id == t.Id).ExecuteUpdateAsync(s => s
            .SetProperty(x => x.TgTopicChatId, chatId)
            .SetProperty(x => x.TgTopicId, topicId)
            .SetProperty(x => x.TgTopicCloseAt, (DateTime?)null));
        t.TgTopicChatId = chatId;
        t.TgTopicId = topicId;

        var link = TopicLink(chatId, topicId.Value);
        var index = await _bot.SendAsync(chatId,
            $"🆕 <b>{TelegramBot.Html(who)}</b> <code>#{t.Code}</code> vừa nhắn" + (link != null ? $" → <a href=\"{link}\">mở tab</a>" : " — xem tab riêng"),
            threadId: indexTopicId);
        if (index != null)
            _db.ChatTelegramRefs.Add(new ChatTelegramRef { TelegramChatId = chatId, TelegramMessageId = index.Value, ThreadId = t.Id, CreatedAt = DateTime.UtcNow });
        return (topicId, true);
    }

    public async Task ForwardToTelegramAsync(Guid threadId, string text, string? attachedOrder = null)
    {
        if (!_bot.Enabled) return;
        // Serialize per conversation so two quick messages don't create two tabs.
        var gate = ForwardLocks.GetOrAdd(threadId, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync();
        try
        {
            var t = await _db.ChatThreads.AsNoTracking().FirstOrDefaultAsync(x => x.Id == threadId);
            if (t == null) return;
            var admins = await _db.TelegramAdminChats.AsNoTracking().Select(a => new { a.ChatId, a.ChatTopicId }).ToListAsync();
            if (admins.Count == 0) return;

            var header = await HeaderAsync(t);
            var html = $"{header}\n\n{TelegramBot.Html(text)}\n\n<i>↩️ Reply tin này để trả lời</i>";
            // The customer writing again cancels a pending /exit.
            if (t.TgTopicId != null && t.TgTopicCloseAt != null)
                await _db.ChatThreads.Where(x => x.Id == t.Id).ExecuteUpdateAsync(s => s.SetProperty(x => x.TgTopicCloseAt, (DateTime?)null));

            foreach (var a in admins)
            {
                var (tab, created) = await EnsureTabAsync(t, a.ChatId, a.ChatTopicId);
                long? id;
                if (tab != null)
                {
                    if (created)
                    {
                        var intro = await _bot.SendAsync(a.ChatId,
                            $"{header}\n\n✍️ Gõ thẳng trong tab này để trả lời khách (không cần Reply). /exit khi xong — tab tự xóa sau 3 tiếng; không ai nhắn 24 tiếng cũng tự xóa.",
                            threadId: tab);
                        if (intro != null)
                            _db.ChatTelegramRefs.Add(new ChatTelegramRef { TelegramChatId = a.ChatId, TelegramMessageId = intro.Value, ThreadId = t.Id, CreatedAt = DateTime.UtcNow });
                    }
                    var order = attachedOrder != null && !created ? $"📦 <code>{TelegramBot.Html(attachedOrder)}</code>\n" : "";
                    id = await _bot.SendAsync(a.ChatId, $"{order}👤 {TelegramBot.Html(text)}", threadId: tab);
                }
                else
                {
                    id = await _bot.SendAsync(a.ChatId, html, threadId: a.ChatTopicId);
                }
                if (id != null)
                    _db.ChatTelegramRefs.Add(new ChatTelegramRef { TelegramChatId = a.ChatId, TelegramMessageId = id.Value, ThreadId = t.Id, CreatedAt = DateTime.UtcNow });
            }
            await _db.SaveChangesAsync();
        }
        finally
        {
            gate.Release();
        }
    }

    /// <summary>Tells the other linked admins that someone answered (keeps everyone in sync).</summary>
    public async Task EchoAdminReplyAsync(ChatThread t, string text, long? exceptChatId, string by)
    {
        if (!_bot.Enabled) return;
        var admins = await _db.TelegramAdminChats.AsNoTracking().Where(a => a.ChatId != exceptChatId).Select(a => new { a.ChatId, a.ChatTopicId }).ToListAsync();
        foreach (var a in admins)
        {
            var inTab = t.TgTopicId != null && t.TgTopicChatId == a.ChatId;
            var id = await _bot.SendAsync(a.ChatId, $"✅ <b>{TelegramBot.Html(by)}</b> đã trả lời <code>#{t.Code}</code>:\n{TelegramBot.Html(text)}",
                threadId: inTab ? t.TgTopicId : a.ChatTopicId);
            if (id != null)
                _db.ChatTelegramRefs.Add(new ChatTelegramRef { TelegramChatId = a.ChatId, TelegramMessageId = id.Value, ThreadId = t.Id, CreatedAt = DateTime.UtcNow });
        }
        await _db.SaveChangesAsync();
    }
}
