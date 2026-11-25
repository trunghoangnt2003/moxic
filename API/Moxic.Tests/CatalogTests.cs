using Microsoft.EntityFrameworkCore;
using Moxic.Core.Entities;
using Moxic.Infrastructure.Data;
using Moxic.Shared.Enums;

namespace Moxic.Tests;

public class CatalogSchemaTests
{
    public static Game NewGame(string name, bool published = true, string? xboxId = null, decimal original = 1499000, decimal sale = 0, string mode = "Manual")
    {
        var now = DateTime.UtcNow;
        return new Game
        {
            Id = Guid.NewGuid(), Name = name, Description = "", OriginalPrice = original, SalePrice = sale, Status = GameStatus.Available,
            IsPublished = published, PriceMode = mode, XboxProductId = xboxId, CreatedAt = now, UpdatedAt = now,
        };
    }

    [Fact]
    public async Task Public_queries_hide_unpublished_games()
    {
        await using var db = await TestDb.CreateAsync();
        await using var ctx = db.NewContext();
        ctx.Games.AddRange(NewGame("Live"), NewGame("Pending", published: false));
        await ctx.SaveChangesAsync();
        Assert.Equal(1, await ctx.Games.CountAsync());
        Assert.Equal(2, await ctx.Games.IgnoreQueryFilters().CountAsync());
    }

    [Fact]
    public async Task Bootstrap_adds_publish_and_price_mode_columns_with_safe_defaults()
    {
        await using var db = await TestDb.CreateAsync();
        await using var ctx = db.NewContext();
        var now = DateTime.UtcNow;
        await ctx.Database.ExecuteSqlRawAsync("""
            ALTER TABLE "Games" DROP COLUMN "IsPublished"; ALTER TABLE "Games" DROP COLUMN "PriceMode"; ALTER TABLE "Games" DROP COLUMN "ImportSource"; ALTER TABLE "Games" DROP COLUMN "PopularityRank"; ALTER TABLE "Games" DROP COLUMN "XboxPosterUrl"; ALTER TABLE "Games" DROP COLUMN "XboxHeroUrl"; DROP TABLE "CatalogSettings";
            """);
        await ctx.Database.ExecuteSqlRawAsync("""
            INSERT INTO "Games" ("Id","Name","Description","OriginalPrice","SalePrice","Status","IsFeatured","RewardPoints","ProductType","AllowShare","ShareSurcharge","CreatedAt","UpdatedAt")
            VALUES (gen_random_uuid(),'Old','',100,90,'Available',false,0,'Game',false,0,now(),now())
            """);
        await XboxCatalogSchemaBootstrap.EnsureAsync(ctx);
        await XboxCatalogSchemaBootstrap.EnsureAsync(ctx);
        var old = await ctx.Games.SingleAsync();
        Assert.True(old.IsPublished);
        Assert.Equal("Manual", old.PriceMode);
        ctx.CatalogSettings.Add(new CatalogSettings { Id = 1, PricePercent = 70, PriceAdd = 0, PriceRoundTo = 1000, UpdatedAt = now });
        await ctx.SaveChangesAsync();
    }
}

public class PriceFormulaTests
{
    private static CatalogSettings S(decimal pct, decimal add, decimal round) => new() { Id = 1, PricePercent = pct, PriceAdd = add, PriceRoundTo = round };

    [Fact]
    public void Formula_rounds_up_and_never_goes_negative()
    {
        Assert.Equal(1050000m, Moxic.Api.Services.Catalog.PriceFormula.Compute(1499000, S(70, 0, 1000)));
        Assert.Equal(1000000m, Moxic.Api.Services.Catalog.PriceFormula.Compute(1499000, S(70, -50000, 10000)));
        Assert.Equal(0m, Moxic.Api.Services.Catalog.PriceFormula.Compute(1499000, null));
        Assert.Equal(0m, Moxic.Api.Services.Catalog.PriceFormula.Compute(10000, S(10, -50000, 1000)));
        Assert.False(Moxic.Api.Services.Catalog.PriceFormula.IsSet(null));
        Assert.True(Moxic.Api.Services.Catalog.PriceFormula.IsSet(S(70, 0, 1000)));
    }
}

public class XboxBrowseParseTests
{
    private const string Page = """
        {"channels":{"BROWSE":{"encodedCT":"eyJIYXNNb3JlIjp0cnVlfQ==","totalItems":2}},
         "productSummaries":[
          {"productId":"9N431PX143P8","productKind":"Game","title":"Forza Horizon 6","shortDescription":"Drive","publisherName":"Xbox Game Studios",
           "releaseDate":"2026-05-19T00:00:00.0000000Z","categories":["Đua xe"],
           "images":{"poster":{"url":"https://store-images.s-microsoft.com/p"},"superHeroArt":{"url":"https://store-images.s-microsoft.com/h"}},
           "specificPrices":{"purchaseable":[{"listPrice":1124250.0,"msrp":1499000.0,"currency":"VND"}]}},
          {"productId":"9N201KQXS5BM","productKind":"Game","title":"Call of Duty","specificPrices":{"purchaseable":[]}}
         ]}
        """;

