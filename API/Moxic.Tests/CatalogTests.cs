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
