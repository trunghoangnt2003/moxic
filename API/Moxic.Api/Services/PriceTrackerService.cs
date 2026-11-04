using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Moxic.Core.Entities;
using Moxic.Core.Interfaces;
using Moxic.Infrastructure.Data;

namespace Moxic.Api.Services;

/// <summary>
/// Price tracking:
/// - Moxic prices: a snapshot is written whenever a game's selling price changes.
/// - Xbox Store reference prices via the XBXprices Developer API (X-API-Key), batched by region.
///   Disabled until Xbx:ApiKey is configured. Prices arrive in minor units.
/// - Wishlist price-drop alerts (opt-out per customer).
/// </summary>
public class PriceTrackerService
{
    public const string HttpClientName = "xbxprices";
    private const int BatchSize = 25;

    // Last-run info shown in admin (process-wide).
    public static DateTime? LastXboxSyncAt { get; private set; }
    public static string? LastXboxSyncResult { get; private set; }

    private static readonly Dictionary<string, string> RegionCurrency = new(StringComparer.OrdinalIgnoreCase)
    {
        ["us"] = "USD", ["gb"] = "GBP", ["eu"] = "EUR", ["de"] = "EUR", ["fr"] = "EUR", ["ar"] = "ARS", ["tr"] = "TRY",
        ["in"] = "INR", ["br"] = "BRL", ["jp"] = "JPY", ["kr"] = "KRW", ["ca"] = "CAD", ["au"] = "AUD", ["mx"] = "MXN",
        ["ng"] = "NGN", ["eg"] = "EGP", ["pl"] = "PLN", ["za"] = "ZAR", ["sg"] = "SGD", ["hk"] = "HKD", ["tw"] = "TWD",
    };

    private readonly MoxicDbContext _db;
    private readonly IHttpClientFactory _http;
    private readonly IConfiguration _config;
    private readonly IEmailService _email;
    private readonly ILogger<PriceTrackerService> _logger;
    private readonly NotificationService _notifications;

    public PriceTrackerService(MoxicDbContext db, IHttpClientFactory http, IConfiguration config, IEmailService email, ILogger<PriceTrackerService> logger, NotificationService notifications)
    {
        _notifications = notifications;
        _db = db;
        _http = http;
        _config = config;
        _email = email;
        _logger = logger;
    }

    public string? ApiKey => _config["Xbx:ApiKey"] is { Length: > 0 } k ? k : null;
    public static string CurrencyFor(string region) => RegionCurrency.GetValueOrDefault(region, region.ToUpperInvariant());

    /// <summary>Writes a Moxic snapshot for each game whose price differs from its latest snapshot.</summary>
    public async Task<int> RecordMoxicPricesAsync(CancellationToken ct = default)
    {
        var games = await _db.Games.AsNoTracking().Select(g => new { g.Id, g.OriginalPrice, g.SalePrice }).ToListAsync(ct);
        var latest = await _db.GamePriceSnapshots.AsNoTracking()
            .Where(s => s.Source == "Moxic")
            .GroupBy(s => s.GameId)
            .Select(g => g.OrderByDescending(s => s.CapturedAt).First())
            .ToDictionaryAsync(s => s.GameId, ct);

        var now = DateTime.UtcNow;
        var added = 0;
        foreach (var g in games)
        {
            if (latest.TryGetValue(g.Id, out var last) && last.SalePrice == g.SalePrice && last.BasePrice == g.OriginalPrice) continue;
            _db.GamePriceSnapshots.Add(new GamePriceSnapshot
            {
                Id = Guid.NewGuid(), GameId = g.Id, Source = "Moxic", Region = "vn", Currency = "VND",
                BasePrice = g.OriginalPrice, SalePrice = g.SalePrice, CapturedAt = now,
            });
            added++;
        }
        if (added > 0) await _db.SaveChangesAsync(ct);
        return added;
    }

