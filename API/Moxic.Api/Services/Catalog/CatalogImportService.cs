using Microsoft.EntityFrameworkCore;
using Moxic.Core.Entities;
using Moxic.Core.Interfaces;
using Moxic.Infrastructure.Data;
using Moxic.Shared.Enums;

namespace Moxic.Api.Services.Catalog;

public record CrawlPageResult(int Added, int Updated, int Skipped);
public record PendingGameDto(Guid Id, string Name, string? XboxProductId, DateTime? ReleaseDate, string Status, decimal OriginalPrice,
    decimal SalePrice, string PriceMode, int? PopularityRank, string? PosterUrl, string? Publisher, string? ImportSource, DateTime CreatedAt);

/// <summary>
/// Xbox catalog import: crawled or CSV games land unpublished (review queue), priced by the catalog formula unless set by hand;
/// publishing downloads their Xbox images into MinIO. Admin-only, so every query here ignores the "published" filter.
/// </summary>
public class CatalogImportService
{
    /// <summary>"Game hot" = within the top N of the Xbox Store popularity order.</summary>
    public const int HotRank = 300;
    private const string Bucket = "moxic-games";
    private const long MaxImageBytes = 10 * 1024 * 1024;
    private static readonly decimal[] RoundOptions = { 1, 1000, 5000, 10000 };

    private readonly MoxicDbContext _db;
    private readonly IMinioService _minio;
    private readonly IHttpClientFactory _http;
    private readonly ILogger<CatalogImportService> _logger;

    public CatalogImportService(MoxicDbContext db, IMinioService minio, IHttpClientFactory http, ILogger<CatalogImportService> logger)
    {
        _db = db;
        _minio = minio;
        _http = http;
        _logger = logger;
    }

    private IQueryable<Game> AllGames => _db.Games.IgnoreQueryFilters();

    // ───────── formula settings ─────────

    public Task<CatalogSettings?> GetSettingsAsync() => _db.CatalogSettings.AsNoTracking().FirstOrDefaultAsync(s => s.Id == 1);

    public async Task<string?> SaveSettingsAsync(decimal percent, decimal add, decimal roundTo)
    {
        if (percent <= 0 || percent > 500) return "Hệ số phải từ 1 đến 500%";
        if (!RoundOptions.Contains(roundTo)) return "Làm tròn chỉ nhận 1, 1.000, 5.000 hoặc 10.000";
        if (Math.Abs(add) > 100_000_000) return "Số tiền cộng thêm không hợp lệ";
        var s = await _db.CatalogSettings.FirstOrDefaultAsync(x => x.Id == 1);
        if (s == null) _db.CatalogSettings.Add(s = new CatalogSettings { Id = 1 });
        s.PricePercent = percent;
        s.PriceAdd = Math.Round(add, 0);
        s.PriceRoundTo = roundTo;
        s.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return null;
    }

    private IQueryable<Game> FormulaTargets(bool includePublished) =>
        AllGames.Where(g => g.PriceMode == "Formula" && (includePublished || !g.IsPublished));

    public Task<int> CountFormulaTargetsAsync(bool includePublished) => FormulaTargets(includePublished).CountAsync();

    /// <summary>Recomputes the selling price of formula-priced games (never "Manual" ones). Returns how many changed.</summary>
    public async Task<int> ApplyFormulaAsync(bool includePublished)
    {
        var s = await GetSettingsAsync();
        if (!PriceFormula.IsSet(s)) return 0;
        var changed = 0;
        foreach (var g in await FormulaTargets(includePublished).ToListAsync())
        {
            var price = PriceFormula.Compute(g.OriginalPrice, s);
            if (price == g.SalePrice) continue;
            g.SalePrice = price;
            g.UpdatedAt = DateTime.UtcNow;
            changed++;
        }
        await _db.SaveChangesAsync();
        return changed;
    }

    // ───────── crawl ─────────

