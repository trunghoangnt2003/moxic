---
phase: quick-261103-sls
plan: 01
subsystem: lucky spin cases, loyalty points, case music, live drops (API + admin SPA + storefront)
tags: [lucky-spin, cases, loyalty-points, ledger, csprng, near-miss, music, live-feed, rate-limiting, minio]
requires: [quick-261103-qmv, quick-261103-sa8]
provides:
  - "SpinCase (Code / FreeInterval / Points) with per-case prizes + codes; default 'Hòm mã quay' holds the v1 pool"
  - "PointsTransactions ledger, PointsService (order award once, atomic spend, admin adjust), Game.RewardPoints, Order.PointsAwardedAt"
  - "Public: GET /api/lucky-spin/cases, /cases/{slug}, POST /cases/{slug}/open, GET /code-lookup, /music, /live-drops; GET /api/account/points"
  - "Admin: /api/admin/lucky-spin/cases (CRUD + image), per-case prizes/codes, /api/admin/customers (+points), /api/admin/spin-music"
  - "Storefront: /lucky-spin gallery, /lucky-spin/:slug case page, /account/points, LIVE strip, case music, navbar points"
affects: [Program.cs, AdminOrdersController.UpdateOrderStatus, AdminGamesController, MoxicDbContext + snapshot, admin App.tsx/GameForm, storefront App.tsx/Navbar]
tech-stack:
  added: []
  patterns:
    - "Conditional upsert INSERT ... ON CONFLICT DO UPDATE ... WHERE LastOpenedAt <= threshold for per-user cooldowns"
    - "Conditional ExecuteUpdateAsync balance changes + append-only ledger with UNIQUE (Reason, RefId)"
    - "Server-built cosmetic reel layout + stop offset returned with the result (client only animates)"
    - "IMemoryCache.GetOrCreateAsync 5 s cache for a polled public feed"
    - "Magic-byte sniffing + server-chosen Content-Type for admin uploads"
key-files:
  created:
    - API/Moxic.Shared/Enums/SpinCaseOpenMethod.cs
    - API/Moxic.Shared/Enums/PointsReason.cs
    - API/Moxic.Core/Entities/SpinCase.cs
    - API/Moxic.Core/Entities/SpinCaseCooldown.cs
    - API/Moxic.Core/Entities/PointsTransaction.cs
    - API/Moxic.Core/Entities/SpinMusicTrack.cs
    - API/Moxic.Infrastructure/Data/LuckySpinCasesSchemaBootstrap.cs
    - API/Moxic.Infrastructure/Data/Migrations/20261103135633_AddSpinCasesPointsMusic.cs
    - API/Moxic.Infrastructure/Data/Migrations/20261103135633_AddSpinCasesPointsMusic.Designer.cs
    - API/Moxic.Api/Services/PointsService.cs
    - API/Moxic.Api/Services/SpinUserRateLimiter.cs
    - API/Moxic.Api/Services/MediaSniffer.cs
    - API/Moxic.Api/Models/LuckySpinDtos.cs
    - API/Moxic.Api/Models/AdminSpinDtos.cs
    - API/Moxic.Api/Controllers/LuckySpinFeedController.cs
    - API/Moxic.Api/Controllers/AccountPointsController.cs
    - API/Moxic.Api/Controllers/AdminSpinCasesController.cs
    - API/Moxic.Api/Controllers/AdminCustomersController.cs
    - API/Moxic.Api/Controllers/AdminSpinMusicController.cs
    - Moxic.Admin/src/lib/luckySpinAdmin.ts
    - Moxic.Admin/src/pages/LuckySpinCases.tsx
    - Moxic.Admin/src/pages/Customers.tsx
    - Moxic.Admin/src/pages/SpinMusic.tsx
    - Moxic.Web/src/hooks/useCaseMusic.ts
    - Moxic.Web/src/components/lucky-spin/CaseCard.tsx
    - Moxic.Web/src/components/lucky-spin/LiveDropsBar.tsx
    - Moxic.Web/src/components/lucky-spin/ResultModal.tsx
    - Moxic.Web/src/pages/LuckySpinGalleryPage.tsx
    - Moxic.Web/src/pages/PointsHistoryPage.tsx
  modified:
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
    - API/Moxic.Api/Controllers/AdminGamesController.cs
    - API/Moxic.Api/Models/Dtos.cs
    - API/Moxic.Api/Program.cs
    - Moxic.Admin/src/App.tsx
    - Moxic.Admin/src/pages/GameForm.tsx
    - Moxic.Admin/src/pages/LuckySpin.tsx
    - Moxic.Admin/src/pages/LuckySpinPrizes.tsx
    - Moxic.Admin/src/pages/LuckySpinCodes.tsx
    - Moxic.Admin/src/pages/LuckySpinHistory.tsx
    - Moxic.Web/src/lib/luckySpinApi.ts
    - Moxic.Web/src/hooks/useLuckySpin.ts
    - Moxic.Web/src/lib/accountApi.ts
    - Moxic.Web/src/hooks/useAccount.ts
    - Moxic.Web/src/hooks/useCountdown.ts
    - Moxic.Web/src/components/lucky-spin/CaseReel.tsx
    - Moxic.Web/src/pages/LuckySpinPage.tsx
    - Moxic.Web/src/components/home/LuckySpinBanner.tsx
    - Moxic.Web/src/components/layout/Navbar.tsx
    - Moxic.Web/src/App.tsx
