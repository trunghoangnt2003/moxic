using Microsoft.EntityFrameworkCore;

namespace Moxic.Infrastructure.Data;

/// <summary>
/// Idempotent DDL for price tracking: price snapshots, Xbox product id / tracking region on games,
/// last-notified price on wishlist items and the customer's price-alert opt-out.
/// Seeds one "Moxic" snapshot per game that has none, so history starts today. Safe to re-run.
/// NOTE: no curly braces in the SQL — ExecuteSqlRaw treats them as format placeholders.
/// </summary>
public static class PriceTrackingSchemaBootstrap
{
    private const string Sql = """
        CREATE TABLE IF NOT EXISTS "GamePriceSnapshots" (
            "Id" uuid NOT NULL,
            "GameId" uuid NOT NULL,
            "Source" character varying(20) NOT NULL,
            "Region" character varying(5) NOT NULL,
            "Currency" character varying(5) NOT NULL,
            "BasePrice" numeric(18,2) NOT NULL,
            "SalePrice" numeric(18,2) NOT NULL,
            "CapturedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_GamePriceSnapshots" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_GamePriceSnapshots_Games_GameId" FOREIGN KEY ("GameId") REFERENCES "Games" ("Id") ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS "IX_GamePriceSnapshots_GameId_Source_CapturedAt" ON "GamePriceSnapshots" ("GameId", "Source", "CapturedAt");

        ALTER TABLE "Games" ADD COLUMN IF NOT EXISTS "XboxProductId" character varying(20);
        ALTER TABLE "Games" ADD COLUMN IF NOT EXISTS "PriceRegion" character varying(5);
        ALTER TABLE "WishlistItems" ADD COLUMN IF NOT EXISTS "NotifiedPrice" numeric(18,2);
        ALTER TABLE "CustomerProfiles" ADD COLUMN IF NOT EXISTS "PriceAlerts" boolean NOT NULL DEFAULT TRUE;

        INSERT INTO "GamePriceSnapshots" ("Id", "GameId", "Source", "Region", "Currency", "BasePrice", "SalePrice", "CapturedAt")
        SELECT gen_random_uuid(), g."Id", 'Moxic', 'vn', 'VND', g."OriginalPrice", g."SalePrice", now()
        FROM "Games" g
        WHERE NOT EXISTS (SELECT 1 FROM "GamePriceSnapshots" s WHERE s."GameId" = g."Id" AND s."Source" = 'Moxic');
        """;

    public static Task EnsureAsync(MoxicDbContext db) => db.Database.ExecuteSqlRawAsync(Sql);
}
