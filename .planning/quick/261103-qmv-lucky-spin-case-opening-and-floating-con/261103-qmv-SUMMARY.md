---
phase: quick-261103-qmv
plan: 01
subsystem: lucky-spin, contact-settings (API + admin SPA + storefront)
tags: [lucky-spin, case-opening, csprng, rate-limiting, floating-contact, waapi]
requires: []
provides:
  - "Public GET /api/lucky-spin/prizes, POST /api/lucky-spin/spin (rate-limited, atomic redemption)"
  - "Admin /api/admin/lucky-spin/* (prizes, game-options, codes, history)"
  - "GET /api/contact-settings, GET/PUT /api/admin/contact-settings"
  - "Admin pages: Lucky Spin (3 tabs), Contact"
  - "Storefront: /lucky-spin route, home LuckySpinBanner, FloatingContact on every page"
affects: [Program.cs startup (schema bootstrap + rate limiter), MoxicDbContext, EF migrations snapshot]
tech-stack:
  added: []
  patterns:
    - "Conditional ExecuteUpdateAsync inside a transaction for atomic code redemption"
    - "RandomNumberGenerator weighted draw over basis points"
    - "Idempotent CREATE TABLE IF NOT EXISTS bootstrap alongside EnsureCreated"
    - "Web Animations API (transform-only) for the reel instead of CSS transitions"
key-files:
  created:
    - API/Moxic.Shared/Enums/SpinPrizeType.cs
    - API/Moxic.Core/Entities/SpinPrize.cs
    - API/Moxic.Core/Entities/SpinCode.cs
    - API/Moxic.Core/Entities/SpinHistory.cs
    - API/Moxic.Core/Entities/ContactSetting.cs
    - API/Moxic.Infrastructure/Data/LuckySpinSchemaBootstrap.cs
    - API/Moxic.Infrastructure/Data/Migrations/20261103123336_AddLuckySpinAndContactSettings.cs
    - API/Moxic.Infrastructure/Data/Migrations/20261103123336_AddLuckySpinAndContactSettings.Designer.cs
    - API/Moxic.Api/Services/LuckySpinRules.cs
    - API/Moxic.Api/Controllers/LuckySpinController.cs
    - API/Moxic.Api/Controllers/AdminLuckySpinController.cs
    - API/Moxic.Api/Controllers/AdminContactSettingsController.cs
    - API/Moxic.Api/Controllers/ContactSettingsController.cs
    - Moxic.Admin/src/pages/LuckySpin.tsx
    - Moxic.Admin/src/pages/LuckySpinPrizes.tsx
    - Moxic.Admin/src/pages/LuckySpinCodes.tsx
    - Moxic.Admin/src/pages/LuckySpinHistory.tsx
    - Moxic.Admin/src/pages/ContactSettings.tsx
    - Moxic.Web/src/lib/luckySpinApi.ts
    - Moxic.Web/src/hooks/useLuckySpin.ts
    - Moxic.Web/src/components/lucky-spin/PrizeCard.tsx
    - Moxic.Web/src/components/lucky-spin/CaseReel.tsx
    - Moxic.Web/src/pages/LuckySpinPage.tsx
    - Moxic.Web/src/components/home/LuckySpinBanner.tsx
    - Moxic.Web/src/components/layout/FloatingContact.tsx
  modified:
    - API/Moxic.Infrastructure/Data/MoxicDbContext.cs
    - API/Moxic.Infrastructure/Data/Migrations/MoxicDbContextModelSnapshot.cs
    - API/Moxic.Api/Program.cs
    - Moxic.Admin/src/App.tsx
    - Moxic.Web/src/App.tsx
    - Moxic.Web/src/pages/HomePage.tsx
    - Moxic.Web/src/components/layout/AppLayout.tsx
decisions:
  - "Contact settings live in a new ContactSetting singleton entity/table (not PaymentConfig)"
  - "Reel animates ~6.5s with cubic-bezier(0.08, 0.6, 0.1, 1) through WAAPI, random in-card landing offset of +/-35% of a card width; 1.2s under prefers-reduced-motion"
  - "Spin entry: banner on HomePage (only when the prize pool totals 100%) + dedicated /lucky-spin route"
  - "Rarity tier is derived server-side from probability (>25 common, >10 uncommon, >3 rare, >1 epic, else legendary); probabilities are never exposed publicly"
  - "ContactLinks validation/href helper is a static class next to AdminContactSettingsController and is shared with the public controller"
metrics:
  duration: "~15 min"
  started: "2026-11-03T12:32:16Z"
  completed: "2026-11-03T12:46:40Z"
  tasks: 3
  files: 32
---

# Phase quick-261103-qmv Plan 01: Lucky Spin (CS2-style case opening) + Floating Contact Buttons Summary

