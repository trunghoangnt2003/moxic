using Microsoft.EntityFrameworkCore;

namespace Moxic.Infrastructure.Data;

/// <summary>
/// Idempotent DDL for community features: review ownership/verification/moderation columns,
/// game discussion comments and content reports. Safe to re-run.
/// NOTE: no curly braces in the SQL — ExecuteSqlRaw treats them as format placeholders.
/// </summary>
public static class CommunitySchemaBootstrap
{
    private const string Sql = """
        ALTER TABLE "GameReviews" ADD COLUMN IF NOT EXISTS "UserId" text;
        ALTER TABLE "GameReviews" ADD COLUMN IF NOT EXISTS "IsVerifiedPurchase" boolean NOT NULL DEFAULT FALSE;
        ALTER TABLE "GameReviews" ADD COLUMN IF NOT EXISTS "IsHidden" boolean NOT NULL DEFAULT FALSE;
        ALTER TABLE "GameReviews" ADD COLUMN IF NOT EXISTS "UpdatedAt" timestamp with time zone;
        CREATE INDEX IF NOT EXISTS "IX_GameReviews_UserId_GameId" ON "GameReviews" ("UserId", "GameId");

        CREATE TABLE IF NOT EXISTS "GameComments" (
            "Id" uuid NOT NULL,
            "GameId" uuid NOT NULL,
            "ParentId" uuid,
            "UserId" text NOT NULL,
            "DisplayName" character varying(50) NOT NULL,
            "Content" character varying(1000) NOT NULL,
            "IsHidden" boolean NOT NULL,
            "CreatedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_GameComments" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_GameComments_Games_GameId" FOREIGN KEY ("GameId") REFERENCES "Games" ("Id") ON DELETE CASCADE,
            CONSTRAINT "FK_GameComments_GameComments_ParentId" FOREIGN KEY ("ParentId") REFERENCES "GameComments" ("Id") ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS "IX_GameComments_GameId_CreatedAt" ON "GameComments" ("GameId", "CreatedAt");
        CREATE INDEX IF NOT EXISTS "IX_GameComments_ParentId" ON "GameComments" ("ParentId");

        CREATE TABLE IF NOT EXISTS "ContentReports" (
            "Id" uuid NOT NULL,
            "TargetType" character varying(20) NOT NULL,
            "TargetId" uuid NOT NULL,
            "ReporterUserId" text,
            "ReporterIp" character varying(64),
            "Reason" character varying(20) NOT NULL,
            "Note" character varying(300),
            "Status" character varying(20) NOT NULL,
            "CreatedAt" timestamp with time zone NOT NULL,
            "ResolvedAt" timestamp with time zone,
            CONSTRAINT "PK_ContentReports" PRIMARY KEY ("Id")
        );
        CREATE INDEX IF NOT EXISTS "IX_ContentReports_Status_CreatedAt" ON "ContentReports" ("Status", "CreatedAt");
        CREATE INDEX IF NOT EXISTS "IX_ContentReports_Target" ON "ContentReports" ("TargetType", "TargetId");
        """;

    public static Task EnsureAsync(MoxicDbContext db) => db.Database.ExecuteSqlRawAsync(Sql);
}
