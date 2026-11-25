using Microsoft.EntityFrameworkCore;

namespace Moxic.Infrastructure.Data;

/// <summary>
/// Idempotent DDL for the Xbox catalog import: Games.IsPublished (existing games stay visible) and Games.PriceMode
/// (existing games are "Manual", so the formula never overwrites them), plus the single-row CatalogSettings table.
/// NOTE: no curly braces in the SQL — ExecuteSqlRaw treats them as format placeholders.
/// </summary>
public static class XboxCatalogSchemaBootstrap
{
    private const string Sql = """
        ALTER TABLE "Games" ADD COLUMN IF NOT EXISTS "IsPublished" boolean NOT NULL DEFAULT TRUE;
        ALTER TABLE "Games" ADD COLUMN IF NOT EXISTS "PriceMode" character varying(10) NOT NULL DEFAULT 'Manual';
        ALTER TABLE "Games" ADD COLUMN IF NOT EXISTS "ImportSource" character varying(20);
        CREATE TABLE IF NOT EXISTS "CatalogSettings" (
            "Id" integer NOT NULL,
            "PricePercent" numeric(18,2) NOT NULL,
            "PriceAdd" numeric(18,2) NOT NULL,
            "PriceRoundTo" numeric(18,2) NOT NULL,
            "UpdatedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_CatalogSettings" PRIMARY KEY ("Id")
        );
        """;

    public static Task EnsureAsync(MoxicDbContext db) => db.Database.ExecuteSqlRawAsync(Sql);
}
