# Quick Task 261103-sls: Multiple cases (code / free-interval / points), loyalty points, case music, reel near-miss - Context

**Gathered:** 2026-11-03
**Status:** Ready for planning
**Depends on:** 261103-qmv (lucky spin v1) and 261103-sa8 (customer accounts, `CustomerProfile.Points`, Customer cookie scheme). Read both SUMMARYs.

<domain>
## Task Boundary

1. **Multiple cases ("hòm").** Replace the single global prize pool with a `SpinCase` entity: name, slug, description, cover/icon image (MinIO, optional), display order, IsActive, **open method**, and its own prize list with % odds (existing `SpinPrize` gets `CaseId`; migrate existing prizes + codes into a default "Hòm mã quay" case). Open methods:
   - `Code` — as today: user enters an admin-generated spin code (codes now belong to a case). Login NOT required.
   - `FreeInterval` — free once every N hours per **account** (admin sets N, default 24). Requires logged-in, verified customer. Show countdown to next free open.
   - `Points` — costs N points, deducted from the customer's balance atomically. Requires login.
   Prize types stay 3: Luck / Discount / Game (no "+points" prize). Each case validates its own 100% total.
2. **Loyalty points.** Admin sets `RewardPoints` per game (int, default 0) in GameForm. When an order transitions to `Completed`, credit the sum of RewardPoints of the order's games to the linked customer (Order.CustomerId, or the customer whose verified email matches the order's email) — exactly once per order (idempotent, e.g. `Order.PointsAwardedAt`/ledger unique key). Keep a `PointsTransaction` ledger (customer, delta, reason: OrderCompleted/CaseOpen/AdminAdjust, ref id, balance after, createdAt). Admin can view a customer list with balances and manually adjust points. Customer sees balance in navbar/account menu and a points history in the account area.
3. **Case music.** Admin "Kho nhạc" page: upload audio files (mp3/ogg/m4a, size limit ~10MB) to MinIO, name, enable/disable, delete. Public endpoint returns enabled tracks (presigned URLs). On each visit to the case page the client picks one random enabled track; it plays when the user starts opening (user gesture → no autoplay issues), fades out after the result. Mute toggle persisted in localStorage (try/catch). Optional small tick sound not required.
4. **Reel shows all prizes + drama (user feedback):** currently the reel filler is sampled by real odds, so with a 99% "Luck" prize the reel is all Luck cards. Change: filler cards are **cosmetic** — sample roughly uniformly across the case's prizes with a bias toward rarer items so every prize appears often. The REAL result is still decided only by the backend CSPRNG with the configured odds; the client only animates to the server-chosen winning index and must not be able to influence odds (no client-provided probabilities/seed). **Near-miss**: when the win is a common/Luck prize, place rare/legendary cards immediately adjacent to the winning index (±1), and the server returns a stop offset within the winning card biased toward the edge adjacent to the rare card (e.g. 5–20% from that edge) so it "almost" landed on it. Animation: fast start, long dramatic deceleration (~7–8s, strong ease-out like cubic-bezier(0.05,0.85,0.15,1) or a custom curve), keep the reduced-motion shortcut.
5. **Live drops feed (like skin.club's top bar, design reference only).** A horizontal "LIVE" strip on the lucky-spin pages (gallery + case page; optionally home banner) showing REAL recent wins from our own SpinHistory — never external/fake data. Left: "WOW" block with the 3 most recent rare+ (epic/legendary tier) wins, gold border. Right: auto-scrolling strip of the latest ~20 non-Luck wins; new wins slide in from the left. Each card: game cover or prize icon, prize name, case name, masked winner name (account display name or "Khách" for guests, masked like `tr***g`), rarity-colored bottom glow. Public endpoint `GET /api/lucky-spin/live-drops` (no PII: no email, no IP, no reward code), cached ~5s server-side; client polls every ~8s via React Query (or SSE if trivial). Exclude Luck results. Mobile: strip scrolls horizontally, WOW block collapses to 1 card. The case gallery (`/lucky-spin`) must handle many cases (paging or load-more grid). Note: a later task 261103-smv will turn Discount prizes into real coupons, so keep Discount prize config extensible.

## UI
- Storefront: `/lucky-spin` becomes a case gallery (cards for each active case showing name, open method badge: "Nhập mã" / "Miễn phí mỗi 24h" / "500 điểm", countdown or points cost), and `/lucky-spin/:slug` is the opening page (reuse current reel/result UI). Home banner links to gallery.
- Admin: Lucky Spin page gets a case selector/list (CRUD cases incl. open method config), prizes & codes scoped per case, history shows case. New pages: Khách hàng (customers + points + adjust), Kho nhạc. GameForm: RewardPoints field.

</domain>

<decisions>
## Implementation Decisions (locked)
- Server is the single source of truth for outcome, cost deduction, free-open eligibility; all in one DB transaction with atomic conditional updates (points: `UPDATE ... SET Points = Points - cost WHERE UserId = x AND Points >= cost`; free: conditional on last-open timestamp per (user, case), e.g. `SpinCaseCooldown` table with unique (UserId, CaseId)).
- Points awarding idempotent per order.
- Prize types unchanged (3).
- Schema upgrades via idempotent bootstrap SQL at startup (same approach as LuckySpinSchemaBootstrap / CustomerAccountSchemaBootstrap) + EF migration for the snapshot; existing prod data (prizes, codes, history) must be migrated into a default Code case without loss.

### Claude's Discretion
- Rate-limit client IP: prod chain is Cloudflare → Caddy → API (NOT nginx; Caddy does not set X-Real-IP, so a client-supplied X-Real-IP is currently trusted — spoofable). Fix `GetClientIp` to prefer `CF-Connecting-IP`, then `X-Forwarded-For` first hop, then remote address; for account-based cases also rate-limit per user.
- Exact visuals; music fade timings.
</decisions>

<specifics>
- Vietnamese UI copy. Mobile + desktop polish.
- Builds must pass (dotnet + both npm builds). Commit explicit paths only, don't push.
</specifics>