decisions:
  - "Default case 'Hòm mã quay' has fixed id ...0001 / slug hom-ma-quay and is only created while v1 orphans exist"
  - "RewardPoints are read at completion time (not snapshotted at checkout)"
  - "Reel: 60 cards, winner at 52; cosmetic weights common 10 / uncommon 12 / rare 15 / epic 18 / legendary 20"
  - "Near-miss when a Luck or common/uncommon prize wins and a rare-or-better non-Luck teaser exists; stop offset 0.30-0.45 card toward the best teaser"
  - "Client IP: CF-Connecting-IP -> first X-Forwarded-For hop -> socket (all IPAddress-validated); X-Real-IP dropped"
  - "Per-user limiter 8 opens/min for FreeInterval/Points on top of the 10/min/IP policy"
  - "Music: fade in 300 ms to volume 0.55, fade out 1800 ms then pause; result modal 350 ms after the reel stops"
  - "Live drops: 10 s delay, 5 s server cache, 8 s client poll, WOW = epic/legendary"
metrics:
  duration: "~24 min"
  started: "2026-11-03T13:54:37Z"
  completed: "2026-11-03T14:18:17Z"
  tasks: 3
  files: 59
---

# Phase quick-261103-sls Plan 01: Multiple Cases, Loyalty Points, Case Music, Near-miss Reel & Live Drops Summary

Lucky spin v1 had one global prize pool. It now supports any number of cases ("hòm"), each opened by a spin code, by a free open every N hours per verified account, or by spending loyalty points. Each case has its own prize list that must total 100% and, for Code cases, its own codes. Completed orders credit points exactly once into a ledger. Customers see their balance and history, and admins can list customers and adjust points.

The reel now shows every prize of the case through cosmetic, rarity-biased filler. It teases near-misses next to common wins and lands on a stop offset the server picks. The outcome is still decided only by the server CSPRNG. A LIVE strip shows real, name-masked recent wins, and case pages play admin-uploaded music.

## Commits

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | Backend core: cases model, bootstrap + migration, points service/award, open flow, near-miss reel, live drops + music feed, IP fix | 55adce0 |
| 2 | Admin vertical: case CRUD + image, customers/points, music library, per-case prizes/codes/history, GameForm RewardPoints | dd6fece |
| 3 | Storefront: gallery, case page, reel, music, LIVE strip, navbar points, /account/points | d083bc0 |

## Baseline builds (before any edit)