    /// <summary>Fetches Xbox Store prices for every game with an XboxProductId. Returns (updated, error).</summary>
    public async Task<(int Updated, string? Error)> SyncXboxAsync(CancellationToken ct = default)
    {
        var key = ApiKey;
        if (key == null) return await SyncMicrosoftCatalogAsync(ct);

        var games = await _db.Games.AsNoTracking()
            .Where(g => g.XboxProductId != null && g.XboxProductId != "")
            .Select(g => new { g.Id, Pid = g.XboxProductId!, Region = (g.PriceRegion ?? "us").ToLower() })
            .ToListAsync(ct);
        if (games.Count == 0) return (0, null);

        var latest = await _db.GamePriceSnapshots.AsNoTracking()
            .Where(s => s.Source == "XboxStore")
            .GroupBy(s => new { s.GameId, s.Region })
            .Select(g => g.OrderByDescending(s => s.CapturedAt).First())
            .ToListAsync(ct);

        var client = _http.CreateClient(HttpClientName);
        var baseUrl = (_config["Xbx:BaseUrl"] ?? "https://xbxprices.com/api/v2").TrimEnd('/');
        var updated = 0;
        string? error = null;
        var now = DateTime.UtcNow;

        foreach (var regionGroup in games.GroupBy(g => g.Region))
        {
            foreach (var chunk in regionGroup.Chunk(BatchSize))
            {
                var ids = string.Join(",", chunk.Select(c => Uri.EscapeDataString(c.Pid)));
                using var req = new HttpRequestMessage(HttpMethod.Get, $"{baseUrl}/games/batch?xboxids={ids}&region={regionGroup.Key}");
                req.Headers.Add("X-API-Key", key);
                try
                {
                    using var res = await client.SendAsync(req, ct);
                    var body = await res.Content.ReadAsStringAsync(ct);
                    if (!res.IsSuccessStatusCode)
                    {
                        error = $"XBXprices {(int)res.StatusCode}: {body[..Math.Min(body.Length, 200)]}";
                        _logger.LogWarning("XBXprices batch failed: {error}", error);
                        continue;
                    }
                    foreach (var item in ExtractGames(body))
                    {
                        var game = chunk.FirstOrDefault(c => string.Equals(c.Pid, item.XboxId, StringComparison.OrdinalIgnoreCase));
                        if (game == null) continue;
                        var last = latest.FirstOrDefault(s => s.GameId == game.Id && s.Region == regionGroup.Key);
                        if (last != null && last.SalePrice == item.Sale && last.BasePrice == item.Base) continue;
                        _db.GamePriceSnapshots.Add(new GamePriceSnapshot
                        {
                            Id = Guid.NewGuid(), GameId = game.Id, Source = "XboxStore", Region = regionGroup.Key,
                            Currency = item.Currency ?? CurrencyFor(regionGroup.Key), BasePrice = item.Base, SalePrice = item.Sale, CapturedAt = now,
                        });
                        updated++;
                    }
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    error = ex.Message;
                    _logger.LogWarning(ex, "XBXprices request failed");
                }
            }
        }
        if (updated > 0) await _db.SaveChangesAsync(ct);
        LastXboxSyncAt = now;
        LastXboxSyncResult = error ?? $"OK — {updated} giá mới / {games.Count} game";
        return (updated, error);
    }

    public string Source => ApiKey != null ? "XBXprices" : "Microsoft Store catalog";

