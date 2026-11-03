# Quick Task 261103-qmv: Lucky spin (CS2-style case opening) + floating contact buttons - Context

**Gathered:** 2026-11-03
**Status:** Ready for planning

<domain>
## Task Boundary

1. **Lucky spin / case opening** (Vietnamese UI copy). Admin configures a prize pool with % odds; admin generates spin codes; on the storefront home page a user must enter a valid code to get a spin. The opening animation is a horizontal reel of item cards scrolling under a fixed center marker, decelerating and stopping on the won item (like CS2 case opening — see reference: dark purple panel, hexagonal/angled frame, pink triangle markers top & bottom of center line, glow; reel of cards with rarity-colored bottom bar). Must look good and animate smoothly on desktop AND mobile.
2. **Floating contact buttons** bottom-right on the storefront: Messenger, Zalo, Phone. Collapsed state shows only Messenger + a "+" toggle; tapping "+" expands to all 3 (and "+" rotates into "×"). Links/phone are configured in admin.

</domain>

<decisions>
## Implementation Decisions

### Prize types
- `Luck` ("Chúc bạn may mắn lần sau") — no reward.
- `Discount` — admin sets label/value (e.g. "Giảm 10%"); on win the server generates a unique reward code and shows it. **No checkout coupon system** — user contacts admin via Zalo/Messenger with the code, admin applies manually.
- `Game` — references a game in the store (GameId); on win the server generates a unique reward code shown to the user; user contacts admin to claim. **No auto 0đ order.**
- Admin can mark a reward as claimed in the spin history.

### Odds
- Each prize has a weight/percentage; admin UI shows the percentages and warns/blocks if active prizes don't total 100%.
- **Server decides the outcome** with a cryptographically secure RNG (`RandomNumberGenerator`) weighted by configured odds. Client never decides; it only animates to the server's result. The reel's filler items are cosmetic (can be sampled by weight for realism), the winning card is placed at a fixed index.

### Spin codes
- Admin generates codes (single or bulk N), each with `MaxUses` (default 1) and optional expiry; can list, see uses, disable/delete.
- Code redemption must be atomic (no double-spend under concurrent requests) — e.g. conditional UPDATE / row lock / concurrency token.
- Codes are random, uppercase, unambiguous charset; compare case-insensitively. Basic rate limiting on the public spin endpoint to deter brute force.

### Spin history
- Every spin is recorded (code, prize snapshot, reward code, timestamp, claimed flag); admin page lists it.

### Contact buttons
- Admin settings: Messenger URL, Zalo URL (or Zalo phone → https://zalo.me/{phone}), phone number (→ `tel:`). A button whose value is empty is hidden.
- Public GET endpoint for these settings; storefront fetches with React Query.

### Claude's Discretion
- Entity/table naming, whether contact settings live on an existing settings entity (e.g. extend PaymentConfig) or a new SiteSettings entity.
- Exact animation timing/easing (target ~5–7s, cubic-bezier ease-out, small random offset within the winning card so it doesn't always stop dead center), sound not required.
- Where on the home page the spin entry lives (a section/banner on HomePage + a dedicated route/modal is fine).
- Prize card visuals: rarity color derived from probability (rarer → gold/red, common → blue/gray); Game prizes show the game cover image; Luck/Discount show icon art.

</decisions>

<specifics>
## Specific Ideas

- Follow existing patterns: Controllers for admin (`API/Moxic.Api/Controllers/Admin*Controller.cs`), EF Core migrations, uuid keys, timestamptz; Admin SPA pages in `Moxic.Admin/src/pages` + routes in `App.tsx` + `lib/api.ts`; Storefront in `Moxic.Web/src` (Tailwind 4, React Query, existing dark Epic style).
- The working tree has many uncommitted changes from the user. Do NOT revert, stash, or reformat unrelated files; commit only files touched for this task (`git add` explicit paths).
- `.planning/config.json` has a UTF-8 BOM — not this task's concern.

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above.

</canonical_refs>
