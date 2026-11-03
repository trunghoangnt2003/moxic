---
phase: quick-261103-sa8
plan: 01
subsystem: customer accounts, order history, storefront loader (API + storefront)
tags: [identity, cookie-auth, otp, rate-limiting, order-history, loader, a11y]
requires: []
provides:
  - "/api/account: register, verify-email, resend-verification, login, logout, me (204 for guests), forgot-password, reset-password"
  - "/api/account/orders (paged) + /api/account/orders/{orderCode}, MoxicCustomer scheme + Customer role"
  - "MoxicCustomer cookie scheme, Customer role, admin /api/auth/login restricted to Admin role"
  - "CustomerProfile (Points reserved for cases/points), CustomerOtpCodes, Order.CustomerId"
  - "Storefront: MoxicLoader/PageLoader/SectionLoader; /login, /register, /verify-email, /forgot-password, /account/orders, /account/orders/:orderCode; navbar account menu; checkout prefill"
affects: [Program.cs (identity options, auth scheme, rate limiter, admin login, startup bootstrap), OrdersController.CreateOrder, MoxicDbContext + snapshot, App.tsx, Navbar, CheckoutForm]
tech-stack:
  added: []
  patterns:
    - "Second cookie scheme via AddAuthentication().AddCookie(...) without changing the default (admin) scheme"
    - "CheckPasswordSignInAsync (no cookie) + manual SignInAsync on the customer scheme"
    - "Custom OnValidatePrincipal comparing the security-stamp claim (not SecurityStampValidator)"
    - "OTP hashed with IPasswordHasher; conditional ExecuteUpdateAsync for consumption / attempt increments"
    - "SVG textPath orbit loader with sanitized useId fragment ids"
key-files:
  created:
    - API/Moxic.Shared/Enums/CustomerOtpPurpose.cs
    - API/Moxic.Core/Entities/CustomerProfile.cs
    - API/Moxic.Core/Entities/CustomerOtpCode.cs
    - API/Moxic.Infrastructure/Data/CustomerAccountSchemaBootstrap.cs
    - API/Moxic.Infrastructure/Data/Migrations/20261103134018_AddCustomerAccounts.cs
    - API/Moxic.Infrastructure/Data/Migrations/20261103134018_AddCustomerAccounts.Designer.cs
    - API/Moxic.Api/Services/CustomerAuthRules.cs
    - API/Moxic.Api/Services/CustomerOtpService.cs
    - API/Moxic.Api/Models/AccountDtos.cs
    - API/Moxic.Api/Controllers/AccountController.cs
    - API/Moxic.Api/Controllers/AccountOrdersController.cs
    - Moxic.Web/src/components/shared/MoxicLoader.tsx
    - Moxic.Web/src/lib/accountApi.ts
    - Moxic.Web/src/hooks/useAccount.ts
    - Moxic.Web/src/hooks/useCountdown.ts
    - Moxic.Web/src/components/account/AuthShell.tsx
    - Moxic.Web/src/components/account/AuthField.tsx
    - Moxic.Web/src/components/account/OrderStatusBadge.tsx
    - Moxic.Web/src/components/account/RequireCustomer.tsx
    - Moxic.Web/src/pages/LoginPage.tsx
    - Moxic.Web/src/pages/RegisterPage.tsx
    - Moxic.Web/src/pages/VerifyEmailPage.tsx
    - Moxic.Web/src/pages/ForgotPasswordPage.tsx
    - Moxic.Web/src/pages/OrderHistoryPage.tsx
    - Moxic.Web/src/pages/OrderHistoryDetailPage.tsx
  modified:
    - API/Moxic.Core/Entities/Order.cs
    - API/Moxic.Core/Interfaces/IServices.cs
    - API/Moxic.Infrastructure/Services/EmailService.cs
    - API/Moxic.Infrastructure/Data/MoxicDbContext.cs
    - API/Moxic.Infrastructure/Data/Migrations/MoxicDbContextModelSnapshot.cs
    - API/Moxic.Api/Controllers/OrdersController.cs
    - API/Moxic.Api/Program.cs
    - Moxic.Web/src/index.css
    - Moxic.Web/src/App.tsx
    - Moxic.Web/src/components/shared/GlobalLoader.tsx
    - Moxic.Web/src/pages/HomePage.tsx
    - Moxic.Web/src/pages/GamesPage.tsx
    - Moxic.Web/src/pages/PreorderPage.tsx
    - Moxic.Web/src/pages/GameDetailPage.tsx
    - Moxic.Web/src/pages/ConfirmationPage.tsx
    - Moxic.Web/src/pages/LuckySpinPage.tsx
    - Moxic.Web/src/components/game-detail/ReviewForm.tsx
    - Moxic.Web/src/components/layout/Navbar.tsx
    - Moxic.Web/src/components/checkout/CheckoutForm.tsx
