using System.Globalization;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Moxic.Api.Services;
using Moxic.Core.Interfaces;
using Moxic.Infrastructure.Data;
using Moxic.Shared.Enums;

namespace Moxic.Api.Controllers;

/// <summary>
/// Crawler-facing SEO: per-game HTML with Open Graph / Twitter / JSON-LD (served to bots by the web
/// nginx), a stable OG image URL, and sitemap.xml. Humans never hit these HTML pages.
/// </summary>
[ApiController]
[Route("api/seo")]
public class SeoController : ControllerBase
{
    private readonly MoxicDbContext _db;
    private readonly IMinioService _minio;
    private readonly IHttpClientFactory _http;
    private readonly IMemoryCache _cache;
    private readonly string _site;
    private readonly string _apiBase;

    public SeoController(MoxicDbContext db, IMinioService minio, IHttpClientFactory http, IMemoryCache cache, IConfiguration config)
    {
        _db = db;
        _minio = minio;
        _http = http;
        _cache = cache;
        _site = (config["Site:BaseUrl"] ?? "https://moxic.co").TrimEnd('/');
        // Public API origin for absolute links (bot requests arrive via the internal web→api hop).
        _apiBase = (config["Site:ApiBaseUrl"] ?? "https://api.moxic.co").TrimEnd('/');
    }

    private static string H(string? s) => WebUtility.HtmlEncode(s ?? string.Empty);
    private static string Vnd(decimal v) => v.ToString("#,0", CultureInfo.GetCultureInfo("vi-VN")) + "đ";

    private static string PlainText(string? html, int max)
    {
        var text = Regex.Replace(html ?? string.Empty, "<[^>]+>", " ");
        text = WebUtility.HtmlDecode(Regex.Replace(text, @"\s+", " ")).Trim();
        return text.Length > max ? text[..(max - 1)].TrimEnd() + "…" : text;
    }

    // GET /api/seo/games/{id} — HTML for social/search crawlers
    [HttpGet("games/{id:guid}")]
    public async Task<IActionResult> GamePage(Guid id)
    {
        var g = await _db.Games.AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new
            {
                x.Id, x.Name, x.Description, x.SalePrice, x.OriginalPrice, x.Status, x.ReleaseDate, x.Publisher, x.ProductType,
                Genres = x.Genres.Select(z => z.Name).ToList(),
                Rating = x.Reviews.Where(r => !r.IsHidden).Average(r => (double?)r.Rating),
                Reviews = x.Reviews.Count(r => !r.IsHidden),
            })
            .FirstOrDefaultAsync();
        if (g == null) return NotFound();

        var url = $"{_site}/games/{g.Id}";
        var image = $"{_apiBase}/api/seo/games/{g.Id}/image";
        var discount = g.OriginalPrice > 0 && g.SalePrice < g.OriginalPrice ? (int)Math.Round((1 - g.SalePrice / g.OriginalPrice) * 100) : 0;
        var priceText = g.SalePrice > 0 ? Vnd(g.SalePrice) : "Liên hệ";
        var title = $"{g.Name} — {priceText}{(discount > 0 ? $" (-{discount}%)" : "")} | Moxic GameStore";
        var desc = $"{(g.Status == GameStatus.Preorder ? "Đặt trước" : "Mua")} {g.Name} cho Xbox giá {priceText}" +
                   (discount > 0 ? $", rẻ hơn Store {discount}%" : "") + ". " +
                   PlainText(g.Description, 120) + " Cài đặt tận nơi, uy tín tại Moxic.";
        desc = desc.Length > 300 ? desc[..299] + "…" : desc;

        var jsonLd = new Dictionary<string, object?>
        {
            ["@context"] = "https://schema.org",
            ["@type"] = "Product",
            ["name"] = g.Name,
            ["image"] = image,
            ["description"] = PlainText(g.Description, 500),
            ["brand"] = new { @type = "Brand", name = g.Publisher ?? "Xbox" },
            ["category"] = string.Join(", ", g.Genres),
            ["offers"] = new Dictionary<string, object?>
            {
                ["@type"] = "Offer",
                ["url"] = url,
                ["priceCurrency"] = "VND",
                ["price"] = g.SalePrice,
                ["availability"] = g.Status == GameStatus.Preorder ? "https://schema.org/PreOrder" : "https://schema.org/InStock",
                ["seller"] = new { @type = "Organization", name = "Moxic GameStore" },
            },
        };
        if (g.Reviews > 0 && g.Rating != null)
            jsonLd["aggregateRating"] = new { @type = "AggregateRating", ratingValue = Math.Round(g.Rating.Value, 1), reviewCount = g.Reviews };

