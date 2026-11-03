---
phase: quick-261103-smv
plan: 01
subsystem: coupons (API + admin SPA + storefront)
tags: [coupons, checkout, lucky-spin, wallet, admin, ef-migration]
requires: [261103-qmv lucky spin, 261103-sa8 customer accounts, 261103-sls cases + points]
provides:
  - Coupon + CouponRedemption model, Order.CouponId/CouponCode/DiscountAmount, SpinPrize.Discount*
  - Server-side pricing + atomic coupon redemption at order creation, exactly-once release on cancel
  - POST /api/coupons/validate, GET /api/account/coupons, POST /api/account/coupons/claim
  - Admin /api/admin/coupons (CRUD, bulk, toggle, redemptions) + "Mã giảm giá sự kiện" page
  - Storefront wallet /account/coupons, checkout CouponBox, discount lines on every order view
affects: [OrdersController.CreateOrder pricing (client Price now ignored), PaymentTimeoutService, LuckySpin open, admin email]
tech-stack:
  added: []
  patterns: [caller-owned transaction service (PointsService pattern), conditional ExecuteUpdate claims, idempotent bootstrap DDL]
key-files:
  created:
    - API/Moxic.Shared/Enums/CouponSource.cs
    - API/Moxic.Shared/Enums/CouponDiscountType.cs
    - API/Moxic.Core/Entities/Coupon.cs
    - API/Moxic.Core/Entities/CouponRedemption.cs
    - API/Moxic.Infrastructure/Data/CouponSchemaBootstrap.cs
    - API/Moxic.Infrastructure/Data/Migrations/20261103174824_AddCoupons.cs (+ Designer)
    - API/Moxic.Api/Services/CouponRules.cs
    - API/Moxic.Api/Services/CouponService.cs
    - API/Moxic.Api/Models/CouponDtos.cs
    - API/Moxic.Api/Controllers/CouponsController.cs
    - API/Moxic.Api/Controllers/AccountCouponsController.cs
    - API/Moxic.Api/Controllers/AdminCouponsController.cs
    - Moxic.Admin/src/lib/couponAdmin.ts
    - Moxic.Admin/src/pages/Coupons.tsx
    - Moxic.Web/src/lib/couponApi.ts
    - Moxic.Web/src/hooks/useCoupons.ts
    - Moxic.Web/src/pages/CouponWalletPage.tsx
    - Moxic.Web/src/components/checkout/CouponBox.tsx
  modified:
    - API: Order.cs, SpinPrize.cs, MoxicDbContext.cs, snapshot, OrdersController, AdminOrdersController, PaymentTimeoutService, LuckySpinController, LuckySpinRules, LuckySpinDtos, AdminLuckySpinController, AccountOrdersController, AccountDtos, Dtos.cs, IServices.cs, EmailService.cs, Program.cs
    - Admin: App.tsx, LuckySpinPrizes.tsx, OrderDetailModal.tsx, OrderList.tsx
    - Web: App.tsx, Navbar.tsx, CheckoutPage, CartSummary, CheckoutForm, QRDisplay, ConfirmationContent, ConfirmationPage, types/game.ts, accountApi.ts, useAccount.ts, OrderHistoryPage, OrderHistoryDetailPage, luckySpinApi.ts, ResultModal.tsx
decisions:
  - "Login required for any coupon; one coupon per order; server prices lines from Game.SalePrice and computes discount/total"
  - "Usage counted at order creation (conditional UPDATE inside the order tx), released exactly once on cancel (admin + 24h timeout)"
  - "Schema via idempotent CouponSchemaBootstrap + EF migration AddCoupons; existing orders read DiscountAmount 0"
  - "Spin Discount prizes with DiscountType null stay legacy/manual (reward code only)"
metrics:
  duration: ~75 min
  completed: 2026-11-04
  tasks: 3
  commits: [f1ef20c, dddb932, 1dca7ca]
---

# Phase quick-261103-smv Plan 01: Coupons — wallet, checkout discount, admin event codes Summary

Server-applied coupons end to end. Configured Discount prizes from the Lucky Spin and admin event codes become real discounts for logged-in customers. Orders are re-priced from `Game.SalePrice`, and each coupon is re-validated and redeemed atomically in the order transaction. Cancellation releases the redemption exactly once. Every order view shows the discount line and the discounted total.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | f1ef20c | Coupon engine, migration + bootstrap, validate/wallet/claim APIs, checkout redemption, cancel release, spin Discount → coupon, cooldown message |
| 2 | dddb932 | Admin coupons API + "Mã giảm giá sự kiện" page, prize discount config, discount in order read models + admin order views |
| 3 | 1dca7ca | Storefront wallet + claim, checkout CouponBox, discount totals on confirmation/QR/history, spin result wallet messaging, nav |

## Builds

