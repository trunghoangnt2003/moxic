using Microsoft.EntityFrameworkCore;

namespace Moxic.Infrastructure.Data;

/// <summary>
/// Idempotent DDL for the game rental service: plans per game, rental assets (shop accounts) with
/// the games they own, and rental orders/extensions. Program.cs uses EnsureCreated (a no-op on
/// existing databases), so existing databases are upgraded here. Safe to re-run.
/// NOTE: no curly braces in the SQL — ExecuteSqlRaw treats them as format placeholders.
/// </summary>
public static class RentalSchemaBootstrap
{
    private const string Sql = """
        CREATE TABLE IF NOT EXISTS "RentalPlans" (
            "Id" uuid NOT NULL,
            "GameId" uuid NOT NULL,
            "Days" integer NOT NULL,
            "Price" numeric(18,2) NOT NULL,
            "IsActive" boolean NOT NULL,
            "DisplayOrder" integer NOT NULL,
            "CreatedAt" timestamp with time zone NOT NULL,
            "UpdatedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_RentalPlans" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_RentalPlans_Games_GameId" FOREIGN KEY ("GameId") REFERENCES "Games" ("Id") ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS "IX_RentalPlans_GameId" ON "RentalPlans" ("GameId");

        CREATE TABLE IF NOT EXISTS "RentalAssets" (
            "Id" uuid NOT NULL,
            "Label" character varying(60) NOT NULL,
            "LoginEmail" character varying(200) NOT NULL,
            "PasswordEncrypted" character varying(1000) NOT NULL,
            "Notes" character varying(500),
            "Slots" integer NOT NULL,
            "IsActive" boolean NOT NULL,
            "CreatedAt" timestamp with time zone NOT NULL,
            "UpdatedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_RentalAssets" PRIMARY KEY ("Id")
        );

        CREATE TABLE IF NOT EXISTS "RentalAssetGames" (
            "AssetId" uuid NOT NULL,
            "GameId" uuid NOT NULL,
            CONSTRAINT "PK_RentalAssetGames" PRIMARY KEY ("AssetId", "GameId"),
            CONSTRAINT "FK_RentalAssetGames_RentalAssets_AssetId" FOREIGN KEY ("AssetId") REFERENCES "RentalAssets" ("Id") ON DELETE CASCADE,
            CONSTRAINT "FK_RentalAssetGames_Games_GameId" FOREIGN KEY ("GameId") REFERENCES "Games" ("Id") ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS "IX_RentalAssetGames_GameId" ON "RentalAssetGames" ("GameId");

        CREATE TABLE IF NOT EXISTS "RentalOrders" (
            "Id" uuid NOT NULL,
            "Code" character varying(40) NOT NULL,
            "Kind" character varying(20) NOT NULL,
            "ParentId" uuid,
            "CustomerId" text NOT NULL,
            "CustomerEmail" character varying(256) NOT NULL,
            "CustomerPhone" character varying(20),
            "GameId" uuid NOT NULL,
            "GameName" character varying(200) NOT NULL,
            "PlanId" uuid,
            "Days" integer NOT NULL,
            "Price" numeric(18,2) NOT NULL,
            "Status" character varying(30) NOT NULL,
            "AssetId" uuid,
            "StartsAt" timestamp with time zone,
            "EndsAt" timestamp with time zone,
            "ReminderSentAt" timestamp with time zone,
            "PaidAt" timestamp with time zone,
            "ReturnedAt" timestamp with time zone,
            "AdminNote" character varying(500),
            "CancelReason" character varying(300),
            "CreatedAt" timestamp with time zone NOT NULL,
            "UpdatedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_RentalOrders" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_RentalOrders_RentalOrders_ParentId" FOREIGN KEY ("ParentId") REFERENCES "RentalOrders" ("Id") ON DELETE CASCADE,
            CONSTRAINT "FK_RentalOrders_Games_GameId" FOREIGN KEY ("GameId") REFERENCES "Games" ("Id") ON DELETE RESTRICT,
            CONSTRAINT "FK_RentalOrders_RentalAssets_AssetId" FOREIGN KEY ("AssetId") REFERENCES "RentalAssets" ("Id") ON DELETE SET NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_RentalOrders_Code" ON "RentalOrders" ("Code");
        CREATE INDEX IF NOT EXISTS "IX_RentalOrders_CustomerId" ON "RentalOrders" ("CustomerId");
        CREATE INDEX IF NOT EXISTS "IX_RentalOrders_AssetId_Status" ON "RentalOrders" ("AssetId", "Status");
        CREATE INDEX IF NOT EXISTS "IX_RentalOrders_Status_EndsAt" ON "RentalOrders" ("Status", "EndsAt");
        """;

    public static Task EnsureAsync(MoxicDbContext db) => db.Database.ExecuteSqlRawAsync(Sql);
}
