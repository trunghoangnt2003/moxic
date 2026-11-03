---
phase: quick-261103-sls
plan: 01
type: execute
wave: 1
depends_on: []   # hard precondition instead: quick-261103-sa8 must be COMMITTED before Task 1 starts (gate in Task 1)
files_modified:
  # Task 1 - backend core (new)
  - API/Moxic.Shared/Enums/SpinCaseOpenMethod.cs
  - API/Moxic.Shared/Enums/PointsReason.cs
  - API/Moxic.Core/Entities/SpinCase.cs
  - API/Moxic.Core/Entities/SpinCaseCooldown.cs
  - API/Moxic.Core/Entities/PointsTransaction.cs
  - API/Moxic.Core/Entities/SpinMusicTrack.cs
  - API/Moxic.Infrastructure/Data/LuckySpinCasesSchemaBootstrap.cs
  - API/Moxic.Infrastructure/Data/Migrations/*_AddSpinCasesPointsMusic.cs
  - API/Moxic.Infrastructure/Data/Migrations/*_AddSpinCasesPointsMusic.Designer.cs
  - API/Moxic.Api/Services/PointsService.cs
  - API/Moxic.Api/Services/SpinUserRateLimiter.cs
  - API/Moxic.Api/Models/LuckySpinDtos.cs
  - API/Moxic.Api/Controllers/LuckySpinFeedController.cs
  - API/Moxic.Api/Controllers/AccountPointsController.cs
  # Task 1 - backend core (modified)
  - API/Moxic.Core/Entities/SpinPrize.cs
  - API/Moxic.Core/Entities/SpinCode.cs
  - API/Moxic.Core/Entities/SpinHistory.cs
  - API/Moxic.Core/Entities/Game.cs
  - API/Moxic.Core/Entities/Order.cs
  - API/Moxic.Infrastructure/Data/MoxicDbContext.cs
  - API/Moxic.Infrastructure/Data/Migrations/MoxicDbContextModelSnapshot.cs
  - API/Moxic.Api/Services/LuckySpinRules.cs
  - API/Moxic.Api/Controllers/LuckySpinController.cs
  - API/Moxic.Api/Controllers/AdminLuckySpinController.cs
  - API/Moxic.Api/Controllers/AdminOrdersController.cs
  - API/Moxic.Api/Program.cs
  # Task 2 - admin vertical (backend + admin SPA)
  - API/Moxic.Api/Services/MediaSniffer.cs
  - API/Moxic.Api/Models/AdminSpinDtos.cs
  - API/Moxic.Api/Controllers/AdminSpinCasesController.cs
  - API/Moxic.Api/Controllers/AdminCustomersController.cs
  - API/Moxic.Api/Controllers/AdminSpinMusicController.cs
  - API/Moxic.Api/Controllers/AdminGamesController.cs
  - API/Moxic.Api/Models/Dtos.cs
  - Moxic.Admin/src/lib/luckySpinAdmin.ts
  - Moxic.Admin/src/pages/LuckySpin.tsx
  - Moxic.Admin/src/pages/LuckySpinCases.tsx
  - Moxic.Admin/src/pages/LuckySpinPrizes.tsx
  - Moxic.Admin/src/pages/LuckySpinCodes.tsx
  - Moxic.Admin/src/pages/LuckySpinHistory.tsx
  - Moxic.Admin/src/pages/Customers.tsx
  - Moxic.Admin/src/pages/SpinMusic.tsx
  - Moxic.Admin/src/pages/GameForm.tsx
  - Moxic.Admin/src/App.tsx
  # Task 3 - storefront
  - Moxic.Web/src/lib/luckySpinApi.ts
  - Moxic.Web/src/hooks/useLuckySpin.ts
  - Moxic.Web/src/lib/accountApi.ts
  - Moxic.Web/src/hooks/useAccount.ts
  - Moxic.Web/src/hooks/useCountdown.ts
  - Moxic.Web/src/hooks/useCaseMusic.ts
  - Moxic.Web/src/components/lucky-spin/CaseReel.tsx
  - Moxic.Web/src/components/lucky-spin/CaseCard.tsx
  - Moxic.Web/src/components/lucky-spin/LiveDropsBar.tsx
  - Moxic.Web/src/components/lucky-spin/ResultModal.tsx
  - Moxic.Web/src/pages/LuckySpinGalleryPage.tsx
  - Moxic.Web/src/pages/LuckySpinPage.tsx
  - Moxic.Web/src/pages/PointsHistoryPage.tsx
  - Moxic.Web/src/components/home/LuckySpinBanner.tsx
  - Moxic.Web/src/components/layout/Navbar.tsx
  - Moxic.Web/src/App.tsx
autonomous: true
requirements: [SLS-CASES, SLS-POINTS, SLS-MUSIC, SLS-REEL, SLS-LIVE-DROPS, SLS-IP]

must_haves:
  truths:
    - "Admin can create any number of cases ('hòm') with open method Code / FreeInterval (every N hours, default 24) / Points (cost N), each with its own prize list that must total exactly 100% and (Code only) its own spin codes; after API startup all v1 prizes, codes and spin history sit under a default Code case 'Hòm mã quay' with nothing lost (locked decision: idempotent bootstrap + EF migration)"
    - "/lucky-spin is a paged case gallery (method filter chips, search, 'Xem thêm hòm' load-more) whose cards show name, method badge ('Nhập mã' / 'Miễn phí mỗi 24h' / '500 điểm'), countdown or points cost; /lucky-spin/:slug opens one case: Code needs no login, FreeInterval works once per N hours per verified account with a live countdown, Points deducts the cost atomically and refuses when the balance is short — concurrent requests can never double-open a free case or overspend points"
    - "When an order moves Installing -> Completed, the sum of its games' RewardPoints is credited exactly once to the linked customer (Order.CustomerId, else the verified customer whose email matches the order email) and written to the PointsTransactions ledger; customers see their balance in the navbar/account menu and a 'Điểm thưởng' history page; admin sees a 'Khách hàng' list with balances + ledger and can adjust points with a required note, never below 0"
    - "Admin 'Kho nhạc' uploads mp3/ogg/m4a (<= 10MB, content sniffed), renames, enables/disables and deletes tracks; on the case page one random enabled track starts when the user clicks open (user gesture), fades out after the result, and a mute toggle persists in localStorage"
    - "The reel shows every prize of the case often (cosmetic rarity-biased filler built server-side), animates ~7.6s with cubic-bezier(0.05, 0.85, 0.15, 1) to the server-chosen winning index and server-provided stopOffset; when a common/uncommon/Luck prize wins, rare-or-better cards sit at winningIndex +/- 1 and the stop point is 5-20% from the edge next to the teased card; the outcome is decided only by the backend CSPRNG and the request carries nothing but an optional code"
    - "A LIVE strip on the gallery and case pages shows only REAL recent non-Luck wins from SpinHistory: a gold-bordered WOW block with the 3 latest epic/legendary wins (1 on mobile) and a feed of the latest 20 wins where new ones slide in from the left; winner names are masked (e.g. 'tr***g', guests 'Khách'); the endpoint exposes no email, IP, user id or reward code, is cached 5s server-side, hides wins younger than 10s (never spoils a reel in progress) and is polled every 8s"
    - "Rate-limit partitioning uses CF-Connecting-IP, then the first X-Forwarded-For hop, then the socket address (X-Real-IP is no longer trusted); FreeInterval/Points opens are additionally limited per user; dotnet build and both npm builds pass"
  artifacts:
    - path: "API/Moxic.Infrastructure/Data/LuckySpinCasesSchemaBootstrap.cs"
      provides: "Idempotent DDL + one-time data migration of the v1 pool into the default Code case"
      contains: "hom-ma-quay"
    - path: "API/Moxic.Api/Services/PointsService.cs"
      provides: "AwardForCompletedOrderAsync / TrySpendAsync / AdjustAsync with conditional updates + ledger"
      contains: "PointsAwardedAt == null"
    - path: "API/Moxic.Api/Services/LuckySpinRules.cs"
      provides: "CSPRNG draw, cosmetic reel + near-miss ReelLayout, MaskDisplayName, fixed GetClientIp"
      contains: "CF-Connecting-IP"
    - path: "API/Moxic.Api/Controllers/LuckySpinController.cs"
      provides: "GET cases (paged), GET cases/{slug}, POST cases/{slug}/open, GET code-lookup"
      contains: "ON CONFLICT"
    - path: "API/Moxic.Api/Controllers/LuckySpinFeedController.cs"
      provides: "GET /api/lucky-spin/live-drops (IMemoryCache 5s) and GET /api/lucky-spin/music"
      contains: "IMemoryCache"
    - path: "API/Moxic.Api/Controllers/AdminCustomersController.cs"
      provides: "Customer list with balances, ledger, manual adjust"
      contains: "AdjustAsync"
    - path: "API/Moxic.Api/Controllers/AdminSpinMusicController.cs"
      provides: "Music library CRUD with size limit + sniffing"
      contains: "RequestSizeLimit"
    - path: "Moxic.Web/src/components/lucky-spin/LiveDropsBar.tsx"
      provides: "LIVE strip (WOW block + feed)"
      min_lines: 80
    - path: "Moxic.Web/src/pages/LuckySpinGalleryPage.tsx"
      provides: "Paged case gallery"
      contains: "useLuckySpinCases"
    - path: "Moxic.Web/src/hooks/useCaseMusic.ts"
      provides: "Random track per visit, gesture start, fade out, persisted mute"
      contains: "localStorage"
  key_links:
    - from: "API/Moxic.Api/Controllers/AdminOrdersController.cs"
      to: "PointsService.AwardForCompletedOrderAsync"
      via: "called inside the status-change transaction when newStatus == Completed"
      pattern: "AwardForCompletedOrderAsync"
    - from: "API/Moxic.Api/Controllers/LuckySpinController.cs"
      to: "PointsService.TrySpendAsync / SpinCaseCooldowns upsert"
      via: "atomic consume inside the open transaction before the CSPRNG draw"
      pattern: "TrySpendAsync"
    - from: "API/Moxic.Api/Program.cs"
      to: "LuckySpinCasesSchemaBootstrap"
      via: "startup call right after CustomerAccountSchemaBootstrap.EnsureAsync"
      pattern: "LuckySpinCasesSchemaBootstrap.EnsureAsync"
    - from: "Moxic.Web/src/components/lucky-spin/CaseReel.tsx"
      to: "OpenCaseResult.stopOffset"
      via: "landing offset comes from the server, not Math.random"
      pattern: "stopOffset"
    - from: "Moxic.Web/src/hooks/useLuckySpin.ts"
      to: "/api/lucky-spin/live-drops"
      via: "useLiveDrops with refetchInterval 8000"
      pattern: "refetchInterval"
    - from: "Moxic.Web/src/components/layout/Navbar.tsx"
      to: "CustomerMe.points"
      via: "useMe() account button + dropdown"
      pattern: "points"
---

<objective>
Turn the single-pool lucky spin into multiple cases, add loyalty points, case music, a dramatic near-miss reel, and a live drops feed, all fully wired (API + admin SPA + storefront):

1. SpinCase entity with three open methods (Code / FreeInterval / Points), per-case prizes and codes, and the v1 pool migrated into a default "Hòm mã quay" case (locked decision: idempotent bootstrap SQL + EF migration, no data loss).
2. Loyalty points: Game.RewardPoints, an idempotent credit when an order is Completed, a PointsTransactions ledger, atomic spend on Points cases, admin customers page with adjust, customer balance + history.
3. Admin music library ("Kho nhạc") + storefront playback that starts on the open click and fades out after the result.
4. Cosmetic, rarity-biased reel filler, server-built near-miss layout + stop offset, longer strong ease-out animation; the outcome stays server-only CSPRNG.
5. LIVE drops strip of real recent wins (WOW block + feed), no PII, cached and polled.
6. Discretion item: rate-limit IP extraction fixed for Cloudflare -> Caddy -> API, plus a per-user limiter on account cases.

Purpose: implements every locked decision in 261103-sls-CONTEXT.md (single source of truth on the server, atomic conditional updates, a SpinCaseCooldown table with unique (UserId, CaseId), points idempotent per order, prize types unchanged, bootstrap + migration with existing data preserved) and Task Boundary items 1-5.
Output: 1 bootstrap file + 1 migration, 4 new tables, 9 new columns, 7 new/rewritten controllers, 3 services, 3 new admin pages, a storefront gallery/case page/points page/live strip.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@AGENTS.md
@.planning/quick/261103-sls-multi-cases-points-music-and-reel-near-m/261103-sls-CONTEXT.md
@.planning/quick/261103-qmv-lucky-spin-case-opening-and-floating-con/261103-qmv-SUMMARY.md  (v1 as built: bootstrap pattern, Program.cs editing caveats, migration drift note)
@.planning/quick/261103-sa8-customer-accounts-order-history-and-moxi/261103-sa8-PLAN.md  (contract for CustomerProfile, Order.CustomerId, CustomerAuthRules.Scheme/CustomerRole, MoxicCustomer cookie, accountApi.ts/useAccount.ts/useMe/ME_QUERY_KEY, RequireCustomer, MoxicLoader/PageLoader/SectionLoader)
@.planning/quick/261103-sa8-customer-accounts-order-history-and-moxi/261103-sa8-SUMMARY.md  (read if present: actual names sa8 shipped override the PLAN where they differ)

Backend sources (read each once, only what the task needs):
@API/Moxic.Api/Controllers/LuckySpinController.cs  (v1 Spin: atomic ExecuteUpdateAsync redemption inside BeginTransactionAsync, reward code loop, ToPublic, ResolveImagesAsync)
@API/Moxic.Api/Services/LuckySpinRules.cs  (PickWeighted over basis points with RandomNumberGenerator, RarityFor thresholds >25 common, >10 uncommon, >3 rare, >1 epic, else legendary; ResolveImageUrlAsync; GetClientIp currently trusts X-Real-IP)
@API/Moxic.Api/Controllers/AdminLuckySpinController.cs  (prizes/codes/history; ApplyPrizeAsync is the per-type switch — the extension point the later 261103-smv coupon task will grow, keep it)
@API/Moxic.Infrastructure/Data/LuckySpinSchemaBootstrap.cs  (raw-string DDL, no curly braces, ExecuteSqlRawAsync)
@API/Moxic.Infrastructure/Data/MoxicDbContext.cs  (Identity tables mapped to lowercase "aspnetusers" etc.; Spin* configs)
@API/Moxic.Api/Controllers/AdminOrdersController.cs  (UpdateOrderStatus: only Installing -> Completed reaches Completed; Completed is terminal)
@API/Moxic.Api/Controllers/AdminGamesController.cs + API/Moxic.Api/Models/Dtos.cs  (CreateGameDto/UpdateGameDto/AdminGameDetailResponse — Task 2)
@API/Moxic.Api/Controllers/AdminPaymentConfigController.cs  (IFormFile -> IMinioService.UploadImageAsync pattern — Task 2)
@API/Moxic.Api/Program.cs  (BOM + CRLF + garbled Vietnamese comments; startup try-block runs EnsureCreated -> GameReviews DDL -> LuckySpinSchemaBootstrap -> CustomerAccountSchemaBootstrap (sa8) -> role/user seed)

Storefront sources (Task 3): Moxic.Web/src/lib/luckySpinApi.ts, hooks/useLuckySpin.ts, components/lucky-spin/CaseReel.tsx + PrizeCard.tsx (RARITY_COLORS/RARITY_LABELS/RARITY_RANK exports), pages/LuckySpinPage.tsx, components/home/LuckySpinBanner.tsx, App.tsx, components/layout/Navbar.tsx (as modified by sa8), lib/accountApi.ts + hooks/useAccount.ts (sa8), pages/OrderHistoryPage.tsx (sa8 — styling reference for the points page), lib/utils.ts (formatDate, timeAgo).
Admin sources (Task 2): Moxic.Admin/src/lib/api.ts (apiFetch/apiUrl), pages/LuckySpin.tsx, LuckySpinPrizes.tsx, LuckySpinCodes.tsx, LuckySpinHistory.tsx, PaymentConfig.tsx (FormData upload), GameForm.tsx, App.tsx.

File-encoding hazards (use targeted Edit only, never rewrite these whole): Program.cs (BOM, CRLF), AdminOrdersController.cs (BOM, CRLF, garbled strings like "Kh?ng c? l? do" — leave them byte-identical), AdminGamesController.cs (BOM, CRLF), Models/Dtos.cs (BOM, mixed EOL), Game.cs (BOM, mixed), Order.cs (BOM), MoxicDbContext.cs (BOM, tab-indented Identity lines), Moxic.Admin/src/pages/GameForm.tsx (BOM, mixed), Moxic.Admin/src/App.tsx (BOM). New files: plain UTF-8, LF.

<interfaces>
JSON is camelCase; enums serialize as strings (global JsonStringEnumConverter). Errors are `{ error: string }` in Vietnamese unless noted.

ENUMS (Moxic.Shared/Enums, own files like SpinPrizeType.cs):
- SpinCaseOpenMethod { Code, FreeInterval, Points }  (stored as string, max 20)
- PointsReason { OrderCompleted, CaseOpen, AdminAdjust }  (stored as string, max 20)

ENTITIES (Moxic.Core/Entities):
- SpinCase: Id Guid; Name string (100, required); Slug string (80, required, unique); Description string? (1000); ImageObjectKey string? (500); OpenMethod SpinCaseOpenMethod; FreeIntervalHours int (C# initializer 24); PointsCost int; IsActive bool (= true); DisplayOrder int; CreatedAt; UpdatedAt; Prizes ICollection<SpinPrize>. No HasDefaultValue on these (avoids EF sentinel issues; the table is new).
- SpinPrize: + CaseId Guid (required), + Case SpinCase? navigation (WithMany(c => c.Prizes), cascade).
- SpinCode: + CaseId Guid (required), + Case SpinCase? navigation (WithMany(), cascade).
- SpinHistory: + CaseId Guid? (FK SetNull, no navigation), CaseName string? (100), OpenMethod SpinCaseOpenMethod? (string, 20), UserId string? (no FK, indexed), UserEmail string? (256, admin-only), PointsSpent int (HasDefaultValue(0)), Rarity string? (20, snapshot of RarityFor at open time). CodeText stays NOT NULL: store "" for non-code opens.
- SpinCaseCooldown: UserId string, CaseId Guid, LastOpenedAt DateTime; composite PK (UserId, CaseId); FK CaseId -> SpinCases cascade; FK UserId -> IdentityUser cascade (HasOne<IdentityUser>().WithMany()).
- PointsTransaction: Id Guid; UserId string (FK IdentityUser cascade); Delta int; Reason PointsReason; RefId string? (64); Note string? (200); BalanceAfter int; CreatedBy string? (256, admin email for AdminAdjust, never returned to customers); CreatedAt. Index (UserId, CreatedAt); UNIQUE index (Reason, RefId) — NULL RefIds stay distinct in PostgreSQL.
- SpinMusicTrack: Id Guid; Name string (100); ObjectKey string (500); ContentType string (50); SizeBytes long; IsActive bool; CreatedAt.
- Game: + RewardPoints int (HasDefaultValue(0)).
- Order: + PointsAwardedAt DateTime?.
- DbSets: SpinCases, SpinCaseCooldowns, PointsTransactions, SpinMusicTracks (table names = DbSet names).

BOOTSTRAP DDL (LuckySpinCasesSchemaBootstrap; expected shape — reconcile names/types with `dotnet ef migrations script` output; three separate ExecuteSqlRawAsync calls in this order; NO curly braces anywhere):

```sql
-- Part A (tables, columns, one-time data migration)
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

-- default case only when v1 orphans exist (fresh DBs and later deletions never recreate it)
INSERT INTO "SpinCases" ("Id","Name","Slug","Description","ImageObjectKey","OpenMethod","FreeIntervalHours","PointsCost","IsActive","DisplayOrder","CreatedAt","UpdatedAt")
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
    WHEN p."Probability" > 25 THEN 'common' WHEN p."Probability" > 10 THEN 'uncommon'
    WHEN p."Probability" > 3 THEN 'rare' WHEN p."Probability" > 1 THEN 'epic' ELSE 'legendary' END
  FROM "SpinPrizes" AS p WHERE h."PrizeId" = p."Id" AND h."Rarity" IS NULL;
ALTER TABLE "SpinPrizes" ALTER COLUMN "CaseId" SET NOT NULL;
ALTER TABLE "SpinCodes" ALTER COLUMN "CaseId" SET NOT NULL;

-- Part B (single DO statement; PostgreSQL has no ADD CONSTRAINT IF NOT EXISTS)
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

-- Part C (indexes + new tables)
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
    CONSTRAINT "FK_SpinCaseCooldowns_aspnetusers_UserId" FOREIGN KEY ("UserId") REFERENCES "aspnetusers" ("Id") ON DELETE CASCADE
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
    CONSTRAINT "FK_PointsTransactions_aspnetusers_UserId" FOREIGN KEY ("UserId") REFERENCES "aspnetusers" ("Id") ON DELETE CASCADE
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
```

PUBLIC API (/api/lucky-spin; optional customer = HttpContext.AuthenticateAsync(CustomerAuthRules.Scheme) succeeded AND principal.IsInRole(CustomerAuthRules.CustomerRole)):
- GET /cases?page=1&pageSize=24&method=Code|FreeInterval|Points&q= -> `{ items: CaseSummary[], total, page, pageSize, loggedIn, serverNow }` (active cases only, order DisplayOrder then Name, pageSize clamp 1..48, unknown method ignored, q trimmed max 100 matched case-insensitively against Name)
- GET /cases/{slug} -> `{ case: CaseSummary, prizes: PublicPrize[], viewer: CaseViewer, serverNow }`; 404 "Không tìm thấy hòm." when missing or inactive
- POST /cases/{slug}/open body `{ code?: string }` [EnableRateLimiting("lucky-spin")] -> 200 OpenCaseResult. Errors: 404 case; 503 "Hòm đang được cấu hình, vui lòng quay lại sau."; 400 code errors ("Vui lòng nhập mã quay." / "Mã quay không hợp lệ." / "Mã quay không thuộc hòm này." / "Mã quay đã bị vô hiệu hóa." / "Mã quay đã hết hạn." / "Mã quay đã hết lượt sử dụng."); 401 `{ error: "Vui lòng đăng nhập để mở hòm này.", code: "LOGIN_REQUIRED" }`; 403 `{ error: "Vui lòng xác minh email trước khi mở hòm.", code: "EMAIL_NOT_VERIFIED" }`; 409 `{ error: "Bạn đã dùng lượt miễn phí. Lượt tiếp theo sẽ mở sau ít phút nữa — xem đồng hồ đếm ngược.", code: "COOLDOWN", nextFreeOpenAt }`; 409 `{ error: "Bạn không đủ điểm để mở hòm này (cần {cost} điểm).", code: "INSUFFICIENT_POINTS", pointsBalance, pointsCost }`; 429 (IP policy or per-user limiter: "Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.")
- GET /code-lookup?code= [EnableRateLimiting("lucky-spin")] -> 200 `{ slug }` when the code is active, unexpired, has uses left and its case is active with OpenMethod Code; else 404 "Mã quay không hợp lệ hoặc đã hết lượt."
- GET /music -> `MusicTrack[]` = `{ id, name, url }` for active tracks (presign failures skipped)
- GET /live-drops -> `{ wow: LiveDrop[] (<= 3), feed: LiveDrop[] (<= 20), serverNow }`
- REMOVED: GET /prizes and POST /spin (storefront switches in Task 3)

Shapes:
- PublicPrize `{ id, name, type: "Luck"|"Discount"|"Game", rarity, gameId, imageUrl }` (unchanged; never a probability)
- CaseSummary `{ id, slug, name, description: string|null, imageUrl: string|null, openMethod, freeIntervalHours, pointsCost, available: boolean (active prizes total exactly 100%), prizeCount, previewPrizes: PublicPrize[] (<= 5, rarest first), nextFreeOpenAt: string|null (FreeInterval + logged-in customer with an active cooldown only) }`
- CaseViewer `{ loggedIn, emailVerified, points: number|null, nextFreeOpenAt: string|null, canOpen }` — canOpen: Code -> available; FreeInterval -> available && loggedIn && emailVerified && nextFreeOpenAt == null; Points -> available && loggedIn && emailVerified && points >= pointsCost
- OpenCaseResult `{ spinId, caseSlug, prize: PublicPrize, rewardCode: string|null, remainingUses: number|null (Code only), pointsSpent, pointsBalance: number|null (Points only, balance after), nextFreeOpenAt: string|null (FreeInterval only), winningIndex, stopOffset, reel: PublicPrize[] }` — stopOffset is a fraction of one card width from the winning card's center to the point that must end under the marker, range [-0.45, 0.45], positive = toward winningIndex + 1
- LiveDrop `{ id, prizeName, prizeType: "Discount"|"Game", rarity, imageUrl: string|null, caseName, caseSlug: string|null, winnerName, createdAt }` — NO email, IP, userId or rewardCode

ACCOUNT API (customer scheme + Customer role, same attribute as sa8 AccountOrdersController):
- GET /api/account/points?page=1&pageSize=20 -> `{ balance, items: { id, delta, reason, note, balanceAfter, createdAt }[], total, page, pageSize }` (pageSize clamp 1..50; no refId/createdBy)

ADMIN API ([Authorize(Roles = "Admin")], default Identity scheme):
- /api/admin/lucky-spin (AdminLuckySpinController, Task 1): GET cases/{caseId}/prizes; POST cases/{caseId}/prizes (PrizeUpsertRequest unchanged); PUT/DELETE prizes/{id} (unchanged); GET game-options (unchanged); GET cases/{caseId}/codes?search&page&pageSize -> `{ items, totalCount, page, pageSize }`; POST cases/{caseId}/codes/generate (400 "Hòm này không mở bằng mã quay." unless OpenMethod Code); PATCH/DELETE codes/{id} (unchanged); GET history?caseId&search&claimed&page&pageSize — items gain `caseId, caseName, openMethod, pointsSpent, userEmail, rarity`; PATCH history/{id}/claim (unchanged). Unknown caseId -> 404 "Không tìm thấy hòm."
- /api/admin/lucky-spin/cases (AdminSpinCasesController, Task 2): GET -> AdminCase[]; POST CaseUpsertRequest -> 201 AdminCase; PUT {id} -> AdminCase; DELETE {id} -> 204; POST {id}/image (multipart "file") -> AdminCase; DELETE {id}/image -> AdminCase
  - CaseUpsertRequest `{ name, slug?, description?, openMethod, freeIntervalHours?, pointsCost?, isActive, displayOrder }`
  - AdminCase `{ id, name, slug, description, imageUrl, openMethod, freeIntervalHours, pointsCost, isActive, displayOrder, prizeCount, activePrizeCount, activeTotalPercent, isPoolValid, codeCount, createdAt, updatedAt }`
- /api/admin/customers (Task 2): GET ?search&sort=newest|points&page=1&pageSize=20 -> `{ items: { userId, email, displayName, emailVerified, points, createdAt: string|null }[], totalCount, page, pageSize }`; GET {userId}/points?page&pageSize -> `{ balance, items: AdminPointsTx[], totalCount, page, pageSize }`; POST {userId}/points `{ delta, note }` -> `{ balance, transaction: AdminPointsTx }`; AdminPointsTx `{ id, delta, reason, refId, note, balanceAfter, createdBy, createdAt }`
- /api/admin/spin-music (Task 2): GET -> `{ id, name, url, contentType, sizeBytes, isActive, createdAt }[]`; POST multipart (file, name?) -> 201; PATCH {id} `{ name?, isActive? }` -> 200; DELETE {id} -> 204
- /api/admin/games (Task 2): CreateGameDto, UpdateGameDto and AdminGameDetailResponse gain `rewardPoints` (int 0..1_000_000)
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Backend core — cases data model + bootstrap migration, points ledger/service + order award, case open flow (code / free-interval / points), near-miss reel, live drops + music feed, IP fix</name>
  <files>API/Moxic.Shared/Enums/SpinCaseOpenMethod.cs, API/Moxic.Shared/Enums/PointsReason.cs, API/Moxic.Core/Entities/SpinCase.cs, API/Moxic.Core/Entities/SpinCaseCooldown.cs, API/Moxic.Core/Entities/PointsTransaction.cs, API/Moxic.Core/Entities/SpinMusicTrack.cs, API/Moxic.Core/Entities/SpinPrize.cs, API/Moxic.Core/Entities/SpinCode.cs, API/Moxic.Core/Entities/SpinHistory.cs, API/Moxic.Core/Entities/Game.cs, API/Moxic.Core/Entities/Order.cs, API/Moxic.Infrastructure/Data/MoxicDbContext.cs, API/Moxic.Infrastructure/Data/LuckySpinCasesSchemaBootstrap.cs, API/Moxic.Infrastructure/Data/Migrations/*_AddSpinCasesPointsMusic.cs (+ .Designer.cs), API/Moxic.Infrastructure/Data/Migrations/MoxicDbContextModelSnapshot.cs, API/Moxic.Api/Services/LuckySpinRules.cs, API/Moxic.Api/Services/PointsService.cs, API/Moxic.Api/Services/SpinUserRateLimiter.cs, API/Moxic.Api/Models/LuckySpinDtos.cs, API/Moxic.Api/Controllers/LuckySpinController.cs, API/Moxic.Api/Controllers/LuckySpinFeedController.cs, API/Moxic.Api/Controllers/AccountPointsController.cs, API/Moxic.Api/Controllers/AdminLuckySpinController.cs, API/Moxic.Api/Controllers/AdminOrdersController.cs, API/Moxic.Api/Program.cs</files>
  <action>
PRECONDITION (stop if it fails): `git log --oneline -20` must contain the three `feat(quick-261103-sa8)` commits, and API/Moxic.Api/Services/CustomerAuthRules.cs, API/Moxic.Core/Entities/CustomerProfile.cs, Moxic.Web/src/hooks/useAccount.ts and Moxic.Web/src/components/account/RequireCustomer.tsx must exist with `git status --short` showing nothing but `.planning/` entries. If not, STOP and report "blocked: 261103-sa8 not committed". If 261103-sa8-SUMMARY.md exists, read it and prefer its real identifiers. Then record baseline builds (dotnet build API/Moxic.slnx, npm run build in Moxic.Web and Moxic.Admin) for the SUMMARY. Do not read appsettings*.json or .env files.

Data model (per locked decisions; shapes in <interfaces>): create the two enums, SpinCase, SpinCaseCooldown, PointsTransaction, SpinMusicTrack; extend SpinPrize, SpinCode, SpinHistory, Game, Order. MoxicDbContext: add the four DbSets and configs exactly as listed in <interfaces> (HasConversion<string>().HasMaxLength(20) for both enums, composite key for SpinCaseCooldown, HasOne<IdentityUser>().WithMany().HasForeignKey(e => e.UserId).OnDelete(Cascade) for cooldowns and points, unique (Reason, RefId) and (UserId, CreatedAt) indexes, SpinHistory CaseId FK SetNull + UserId index, Game.RewardPoints and SpinHistory.PointsSpent HasDefaultValue(0)). Do not touch the lowercase aspnet* ToTable lines. Do not add any Discount-specific columns — the later 261103-smv coupon task extends prizes; keep SpinPrizeType unchanged (locked: prize types unchanged).

Migration + bootstrap (locked decision: idempotent bootstrap + EF migration, existing data migrated without loss): run `dotnet ef migrations add AddSpinCasesPointsMusic --project API/Moxic.Infrastructure --startup-project API/Moxic.Api` and keep EF output as generated (report any drift; note in SUMMARY that this migration is not safe to apply to a populated DB as-is because CaseId is added NOT NULL — the bootstrap is the runtime path). Run `dotnet ef migrations script AddCustomerAccounts AddSpinCasesPointsMusic --project API/Moxic.Infrastructure --startup-project API/Moxic.Api` (use sa8's real migration name) and reconcile table/FK/index names and column types with the expected DDL in <interfaces>. Create LuckySpinCasesSchemaBootstrap (same shape as LuckySpinSchemaBootstrap: three raw-string consts PartA/PartB/PartC executed by static EnsureAsync(MoxicDbContext) as three separate ExecuteSqlRawAsync calls in order; Part B is the single DO $EF$ block). Keep the Vietnamese literals UTF-8. No curly braces in any SQL.

LuckySpinRules (keep PickWeighted, codes, RarityFor, ResolveImageUrlAsync; never System.Random anywhere):
- ReelLength = 60, WinningIndex = 52.
- RarityRank(string rarity): legendary 0, epic 1, rare 2, uncommon 3, common 4 (same as storefront RARITY_RANK).
- CosmeticWeight(rarity): common 10, uncommon 12, rare 15, epic 18, legendary 20 (roughly uniform, biased toward rarer — per CONTEXT item 4; real odds are NOT used for filler).
- Shuffle<T>(IList<T>) Fisher-Yates using RandomNumberGenerator.GetInt32.
- public sealed record ReelLayout(SpinPrize[] Cards, int WinningIndex, double StopOffset, bool NearMiss) and BuildReel(IReadOnlyList<SpinPrize> activePrizes, SpinPrize winner) returning it: (1) coverage pass: shuffle a copy of the prizes and a list of slot indices 4..WinningIndex-3, place each distinct prize once into those slots (as many as fit); (2) fill every other empty slot except WinningIndex via PickWeighted over CosmeticWeight, re-rolling up to 3 times when the pick would make three identical cards in a row; (3) Cards[WinningIndex] = winner; (4) near-miss: teasers = prizes with Type != Luck, Id != winner.Id, RarityRank <= 2 and RarityRank < the winner's rank; eligible when (winner.Type == Luck OR winner rank >= 3) AND teasers is non-empty. If eligible: pick teaser A uniformly among the teasers with the best (lowest) rank, side = GetInt32(0, 2) == 0 ? -1 : +1, Cards[WinningIndex + side] = A, Cards[WinningIndex - side] = a uniformly random teaser, StopOffset = side * GetInt32(300, 451) / 1000.0 (lands 5-20% from the edge next to A), NearMiss = true. Else StopOffset = GetInt32(-350, 351) / 1000.0, NearMiss = false.
- MaskDisplayName(string? name): null/blank -> "Khách"; split into text elements with System.Globalization.StringInfo (keeps Vietnamese diacritics intact); length >= 4 -> first 2 + "***" + last 1 ("trung" -> "tr***g"); 2..3 -> first 1 + "***"; 1 -> that char + "***".
- GetClientIp (discretion item, prod chain Cloudflare -> Caddy -> API): CF-Connecting-IP if it parses with IPAddress.TryParse, else the first comma-separated hop of X-Forwarded-For if it parses, else Connection.RemoteIpAddress (MapToIPv4 when IsIPv4MappedToIPv6); return the parsed address's ToString(), "unknown" fallback, max 64 chars. Stop reading X-Real-IP entirely (Caddy does not set it, so it is client-controlled); update the doc comment to say so. sa8's customer-auth limiter reuses this, so it benefits too.
- Constants: LiveDropDelaySeconds = 10, LiveDropsCacheSeconds = 5, LiveFeedSize = 20, LiveWowSize = 3, OpenPerUserPerMinute = 8.

SpinUserRateLimiter (singleton, IDisposable): wraps PartitionedRateLimiter.Create<string, string> with a fixed window limiter per key (PermitLimit LuckySpinRules.OpenPerUserPerMinute, Window 1 minute, QueueLimit 0); method TryAcquire(string userId) disposes the lease and returns IsAcquired. (The rate-limit policy cannot see the non-default customer scheme synchronously, hence an in-controller per-user check.)

PointsService (scoped; deps MoxicDbContext, UserManager<IdentityUser>, ILogger). It never begins a transaction — callers own it — and each method calls SaveChangesAsync itself:
- AwardForCompletedOrderAsync(Order order) -> int awarded: resolve the customer — order.CustomerId when it is set and that user exists, EmailConfirmed and IsInRoleAsync(Customer); otherwise FindByEmailAsync(order.CustomerXboxEmail.Trim()) with the same checks; none -> 0. points = sum of Games.RewardPoints for the order's Details GameIds (query the DB; RewardPoints read at completion time — document); points <= 0 -> 0 (no ledger row). Claim: `_db.Orders.Where(o => o.Id == order.Id && o.PointsAwardedAt == null).ExecuteUpdateAsync(set PointsAwardedAt = now)` — 0 rows -> 0. Ensure a CustomerProfile exists (insert with DisplayName = email part before '@' when missing), ExecuteUpdateAsync Points += points and UpdatedAt, re-read Points (our UPDATE holds the row lock until commit, so the read is our value), add PointsTransaction { Reason OrderCompleted, RefId order.Id.ToString(), Note order.OrderCode, Delta points, BalanceAfter }, save, return points. The unique (Reason, RefId) index is the second guard.
- TrySpendAsync(string userId, int cost, string refId, string note) -> (bool Ok, int Balance): `CustomerProfiles.Where(p => p.UserId == userId && p.Points >= cost).ExecuteUpdateAsync(Points - cost, UpdatedAt)` (the locked conditional update); 0 rows -> (false, current balance or 0); else re-read balance, add ledger { CaseOpen, RefId = spin id, Note = case name, Delta = -cost }, save, (true, balance).
- AdjustAsync(string userId, int delta, string note, string? actor) -> (bool Ok, int Balance, PointsTransaction? Tx): ensure profile, conditional `p.Points + delta >= 0`, ledger { AdminAdjust, RefId null, Note, CreatedBy actor }, save.

DTOs: new API/Moxic.Api/Models/LuckySpinDtos.cs (namespace Moxic.Api.Models) with records for every public/account shape in <interfaces> (PublicPrizeDto moves here from LuckySpinController.cs; OpenCaseRequest(string? Code); PublicCaseSummaryDto, PublicCasesResponse, CaseViewerDto, PublicCaseDetailDto, OpenCaseResultDto, PublicMusicTrackDto, LiveDropDto, LiveDropsResponse, CustomerPointsTxDto, CustomerPointsResponse). Remove SpinRequest.

LuckySpinController (rewrite; [Route("api/lucky-spin")]; deps MoxicDbContext, IMinioService, UserManager<IdentityUser>, PointsService, SpinUserRateLimiter):
- Private helpers: GetCustomerAsync() -> (string UserId, IdentityUser User)? via AuthenticateAsync(CustomerAuthRules.Scheme) + IsInRole + FindByIdAsync; LoadActivePrizesAsync(Guid caseId) (Include Game.Media, DisplayOrder then Name); ResolveImagesAsync; ToPublic (unchanged mapping); BuildSummary(case, prizesOfCase, images, nextFreeOpenAt) with previewPrizes = up to 5 active prizes sorted by RarityRank then DisplayOrder; NextFreeOpenAtAsync(userId, case) = LastOpenedAt + FreeIntervalHours when that is in the future, else null; case image via IMinioService.GetPresignedUrlAsync(config "Minio:GamesBucket", ImageObjectKey) in try/catch (inject IConfiguration too).
- GET cases: page the active cases, then load the page's active prizes in ONE query (CaseId in pageIds, Include Game.Media) and group in memory (no N+1); when the caller is a customer, load their cooldown rows for those case ids in one query.
- GET cases/{slug}: detail per <interfaces>; the customer's points come from CustomerProfiles (0 when missing).
- POST cases/{slug}/open — order matters: (1) load the active case by slug -> 404; (2) prizes = LoadActivePrizesAsync; !IsPoolValid -> 503 (before consuming anything); (3) customer = GetCustomerAsync(); for FreeInterval/Points: null -> 401 LOGIN_REQUIRED, !EmailConfirmed -> 403 EMAIL_NOT_VERIFIED, !limiter.TryAcquire(userId) -> 429; for Points also PointsCost < 1 -> 503; for Code: NormalizeCode(request.Code) null -> 400 ("Vui lòng nhập mã quay." when blank); (4) spinId = Guid.NewGuid(), now = UtcNow, BeginTransactionAsync; (5) consume atomically: Code -> the v1 conditional ExecuteUpdateAsync plus `c.CaseId == case.Id`; on 0 rows roll back and diagnose (missing -> "Mã quay không hợp lệ.", other case -> "Mã quay không thuộc hòm này.", then disabled/expired/used-up as v1). FreeInterval -> `_db.Database.ExecuteSqlAsync($"...")` (interpolated, parameterized) running INSERT INTO "SpinCaseCooldowns" ("UserId","CaseId","LastOpenedAt") VALUES (userId, caseId, now) ON CONFLICT ("UserId","CaseId") DO UPDATE SET "LastOpenedAt" = EXCLUDED."LastOpenedAt" WHERE "SpinCaseCooldowns"."LastOpenedAt" <= threshold (threshold = now - FreeIntervalHours); 0 rows -> roll back, read LastOpenedAt, 409 COOLDOWN with nextFreeOpenAt. Points -> PointsService.TrySpendAsync(userId, cost, spinId.ToString(), case.Name); !Ok -> roll back, 409 INSUFFICIENT_POINTS; (6) winner = PickPrize(prizes) — the only outcome decision; (7) reward code loop as v1 for non-Luck; (8) insert SpinHistory { Id spinId, CaseId, CaseName, OpenMethod, SpinCodeId + CodeText (Code) or CodeText "", prize snapshot, Rarity = RarityFor(winner.Probability), UserId/UserEmail when a customer is present (any method), PointsSpent, ClientIp = GetClientIp }; SaveChanges; Commit; (9) layout = BuildReel(prizes, winner); respond OpenCaseResult (remainingUses for Code from a post-update read like v1; pointsBalance for Points; nextFreeOpenAt = now + hours for FreeInterval).
- GET code-lookup per <interfaces>.

LuckySpinFeedController ([Route("api/lucky-spin")]; deps MoxicDbContext, IMinioService, IConfiguration, IMemoryCache):
- GET live-drops: IMemoryCache.GetOrCreateAsync("lucky-spin:live-drops", AbsoluteExpirationRelativeToNow = 5 s). cutoff = now - 10 s. Base query AsNoTracking: PrizeType != Luck && CreatedAt <= cutoff. feed = OrderByDescending(CreatedAt).Take(20); wow = same filter + Rarity == "epic" || Rarity == "legendary", Take(3). Project only Id, PrizeName, PrizeType, Rarity, GameId, CaseId, CaseName, UserId, CreatedAt (never UserEmail, ClientIp, RewardCode). Then in single queries: CustomerProfiles display names for the user ids, SpinCases (Id, Slug, IsActive) for the case ids (caseSlug null when missing/inactive), and the first GameMedia per game (IsPrimary desc, DisplayOrder) presigned in try/catch. winnerName = MaskDisplayName(profile display name) or "Khách" when UserId is null or there is no profile; rarity null -> "common".
- GET music: active SpinMusicTracks ordered by CreatedAt, presigned with config "Minio:GamesBucket" + "Minio:PresignedUrlExpiryHours", skip tracks whose presign throws.

AccountPointsController ([Route("api/account/points")], same [Authorize(AuthenticationSchemes = CustomerAuthRules.Scheme, Roles = CustomerAuthRules.CustomerRole)] as sa8's AccountOrdersController): GET returns the caller's balance + paged ledger per <interfaces> (projection without RefId/CreatedBy).

AdminLuckySpinController (keep existing records and the ApplyPrizeAsync per-type switch): prizes list/create move under cases/{caseId:guid}/prizes (404 when the case is missing; CreatePrize sets CaseId); ApplyPrizeAsync's other-active-total query adds `p.CaseId == prize.CaseId` (each case validates its own 100%); codes list/generate move under cases/{caseId:guid}/codes (generate sets CaseId, 400 when the case is not Code); history gains a caseId filter, search also matches UserEmail case-insensitively, and ToAdminSpin adds CaseId, CaseName, OpenMethod, PointsSpent, UserEmail, Rarity.

AdminOrdersController (targeted edits; preserve BOM/CRLF and every garbled string byte-for-byte): inject PointsService; wrap the existing SaveChangesAsync in `await using var tx = await _db.Database.BeginTransactionAsync()`; after saving, when newStatus == Completed call AwardForCompletedOrderAsync(order) and LogInformation the awarded amount; then CommitAsync before enqueueing emails (atomic: status + points together, per locked "exactly once per order").

Program.cs (targeted insertions only): builder.Services.AddMemoryCache(); AddScoped<PointsService>(); AddSingleton<SpinUserRateLimiter>(); in the startup block `await LuckySpinCasesSchemaBootstrap.EnsureAsync(dbContext);` right after CustomerAccountSchemaBootstrap.EnsureAsync.

Optional runtime smoke (only if PostgreSQL already listens on localhost:5432; never start containers): run the API, confirm no bootstrap error in the log, GET /api/lucky-spin/cases (legacy pool shows as "Hòm mã quay" when v1 data exists), GET /api/lucky-spin/live-drops 200 without email/ip/rewardCode keys, restart once to prove the bootstrap is idempotent. Otherwise record "skipped: DB not reachable".

Commit `feat(quick-261103-sls): spin cases, points ledger, near-miss reel, live drops backend` with explicit paths only.
  </action>
  <verify>
    <automated>cd /c/Users/trung/OneDrive/Documents/project-moxic && dotnet build API/Moxic.slnx -nologo -v q && ls API/Moxic.Infrastructure/Data/Migrations/*_AddSpinCasesPointsMusic.cs && B=API/Moxic.Infrastructure/Data/LuckySpinCasesSchemaBootstrap.cs && grep -q 'CREATE TABLE IF NOT EXISTS "SpinCases"' $B && grep -q 'ALTER TABLE "SpinPrizes" ADD COLUMN IF NOT EXISTS "CaseId"' $B && grep -q 'hom-ma-quay' $B && grep -q 'CREATE TABLE IF NOT EXISTS "SpinCaseCooldowns"' $B && grep -q 'CREATE TABLE IF NOT EXISTS "PointsTransactions"' $B && grep -q 'ADD COLUMN IF NOT EXISTS "RewardPoints"' $B && grep -q 'LuckySpinCasesSchemaBootstrap.EnsureAsync' API/Moxic.Api/Program.cs && grep -q 'AwardForCompletedOrderAsync' API/Moxic.Api/Controllers/AdminOrdersController.cs && grep -q 'PointsAwardedAt == null' API/Moxic.Api/Services/PointsService.cs && grep -q 'Points >= ' API/Moxic.Api/Services/PointsService.cs && grep -q 'ON CONFLICT' API/Moxic.Api/Controllers/LuckySpinController.cs && grep -q 'TrySpendAsync' API/Moxic.Api/Controllers/LuckySpinController.cs && grep -q 'CF-Connecting-IP' API/Moxic.Api/Services/LuckySpinRules.cs && grep -q 'StopOffset' API/Moxic.Api/Services/LuckySpinRules.cs && grep -q 'IMemoryCache' API/Moxic.Api/Controllers/LuckySpinFeedController.cs && grep -v '^\s*//' API/Moxic.Api/Services/LuckySpinRules.cs | grep -c 'X-Real-IP' | grep -qx 0 && grep -v '^\s*//' API/Moxic.Api/Services/LuckySpinRules.cs API/Moxic.Api/Controllers/LuckySpinController.cs | grep -c 'new Random\|Random\.Shared' | grep -qx 0 && sed -n '/record LiveDropDto/,/);/p' API/Moxic.Api/Models/LuckySpinDtos.cs | grep -c 'Email\|ClientIp\|RewardCode\|UserId' | grep -qx 0 && sed -n '/record PublicPrizeDto/,/);/p' API/Moxic.Api/Models/LuckySpinDtos.cs | grep -c 'Probability' | grep -qx 0 && head -c3 API/Moxic.Api/Program.cs | od -An -tx1 | grep -q 'ef bb bf' && head -c3 API/Moxic.Api/Controllers/AdminOrdersController.cs | od -An -tx1 | grep -q 'ef bb bf' && echo OK</automated>
  </verify>
  <done>dotnet build passes with no new warnings beyond the baseline NU190x; migration AddSpinCasesPointsMusic + snapshot exist; bootstrap DDL is idempotent, migrates v1 prizes/codes/history into the default Code case and matches the script output; open flow consumes code/cooldown/points atomically before the CSPRNG draw; order completion credits points once; live-drops and music endpoints work without PII; GetClientIp no longer trusts X-Real-IP; BOMs intact; committed with explicit paths only.</done>