- `dotnet build API/Moxic.slnx`: PASS with 0 errors and 8 warnings. All 8 are the existing NU1902/NU1903 warnings for System.Security.Cryptography.Pkcs 10.0.0.
- `npm run build` in Moxic.Web: PASS
- `npm run build` in Moxic.Admin: PASS

**After all tasks:** identical. 0 errors, the same 8 NU190x warnings, and both SPAs build (`tsc -b && vite build`). `oxlint` on all 16 touched storefront files exits 0 with no findings.

## Migration

- I generated `20261103135633_AddSpinCasesPointsMusic` with `dotnet ef migrations add` and kept EF's output as is. **There was no drift.** `dotnet ef migrations script AddCustomerAccounts AddSpinCasesPointsMusic` contains only this task's objects: 11 columns, 4 tables, 8 indexes and 3 FKs. Names and types match the expected DDL in the plan.
- **Do not apply this migration to a populated database as it stands.** EF adds `SpinPrizes.CaseId` / `SpinCodes.CaseId` as `NOT NULL DEFAULT '0000…'`, and with no case row behind that id the FK would fail. The migration exists for the model snapshot. At runtime, `EnsureCreated` plus the bootstrap do the upgrade, the same way as in qmv and sa8.

## Bootstrap / data migration

`LuckySpinCasesSchemaBootstrap.EnsureAsync` runs in Program.cs right after `CustomerAccountSchemaBootstrap.EnsureAsync`. It is three `ExecuteSqlRawAsync` calls with no curly braces anywhere in the SQL:

- **Part A**
  - Creates `SpinCases` and its unique slug index.
  - Adds columns with `ADD COLUMN IF NOT EXISTS`.
  - Inserts the default case `Hòm mã quay` (id `00000000-0000-0000-0000-000000000001`, slug `hom-ma-quay`, Code, active, order 0), but **only while v1 orphans exist**: prizes or codes with a NULL CaseId, or history rows with a NULL CaseName. A fresh database therefore never gets it, and if an admin deletes it later it is not recreated.
  - Moves orphan prizes, codes and history into that case. History gets CaseName `Hòm mã quay` and OpenMethod `Code`.
  - Backfills `SpinHistories.Rarity` from the linked prize's current probability, using the same thresholds as `RarityFor`.
  - Sets `CaseId` to NOT NULL on prizes and codes.
- **Part B:** a single `DO $EF$` block that adds the 3 FKs only if they don't exist (`pg_constraint` check).
- **Part C:** indexes plus the `SpinCaseCooldowns`, `PointsTransactions` and `SpinMusicTracks` tables. Each is `IF NOT EXISTS`.

**Safe to re-run.** Every statement is guarded. The UPDATEs only touch rows that are still NULL, and `SET NOT NULL` / `CREATE ... IF NOT EXISTS` do nothing the second time. Npgsql sends each part as one batch, which runs as a single implicit transaction, so a failure in Part A leaves nothing half-applied.

**Nothing is lost.** Every v1 prize, code and history row keeps its id and data and only gains a CaseId and snapshot fields. History rows whose prize was deleted keep `Rarity = NULL`; the live feed treats those as `common`.

## Smoke test

**Skipped: DB not reachable.** Nothing was listening on localhost:5432 or on MinIO :9000. As the plan instructs, I did not start any containers. The bootstrap, open flow, award, feed and uploads are covered only by code review and the builds. Use the manual QA checklist below.

## Shared files touched (targeted edits only)