    /// <summary>
    /// Adds one crawled page: new Xbox-console games with a VND price go to the review queue; games already waiting get their
    /// popularity rank and Xbox price refreshed; published games, non-games and free games are skipped.
    /// </summary>
    public async Task<CrawlPageResult> ImportPageAsync(IReadOnlyList<XboxProduct> items, int rankStart, CancellationToken ct)
    {
        var settings = await GetSettingsAsync();
        var ids = items.Select(p => p.ProductId.ToUpperInvariant()).ToList();
        var existing = await AllGames.Where(g => g.XboxProductId != null && ids.Contains(g.XboxProductId.ToUpper())).ToListAsync(ct);
        var byId = existing.GroupBy(g => g.XboxProductId!.ToUpperInvariant()).ToDictionary(g => g.Key, g => g.First());
        var genres = await GenresByNameAsync(ct);
        int added = 0, updated = 0, skipped = 0;
        var now = DateTime.UtcNow;

        for (var i = 0; i < items.Count; i++)
        {
            var p = items[i];
            var rank = rankStart + i;
            var key = p.ProductId.ToUpperInvariant();
            if (byId.TryGetValue(key, out var old))
            {
                if (!old.IsPublished)
                {
                    old.PopularityRank = rank;
                    if (p.Msrp is > 0 && p.Msrp != old.OriginalPrice)
                    {
                        old.OriginalPrice = p.Msrp.Value;
                        if (old.PriceMode == "Formula") old.SalePrice = PriceFormula.Compute(old.OriginalPrice, settings);
                    }
                    old.UpdatedAt = now;
                    updated++;
                }
                else skipped++;
                continue;
            }
            if (!string.Equals(p.Kind, "Game", StringComparison.OrdinalIgnoreCase) || p.Msrp is not > 0 || string.IsNullOrWhiteSpace(p.Title))
            {
                skipped++;
                continue;
            }
            var game = NewPendingGame(p, settings, now, "xbox");
            game.PopularityRank = rank;
            foreach (var c in p.Categories)
                if (genres.TryGetValue(c.Trim().ToLowerInvariant(), out var genre)) game.Genres.Add(genre);
            _db.Games.Add(game);
            byId[key] = game;
            added++;
        }
        await _db.SaveChangesAsync(ct);
        _db.ChangeTracker.Clear(); // keep a long crawl's memory flat
        return new CrawlPageResult(added, updated, skipped);
    }

    internal static Game NewPendingGame(XboxProduct p, CatalogSettings? settings, DateTime now, string source)
    {
        var original = p.Msrp ?? 0;
        // Postgres only stores UTC; CSV dates arrive without a kind.
        var release = p.ReleaseDate is { } d ? (d.Kind == DateTimeKind.Utc ? d : DateTime.SpecifyKind(d, DateTimeKind.Utc)) : (DateTime?)null;
        p = p with { ReleaseDate = release };
        return new Game
        {
            Id = Guid.NewGuid(),
            Name = Cut(p.Title.Trim(), 200),
            Description = p.Description?.Trim() ?? string.Empty,
            OriginalPrice = original,
            SalePrice = PriceFormula.Compute(original, settings),
            PriceMode = "Formula",
            Status = p.ReleaseDate > now ? GameStatus.Preorder : GameStatus.Available,
            ReleaseDate = p.ReleaseDate,
            Publisher = p.Publisher is { Length: > 0 } pub ? Cut(pub, 100) : null,
            XboxProductId = p.ProductId.ToUpperInvariant(),
            PriceRegion = "vn",
            ProductType = "Game",
            IsPublished = false,
            ImportSource = source,
            XboxPosterUrl = p.PosterUrl,
            XboxHeroUrl = p.HeroUrl,
            CreatedAt = now,
            UpdatedAt = now,
        };
    }

    private async Task<Dictionary<string, Genre>> GenresByNameAsync(CancellationToken ct) =>
        (await _db.Genres.ToListAsync(ct)).GroupBy(g => g.Name.Trim().ToLowerInvariant()).ToDictionary(g => g.Key, g => g.First());