decisions:
  - "6-digit OTP (CSPRNG), PBKDF2-hashed via IPasswordHasher, 15-min expiry, 5 attempts, 60 s resend cooldown"
  - "English routes: /login, /register, /verify-email, /forgot-password, /account/orders(/:orderCode)"
  - "GET /api/account/me returns 204 for guests (no 401 console noise)"
  - "Order.CustomerId is a plain indexed text column with no DB FK; history also matches by Xbox email"
  - "Display name shown in a checkout banner (orders have no name field)"
  - "Loader: MOXIC letters on a textPath ring + counter-rotating dashed purple ring + pulsing gold core; sm = 5 currentColor dots"
metrics:
  duration: "~13 min"
  started: "2026-11-03T13:35:45Z"
  completed: "2026-11-03T13:48:10Z"
  tasks: 3
  files: 44
---

# Phase quick-261103-sa8 Plan 01: Customer Accounts, Order History & MOXIC Loader Summary

Customers can now create storefront accounts on top of the existing ASP.NET Core Identity. They register, verify the email with a 6-digit code, then log in on a separate `MoxicCustomer` cookie. Codes are hashed, rate-limited, expire and are capped by attempts. Logged-in customers get a "Lịch sử mua hàng" page listing every order linked to them by `CustomerId` or by a case-insensitive match on the Xbox email, with a detail view. The branded MOXIC orbit loader now replaces the skeletons and spinners across the storefront.

## Commits

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | Backend: customer auth, OTP, CustomerProfile, Order.CustomerId, history API, bootstrap + migration | 1d54a57 |
| 2 | MOXIC loader wired into loading states + account API client/hooks | 6278562 |
| 3 | Storefront account pages, navbar menu, order history, checkout prefill | 4d7c2d9 |

## Baseline builds (before any edit)

- `dotnet build API/Moxic.slnx`: PASS, 0 errors, 8 warnings. All 8 are the NU1902/NU1903 warnings for System.Security.Cryptography.Pkcs 10.0.0 that were already there.
- `npm run build` in Moxic.Web: PASS
- `npm run build` in Moxic.Admin: PASS

After all tasks: same result (0 errors, same 8 NU190x warnings, both SPAs build). oxlint on every new or touched storefront file: 0 findings.

## Migration

- Generated `20261103134018_AddCustomerAccounts` with `dotnet ef migrations add`, output kept as EF wrote it. **No unrelated drift captured.** The qmv migration had already absorbed the earlier GameReviews / lowercase Identity drift. This migration contains only: AddColumn Orders.CustomerId, CreateTable CustomerOtpCodes and CustomerProfiles (FKs to `aspnetusers`, cascade), and indexes IX_Orders_CustomerId and IX_CustomerOtpCodes_UserId_Purpose.
- `CustomerAccountSchemaBootstrap` copies the exact DDL from `dotnet ef migrations script 20261103123336_AddLuckySpinAndContactSettings AddCustomerAccounts`. It is written as `ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` and contains no curly braces. Program.cs calls it right after `LuckySpinSchemaBootstrap.EnsureAsync`, inside the existing try block.

## Smoke test

**Skipped: DB not reachable.** Nothing was listening on localhost:5432 (connection refused). As the plan says, I did not start any containers. These have **not** been exercised at runtime: register → OTP in log → verify → me → orders, customer credentials rejected by `/api/auth/login`, customer cookie getting 401 on `/api/admin/*`, and the 429 after 10 calls per minute. They rely on code review plus the build. See the manual QA checklist below.

## Shared files touched