- **Program.cs** (BOM kept, +6 lines): `AddMemoryCache`, `AddScoped<PointsService>`, `AddSingleton<SpinUserRateLimiter>`, and the bootstrap call. The garbled comments are untouched.
- **AdminOrdersController.cs** (BOM kept, +17/−2): `PointsService` is injected. The status save is now wrapped in `BeginTransactionAsync`, and when the new status is `Completed` it calls `AwardForCompletedOrderAsync` and logs the amount, then commits **before** the email is enqueued. Every garbled string is byte-identical; the diff has only these hunks.
- **MoxicDbContext.cs** (BOM kept): 4 DbSets plus configs. The lowercase `aspnet*` ToTable lines are untouched.
- **AdminGamesController.cs / Models/Dtos.cs** (BOM kept): `RewardPoints`, validated to 0..1,000,000.
- **Admin App.tsx / GameForm.tsx** (BOM kept): Khách hàng and Kho nhạc nav items and lazy routes. The mobile bottom nav scrolls horizontally (`flex-none min-w-[64px]`) so all 9 items fit. GameForm has the RewardPoints field.
- **Storefront App.tsx:** `/lucky-spin` is the gallery, `/lucky-spin/:slug` the case page, and `/account/points` sits under `RequireCustomer`.
- **Navbar.tsx:** a gold points chip on the account button (lg and up), a points line and "Điểm thưởng" item in the dropdown, and the same in the mobile menu.
- **accountApi.ts / useAccount.ts** (additive): `getMyPoints`, `POINTS_REASON_LABELS`, `useMyPoints`, and `POINTS_QUERY_KEY`, which is cleared on logout.
- Working-copy EOL is irrelevant to commits (`core.autocrlf=true`, the index is LF). BOMs on Program.cs, AdminOrdersController.cs, MoxicDbContext.cs, Dtos.cs, AdminGamesController.cs, GameForm.tsx and admin App.tsx were checked after each edit.

## Discretion choices

- **IP extraction (T-sls-05):** `CF-Connecting-IP`, then the first `X-Forwarded-For` hop, then the socket address (IPv4-mapped addresses are unmapped). Every value must pass `IPAddress.TryParse`. `X-Real-IP` is no longer read. sa8's `customer-auth` limiter uses the same helper, so it benefits too.
  - **Residual risk:** a request that reaches the origin directly, bypassing Cloudflare, can forge `CF-Connecting-IP`. Ops should restrict origin ingress (the Caddy host firewall) to Cloudflare IP ranges.
- **Per-user limiter:** `SpinUserRateLimiter` allows 8 opens per minute per user for FreeInterval and Points cases. It is checked after authentication because the rate-limit policy only sees the default scheme.
- **Cosmetic reel:** 60 cards with the winner at index 52.
  - A coverage pass places every distinct prize once in slots 4..49.
  - The rest is filled by cosmetic weight (common 10, uncommon 12, rare 15, epic 18, legendary 20), re-rolling up to 3 times to avoid three identical cards in a row.
  - Real odds drive only `PickPrize`.
- **Near-miss:** triggers when the win is Luck or common/uncommon and a non-Luck teaser exists that is rare or better and rarer than the winner.
  - The best-ranked teaser A goes on a random side (±1) and a random teaser on the other side.
  - `stopOffset` is `side × 0.300..0.450` card widths, which is 5–20% from the edge next to A. Otherwise it is a random value in ±0.35.
  - Every random choice uses `RandomNumberGenerator`; there is no System.Random anywhere.
- **Animation:** 7.6 s with `cubic-bezier(0.05, 0.85, 0.15, 1)`. The client clamps the server offset to ±0.48 and no longer picks a random landing point. The 1.2 s reduced-motion shortcut, resize re-landing and image preload are kept.
- **Music timings:** fade in over 300 ms to volume 0.55, fade out over 1800 ms with rAF and then pause (on iOS, which ignores volume, the pause still stops it). The result modal opens 350 ms after the reel stops. Mute is stored in `moxic:case-music-muted`, wrapped in try/catch.
- **RewardPoints** are read when the order completes, not snapshotted at checkout. If an admin changes a game's points, the new value applies to orders completed afterwards.
- **Live drops:** wins younger than 10 s are hidden so the feed never spoils a reel that is still spinning. Server cache is 5 s and the client polls every 8 s, only while the tab is visible. WOW shows the latest epic/legendary wins (by the stored Rarity snapshot). Masked names use text elements ("trung" becomes "tr***g"); guests or users without a profile show as "Khách".
- **Discount prizes stay generic.** `ApplyPrizeAsync` keeps the per-type switch, and the only change is the per-case total. There are no Discount-specific columns, which leaves room for 261103-smv coupons.
- **Points-award customer resolution:** `Order.CustomerId` when that user exists, is verified and has the Customer role. Otherwise the verified Customer whose email equals the trimmed Xbox email. No match means no credit and no ledger row.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness] Race-safe CustomerProfile creation**
- **Found during:** Task 1 (PointsService)
- **Issue:** The planned "insert the profile when it is missing" step could race with a concurrent award, adjust or register for the same user and fail on the PK.
- **Fix:** `EnsureProfileAsync` uses `INSERT ... ON CONFLICT ("UserId") DO NOTHING`, parameterized through `ExecuteSqlAsync`.
- **Files:** API/Moxic.Api/Services/PointsService.cs
- **Commit:** 55adce0