</task>

<task type="auto">
  <name>Task 2: Admin vertical — case CRUD + images, customers & points adjust, music library (API + SPA), per-case prizes/codes/history, GameForm RewardPoints</name>
  <files>API/Moxic.Api/Services/MediaSniffer.cs, API/Moxic.Api/Models/AdminSpinDtos.cs, API/Moxic.Api/Controllers/AdminSpinCasesController.cs, API/Moxic.Api/Controllers/AdminCustomersController.cs, API/Moxic.Api/Controllers/AdminSpinMusicController.cs, API/Moxic.Api/Controllers/AdminGamesController.cs, API/Moxic.Api/Models/Dtos.cs, Moxic.Admin/src/lib/luckySpinAdmin.ts, Moxic.Admin/src/pages/LuckySpin.tsx, Moxic.Admin/src/pages/LuckySpinCases.tsx, Moxic.Admin/src/pages/LuckySpinPrizes.tsx, Moxic.Admin/src/pages/LuckySpinCodes.tsx, Moxic.Admin/src/pages/LuckySpinHistory.tsx, Moxic.Admin/src/pages/Customers.tsx, Moxic.Admin/src/pages/SpinMusic.tsx, Moxic.Admin/src/pages/GameForm.tsx, Moxic.Admin/src/App.tsx</files>
  <action>