        var html = new StringBuilder();
        html.Append("<!doctype html><html lang=\"vi\"><head><meta charset=\"utf-8\">");
        html.Append($"<title>{H(title)}</title>");
        html.Append($"<meta name=\"description\" content=\"{H(desc)}\">");
        html.Append($"<link rel=\"canonical\" href=\"{H(url)}\">");
        html.Append("<meta property=\"og:type\" content=\"product\"><meta property=\"og:site_name\" content=\"Moxic GameStore\"><meta property=\"og:locale\" content=\"vi_VN\">");
        html.Append($"<meta property=\"og:title\" content=\"{H(title)}\"><meta property=\"og:description\" content=\"{H(desc)}\">");
        html.Append($"<meta property=\"og:url\" content=\"{H(url)}\"><meta property=\"og:image\" content=\"{H(image)}\">");
        html.Append($"<meta property=\"product:price:amount\" content=\"{g.SalePrice.ToString(CultureInfo.InvariantCulture)}\"><meta property=\"product:price:currency\" content=\"VND\">");
        html.Append($"<meta name=\"twitter:card\" content=\"summary_large_image\"><meta name=\"twitter:title\" content=\"{H(title)}\"><meta name=\"twitter:description\" content=\"{H(desc)}\"><meta name=\"twitter:image\" content=\"{H(image)}\">");
        html.Append($"<script type=\"application/ld+json\">{JsonSerializer.Serialize(jsonLd).Replace("</", "<\\/")}</script>");
        html.Append("</head><body>");
        html.Append($"<h1>{H(g.Name)}</h1><p><strong>{H(priceText)}</strong>{(discount > 0 ? $" <s>{H(Vnd(g.OriginalPrice))}</s> -{discount}%" : "")}</p>");
        if (g.Genres.Count > 0) html.Append($"<p>Thể loại: {H(string.Join(", ", g.Genres))}</p>");
        if (g.ReleaseDate != null) html.Append($"<p>Phát hành: {g.ReleaseDate.Value.AddHours(7):dd/MM/yyyy}</p>");
        html.Append($"<p>{H(PlainText(g.Description, 2000))}</p>");
        html.Append($"<p><a href=\"{H(url)}\">Xem và mua {H(g.Name)} tại Moxic GameStore</a></p>");
        html.Append("</body></html>");

        Response.Headers.CacheControl = "public, max-age=600";
        return Content(html.ToString(), "text/html; charset=utf-8");
    }

    // GET /api/seo/games/{id}/image — stable image URL for og:image (covers are short-lived presigned URLs)
    [HttpGet("games/{id:guid}/image")]
    public async Task<IActionResult> GameImage(Guid id)
    {
        var bytes = await _cache.GetOrCreateAsync($"seo-img:{id}", async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(6);
            entry.Size = 1;
            var key = await _db.GameMedias.AsNoTracking()
                .Where(m => m.GameId == id && !m.ObjectKey.EndsWith(".mp4") && !m.ObjectKey.EndsWith(".webm") && !m.ObjectKey.EndsWith(".mov"))
                .OrderByDescending(m => m.IsPrimary).ThenBy(m => m.DisplayOrder)
                .Select(m => m.ObjectKey).FirstOrDefaultAsync();
            if (key == null) return null;
            try
            {
                var url = await _minio.GetPresignedUrlAsync(LuckySpinRules.GameBucket, key);
                var client = _http.CreateClient(PriceTrackerService.HttpClientName);
                using var res = await client.GetAsync(url);
                if (!res.IsSuccessStatusCode) return null;
                var data = await res.Content.ReadAsByteArrayAsync();
                if (data.Length > 8 * 1024 * 1024) return null;
                return new CachedImage(data, res.Content.Headers.ContentType?.MediaType ?? "image/jpeg");
            }
            catch { return null; }
        });
        if (bytes == null) return Redirect($"{_site}/icon-512.png");
        Response.Headers.CacheControl = "public, max-age=21600";
        return File(bytes.Data, bytes.ContentType);
    }

    private record CachedImage(byte[] Data, string ContentType);

    // GET /api/seo/sitemap.xml
    [HttpGet("sitemap.xml")]
    public async Task<IActionResult> Sitemap()
    {
        var games = await _db.Games.AsNoTracking().OrderByDescending(g => g.UpdatedAt).Select(g => new { g.Id, g.UpdatedAt }).ToListAsync();
        var sb = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\"?><urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">");
        foreach (var (path, freq, prio) in new[] { ("/", "daily", "1.0"), ("/games", "daily", "0.9"), ("/rent", "daily", "0.8"), ("/release-calendar", "weekly", "0.7"), ("/lucky-spin", "weekly", "0.6"), ("/rewards", "monthly", "0.5"), ("/leaderboard", "daily", "0.5") })
            sb.Append($"<url><loc>{_site}{path}</loc><changefreq>{freq}</changefreq><priority>{prio}</priority></url>");
        foreach (var g in games)
            sb.Append($"<url><loc>{_site}/games/{g.Id}</loc><lastmod>{g.UpdatedAt:yyyy-MM-dd}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>");
        sb.Append("</urlset>");
        Response.Headers.CacheControl = "public, max-age=3600";
        return Content(sb.ToString(), "application/xml; charset=utf-8");
    }
}
