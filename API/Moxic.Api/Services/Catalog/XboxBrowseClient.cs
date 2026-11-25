using System.Globalization;
using System.Text;
using System.Text.Json;

namespace Moxic.Api.Services.Catalog;

public record XboxProduct(string ProductId, string Kind, string Title, string? Description, string? Publisher, DateTime? ReleaseDate,
    List<string> Categories, string? PosterUrl, string? HeroUrl, decimal? Msrp);

/// <summary>
/// Xbox Store VN catalog through the browse API xbox.com itself uses (undocumented, no key): every Xbox-console game,
/// most popular first, prices in VND. Single products come from the public display catalog.
/// </summary>
public class XboxBrowseClient
{
    public const string HttpClientName = "xboxcatalog";
    private const string BrowseUrl = "https://emerald.xboxservices.com/xboxcomfd/browse?locale=vi-VN";
    private const DateTimeStyles Utc = DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal;
    private readonly IHttpClientFactory _http;

    public XboxBrowseClient(IHttpClientFactory http) => _http = http;

    public static string SortFor(string list) => list switch
    {
        "popular" => "MostPopular desc",
        "new" => "ReleaseDate desc",
        "discount" => "DiscountPercentage desc",
        "wishlist" => "WishlistCountTotal desc",
        _ => throw new ArgumentException($"Unknown list '{list}'", nameof(list)),
    };

    /// <summary>One page (25 products) of Xbox-console games in the given order; NextToken is null on the last page.</summary>
    public virtual async Task<(List<XboxProduct> Items, string? NextToken)> FetchPageAsync(string list, string? token, CancellationToken ct)
    {
        var filters = "{\"orderby\":{\"id\":\"orderby\",\"choices\":[{\"id\":\"" + SortFor(list) + "\"}]}," +
                      "\"PlayWith\":{\"id\":\"PlayWith\",\"choices\":[{\"id\":\"XboxSeriesX|S\"},{\"id\":\"XboxOne\"}]}}";
        var body = JsonSerializer.Serialize(new
        {
            Filters = Convert.ToBase64String(Encoding.UTF8.GetBytes(filters)),
            ReturnFilters = false,
            ChannelKeyToBeUsedInResponse = "BROWSE_CHANNELID=_FILTERS=",
            EncodedCT = token ?? "",
            ChannelId = "",
        });
        using var req = new HttpRequestMessage(HttpMethod.Post, BrowseUrl) { Content = new StringContent(body, Encoding.UTF8, "application/json") };
        req.Headers.Add("x-ms-api-version", "1.1");
        req.Headers.Add("MS-CV", Guid.NewGuid().ToString("N")[..16] + ".0");
        using var res = await _http.CreateClient(HttpClientName).SendAsync(req, ct);
        if (!res.IsSuccessStatusCode) throw new HttpRequestException($"Xbox Store trả về {(int)res.StatusCode}");
        return ParsePage(await res.Content.ReadAsStringAsync(ct));
    }