Backend (all controllers [ApiController] + [Authorize(Roles = "Admin")]; records in new API/Moxic.Api/Models/AdminSpinDtos.cs; shapes per <interfaces>):
- MediaSniffer (static): IsImage(Stream, ext) — JPEG FF D8 FF, PNG 89 50 4E 47, WEBP "RIFF" + "WEBP" at offset 8; IsAudio(Stream, ext) — mp3 "ID3" or frame sync (b0 == 0xFF && (b1 & 0xE0) == 0xE0), ogg "OggS", m4a "ftyp" at offset 4; reads the first 12 bytes of a separately opened stream. ContentTypeFor(ext): .jpg/.jpeg image/jpeg, .png image/png, .webp image/webp, .mp3 audio/mpeg, .ogg audio/ogg, .m4a audio/mp4. Uploads always use this server-chosen type, never file.ContentType.
- AdminSpinCasesController [Route("api/admin/lucky-spin/cases")] (deps MoxicDbContext, IMinioService, IConfiguration): GET lists all cases ordered DisplayOrder then Name with counts computed from one prizes query (CaseId, IsActive, Probability) and one codes GroupBy(CaseId) — isPoolValid uses LuckySpinRules.ToBasisPoints/TotalBasisPoints. POST/PUT validate: name trimmed 2..100 ("Tên hòm phải từ 2 đến 100 ký tự."); slug normalized (lowercase; Vietnamese diacritics removed via Normalize(FormD) + strip NonSpacingMark, đ -> d; non [a-z0-9] runs -> '-'; trimmed of '-'), generated from name when blank, 2..80 ("Slug không hợp lệ."), unique -> 409 "Slug này đã được dùng cho hòm khác."; description max 1000; Enum.IsDefined(openMethod); FreeInterval hours = freeIntervalHours ?? 24 within 1..720 ("Chu kỳ miễn phí phải từ 1 đến 720 giờ."); Points cost within 1..1_000_000 ("Số điểm mở hòm phải từ 1 đến 1.000.000."); other methods keep 24 / 0 defaults. DELETE removes the case (prizes, codes and cooldowns cascade; history keeps its CaseName snapshot) and best-effort deletes the image object. POST {id}/image: IFormFile, ext .jpg/.jpeg/.png/.webp, <= 5 MB, MediaSniffer.IsImage, key spin-cases/{id}/{Guid}{ext} in config "Minio:GamesBucket", UploadImageAsync, then best-effort delete the previous object; DELETE {id}/image clears it.
- AdminCustomersController [Route("api/admin/customers")] (deps MoxicDbContext, UserManager<IdentityUser>, PointsService): GET joins Users with UserRoles for the "Customer" role id (CustomerAuthRules.CustomerRole; empty list when the role is missing) and left-joins CustomerProfiles; search (trim, lowercase, max 100) on email or display name; sort "points" -> Points desc, default newest -> profile CreatedAt desc; page >= 1, pageSize clamp 1..100. GET {userId}/points: 404 "Không tìm thấy khách hàng." unless a Customer; paged ledger newest first + balance. POST {userId}/points `{ delta, note }`: delta != 0 and |delta| <= 1_000_000 ("Số điểm điều chỉnh phải khác 0 và không vượt quá 1.000.000."); note trimmed 2..200 ("Vui lòng nhập lý do điều chỉnh (2–200 ký tự)."); inside BeginTransactionAsync call PointsService.AdjustAsync(userId, delta, note, User.Identity?.Name); !Ok -> 409 "Số dư không đủ để trừ (hiện có {balance} điểm)."; commit; 200 { balance, transaction }.
- AdminSpinMusicController [Route("api/admin/spin-music")] (deps MoxicDbContext, IMinioService, IConfiguration): GET all tracks newest first with presigned url (try/catch -> empty string); POST [RequestSizeLimit(12_000_000)] [RequestFormLimits(MultipartBodyLengthLimit = 12_000_000)] with IFormFile file + [FromForm] string? name: ext .mp3/.ogg/.m4a, size 1..10 MB ("File nhạc tối đa 10MB."), MediaSniffer.IsAudio ("File không phải định dạng âm thanh hợp lệ."), name defaults to the file name without extension, trimmed to 100; key spin-music/{Guid}{ext}; 201. PATCH {id} `{ name?, isActive? }` (name 1..100). DELETE removes the row then best-effort deletes the object.
- AdminGamesController + Models/Dtos.cs (targeted edits, keep BOM/EOL): add `public int RewardPoints { get; init; }` to CreateGameDto, UpdateGameDto and AdminGameDetailResponse; create/update copy it after validating 0..1_000_000 (400 "Điểm thưởng phải từ 0 đến 1.000.000."); GetGame returns it.