    [Fact]
    public void ParsePage_reads_products_prices_and_next_token()
    {
        var (items, next) = Moxic.Api.Services.Catalog.XboxBrowseClient.ParsePage(Page);
        Assert.Equal(2, items.Count);
        var f = items[0];
        Assert.Equal("9N431PX143P8", f.ProductId);
        Assert.Equal(1499000m, f.Msrp);
        Assert.Equal("Xbox Game Studios", f.Publisher);
        Assert.Equal(new DateTime(2026, 5, 19), f.ReleaseDate!.Value.Date);
        Assert.Equal(new[] { "Đua xe" }, f.Categories);
        Assert.Equal("https://store-images.s-microsoft.com/p", f.PosterUrl);
        Assert.Equal("https://store-images.s-microsoft.com/h", f.HeroUrl);
        Assert.Null(items[1].Msrp);
        Assert.Equal("eyJIYXNNb3JlIjp0cnVlfQ==", next);

        var (_, none) = Moxic.Api.Services.Catalog.XboxBrowseClient.ParsePage(Page.Replace("eyJIYXNNb3JlIjp0cnVlfQ==", "eyJIYXNNb3JlIjpmYWxzZX0="));
        Assert.Null(none); // {"HasMore":false}
    }

    [Fact]
    public void SortFor_maps_lists()
    {
        Assert.Equal("MostPopular desc", Moxic.Api.Services.Catalog.XboxBrowseClient.SortFor("popular"));
        Assert.Equal("ReleaseDate desc", Moxic.Api.Services.Catalog.XboxBrowseClient.SortFor("new"));
        Assert.Throws<ArgumentException>(() => Moxic.Api.Services.Catalog.XboxBrowseClient.SortFor("x"));
    }
}

public class FakeMinio : Moxic.Core.Interfaces.IMinioService
{
    public List<string> Uploaded { get; } = new();
    public List<string> Deleted { get; } = new();
    public Task<string> UploadImageAsync(string bucket, string objectKey, Stream fileStream, string contentType) { Uploaded.Add(objectKey); return Task.FromResult(objectKey); }
    public Task<string> GetPresignedUrlAsync(string bucket, string objectKey, int expiryHours = 1) => Task.FromResult("https://x/" + objectKey);
    public Task DeleteObjectAsync(string bucket, string objectKey) { Deleted.Add(objectKey); return Task.CompletedTask; }
}

public class CatalogImportTests
{
    public static Moxic.Api.Services.Catalog.CatalogImportService Svc(MoxicDbContext ctx, FakeMinio? minio = null) =>
        new(ctx, minio ?? new FakeMinio(), new NoHttp(), Microsoft.Extensions.Logging.Abstractions.NullLogger<Moxic.Api.Services.Catalog.CatalogImportService>.Instance);

