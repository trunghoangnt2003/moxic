using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Moxic.Api.Services;
using Moxic.Core.Entities;
using Moxic.Infrastructure.Data;

namespace Moxic.Api.Controllers;

public record ChatSendRequest(string? Text, string? OrderCode, string? Name, string? Contact);
public record AdminChatReplyRequest(string? Text);

/// <summary>
/// Customer side of live chat. A visitor is identified by a secret key (header X-Chat-Key) kept in their
/// browser; signed-in customers are also matched by account, so their history follows them across devices.
/// </summary>
[ApiController]
[Route("api/chat")]
public class ChatController : ControllerBase
{
    private const string KeyHeader = "X-Chat-Key";
    private readonly MoxicDbContext _db;
    private readonly ChatService _chat;

    public ChatController(MoxicDbContext db, ChatService chat)
    {
        _db = db;
        _chat = chat;
    }

    private async Task<string?> CustomerIdAsync()
    {
        var auth = await HttpContext.AuthenticateAsync(CustomerAuthRules.Scheme);
        return auth.Succeeded && auth.Principal?.IsInRole(CustomerAuthRules.CustomerRole) == true
            ? auth.Principal.FindFirstValue(ClaimTypes.NameIdentifier)
            : null;
    }

    /// <summary>Thread for this visitor: by key, else the signed-in customer's latest thread.</summary>
    private async Task<ChatThread?> CurrentAsync(string? userId)
    {
        var byKey = await _chat.FindByKeyAsync(Request.Headers[KeyHeader].FirstOrDefault());
        if (byKey != null)
        {
            // A guest thread is adopted by the account that signs in on that browser.
            if (byKey.UserId == null && userId != null)
            {
                byKey.UserId = userId;
                await _db.SaveChangesAsync();
            }
            if (byKey.UserId == null || byKey.UserId == userId) return byKey;
        }
        if (userId != null)
            return await _db.ChatThreads.Where(t => t.UserId == userId).OrderByDescending(t => t.LastMessageAt).FirstOrDefaultAsync();
        return null;
    }

    private static object Dto(ChatMessage m) => new { m.Id, m.FromAdmin, m.Text, m.OrderCode, m.CreatedAt };

    // GET /api/chat/config
    [HttpGet("config")]
    public async Task<IActionResult> Config() => Ok(new { enabled = await _chat.IsLiveAsync() });

    // GET /api/chat/messages?after=ISO — poll; also resets the customer's unread count
    [HttpGet("messages")]
    public async Task<IActionResult> Messages([FromQuery] DateTime? after)
    {
        var userId = await CustomerIdAsync();
        var t = await CurrentAsync(userId);
        if (t == null) return Ok(new { thread = (object?)null, messages = Array.Empty<object>() });

        var q = _db.ChatMessages.AsNoTracking().Where(m => m.ThreadId == t.Id);
        if (after != null) q = q.Where(m => m.CreatedAt > after.Value.ToUniversalTime());
        var list = await q.OrderByDescending(m => m.CreatedAt).Take(200).ToListAsync();
        list.Reverse();
        if (t.CustomerUnread > 0)
        {
            t.CustomerUnread = 0;
            await _db.SaveChangesAsync();
        }
        return Ok(new { thread = new { t.Code, t.OrderCode, t.Name }, messages = list.Select(Dto) });
    }

    // GET /api/chat/unread — cheap badge poll
    [HttpGet("unread")]
    public async Task<IActionResult> Unread()
    {
        var t = await CurrentAsync(await CustomerIdAsync());
        return Ok(new { unread = t?.CustomerUnread ?? 0 });
    }

    // POST /api/chat/messages
    [HttpPost("messages")]
    [EnableRateLimiting(CouponRules.RateLimitPolicy)]
    public async Task<IActionResult> Send([FromBody] ChatSendRequest req)
    {
        var text = ChatService.Clean(req.Text, ChatService.MaxText);
        if (text == null) return BadRequest(new { error = "Nhập nội dung tin nhắn" });
        var userId = await CustomerIdAsync();

        string? orderCode = null;
        if (!string.IsNullOrWhiteSpace(req.OrderCode))
        {
            var code = req.OrderCode.Trim().ToUpperInvariant();
            if (!await _db.Orders.AnyAsync(o => o.OrderCode == code)) return BadRequest(new { error = "Không tìm thấy mã đơn hàng" });
            orderCode = code;
        }

        var thread = await CurrentAsync(userId);
        string? newKey = null;
        if (thread == null)
        {
            // Guests must leave a way to be contacted (they may close the tab before we answer).
            if (userId == null && ChatService.Clean(req.Contact, 100) == null)
                return BadRequest(new { error = "Để lại SĐT/Zalo để Moxic liên hệ lại nếu bạn rời trang", code = "CONTACT_REQUIRED" });
            (thread, newKey) = await _chat.CreateThreadAsync(userId, req.Name, req.Contact);
        }
        else
        {
            thread.Name ??= ChatService.Clean(req.Name, 60);
            thread.Contact ??= ChatService.Clean(req.Contact, 100);
        }

        var msg = await _chat.AddCustomerMessageAsync(thread, text, orderCode);
        return Ok(new { key = newKey, message = Dto(msg), live = await _chat.IsLiveAsync() });
    }
}

[ApiController]
[Route("api/admin/chat")]
[Authorize(Roles = "Admin")]
public class AdminChatController : ControllerBase
{
    private readonly MoxicDbContext _db;
    private readonly ChatService _chat;
    private readonly TelegramBot _bot;
    private readonly IMemoryCache _cache;

