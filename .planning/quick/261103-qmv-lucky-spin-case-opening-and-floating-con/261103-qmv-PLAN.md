---
phase: quick-261103-qmv
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  # Task 1 - backend (new)
  - API/Moxic.Shared/Enums/SpinPrizeType.cs
  - API/Moxic.Core/Entities/SpinPrize.cs
  - API/Moxic.Core/Entities/SpinCode.cs
  - API/Moxic.Core/Entities/SpinHistory.cs
  - API/Moxic.Core/Entities/ContactSetting.cs
  - API/Moxic.Infrastructure/Data/LuckySpinSchemaBootstrap.cs
  - API/Moxic.Api/Services/LuckySpinRules.cs
  - API/Moxic.Api/Controllers/AdminLuckySpinController.cs
  - API/Moxic.Api/Controllers/LuckySpinController.cs
  - API/Moxic.Api/Controllers/AdminContactSettingsController.cs
  - API/Moxic.Api/Controllers/ContactSettingsController.cs
  - API/Moxic.Infrastructure/Data/Migrations/*_AddLuckySpinAndContactSettings.cs
  - API/Moxic.Infrastructure/Data/Migrations/*_AddLuckySpinAndContactSettings.Designer.cs
  # Task 1 - backend (shared with pre-existing uncommitted user edits)
  - API/Moxic.Infrastructure/Data/MoxicDbContext.cs
  - API/Moxic.Infrastructure/Data/Migrations/MoxicDbContextModelSnapshot.cs
  - API/Moxic.Api/Program.cs
  # Task 2 - admin SPA
  - Moxic.Admin/src/pages/LuckySpin.tsx
  - Moxic.Admin/src/pages/LuckySpinPrizes.tsx
  - Moxic.Admin/src/pages/LuckySpinCodes.tsx
  - Moxic.Admin/src/pages/LuckySpinHistory.tsx
  - Moxic.Admin/src/pages/ContactSettings.tsx
  - Moxic.Admin/src/App.tsx
  # Task 3 - storefront
  - Moxic.Web/src/lib/luckySpinApi.ts
  - Moxic.Web/src/hooks/useLuckySpin.ts
  - Moxic.Web/src/components/lucky-spin/PrizeCard.tsx
  - Moxic.Web/src/components/lucky-spin/CaseReel.tsx
  - Moxic.Web/src/pages/LuckySpinPage.tsx
  - Moxic.Web/src/components/home/LuckySpinBanner.tsx
  - Moxic.Web/src/components/layout/FloatingContact.tsx
  - Moxic.Web/src/App.tsx
  - Moxic.Web/src/pages/HomePage.tsx
  - Moxic.Web/src/components/layout/AppLayout.tsx
autonomous: true
requirements: [LUCKY-SPIN, CONTACT-BUTTONS]

must_haves:
  truths:
    - "Admin can create/edit/delete prizes of type Luck, Discount or Game with a % odds value; the admin page shows the active total and warns when it is not exactly 100%; the server rejects saves that push the active total above 100%"
    - "Admin can generate 1..500 spin codes at once with MaxUses (default 1) and optional expiry, list them with used/max counts and status, disable/re-enable and delete them"
    - "The storefront home page shows a lucky-spin banner (only when the prize pool is valid) linking to /lucky-spin, where entering a valid code triggers a spin whose outcome is decided by the server with RandomNumberGenerator"
    - "A code with MaxUses=1 can be redeemed exactly once, even under concurrent requests; invalid/disabled/expired/used-up codes return a Vietnamese error and do not spin"
    - "The CS2-style reel scrolls horizontally (~6.5s ease-out) and stops with the server-chosen card under the pink center marker on both desktop and mobile widths, then shows the result with a unique reward code for Discount/Game prizes"
    - "Every spin is recorded in spin history (code, prize snapshot, reward code, time, IP); admin can search by reward code and toggle claimed"
    - "Floating contact buttons sit bottom-right on every storefront page: collapsed shows Messenger + a '+' toggle, expanded shows Messenger/Zalo/Phone with '+' rotated into 'x'; buttons whose admin-configured value is empty are hidden"
    - "Existing databases receive the 4 new tables at API startup via idempotent CREATE TABLE IF NOT EXISTS; dotnet build and npm run build in Moxic.Web and Moxic.Admin all pass"
  artifacts:
    - path: "API/Moxic.Api/Controllers/LuckySpinController.cs"
      provides: "Public GET /api/lucky-spin/prizes and rate-limited POST /api/lucky-spin/spin with atomic code redemption"
      contains: "ExecuteUpdateAsync"
    - path: "API/Moxic.Api/Services/LuckySpinRules.cs"
      provides: "Static helpers: CSPRNG weighted draw, code generation, normalization, rarity tiers, reel builder, client IP"
      contains: "RandomNumberGenerator"
    - path: "API/Moxic.Api/Controllers/AdminLuckySpinController.cs"
      provides: "Admin CRUD for prizes, code generation/list/toggle/delete, history list + claim toggle, game options"
      contains: "Authorize(Roles = \"Admin\")"
    - path: "API/Moxic.Api/Controllers/ContactSettingsController.cs"
      provides: "Public GET /api/contact-settings with resolved hrefs"
    - path: "API/Moxic.Infrastructure/Data/LuckySpinSchemaBootstrap.cs"
      provides: "Idempotent DDL for SpinPrizes, SpinCodes, SpinHistories, ContactSettings"
      contains: "CREATE TABLE IF NOT EXISTS"
    - path: "Moxic.Admin/src/pages/LuckySpin.tsx"
      provides: "Tabbed admin page (prizes / codes / history)"
    - path: "Moxic.Admin/src/pages/ContactSettings.tsx"
      provides: "Admin contact settings form"
    - path: "Moxic.Web/src/components/lucky-spin/CaseReel.tsx"
      provides: "CS2-style reel panel with Web Animations API spin to server result"
      contains: ".animate("
    - path: "Moxic.Web/src/pages/LuckySpinPage.tsx"
      provides: "Code entry, spin flow, result modal with reward code"
    - path: "Moxic.Web/src/components/layout/FloatingContact.tsx"
      provides: "Floating Messenger/Zalo/Phone buttons with + toggle"
  key_links:
    - from: "API/Moxic.Api/Program.cs"
      to: "LuckySpinSchemaBootstrap.EnsureAsync"
      via: "call inside DB init try-block after the GameReviews CREATE TABLE"
      pattern: "LuckySpinSchemaBootstrap\\.EnsureAsync"
    - from: "API/Moxic.Api/Program.cs"
      to: "rate limiter policy lucky-spin"
      via: "AddRateLimiter + UseRateLimiter, [EnableRateLimiting(\"lucky-spin\")] on Spin action"
      pattern: "UseRateLimiter"
    - from: "Moxic.Web/src/pages/LuckySpinPage.tsx"
      to: "/api/lucky-spin/spin"
      via: "useSpin mutation in hooks/useLuckySpin.ts -> lib/luckySpinApi.ts"
      pattern: "lucky-spin/spin"
    - from: "Moxic.Web/src/components/layout/AppLayout.tsx"
      to: "FloatingContact"
      via: "rendered once in layout"
      pattern: "<FloatingContact"
    - from: "Moxic.Web/src/pages/HomePage.tsx"
      to: "LuckySpinBanner"
      via: "section between HeroSplash and DiscoverySection"
      pattern: "<LuckySpinBanner"
    - from: "Moxic.Admin/src/App.tsx"
      to: "LuckySpin / ContactSettings pages"
      via: "navItems + Routes"
      pattern: "/lucky-spin"
---

<objective>
Deliver two storefront engagement features end-to-end (DB -> API -> admin UI -> storefront UI):

1. Lucky spin / case opening: admin-configured prize pool (Luck / Discount / Game) with % odds, admin-generated spin codes, atomic code redemption, server-side CSPRNG weighted draw, spin history with claim toggle, and a CS2-style horizontal reel animation on the storefront (home-page banner + /lucky-spin route), smooth on desktop and mobile. Vietnamese UI copy on the storefront.
2. Floating contact buttons (Messenger / Zalo / Phone) bottom-right on the storefront, configured in admin.

Purpose: implements every locked decision in 261103-qmv-CONTEXT.md (Prize types, Odds, Spin codes, Spin history, Contact buttons) for customer engagement and quick contact.
Output: 4 new tables + migration, 4 controllers, 5 admin pages/components, 7 new storefront files, wiring edits.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@AGENTS.md
@.planning/quick/261103-qmv-lucky-spin-case-opening-and-floating-con/261103-qmv-CONTEXT.md

Backend pattern sources (read once each):
@API/Moxic.Api/Program.cs
@API/Moxic.Infrastructure/Data/MoxicDbContext.cs
@API/Moxic.Api/Controllers/AdminReviewsController.cs
@API/Moxic.Api/Controllers/PaymentConfigController.cs
@API/Moxic.Api/Endpoints/GameEndpoints.cs  (lines 15-50: how cover image presigned URL is built from primary GameMedia, bucket "moxic-games", wrapped in try/catch)
@API/Moxic.Shared/Enums/MoxicEnums.cs

Admin pattern sources:
@Moxic.Admin/src/App.tsx
@Moxic.Admin/src/pages/TagList.tsx
@Moxic.Admin/src/pages/PaymentConfig.tsx
@Moxic.Admin/src/lib/api.ts  (apiFetch + apiUrl — use as-is, do NOT modify)

Storefront pattern sources:
@Moxic.Web/src/App.tsx
@Moxic.Web/src/components/layout/AppLayout.tsx
@Moxic.Web/src/pages/HomePage.tsx
@Moxic.Web/src/lib/api.ts  (axios config to mirror — do NOT modify)
@Moxic.Web/src/hooks/useGames.ts
@Moxic.Web/src/index.css  (theme tokens lines 1-30; NOTE the global prefers-reduced-motion rule at line ~92 forces transition-duration 0s !important — do NOT modify this file)

<working_tree_rules>
The working tree contains MANY uncommitted user changes. The executor runs directly on the main tree (no worktree).
- Run a BASELINE first (before any edit): `dotnet build API/Moxic.Api/Moxic.Api.csproj -nologo -v q`, `npm run build` in Moxic.Admin and in Moxic.Web. Record pass/fail in SUMMARY. If a baseline already fails because of files this plan does not touch, do not fix the user's code — report it, and judge task builds by "no NEW errors in files this plan touches".
- Never run `git stash`, `git checkout -- <file>`, `git restore`, `git reset`, `git add -A`, `git add .`, or `git commit -a`. Stage ONLY explicit paths listed in this plan's files_modified (plus the two generated migration files by their real names).
- Never stage build/log artifacts (bin/, obj/, dist/, *.log, msbuild.binlog, build_*.txt, api.log, _temp_check.txt).
- Edit existing files with minimal, targeted Edit-tool insertions. Do NOT rewrite whole files with Write: Program.cs contains mojibake Vietnamese comments and several files start with a UTF-8 BOM — rewriting would re-encode them. Do not reformat unrelated lines.
- Shared files with pre-existing uncommitted user hunks that this plan must also touch: API/Moxic.Api/Program.cs, API/Moxic.Infrastructure/Data/MoxicDbContext.cs, API/Moxic.Infrastructure/Data/Migrations/MoxicDbContextModelSnapshot.cs (Task 1) and Moxic.Admin/src/App.tsx (Task 2). Per CONTEXT ("commit only files touched for this task, git add explicit paths") these are staged whole by explicit path; list them in SUMMARY under "Shared files committed together with pre-existing user changes". Moxic.Web/src/App.tsx, HomePage.tsx and AppLayout.tsx are currently clean.
- After each commit, run `git status --short` and confirm every previously-modified user file is still listed as modified/untracked (nothing reverted).
</working_tree_rules>

<schema_facts>
VERIFIED during planning — how schema actually reaches the database in this repo:
- Program.cs calls `dbContext.Database.EnsureCreatedAsync()` (NOT `Migrate()`), then runs idempotent raw SQL `CREATE TABLE IF NOT EXISTS "GameReviews" ...` for existing databases where EnsureCreated is a no-op. Migrations in API/Moxic.Infrastructure/Data/Migrations were generated with `dotnet ef migrations add` (Designer.cs files present) but are never applied at runtime.
- Therefore this plan does BOTH: (a) generate a migration with dotnet ef to keep the migrations folder + snapshot consistent, and (b) add idempotent DDL in LuckySpinSchemaBootstrap.cs called from Program.cs so existing dev/test/prod DBs get the tables.
- dotnet-ef 10.0.9 is installed; Microsoft.EntityFrameworkCore.Design is referenced by Moxic.Api; no IDesignTimeDbContextFactory exists (dotnet ef uses the Program.cs host; code after `builder.Build()` is not executed, so no DB is needed for `migrations add`).
- The current snapshot does NOT yet contain the user's GameReview entity (model drift from uncommitted user work). The generated migration WILL include a CreateTable for "GameReviews" (and any other drift). Keep the EF output as generated (do not hand-strip operations — the snapshot must equal the full model) and note this in SUMMARY.
- Identifiers are PascalCase, quoted (no snake_case convention). Keys: uuid; singleton settings use int identity (like PaymentConfig). Timestamps are `timestamp with time zone`; always write DateTime values with Kind=Utc.
- Enums are stored as strings via `.HasConversion<string>().HasMaxLength(20)` (see Game.Status). Controllers serialize enums as strings (JsonStringEnumConverter registered) and JSON property names as camelCase.
</schema_facts>

<interfaces>
Contracts shared by all three tasks. Backend (Task 1) MUST implement exactly; Admin (Task 2) and Storefront (Task 3) consume exactly.

Enum (Moxic.Shared.Enums.SpinPrizeType): Luck, Discount, Game  -> JSON "Luck" | "Discount" | "Game"

Rarity (string, computed server-side from Probability percent):
  > 25 -> "common" | > 10 -> "uncommon" | > 3 -> "rare" | > 1 -> "epic" | otherwise -> "legendary"
Client colors: common #b0c3d9 (gray), uncommon #4b69ff (blue), rare #8847ff (purple), epic #eb4b4b (red), legendary #e4ae39 (gold)

Entities (one class per file, Moxic.Core.Entities):
  SpinPrize      { Guid Id; string Name(100, required); SpinPrizeType Type; Guid? GameId; Game? Game; decimal Probability (precision 5,2, percent); bool IsActive; int DisplayOrder; DateTime CreatedAt; DateTime UpdatedAt }
  SpinCode       { Guid Id; string Code(32, required, UNIQUE, stored UPPERCASE); int MaxUses; int UsedCount; DateTime? ExpiresAt; bool IsActive; string? Note(200); DateTime CreatedAt }
  SpinHistory    { Guid Id; Guid? SpinCodeId; string CodeText(32); Guid? PrizeId; string PrizeName(100); SpinPrizeType PrizeType; Guid? GameId; string? RewardCode(32, UNIQUE); bool IsClaimed; DateTime? ClaimedAt; string? ClientIp(64); DateTime CreatedAt }
  ContactSetting { int Id; string? MessengerUrl(500); string? Zalo(500); string? PhoneNumber(30); DateTime UpdatedAt }
  FKs: SpinPrize.GameId -> Games ON DELETE SET NULL (configure HasOne(p => p.Game).WithMany() — do NOT add a collection to Game.cs);
       SpinHistory.SpinCodeId -> SpinCodes SET NULL; SpinHistory.PrizeId -> SpinPrizes SET NULL (HasOne<T>().WithMany() without navs).
  Indexes: SpinCodes(Code) unique; SpinHistories(RewardCode) unique; SpinHistories(CreatedAt); SpinPrizes(GameId).
  DbSets: SpinPrizes, SpinCodes, SpinHistories, ContactSettings  -> table names "SpinPrizes", "SpinCodes", "SpinHistories", "ContactSettings".

Error body everywhere: { "error": "<message>" }

PUBLIC
GET  /api/lucky-spin/prizes
  200 { available: boolean, prizes: PublicPrize[] }
  PublicPrize = { id: string, name: string, type: SpinPrizeType, rarity: Rarity, gameId: string|null, imageUrl: string|null }   // NO probability exposed
  available = at least one active prize AND sum over active prizes of round(Probability*100) == 10000
POST /api/lucky-spin/spin            body { code: string }      [EnableRateLimiting("lucky-spin")]
  200 { spinId: string, prize: PublicPrize, rewardCode: string|null, remainingUses: number, winningIndex: number, reel: PublicPrize[] }
  400 { error } -> "Mã quay không hợp lệ." | "Mã quay đã bị vô hiệu hóa." | "Mã quay đã hết hạn." | "Mã quay đã hết lượt sử dụng."
  429 (rate limit, empty body)
  503 { error: "Vòng quay đang được cấu hình, vui lòng quay lại sau." }   // checked BEFORE consuming the code
GET  /api/contact-settings
  200 { messengerUrl: string|null, zaloUrl: string|null, phoneNumber: string|null, phoneHref: string|null }
  // zaloUrl: if stored Zalo is a phone -> "https://zalo.me/{digitsOnly}", else the stored https URL. phoneHref: "tel:" + leading '+' and digits only. Empty/unset -> null. No row -> all null (200, not 404).

ADMIN  [Authorize(Roles = "Admin")]
GET    /api/admin/lucky-spin/prizes                     -> AdminPrize[] ordered by DisplayOrder, Name
       AdminPrize = { id, name, type, gameId, gameName, imageUrl, probability, rarity, isActive, displayOrder }
POST   /api/admin/lucky-spin/prizes        body PrizeUpsert -> 201 AdminPrize | 400
PUT    /api/admin/lucky-spin/prizes/{id}   body PrizeUpsert -> 200 AdminPrize | 400 | 404
DELETE /api/admin/lucky-spin/prizes/{id}                    -> 204 | 404
       PrizeUpsert = { name?: string, type: SpinPrizeType, gameId?: string, probability: number, isActive: boolean, displayOrder: number }
GET    /api/admin/lucky-spin/game-options?search=        -> [{ id, name }] (max 50, ordered by name)
GET    /api/admin/lucky-spin/codes?search=&page=1&pageSize=50 -> { items: AdminCode[], totalCount, page, pageSize }  (newest first)
       AdminCode = { id, code, maxUses, usedCount, expiresAt, isActive, note, status: "Active"|"UsedUp"|"Expired"|"Disabled", createdAt }
POST   /api/admin/lucky-spin/codes/generate body { count: number, maxUses?: number, expiresAt?: string(ISO UTC), note?: string } -> 200 { codes: string[] }
PATCH  /api/admin/lucky-spin/codes/{id}      body { isActive: boolean } -> 200 AdminCode | 404
DELETE /api/admin/lucky-spin/codes/{id}                                 -> 204 | 404
GET    /api/admin/lucky-spin/history?search=&claimed=&page=1&pageSize=50 -> { items: AdminSpin[], totalCount, page, pageSize } (newest first; claimed = true|false|omitted)
       AdminSpin = { id, codeText, prizeName, prizeType, gameId, rewardCode, isClaimed, claimedAt, clientIp, createdAt }
PATCH  /api/admin/lucky-spin/history/{id}/claim body { isClaimed: boolean } -> 200 AdminSpin | 400 (Luck rows) | 404
GET    /api/admin/contact-settings  -> { messengerUrl: string, zalo: string, phoneNumber: string, updatedAt } (raw stored values, "" when unset)
PUT    /api/admin/contact-settings  body { messengerUrl?: string, zalo?: string, phoneNumber?: string } -> 200 same shape | 400

Reel constants: ReelLength = 50, WinningIndex = 44 (reel[44] is always the won prize; leaves cards visible after the winner on wide screens).
Code alphabet (unambiguous, no 0/O/1/I/L): "ABCDEFGHJKMNPQRSTUVWXYZ23456789". Spin codes: 10 chars. Reward codes: "MX" + 8 chars.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Backend — entities, schema bootstrap + migration, CSPRNG draw rules, admin/public lucky-spin and contact-settings endpoints, rate limiting</name>
  <files>API/Moxic.Shared/Enums/SpinPrizeType.cs, API/Moxic.Core/Entities/SpinPrize.cs, API/Moxic.Core/Entities/SpinCode.cs, API/Moxic.Core/Entities/SpinHistory.cs, API/Moxic.Core/Entities/ContactSetting.cs, API/Moxic.Infrastructure/Data/MoxicDbContext.cs, API/Moxic.Infrastructure/Data/LuckySpinSchemaBootstrap.cs, API/Moxic.Infrastructure/Data/Migrations/*_AddLuckySpinAndContactSettings(.Designer).cs, API/Moxic.Infrastructure/Data/Migrations/MoxicDbContextModelSnapshot.cs, API/Moxic.Api/Services/LuckySpinRules.cs, API/Moxic.Api/Controllers/AdminLuckySpinController.cs, API/Moxic.Api/Controllers/LuckySpinController.cs, API/Moxic.Api/Controllers/AdminContactSettingsController.cs, API/Moxic.Api/Controllers/ContactSettingsController.cs, API/Moxic.Api/Program.cs</files>
  <action>
Step 0 — baseline builds per working_tree_rules; record results.

Step 1 — model (per CONTEXT "Prize types", "Spin codes", "Spin history", "Contact buttons"). Create SpinPrizeType.cs (enum Luck, Discount, Game) in Moxic.Shared.Enums. Create the four entity files exactly as in the interfaces block (namespace Moxic.Core.Entities, defaults: IsActive=true, MaxUses=1, DisplayOrder=0). In MoxicDbContext.cs add four DbSets (SpinPrizes, SpinCodes, SpinHistories, ContactSettings) next to the existing DbSets and four modelBuilder.Entity blocks appended after the PaymentConfig block: max lengths, Probability HasPrecision(5,2), Type/PrizeType HasConversion string max 20, FKs with DeleteBehavior.SetNull as listed, unique indexes on SpinCodes.Code and SpinHistories.RewardCode, index on SpinHistories.CreatedAt. Do not touch Game.cs.

Step 2 — migration: run `dotnet ef migrations add AddLuckySpinAndContactSettings --project API/Moxic.Infrastructure --startup-project API/Moxic.Api --output-dir Data/Migrations` from the repo root (this matches how the existing timestamped migrations + Designer files were created). Keep the generated output unmodified even though it will also contain the pending GameReviews CreateTable (see schema_facts); mention it in SUMMARY. Then run `dotnet ef dbcontext script --project API/Moxic.Infrastructure --startup-project API/Moxic.Api -o <temp dir outside the repo>/moxic-schema.sql` and copy the exact CREATE TABLE / CREATE INDEX statements for "SpinPrizes", "SpinCodes", "SpinHistories", "ContactSettings" into LuckySpinSchemaBootstrap.cs.

Step 3 — LuckySpinSchemaBootstrap.cs (namespace Moxic.Infrastructure.Data, public static class, method EnsureAsync(MoxicDbContext db)): one ExecuteSqlRawAsync with the copied DDL rewritten as CREATE TABLE IF NOT EXISTS / CREATE [UNIQUE] INDEX IF NOT EXISTS, ordered ContactSettings, SpinCodes, SpinPrizes (FK to "Games" ON DELETE SET NULL), SpinHistories (FKs to SpinCodes and SpinPrizes ON DELETE SET NULL). No curly braces in the SQL string (ExecuteSqlRaw treats them as format placeholders). In Program.cs insert exactly one line, `await LuckySpinSchemaBootstrap.EnsureAsync(dbContext);`, immediately after the existing GameReviews ExecuteSqlRawAsync statement inside the same try block. Fresh DBs get the tables from EnsureCreated; existing DBs from this bootstrap.

Step 4 — LuckySpinRules.cs (namespace Moxic.Api.Services, public static class, no DI registration): constants ReelLength=50, WinningIndex=44, CodeAlphabet as in interfaces, RateLimitPolicy="lucky-spin". Methods: GenerateCode(int length) using RandomNumberGenerator.GetString(CodeAlphabet, length); NormalizeCode(string?) => trim, remove spaces and '-', ToUpperInvariant, returns null unless 6..32 chars of A-Z0-9; ToBasisPoints(decimal p) => (int)Math.Round(p*100); RarityFor(decimal p) per interfaces thresholds; PickWeighted(list of (prize, basisPoints)) using RandomNumberGenerator.GetInt32(0, total) with a cumulative walk (per CONTEXT "Odds": server decides with CSPRNG weighted by configured odds — never System.Random for the winner); BuildReel(activePrizes, winner) => array of ReelLength where every slot is a weighted-sampled filler (also via RandomNumberGenerator, cosmetic) and slot WinningIndex is the winner; GetClientIp(HttpContext) => X-Real-IP header (set by nginx to $remote_addr) if present, else Connection.RemoteIpAddress, else "unknown", truncated to 64.

Step 5 — public LuckySpinController (route api/lucky-spin, no auth):
GET prizes: load active prizes AsNoTracking with Include(Game).ThenInclude(Media), ordered by DisplayOrder then Name; map to PublicPrize (imageUrl for Game prizes = presigned URL of the primary GameMedia from bucket "moxic-games", same try/catch pattern as GameEndpoints; null otherwise); available flag per interfaces.
POST spin with [EnableRateLimiting(LuckySpinRules.RateLimitPolicy)]: (1) NormalizeCode, null -> 400 "Mã quay không hợp lệ.". (2) Load active prizes; if none or basis-point sum != 10000 -> 503 before touching the code. (3) BeginTransactionAsync. (4) Atomic redemption per CONTEXT "Spin codes": a single conditional UPDATE via ExecuteUpdateAsync on SpinCodes where Code == normalized AND IsActive AND UsedCount < MaxUses AND (ExpiresAt == null OR ExpiresAt > now), setting UsedCount = UsedCount + 1. PostgreSQL re-checks the WHERE under the row lock, so concurrent requests cannot both succeed. (5) If 0 rows affected: roll back, look the code up AsNoTracking and return 400 with the specific Vietnamese reason (not found / disabled / expired / used up). (6) Re-read the code row (Id, MaxUses, UsedCount) inside the transaction. (7) PickWeighted -> winner. (8) If winner.Type != Luck generate RewardCode "MX"+GenerateCode(8), retrying up to 5 times if AnyAsync finds a collision. (9) Insert SpinHistory with prize snapshot (PrizeName, PrizeType, GameId), CodeText, ClientIp, CreatedAt UtcNow; SaveChanges; Commit. (10) Return the 200 shape with reel = BuildReel(...) mapped to PublicPrize (compute each distinct prize's imageUrl once) and remainingUses = MaxUses - UsedCount.

Step 6 — AdminLuckySpinController (route api/admin/lucky-spin, [Authorize(Roles = "Admin")]); put request records at the bottom of the controller file like AdminReviewsController (do NOT edit Models/Dtos.cs). Prizes CRUD per interfaces with validation: probability 0.01..100 rounded to 2 decimals; Type=Game requires an existing GameId (Name defaults to the game name when blank); Discount requires a non-blank Name (e.g. "Giảm 10%"); Luck Name defaults to "Chúc bạn may mắn lần sau"; on create/update reject with 400 "Tổng tỉ lệ các giải đang bật vượt quá 100% (hiện tại X%)." when the active total including this prize would exceed 100.00 (per CONTEXT "Odds": warn/block — the server blocks >100, the admin UI warns <100, and spins are blocked via 503 until exactly 100). game-options endpoint per interfaces. Codes: generate per interfaces with validation count 1..500, maxUses 1..1000 (default 1), expiresAt must be in the future (convert to UTC with DateTime.SpecifyKind/ToUniversalTime), note max 200; generate unique codes (dedupe within the batch, regenerate any that already exist in DB), AddRange, SaveChanges, return codes. List with search (uppercase Contains on Code) + paging + computed status (Disabled if !IsActive, else Expired if ExpiresAt <= now, else UsedUp if UsedCount >= MaxUses, else Active). PATCH isActive, DELETE. History list with search (uppercase Contains on CodeText or RewardCode), claimed filter, paging; PATCH claim sets IsClaimed and ClaimedAt (UtcNow or null), 400 "Giải 'Chúc may mắn' không có phần thưởng để trao." for Luck rows.

Step 7 — contact settings (per CONTEXT "Contact buttons"; Claude's discretion: new ContactSetting singleton entity rather than extending PaymentConfig, so the user-modified PaymentConfig files stay untouched). AdminContactSettingsController (route api/admin/contact-settings, Admin role): GET returns raw values ("" when unset or no row); PUT upserts the single row: blank -> null; MessengerUrl must be an absolute http/https URI (Uri.TryCreate + scheme check) max 500; Zalo accepts either a phone matching ^[0-9+ .-]{8,20}$ or an absolute http/https URI; PhoneNumber must match ^[0-9+ .-]{8,20}$; anything else -> 400 with a Vietnamese message. Reject javascript:/data: schemes implicitly through the http/https check. Public ContactSettingsController (route api/contact-settings): GET returns resolved values per interfaces.

Step 8 — Program.cs (minimal Edit insertions only): add `using System.Threading.RateLimiting;` and `using Microsoft.AspNetCore.RateLimiting;` and `using Moxic.Api.Services;` only if not already present; before `var app = builder.Build();` register AddRateLimiter with RejectionStatusCode = StatusCodes.Status429TooManyRequests (default would be 503) and AddPolicy(LuckySpinRules.RateLimitPolicy, ctx => RateLimitPartition.GetFixedWindowLimiter(LuckySpinRules.GetClientIp(ctx), _ => new FixedWindowRateLimiterOptions with PermitLimit 10, Window 1 minute, QueueLimit 0)); add `app.UseRateLimiter();` right after `app.UseAuthorization();`.

Step 9 — `dotnet build API/Moxic.Api/Moxic.Api.csproj -nologo -v q` must succeed (if MSB3027 file lock from a running API, rebuild with `-o` pointing to a temp dir outside the repo; never kill user processes). Optional runtime smoke test ONLY if PostgreSQL is already reachable on localhost:5432 (do not start/stop containers): run the API on http://localhost:5234, log in via POST /api/auth/login (admin@moxic.com / Admin@123) with a curl cookie jar, create a Luck prize 90 and a Discount prize 10, generate 1 code with maxUses 1, fire 5 concurrent POST /api/lucky-spin/spin with that code (curl in background + wait) and confirm exactly one 200 and four 400; confirm GET /api/admin/lucky-spin/history shows one row; then delete the test prizes/code. Put the smoke script in a temp dir outside the repo. Record the outcome (or "skipped: DB not reachable") in SUMMARY.

Step 10 — commit: `git add` the explicit new files, the two generated migration files by real name, MoxicDbContext.cs, MoxicDbContextModelSnapshot.cs, Program.cs; commit "feat(quick-261103-qmv): lucky spin + contact settings backend".
  </action>
  <verify>
    <automated>cd /c/Users/trung/OneDrive/Documents/project-moxic && dotnet build API/Moxic.Api/Moxic.Api.csproj -nologo -v q && ls API/Moxic.Infrastructure/Data/Migrations/*_AddLuckySpinAndContactSettings.cs && grep -q "ExecuteUpdateAsync" API/Moxic.Api/Controllers/LuckySpinController.cs && grep -q "EnableRateLimiting" API/Moxic.Api/Controllers/LuckySpinController.cs && grep -q "RandomNumberGenerator.GetInt32" API/Moxic.Api/Services/LuckySpinRules.cs && grep -q "UseRateLimiter" API/Moxic.Api/Program.cs && grep -q "LuckySpinSchemaBootstrap.EnsureAsync" API/Moxic.Api/Program.cs && grep -Eq 'CREATE TABLE IF NOT EXISTS "{1,2}SpinHistories' API/Moxic.Infrastructure/Data/LuckySpinSchemaBootstrap.cs && grep -q 'Authorize(Roles = "Admin")' API/Moxic.Api/Controllers/AdminLuckySpinController.cs && grep -q 'Authorize(Roles = "Admin")' API/Moxic.Api/Controllers/AdminContactSettingsController.cs && grep -v '^\s*//' API/Moxic.Api/Services/LuckySpinRules.cs | grep -c "new Random\|Random.Shared" | grep -qx 0 && echo OK</automated>
  </verify>
  <done>API builds; migration AddLuckySpinAndContactSettings + updated snapshot exist; all endpoints in the interfaces block exist with the stated auth; spin uses a conditional ExecuteUpdateAsync inside a transaction, CSPRNG weighted draw, 503 before consuming codes when odds != 100%, 429 via the "lucky-spin" policy; existing DBs get the tables through LuckySpinSchemaBootstrap; task committed with explicit paths only and user changes intact.</done>
