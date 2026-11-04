using Microsoft.EntityFrameworkCore;

namespace Moxic.Infrastructure.Data;

/// <summary>
/// Idempotent DDL for catalogue extensions: product type / region / publisher / developer on Games,
/// GameEditions (Standard/Deluxe/Ultimate…) and the edition snapshot on OrderDetails.
/// Program.cs uses EnsureCreated (a no-op on existing databases), so existing databases are
/// upgraded here. Existing games become ProductType 'Game'. Safe to re-run.
/// NOTE: no curly braces in the SQL — ExecuteSqlRaw treats them as format placeholders.
/// </summary>
public static class CatalogSchemaBootstrap
{
    private const string Sql = """
        ALTER TABLE "Games" ADD COLUMN IF NOT EXISTS "ProductType" character varying(20) NOT NULL DEFAULT 'Game';
        ALTER TABLE "Games" ADD COLUMN IF NOT EXISTS "Region" character varying(30);
        ALTER TABLE "Games" ADD COLUMN IF NOT EXISTS "Publisher" character varying(100);
        ALTER TABLE "Games" ADD COLUMN IF NOT EXISTS "Developer" character varying(100);
        CREATE INDEX IF NOT EXISTS "IX_Games_ProductType" ON "Games" ("ProductType");

        CREATE TABLE IF NOT EXISTS "GameEditions" (
            "Id" uuid NOT NULL,
            "GameId" uuid NOT NULL,
            "Name" character varying(60) NOT NULL,
            "Includes" character varying(2000),
            "OriginalPrice" numeric(18,2) NOT NULL,
            "SalePrice" numeric(18,2) NOT NULL,
            "IsDefault" boolean NOT NULL,
            "IsActive" boolean NOT NULL,
            "DisplayOrder" integer NOT NULL,
            "CreatedAt" timestamp with time zone NOT NULL,
            "UpdatedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_GameEditions" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_GameEditions_Games_GameId" FOREIGN KEY ("GameId") REFERENCES "Games" ("Id") ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS "IX_GameEditions_GameId" ON "GameEditions" ("GameId");

        ALTER TABLE "OrderDetails" ADD COLUMN IF NOT EXISTS "EditionId" uuid;
        ALTER TABLE "OrderDetails" ADD COLUMN IF NOT EXISTS "EditionName" character varying(60);
        """;

    public static Task EnsureAsync(MoxicDbContext db) => db.Database.ExecuteSqlRawAsync(Sql);
}
