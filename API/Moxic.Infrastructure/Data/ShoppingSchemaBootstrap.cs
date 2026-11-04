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
        ALTER TABLE "Games" ADD COLUMN IF NOT EXISTS "NameEn" text;
        ALTER TABLE "Games" ADD COLUMN IF NOT EXISTS "DescriptionEn" text;
        ALTER TABLE "FaqItems" ADD COLUMN IF NOT EXISTS "QuestionEn" text;
        ALTER TABLE "FaqItems" ADD COLUMN IF NOT EXISTS "AnswerEn" text;
        ALTER TABLE "Announcements" ADD COLUMN IF NOT EXISTS "TitleEn" text;
        ALTER TABLE "Announcements" ADD COLUMN IF NOT EXISTS "SubtitleEn" text;
        ALTER TABLE "Announcements" ADD COLUMN IF NOT EXISTS "BodyEn" text;
        ALTER TABLE "Announcements" ADD COLUMN IF NOT EXISTS "CountdownLabelEn" text;
        ALTER TABLE "Announcements" ADD COLUMN IF NOT EXISTS "CtaLabelEn" text;
        ALTER TABLE "SpinCases" ADD COLUMN IF NOT EXISTS "NameEn" text;
        ALTER TABLE "SpinCases" ADD COLUMN IF NOT EXISTS "DescriptionEn" text;
        ALTER TABLE "SpinPrizes" ADD COLUMN IF NOT EXISTS "NameEn" text;
        ALTER TABLE "RewardItems" ADD COLUMN IF NOT EXISTS "NameEn" text;
        ALTER TABLE "RewardItems" ADD COLUMN IF NOT EXISTS "DescriptionEn" text;
        ALTER TABLE "Coupons" ADD COLUMN IF NOT EXISTS "NameEn" text;

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

        ALTER TABLE "Orders" ADD COLUMN IF NOT EXISTS "IsGift" boolean NOT NULL DEFAULT FALSE;
        ALTER TABLE "Orders" ADD COLUMN IF NOT EXISTS "Lang" character varying(5) NOT NULL DEFAULT 'vi';
        ALTER TABLE "CustomerProfiles" ADD COLUMN IF NOT EXISTS "Lang" character varying(5) NOT NULL DEFAULT 'vi';
        ALTER TABLE "Orders" ADD COLUMN IF NOT EXISTS "GiftToken" character varying(32);
        ALTER TABLE "Orders" ADD COLUMN IF NOT EXISTS "GiftFromName" character varying(60);
        ALTER TABLE "Orders" ADD COLUMN IF NOT EXISTS "GiftRecipientName" character varying(60);
        ALTER TABLE "Orders" ADD COLUMN IF NOT EXISTS "GiftMessage" character varying(300);
        ALTER TABLE "Orders" ADD COLUMN IF NOT EXISTS "GiftRecipientPhone" character varying(20);
        ALTER TABLE "Orders" ADD COLUMN IF NOT EXISTS "GiftClaimedAt" timestamp with time zone;
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_Orders_GiftToken" ON "Orders" ("GiftToken");

        CREATE TABLE IF NOT EXISTS "RewardItems" (
            "Id" uuid NOT NULL,
            "Name" character varying(100) NOT NULL,
            "Description" character varying(300),
            "Kind" character varying(20) NOT NULL,
            "PointsCost" integer NOT NULL,
            "DiscountType" character varying(20),
            "DiscountValue" numeric(18,2),
            "DiscountMaxAmount" numeric(18,2),
            "DiscountMinOrderAmount" numeric(18,2),
            "SpinCaseId" uuid,
            "ValidDays" integer NOT NULL,
            "Stock" integer,
            "RedeemedCount" integer NOT NULL,
            "PerUserLimit" integer,
            "IsActive" boolean NOT NULL,
            "DisplayOrder" integer NOT NULL,
            "CreatedAt" timestamp with time zone NOT NULL,
            "UpdatedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_RewardItems" PRIMARY KEY ("Id")
        );
        CREATE TABLE IF NOT EXISTS "RewardRedemptions" (
            "Id" uuid NOT NULL,
            "RewardItemId" uuid NOT NULL,
            "UserId" text NOT NULL,
            "ItemName" character varying(100) NOT NULL,
            "Kind" character varying(20) NOT NULL,
            "PointsSpent" integer NOT NULL,
            "IssuedCode" character varying(32) NOT NULL,
            "CouponId" uuid,
            "SpinCodeId" uuid,
            "ExpiresAt" timestamp with time zone,
            "CreatedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_RewardRedemptions" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_RewardRedemptions_aspnetusers_UserId" FOREIGN KEY ("UserId") REFERENCES aspnetusers ("Id") ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS "IX_RewardRedemptions_UserId_CreatedAt" ON "RewardRedemptions" ("UserId", "CreatedAt");
        CREATE INDEX IF NOT EXISTS "IX_RewardRedemptions_RewardItemId_UserId" ON "RewardRedemptions" ("RewardItemId", "UserId");

        CREATE TABLE IF NOT EXISTS "ChatThreads" (
            "Id" uuid NOT NULL,
            "Code" character varying(8) NOT NULL,
            "AccessKeyHash" character varying(64) NOT NULL,
            "UserId" character varying(450),
            "Name" character varying(60),
            "Contact" character varying(100),
            "OrderCode" character varying(50),
            "AdminUnread" integer NOT NULL,
            "CustomerUnread" integer NOT NULL,
            "LastMessageAt" timestamp with time zone NOT NULL,
            "CreatedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_ChatThreads" PRIMARY KEY ("Id")
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_ChatThreads_Code" ON "ChatThreads" ("Code");
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_ChatThreads_AccessKeyHash" ON "ChatThreads" ("AccessKeyHash");
        CREATE INDEX IF NOT EXISTS "IX_ChatThreads_UserId" ON "ChatThreads" ("UserId");
        CREATE INDEX IF NOT EXISTS "IX_ChatThreads_LastMessageAt" ON "ChatThreads" ("LastMessageAt");
        CREATE TABLE IF NOT EXISTS "ChatMessages" (
            "Id" uuid NOT NULL,
            "ThreadId" uuid NOT NULL,
            "FromAdmin" boolean NOT NULL,
            "Text" character varying(2000) NOT NULL,
            "OrderCode" character varying(50),
            "Via" character varying(10),
            "CreatedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_ChatMessages" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_ChatMessages_ChatThreads_ThreadId" FOREIGN KEY ("ThreadId") REFERENCES "ChatThreads" ("Id") ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS "IX_ChatMessages_ThreadId_CreatedAt" ON "ChatMessages" ("ThreadId", "CreatedAt");
        CREATE INDEX IF NOT EXISTS "IX_ChatMessages_OrderCode" ON "ChatMessages" ("OrderCode");
        CREATE TABLE IF NOT EXISTS "ChatTelegramRefs" (
            "TelegramChatId" bigint NOT NULL,
            "TelegramMessageId" bigint NOT NULL,
            "ThreadId" uuid NOT NULL,
            "CreatedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_ChatTelegramRefs" PRIMARY KEY ("TelegramChatId", "TelegramMessageId"),
            CONSTRAINT "FK_ChatTelegramRefs_ChatThreads_ThreadId" FOREIGN KEY ("ThreadId") REFERENCES "ChatThreads" ("Id") ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS "TelegramAdminChats" (
            "ChatId" bigint NOT NULL,
            "Name" character varying(100),
            "LinkedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_TelegramAdminChats" PRIMARY KEY ("ChatId")
        );

        ALTER TABLE "TelegramAdminChats" ADD COLUMN IF NOT EXISTS "OrdersTopicId" bigint;
        ALTER TABLE "TelegramAdminChats" ADD COLUMN IF NOT EXISTS "ChatTopicId" bigint;
        ALTER TABLE "ChatThreads" ADD COLUMN IF NOT EXISTS "TgTopicChatId" bigint;
        ALTER TABLE "ChatThreads" ADD COLUMN IF NOT EXISTS "TgTopicId" bigint;
        ALTER TABLE "ChatThreads" ADD COLUMN IF NOT EXISTS "TgTopicCloseAt" timestamp with time zone;
        CREATE INDEX IF NOT EXISTS "IX_ChatTelegramRefs_CreatedAt" ON "ChatTelegramRefs" ("CreatedAt");

        CREATE TABLE IF NOT EXISTS "TelegramOrderMessages" (
            "ChatId" bigint NOT NULL,
            "MessageId" bigint NOT NULL,
            "OrderId" uuid NOT NULL,
            "CreatedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_TelegramOrderMessages" PRIMARY KEY ("ChatId", "MessageId")
        );
        CREATE INDEX IF NOT EXISTS "IX_TelegramOrderMessages_OrderId" ON "TelegramOrderMessages" ("OrderId");

        ALTER TABLE "PaymentConfigs" ADD COLUMN IF NOT EXISTS "BankCode" character varying(20);
        CREATE TABLE IF NOT EXISTS "BankTransactions" (
            "Id" uuid NOT NULL,
            "Provider" character varying(20) NOT NULL,
            "ProviderTxnId" character varying(64) NOT NULL,
            "Amount" numeric(18,2) NOT NULL,
            "Content" character varying(500),
            "Gateway" character varying(50),
            "AccountNumber" character varying(50),
            "ReferenceCode" character varying(100),
            "TransactionDate" timestamp with time zone,
            "Status" character varying(20) NOT NULL,
            "OrderId" uuid,
            "OrderCode" character varying(50),
            "Note" character varying(300),
            "CreatedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_BankTransactions" PRIMARY KEY ("Id")
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_BankTransactions_Provider_ProviderTxnId" ON "BankTransactions" ("Provider", "ProviderTxnId");
        CREATE INDEX IF NOT EXISTS "IX_BankTransactions_CreatedAt" ON "BankTransactions" ("CreatedAt");
        CREATE INDEX IF NOT EXISTS "IX_BankTransactions_OrderId" ON "BankTransactions" ("OrderId");

        ALTER TABLE "Orders" ADD COLUMN IF NOT EXISTS "PaidAt" timestamp with time zone;
        ALTER TABLE "Orders" ADD COLUMN IF NOT EXISTS "InstallStartedAt" timestamp with time zone;
        ALTER TABLE "Orders" ADD COLUMN IF NOT EXISTS "DownloadingAt" timestamp with time zone;
        ALTER TABLE "Orders" ADD COLUMN IF NOT EXISTS "CompletedAt" timestamp with time zone;
        UPDATE "Orders" SET "PaidAt" = "UpdatedAt" WHERE "PaidAt" IS NULL AND "Status" IN ('Verifying', 'Installing', 'ActionRequired', 'Completed');
        UPDATE "Orders" SET "InstallStartedAt" = "UpdatedAt" WHERE "InstallStartedAt" IS NULL AND "Status" IN ('Installing', 'Completed');
        UPDATE "Orders" SET "CompletedAt" = "UpdatedAt" WHERE "CompletedAt" IS NULL AND "Status" = 'Completed';

        ALTER TABLE "OrderDetails" ADD COLUMN IF NOT EXISTS "ListPrice" numeric(18,2);
        UPDATE "OrderDetails" d SET "ListPrice" = COALESCE(
            (SELECT e."OriginalPrice" FROM "GameEditions" e WHERE e."Id" = d."EditionId"),
            (SELECT g."OriginalPrice" FROM "Games" g WHERE g."Id" = d."GameId"))
        WHERE d."ListPrice" IS NULL;

        CREATE TABLE IF NOT EXISTS "LeaderboardAwards" (
            "Id" uuid NOT NULL,
            "Month" character varying(7) NOT NULL,
            "Board" character varying(20) NOT NULL,
            "Rank" integer NOT NULL,
            "UserId" character varying(450) NOT NULL,
            "DisplayName" character varying(100) NOT NULL,
            "Score" integer NOT NULL,
            "Points" integer NOT NULL,
            "CreatedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_LeaderboardAwards" PRIMARY KEY ("Id")
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_LeaderboardAwards_Month_Board_Rank" ON "LeaderboardAwards" ("Month", "Board", "Rank");
        CREATE INDEX IF NOT EXISTS "IX_LeaderboardAwards_UserId" ON "LeaderboardAwards" ("UserId");

        CREATE TABLE IF NOT EXISTS "GuessPuzzles" (
            "Date" character varying(10) NOT NULL,
            "GameId" uuid NOT NULL,
            "ObjectKey" character varying(500) NOT NULL,
            "CreatedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_GuessPuzzles" PRIMARY KEY ("Date")
        );
        CREATE INDEX IF NOT EXISTS "IX_GuessPuzzles_GameId" ON "GuessPuzzles" ("GameId");
        CREATE TABLE IF NOT EXISTS "GuessImages" (
            "Date" character varying(10) NOT NULL,
            "Level" integer NOT NULL,
            "Data" bytea NOT NULL,
            "CreatedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_GuessImages" PRIMARY KEY ("Date", "Level")
        );
        CREATE TABLE IF NOT EXISTS "GuessPlays" (
            "Id" uuid NOT NULL,
            "Date" character varying(10) NOT NULL,
            "PlayerKey" character varying(80) NOT NULL,
            "UserId" character varying(450),
            "Guesses" character varying(400) NOT NULL,
            "Tries" integer NOT NULL,
            "Solved" boolean NOT NULL,
            "Finished" boolean NOT NULL,
            "Points" integer NOT NULL,
            "CreatedAt" timestamp with time zone NOT NULL,
            "UpdatedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_GuessPlays" PRIMARY KEY ("Id")
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_GuessPlays_Date_PlayerKey" ON "GuessPlays" ("Date", "PlayerKey");
        CREATE INDEX IF NOT EXISTS "IX_GuessPlays_UserId_Date" ON "GuessPlays" ("UserId", "Date");

        CREATE TABLE IF NOT EXISTS "FaqItems" (
            "Id" uuid NOT NULL,
            "Question" character varying(300) NOT NULL,
            "Answer" character varying(3000) NOT NULL,
            "DisplayOrder" integer NOT NULL,
            "IsActive" boolean NOT NULL,
            "UpdatedAt" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_FaqItems" PRIMARY KEY ("Id")
        );
        INSERT INTO "FaqItems" ("Id", "Question", "Answer", "DisplayOrder", "IsActive", "UpdatedAt")
        SELECT v.id, v.q, v.a, v.o, TRUE, now() FROM (VALUES
            ('5eed00f0-0000-4000-8000-000000000001'::uuid, 'Moxic GameStore là gì?', 'Moxic GameStore (moxic.co) là cửa hàng game Xbox bản quyền dạng kỹ thuật số tại Việt Nam. Giá thường thấp hơn giá niêm yết trên Microsoft Store Việt Nam khoảng 30%. Sau khi bạn thanh toán, nhân viên Moxic cài game trực tiếp vào tài khoản Xbox của bạn.', 1),
            ('5eed00f0-0000-4000-8000-000000000002'::uuid, 'Mua game Xbox ở đâu rẻ và uy tín?', 'Bạn có thể mua tại Moxic GameStore (moxic.co). Moxic công khai bảng so sánh giá Xbox Store và giá Moxic cho từng game, cập nhật hằng ngày tại moxic.co/bang-gia-xbox; thanh toán bằng mã QR được xác nhận tự động; trạng thái đơn được cập nhật trực tiếp; có chat hỗ trợ ngay trên web.', 2),
            ('5eed00f0-0000-4000-8000-000000000003'::uuid, 'Vì sao giá game ở Moxic rẻ hơn Xbox Store?', 'Moxic tối ưu nguồn mua và chi phí vận hành để bán thấp hơn giá niêm yết của Xbox Store Việt Nam. Giá Xbox Store và giá Moxic của từng game được so sánh công khai tại trang Bảng giá game Xbox.', 3),
            ('5eed00f0-0000-4000-8000-000000000004'::uuid, 'Quy trình mua game Xbox tại Moxic như thế nào?', '1) Chọn game và bấm Mua. 2) Nhập email và mật khẩu tài khoản Xbox của bạn ở bước thanh toán. 3) Quét mã QR để chuyển khoản, hệ thống tự xác nhận khi tiền về. 4) Moxic đăng nhập và cài game vào tài khoản của bạn. 5) Bạn nhận thông báo khi hoàn tất và theo dõi từng bước trên trang đơn hàng.', 4),
            ('5eed00f0-0000-4000-8000-000000000005'::uuid, 'Mua xong bao lâu thì có game?', 'Thường trong khoảng 15 đến 30 phút sau khi Moxic nhận được thanh toán. Bạn theo dõi trực tiếp các bước: đã nhận tiền, đăng nhập Xbox, đang tải game, hoàn tất.', 5),
            ('5eed00f0-0000-4000-8000-000000000006'::uuid, 'Thanh toán bằng cách nào?', 'Chuyển khoản ngân hàng bằng mã QR riêng cho từng đơn (đã điền sẵn số tiền và nội dung, được xác nhận tự động), hoặc thanh toán bằng tiền mã hóa (USDT).', 6),
            ('5eed00f0-0000-4000-8000-000000000007'::uuid, 'Cung cấp mật khẩu tài khoản Xbox có an toàn không?', 'Mật khẩu được mã hóa khi lưu và chỉ dùng để đăng nhập cài game. Trong lúc cài bạn không nên đăng nhập tài khoản để tránh bị đăng xuất; sau khi game đã được cài xong, bạn nên đổi mật khẩu.', 7),
            ('5eed00f0-0000-4000-8000-000000000008'::uuid, 'Moxic có cho thuê game Xbox không?', 'Có. Tại moxic.co/rent bạn có thể thuê game theo gói thời gian với giá thấp hơn mua đứt.', 8),
            ('5eed00f0-0000-4000-8000-000000000009'::uuid, 'Có đặt trước game sắp ra mắt được không?', 'Có. Các game sắp ra mắt được mở đặt trước trên Moxic; game sẽ được cài vào tài khoản của bạn khi phát hành.', 9),
            ('5eed00f0-0000-4000-8000-000000000010'::uuid, 'Có thể mua game Xbox tặng bạn bè không?', 'Có. Chọn "Mua làm quà tặng" khi thanh toán, bạn nhận một link quà để gửi; người nhận tự nhập tài khoản Xbox của họ và Moxic cài game cho họ.', 10),
            ('5eed00f0-0000-4000-8000-000000000011'::uuid, 'Liên hệ hỗ trợ Moxic bằng cách nào?', 'Chat trực tiếp ngay trên moxic.co (nút chat ở góc phải dưới), hoặc qua Zalo, Messenger, điện thoại hiển thị trên trang web.', 11)
        ) AS v(id, q, a, o)
        WHERE NOT EXISTS (SELECT 1 FROM "FaqItems");

        INSERT INTO "RewardItems" ("Id", "Name", "Description", "Kind", "PointsCost", "DiscountType", "DiscountValue", "DiscountMaxAmount", "DiscountMinOrderAmount", "ValidDays", "RedeemedCount", "IsActive", "DisplayOrder", "CreatedAt", "UpdatedAt")
        SELECT v.id, v.name, v.descr, 'Coupon', v.cost, v.dtype, v.val, v.maxamt, v.minord, 30, 0, TRUE, v.ord, now(), now()
        FROM (VALUES
            ('7a1d0c3e-0001-4000-8000-000000000001'::uuid, 'Giảm 20.000đ', 'Cho đơn từ 200.000đ', 300, 'Fixed', 20000::numeric, NULL::numeric, 200000::numeric, 1),
            ('7a1d0c3e-0001-4000-8000-000000000002'::uuid, 'Giảm 50.000đ', 'Cho đơn từ 500.000đ', 700, 'Fixed', 50000::numeric, NULL::numeric, 500000::numeric, 2),
            ('7a1d0c3e-0001-4000-8000-000000000003'::uuid, 'Giảm 10% tối đa 150.000đ', 'Cho mọi đơn hàng', 1500, 'Percent', 10::numeric, 150000::numeric, NULL::numeric, 3)
        ) AS v(id, name, descr, cost, dtype, val, maxamt, minord, ord)
        WHERE NOT EXISTS (SELECT 1 FROM "RewardItems");

        -- Buying spin codes by bank transfer
        ALTER TABLE "SpinCases" ADD COLUMN IF NOT EXISTS "CodePrice" numeric(18,2) NOT NULL DEFAULT 0;
        CREATE TABLE IF NOT EXISTS "SpinCodeOrders" (
            "Id" uuid NOT NULL,
            "Code" character varying(20) NOT NULL,
            "UserId" character varying(450) NOT NULL,
            "CaseId" uuid NOT NULL,
            "Quantity" integer NOT NULL,
            "UnitPrice" numeric(18,2) NOT NULL,
            "Amount" numeric(18,2) NOT NULL,
            "Status" character varying(20) NOT NULL,
            "SpinCodeId" uuid,
            "CreatedAt" timestamp with time zone NOT NULL,
            "PaidAt" timestamp with time zone,
            CONSTRAINT "PK_SpinCodeOrders" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_SpinCodeOrders_SpinCases_CaseId" FOREIGN KEY ("CaseId") REFERENCES "SpinCases" ("Id") ON DELETE CASCADE,
            CONSTRAINT "FK_SpinCodeOrders_SpinCodes_SpinCodeId" FOREIGN KEY ("SpinCodeId") REFERENCES "SpinCodes" ("Id") ON DELETE SET NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_SpinCodeOrders_Code" ON "SpinCodeOrders" ("Code");
        CREATE INDEX IF NOT EXISTS "IX_SpinCodeOrders_UserId" ON "SpinCodeOrders" ("UserId");
        """;

    public static Task EnsureAsync(MoxicDbContext db) => db.Database.ExecuteSqlRawAsync(Sql);
}