    // ───────── review queue ─────────

    /// <summary>Game name for progress messages (synchronous: called inside a lock).</summary>
    public string? NameOf(Guid id) => AllGames.AsNoTracking().Where(g => g.Id == id).Select(g => g.Name).FirstOrDefault();

    public async Task<(List<PendingGameDto> Items, int Total)> PendingAsync(string? q, bool hot, string? sort, int page, int pageSize,
        IReadOnlyCollection<Guid>? beingPublished = null)
    {
        var query = AllGames.AsNoTracking().Where(g => !g.IsPublished);
        if (beingPublished is { Count: > 0 }) query = query.Where(g => !beingPublished.Contains(g.Id));
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim().ToLower();
            query = query.Where(g => g.Name.ToLower().Contains(term) || (g.XboxProductId != null && g.XboxProductId.ToLower() == term));
        }
        if (hot) query = query.Where(g => g.PopularityRank != null && g.PopularityRank <= HotRank);
        query = sort switch
        {
            "new" => query.OrderByDescending(g => g.ReleaseDate),
            "price" => query.OrderByDescending(g => g.OriginalPrice),
            "added" => query.OrderByDescending(g => g.CreatedAt),
            _ => query.OrderBy(g => g.PopularityRank == null).ThenBy(g => g.PopularityRank).ThenBy(g => g.Name),
        };
        var total = await query.CountAsync();
        pageSize = Math.Clamp(pageSize, 10, 200);
        var items = await query.Skip((Math.Max(1, page) - 1) * pageSize).Take(pageSize)
            .Select(g => new PendingGameDto(g.Id, g.Name, g.XboxProductId, g.ReleaseDate, g.Status.ToString(), g.OriginalPrice, g.SalePrice,
                g.PriceMode, g.PopularityRank, g.XboxPosterUrl, g.Publisher, g.ImportSource, g.CreatedAt))
            .ToListAsync();
        return (items, total);
    }

    /// <summary>Hand-set price switches the game to "Manual"; mode "Formula" recomputes it from the formula.</summary>
    public async Task<string?> SetPriceAsync(Guid id, decimal? salePrice, string mode)
    {
        var g = await AllGames.FirstOrDefaultAsync(x => x.Id == id);
        if (g == null) return "Không tìm thấy game";
        if (mode == "Formula")
        {
            g.PriceMode = "Formula";
            g.SalePrice = PriceFormula.Compute(g.OriginalPrice, await GetSettingsAsync());
        }
        else
        {
            if (salePrice is not >= 0 || salePrice > 1_000_000_000) return "Giá bán không hợp lệ";
            g.PriceMode = "Manual";
            g.SalePrice = Math.Round(salePrice.Value, 0);
        }
        g.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return null;
    }

    /// <summary>
    /// Publishes waiting games: those with a selling price get their Xbox images copied into MinIO (an image that fails is
    /// skipped, the game still goes live) and become visible. Returns the games refused, with why.
    /// </summary>
    public async Task<List<(Guid Id, string Error)>> PublishAsync(IEnumerable<Guid> ids, CancellationToken ct)
    {
        var list = ids.Distinct().ToList();
        var games = await AllGames.Include(g => g.Media).Where(g => list.Contains(g.Id) && !g.IsPublished).ToListAsync(ct);
        var errors = new List<(Guid, string)>();
        foreach (var g in games)
        {
            if (g.SalePrice <= 0)
            {
                errors.Add((g.Id, $"{g.Name}: chưa có giá bán"));
                continue;
            }
            if (g.Media.Count == 0)
            {
                var order = 0;
                foreach (var (url, width) in new[] { (g.XboxPosterUrl, 900), (g.XboxHeroUrl, 1920) })
                {
                    var key = await CopyImageAsync(g.Id, url, width, ct);
                    if (key == null) continue;
                    // Added through the DbSet: a new GameMedia with a preset key reached via the navigation is taken for an existing row (UPDATE → concurrency error).
                    _db.GameMedias.Add(new GameMedia { Id = Guid.NewGuid(), GameId = g.Id, ObjectKey = key, IsPrimary = order == 0, DisplayOrder = order, CreatedAt = DateTime.UtcNow });
                    order++;
                }
            }
            g.IsPublished = true;
            g.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
        }
        return errors;
    }

    /// <summary>Downloads an Xbox CDN image (resized server-side) to a temp file, then uploads it. Null when it can't.</summary>
    private async Task<string?> CopyImageAsync(Guid gameId, string? url, int width, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(url) || !Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme != "https") return null;
        var src = url.Contains("store-images.s-microsoft.com") ? $"{url}{(url.Contains('?') ? '&' : '?')}w={width}" : url;
        var tmp = Path.GetTempFileName();
        try
        {
            using var res = await _http.CreateClient(XboxBrowseClient.HttpClientName).GetAsync(src, HttpCompletionOption.ResponseHeadersRead, ct);
            if (!res.IsSuccessStatusCode || res.Content.Headers.ContentLength > MaxImageBytes) return null;
            var type = res.Content.Headers.ContentType?.MediaType ?? "image/jpeg";
            if (!type.StartsWith("image/")) return null;
            await using (var file = File.Create(tmp))
            await using (var body = await res.Content.ReadAsStreamAsync(ct))
            {
                var buffer = new byte[81920];
                long total = 0;
                int n;
                while ((n = await body.ReadAsync(buffer, ct)) > 0)
                {
                    total += n;
                    if (total > MaxImageBytes) return null;
                    await file.WriteAsync(buffer.AsMemory(0, n), ct);
                }
            }
            var ext = type switch { "image/png" => ".png", "image/webp" => ".webp", _ => ".jpg" };
            var key = $"games/{gameId}/{Guid.NewGuid():N}{ext}";
            await using var upload = File.OpenRead(tmp);
            await _minio.UploadImageAsync(Bucket, key, upload, type);
            return key;
        }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException or IOException)
        {
            _logger.LogWarning(e, "Copying image for game {Game} failed", gameId);
            return null;
        }
        finally
        {
            try { File.Delete(tmp); } catch (IOException) { }
        }
    }

    /// <summary>Deletes waiting games (never published ones) and any images they already have in MinIO.</summary>
    public async Task<int> DeletePendingAsync(IEnumerable<Guid> ids)
    {
        var list = ids.Distinct().ToList();
        var games = await AllGames.Include(g => g.Media).Where(g => list.Contains(g.Id) && !g.IsPublished).ToListAsync();
        foreach (var m in games.SelectMany(g => g.Media))
            try { await _minio.DeleteObjectAsync(Bucket, m.ObjectKey); } catch (Exception e) { _logger.LogWarning(e, "Delete image {Key} failed", m.ObjectKey); }
        _db.Games.RemoveRange(games);
        await _db.SaveChangesAsync();
        return games.Count;
    }

    // ───────── CSV ─────────

    public record CsvRowResult(int Row, string Status, string? Message);
    public const int MaxCsvRows = 1000;

    /// <summary>
    /// Imports CSV rows into the review queue (columns: <see cref="CatalogCsv.Columns"/>). A row with an Xbox id fills what it
    /// lacks from Microsoft; without one it needs a name and an original price. A selling price makes the game "Manual".
    /// Bad rows are reported and never stop the rest.
    /// </summary>
    public async Task<List<CsvRowResult>> ImportCsvAsync(string text, CancellationToken ct, XboxBrowseClient? xbox = null)
    {
        var rows = CatalogCsv.Parse(text);
        var results = new List<CsvRowResult>();
        if (rows.Count < 2) return results;
        var header = rows[0].Select(h => h.Trim().ToLowerInvariant()).ToArray();
        int Col(string name) => Array.IndexOf(header, name);
        var settings = await GetSettingsAsync();
        var genres = await GenresByNameAsync(ct);
        var vi = System.Globalization.CultureInfo.GetCultureInfo("vi-VN");

        foreach (var (cells, index) in rows.Skip(1).Take(MaxCsvRows).Select((r, i) => (r, i + 2)))
        {
            string V(string name) { var i = Col(name); return i >= 0 && i < cells.Length ? cells[i].Trim() : ""; }
            if (cells.All(string.IsNullOrWhiteSpace) && cells.Length <= 1) continue;
            static decimal? Money(string s) =>
                decimal.TryParse(s.Replace(".", "").Replace(",", "").Replace("đ", "").Replace(" ", ""), out var v) && v >= 0 ? v : null;
            try
            {
                var id = V("xbox_product_id").ToUpperInvariant();
                if (id != "" && await AllGames.AnyAsync(g => g.XboxProductId != null && g.XboxProductId.ToUpper() == id, ct))
                {
                    results.Add(new(index, "skipped", $"Đã có game {id}"));
                    continue;
                }
                XboxProduct? fromXbox = id != "" && xbox != null ? await xbox.FetchByIdAsync(id, ct) : null;
                var name = V("ten_game") is { Length: > 0 } n ? n : fromXbox?.Title ?? "";
                var original = Money(V("gia_goc")) ?? fromXbox?.Msrp;
                if (name == "" || original is not > 0)
                {
                    results.Add(new(index, "error", id != "" && fromXbox == null ? $"Không lấy được thông tin {id} từ Xbox" : "Thiếu tên game hoặc giá gốc"));
                    continue;
                }
                DateTime? release = DateTime.TryParse(V("ngay_ra_mat"), System.Globalization.CultureInfo.InvariantCulture,
                    System.Globalization.DateTimeStyles.AssumeUniversal | System.Globalization.DateTimeStyles.AdjustToUniversal, out var rd) ? rd
                    : DateTime.TryParse(V("ngay_ra_mat"), vi, System.Globalization.DateTimeStyles.AssumeUniversal | System.Globalization.DateTimeStyles.AdjustToUniversal, out var rd2) ? rd2
                    : fromXbox?.ReleaseDate;
                var image = V("link_anh");
                var p = new XboxProduct(id, "Game", name, V("mo_ta") is { Length: > 0 } d ? d : fromXbox?.Description,
                    V("nha_phat_hanh") is { Length: > 0 } pub ? pub : fromXbox?.Publisher, release, new(),
                    image.StartsWith("https://") ? image : fromXbox?.PosterUrl, fromXbox?.HeroUrl, original);
                var game = NewPendingGame(p, settings, DateTime.UtcNow, "csv");
                if (id == "") game.XboxProductId = null;
                if (Money(V("gia_ban")) is { } sale) { game.SalePrice = sale; game.PriceMode = "Manual"; }
                if (V("trang_thai").Equals("Preorder", StringComparison.OrdinalIgnoreCase)) game.Status = GameStatus.Preorder;
                else if (V("trang_thai").Equals("Available", StringComparison.OrdinalIgnoreCase)) game.Status = GameStatus.Available;
                if (V("vung") is { Length: > 0 } region) game.Region = Cut(region, 30);
                foreach (var g in V("the_loai").Split('|', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                    if (genres.TryGetValue(g.ToLowerInvariant(), out var genre)) game.Genres.Add(genre);
                _db.Games.Add(game);
                await _db.SaveChangesAsync(ct);
                _db.ChangeTracker.Clear();
                genres = await GenresByNameAsync(ct);
                results.Add(new(index, "added", game.Name));
            }
            catch (Exception e) when (e is DbUpdateException or HttpRequestException or System.Text.Json.JsonException)
            {
                _db.ChangeTracker.Clear();
                results.Add(new(index, "error", e.Message));
            }
        }
        return results;
    }

    private static string Cut(string s, int max) => s.Length > max ? s[..max] : s;
}