- **Baseline** (before any change): `dotnet build API/Moxic.slnx` gave 0 errors and 8 warnings, all NU1902/NU1903 (System.Security.Cryptography.Pkcs). `npm run build` passed in both Moxic.Web and Moxic.Admin.
- **Final:** the same result, with 0 errors and the same 8 NU190x warnings, and both npm builds pass. No new warnings.
- **oxlint (Moxic.Web):** 0 findings on all 19 touched storefront files. I confirmed it does report findings by running it on a deliberately bad file.

## Migration drift report

`dotnet ef migrations script AddSpinCasesPointsMusic AddCoupons` emits exactly the planned columns, tables, FKs and the 6 indexes, with the same names and types. CouponSchemaBootstrap copies that DDL with IF NOT EXISTS guards and a `DO $EF$` block for FK_Orders_Coupons_CouponId. **No unrelated drift.**

The migration is safe on a populated DB:
- Only nullable columns are added, plus `DiscountAmount numeric(18,2) NOT NULL DEFAULT 0.0`.
- Existing orders keep `TotalAmount == sum(Details.Price) - 0`.

## Smoke test

**Skipped: DB not reachable.** localhost:5432 returned ECONNREFUSED, and no container was started.

## Discretion choices

- **Routes:** `/api/coupons/validate`, `/api/account/coupons[/claim]`, `/api/admin/coupons`; storefront `/account/coupons`; admin `/coupons`.
- **Codes:** generated codes use `LuckySpinRules.GenerateCode` (CSPRNG, 31-char alphabet). Spin reward codes are now unique across SpinHistories **and** Coupons. Admin codes are unique against both as well.
- **Auto-bind:** an unowned SpinReward coupon typed at checkout is bound to the customer inside the order transaction, so a rollback un-binds it.
- **Ownership on spin:** only an email-verified logged-in customer owns the coupon immediately. Everyone else gets a claimable coupon.

## Deviations from Plan

### Auto-fixed / adjusted

1. **[Rule 3] QuoteAsync return shape.** It now returns `(Eval, Coupon?, GameName)` instead of only `CouponEvaluation`. The controller needs the coupon and the scoped game name to build `CouponQuoteDto`.
2. **[Rule 2] Claim is atomic.** `POST /api/account/coupons/claim` wraps `ClaimAsync` in a controller-owned transaction, so the owner bind and the SpinHistory `IsClaimed` flag commit together. The service still never begins a transaction.
3. **[Rule 1] CreateOrder rollback cleanup.** After a coupon rollback it calls `_db.ChangeTracker.Clear()`, so the untracked order and detail entities are not left attached.
4. **[Rule 1] Admin create/bulk respects `IsActive`.** The plan's entity factory hard-coded `IsActive = true`; the request flag is now passed through.
5. **Prize form legacy mode.** The Discount "Loại" select has a third option, "Chưa cấu hình — trao thủ công" (value `""` → DiscountType null). Editing a legacy prize keeps it legacy unless the admin picks a type. New prizes default to Percent.
6. **Optional trailing params.** `OpenCaseResultDto` and `AdminPrizeDto` gained their new trailing positional params with defaults. Construction sites elsewhere stay compatible.
7. **Copy for create.** "Thời gian kết thúc phải ở tương lai." is used when ExpiresAt is in the past on create; the plan did not give exact text.

### Encoding

- BOMs are preserved on every listed file. I edited them with an EOL/BOM-preserving node helper.
- The garbled strings in AdminOrdersController are byte-identical; `git diff` shows only the targeted hunks.
- "Het han thanh toan sau 24 gio" is unchanged.

## Threat coverage

| Threat | Mitigation |
|--------|------------|
| T-smv-01 | Lines are priced by `PriceLinesAsync`, and the client Price is ignored. |
| T-smv-02 | The conditional UPDATE with `UsedCount < MaxTotalUses` runs before the per-customer recount, under the row lock, inside the order tx. `CouponRedemptions.OrderId` has a UNIQUE index. |
| T-smv-03 | `ReleasedAt == null` conditional release; the decrement only happens when that affects 1 row and while `UsedCount > 0`. It runs in the cancel tx for the admin path and for the per-order conditional `Pending → Cancelled` timeout path. |
| T-smv-04 | The 20/min/IP "coupon" policy covers validate, claim and CreateOrder. |
| T-smv-05 | The owner is checked in Evaluate and in the UPDATE WHERE. Bind requires `OwnerUserId IS NULL`. A taken code returns 409 without revealing the owner. |
| T-smv-06 / 07 | Customer DTOs carry no owner, email or redemption data. The admin controller requires `[Authorize(Roles="Admin")]`. |
| T-smv-08 | Append-only redemptions; CreatedBy is recorded; only unused coupons can be deleted. |
| T-smv-09 | Bulk is capped at 500, the wallet at 200, the cart at 50 and pageSize at 200; lookups are batched. |
| T-smv-10 | The coupon is created in the same transaction as consume, draw and history. |
| T-smv-11 | The coupon code in the admin email goes through HtmlEncode. |
| T-smv-12 | Accepted. |

## Known Stubs

None.

## Manual QA checklist