Admin SPA (Vietnamese labels for new UI; reuse steam-* classes, steam-input, existing modal/table patterns from LuckySpinPrizes/LuckySpinCodes; apiFetch/apiUrl everywhere; tsconfig noUnusedLocals + verbatimModuleSyntax -> import type):
- lib/luckySpinAdmin.ts: types OpenMethod, AdminCase; OPEN_METHOD_LABELS (Code "Nhập mã", FreeInterval "Miễn phí theo chu kỳ", Points "Dùng điểm"); describeOpenMethod(c) -> "Nhập mã" | "Miễn phí mỗi {h}h" | "{n vi-VN} điểm"; fetchAdminCases(); readApiError(res, fallback).
- LuckySpin.tsx: loads cases; tabs "Hòm" | "Giải thưởng" | "Mã quay" | "Lịch sử quay" (?tab=); selected case kept in ?case= (default first case). Prizes/codes tabs show a case selector (select with "name · method" and a green "100%" / amber "x%" validity chip); with no cases they show a prompt linking to the Hòm tab. Children are keyed by caseId: LuckySpinPrizes caseId + onChanged={reloadCases}; LuckySpinCodes caseId + openMethod; LuckySpinHistory cases; LuckySpinCases cases + reload + onManagePrizes(id) (sets ?case and switches to prizes).
- LuckySpinCases.tsx: list (card rows on mobile, table on md+) with image thumb, name, slug, method description, active badge, prize count + total % (green/amber), code count, quick active toggle (PUT with the full body), edit, delete (confirm "Xóa hòm sẽ xóa toàn bộ giải thưởng và mã quay của hòm. Lịch sử quay vẫn được giữ lại."). Create/edit modal: name, slug (auto-suggested from name with the same slug rules until the admin edits it), description, open-method radio cards, hours input (FreeInterval) / points input (Points), display order, active; image upload/remove in edit mode only (accept .jpg,.jpeg,.png,.webp; 5MB client check) with preview. Server errors shown inline.
- LuckySpinPrizes.tsx: prop caseId (+ optional onChanged); list/create use /api/admin/lucky-spin/cases/{caseId}/prizes; PUT/DELETE unchanged; call onChanged after save/delete/toggle; the total bar is per case. Keep the Discount branch generic (future coupon task).
- LuckySpinCodes.tsx: props caseId, openMethod; list/generate use /api/admin/lucky-spin/cases/{caseId}/codes(...); when openMethod !== "Code" show an amber notice "Hòm này không mở bằng mã quay — không cần tạo mã." and hide the generate form.
- LuckySpinHistory.tsx: prop cases; case filter select ("Tất cả hòm" + cases) -> caseId query param; new columns "Hòm" (caseName + method chip), "Mở bằng" (code text / "Miễn phí" / "-{n} điểm"), "Khách" (userEmail or "Khách"); keep claim logic.
- Customers.tsx (route /customers): search (debounced 300 ms), sort select (Mới nhất / Nhiều điểm nhất), table/cards: email, display name, verified badge ("Đã xác minh"/"Chưa xác minh"), points (gold, vi-VN), joined date; actions "Điều chỉnh điểm" (modal: +/- toggle or signed number, amount, required note with hint "Ghi chú sẽ hiển thị trong lịch sử điểm của khách hàng.", shows the resulting balance) and "Lịch sử điểm" (modal with paged ledger: date, reason label OrderCompleted "Hoàn tất đơn hàng" / CaseOpen "Mở hòm" / AdminAdjust "Điều chỉnh thủ công", note, delta colored, balance after, createdBy). Pagination prev/next.
- SpinMusic.tsx (route /spin-music, title "Kho nhạc"): upload form (file accept ".mp3,.ogg,.m4a,audio/mpeg,audio/ogg,audio/mp4", name defaulting to the file name, 10MB client check, uploading state) via FormData; list of tracks with an `<audio controls preload="none">` player, size in MB, created date, active toggle (PATCH), inline rename (PATCH), delete with confirm. Empty state explains: "Mỗi lần khách vào trang mở hòm, một bài đang bật sẽ được chọn ngẫu nhiên."
- GameForm.tsx (targeted edits, keep BOM): rewardPoints state (0), loaded from g.rewardPoints ?? 0, sent in buildBody; number input min 0 max 1000000 step 1 in the Pricing section labelled "Điểm thưởng (khi đơn hoàn tất)" with hint "Khách đăng nhập nhận số điểm này khi đơn có game này hoàn tất.".
- App.tsx (targeted edits, keep BOM): navItems add { to: "/customers", label: "Khách hàng", icon: Users } and { to: "/spin-music", label: "Kho nhạc", icon: Music } (lucide); lazy routes for Customers and SpinMusic; the mobile bottom nav becomes horizontally scrollable (overflow-x-auto, items flex-none min-w-[64px]) so 9 items still fit at 360px.

