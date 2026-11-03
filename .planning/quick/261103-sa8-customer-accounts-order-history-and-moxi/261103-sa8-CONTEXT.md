# Quick Task 261103-sa8: MOXIC loader + customer accounts + order history - Context

**Gathered:** 2026-11-03
**Status:** Ready for planning

<domain>
## Task Boundary

1. **Loading spinner (storefront, Moxic.Web):** the app has no loading indicator while API data loads (e.g. /lucky-spin page, game list/detail, home). Build a branded loader: the word "MOXIC" arranged/rotating around a circle (letters on a circular path spinning, with glow, matching the dark purple/gold Epic style). Use it for route-level/page-level loading states (React Query `isLoading`, lazy routes / Suspense fallback, the existing `GlobalLoader.tsx` if appropriate) and a small inline variant for buttons/sections. Respect reduced motion.
2. **Customer accounts:** register (email + password + display name), **email verification required** (6-digit OTP or link sent via the existing `EmailService`/SMTP), login, logout, forgot/reset password, "me" endpoint. Navbar "Đăng nhập" button becomes account menu when logged in (name, Lịch sử mua hàng, Đăng xuất).
3. **Order history:** logged-in, verified customers see a "Lịch sử mua hàng" page listing all orders whose customer email equals their verified email (including orders placed before the account existed), newest first, with status, items, totals, and an order detail view. Orders placed while logged in are also linked to the account (`CustomerId` on Order, nullable). Guest checkout stays allowed; when logged in, checkout pre-fills email/name.

</domain>

<decisions>
## Implementation Decisions

### Auth design (locked)
- Reuse ASP.NET Core Identity (`IdentityUser` + roles already configured; admin uses role "Admin" and the `MoxicAuthCookie` cookie; all admin controllers are `[Authorize(Roles = "Admin")]`).
- Customers get role **"Customer"**. Customer login must NOT give admin access (role check already), and the admin login endpoint `/api/auth/login` must reject non-Admin users so customers can't sign into the admin SPA.
- Use a **separate authentication cookie scheme for customers** (e.g. name `MoxicCustomer`, HttpOnly, Secure in prod, SameSite=Lax) so an admin session and a customer session in the same browser don't overwrite each other. Web (moxic.co) → API (api.moxic.co) is same-site, CORS already allows credentials; the web API client must send `credentials: 'include'`.
- Unverified users cannot log in (return a clear Vietnamese message + allow resending the code). Rate-limit register/login/resend/forgot endpoints. Password policy: min 8 chars. Don't reveal whether an email exists on forgot-password.
- Email templates in Vietnamese via existing EmailService (add methods). If SMTP isn't configured, log the code (dev) — don't crash.

### Order history (locked)
- History = orders where `Order.CustomerEmail` (whatever the existing field is) matches the account's verified email case-insensitively, OR `CustomerId == user`. Never expose Xbox password fields in the history API.

### Data/DB
- The app uses `EnsureCreated` + idempotent bootstrap SQL (see `LuckySpinSchemaBootstrap`) rather than runtime migrations. New columns/tables (e.g. Order.CustomerId, any customer profile table) must be added via the same idempotent bootstrap approach (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`) so the production DB upgrades on API startup. Also generate an EF migration for the model snapshot. Identity tables already exist in prod.
- A follow-up quick task (cases + points) will add a points balance to customer accounts — design a `CustomerProfile` (UserId PK/FK, DisplayName, Points int default 0, CreatedAt) or equivalent now so it can be extended.

### Claude's Discretion
- OTP vs link (prefer 6-digit OTP, 15-min expiry, stored hashed).
- Page routes (/dang-nhap, /dang-ky, /tai-khoan/lich-su or English equivalents consistent with existing routes).
- Loader exact visuals.

</decisions>

<specifics>
## Specific Ideas
- Follow existing patterns (Minimal APIs in Program.cs/Endpoints vs Controllers — be consistent with what's there; React Query, Zustand, Tailwind 4 dark Epic style, Vietnamese UI copy).
- Must build: `dotnet build` (API/Moxic.slnx), `npm run build` in Moxic.Web and Moxic.Admin.
- Commit only explicit paths; never `git add -A`; do not push.
</specifics>

<canonical_refs>
## Canonical References
No external specs.
</canonical_refs>