    public AdminChatController(MoxicDbContext db, ChatService chat, TelegramBot bot, IMemoryCache cache)
    {
        _db = db;
        _chat = chat;
        _bot = bot;
        _cache = cache;
    }

    [HttpGet("threads")]
    public async Task<IActionResult> Threads([FromQuery] string? search)
    {
        var q = _db.ChatThreads.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToUpperInvariant();
            q = q.Where(t => t.Code == s.TrimStart('#') || (t.OrderCode != null && t.OrderCode.Contains(s))
                || (t.Name != null && t.Name.ToUpper().Contains(s)) || (t.Contact != null && t.Contact.Contains(s)));
        }
        var rows = await q.OrderByDescending(t => t.LastMessageAt).Take(100).ToListAsync();
        var ids = rows.Select(r => r.Id).ToList();
        var last = await _db.ChatMessages.AsNoTracking().Where(m => ids.Contains(m.ThreadId))
            .GroupBy(m => m.ThreadId)
            .Select(g => g.OrderByDescending(m => m.CreatedAt).Select(m => new { m.ThreadId, m.Text, m.FromAdmin }).First())
            .ToListAsync();
        var userIds = rows.Where(r => r.UserId != null).Select(r => r.UserId!).Distinct().ToList();
        var emails = await _db.Users.AsNoTracking().Where(u => userIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.Email);
        return Ok(rows.Select(t =>
        {
            var l = last.FirstOrDefault(x => x.ThreadId == t.Id);
            return new
            {
                t.Id, t.Code, t.Name, t.Contact, t.OrderCode, t.AdminUnread, t.LastMessageAt,
                Email = t.UserId != null ? emails.GetValueOrDefault(t.UserId) : null,
                LastText = l?.Text, LastFromAdmin = l?.FromAdmin ?? false,
            };
        }));
    }

    [HttpGet("threads/{id:guid}")]
    public async Task<IActionResult> Thread(Guid id)
    {
        var t = await _db.ChatThreads.FirstOrDefaultAsync(x => x.Id == id);
        if (t == null) return NotFound();
        var msgs = await _db.ChatMessages.AsNoTracking().Where(m => m.ThreadId == id).OrderBy(m => m.CreatedAt).Take(500)
            .Select(m => new { m.Id, m.FromAdmin, m.Text, m.OrderCode, m.Via, m.CreatedAt }).ToListAsync();
        if (t.AdminUnread > 0)
        {
            t.AdminUnread = 0;
            await _db.SaveChangesAsync();
        }
        return Ok(new { t.Id, t.Code, t.Name, t.Contact, t.OrderCode, t.UserId, messages = msgs });
    }

    [HttpPost("threads/{id:guid}/reply")]
    public async Task<IActionResult> Reply(Guid id, [FromBody] AdminChatReplyRequest req)
    {
        var text = ChatService.Clean(req.Text, ChatService.MaxText);
        if (text == null) return BadRequest(new { error = "Nhập nội dung" });
        var t = await _db.ChatThreads.FirstOrDefaultAsync(x => x.Id == id);
        if (t == null) return NotFound();
        var m = await _chat.AddAdminMessageAsync(t, text, "web");
        await _chat.EchoAdminReplyAsync(t, text, null, User.Identity?.Name ?? "Admin");
        return Ok(new { m.Id, m.FromAdmin, m.Text, m.OrderCode, m.Via, m.CreatedAt });
    }

    // Chat history about one order (shown in the order detail modal)
    [HttpGet("by-order/{orderCode}")]
    public async Task<IActionResult> ByOrder(string orderCode)
    {
        var code = orderCode.Trim().ToUpperInvariant();
        var threadIds = await _db.ChatMessages.AsNoTracking().Where(m => m.OrderCode == code).Select(m => m.ThreadId).Distinct().ToListAsync();
        var msgs = await _db.ChatMessages.AsNoTracking().Where(m => m.OrderCode == code).OrderBy(m => m.CreatedAt).Take(300)
            .Select(m => new { m.Id, m.ThreadId, m.FromAdmin, m.Text, m.CreatedAt }).ToListAsync();
        return Ok(new { threadIds, messages = msgs });
    }

    [HttpGet("unread")]
    public async Task<IActionResult> Unread() => Ok(new { unread = await _db.ChatThreads.SumAsync(t => t.AdminUnread) });

    // ---- Telegram linking ----

    [HttpGet("telegram")]
    public async Task<IActionResult> Telegram()
    {
        var chats = await _db.TelegramAdminChats.AsNoTracking().OrderBy(c => c.LinkedAt).ToListAsync();
        return Ok(new { enabled = _bot.Enabled, botUsername = await _bot.GetUsernameAsync(), chats });
    }

    [HttpPost("telegram/link-code")]
    public async Task<IActionResult> LinkCode()
    {
        if (!_bot.Enabled) return BadRequest(new { error = "Chưa cấu hình Telegram__BotToken trên server" });
        var code = RandomNumberGenerator.GetString("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);
        _cache.Set(TelegramChatPoller.LinkCacheKey(code), true, TimeSpan.FromMinutes(10));
        return Ok(new { code, botUsername = await _bot.GetUsernameAsync(), expiresInMinutes = 10 });
    }

    [HttpDelete("telegram/{chatId:long}")]
    public async Task<IActionResult> Unlink(long chatId)
    {
        var n = await _db.TelegramAdminChats.Where(c => c.ChatId == chatId).ExecuteDeleteAsync();
        return n == 0 ? NotFound() : NoContent();
    }
}
