using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Moxic.Api.Controllers;
using static Moxic.Tests.ShareTestKit;

namespace Moxic.Tests;

public class ShareSeoTests
{
    private static async Task<string> PageAsync(Moxic.Infrastructure.Data.MoxicDbContext ctx, string code)
    {
        var seo = new SeoController(ctx, null!, new MemoryCache(new MemoryCacheOptions()), new ConfigurationBuilder().Build())
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() },
        };
        var result = Assert.IsType<ContentResult>(await seo.SharePage(code));
        return result.Content!;
    }

    [Fact]
    public async Task Seo_share_page_contains_og_tags_and_hides_private_rooms()
    {
        await using var db = await TestDb.CreateAsync();
        await using var ctx = db.NewContext();
        var svc = Service(ctx);
        var g = await SeedGameAsync(ctx);
        var (room, _) = await svc.CreateAsync(A, Req(g, 60));
        var html = await PageAsync(ctx, room!.Code.ToLowerInvariant());
        Assert.Contains("og:title", html);
        Assert.Contains($"mã {room.Code}", html);
        Assert.Contains("360.000đ", html);
        Assert.Contains($"/api/seo/games/{g.Id}/image", html);

        var (hidden, _) = await svc.CreateAsync(B, Req(g, isPublic: false));
        var priv = await PageAsync(ctx, hidden!.Code);
        Assert.DoesNotContain(hidden.Code, priv.Replace($"/share/{hidden.Code}", ""));
        Assert.DoesNotContain("Forza", priv);
    }
}
