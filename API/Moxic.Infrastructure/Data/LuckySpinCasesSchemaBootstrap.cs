using Microsoft.EntityFrameworkCore;

namespace Moxic.Infrastructure.Data;

/// <summary>
/// Idempotent DDL + one-time data migration for lucky-spin cases, loyalty points and case music
/// (migration AddSpinCasesPointsMusic). Program.cs uses EnsureCreated (a no-op on existing
/// databases), so existing dev/test/prod databases are upgraded here. Names and column types are
/// copied from `dotnet ef migrations script AddCustomerAccounts AddSpinCasesPointsMusic`.
///
/// Data migration: the v1 single prize pool (prizes, codes, history) is moved into a default
/// Code case "Hòm mã quay" (fixed id ...0001, slug hom-ma-quay). That case is only created while
/// v1 orphans exist, so fresh databases and a later admin deletion never recreate it. Every
/// statement is guarded (IF NOT EXISTS / WHERE ... IS NULL), so the whole thing is safe to re-run.
///
/// NOTE: no curly braces in the SQL — ExecuteSqlRaw treats them as format placeholders.
/// Part B is a single DO block because PostgreSQL has no ADD CONSTRAINT IF NOT EXISTS.
/// </summary>
public static class LuckySpinCasesSchemaBootstrap
{
    public const string DefaultCaseId = "00000000-0000-0000-0000-000000000001";
    public const string DefaultCaseSlug = "hom-ma-quay";

    private const string PartA = """
        CREATE TABLE IF NOT EXISTS "SpinCases" (
            "Id" uuid NOT NULL,
            "Name" character varying(100) NOT NULL,
            "Slug" character varying(80) NOT NULL,
            "Description" character varying(1000),
            "ImageObjectKey" character varying(500),
            "OpenMethod" character varying(20) NOT NULL,
            "FreeIntervalHours" integer NOT NULL,
            "PointsCost" integer NOT NULL,
            "IsActive" boolean NOT NULL,
            "DisplayOrder" integer NOT NULL,
            "CreatedAt" timestamp with time zone NOT NULL,
            "UpdatedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_SpinCases" PRIMARY KEY ("Id")
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_SpinCases_Slug" ON "SpinCases" ("Slug");

        ALTER TABLE "Games" ADD COLUMN IF NOT EXISTS "RewardPoints" integer NOT NULL DEFAULT 0;
        ALTER TABLE "Orders" ADD COLUMN IF NOT EXISTS "PointsAwardedAt" timestamp with time zone;
        ALTER TABLE "SpinPrizes" ADD COLUMN IF NOT EXISTS "CaseId" uuid;
        ALTER TABLE "SpinCodes" ADD COLUMN IF NOT EXISTS "CaseId" uuid;
        ALTER TABLE "SpinHistories" ADD COLUMN IF NOT EXISTS "CaseId" uuid;
        ALTER TABLE "SpinHistories" ADD COLUMN IF NOT EXISTS "CaseName" character varying(100);
        ALTER TABLE "SpinHistories" ADD COLUMN IF NOT EXISTS "OpenMethod" character varying(20);
        ALTER TABLE "SpinHistories" ADD COLUMN IF NOT EXISTS "UserId" text;
        ALTER TABLE "SpinHistories" ADD COLUMN IF NOT EXISTS "UserEmail" character varying(256);
        ALTER TABLE "SpinHistories" ADD COLUMN IF NOT EXISTS "PointsSpent" integer NOT NULL DEFAULT 0;
        ALTER TABLE "SpinHistories" ADD COLUMN IF NOT EXISTS "Rarity" character varying(20);

        INSERT INTO "SpinCases" ("Id", "Name", "Slug", "Description", "ImageObjectKey", "OpenMethod", "FreeIntervalHours", "PointsCost", "IsActive", "DisplayOrder", "CreatedAt", "UpdatedAt")
        SELECT '00000000-0000-0000-0000-000000000001', 'Hòm mã quay', 'hom-ma-quay',
               'Nhập mã quay do Moxic cung cấp để mở hòm — cơ hội nhận game Xbox miễn phí và mã giảm giá.',
               NULL, 'Code', 24, 0, TRUE, 0, now(), now()
        WHERE NOT EXISTS (SELECT 1 FROM "SpinCases" WHERE "Id" = '00000000-0000-0000-0000-000000000001' OR "Slug" = 'hom-ma-quay')
          AND (EXISTS (SELECT 1 FROM "SpinPrizes" WHERE "CaseId" IS NULL)
            OR EXISTS (SELECT 1 FROM "SpinCodes" WHERE "CaseId" IS NULL)
            OR EXISTS (SELECT 1 FROM "SpinHistories" WHERE "CaseName" IS NULL));

        UPDATE "SpinPrizes" SET "CaseId" = '00000000-0000-0000-0000-000000000001'
          WHERE "CaseId" IS NULL AND EXISTS (SELECT 1 FROM "SpinCases" WHERE "Id" = '00000000-0000-0000-0000-000000000001');
        UPDATE "SpinCodes" SET "CaseId" = '00000000-0000-0000-0000-000000000001'
          WHERE "CaseId" IS NULL AND EXISTS (SELECT 1 FROM "SpinCases" WHERE "Id" = '00000000-0000-0000-0000-000000000001');
        UPDATE "SpinHistories" SET "CaseId" = '00000000-0000-0000-0000-000000000001', "CaseName" = 'Hòm mã quay', "OpenMethod" = 'Code'
          WHERE "CaseName" IS NULL AND EXISTS (SELECT 1 FROM "SpinCases" WHERE "Id" = '00000000-0000-0000-0000-000000000001');
        UPDATE "SpinHistories" AS h SET "Rarity" = CASE
            WHEN p."Probability" > 25 THEN 'common'
            WHEN p."Probability" > 10 THEN 'uncommon'
            WHEN p."Probability" > 3 THEN 'rare'
            WHEN p."Probability" > 1 THEN 'epic'
            ELSE 'legendary' END
          FROM "SpinPrizes" AS p
          WHERE h."PrizeId" = p."Id" AND h."Rarity" IS NULL;

        ALTER TABLE "SpinPrizes" ALTER COLUMN "CaseId" SET NOT NULL;
        ALTER TABLE "SpinCodes" ALTER COLUMN "CaseId" SET NOT NULL;
        """;

