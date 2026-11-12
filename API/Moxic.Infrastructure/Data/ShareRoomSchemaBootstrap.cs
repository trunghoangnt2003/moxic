using Microsoft.EntityFrameworkCore;

namespace Moxic.Infrastructure.Data;

/// <summary>
/// Idempotent DDL for share rooms (2 customers buy one game together): ShareRooms, ShareSeats, ShareMessages,
/// Games.AllowShare and Orders.ShareRoomId/ProvidedAccount*;
/// CouponRedemptions: one per member per order (OrderId no longer unique). Copied from the EF create script.
/// Program.cs uses EnsureCreated (a no-op on existing databases), so existing databases are upgraded here.
/// NOTE: no curly braces in the SQL — ExecuteSqlRaw treats them as format placeholders.
/// </summary>
public static class ShareRoomSchemaBootstrap
{
    private const string Sql = """
        CREATE TABLE IF NOT EXISTS "ShareRooms" (
            "Id" uuid NOT NULL,
            "Code" character varying(12) NOT NULL,
            "GameId" uuid NOT NULL,
            "EditionId" uuid,
            "GameName" character varying(300) NOT NULL,
            "TotalPrice" numeric(18,2) NOT NULL,
            "AccountType" character varying(20) NOT NULL,
            "OwnerPercent" integer NOT NULL,
            "IsPublic" boolean NOT NULL,
            "Status" character varying(20) NOT NULL,
            "OwnerUserId" character varying(450) NOT NULL,
            "Locked" boolean NOT NULL,
            "OrderId" uuid,
            "CancelReason" character varying(300),
            "CreatedAt" timestamp with time zone NOT NULL,
            "UpdatedAt" timestamp with time zone NOT NULL,
            "FullAt" timestamp with time zone,
            "FundedAt" timestamp with time zone,
            "ClosedAt" timestamp with time zone,
            CONSTRAINT "PK_ShareRooms" PRIMARY KEY ("Id")
        );
        CREATE TABLE IF NOT EXISTS "ShareMessages" (
            "Id" uuid NOT NULL,
            "RoomId" uuid NOT NULL,
            "UserId" character varying(450),
            "Text" character varying(1000) NOT NULL,
            "TextEn" character varying(1000),
            "Reported" boolean NOT NULL,
            "CreatedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_ShareMessages" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_ShareMessages_ShareRooms_RoomId" FOREIGN KEY ("RoomId") REFERENCES "ShareRooms" ("Id") ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS "ShareSeats" (
            "Id" uuid NOT NULL,
            "RoomId" uuid NOT NULL,
            "UserId" character varying(450) NOT NULL,
            "DisplayName" character varying(100) NOT NULL,
            "IsOwner" boolean NOT NULL,
            "Percent" integer NOT NULL,
            "ShareAmount" numeric(18,2) NOT NULL,
            "DiscountAmount" numeric(18,2) NOT NULL,
            "CouponId" uuid,
            "CouponCode" character varying(32),
            "AmountDue" numeric(18,2) NOT NULL,
            "PaymentCode" character varying(20),
            "PaidAmount" numeric(18,2) NOT NULL,
            "PaidAt" timestamp with time zone,
            "XboxEmail" character varying(200),
            "XboxPasswordEncrypted" character varying(500),
            "Lang" character varying(5) NOT NULL,
            "JoinedAt" timestamp with time zone NOT NULL,
            "LeftAt" timestamp with time zone,
            "LeftReason" character varying(20),
            "ReminderSentAt" timestamp with time zone,
            "NeedsRefund" boolean NOT NULL,
            "RefundedAt" timestamp with time zone,
            CONSTRAINT "PK_ShareSeats" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_ShareSeats_ShareRooms_RoomId" FOREIGN KEY ("RoomId") REFERENCES "ShareRooms" ("Id") ON DELETE CASCADE
        );
        ALTER TABLE "Games" ADD COLUMN IF NOT EXISTS "AllowShare" boolean NOT NULL DEFAULT FALSE;
        ALTER TABLE "Games" ADD COLUMN IF NOT EXISTS "ShareSurcharge" numeric(18,2) NOT NULL DEFAULT 0;
        ALTER TABLE "Orders" ADD COLUMN IF NOT EXISTS "ShareRoomId" uuid;
        ALTER TABLE "Orders" ADD COLUMN IF NOT EXISTS "ProvidedAccountEmail" character varying(200);
        ALTER TABLE "Orders" ADD COLUMN IF NOT EXISTS "ProvidedAccountPasswordEncrypted" character varying(500);
        CREATE INDEX IF NOT EXISTS "IX_Orders_ShareRoomId" ON "Orders" ("ShareRoomId");
        CREATE INDEX IF NOT EXISTS "IX_ShareMessages_RoomId_CreatedAt" ON "ShareMessages" ("RoomId", "CreatedAt");
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_ShareRooms_Code" ON "ShareRooms" ("Code");
        CREATE INDEX IF NOT EXISTS "IX_ShareRooms_Status_IsPublic_GameId" ON "ShareRooms" ("Status", "IsPublic", "GameId");
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_ShareSeats_PaymentCode" ON "ShareSeats" ("PaymentCode");
        CREATE INDEX IF NOT EXISTS "IX_ShareSeats_RoomId" ON "ShareSeats" ("RoomId");
        CREATE INDEX IF NOT EXISTS "IX_ShareSeats_UserId" ON "ShareSeats" ("UserId");
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_indexes i JOIN pg_class c ON c.relname = i.indexname JOIN pg_index x ON x.indexrelid = c.oid
                       WHERE i.indexname = 'IX_CouponRedemptions_OrderId' AND x.indisunique) THEN
                DROP INDEX "IX_CouponRedemptions_OrderId";
            END IF;
        END $$;
        CREATE INDEX IF NOT EXISTS "IX_CouponRedemptions_OrderId" ON "CouponRedemptions" ("OrderId");
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_CouponRedemptions_OrderId_UserId" ON "CouponRedemptions" ("OrderId", "UserId");
        """;

    public static Task EnsureAsync(MoxicDbContext db) => db.Database.ExecuteSqlRawAsync(Sql);
}