</task>

<task type="auto">
  <name>Task 2: Admin SPA — prizes (% total check), spin codes (generate/list/toggle/delete), spin history (claim toggle), contact settings</name>
  <files>Moxic.Admin/src/pages/LuckySpin.tsx, Moxic.Admin/src/pages/LuckySpinPrizes.tsx, Moxic.Admin/src/pages/LuckySpinCodes.tsx, Moxic.Admin/src/pages/LuckySpinHistory.tsx, Moxic.Admin/src/pages/ContactSettings.tsx, Moxic.Admin/src/App.tsx</files>
  <action>
Follow the existing admin style exactly: plain fetch via apiFetch(apiUrl("/api/admin/...")) from ../lib/api (do NOT modify lib/api.ts), steam-* Tailwind tokens, lucide-react icons, error banner pattern from TagList.tsx (read `err.error` from the JSON body), form styling from PaymentConfig.tsx. Use the exact endpoint contracts from the interfaces block. Prize type labels: Luck = "Chúc may mắn", Discount = "Giảm giá", Game = "Game".

LuckySpin.tsx: page header "Lucky Spin" and three tabs "Giải thưởng" / "Mã quay" / "Lịch sử quay" driven by the `tab` query param (useSearchParams, default prizes) rendering LuckySpinPrizes, LuckySpinCodes, LuckySpinHistory. Tabs must wrap/scroll horizontally on mobile.

