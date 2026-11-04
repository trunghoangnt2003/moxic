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

    // Escape only HTML-significant characters; keep Vietnamese as readable UTF-8 for crawlers/AI.
    private static string H(string? s) => (s ?? string.Empty).Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace("\"", "&quot;").Replace("'", "&#39;");
    private static string Vnd(decimal v) => v.ToString("#,0", CultureInfo.GetCultureInfo("vi-VN")) + "đ";

    private static string PlainText(string? html, int max)
    {
        var text = Regex.Replace(html ?? string.Empty, "<[^>]+>", " ");
        text = WebUtility.HtmlDecode(Regex.Replace(text, @"\s+", " ")).Trim();
        return text.Length > max ? text[..(max - 1)].TrimEnd() + "…" : text;
    }

    // GET /api/seo/games/{id} — HTML for social/search crawlers
    [HttpGet("games/{id:guid}")]
    public async Task<IActionResult> GamePage(Guid id, [FromQuery] string? lang = null)
    {
        var en = string.Equals(lang, "en", StringComparison.OrdinalIgnoreCase);
        var g = await _db.Games.AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new
            {
                x.Id, x.Name, x.NameEn, x.Description, x.DescriptionEn, x.SalePrice, x.OriginalPrice, x.Status, x.ReleaseDate, x.Publisher, x.ProductType,
                Genres = x.Genres.Select(z => z.Name).ToList(),
                Rating = x.Reviews.Where(r => !r.IsHidden).Average(r => (double?)r.Rating),
                Reviews = x.Reviews.Count(r => !r.IsHidden),
            })
            .FirstOrDefaultAsync();
        if (g == null) return NotFound();

        var name = en && !string.IsNullOrWhiteSpace(g.NameEn) ? g.NameEn : g.Name;
        var description = en && !string.IsNullOrWhiteSpace(g.DescriptionEn) ? g.DescriptionEn : g.Description;
        var viUrl = $"{_site}/games/{g.Id}";
        var enUrl = $"{_site}/en/games/{g.Id}";
        var url = en ? enUrl : viUrl;
        var image = $"{_apiBase}/api/seo/games/{g.Id}/image";
        var discount = g.OriginalPrice > 0 && g.SalePrice < g.OriginalPrice ? (int)Math.Round((1 - g.SalePrice / g.OriginalPrice) * 100) : 0;
        var priceText = g.SalePrice > 0 ? Vnd(g.SalePrice) : (en ? "Contact us" : "Liên hệ");
        var title = $"{name} — {priceText}{(discount > 0 ? $" (-{discount}%)" : "")} | Moxic GameStore";
        var desc = en
            ? $"{(g.Status == GameStatus.Preorder ? "Pre-order" : "Buy")} {name} for Xbox at {priceText}" +
              (discount > 0 ? $", {discount}% cheaper than the Store" : "") + ". " +
              PlainText(description, 120) + " Installed on your account by Moxic."
            : $"{(g.Status == GameStatus.Preorder ? "Đặt trước" : "Mua")} {name} cho Xbox giá {priceText}" +
              (discount > 0 ? $", rẻ hơn Store {discount}%" : "") + ". " +
              PlainText(description, 120) + " Cài đặt tận nơi, uy tín tại Moxic.";
        desc = desc.Length > 300 ? desc[..299] + "…" : desc;

        var jsonLd = new Dictionary<string, object?>
        {
            ["@context"] = "https://schema.org",
            ["@type"] = "Product",
            ["name"] = name,
            ["image"] = image,
            ["description"] = PlainText(description, 500),
            ["brand"] = new Dictionary<string, object?> { ["@type"] = "Brand", ["name"] = g.Publisher ?? "Xbox" },
            ["category"] = string.Join(", ", g.Genres),
            ["offers"] = new Dictionary<string, object?>
            {
                ["@type"] = "Offer",
                ["url"] = url,
                ["priceCurrency"] = "VND",
                ["price"] = g.SalePrice,
                ["availability"] = g.Status == GameStatus.Preorder ? "https://schema.org/PreOrder" : "https://schema.org/InStock",
                ["seller"] = new Dictionary<string, object?> { ["@type"] = "Organization", ["name"] = "Moxic GameStore" },
            },
        };
        if (g.Reviews > 0 && g.Rating != null)
            jsonLd["aggregateRating"] = new Dictionary<string, object?> { ["@type"] = "AggregateRating", ["ratingValue"] = Math.Round(g.Rating.Value, 1), ["reviewCount"] = g.Reviews };

        var html = new StringBuilder();
        html.Append($"<!doctype html><html lang=\"{(en ? "en" : "vi")}\"><head><meta charset=\"utf-8\">");
        html.Append($"<title>{H(title)}</title>");
        html.Append($"<meta name=\"description\" content=\"{H(desc)}\">");
        html.Append($"<link rel=\"canonical\" href=\"{H(url)}\">");
        html.Append($"<link rel=\"alternate\" hreflang=\"vi\" href=\"{H(viUrl)}\"><link rel=\"alternate\" hreflang=\"en\" href=\"{H(enUrl)}\"><link rel=\"alternate\" hreflang=\"x-default\" href=\"{H(viUrl)}\">");
        html.Append($"<meta property=\"og:type\" content=\"product\"><meta property=\"og:site_name\" content=\"Moxic GameStore\"><meta property=\"og:locale\" content=\"{(en ? "en_US" : "vi_VN")}\">");
        html.Append($"<meta property=\"og:title\" content=\"{H(title)}\"><meta property=\"og:description\" content=\"{H(desc)}\">");
        html.Append($"<meta property=\"og:url\" content=\"{H(url)}\"><meta property=\"og:image\" content=\"{H(image)}\">");
        html.Append($"<meta property=\"product:price:amount\" content=\"{g.SalePrice.ToString(CultureInfo.InvariantCulture)}\"><meta property=\"product:price:currency\" content=\"VND\">");
        html.Append($"<meta name=\"twitter:card\" content=\"summary_large_image\"><meta name=\"twitter:title\" content=\"{H(title)}\"><meta name=\"twitter:description\" content=\"{H(desc)}\"><meta name=\"twitter:image\" content=\"{H(image)}\">");
        html.Append($"<script type=\"application/ld+json\">{JsonSerializer.Serialize(jsonLd).Replace("</", "<\\/")}</script>");
        html.Append("</head><body>");
        html.Append($"<h1>{H(name)}</h1><p><strong>{H(priceText)}</strong>{(discount > 0 ? $" <s>{H(Vnd(g.OriginalPrice))}</s> -{discount}%" : "")}</p>");
        if (g.Genres.Count > 0) html.Append($"<p>{(en ? "Genre" : "Thể loại")}: {H(string.Join(", ", g.Genres))}</p>");
        if (g.ReleaseDate != null) html.Append($"<p>{(en ? "Release" : "Phát hành")}: {g.ReleaseDate.Value.AddHours(7):dd/MM/yyyy}</p>");
        html.Append($"<p>{H(PlainText(description, 2000))}</p>");
        html.Append(en
            ? $"<p><a href=\"{H(url)}\">See and buy {H(name)} at Moxic GameStore</a> · <a href=\"{H(viUrl)}\" hreflang=\"vi\">Tiếng Việt</a></p>"
            : $"<p><a href=\"{H(url)}\">Xem và mua {H(name)} tại Moxic GameStore</a> · <a href=\"{H(enUrl)}\" hreflang=\"en\">English</a></p>");
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

    // GET /api/seo/page?path=/bang-gia-xbox — text-first HTML (+ JSON-LD) for search engines and AI assistants
    [HttpGet("page")]
    public async Task<IActionResult> Page([FromQuery] string? path, [FromServices] SeoContentService content)
    {
        var (html, found) = await content.PageAsync(path ?? "/");
        if (!found) return NotFound();
        Response.Headers.CacheControl = "public, max-age=900";
        return Content(html, "text/html; charset=utf-8");
    }

    // GET /api/seo/prices — the same price comparison for the web page
    [HttpGet("prices")]
    public async Task<IActionResult> Prices([FromServices] SeoContentService content)
    {
        var rows = await content.PricesAsync();
        var saving = rows.Where(r => r.SavePercent > 0).ToList();
        Response.Headers.CacheControl = "public, max-age=600";
        return Ok(new
        {
            updatedAt = DateTime.UtcNow,
            storeCheckedAt = rows.Max(r => r.StoreCheckedAt),
            avgSave = saving.Count > 0 ? (int)Math.Round(saving.Average(r => r.SavePercent)) : 0,
            items = rows,
        });
    }

    // GET /api/seo/llms.txt — served at moxic.co/llms.txt
    [HttpGet("llms.txt")]
    public async Task<IActionResult> Llms([FromServices] SeoContentService content)
    {
        Response.Headers.CacheControl = "public, max-age=1800";
        return Content(await content.LlmsTxtAsync(), "text/plain; charset=utf-8");
    }

    // GET /api/seo/faq — public FAQ for the /hoi-dap page
    [HttpGet("faq")]
    public async Task<IActionResult> Faq([FromServices] SeoContentService content) => Ok(await content.FaqAsync());

    // GET /api/seo/sitemap.xml
    [HttpGet("sitemap.xml")]
    public async Task<IActionResult> Sitemap()
    {
        var games = await _db.Games.AsNoTracking().OrderByDescending(g => g.UpdatedAt).Select(g => new { g.Id, g.UpdatedAt }).ToListAsync();
        var sb = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\"?><urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\" xmlns:xhtml=\"http://www.w3.org/1999/xhtml\">");
        string Vi(string path) => _site + path;
        string En(string path) => _site + (path == "/" ? "/en" : "/en" + path);
        void Both(string path, string extra)
        {
            var alt = $"<xhtml:link rel=\"alternate\" hreflang=\"vi\" href=\"{Vi(path)}\"/><xhtml:link rel=\"alternate\" hreflang=\"en\" href=\"{En(path)}\"/><xhtml:link rel=\"alternate\" hreflang=\"x-default\" href=\"{Vi(path)}\"/>";
            sb.Append($"<url><loc>{Vi(path)}</loc>{alt}{extra}</url>");
            sb.Append($"<url><loc>{En(path)}</loc>{alt}{extra}</url>");
        }
        foreach (var (path, freq, prio) in new[] { ("/", "daily", "1.0"), ("/games", "daily", "0.9"), ("/bang-gia-xbox", "daily", "0.9"), ("/hoi-dap", "weekly", "0.8"), ("/rent", "daily", "0.8"), ("/release-calendar", "weekly", "0.7"), ("/lucky-spin", "weekly", "0.6"), ("/rewards", "monthly", "0.5"), ("/leaderboard", "daily", "0.5"), ("/doan-game", "daily", "0.6") })
            Both(path, $"<changefreq>{freq}</changefreq><priority>{prio}</priority>");
        foreach (var g in games)
            Both($"/games/{g.Id}", $"<lastmod>{g.UpdatedAt:yyyy-MM-dd}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority>");
        sb.Append("</urlset>");
        Response.Headers.CacheControl = "public, max-age=3600";
        return Content(sb.ToString(), "application/xml; charset=utf-8");
    }
}
