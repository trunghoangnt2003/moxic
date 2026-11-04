using Microsoft.EntityFrameworkCore;

namespace Moxic.Infrastructure.Data;

/// <summary>
/// Idempotent DDL for in-app notifications and flash-sale end times on games. Safe to re-run.
/// NOTE: no curly braces in the SQL — ExecuteSqlRaw treats them as format placeholders.
/// </summary>
public static class ShoppingSchemaBootstrap
{
    private const string Sql = """
        CREATE TABLE IF NOT EXISTS "Notifications" (
            "Id" uuid NOT NULL,
            "UserId" text NOT NULL,
            "Type" character varying(20) NOT NULL,
            "Title" character varying(150) NOT NULL,
            "Body" character varying(500),
            "Link" character varying(300),
            "ReadAt" timestamp with time zone,
            "CreatedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_Notifications" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_Notifications_aspnetusers_UserId" FOREIGN KEY ("UserId") REFERENCES aspnetusers ("Id") ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS "IX_Notifications_UserId_CreatedAt" ON "Notifications" ("UserId", "CreatedAt");

        ALTER TABLE "Games" ADD COLUMN IF NOT EXISTS "SaleEndsAt" timestamp with time zone;

        CREATE TABLE IF NOT EXISTS "WebPushSubscriptions" (
            "Id" uuid NOT NULL,
            "UserId" text NOT NULL,
            "Endpoint" character varying(1000) NOT NULL,
            "P256dh" character varying(200) NOT NULL,
            "Auth" character varying(100) NOT NULL,
            "CreatedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_WebPushSubscriptions" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_WebPushSubscriptions_aspnetusers_UserId" FOREIGN KEY ("UserId") REFERENCES aspnetusers ("Id") ON DELETE CASCADE
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_WebPushSubscriptions_Endpoint" ON "WebPushSubscriptions" ("Endpoint");
        CREATE INDEX IF NOT EXISTS "IX_WebPushSubscriptions_UserId" ON "WebPushSubscriptions" ("UserId");
        """;

    public static Task EnsureAsync(MoxicDbContext db) => db.Database.ExecuteSqlRawAsync(Sql);
}