- **Program.cs**: targeted insertions only (+57/−4). UTF-8 BOM kept, and the file is entirely CRLF (it is no longer mixed). The garbled Vietnamese comments are untouched. Changes:
  - Password policy: RequiredLength 8 plus the RequireNonAlphanumeric/Uppercase/Lowercase flags set to false; RequireDigit stays on. RequireUniqueEmail is on.
  - `AddAuthentication().AddCookie(CustomerAuthRules.Scheme, …)`: HttpOnly, Lax, Secure outside Development, 30-day sliding expiry, 401/403 instead of redirects, custom security-stamp validation.
  - `AddScoped<CustomerOtpService>`.
  - `customer-auth` rate-limit policy.
  - `/api/auth/login` checks `IsInRoleAsync(user, "Admin")` before `PasswordSignInAsync` and is rate-limited.
  - Bootstrap call, plus "Customer" role seeding.
- **OrdersController.cs**: BOM/CRLF kept. CustomerXboxEmail is trimmed, and `AuthenticateAsync(CustomerAuthRules.Scheme)` sets `CustomerId` for logged-in customers.
- **App.tsx**: Suspense fallback is now `PageLoader`. Six lazy account routes added; the `/account/*` routes sit under the `RequireCustomer` element route.
- **LuckySpinPage.tsx**: kept to a minimum for the follow-up task. The reel placeholder now centres `MoxicLoader size="md"` (no more animate-pulse), and the button's Loader2 became `MoxicLoader size="sm"`. Nothing else changed (+6/−3).

## Discretion choices

- **OTP:** 6 digits from `RandomNumberGenerator.GetInt32`, stored as an `IPasswordHasher` hash, 15-minute expiry, killed after 5 wrong attempts. Only the newest code counts. 60 s resend cooldown per user and purpose.
- **Routes:** English, to match `/games` and `/cart`: `/login`, `/register`, `/verify-email`, `/forgot-password`, `/account/orders`, `/account/orders/:orderCode`.
- **`GET /api/account/me` returns 204 for guests**, so the browser console doesn't fill with 401s.
- **Order.CustomerId has no DB FK.** History also matches by email, and the plain column keeps the idempotent DDL simple.
- **Checkout name:** the display name appears in a "Đang đăng nhập với …" banner, because orders have no name field. The Xbox email is pre-filled once from the account email.
- **Loader visuals:** "MOXIC • MOXIC • " on an r=38 textPath with `textLength` set to the circumference, using `lengthAdjust="spacing"` and `white-space: pre` so the trailing space counts and the letters wrap evenly. It has a gold drop-shadow glow, a counter-rotating dashed purple ring (r=26) and a pulsing radial gold core. Under reduced motion it is static and shows a visible "Đang tải...".

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Security] Atomic OTP consumption and attempt counting**
- **Found during:** Task 1
- **Issue:** The planned flow loaded the OTP, then did `FailedAttempts++` and `SaveChanges`. Parallel requests could get around the 5-attempt cap, or both consume the same code.
- **Fix:** A wrong guess now runs a single `ExecuteUpdateAsync(FailedAttempts + 1)`. A right guess runs a conditional `ExecuteUpdateAsync(... WHERE ConsumedAt IS NULL AND FailedAttempts < 5)`, and only `affected == 1` counts as Valid.
- **Files:** API/Moxic.Api/Services/CustomerOtpService.cs
- **Commit:** 1d54a57

**2. [Rule 2 - Correctness] NormalizeEmail rejects display-name forms**
- **Issue:** `MailAddress.TryCreate` accepts `"Name <a@b.c>"`.
- **Fix:** The input is accepted only when the parsed address equals the whole trimmed input.
- **Commit:** 1d54a57

**3. [Rule 1 - Bug] Small loader dots unreadable on gold buttons**
- **Found during:** Task 3
- **Issue:** Gold `#e5d3b3` dots almost disappeared on the gold checkout and auth buttons.
- **Fix:** The `sm` dots use `currentColor`, so they take the button text colour: dark on gold, white on purple.
- **Files:** Moxic.Web/src/components/shared/MoxicLoader.tsx
- **Commit:** 4d7c2d9

**4. [Rule 3 - Blocking/cleanliness] Render-time state adjustment instead of useRef plus effect**
- **Issue:** A one-shot prefill done with an effect would need a setState inside an updater, which is unsafe under StrictMode.
- **Fix:** CheckoutForm uses the React pattern of adjusting state during render (`prefillChecked` flag). Navbar closes its menus on route change the same way.
- **Commit:** 4d7c2d9