Lucky spin built end to end. Admins set up a Luck/Discount/Game prize pool with % odds that must total exactly 100%, and generate spin codes. When a customer redeems a code, one conditional `ExecuteUpdateAsync` uses it up, so a code cannot be spent twice. The server then picks the prize with a `RandomNumberGenerator` weighted draw and saves the spin to history with a unique `MX…` reward code. On the storefront, a CS2-style purple reel scrolls (Web Animations API, transform only) to the card the server chose. Floating Messenger/Zalo/Phone buttons, configured in admin, now appear on every storefront page.

## Commits

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | Backend: entities, migration, schema bootstrap, CSPRNG rules, controllers, rate limiter | 16faf61 |
| 2 | Admin SPA: Lucky Spin (prizes / codes / history) + Contact settings | 55b527a |
| 3 | Storefront: CaseReel, /lucky-spin page, home banner, FloatingContact | 876952a |

## Baseline builds (before any edit)

- `dotnet build API/Moxic.Api/Moxic.Api.csproj`: PASS (0 errors; 8 warnings, all NU1902/NU1903 for System.Security.Cryptography.Pkcs 10.0.0 that were already there)
- `npm run build` in Moxic.Admin: PASS
- `npm run build` in Moxic.Web: PASS

After all tasks, all three builds still pass with no new warnings or errors. Running oxlint on the new storefront files gives 3 `only-export-components` warnings for `PrizeCard.tsx`. The plan requires that file to export `RARITY_COLORS`/`RARITY_LABELS`, and I also export `RARITY_RANK` from it. The only effect is that fast refresh is less reliable for that file during dev.

## Migration

- Generated `20261103123336_AddLuckySpinAndContactSettings` with `dotnet ef migrations add` and left the output exactly as EF wrote it.
- **It also picked up model drift that existed before this task:** a `CreateTable` for `GameReviews`, plus renames of the Identity tables and primary keys from `AspNetX` to lowercase `aspnetx` (because of the `ToTable("aspnet…")` mappings already in MoxicDbContext). The previous snapshot had none of this. The migration is never applied at runtime (Program.cs uses `EnsureCreatedAsync`), so nothing changes in a running system today. But if anyone runs `dotnet ef database update` against an existing DB, those Identity renames will run too, so review the migration before doing that.
- DDL for the 4 new tables was copied from `dotnet ef dbcontext script` into `LuckySpinSchemaBootstrap.cs` as `CREATE TABLE/INDEX IF NOT EXISTS`. Program.cs calls it right after the GameReviews bootstrap, inside the same try block.

## Smoke test

**Skipped: DB not reachable.** Nothing was listening on PostgreSQL localhost:5432 (connection refused), and per the plan I did not start any containers. The concurrent-redemption guarantee (5 parallel spins on a MaxUses=1 code should give exactly one 200) has **not** been tested at runtime. It rests on PostgreSQL re-checking the WHERE of a single `UPDATE … SET UsedCount = UsedCount + 1 WHERE … UsedCount < MaxUses` under the row lock.

## Shared files committed together with pre-existing user changes

None. The orchestrator's update says the user's earlier changes were all committed before execution, and `git status` was clean at start (only `.planning/quick/` untracked). Program.cs, MoxicDbContext.cs, MoxicDbContextModelSnapshot.cs and Moxic.Admin/src/App.tsx contain only this task's hunks plus whatever EF generated. Program.cs was edited with targeted insertions only; its UTF-8 BOM, mixed CRLF/LF line endings and garbled Vietnamese comments are unchanged (+19 lines, 0 deletions). After every commit, `git status --short` showed only `.planning/quick/` untracked. Nothing was reverted or stashed, and no build output was committed.

## Discretion choices

- **ContactSetting entity** (new singleton table, int identity) instead of extending PaymentConfig.
- **Animation:** WAAPI `track.animate()` on `transform` only, 6500 ms, `cubic-bezier(0.08, 0.6, 0.1, 1)`, `will-change` set only while spinning. It lands at a random offset of ±35% of a card width inside the winning card, and keeps that position on window resize. Reduced motion uses 1200 ms. I used WAAPI instead of a CSS transition because the global reduced-motion rule forces `transition-duration: 0s !important`.
- **Reel:** 50 cards, winner always at index 44. The server builds the filler by weight using the CSPRNG (purely cosmetic).
- **Entry points:** home banner between HeroSplash and DiscoverySection (hidden unless the pool is valid; the wrapper uses `empty:hidden` so no blank margin is left behind) plus the `/lucky-spin` route, which also accepts `?code=` to pre-fill the code.
- **Prize cards:** dark purple gradient, 4px rarity bar with a glow rising from the bottom. Game prizes show the presigned cover image (primary media, falling back to the first by display order). Luck shows a Clover icon, Discount a TicketPercent icon. I added a third `tile` size for the "Vật phẩm trong hòm" grid.
- **FloatingContact:** the container is `pointer-events-none` and only the visible buttons accept clicks, so the hidden collapsed buttons never block page clicks.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness] Click-through for collapsed floating buttons**
- **Found during:** Task 3
- **Issue:** The hidden secondary buttons still take up layout space inside the fixed container, so the container would have swallowed clicks on the page area behind it.
- **Fix:** Made the container `pointer-events-none`; visible buttons use `pointer-events-auto`.
- **Files modified:** Moxic.Web/src/components/layout/FloatingContact.tsx
- **Commit:** 876952a