    /// <summary>No network in tests: image downloads fail fast and are skipped.</summary>
    public class NoHttp : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(new Fail());
        private class Fail : HttpMessageHandler
        {
            protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage r, CancellationToken c) => Task.FromResult(new HttpResponseMessage(System.Net.HttpStatusCode.NotFound));
        }
    }

    private static Moxic.Api.Services.Catalog.XboxProduct P(string id, decimal? msrp = 1499000, string kind = "Game", DateTime? release = null, string title = "Forza") =>
        new(id, kind, title, "desc", "Xbox Game Studios", release ?? new DateTime(2025, 1, 1), new() { "Đua xe" }, "https://img/p", "https://img/h", msrp);

    [Fact]
    public async Task ImportPage_adds_pending_games_with_formula_price_and_skips_rest()
    {
        await using var db = await TestDb.CreateAsync();
        await using var ctx = db.NewContext();
        ctx.CatalogSettings.Add(new CatalogSettings { Id = 1, PricePercent = 70, PriceAdd = 0, PriceRoundTo = 1000, UpdatedAt = DateTime.UtcNow });
        ctx.Genres.Add(new Genre { Id = Guid.NewGuid(), Name = "Đua xe" });
        ctx.Games.Add(CatalogSchemaTests.NewGame("Already", xboxId: "9EXIST"));
        await ctx.SaveChangesAsync();

        var r = await Svc(ctx).ImportPageAsync(new[]
        {
            P("9NEW1"), P("9free", msrp: null), P("9dlc", kind: "Durable"), P("9exist"),
            P("9SOON", release: DateTime.UtcNow.AddMonths(3), title: "Soon"),
        }, rankStart: 1, CancellationToken.None);

        Assert.Equal(2, r.Added);
        Assert.Equal(3, r.Skipped);
        ctx.ChangeTracker.Clear();
        var g = await ctx.Games.IgnoreQueryFilters().Include(x => x.Genres).SingleAsync(x => x.XboxProductId == "9NEW1");
        Assert.False(g.IsPublished);
        Assert.Equal(1499000m, g.OriginalPrice);
        Assert.Equal(1050000m, g.SalePrice);
        Assert.Equal("Formula", g.PriceMode);
        Assert.Equal(1, g.PopularityRank);
        Assert.Equal("https://img/p", g.XboxPosterUrl);
        Assert.Equal("vn", g.PriceRegion);
        Assert.Single(g.Genres);
        Assert.Equal(GameStatus.Preorder, (await ctx.Games.IgnoreQueryFilters().SingleAsync(x => x.XboxProductId == "9SOON")).Status);
        Assert.Equal(0, await ctx.Games.CountAsync(x => x.XboxProductId == "9NEW1")); // still hidden from customers
    }

    [Fact]
    public async Task Recrawl_updates_rank_and_price_of_pending_games_only()
    {
        await using var db = await TestDb.CreateAsync();
        await using var ctx = db.NewContext();
        var svc = Svc(ctx);
        await svc.ImportPageAsync(new[] { P("9A") }, 50, CancellationToken.None);
        var r = await svc.ImportPageAsync(new[] { P("9A", msrp: 999000) }, 3, CancellationToken.None);
        Assert.Equal(0, r.Added);
        Assert.Equal(1, r.Updated);
        ctx.ChangeTracker.Clear();
        var g = await ctx.Games.IgnoreQueryFilters().SingleAsync();
        Assert.Equal(3, g.PopularityRank);
        Assert.Equal(999000m, g.OriginalPrice);
    }

    [Fact]
    public async Task Pending_filters_hot_and_search_and_pages()
    {
        await using var db = await TestDb.CreateAsync();
        await using var ctx = db.NewContext();
        var svc = Svc(ctx);
        await svc.ImportPageAsync(new[] { P("9H1", title: "Halo"), P("9H2", title: "Forza") }, 1, CancellationToken.None);
        await svc.ImportPageAsync(new[] { P("9C1", title: "Cold game") }, 5000, CancellationToken.None);
        var (all, total) = await svc.PendingAsync(null, hot: false, "popular", 1, 50);
        Assert.Equal(3, total);
        Assert.Equal("Halo", all[0].Name);
        var (hot, hotTotal) = await svc.PendingAsync(null, hot: true, "popular", 1, 50);
        Assert.Equal(2, hotTotal);
        var (q, _) = await svc.PendingAsync("forz", hot: false, "popular", 1, 50);
        Assert.Equal("Forza", Assert.Single(q).Name);
    }

    [Fact]
    public async Task Publish_blocks_zero_price_publishes_rest_and_tries_images()
    {
        await using var db = await TestDb.CreateAsync();
        await using var ctx = db.NewContext();
        ctx.Games.AddRange(CatalogSchemaTests.NewGame("Priced", published: false, sale: 500000), CatalogSchemaTests.NewGame("Free", published: false, sale: 0));
        await ctx.SaveChangesAsync();
        var ids = await ctx.Games.IgnoreQueryFilters().Select(g => g.Id).ToListAsync();
        var errors = await Svc(ctx).PublishAsync(ids, CancellationToken.None);
        Assert.Single(errors);
        ctx.ChangeTracker.Clear();
        Assert.Equal("Priced", (await ctx.Games.SingleAsync()).Name);
    }

    [Fact]
    public async Task ApplyFormula_leaves_manual_games_alone_and_SetPrice_switches_mode()
    {
        await using var db = await TestDb.CreateAsync();
        await using var ctx = db.NewContext();
        var svc = Svc(ctx);
        ctx.Games.AddRange(
            CatalogSchemaTests.NewGame("F", published: false, original: 1000000, mode: "Formula"),
            CatalogSchemaTests.NewGame("M", published: false, original: 1000000, sale: 123000, mode: "Manual"),
            CatalogSchemaTests.NewGame("Live", published: true, original: 1000000, sale: 1, mode: "Formula"));
        await ctx.SaveChangesAsync();
        await svc.SaveSettingsAsync(50, 0, 1000);
        Assert.Equal(1, await svc.CountFormulaTargetsAsync(includePublished: false));
        Assert.Equal(1, await svc.ApplyFormulaAsync(includePublished: false));
        ctx.ChangeTracker.Clear();
        var games = await ctx.Games.IgnoreQueryFilters().ToDictionaryAsync(g => g.Name);
        Assert.Equal(500000m, games["F"].SalePrice);
        Assert.Equal(123000m, games["M"].SalePrice);
        Assert.Equal(1m, games["Live"].SalePrice);

        Assert.Null(await svc.SetPriceAsync(games["F"].Id, 777000, "Manual"));
        ctx.ChangeTracker.Clear();
        var f = await ctx.Games.IgnoreQueryFilters().SingleAsync(g => g.Name == "F");
        Assert.Equal("Manual", f.PriceMode);
        Assert.Equal(777000m, f.SalePrice);
    }
}