**2. [Rule 2 - Correctness] Customer list ordering with missing profiles**
- **Issue:** PostgreSQL sorts NULLs first for `DESC`, so customers without a profile would have topped the "newest" sort.
- **Fix:** Order by `CreatedAt == null`, then `CreatedAt desc`, then email.
- **Files:** API/Moxic.Api/Controllers/AdminCustomersController.cs
- **Commit:** dd6fece

**3. [Rule 2 - UX/correctness] Admin history search accepts emails**
- **Issue:** The v1 search box upper-cased its input, which works for codes but not for the new email search.
- **Fix:** The input is no longer forced to upper case. The server upper-cases for code matches and lower-cases for email matches.
- **Files:** Moxic.Admin/src/pages/LuckySpinHistory.tsx
- **Commit:** dd6fece

**4. [Addition] Create-case modal switches to edit mode after save**
- After creating a case, the modal stays open in edit mode so the admin can upload the cover image straight away. Images can only be uploaded once the case id exists.

**5. [Addition] Storefront unverified-viewer state**
- If the API treats the caller as logged in but unverified, the case page shows "Xác minh email để mở hòm". In practice sa8 never issues a cookie to an unverified user, so this is only a defensive path.

**6. [Default tab] Admin Lucky Spin now opens on "Hòm"**
- Old `?tab=prizes|codes|history` links still work. With no `?case=`, the first case is selected.

Everything else was implemented as planned.

## Threat model coverage

| Threat | How it is covered |
| ------ | ----------------- |
| T-sls-01 | The winner comes only from `PickPrize` (CSPRNG). The request body is `{ code? }`. The reel and `stopOffset` are built after the draw. No `System.Random`, and no `Math.random` in CaseReel (verify gate). |
| T-sls-02 | `Points >= cost` conditional UPDATE inside the open transaction, with the ledger row in the same transaction. |
| T-sls-03 | PK (UserId, CaseId) plus a conditional `ON CONFLICT ... WHERE LastOpenedAt <= threshold`, inside the transaction. A rollback restores the previous state. |
| T-sls-04 | `PointsAwardedAt == null` claim plus UNIQUE (Reason, RefId), both inside the status-change transaction. |
| T-sls-05 | IP order above. X-Real-IP dropped. Per-user limiter. Residual origin-bypass risk noted. |
| T-sls-06 | Admin-only endpoints, extension allowlist, `MediaSniffer` magic bytes, server-chosen Content-Type, 10 MB audio (`RequestSizeLimit` 12 MB) / 5 MB images, random keys. |
| T-sls-07 | `[Authorize(Roles = "Admin")]` on all admin controllers. Customer endpoints use the MoxicCustomer scheme and Customer role. |
| T-sls-08 | The LiveDrop projection excludes email, IP, reward code and user id. Public prize data has no probability. The customer ledger DTO omits RefId and CreatedBy. |
| T-sls-09 | Ledger rows record CreatedBy (`User.Identity.Name`), a required note and BalanceAfter. There are no edit or delete endpoints for the ledger. |
| T-sls-10 | Conditional `Points >= cost` and `Points + delta >= 0`. |
| T-sls-11 | 5 s IMemoryCache. Gallery pageSize ≤ 48 with batched prize and cooldown queries. Open and code-lookup are on the IP policy. Upload size limits. |
| T-sls-12 | IP rate limit on code-lookup, which returns only the slug. |
| T-sls-13 | Wins younger than 10 s are excluded. |

