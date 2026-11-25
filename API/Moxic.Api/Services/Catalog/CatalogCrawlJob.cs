namespace Moxic.Api.Services.Catalog;

public record CrawlStatus(bool Running, int Limit, int Pages, int Scanned, int Added, int Updated, int Skipped,
    DateTime? StartedAt, DateTime? FinishedAt, string? Error);

/// <summary>
/// Background crawl of the Xbox Store VN catalog, most popular first, into the review queue. One run at a time (the server
/// has 1GB RAM); each page is saved and released before the next. Progress lives in memory and is polled by the admin page.
/// </summary>
public class CatalogCrawlJob
{
    private static readonly TimeSpan PageDelay = TimeSpan.FromMilliseconds(700);
    private readonly IServiceScopeFactory _scopes;
    private readonly XboxBrowseClient _xbox;
    private readonly ILogger<CatalogCrawlJob> _logger;
    private readonly object _gate = new();
    private CancellationTokenSource? _cts;

    public CrawlStatus Status { get; private set; } = new(false, 0, 0, 0, 0, 0, 0, null, null, null);

    public CatalogCrawlJob(IServiceScopeFactory scopes, XboxBrowseClient xbox, ILogger<CatalogCrawlJob> logger)
    {
        _scopes = scopes;
        _xbox = xbox;
        _logger = logger;
    }

    /// <summary>Starts a crawl of the first <paramref name="limit"/> products (0 = the whole catalog). False if one is running.</summary>
    public bool TryStart(int limit)
    {
        lock (_gate)
        {
            if (Status.Running) return false;
            _cts = new CancellationTokenSource();
            Status = new CrawlStatus(true, limit, 0, 0, 0, 0, 0, DateTime.UtcNow, null, null);
        }
        var ct = _cts.Token;
        _ = Task.Run(() => RunAsync(limit, ct));
        return true;
    }

    public void Stop() => _cts?.Cancel();

    private async Task RunAsync(int limit, CancellationToken ct)
    {
        string? token = null, error = null;
        try
        {
            do
            {
                var (items, next) = await FetchWithRetryAsync(token, ct);
                if (limit > 0 && Status.Scanned + items.Count > limit) items = items.Take(limit - Status.Scanned).ToList();
                CrawlPageResult r;
                using (var scope = _scopes.CreateScope())
                    r = await scope.ServiceProvider.GetRequiredService<CatalogImportService>().ImportPageAsync(items, Status.Scanned + 1, ct);
                Status = Status with
                {
                    Pages = Status.Pages + 1, Scanned = Status.Scanned + items.Count,
                    Added = Status.Added + r.Added, Updated = Status.Updated + r.Updated, Skipped = Status.Skipped + r.Skipped,
                };
                token = next;
                if (token != null) await Task.Delay(PageDelay, ct);
            } while (token != null && (limit == 0 || Status.Scanned < limit));
        }
        catch (OperationCanceledException) { error = "Đã dừng"; }
        catch (Exception e)
        {
            error = $"Không đọc được Xbox Store: {e.Message}";
            _logger.LogError(e, "Xbox catalog crawl failed after {Scanned} products", Status.Scanned);
        }
        finally
        {
            Status = Status with { Running = false, FinishedAt = DateTime.UtcNow, Error = error };
            _logger.LogInformation("Xbox catalog crawl done: {Status}", Status);
        }
    }

    private async Task<(List<XboxProduct>, string?)> FetchWithRetryAsync(string? token, CancellationToken ct)
    {
        for (var attempt = 1; ; attempt++)
        {
            try { return await _xbox.FetchPageAsync("popular", token, ct); }
            catch (HttpRequestException) when (attempt < 3) { await Task.Delay(TimeSpan.FromSeconds(3 * attempt), ct); }
        }
    }
}