Run `npm run build` in Moxic.Admin and `dotnet build API/Moxic.slnx`. Commit `feat(quick-261103-sls): admin cases, customers/points, music library` with explicit paths only.
  </action>
  <verify>
    <automated>cd /c/Users/trung/OneDrive/Documents/project-moxic && dotnet build API/Moxic.slnx -nologo -v q && grep -q 'RequestSizeLimit' API/Moxic.Api/Controllers/AdminSpinMusicController.cs && grep -q 'IsAudio' API/Moxic.Api/Controllers/AdminSpinMusicController.cs && grep -q 'IsImage' API/Moxic.Api/Controllers/AdminSpinCasesController.cs && grep -q 'AdjustAsync' API/Moxic.Api/Controllers/AdminCustomersController.cs && grep -q 'Authorize(Roles = "Admin")' API/Moxic.Api/Controllers/AdminCustomersController.cs && grep -q 'Authorize(Roles = "Admin")' API/Moxic.Api/Controllers/AdminSpinMusicController.cs && grep -q 'Authorize(Roles = "Admin")' API/Moxic.Api/Controllers/AdminSpinCasesController.cs && grep -q 'RewardPoints' API/Moxic.Api/Models/Dtos.cs && grep -q 'RewardPoints' API/Moxic.Api/Controllers/AdminGamesController.cs && cd Moxic.Admin && npm run build && grep -q 'lucky-spin/cases/' src/pages/LuckySpinPrizes.tsx && grep -q 'lucky-spin/cases/' src/pages/LuckySpinCodes.tsx && grep -q 'caseId' src/pages/LuckySpinHistory.tsx && grep -q '/api/admin/lucky-spin/cases' src/lib/luckySpinAdmin.ts && grep -q '/api/admin/customers' src/pages/Customers.tsx && grep -q '/api/admin/spin-music' src/pages/SpinMusic.tsx && grep -q 'rewardPoints' src/pages/GameForm.tsx && grep -q '"/customers"' src/App.tsx && grep -q '"/spin-music"' src/App.tsx && head -c3 src/pages/GameForm.tsx | od -An -tx1 | grep -q 'ef bb bf' && echo OK</automated>
  </verify>
  <done>Admin can CRUD cases (method config, slug, image), manage prizes and codes per case with per-case 100% validation, filter history by case and see method/points/customer, list customers with balances, view ledgers and adjust points with a note (no negative balance), manage the music library, and set RewardPoints per game; both builds pass; committed with explicit paths only.</done>
