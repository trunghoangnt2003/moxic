using Microsoft.EntityFrameworkCore;

namespace Moxic.Infrastructure.Data;

/// <summary>
/// Idempotent DDL for customer wishlists. Program.cs uses EnsureCreated (a no-op on existing
/// databases), so existing databases are upgraded here. Safe to re-run.
/// NOTE: no curly braces in the SQL — ExecuteSqlRaw treats them as format placeholders.
/// </summary>
public static class WishlistSchemaBootstrap
{
    private const string Sql = """
        CREATE TABLE IF NOT EXISTS "WishlistItems" (
            "UserId" text NOT NULL,
            "GameId" uuid NOT NULL,
            "CreatedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_WishlistItems" PRIMARY KEY ("UserId", "GameId"),
            CONSTRAINT "FK_WishlistItems_aspnetusers_UserId" FOREIGN KEY ("UserId") REFERENCES aspnetusers ("Id") ON DELETE CASCADE,
            CONSTRAINT "FK_WishlistItems_Games_GameId" FOREIGN KEY ("GameId") REFERENCES "Games" ("Id") ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS "IX_WishlistItems_GameId" ON "WishlistItems" ("GameId");
        """;

    public static Task EnsureAsync(MoxicDbContext db) => db.Database.ExecuteSqlRawAsync(Sql);
}