**2. [Rule 2 - Correctness] Fallback cover image for Game prizes**
- **Found during:** Task 1
- **Issue:** The plan used only the primary GameMedia; games without a primary flag would show no art.
- **Fix:** `LuckySpinRules.ResolveImageUrlAsync` falls back to the first media by DisplayOrder. Presign failures are swallowed, same as GameEndpoints.
- **Commit:** 16faf61

**3. [Rule 2 - Correctness] Public contact endpoint re-validates stored values**
- **Fix:** `ContactLinks.Resolve*` returns null for any stored value that is not http/https or a valid phone number, even though admin PUT already validates. This adds protection against XSS via `href` (T-qmv-04).
- **Commit:** 16faf61

Everything else was implemented as planned.

## Threat model coverage

T-qmv-01 (CSPRNG only; verify gate confirms no System.Random), T-qmv-02 (conditional ExecuteUpdateAsync inside a transaction), T-qmv-03 (10-char codes from a 31-symbol alphabet + fixed window of 10/min/IP, 429), T-qmv-04 (http/https or phone only, server-resolved hrefs, `rel="noopener noreferrer"`), T-qmv-05 (`[Authorize(Roles = "Admin")]` on both admin controllers), T-qmv-06 (PublicPrizeDto has no probability; only active prizes), T-qmv-07 (SpinHistories with a unique RewardCode, IP and timestamp), T-qmv-08 (count ≤ 500, maxUses ≤ 1000, page size ≤ 200, fixed reel length).

## Known Stubs

None. Every component reads live API data.

## Manual QA checklist (for the user)

1. Admin: Lucky Spin → Giải thưởng. Add e.g. Luck 60%, Discount "Giảm 10%" 30%, Game 10%. The total bar turns green at 100.00%. Try pushing it above 100%: you should see an inline block, and the server should also return 400.
2. Admin: Mã quay. Generate 3 codes with maxUses 1, check that "Copy tất cả" works, then disable one code and spin with it: expect "Mã quay đã bị vô hiệu hóa."
3. Storefront desktop (≥1280px): the home banner shows; open /lucky-spin, enter a code. The reel should spin about 6.5s and stop with the highlighted card under the pink marker (slightly off center is intended). The result modal shows the reward code, copy button and Messenger/Zalo buttons.
4. Storefront mobile (375px and 360px, DevTools device mode): the reel is full-bleed, cards are 104px, the winning card stops under the marker, and the input and "Mở hòm" button stack full-width. Rotate or resize after a spin: the landed card should stay under the marker.
5. Reduced motion (DevTools → Rendering → prefers-reduced-motion: reduce): the spin finishes in about 1.2s and the result modal still opens.
6. Spin the same single-use code again: expect "Mã quay đã hết lượt sử dụng." Send more than 10 spins/min from one IP: expect the toast "Bạn thao tác quá nhanh…".
7. Set one prize inactive so the total is under 100%: the banner disappears, /lucky-spin shows "Vòng quay đang được cập nhật…", and the code's UsedCount does not increase.
8. Admin: Contact. With only Messenger set, the storefront shows the Messenger button and no "+". Set Zalo as a phone (e.g. 0901234567) and a phone number: "+" appears, expands to Phone/Zalo, and the "+" rotates into "×". Escape or navigating to another page collapses it.
9. Game detail page on mobile (<1024px): the floating buttons sit above the sticky buy bar (bottom-24).
10. Admin: Lịch sử quay. Search by an `MX…` reward code, then use "Đánh dấu đã trao" / "Hoàn tác". Luck rows have no claim button.
11. Optional: with Postgres running, fire 5 concurrent spins on a maxUses=1 code. Expect exactly one 200 and four 400s.

## Self-Check: PASSED

- All 25 created files and 7 modified files exist on disk (verified by the build and grep gates).
- Commits 16faf61, 55b527a, 876952a are present in `git log`.
- The automated verify commands for Tasks 1, 2 and 3 all printed OK.
