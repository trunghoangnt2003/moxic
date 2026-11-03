using Microsoft.EntityFrameworkCore;

namespace Moxic.Infrastructure.Data;

/// <summary>
/// Idempotent DDL for customer accounts (Orders.CustomerId, CustomerProfiles, CustomerOtpCodes).
/// Program.cs uses EnsureCreated (a no-op on existing databases), so existing
/// dev/test/prod databases receive these objects here. DDL copied from
/// `dotnet ef migrations script 20261103123336_AddLuckySpinAndContactSettings AddCustomerAccounts`.
/// The Identity users table is the lowercase `aspnetusers` (ToTable mapping in MoxicDbContext).
/// NOTE: no curly braces in the SQL — ExecuteSqlRaw treats them as format placeholders.
/// </summary>
public static class CustomerAccountSchemaBootstrap
{
    private const string Ddl = """
        ALTER TABLE "Orders" ADD COLUMN IF NOT EXISTS "CustomerId" text;

        CREATE TABLE IF NOT EXISTS "CustomerOtpCodes" (
            "Id" uuid NOT NULL,
            "UserId" text NOT NULL,
            "Purpose" character varying(20) NOT NULL,
            "CodeHash" character varying(200) NOT NULL,
            "ExpiresAt" timestamp with time zone NOT NULL,
            "FailedAttempts" integer NOT NULL,
            "ConsumedAt" timestamp with time zone,
            "CreatedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_CustomerOtpCodes" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_CustomerOtpCodes_aspnetusers_UserId" FOREIGN KEY ("UserId") REFERENCES aspnetusers ("Id") ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS "CustomerProfiles" (
            "UserId" text NOT NULL,
            "DisplayName" character varying(50) NOT NULL,
            "Points" integer NOT NULL DEFAULT 0,
            "CreatedAt" timestamp with time zone NOT NULL,
            "UpdatedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_CustomerProfiles" PRIMARY KEY ("UserId"),
            CONSTRAINT "FK_CustomerProfiles_aspnetusers_UserId" FOREIGN KEY ("UserId") REFERENCES aspnetusers ("Id") ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS "IX_Orders_CustomerId" ON "Orders" ("CustomerId");
        CREATE INDEX IF NOT EXISTS "IX_CustomerOtpCodes_UserId_Purpose" ON "CustomerOtpCodes" ("UserId", "Purpose");
        """;

    public static async Task EnsureAsync(MoxicDbContext db)
    {
        await db.Database.ExecuteSqlRawAsync(Ddl);
    }
}
