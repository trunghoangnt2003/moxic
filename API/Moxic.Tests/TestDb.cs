using Microsoft.EntityFrameworkCore;
using Moxic.Infrastructure.Data;

namespace Moxic.Tests;

/// <summary>
/// A fresh PostgreSQL database per test (real Npgsql semantics: ExecuteUpdate, unique indexes, concurrency).
/// Needs a local server: docker run -d --name moxic-testpg -e POSTGRES_PASSWORD=test -p 55432:5432 postgres:16-alpine
/// Override with env MOXIC_TEST_PG (a connection string without Database).
/// </summary>
public sealed class TestDb : IAsyncDisposable
{
    private static readonly string Server =
        Environment.GetEnvironmentVariable("MOXIC_TEST_PG") ?? "Host=localhost;Port=55432;Username=postgres;Password=test";

    public string ConnectionString { get; }
    private readonly string _name;

    private TestDb(string name)
    {
        _name = name;
        ConnectionString = $"{Server};Database={name};Include Error Detail=true";
    }

    public static async Task<TestDb> CreateAsync()
    {
        var db = new TestDb("moxic_t_" + Guid.NewGuid().ToString("N")[..12]);
        await using var ctx = db.NewContext();
        await ctx.Database.EnsureCreatedAsync();
        // Production databases got this default from ShoppingSchemaBootstrap (raw INSERTs rely on it); EnsureCreated doesn't set it.
        await ctx.Database.ExecuteSqlRawAsync("""ALTER TABLE "CustomerProfiles" ALTER COLUMN "Lang" SET DEFAULT 'vi'""");
        return db;
    }

    public MoxicDbContext NewContext() =>
        new(new DbContextOptionsBuilder<MoxicDbContext>().UseNpgsql(ConnectionString).Options);

    public async ValueTask DisposeAsync()
    {
        await using var ctx = NewContext();
        await ctx.Database.EnsureDeletedAsync();
    }
}