## Known Stubs

None. Every new UI surface reads real API data. The live strip renders nothing when there are no real non-Luck wins yet, by design.

## Manual QA checklist

1. **v1 data:** start the API against the production-like database. "Hòm mã quay" should appear in admin → Lucky Spin → Hòm with every old prize (same %), every old code under Mã quay, and all history showing the case "Hòm mã quay · Nhập mã". Restart the API: no errors and no duplicate case.
2. **Create cases:** one each of Code, FreeInterval (e.g. 1 h) and Points (e.g. 100). Check slug auto-suggest (with Vietnamese diacritics), a duplicate slug giving 409, and image upload/remove (a renamed .txt should be rejected).
3. **Per-case 100% gate:** a case below 100% shows an amber chip and "Đang cập nhật" in the gallery, and the open call returns 503. The other cases are unaffected.
4. **Code open as guest:** `/lucky-spin` → "Có mã quay?" lands on the case with the code pre-filled. Opening works without login. A code from another case gives "Mã quay không thuộc hòm này.". The old `/lucky-spin?code=XXXX` link redirects to the case.
5. **Free open:** as a guest you see "Đăng nhập để mở miễn phí", which redirects back after login. The first open works. A second attempt is disabled with a countdown, and a forced POST returns 409 COOLDOWN. When the countdown reaches 0 the case refreshes and becomes openable.
6. **Points open:** with too few points the button is disabled ("Bạn cần thêm N điểm") and a forced POST returns 409 INSUFFICIENT_POINTS. With enough points, the balance drops by exactly the cost and the ledger shows "Mở hòm". Firing parallel requests can never take the balance below 0.
7. **Order completion:** set RewardPoints on a game, order it with the verified account's email (or while logged in), then move it Installing → Completed. Points are credited once with "Hoàn tất đơn hàng" and the order code. Calling the status endpoint again (now Completed → Completed is rejected) and racing two Installing → Completed calls never credits twice.
8. **Admin adjust:** +50 with a note appears in the customer ledger as "Điều chỉnh bởi Moxic". −(balance+1) is refused with "Số dư không đủ để trừ...". A note shorter than 2 characters is refused.
9. **Music:** upload mp3/ogg/m4a files (an 11 MB file or a renamed image should be rejected) and enable 2 tracks. On the case page, opening starts music immediately, it fades after the result, and mute persists across reloads. Repeat on iOS Safari (it should stop after the result).
10. **Reel:** on a Luck or common win, rare-or-better cards appear right next to the winner, on both sides across several opens, and the marker stops near the teaser's edge. Every prize shows up somewhere on the reel. Under reduced motion it lands in about 1.2 s.
11. **LIVE strip:** the WOW block (gold) shows epic/legendary wins, with only 1 card on mobile. New wins slide in from the left on the next poll. A win appears no earlier than about 10 s after the open. The live-drops network response contains no email, IP, userId or rewardCode. Names are masked (`tr***g` / `Khách`). On mobile the strip scrolls horizontally.
12. **Gallery paging:** with more than 24 active cases, "Xem thêm hòm" loads the next 24. The method chips and debounced search filter the list.
13. **Navbar / points page:** logged in, the navbar shows the gold points chip (≥1024px), the dropdown shows "Điểm thưởng: N" and a link, and `/account/points` shows the balance plus a paged ledger. The mobile menu has the same entries.
14. **Rate limit:** 11 rapid opens from one IP return 429. 9 rapid opens of a Points case from one account return 429 from the per-user limiter.

## Self-Check: PASSED

- All created files listed in the frontmatter exist on disk.
- Commits 55adce0, dd6fece and d083bc0 are present in `git log`.
- `git diff --diff-filter=D 78fa315 HEAD` is empty, so no files were deleted.
- The final `git status --short` shows only the `.planning/quick/` entries for sls and smv as untracked.