**5. [Addition] `hooks/useCountdown.ts`**
- Small shared hook for the 60 s "Gửi lại mã (Ns)" countdown on the verify and forgot pages. It was not in the plan's file list.
- **Commit:** 4d7c2d9

**6. [Addition] Unverified user handling in me and orders**
- `/me` also returns 204 if a cookie somehow belongs to an unconfirmed user. `AccountOrdersController` returns 403 via `Forbid(scheme)` for an unverified or missing user, as the plan specifies.

Everything else was implemented as planned.

## Threat model coverage

| Threat | How it is covered |
| ------ | ----------------- |
| T-sa8-01 | Separate scheme, default scheme unchanged, admin login role check before sign-in |
| T-sa8-02 | Customer role required; register only re-claims unconfirmed customers or role-less users, never Admin |
| T-sa8-03 | CSPRNG, hashed, 15 min, 5 attempts (atomic), rate limit |
| T-sa8-04 | `CheckPasswordSignInAsync` with lockout → 423, plus rate limit on both logins |
| T-sa8-05 | Generic 200 from forgot and resend; emails go through `IBackgroundEmailQueue` |
| T-sa8-06 | Explicit projections; the verify gate confirms no `CustomerXboxPasswordEncrypted` / `.Notes` in AccountOrdersController |
| T-sa8-07 | Ownership filter inside the same query; 404 otherwise |
| T-sa8-09 | `safeRedirect` |
| T-sa8-10 | `WebUtility.HtmlEncode` for the display name and code |
| T-sa8-11 | Security-stamp claim checked in `ValidatePrincipalAsync`; `ResetPasswordAsync` rotates the stamp |
| T-sa8-13 | 60 s cooldown plus IP limiter |

## Known Stubs

None. `CustomerProfile.Points` is intentionally reserved for the follow-up cases/points task. It is only returned in `me` and is not shown anywhere in the UI.

## Manual QA checklist

1. **Register → verify → logged in:** register at /register. With SMTP unconfigured, take the code from the API log line "SMTP chưa được cấu hình — mã xác minh email cho …". Enter it at /verify-email; you should land logged in with the name shown in the navbar.
2. **Unverified login:** register, skip verification, then log in at /login. Expect a toast and a redirect to /verify-email?email=…. "Gửi lại mã" is disabled with a 60 s countdown, then sends again.
3. **Logout:** use the navbar dropdown → "Đăng xuất". Expect the "Đã đăng xuất" toast, a return to /, and the navbar back to "Đăng nhập".
4. **Forgot/reset:** at /forgot-password, the message is the same for an existing and a non-existing email. Reset with the code. A second browser that was logged in as the same customer should be logged out on its next request.
5. **Admin and customer side by side:** log into the admin SPA and the storefront in the same browser; both sessions should survive. Customer credentials at admin login should get 401. With only the customer cookie, `/api/admin/orders` should return 401.
6. **Order history:** place a guest order with Xbox email X, then register with email X. The old order should appear in /account/orders. A new order placed while logged in with a different Xbox email should also appear (CustomerId). Another customer's order code at /account/orders/{code} should give "Không tìm thấy đơn hàng".
7. **Checkout prefill:** while logged in, /checkout pre-fills the Xbox email (with the hint) and shows the banner. As a guest you should see the "Đăng nhập để theo dõi đơn hàng" link, and guest checkout should still work.
8. **Loader:** throttle to Slow 3G in DevTools and open home, /games, /preorder, a game detail page, a confirmation page and /lucky-spin. The orbit loader should appear on each. With reduced motion emulated, the ring is static and "Đang tải..." is visible.
9. **Mobile navbar (375px):** as a guest, the menu shows "Đăng nhập" / "Đăng ký". Logged in, it shows name/email, "Lịch sử mua hàng" and "Đăng xuất".
10. **Rate limit:** 11 rapid POSTs to /api/account/login from one IP should give 429 on the 11th, and the UI should show "Bạn thao tác quá nhanh…".

## Self-Check: PASSED

- All created files listed above exist on disk.
- Commits 1d54a57, 6278562 and 4d7c2d9 are present in `git log`.
- The final `git status --short` shows only `.planning/quick/` entries untracked (sa8 plus two other quick-task directories that already existed: sls, smv).
