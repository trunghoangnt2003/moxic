using System.Net;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Moxic.Api.Services;

/// <summary>Minimal Telegram Bot API client (sendMessage / getUpdates / getMe). Token from Telegram:BotToken.</summary>
public class TelegramBot
{
    public const string HttpClientName = "telegram";

    private readonly IHttpClientFactory _http;
    private readonly ILogger<TelegramBot> _logger;
    private readonly string? _token;
    private string? _username;

    public TelegramBot(IHttpClientFactory http, IConfiguration config, ILogger<TelegramBot> logger)
    {
        _http = http;
        _logger = logger;
        var t = config["Telegram:BotToken"];
        _token = string.IsNullOrWhiteSpace(t) ? null : t.Trim();
    }

    public bool Enabled => _token != null;

    public static string Html(string? s) => WebUtility.HtmlEncode(s ?? string.Empty);

    private async Task<JsonNode?> CallAsync(string method, object body, CancellationToken ct, TimeSpan? timeout = null)
    {
        if (_token == null) return null;
        var client = _http.CreateClient(HttpClientName);
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(timeout ?? TimeSpan.FromSeconds(15));
        using var res = await client.PostAsJsonAsync($"https://api.telegram.org/bot{_token}/{method}", body, cts.Token);
        var json = JsonNode.Parse(await res.Content.ReadAsStringAsync(cts.Token));
        if (json?["ok"]?.GetValue<bool>() != true)
        {
            _logger.LogWarning("Telegram {Method} failed: {Desc}", method, json?["description"]?.GetValue<string>());
            return null;
        }
        return json["result"];
    }

