using Microsoft.EntityFrameworkCore;

namespace Moxic.Infrastructure.Data;

/// <summary>
/// Idempotent DDL for coupons (migration AddCoupons): Coupons, CouponRedemptions,
/// Orders.CouponId/CouponCode/DiscountAmount and SpinPrizes.Discount* columns. Program.cs uses
/// EnsureCreated (a no-op on existing databases), so existing dev/test/prod databases are upgraded
/// here. Names and column types are copied from
/// `dotnet ef migrations script AddSpinCasesPointsMusic AddCoupons`.
///
/// Existing orders get DiscountAmount 0 (column default), so TotalAmount stays equal to the sum of
/// line prices minus DiscountAmount. Every statement is guarded (IF NOT EXISTS), so it is safe to re-run.
///
/// NOTE: no curly braces in the SQL — ExecuteSqlRaw treats them as format placeholders.
/// Part B is a single DO block because PostgreSQL has no ADD CONSTRAINT IF NOT EXISTS.
/// </summary>
public static class CouponSchemaBootstrap
{
    private const string PartA = """
        CREATE TABLE IF NOT EXISTS "Coupons" (
            "Id" uuid NOT NULL,
            "Code" character varying(32) NOT NULL,
            "Name" character varying(100) NOT NULL,
            "Source" character varying(20) NOT NULL,
            "DiscountType" character varying(10) NOT NULL,
            "Value" numeric(18,2) NOT NULL,
            "MaxDiscountAmount" numeric(18,2),
            "MinOrderAmount" numeric(18,2),
            "GameId" uuid,
            "StartsAt" timestamp with time zone,
            "ExpiresAt" timestamp with time zone,
            "MaxTotalUses" integer,
            "MaxUsesPerCustomer" integer NOT NULL,
            "UsedCount" integer NOT NULL,
            "IsActive" boolean NOT NULL,
            "OwnerUserId" text,
            "ClaimedAt" timestamp with time zone,
            "SpinHistoryId" uuid,
            "CreatedBy" character varying(256),
            "CreatedAt" timestamp with time zone NOT NULL,
            "UpdatedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_Coupons" PRIMARY KEY ("Id")
        );
        CREATE TABLE IF NOT EXISTS "CouponRedemptions" (
            "Id" uuid NOT NULL,
            "CouponId" uuid NOT NULL,
            "UserId" text NOT NULL,
            "OrderId" uuid NOT NULL,
            "DiscountAmount" numeric(18,2) NOT NULL,
            "CreatedAt" timestamp with time zone NOT NULL,
            "ReleasedAt" timestamp with time zone,
            CONSTRAINT "PK_CouponRedemptions" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_CouponRedemptions_Coupons_CouponId" FOREIGN KEY ("CouponId") REFERENCES "Coupons" ("Id") ON DELETE RESTRICT,
            CONSTRAINT "FK_CouponRedemptions_Orders_OrderId" FOREIGN KEY ("OrderId") REFERENCES "Orders" ("Id") ON DELETE CASCADE
        );
        ALTER TABLE "Orders" ADD COLUMN IF NOT EXISTS "CouponId" uuid;
        ALTER TABLE "Orders" ADD COLUMN IF NOT EXISTS "CouponCode" character varying(32);
        ALTER TABLE "Orders" ADD COLUMN IF NOT EXISTS "DiscountAmount" numeric(18,2) NOT NULL DEFAULT 0.0;
        ALTER TABLE "SpinPrizes" ADD COLUMN IF NOT EXISTS "DiscountType" character varying(10);
        ALTER TABLE "SpinPrizes" ADD COLUMN IF NOT EXISTS "DiscountValue" numeric(18,2);
        ALTER TABLE "SpinPrizes" ADD COLUMN IF NOT EXISTS "DiscountMaxAmount" numeric(18,2);
        ALTER TABLE "SpinPrizes" ADD COLUMN IF NOT EXISTS "DiscountMinOrderAmount" numeric(18,2);
        ALTER TABLE "SpinPrizes" ADD COLUMN IF NOT EXISTS "DiscountGameId" uuid;
        ALTER TABLE "SpinPrizes" ADD COLUMN IF NOT EXISTS "DiscountValidDays" integer;
        """;

    private const string PartB = """
        DO $EF$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_Orders_Coupons_CouponId') THEN
                ALTER TABLE "Orders" ADD CONSTRAINT "FK_Orders_Coupons_CouponId" FOREIGN KEY ("CouponId") REFERENCES "Coupons" ("Id") ON DELETE SET NULL;
            END IF;
        END $EF$;
        """;

    private const string PartC = """
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_Coupons_Code" ON "Coupons" ("Code");
        CREATE INDEX IF NOT EXISTS "IX_Coupons_OwnerUserId" ON "Coupons" ("OwnerUserId");
        CREATE INDEX IF NOT EXISTS "IX_Coupons_Source_CreatedAt" ON "Coupons" ("Source", "CreatedAt");
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_CouponRedemptions_OrderId" ON "CouponRedemptions" ("OrderId");
        CREATE INDEX IF NOT EXISTS "IX_CouponRedemptions_CouponId_UserId" ON "CouponRedemptions" ("CouponId", "UserId");
        CREATE INDEX IF NOT EXISTS "IX_Orders_CouponId" ON "Orders" ("CouponId");
        """;

    /// <summary>Runs the three idempotent parts in order.</summary>
    public static async Task EnsureAsync(MoxicDbContext db)
    {
        await db.Database.ExecuteSqlRawAsync(PartA);
        await db.Database.ExecuteSqlRawAsync(PartB);
        await db.Database.ExecuteSqlRawAsync(PartC);
    }
}
