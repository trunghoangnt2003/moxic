using Microsoft.EntityFrameworkCore;

namespace Moxic.Infrastructure.Data;

/// <summary>
/// Idempotent DDL for storefront announcements (pop-up modal). Program.cs uses EnsureCreated
/// (a no-op on existing databases), so existing databases are upgraded here. Safe to re-run.
/// NOTE: no curly braces in the SQL — ExecuteSqlRaw treats them as format placeholders.
/// </summary>
public static class AnnouncementSchemaBootstrap
{
    private const string Sql = """
        CREATE TABLE IF NOT EXISTS "Announcements" (
            "Id" uuid NOT NULL,
            "Kind" character varying(20) NOT NULL,
            "Title" character varying(150) NOT NULL,
            "Subtitle" character varying(300),
            "Body" character varying(2000),
            "ImageObjectKey" character varying(500),
            "GameId" uuid,
            "CountdownTo" timestamp with time zone,
            "CountdownLabel" character varying(100),
            "CtaLabel" character varying(60),
            "CtaUrl" character varying(500),
            "StartsAt" timestamp with time zone,
            "EndsAt" timestamp with time zone,
            "IsActive" boolean NOT NULL,
            "Priority" integer NOT NULL,
            "CreatedAt" timestamp with time zone NOT NULL,
            "UpdatedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_Announcements" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_Announcements_Games_GameId" FOREIGN KEY ("GameId") REFERENCES "Games" ("Id") ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS "IX_Announcements_GameId" ON "Announcements" ("GameId");
        CREATE INDEX IF NOT EXISTS "IX_Announcements_IsActive_Priority" ON "Announcements" ("IsActive", "Priority");
        """;

    public static Task EnsureAsync(MoxicDbContext db) => db.Database.ExecuteSqlRawAsync(Sql);
}