    /// <summary>Sends an HTML message; returns its message_id, or null on failure.</summary>
    public async Task<long?> SendAsync(long chatId, string html, long? replyTo = null, CancellationToken ct = default, object? markup = null, long? threadId = null)
    {
        try
        {
            var body = new Dictionary<string, object?>
            {
                ["chat_id"] = chatId,
                ["text"] = html.Length > 4000 ? html[..4000] : html,
                ["parse_mode"] = "HTML",
                ["disable_web_page_preview"] = true,
            };
            if (replyTo != null) body["reply_parameters"] = new { message_id = replyTo, allow_sending_without_reply = true };
            if (markup != null) body["reply_markup"] = markup;
            if (threadId != null) body["message_thread_id"] = threadId;
            var r = await CallAsync("sendMessage", body, ct);
            return r?["message_id"]?.GetValue<long>();
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
        {
            _logger.LogWarning(ex, "Telegram sendMessage to {Chat} failed", chatId);
            return null;
        }
    }

    /// <summary>Inline keyboard markup from rows of (text, callbackData or url).</summary>
    public static object Keyboard(IEnumerable<IEnumerable<(string Text, string? Data, string? Url)>> rows) => new
    {
        inline_keyboard = rows.Select(r => r.Select(b => b.Url != null
            ? (object)new { text = b.Text, url = b.Url }
            : new { text = b.Text, callback_data = b.Data })).Where(r => r.Any()).ToArray(),
    };

    public static object EmptyKeyboard => new { inline_keyboard = Array.Empty<object>() };

    public async Task<bool> EditAsync(long chatId, long messageId, string html, object? markup, CancellationToken ct = default)
    {
        try
        {
            var body = new Dictionary<string, object?>
            {
                ["chat_id"] = chatId, ["message_id"] = messageId, ["text"] = html.Length > 4000 ? html[..4000] : html,
                ["parse_mode"] = "HTML", ["disable_web_page_preview"] = true, ["reply_markup"] = markup ?? EmptyKeyboard,
            };
            return await CallAsync("editMessageText", body, ct) != null;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Telegram editMessageText failed");
            return false;
        }
    }

    public async Task EditKeyboardAsync(long chatId, long messageId, object markup, CancellationToken ct = default)
    {
        try { await CallAsync("editMessageReplyMarkup", new { chat_id = chatId, message_id = messageId, reply_markup = markup }, ct); }
        catch (Exception ex) { _logger.LogWarning(ex, "Telegram editMessageReplyMarkup failed"); }
    }

    public async Task DeleteAsync(long chatId, long messageId, CancellationToken ct = default)
    {
        try { await CallAsync("deleteMessage", new { chat_id = chatId, message_id = messageId }, ct); }
        catch (Exception ex) { _logger.LogWarning(ex, "Telegram deleteMessage failed"); }
    }

    public async Task AnswerCallbackAsync(string callbackId, string? text, bool alert = false, CancellationToken ct = default)
    {
        var body = new Dictionary<string, object?> { ["callback_query_id"] = callbackId, ["show_alert"] = alert };
        if (text != null) body["text"] = text;
        try { await CallAsync("answerCallbackQuery", body, ct); }
        catch (Exception ex) { _logger.LogWarning(ex, "Telegram answerCallbackQuery failed"); }
    }

    public async Task SendPhotoAsync(long chatId, string url, string? captionHtml, long? replyTo = null, CancellationToken ct = default, long? threadId = null)
    {
        try
        {
            var body = new Dictionary<string, object?> { ["chat_id"] = chatId, ["photo"] = url, ["parse_mode"] = "HTML" };
            if (captionHtml != null) body["caption"] = captionHtml;
            if (threadId != null) body["message_thread_id"] = threadId;
            if (replyTo != null) body["reply_parameters"] = new { message_id = replyTo, allow_sending_without_reply = true };
            await CallAsync("sendPhoto", body, ct, TimeSpan.FromSeconds(30));
        }
        catch (Exception ex) { _logger.LogWarning(ex, "Telegram sendPhoto failed"); }
    }

    public async Task<JsonArray?> GetUpdatesAsync(long offset, int timeoutSeconds, CancellationToken ct)
    {
        var r = await CallAsync("getUpdates", new { offset, timeout = timeoutSeconds, allowed_updates = new[] { "message", "callback_query" } }, ct,
            TimeSpan.FromSeconds(timeoutSeconds + 15));
        return r as JsonArray;
    }

    /// <summary>Creates a forum topic in a group with Topics enabled (bot needs "Manage topics"). Returns message_thread_id.</summary>
    public async Task<long?> CreateTopicAsync(long chatId, string name, int iconColor, CancellationToken ct = default)
    {
        try
        {
            var r = await CallAsync("createForumTopic", new { chat_id = chatId, name, icon_color = iconColor }, ct);
            return r?["message_thread_id"]?.GetValue<long>();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Telegram createForumTopic failed");
            return null;
        }
    }

    /// <summary>Deletes a forum topic with all its messages. True on success.</summary>
    public async Task<bool> DeleteTopicAsync(long chatId, long topicId, CancellationToken ct = default)
    {
        try { return await CallAsync("deleteForumTopic", new { chat_id = chatId, message_thread_id = topicId }, ct) != null; }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Telegram deleteForumTopic failed");
            return false;
        }
    }

    public async Task ReactAsync(long chatId, long messageId, string emoji, CancellationToken ct = default)
    {
        try { await CallAsync("setMessageReaction", new { chat_id = chatId, message_id = messageId, reaction = new[] { new { type = "emoji", emoji } } }, ct); }
        catch (Exception ex) { _logger.LogWarning(ex, "Telegram setMessageReaction failed"); }
    }

    public async Task DeleteWebhookAsync(CancellationToken ct) => await CallAsync("deleteWebhook", new { drop_pending_updates = false }, ct);

    public async Task<string?> GetUsernameAsync(CancellationToken ct = default)
    {
        if (_username != null || _token == null) return _username;
        try
        {
            var r = await CallAsync("getMe", new { }, ct);
            _username = r?["username"]?.GetValue<string>();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Telegram getMe failed");
        }
        return _username;
    }
}