    public static (List<XboxProduct> Items, string? NextToken) ParsePage(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        var items = new List<XboxProduct>();
        if (root.TryGetProperty("productSummaries", out var ps) && ps.ValueKind == JsonValueKind.Array)
            foreach (var p in ps.EnumerateArray())
            {
                decimal? msrp = null;
                if (p.TryGetProperty("specificPrices", out var sp) && sp.TryGetProperty("purchaseable", out var pu) && pu.ValueKind == JsonValueKind.Array)
                    foreach (var pr in pu.EnumerateArray())
                        if (pr.TryGetProperty("msrp", out var m) && m.ValueKind == JsonValueKind.Number) { msrp = m.GetDecimal(); break; }
                items.Add(new XboxProduct(
                    Str(p, "productId") ?? "", Str(p, "productKind") ?? "", Str(p, "title") ?? "", Str(p, "shortDescription"), Str(p, "publisherName"),
                    DateTime.TryParse(Str(p, "releaseDate"), CultureInfo.InvariantCulture, Utc, out var d) ? d : null,
                    p.TryGetProperty("categories", out var c) && c.ValueKind == JsonValueKind.Array
                        ? c.EnumerateArray().Select(x => x.GetString() ?? "").Where(x => x != "").ToList() : new(),
                    Img(p, "poster") ?? Img(p, "boxArt"), Img(p, "superHeroArt"), msrp));
            }

        string? next = null;
        if (root.TryGetProperty("channels", out var chs) && chs.ValueKind == JsonValueKind.Object)
            foreach (var ch in chs.EnumerateObject())
            {
                var ctoken = Str(ch.Value, "encodedCT");
                if (string.IsNullOrEmpty(ctoken)) break;
                try
                {
                    using var ctDoc = JsonDocument.Parse(Encoding.UTF8.GetString(Convert.FromBase64String(ctoken)));
                    if (ctDoc.RootElement.TryGetProperty("HasMore", out var hm) && hm.ValueKind == JsonValueKind.True) next = ctoken;
                }
                catch (Exception e) when (e is FormatException or JsonException) { }
                break;
            }
        return (items, next);
    }

    /// <summary>One product by id (CSV rows with only an id): display catalog, market VN, Vietnamese text, VND price.</summary>
    public virtual async Task<XboxProduct?> FetchByIdAsync(string productId, CancellationToken ct)
    {
        var url = $"https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds={Uri.EscapeDataString(productId)}&market=VN&languages=vi-vn,en-us";
        using var res = await _http.CreateClient(HttpClientName).GetAsync(url, ct);
        if (!res.IsSuccessStatusCode) return null;
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));
        if (!doc.RootElement.TryGetProperty("Products", out var products) || products.GetArrayLength() == 0) return null;
        var p = products[0];
        if (!p.TryGetProperty("LocalizedProperties", out var lps) || lps.GetArrayLength() == 0) return null;
        var lp = lps[0];
        string? poster = null, hero = null;
        if (lp.TryGetProperty("Images", out var imgs))
            foreach (var i in imgs.EnumerateArray())
            {
                var uri = Str(i, "Uri");
                if (uri == null) continue;
                if (uri.StartsWith("//")) uri = "https:" + uri;
                switch (Str(i, "ImagePurpose"))
                {
                    case "Poster": poster = uri; break;
                    case "BoxArt": poster ??= uri; break;
                    case "SuperHeroArt": hero ??= uri; break;
                }
            }
        DateTime? release = null;
        if (p.TryGetProperty("MarketProperties", out var mp) && mp.GetArrayLength() > 0
            && DateTime.TryParse(Str(mp[0], "OriginalReleaseDate"), CultureInfo.InvariantCulture, Utc, out var rd))
            release = rd;
        decimal? msrp = null;
        if (p.TryGetProperty("DisplaySkuAvailabilities", out var skus))
            foreach (var sku in skus.EnumerateArray())
            {
                if (!sku.TryGetProperty("Availabilities", out var avs)) continue;
                foreach (var av in avs.EnumerateArray())
                    if (av.TryGetProperty("OrderManagementData", out var omd) && omd.TryGetProperty("Price", out var pr)
                        && pr.TryGetProperty("MSRP", out var m) && m.TryGetDecimal(out var mv) && mv > 0) { msrp = mv; break; }
                if (msrp != null) break;
            }
        return new XboxProduct(Str(p, "ProductId") ?? productId, Str(p, "ProductType") ?? "", Str(lp, "ProductTitle") ?? "",
            Str(lp, "ProductDescription") ?? Str(lp, "ShortDescription"), Str(lp, "PublisherName"), release, new(), poster, hero, msrp);
    }

    private static string? Str(JsonElement e, string name) =>
        e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

    private static string? Img(JsonElement p, string kind) =>
        p.TryGetProperty("images", out var imgs) && imgs.ValueKind == JsonValueKind.Object && imgs.TryGetProperty(kind, out var i) ? Str(i, "url") : null;
}