    /// <summary>
    /// Free source: Microsoft's public display catalog (the endpoint the Store itself uses; undocumented).
    /// Prices are in major units. Picks the first purchasable (non-zero) availability of the first SKU.
    /// </summary>
    private async Task<(int Updated, string? Error)> SyncMicrosoftCatalogAsync(CancellationToken ct)
    {
        var games = await _db.Games.AsNoTracking()
            .Where(g => g.XboxProductId != null && g.XboxProductId != "")
            .Select(g => new { g.Id, Pid = g.XboxProductId!.ToUpper(), Region = (g.PriceRegion ?? "us").ToLower() })
            .ToListAsync(ct);
        if (games.Count == 0) return (0, null);

        var latest = await _db.GamePriceSnapshots.AsNoTracking()
            .Where(s => s.Source == "XboxStore")
            .GroupBy(s => new { s.GameId, s.Region })
            .Select(g => g.OrderByDescending(s => s.CapturedAt).First())
            .ToListAsync(ct);

        var client = _http.CreateClient(HttpClientName);
        var updated = 0;
        string? error = null;
        var now = DateTime.UtcNow;
        foreach (var regionGroup in games.GroupBy(g => g.Region))
        {
            foreach (var chunk in regionGroup.Chunk(20))
            {
                var url = $"https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds={string.Join(",", chunk.Select(c => Uri.EscapeDataString(c.Pid)))}&market={regionGroup.Key.ToUpperInvariant()}&languages=en-us";
                try
                {
                    using var res = await client.GetAsync(url, ct);
                    if (!res.IsSuccessStatusCode) { error = $"Microsoft catalog {(int)res.StatusCode}"; continue; }
                    using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));
                    if (!doc.RootElement.TryGetProperty("Products", out var products)) continue;
                    foreach (var p in products.EnumerateArray())
                    {
                        var pid = p.TryGetProperty("ProductId", out var pidEl) ? pidEl.GetString() : null;
                        var game = chunk.FirstOrDefault(c => string.Equals(c.Pid, pid, StringComparison.OrdinalIgnoreCase));
                        if (game == null || !p.TryGetProperty("DisplaySkuAvailabilities", out var skus)) continue;
                        var price = FirstPurchasePrice(skus);
                        if (price == null) continue;
                        var (basePrice, salePrice, currency) = price.Value;
                        var last = latest.FirstOrDefault(s => s.GameId == game.Id && s.Region == regionGroup.Key);
                        if (last != null && last.SalePrice == salePrice && last.BasePrice == basePrice) continue;
                        _db.GamePriceSnapshots.Add(new GamePriceSnapshot
                        {
                            Id = Guid.NewGuid(), GameId = game.Id, Source = "XboxStore", Region = regionGroup.Key,
                            Currency = currency, BasePrice = basePrice, SalePrice = salePrice, CapturedAt = now,
                        });
                        updated++;
                    }
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    error = ex.Message;
                    _logger.LogWarning(ex, "Microsoft catalog request failed");
                }
                await Task.Delay(500, ct); // be polite
            }
        }
        if (updated > 0) await _db.SaveChangesAsync(ct);
        LastXboxSyncAt = now;
        LastXboxSyncResult = error ?? $"OK (Microsoft Store) — {updated} giá mới / {games.Count} game";
        return (updated, error);
    }

    private static (decimal Base, decimal Sale, string Currency)? FirstPurchasePrice(JsonElement skus)
    {
        foreach (var sku in skus.EnumerateArray())
        {
            if (!sku.TryGetProperty("Availabilities", out var avs)) continue;
            foreach (var av in avs.EnumerateArray())
            {
                var purchasable = av.TryGetProperty("Actions", out var actions) && actions.ValueKind == JsonValueKind.Array
                    && actions.EnumerateArray().Any(a => a.GetString() == "Purchase");
                if (!purchasable || !av.TryGetProperty("OrderManagementData", out var omd) || !omd.TryGetProperty("Price", out var pr)) continue;
                var list = pr.TryGetProperty("ListPrice", out var l) && l.TryGetDecimal(out var lv) ? lv : 0m;
                var msrp = pr.TryGetProperty("MSRP", out var m) && m.TryGetDecimal(out var mv) ? mv : list;
                if (list <= 0) continue;
                var cur = pr.TryGetProperty("CurrencyCode", out var c) ? c.GetString() ?? "USD" : "USD";
                return (Math.Max(msrp, list), list, cur.ToUpperInvariant());
            }
        }
        return null;
    }

    private record XboxPrice(string XboxId, decimal Base, decimal Sale, string? Currency);

    /// <summary>Tolerant parser: finds every object carrying XboxProductID + prices anywhere in the JSON.</summary>
    private static IEnumerable<XboxPrice> ExtractGames(string json)
    {
        var results = new List<XboxPrice>();
        try
        {
            using var doc = JsonDocument.Parse(json);
            Walk(doc.RootElement, results);
        }
        catch (JsonException) { }
        return results;

        static void Walk(JsonElement el, List<XboxPrice> acc)
        {
            if (el.ValueKind == JsonValueKind.Array)
            {
                foreach (var x in el.EnumerateArray()) Walk(x, acc);
                return;
            }
            if (el.ValueKind != JsonValueKind.Object) return;

            string? id = Str(el, "XboxProductID") ?? Str(el, "xboxProductId") ?? Str(el, "BigId");
            var basePrice = Num(el, "BasePrice") ?? Num(el, "basePrice");
            var salePrice = Num(el, "SalePrice") ?? Num(el, "salePrice");
            if (id != null && (basePrice != null || salePrice != null))
            {
                var b = (basePrice ?? salePrice!.Value) / 100m;
                var s = (salePrice ?? basePrice!.Value) / 100m;
                acc.Add(new XboxPrice(id, b, s, Str(el, "Currency") ?? Str(el, "currency")));
                return;
            }
            foreach (var p in el.EnumerateObject()) Walk(p.Value, acc);
        }

        static string? Str(JsonElement el, string name) =>
            el.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

        static decimal? Num(JsonElement el, string name)
        {
            if (!el.TryGetProperty(name, out var v)) return null;
            if (v.ValueKind == JsonValueKind.Number && v.TryGetDecimal(out var d)) return d;
            if (v.ValueKind == JsonValueKind.String && decimal.TryParse(v.GetString(), NumberStyles.Any, CultureInfo.InvariantCulture, out var s)) return s;
            return null;
        }
    }

    /// <summary>Emails customers whose wishlisted game dropped below the price they last saw.</summary>
    public async Task<int> ProcessPriceAlertsAsync(CancellationToken ct = default)
    {
        var rows = await (
            from w in _db.WishlistItems
            join g in _db.Games on w.GameId equals g.Id
            join u in _db.Users on w.UserId equals u.Id
            join p in _db.CustomerProfiles on w.UserId equals p.UserId into profiles
            from p in profiles.DefaultIfEmpty()
            where w.NotifiedPrice == null || w.NotifiedPrice != g.SalePrice
            select new { w.UserId, w.GameId, w.NotifiedPrice, g.Name, g.SalePrice, g.OriginalPrice, u.Email, u.EmailConfirmed, Alerts = p == null || p.PriceAlerts })
            .ToListAsync(ct);

        var sent = 0;
        foreach (var r in rows)
        {
            var dropped = r.NotifiedPrice.HasValue && r.SalePrice < r.NotifiedPrice.Value;
            // Claim the new price first so a failure never double-sends.
            await _db.WishlistItems.Where(w => w.UserId == r.UserId && w.GameId == r.GameId)
                .ExecuteUpdateAsync(s => s.SetProperty(w => w.NotifiedPrice, r.SalePrice), ct);
            if (!dropped) continue;
            var pct = r.NotifiedPrice!.Value > 0 ? Math.Round((1 - r.SalePrice / r.NotifiedPrice.Value) * 100) : 0;
            await _notifications.AddAsync(r.UserId, "price", $"💸 {r.Name} giảm còn {Vnd(r.SalePrice)}", $"Giảm {pct}% so với lúc bạn thêm vào Yêu thích.", $"/games/{r.GameId}");
            if (!r.Alerts || !r.EmailConfirmed || string.IsNullOrWhiteSpace(r.Email)) continue;

            try
            {
                await _email.SendNoticeAsync(r.Email!, $"{r.Name} vừa giảm giá — Moxic GameStore", "GAME YÊU THÍCH GIẢM GIÁ",
                    $"{r.Name} giảm từ {Vnd(r.NotifiedPrice.Value)} còn {Vnd(r.SalePrice)} (-{pct}%).",
                    $"Mua ngay tại moxic.co/games/{r.GameId} trước khi hết ưu đãi.",
                    "Bạn nhận email này vì game nằm trong danh sách Yêu thích. Tắt thông báo trong trang Yêu thích.");
                sent++;
            }
            catch (Exception ex) { _logger.LogWarning(ex, "Price alert email failed"); }
        }
        return sent;
    }

    private static string Vnd(decimal v) => v.ToString("#,0", CultureInfo.GetCultureInfo("vi-VN")) + "đ";
}

