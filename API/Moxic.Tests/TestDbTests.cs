using Microsoft.EntityFrameworkCore;

namespace Moxic.Tests;

public class TestDbTests
{
    [Fact]
    public async Task TestDb_creates_schema()
    {
        await using var db = await TestDb.CreateAsync();
        await using var ctx = db.NewContext();
        Assert.Equal(0, await ctx.Games.CountAsync());
    }
}