</task>

<task type="auto">
  <name>Task 3: Storefront — case gallery + case open page (login/points/countdown states), near-miss reel animation, case music, LIVE drops strip, points in navbar + points history</name>
  <files>Moxic.Web/src/lib/luckySpinApi.ts, Moxic.Web/src/hooks/useLuckySpin.ts, Moxic.Web/src/lib/accountApi.ts, Moxic.Web/src/hooks/useAccount.ts, Moxic.Web/src/hooks/useCountdown.ts, Moxic.Web/src/hooks/useCaseMusic.ts, Moxic.Web/src/components/lucky-spin/CaseReel.tsx, Moxic.Web/src/components/lucky-spin/CaseCard.tsx, Moxic.Web/src/components/lucky-spin/LiveDropsBar.tsx, Moxic.Web/src/components/lucky-spin/ResultModal.tsx, Moxic.Web/src/pages/LuckySpinGalleryPage.tsx, Moxic.Web/src/pages/LuckySpinPage.tsx, Moxic.Web/src/pages/PointsHistoryPage.tsx, Moxic.Web/src/components/home/LuckySpinBanner.tsx, Moxic.Web/src/components/layout/Navbar.tsx, Moxic.Web/src/App.tsx</files>
  <action>
Vietnamese copy; purple/pink case styling from v1 (chamfered panels, #a855f7 -> #ec4899 gradients, RARITY_COLORS); mobile 360px+ and desktop polish; components-only exports in .tsx files (helpers live in lib/hooks); import type where needed; reuse sa8's MoxicLoader/SectionLoader/PageLoader for loading states.

Data layer:
- lib/luckySpinApi.ts: keep the axios instance + getContactSettings; export types per <interfaces> (OpenMethod, PublicPrize, CaseSummary, CasesPage, CaseViewer, CaseDetail, OpenCaseResult, SpinMusicTrack, LiveDrop, LiveDropsResponse); functions getCases({ page, pageSize, method?, q? }), getCase(slug), openCase(slug, code?), lookupSpinCode(code), getSpinMusic(), getLiveDrops() (GET "/lucky-spin/live-drops"); helpers openMethodLabel(c) ("Nhập mã" / `Miễn phí mỗi ${h}h` / `${points vi-VN} điểm`) and formatPoints(n). Remove getLuckySpinPrizes/spinWithCode.
- hooks/useLuckySpin.ts: useLuckySpinCases({ method, q }) = useInfiniteQuery key ["lucky-spin","cases",{ method, q }], pageSize 24, initialPageParam 1, getNextPageParam from page*pageSize < total; useLuckySpinCasesPreview() = useQuery ["lucky-spin","cases","preview"] page 1 size 12; useLuckySpinCase(slug) key ["lucky-spin","case",slug] staleTime 15 s, no retry on 404; useOpenCase(slug) mutation whose onSuccess invalidates ["account","me"] (sa8 ME_QUERY_KEY), ["account","points"], ["lucky-spin","case",slug] and ["lucky-spin","cases"]; useSpinMusic() staleTime 30 min (presigned URLs last 1 h); useLiveDrops() refetchInterval 8000, staleTime 4000, refetchIntervalInBackground false; useContactSettings (unchanged); getSpinErrorMessage(err) (429 text, else data.error, else fallback) and getSpinErrorCode(err) (data.code string).
- lib/accountApi.ts + hooks/useAccount.ts (sa8 files, additive edits): types PointsReason, PointsTransaction { id, delta, reason, note, balanceAfter, createdAt }, PointsHistoryResponse; getMyPoints(page, pageSize = 20); POINTS_REASON_LABELS (OrderCompleted "Hoàn tất đơn hàng", CaseOpen "Mở hòm", AdminAdjust "Điều chỉnh bởi Moxic"); useMyPoints(page, enabled) key ["account","points",page] with placeholderData keepPreviousData.
- hooks/useCountdown.ts: useServerNow(serverNowIso, receivedAt) — offset = Date.parse(serverNow) - receivedAt (pass the query's dataUpdatedAt so cached data does not skew the clock), ticks every 1 s, returns the corrected now in ms; formatCountdown(ms) -> "HH:MM:SS", or "{d} ngày HH:MM:SS" at >= 24 h.
- hooks/useCaseMusic.ts (discretion: fade timings): useCaseMusic(tracks) picks ONE random enabled track per mount (Math.random is fine here — cosmetic) and creates an HTMLAudioElement (preload "auto", loop) once a track is known; start() — must be called synchronously inside the click handler before any await (user gesture, no autoplay block): if not muted, currentTime 0, play() with catch, volume ramp 0 -> 0.55 over 300 ms; fadeOut(ms = 1800) ramps volume to 0 with requestAnimationFrame then pauses and restores volume (iOS ignores volume, so the pause at the end still stops it); stop() pauses immediately; toggleMute() flips state, persists "moxic:case-music-muted" in localStorage inside try/catch (read the initial value the same way) and pauses when muting; cleanup on unmount pauses and clears src. Returns { hasTrack, muted, toggleMute, start, fadeOut, stop }.

Reel (CONTEXT item 4):
- CaseReel.tsx: spin() takes `{ reel, winningIndex, stopOffset }` (OpenCaseResult satisfies it); landing offset = clamp(stopOffset, -0.48, 0.48) from the server (delete the Math.random offset — the client never invents the stop); SPIN_DURATION_MS 7600, SPIN_EASING "cubic-bezier(0.05, 0.85, 0.15, 1)" (fast start, long dramatic deceleration); keep WAAPI, the 1200 ms reduced-motion shortcut, the resize re-landing, image preloading and the marker.
- ResultModal.tsx: move the v1 modal out of the page; props { result, caseInfo: CaseSummary, onClose, canOpenAgain }; adds a line for Points ("Đã dùng {n} điểm · Số dư còn {m} điểm") and FreeInterval ("Lượt miễn phí tiếp theo: {time vi-VN}"); the close button reads "Mở tiếp" when canOpenAgain, else "Đóng"; Code keeps "Mã của bạn còn {n} lượt quay".

LIVE strip (CONTEXT item 5, real data only):
- LiveDropsBar.tsx: useLiveDrops(); renders nothing when wow and feed are both empty. Layout: a "LIVE" label with a pulsing red dot (static under motion-reduce) | gold-bordered (#e4ae39) "WOW" block with the 3 latest epic/legendary drops (only the first on < sm) | feed track of up to 20 drops, newest at the left. Desktop: overflow-hidden with a right edge fade mask; mobile: overflow-x-auto with snap. Card (~120x64 desktop, ~104 mobile): cover image (object-cover) or icon (TicketPercent for Discount, Gift for a Game without cover), prize name (line-clamp-1), case name (muted, line-clamp-1), masked winner name, rarity-colored bottom glow bar (RARITY_COLORS), title tooltip with timeAgo(createdAt); a card links to /lucky-spin/{caseSlug} when caseSlug is present. Slide-in: keep a ref Set of ids already shown; the first render does not animate; ids that are new on later polls animate with WAAPI (maxWidth 0 -> card width, opacity 0 -> 1, translateX(-24px) -> 0, 450 ms ease-out) so existing cards shift right; skip animation when prefers-reduced-motion.

Pages:
- LuckySpinGalleryPage.tsx (route /lucky-spin; many cases): heading badge "Mở hòm", title "Vòng Quay May Mắn", subtitle; logged-in chip "Điểm của bạn: {points}" linking /account/points (useMe), guest link "Đăng nhập để mở hòm miễn phí và dùng điểm" -> /login?redirect=/lucky-spin; LiveDropsBar; inline "Có mã quay?" form -> lookupSpinCode -> navigate(/lucky-spin/{slug}?code=CODE), error toast via getSpinErrorMessage; on mount, a ?code= param is resolved the same way (replace navigation) so old v1 links keep working; filter chips Tất cả / Nhập mã / Miễn phí / Dùng điểm + search input (debounced 300 ms); grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 of CaseCard; SectionLoader while loading; empty states "Chưa có hòm nào." / "Không tìm thấy hòm phù hợp."; "Xem thêm hòm" button (MoxicLoader sm while fetching the next page) when hasNextPage. One useServerNow drives every card's countdown.
- CaseCard.tsx (component): Link to /lucky-spin/{slug}; chamfered purple card; art = case imageUrl, else a small fan of up to 3 previewPrizes (PrizeCard size "reel" scaled down) or a Gift icon; name, description line-clamp-2, "{prizeCount} vật phẩm"; method badge (KeyRound "Nhập mã" / Clock "Miễn phí mỗi {h}h" / Coins "{n} điểm"); status line: !available "Đang cập nhật" (amber); FreeInterval: guest "Đăng nhập để mở", active cooldown "Mở lại sau {countdown}", else "Sẵn sàng mở" (green); Points: logged in and short -> "Cần thêm {n} điểm"; bottom glow in the rarest preview prize's color.
- LuckySpinPage.tsx (route /lucky-spin/:slug; rewrite, keep sa8's MoxicLoader usage): back link "← Tất cả hòm"; header with method badge, case name, description; LiveDropsBar; CaseReel (MoxicLoader md placeholder while loading; idle items = prizes); action panel per method — Code: v1 code input (pre-filled from ?code=) + "Mở hòm" (no login); FreeInterval: guest -> gold button "Đăng nhập để mở miễn phí" linking /login?redirect=/lucky-spin/{slug}; cooldown -> disabled button + "Lượt miễn phí tiếp theo sau {countdown}" (when the countdown reaches 0, refetch the case); ready -> "Mở miễn phí"; Points: guest -> login button; logged in -> "Mở hòm · {cost} điểm" + "Số dư: {points} điểm", disabled with "Bạn cần thêm {n} điểm" when short; a mute toggle (Volume2/VolumeX, aria-pressed, title "Tắt nhạc"/"Bật nhạc") next to the button when music.hasTrack; "Vật phẩm trong hòm" grid + rarity legend (v1); 404 -> "Không tìm thấy hòm" + link back. Open handler: guard busy; music.start() synchronously FIRST; setAnimating(true); await openCase.mutateAsync(code); await reelRef.current.spin(result); music.fadeOut(); wait ~350 ms; show ResultModal (canOpenAgain: Code remainingUses > 0, Points pointsBalance >= pointsCost, FreeInterval false); on error music.stop() and by code: LOGIN_REQUIRED -> navigate to login with redirect; EMAIL_NOT_VERIFIED -> navigate /verify-email?email=...; COOLDOWN / INSUFFICIENT_POINTS -> toast + refetch case and me; default toast getSpinErrorMessage.
- PointsHistoryPage.tsx (route /account/points under sa8's RequireCustomer): mirror OrderHistoryPage styling; header "Điểm thưởng"; large gold balance; explainer "Nhận điểm khi đơn hàng hoàn tất (mỗi game có số điểm riêng). Dùng điểm để mở hòm tại Vòng Quay May Mắn." with a link to /lucky-spin; ledger rows (date, POINTS_REASON_LABELS, note, delta +green / -red, balance after); prev/next pagination; SectionLoader; empty "Chưa có giao dịch điểm nào.".
- LuckySpinBanner.tsx: uses useLuckySpinCasesPreview(); hidden unless at least one case is available; fan = rarest previewPrizes across available cases (dedupe by id, top 5); copy "Mở hòm bằng mã quay, miễn phí theo chu kỳ hoặc bằng điểm thưởng — cơ hội nhận game Xbox miễn phí và mã giảm giá"; CTA links /lucky-spin. (Optional live strip on the home banner is not added.)
- Navbar.tsx (sa8 account menu, targeted edits): account button shows a gold points chip (Coins icon + vi-VN number, hidden below lg); dropdown header adds "Điểm thưởng: {points}"; new item "Điểm thưởng" (Coins) -> /account/points; mobile menu adds the points line + "Điểm thưởng" link.
- App.tsx: lazy LuckySpinGalleryPage at /lucky-spin, LuckySpinPage at /lucky-spin/:slug, PointsHistoryPage at /account/points inside the RequireCustomer element route.

Finally run npm run build in Moxic.Web and Moxic.Admin and dotnet build. Manual-QA notes go to the SUMMARY. Commit `feat(quick-261103-sls): storefront case gallery, points, music, near-miss reel, live drops` with explicit paths only.
  </action>
  <verify>
    <automated>cd /c/Users/trung/OneDrive/Documents/project-moxic/Moxic.Web && npm run build && grep -q 'live-drops' src/lib/luckySpinApi.ts && grep -q 'refetchInterval' src/hooks/useLuckySpin.ts && grep -q 'useInfiniteQuery' src/hooks/useLuckySpin.ts && grep -q 'stopOffset' src/components/lucky-spin/CaseReel.tsx && grep -q 'cubic-bezier(0.05, 0.85, 0.15, 1)' src/components/lucky-spin/CaseReel.tsx && grep -v '^\s*//' src/components/lucky-spin/CaseReel.tsx | grep -c 'Math.random' | grep -qx 0 && grep -q 'localStorage' src/hooks/useCaseMusic.ts && grep -q 'catch' src/hooks/useCaseMusic.ts && grep -q 'LiveDropsBar' src/pages/LuckySpinGalleryPage.tsx && grep -q 'LiveDropsBar' src/pages/LuckySpinPage.tsx && grep -q 'useLuckySpinCases' src/pages/LuckySpinGalleryPage.tsx && grep -q 'useCaseMusic' src/pages/LuckySpinPage.tsx && grep -q '"/lucky-spin/:slug"' src/App.tsx && grep -q 'account/points' src/App.tsx && grep -q 'points' src/components/layout/Navbar.tsx && grep -q 'useMyPoints' src/pages/PointsHistoryPage.tsx && cd ../Moxic.Admin && npm run build && cd .. && dotnet build API/Moxic.slnx -nologo -v q && echo OK</automated>
  </verify>
  <done>All three builds pass; /lucky-spin lists cases with paging/filter/search and resolves ?code=; /lucky-spin/:slug opens Code/FreeInterval/Points cases with correct login, countdown and points states; the reel runs ~7.6 s to the server stop offset with near-miss neighbours; music starts on click, fades after the result, mute persists; the LIVE strip shows real masked drops and animates new ones in; the navbar shows points and /account/points lists the ledger; committed with explicit paths only.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser -> POST /api/lucky-spin/cases/{slug}/open | Untrusted request that spends codes/points/free opens and receives a prize |
| browser -> GET /api/lucky-spin/live-drops, /cases, /music | Public reads that must not leak PII or odds |
| Cloudflare -> Caddy -> API headers | Client IP headers used for rate-limit partitioning |
| admin SPA -> /api/admin/* uploads | Files stored in MinIO and served back to browsers |
| admin -> points adjust | Manual balance changes |
| order status change -> points credit | Money-equivalent value created once per order |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-sls-01 | Tampering | Outcome manipulation | mitigate | Winner only from LuckySpinRules.PickPrize (RandomNumberGenerator) on the server; request body is just `{ code? }`; reel layout and stopOffset built server-side after the draw; verify gate forbids System.Random and Math.random offsets |
| T-sls-02 | Tampering | Points double-spend race | mitigate | Single conditional UPDATE `Points >= cost` inside the open transaction (row lock re-check); ledger row in the same tx |
| T-sls-03 | Tampering | Free-open race / repeat | mitigate | PK (UserId, CaseId) + INSERT ... ON CONFLICT DO UPDATE ... WHERE LastOpenedAt <= threshold inside the tx; rollback restores it on later failure |
| T-sls-04 | Tampering | Double points award per order | mitigate | Conditional `PointsAwardedAt == null` update + unique (Reason, RefId) index, both inside the status-change transaction |
| T-sls-05 | Spoofing | Rate-limit bypass via forged IP headers | mitigate | X-Real-IP dropped; CF-Connecting-IP (overwritten by Cloudflare) -> first XFF hop -> socket, all IPAddress-validated; per-user SpinUserRateLimiter for account cases. Residual: requests hitting the origin directly could forge CF-Connecting-IP — accept, ops should restrict origin ingress to Cloudflare ranges (note in SUMMARY) |
| T-sls-06 | Tampering / XSS | Music + case image uploads | mitigate | Admin-only; extension allowlist + magic-byte sniffing (MediaSniffer) + server-chosen Content-Type + size limits (10 MB audio via RequestSizeLimit, 5 MB images); random object keys |
| T-sls-07 | Elevation of Privilege | Admin endpoints | mitigate | [Authorize(Roles = "Admin")] on AdminSpinCases/AdminCustomers/AdminSpinMusic/AdminLuckySpin (verify gate); customer endpoints use the MoxicCustomer scheme + Customer role |
| T-sls-08 | Information Disclosure | Live drops / public case data | mitigate | Explicit projection without UserEmail/ClientIp/RewardCode/UserId; masked display names; probabilities never in public DTOs (verify gate); customer ledger DTO omits CreatedBy/RefId |
| T-sls-09 | Repudiation | Manual point adjustments | mitigate | Ledger row with CreatedBy (admin identity), required note, BalanceAfter; no update/delete endpoints for ledger rows |
| T-sls-10 | Tampering | Negative balances | mitigate | Conditional updates `Points >= cost` and `Points + delta >= 0` |
| T-sls-11 | Denial of Service | Polling / gallery / uploads | mitigate | live-drops cached 5 s in IMemoryCache; gallery pageSize <= 48 with batched prize/cooldown queries; open + code-lookup on the 10/min/IP policy; upload size limits |
| T-sls-12 | Information Disclosure | Code enumeration via code-lookup | mitigate | Same IP rate limit; 10-char codes from a 31-symbol alphabet; returns only the slug |
| T-sls-13 | Information Disclosure | Live feed spoiling or revealing in-progress results | mitigate | Wins younger than 10 s are excluded |
| T-sls-SC | Tampering | Package installs | accept | No new npm/NuGet packages (rate limiting, memory cache, RandomNumberGenerator are in the shared framework; frontend uses existing react-query/lucide/axios) |
</threat_model>

<verification>
- Baseline and final: `dotnet build API/Moxic.slnx`, `npm run build` in Moxic.Web and Moxic.Admin all pass (no new errors/warnings from touched files).
- Migration *_AddSpinCasesPointsMusic.cs exists; snapshot contains SpinCase, SpinCaseCooldown, PointsTransaction, SpinMusicTrack, SpinPrize.CaseId, Game.RewardPoints, Order.PointsAwardedAt; bootstrap DDL matches `dotnet ef migrations script` names.
- Bootstrap is idempotent (re-runnable) and the default case is created only when v1 orphans exist.
- Optional runtime smoke only if Postgres is already reachable (never start containers); otherwise "skipped: DB not reachable".
- BOMs preserved on Program.cs, AdminOrdersController.cs, GameForm.tsx; garbled strings in AdminOrdersController.cs unchanged (`git diff` shows only targeted hunks); `git status --short` after the last commit shows only `.planning/` untracked; no build output committed.
</verification>

<success_criteria>
- Every locked decision implemented: server-only outcome/cost/eligibility in one transaction with atomic conditional updates (points UPDATE ... WHERE Points >= cost; SpinCaseCooldown unique (UserId, CaseId) with a conditional upsert); points idempotent per order; prize types unchanged; idempotent bootstrap + EF migration with v1 prizes/codes/history moved into a default Code case.
- CONTEXT items 1-5 delivered: multiple cases with three open methods + per-case 100% validation, loyalty points (RewardPoints, ledger, admin list/adjust, customer balance + history), case music library + playback, cosmetic rarity-biased reel + near-miss + 7.6 s strong ease-out, LIVE drops strip of real masked wins; gallery handles many cases (paged load-more + filters).
- Discretion items documented in SUMMARY: IP extraction order + per-user limiter, cosmetic weights, near-miss tiers and offset range, fade timings, RewardPoints read at completion time, live-drop 10 s delay, Discount kept generic for 261103-smv.
- Three atomic commits with explicit paths; builds pass.
</success_criteria>

<output>
Create `.planning/quick/261103-sls-multi-cases-points-music-and-reel-near-m/261103-sls-SUMMARY.md` when done (do NOT commit it — the orchestrator commits docs). Include: baseline builds, migration name + any drift, bootstrap/data-migration notes, smoke result or skip reason, discretion choices, shared files touched (Program.cs, AdminOrdersController.cs, MoxicDbContext.cs, Navbar.tsx, App.tsx x2, accountApi.ts/useAccount.ts), the residual origin-bypass note for CF-Connecting-IP, and a manual QA checklist: v1 data under "Hòm mã quay"; create Code / FreeInterval / Points cases; per-case 100% gate; code open as guest; free open + countdown + second-attempt 409; points open + insufficient points; complete an order and see points credited once (repeat status call does not double); admin adjust (incl. trying to go negative); music start/fade/mute persistence (desktop + iOS); reel near-miss on a Luck win (both sides) and reduced-motion; LIVE strip WOW block + feed slide-in + mobile scroll + no email/IP in the network response; gallery paging with >24 cases; navbar points + /account/points.
</output>
</content>
</invoke>
