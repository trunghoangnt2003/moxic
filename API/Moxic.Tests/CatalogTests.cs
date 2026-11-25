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
            ALTER TABLE "Games" DROP COLUMN "IsPublished"; ALTER TABLE "Games" DROP COLUMN "PriceMode"; ALTER TABLE "Games" DROP COLUMN "ImportSource"; DROP TABLE "CatalogSettings";
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