- [ ] **Spin, logged in.** Configure a Discount prize (e.g. 10%, max 50.000đ, 30 days). A logged-in, verified win shows "Mã giảm giá đã được thêm vào ví… hạn dùng đến dd/mm/yyyy", and the coupon appears in /account/coupons with status Có thể dùng.
- [ ] **Spin, guest.** A guest win (Code case) shows "Đăng nhập và nhận mã vào ví" and the "Nhận mã vào ví" link. Logging in redirects back with `?claim=` prefilled, and "Nhận vào ví" shows the toast "Đã thêm mã vào ví".
- [ ] **Claim conflicts.**
  - A second account claiming the same code gets 409 "Mã thưởng đã được tài khoản khác nhận."
  - Claiming again on the owning account gives "Mã đã có trong ví của bạn".
- [ ] **Claim errors.**
  - A Game reward code gives COUPON_GAME_REWARD.
  - A legacy Discount code (won before this change) gives COUPON_LEGACY_REWARD.
  - An event code gives COUPON_EVENT_CODE.
- [ ] **Legacy prizes.** Game prizes and unconfigured Discount prizes still show the "liên hệ Moxic" text and the contact buttons.
- [ ] **Wallet tabs.**
  - Có thể dùng shows Usable and Upcoming; Upcoming has "Bắt đầu từ" and a disabled button.
  - Đã dùng shows Used.
  - Hết hạn shows Expired and Inactive; Inactive carries the "Đã vô hiệu" badge.
  - "Dùng ngay" opens /checkout?coupon=CODE, and the code is auto-applied.
- [ ] **Checkout preview.**
  - Percent cap works.
  - GameId scope applies to the matching line only.
  - MinOrderAmount is checked against the applicable amount.
  - A Fixed discount is capped at the applicable line.
  - Wallet chips apply the chosen code.
  - "Bỏ mã" removes the coupon.
  - Removing a cart item re-validates the coupon.
- [ ] **Guest prompt.** A guest at checkout sees "Đăng nhập để dùng mã giảm giá".
- [ ] **Stale coupon at submit.** If an admin disables the code after preview, submitting returns 400 COUPON_INACTIVE. The coupon is removed with the message "… Mã giảm giá đã được gỡ — bạn có thể đặt hàng lại."
- [ ] **Race.** Two parallel orders with a 1-use code: exactly one succeeds and the other gets COUPON_EXHAUSTED. UsedCount never exceeds 1.
- [ ] **Admin cancel.** Cancelling sets the redemption's ReleasedAt and returns UsedCount to 0. A second cancel attempt is impossible because the state is terminal, and the release would be a no-op anyway.
- [ ] **24h timeout.** The timeout cancel releases once. It does not cancel an order an admin moved out of Pending in the meantime.
- [ ] **Totals.**
  - The confirmation page shows Tạm tính, Giảm giá (CODE) and Tổng cộng.
  - The QR card shows "Số tiền cần chuyển" with the discounted amount, "Đã trừ mã giảm giá", and a copy button that copies the integer amount.
  - Order history list shows "(đã giảm X)", and the detail shows the Tạm tính and Giảm giá rows.
  - The admin list shows "−X · CODE"; the admin modal shows Subtotal and Discount (CODE).
  - The admin email has the Tạm tính and Giảm giá lines.
- [ ] **Admin page.**
  - Single create with a blank code (random) and with a custom code.
  - Bulk create of N codes with a prefix, then "Sao chép tất cả".
  - Edit: code is read-only; MaxTotalUses below UsedCount is rejected.
  - The toggle switch works.
  - Deleting a used code gives 409 "Mã đã có lượt sử dụng — hãy tắt mã thay vì xóa."
  - The redemptions modal shows the "Đã hoàn lượt" badge.
  - The "Thưởng vòng quay" filter shows the owner email or "Chưa nhận".
- [ ] **Prize toggle.** Toggling a configured Discount prize on or off keeps its discount config.
- [ ] **Cooldown.** Opening a FreeInterval case twice gives "Lượt tiếp theo sẽ mở sau 23 giờ 59 phút." (24h interval), not "sau ít phút nữa".

### Worked numbers (games 749.000đ + 1.799.000đ, subtotal 2.548.000đ)

| Coupon | Applicable | Discount | Total |
|--------|-----------|----------|-------|
| 10%, max 50.000đ | 2.548.000đ | 50.000đ (cap) | 2.498.000đ |
| 15% scoped to the 749.000đ game | 749.000đ | 112.350đ | 2.435.650đ |
| Fixed 1.000.000đ scoped to the 749.000đ game | 749.000đ | 749.000đ (capped at line) | 1.799.000đ |
| Fixed 100.000đ, min 1.000.000đ, scoped to the 749.000đ game | 749.000đ | n/a | COUPON_MIN_ORDER |

## Self-Check: PASSED

- All files listed under key-files exist on disk, and the migration is `20261103174824_AddCoupons.cs`.
- Commits f1ef20c, dddb932 and 1dca7ca are present in `git log`.
- `git status` shows only the untracked `.planning/quick/261103-smv-…/` directory.
