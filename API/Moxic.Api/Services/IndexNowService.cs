using System.Collections.Concurrent;
using System.Net.Http.Json;

namespace Moxic.Api.Services;

/// <summary>
/// IndexNow (Bing, Yandex, Seznam…; Bing powers ChatGPT search): tells search engines about changed URLs
/// right away instead of waiting for a crawl. URLs are batched and sent every few minutes; key pages
/// (home, price list) are re-submitted once a day because their prices change daily.
/// The key is public by design and is also served as /{key}.txt from the web root.
/// </summary>
public class IndexNowService : BackgroundService
{
    public const string Key = "a7c3e19f5b2d48e6b0c4f7a91d2e6b38";
    private static readonly TimeSpan FlushEvery = TimeSpan.FromMinutes(5);

    private readonly ConcurrentDictionary<string, byte> _pending = new();
    private readonly IHttpClientFactory _http;
    private readonly ILogger<IndexNowService> _logger;
    private readonly string _site;
    private readonly bool _enabled;
    private DateTime _lastDaily = DateTime.MinValue;

    public IndexNowService(IHttpClientFactory http, IConfiguration config, ILogger<IndexNowService> logger, IWebHostEnvironment env)
    {
        _http = http;
        _logger = logger;
        _site = (config["Site:BaseUrl"] ?? "https://moxic.co").TrimEnd('/');
        // Only production pings search engines (local/test runs would submit moxic.co URLs needlessly).
        _enabled = env.IsProduction() && config["IndexNow:Enabled"] != "false" && _site.StartsWith("https://moxic.co");
    }

    /// <summary>Queue site paths (e.g. "/games/{id}") or absolute URLs for submission.</summary>
    public void Enqueue(params string[] paths)
    {
        foreach (var p in paths)
            _pending.TryAdd(p.StartsWith("http") ? p : _site + (p.StartsWith('/') ? p : "/" + p), 0);
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        if (!_enabled) return;
        await Task.Delay(TimeSpan.FromMinutes(1), ct);
        while (!ct.IsCancellationRequested)
        {
            try
            {
                if (DateTime.UtcNow - _lastDaily > TimeSpan.FromHours(24))
                {
                    _lastDaily = DateTime.UtcNow;
                    Enqueue("/", "/bang-gia-xbox", "/games", "/hoi-dap", "/llms.txt");
                }
                await FlushAsync(ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { break; }
            catch (Exception ex) { _logger.LogWarning(ex, "IndexNow flush failed"); }
            await Task.Delay(FlushEvery, ct);
        }
    }

    private async Task FlushAsync(CancellationToken ct)
    {
        var urls = _pending.Keys.Take(500).ToList();
        if (urls.Count == 0) return;
        foreach (var u in urls) _pending.TryRemove(u, out _);
        var client = _http.CreateClient(PriceTrackerService.HttpClientName);
        var body = new { host = new Uri(_site).Host, key = Key, keyLocation = $"{_site}/{Key}.txt", urlList = urls };
        using var res = await client.PostAsJsonAsync("https://api.indexnow.org/indexnow", body, ct);
        if (res.IsSuccessStatusCode) _logger.LogInformation("IndexNow: submitted {Count} URLs", urls.Count);
        else _logger.LogWarning("IndexNow rejected {Count} URLs: {Status}", urls.Count, (int)res.StatusCode);
    }
}
