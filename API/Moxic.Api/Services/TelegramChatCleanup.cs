using Microsoft.EntityFrameworkCore;
using Moxic.Infrastructure.Data;

namespace Moxic.Api.Services;

/// <summary>
/// Keeps the admins' Telegram tidy: support messages are deleted from Telegram after 24h, customer tabs
/// are deleted 3h after /exit or after 24h without activity. The conversation history stays on the
/// website (customer chat, admin inbox, per-order history) — only the Telegram copies go away.
/// Telegram only lets bots delete messages younger than 48h, so this runs every 10 minutes.
/// </summary>
public class TelegramChatCleanup : BackgroundService
{
    public static readonly TimeSpan MessageTtl = TimeSpan.FromHours(24);
    public static readonly TimeSpan TabIdleTtl = TimeSpan.FromHours(24);

    private readonly TelegramBot _bot;
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<TelegramChatCleanup> _logger;

    public TelegramChatCleanup(TelegramBot bot, IServiceScopeFactory scopes, ILogger<TelegramChatCleanup> logger)
    {
        _bot = bot;
        _scopes = scopes;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        if (!_bot.Enabled) return;
        await Task.Delay(TimeSpan.FromMinutes(1), ct);
        while (!ct.IsCancellationRequested)
        {
            try { await RunOnceAsync(ct); }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { break; }
            catch (Exception ex) { _logger.LogWarning(ex, "Telegram chat cleanup failed"); }
            await Task.Delay(TimeSpan.FromMinutes(10), ct);
        }
    }

    private async Task RunOnceAsync(CancellationToken ct)
    {
        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MoxicDbContext>();
        var now = DateTime.UtcNow;

        // 1) Customer tabs: closed with /exit (+3h) or idle for 24h → delete the whole topic.
        var idleBefore = now - TabIdleTtl;
        var tabs = await db.ChatThreads
            .Where(t => t.TgTopicId != null && ((t.TgTopicCloseAt != null && t.TgTopicCloseAt <= now) || t.LastMessageAt <= idleBefore))
            .Take(20).ToListAsync(ct);
        foreach (var t in tabs)
        {
            await _bot.DeleteTopicAsync(t.TgTopicChatId!.Value, t.TgTopicId!.Value, ct);
            await db.ChatTelegramRefs.Where(r => r.ThreadId == t.Id && r.TelegramChatId == t.TgTopicChatId).ExecuteDeleteAsync(ct);
            t.TgTopicChatId = null;
            t.TgTopicId = null;
            t.TgTopicCloseAt = null;
        }
        if (tabs.Count > 0)
        {
            await db.SaveChangesAsync(ct);
            _logger.LogInformation("Deleted {Count} customer chat tabs in Telegram", tabs.Count);
        }

        // 2) Support messages older than 24h → delete from Telegram (oldest first, bounded per run).
        var before = now - MessageTtl;
        var old = await db.ChatTelegramRefs.Where(r => r.CreatedAt <= before)
            .OrderBy(r => r.CreatedAt).Take(150).ToListAsync(ct);
        foreach (var r in old)
        {
            // Past Telegram's 48h window deletion fails — just forget the row.
            if (now - r.CreatedAt < TimeSpan.FromHours(47)) await _bot.DeleteAsync(r.TelegramChatId, r.TelegramMessageId, ct);
            db.ChatTelegramRefs.Remove(r);
        }
        if (old.Count > 0) await db.SaveChangesAsync(ct);
    }
}