LuckySpinPrizes.tsx (per CONTEXT "Prize types" and "Odds"): table/list of AdminPrize (display order, thumbnail = imageUrl for Game prizes else a Clover icon for Luck / TicketPercent icon for Discount, name, type badge, rarity chip colored with the interfaces rarity colors, probability shown as "12.50%", active toggle that PUTs the full prize with isActive flipped, edit, delete with window.confirm). Above the list a total bar: "Tổng tỉ lệ (giải đang bật): X% / 100%" — green when exactly 100.00, otherwise an amber warning banner "Tổng tỉ lệ các giải đang bật phải bằng 100%. Vòng quay đang bị khóa cho tới khi chỉnh đúng." Create/edit form (inline panel): type select; for Game a searchable game picker using GET game-options?search= with ~300ms debounce; name input (required for Discount with placeholder "Giảm 10%", optional for Luck/Game with placeholder showing the default); probability number input step 0.01 min 0.01 max 100; display order; active checkbox. Before submitting compute the resulting active total (excluding the edited prize's old value) and block with an inline error when it would exceed 100; still display server 400 messages. Show a live preview "Tổng sau khi lưu: Y%".

LuckySpinCodes.tsx (per CONTEXT "Spin codes"): generate panel with count (default 1, max 500), maxUses (default 1), optional expiry via datetime-local converted with new Date(value).toISOString() (omit when blank), optional note; after success show the returned codes in a read-only monospace textarea (one per line) plus a "Copy tất cả" button using navigator.clipboard.writeText. List: search box (uppercased), table with code (monospace + per-row copy button), "usedCount/maxUses", expiresAt (toLocaleString("vi-VN") or "Không giới hạn"), status chip (Active green, UsedUp gray, Expired amber, Disabled red), note, createdAt, actions: enable/disable (PATCH) and delete (confirm). Prev/next pagination using totalCount, pageSize 50.

LuckySpinHistory.tsx (per CONTEXT "Spin history"): filter select (Tất cả / Chưa trao / Đã trao mapping to claimed omitted/false/true), search box placeholder "Tìm theo mã quay hoặc mã thưởng", table: time, codeText, prize name + type badge, rewardCode (monospace, "—" for Luck), clientIp, claimed state with a toggle button "Đánh dấu đã trao" / "Hoàn tác" (PATCH claim) — hidden for Luck rows; claimedAt. Pagination as above. On narrow screens wrap the table in overflow-x-auto.

ContactSettings.tsx (per CONTEXT "Contact buttons"): form with three inputs — Messenger URL (placeholder "https://m.me/tenfanpage"), Zalo (helper: "Nhập link Zalo hoặc số điện thoại — số điện thoại sẽ tự chuyển thành https://zalo.me/{số}"), Phone number (helper: "Hiển thị nút gọi tel:"); note "Để trống để ẩn nút tương ứng trên website". Load with GET, save with PUT, show success message and server 400 errors.

App.tsx (minimal Edit insertions — file has user changes): add Gift and MessageCircle to the existing lucide-react import, import LuckySpin and ContactSettings (lazy like OrderList is fine), append navItems entries { to: "/lucky-spin", label: "Lucky Spin", icon: Gift } and { to: "/contact-settings", label: "Contact", icon: MessageCircle }, and add two Route elements for those paths. The mobile bottom nav already uses flex-1/min-w-0/truncate, so 7 items fit; do not restructure it.

Run `npm run build` in Moxic.Admin (tsc -b strict + vite). Commit with explicit paths: the five new pages + Moxic.Admin/src/App.tsx; message "feat(quick-261103-qmv): admin lucky spin + contact settings pages".
  </action>
  <verify>
    <automated>cd /c/Users/trung/OneDrive/Documents/project-moxic/Moxic.Admin && npm run build && grep -q "/lucky-spin" src/App.tsx && grep -q "/contact-settings" src/App.tsx && grep -q "api/admin/lucky-spin/codes/generate" src/pages/LuckySpinCodes.tsx && grep -q "/claim" src/pages/LuckySpinHistory.tsx && grep -q "api/admin/contact-settings" src/pages/ContactSettings.tsx && grep -q "100" src/pages/LuckySpinPrizes.tsx && echo OK</automated>
  </verify>
  <done>Admin build passes; sidebar/bottom nav show "Lucky Spin" and "Contact"; prizes tab shows the active total with a warning when it is not 100% and blocks saves above 100%; codes tab generates N codes with copy-all and lists usage/status with disable/delete; history tab lists spins with search, claimed filter and claim toggle; contact page saves Messenger/Zalo/Phone; committed with explicit paths.</done>
</task>

<task type="auto">
  <name>Task 3: Storefront — home banner + /lucky-spin page with CS2-style reel (desktop + mobile) and floating contact buttons</name>
  <files>Moxic.Web/src/lib/luckySpinApi.ts, Moxic.Web/src/hooks/useLuckySpin.ts, Moxic.Web/src/components/lucky-spin/PrizeCard.tsx, Moxic.Web/src/components/lucky-spin/CaseReel.tsx, Moxic.Web/src/pages/LuckySpinPage.tsx, Moxic.Web/src/components/home/LuckySpinBanner.tsx, Moxic.Web/src/components/layout/FloatingContact.tsx, Moxic.Web/src/App.tsx, Moxic.Web/src/pages/HomePage.tsx, Moxic.Web/src/components/layout/AppLayout.tsx</files>
  <action>
Do NOT modify Moxic.Web/src/lib/api.ts, src/types/game.ts or src/index.css (user-modified). All Vietnamese copy. Existing dark tokens (bg-bg-base, bg-bg-surface, text-text-primary, font-display, accent) plus the CS2 purple/pink palette below.

luckySpinApi.ts: its own axios instance mirroring lib/api.ts (baseURL import.meta.env.VITE_API_URL || "/api", withCredentials true); export types SpinPrizeType, Rarity, PublicPrize, LuckySpinPrizesResponse, SpinResult, ContactSettings exactly per the interfaces block; functions getLuckySpinPrizes (GET /lucky-spin/prizes), spinWithCode(code) (POST /lucky-spin/spin), getContactSettings (GET /contact-settings). useLuckySpin.ts: React Query hooks useLuckySpinPrizes (staleTime 60s), useSpin (useMutation), useContactSettings (staleTime 5 min), plus a helper getSpinErrorMessage(err) mapping axios errors: 429 -> "Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.", otherwise response.data.error, fallback "Không thể quay lúc này, vui lòng thử lại."

PrizeCard.tsx (per CONTEXT discretion "Prize card visuals"): export RARITY_COLORS (interfaces colors) and RARITY_LABELS (Phổ thông / Hiếm vừa / Hiếm / Cực hiếm / Huyền thoại) and a PrizeCard component with size prop ("reel" | "large"): dark card (gradient #241b3a -> #15101f), Game prizes show the cover image (object-cover, draggable false, decoding async), Luck shows a Clover icon, Discount shows a TicketPercent icon over a soft rarity-tinted radial glow; name clamped to 2 lines; 4px bottom bar in the rarity color plus a faint rarity glow rising from the bottom (CS2 look). Reel size: fixed width 104px on mobile, 160px from md up, with consistent height.

CaseReel.tsx (per CONTEXT "Odds": client only animates to the server result, winning card at a fixed index): props idleItems (PublicPrize[]), and an imperative ref API spin(result) returning a Promise resolved when the reel has stopped (useImperativeHandle). Visuals per CONTEXT reference: outer wrapper with a purple glow via filter drop-shadow (box-shadow is clipped by clip-path), panel with an angled/hexagonal frame using clip-path polygon with ~20px chamfered corners (a 1px gradient "border" achieved by an outer clipped layer in #a855f7/#ec4899 and an inner clipped layer inset 1px), background radial-gradient #3b1d6e -> #1a0d33 -> #0d0718; reel viewport overflow-hidden with a horizontal edge fade via mask-image linear-gradient (transparent -> black 12% -> black 88% -> transparent); a 2px pink (#ec4899) vertical center line with glow plus pink CSS-border triangles at the top (pointing down) and bottom (pointing up) of the center line, above the cards (z-index). Idle state: idleItems repeated to ~20 cards, static. Spin algorithm: set the track items to result.reel and wait for layout (two requestAnimationFrame) then preload the distinct image URLs with new Image() (cap the wait at ~1.5s); measure stride as cards[1].offsetLeft - cards[0].offsetLeft, cardWidth as cards[0].offsetWidth and viewport width; random landing offset = (Math.random()*0.7 - 0.35)*cardWidth (cosmetic, per CONTEXT discretion so it does not always stop dead center); targetX = viewportWidth/2 - (result.winningIndex*stride + cardWidth/2 + offset). Animate ONLY transform using the Web Animations API (trackEl.animate from translate3d(0,0,0) to translate3d(targetX px,0,0), duration 6500ms, easing "cubic-bezier(0.08, 0.6, 0.1, 1)", fill "forwards"), set will-change: transform only while animating, await animation.finished, then write the final transform to style and cancel the animation. Use WAAPI rather than a CSS transition because index.css forces transition-duration 0s !important under prefers-reduced-motion, which would make transitionend never fire; instead, when matchMedia("(prefers-reduced-motion: reduce)") matches use a 1200ms duration. After stopping, highlight the winning card (scale 1.06 + rarity-colored glow). Keep the landed position correct on resize: store winningIndex + offset fraction and recompute the transform without animation on window resize when not animating. Reset to translate 0 instantly before every new spin.

LuckySpinPage.tsx (route /lucky-spin): title "Vòng Quay May Mắn" (font-display), subtitle explaining that a spin code is required; CaseReel fed by useLuckySpinPrizes; if available is false show "Vòng quay đang được cập nhật, vui lòng quay lại sau." and disable input. Code form: input auto-uppercased, prefilled from the ?code= query param, maxLength 32, button "Mở hòm" full-width on mobile; disabled while the mutation is pending or the reel is animating (prevents double submit). On success await reelRef.spin(result) then open the result modal; on error toast.error(getSpinErrorMessage(err)) using react-hot-toast (Toaster already mounted). Result modal (fixed inset-0 z-50, Escape/backdrop closes): large PrizeCard with a rarity glow; Luck -> "Chúc bạn may mắn lần sau!"; Discount/Game -> "Chúc mừng! Bạn đã trúng {name}", the rewardCode in a monospace box with a copy button (navigator.clipboard, toast "Đã sao chép"), and the instruction "Lưu lại mã thưởng và liên hệ Moxic qua Zalo hoặc Messenger để nhận quà." plus Messenger/Zalo buttons from useContactSettings when configured (per CONTEXT: no coupon system and no auto 0đ order — user contacts admin). Show "Mã của bạn còn N lượt quay" when remainingUses > 0 (keep the code in the input) else clear the input. Below the reel a "Vật phẩm trong hòm" grid of the prize cards (rarity color only, never percentages).

LuckySpinBanner.tsx: uses useLuckySpinPrizes and renders null unless available; CS2-styled purple banner (same chamfered clip-path idea, smaller) with title "Vòng Quay May Mắn", copy "Nhập mã quay để mở hòm — cơ hội nhận game Xbox miễn phí và mã giảm giá", a fanned preview of up to 5 prize cards ordered rarest first (hidden or reduced to 3 on mobile), and a Link "Mở hòm ngay" to /lucky-spin. Responsive: stacked on mobile, side-by-side from md.

FloatingContact.tsx (per CONTEXT "Contact buttons"): uses useContactSettings; renders nothing if all values are null. Fixed bottom-right (right-4 bottom-4, md:right-6 md:bottom-6, z-40 so the CartDrawer z-50 and modals cover it). When useMatch("/games/:id") matches, use bottom-24 below lg to clear the GameDetailPage sticky buy bar (fixed bottom-0 lg:hidden). Vertical stack (top to bottom): Phone, Zalo (secondary, shown only when expanded), Messenger (always visible when configured), then the toggle. Toggle: 44px round button with a lucide Plus icon that rotates 45 degrees into an "x" when open (transition-transform 300ms), aria-expanded, aria-label "Mở thêm liên hệ" / "Thu gọn"; render the toggle only when at least one secondary button is configured. Secondary buttons animate opacity/translate-y/scale with a small stagger and are aria-hidden + tabIndex -1 + pointer-events-none when collapsed. Messenger: 52px circle with gradient #0099FF -> #A033FF -> #FF5280 and an inline SVG Messenger glyph (lucide 1.x has no brand icons — use inline SVG), subtle animate-ping ring; Zalo: #0068FF circle with an inline SVG or bold white "Zalo" wordmark; Phone: emerald circle with lucide Phone icon, href phoneHref. Messenger/Zalo use target _blank rel "noopener noreferrer". Desktop-only hover label pill to the left of each button ("Chat Messenger", "Chat Zalo", "Gọi {phoneNumber}"). Close on Escape and on route change (useLocation).

Wiring (minimal edits): App.tsx add a lazy LuckySpinPage and a Route path "/lucky-spin" inside the AppLayout route; HomePage.tsx render the banner inside a Container with mt-14 between HeroSplash and the DiscoverySection container; AppLayout.tsx render a single FloatingContact after the Footer.

Run `npm run build` in Moxic.Web. Commit with explicit paths (7 new files + 3 edited); message "feat(quick-261103-qmv): storefront lucky spin reel + floating contact buttons". In SUMMARY add a short manual QA checklist for the user: desktop + 375px mobile reel stop alignment, reduced-motion behavior, floating buttons expand/collapse, game-detail page offset.
  </action>
  <verify>
    <automated>cd /c/Users/trung/OneDrive/Documents/project-moxic/Moxic.Web && npm run build && grep -q "lucky-spin" src/App.tsx && grep -q "<LuckySpinBanner" src/pages/HomePage.tsx && grep -q "<FloatingContact" src/components/layout/AppLayout.tsx && grep -q "\.animate(" src/components/lucky-spin/CaseReel.tsx && grep -q "winningIndex" src/components/lucky-spin/CaseReel.tsx && grep -q "lucky-spin/spin" src/lib/luckySpinApi.ts && grep -q "contact-settings" src/lib/luckySpinApi.ts && grep -q "aria-expanded" src/components/layout/FloatingContact.tsx && echo OK</automated>
  </verify>
  <done>Web build passes; home page shows the banner only when the prize pool is valid; /lucky-spin spins only after a server 200, animates ~6.5s (1.2s with reduced motion) and stops with reel[winningIndex] under the pink marker at both mobile and desktop widths, then shows the result modal with reward code + contact buttons; floating Messenger + "+" appears bottom-right, expands to Zalo/Phone with "+" rotating to "x", hides unconfigured buttons, and clears the sticky buy bar on game detail; committed with explicit paths.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser -> POST /api/lucky-spin/spin | Untrusted code input; attacker may race or brute-force codes |
| browser -> GET public endpoints | Anonymous read of prize list and contact links |
| admin browser -> /api/admin/* | Cookie-authenticated admin writes (prizes, codes, contact links rendered as hrefs on the storefront) |
| nginx -> API | X-Real-IP header used for rate-limit partitioning |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-qmv-01 | Tampering | Spin outcome | mitigate | Winner chosen server-side in LuckySpinRules.PickWeighted with RandomNumberGenerator.GetInt32; client only animates to reel[winningIndex]; verify gate forbids System.Random in LuckySpinRules |
| T-qmv-02 | Tampering | SpinCodes redemption (double-spend race) | mitigate | Single conditional ExecuteUpdateAsync (IsActive AND UsedCount < MaxUses AND not expired) inside a transaction; PostgreSQL re-evaluates the predicate under the row lock; optional 5-way concurrent smoke test |
| T-qmv-03 | Spoofing | Code brute force | mitigate | 10-char codes over a 31-symbol alphabet (~8e14 space) + fixed-window limiter 10 req/min/IP on the spin action returning 429 |
| T-qmv-04 | Tampering (XSS) | Contact links rendered as href | mitigate | Admin PUT accepts only absolute http/https URLs or phone patterns; public GET returns server-resolved zalo.me/tel: hrefs; React escapes text; external links use rel noopener noreferrer |
| T-qmv-05 | Elevation of Privilege | Admin lucky-spin/contact endpoints | mitigate | [Authorize(Roles = "Admin")] on both admin controllers (verify gate greps it) |
| T-qmv-06 | Information Disclosure | Public prize list | mitigate | PublicPrize DTO omits probability and IsActive=false prizes; only rarity tier exposed |
| T-qmv-07 | Repudiation | Reward claims | mitigate | Every spin persisted in SpinHistories with unique RewardCode, CodeText, ClientIp, CreatedAt; admin searches by reward code and marks claimed before handing out a prize |
| T-qmv-08 | Denial of Service | Code generation / spin endpoint | mitigate | Generate count capped at 500 and maxUses at 1000; fixed ReelLength 50; spin rate-limited |
| T-qmv-09 | Spoofing | X-Real-IP header when API is hit directly (bypassing nginx) | accept | Production API is behind nginx which overwrites X-Real-IP with $remote_addr; code space makes brute force impractical even without per-IP limits |
| T-qmv-SC | Tampering | Package installs | accept | No new npm/NuGet packages: rate limiting and RandomNumberGenerator are in the .NET shared framework; frontend uses existing axios/react-query/lucide/react-hot-toast |
</threat_model>

<verification>
- `dotnet build API/Moxic.Api/Moxic.Api.csproj` succeeds; migration *_AddLuckySpinAndContactSettings.cs exists; snapshot contains SpinPrize/SpinCode/SpinHistory/ContactSetting.
- `npm run build` succeeds in Moxic.Admin and Moxic.Web (or, if a baseline already failed, no new errors originate from files touched by this plan).
- Optional runtime smoke (only if Postgres already reachable): 5 concurrent spins on a MaxUses=1 code -> exactly one 200; history shows one row; GET /api/contact-settings returns 200 with nulls when unset; spin with active total != 100 returns 503 without incrementing UsedCount.
- `git status --short` after the last commit still lists all pre-existing user modifications; no stash/revert happened; no build/log artifacts were committed.
</verification>

<success_criteria>
- All CONTEXT decisions implemented: Prize types (Luck/Discount/Game, reward codes, no coupon system, no auto order, claim toggle), Odds (admin % with 100% warning/block, server CSPRNG decides, cosmetic filler, fixed winning index), Spin codes (single/bulk, MaxUses, expiry, list/disable/delete, atomic redemption, unambiguous uppercase charset, case-insensitive, rate limit), Spin history (recorded + admin list + claim), Contact buttons (admin config, empty hidden, zalo.me/tel: resolution, public GET via React Query, collapsed Messenger + "+" expanding to 3 with "+" -> "x").
- Discretion choices documented in SUMMARY: ContactSetting entity (not PaymentConfig), ~6.5s cubic-bezier WAAPI animation with random in-card offset, banner on HomePage + /lucky-spin route, rarity tiers/colors from probability.
- Three atomic commits with explicit paths; builds pass.
</success_criteria>

<output>
Create `.planning/quick/261103-qmv-lucky-spin-case-opening-and-floating-con/261103-qmv-SUMMARY.md` when done (do NOT commit it — the orchestrator commits docs). Include: baseline build results, generated migration name and whether it also captured GameReviews drift, smoke-test outcome or skip reason, the list of shared files committed together with pre-existing user changes, discretion choices, and the manual QA checklist.
</output>