/// <summary>Hourly: record Moxic price changes + send wishlist alerts. Daily: Xbox Store sync.</summary>
public class PriceTrackerJob : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<PriceTrackerJob> _logger;
    private DateTime _lastXbox = DateTime.MinValue;

    public PriceTrackerJob(IServiceScopeFactory scopes, ILogger<PriceTrackerJob> logger)
    {
        _scopes = scopes;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(TimeSpan.FromMinutes(2), stoppingToken).ContinueWith(_ => { });
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopes.CreateScope();
                var svc = scope.ServiceProvider.GetRequiredService<PriceTrackerService>();
                await svc.RecordMoxicPricesAsync(stoppingToken);
                var sent = await svc.ProcessPriceAlertsAsync(stoppingToken);
                if (sent > 0) _logger.LogInformation("Price alerts sent: {sent}", sent);
                if (DateTime.UtcNow - _lastXbox > TimeSpan.FromHours(24))
                {
                    _lastXbox = DateTime.UtcNow;
                    await svc.SyncXboxAsync(stoppingToken);
                }
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex) { _logger.LogError(ex, "PriceTrackerJob error"); }

            try { await Task.Delay(TimeSpan.FromHours(1), stoppingToken); }
            catch (OperationCanceledException) { break; }
        }
    }
}
