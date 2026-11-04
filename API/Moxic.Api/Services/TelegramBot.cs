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
    public async Task<long?> SendAsync(long chatId, string html, long? replyTo = null, CancellationToken ct = default)
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
            var r = await CallAsync("sendMessage", body, ct);
            return r?["message_id"]?.GetValue<long>();
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
        {
            _logger.LogWarning(ex, "Telegram sendMessage to {Chat} failed", chatId);
            return null;
        }
    }

    public async Task<JsonArray?> GetUpdatesAsync(long offset, int timeoutSeconds, CancellationToken ct)
    {
        var r = await CallAsync("getUpdates", new { offset, timeout = timeoutSeconds, allowed_updates = new[] { "message" } }, ct,
            TimeSpan.FromSeconds(timeoutSeconds + 15));
        return r as JsonArray;
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