    private const string PartB = """
        DO $EF$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_SpinPrizes_SpinCases_CaseId') THEN
                ALTER TABLE "SpinPrizes" ADD CONSTRAINT "FK_SpinPrizes_SpinCases_CaseId" FOREIGN KEY ("CaseId") REFERENCES "SpinCases" ("Id") ON DELETE CASCADE;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_SpinCodes_SpinCases_CaseId') THEN
                ALTER TABLE "SpinCodes" ADD CONSTRAINT "FK_SpinCodes_SpinCases_CaseId" FOREIGN KEY ("CaseId") REFERENCES "SpinCases" ("Id") ON DELETE CASCADE;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_SpinHistories_SpinCases_CaseId') THEN
                ALTER TABLE "SpinHistories" ADD CONSTRAINT "FK_SpinHistories_SpinCases_CaseId" FOREIGN KEY ("CaseId") REFERENCES "SpinCases" ("Id") ON DELETE SET NULL;
            END IF;
        END $EF$;
        """;

    private const string PartC = """
        CREATE INDEX IF NOT EXISTS "IX_SpinPrizes_CaseId" ON "SpinPrizes" ("CaseId");
        CREATE INDEX IF NOT EXISTS "IX_SpinCodes_CaseId" ON "SpinCodes" ("CaseId");
        CREATE INDEX IF NOT EXISTS "IX_SpinHistories_CaseId" ON "SpinHistories" ("CaseId");
        CREATE INDEX IF NOT EXISTS "IX_SpinHistories_UserId" ON "SpinHistories" ("UserId");

        CREATE TABLE IF NOT EXISTS "SpinCaseCooldowns" (
            "UserId" text NOT NULL,
            "CaseId" uuid NOT NULL,
            "LastOpenedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_SpinCaseCooldowns" PRIMARY KEY ("UserId", "CaseId"),
            CONSTRAINT "FK_SpinCaseCooldowns_SpinCases_CaseId" FOREIGN KEY ("CaseId") REFERENCES "SpinCases" ("Id") ON DELETE CASCADE,
            CONSTRAINT "FK_SpinCaseCooldowns_aspnetusers_UserId" FOREIGN KEY ("UserId") REFERENCES aspnetusers ("Id") ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS "IX_SpinCaseCooldowns_CaseId" ON "SpinCaseCooldowns" ("CaseId");

        CREATE TABLE IF NOT EXISTS "PointsTransactions" (
            "Id" uuid NOT NULL,
            "UserId" text NOT NULL,
            "Delta" integer NOT NULL,
            "Reason" character varying(20) NOT NULL,
            "RefId" character varying(64),
            "Note" character varying(200),
            "BalanceAfter" integer NOT NULL,
            "CreatedBy" character varying(256),
            "CreatedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_PointsTransactions" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_PointsTransactions_aspnetusers_UserId" FOREIGN KEY ("UserId") REFERENCES aspnetusers ("Id") ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS "IX_PointsTransactions_UserId_CreatedAt" ON "PointsTransactions" ("UserId", "CreatedAt");
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_PointsTransactions_Reason_RefId" ON "PointsTransactions" ("Reason", "RefId");

        CREATE TABLE IF NOT EXISTS "SpinMusicTracks" (
            "Id" uuid NOT NULL,
            "Name" character varying(100) NOT NULL,
            "ObjectKey" character varying(500) NOT NULL,
            "ContentType" character varying(50) NOT NULL,
            "SizeBytes" bigint NOT NULL,
            "IsActive" boolean NOT NULL,
            "CreatedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_SpinMusicTracks" PRIMARY KEY ("Id")
        );
        """;

    public static async Task EnsureAsync(MoxicDbContext db)
    {
        await db.Database.ExecuteSqlRawAsync(PartA);
        await db.Database.ExecuteSqlRawAsync(PartB);
        await db.Database.ExecuteSqlRawAsync(PartC);
    }
}
