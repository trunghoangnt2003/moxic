---
phase: quick-261103-smv
plan: 01
type: execute
wave: 1
depends_on: []   # hard precondition instead: qmv + sa8 + sls are committed (gate in Task 1)
files_modified:
  # Task 1 - backend coupon engine + write paths (new)
  - API/Moxic.Shared/Enums/CouponSource.cs
  - API/Moxic.Shared/Enums/CouponDiscountType.cs
  - API/Moxic.Core/Entities/Coupon.cs
  - API/Moxic.Core/Entities/CouponRedemption.cs
  - API/Moxic.Infrastructure/Data/CouponSchemaBootstrap.cs
  - API/Moxic.Infrastructure/Data/Migrations/*_AddCoupons.cs
  - API/Moxic.Infrastructure/Data/Migrations/*_AddCoupons.Designer.cs
  - API/Moxic.Api/Services/CouponRules.cs
  - API/Moxic.Api/Services/CouponService.cs
  - API/Moxic.Api/Models/CouponDtos.cs
  - API/Moxic.Api/Controllers/CouponsController.cs
  - API/Moxic.Api/Controllers/AccountCouponsController.cs
  # Task 1 - backend (modified)
  - API/Moxic.Core/Entities/Order.cs
  - API/Moxic.Core/Entities/SpinPrize.cs
  - API/Moxic.Infrastructure/Data/MoxicDbContext.cs
  - API/Moxic.Infrastructure/Data/Migrations/MoxicDbContextModelSnapshot.cs
  - API/Moxic.Api/Controllers/OrdersController.cs
  - API/Moxic.Api/Models/Dtos.cs
  - API/Moxic.Api/Controllers/AdminOrdersController.cs
  - API/Moxic.Api/Services/PaymentTimeoutService.cs
  - API/Moxic.Api/Controllers/LuckySpinController.cs
  - API/Moxic.Api/Services/LuckySpinRules.cs
  - API/Moxic.Api/Models/LuckySpinDtos.cs
  - API/Moxic.Core/Interfaces/IServices.cs
  - API/Moxic.Infrastructure/Services/EmailService.cs
  - API/Moxic.Api/Program.cs
  # Task 2 - admin vertical + order read models
  - API/Moxic.Api/Controllers/AdminCouponsController.cs
  - API/Moxic.Api/Controllers/AdminLuckySpinController.cs
  - API/Moxic.Api/Controllers/AccountOrdersController.cs
  - API/Moxic.Api/Models/AccountDtos.cs
  - Moxic.Admin/src/lib/couponAdmin.ts
  - Moxic.Admin/src/pages/Coupons.tsx
  - Moxic.Admin/src/App.tsx
  - Moxic.Admin/src/pages/LuckySpinPrizes.tsx
  - Moxic.Admin/src/pages/OrderDetailModal.tsx
  - Moxic.Admin/src/pages/OrderList.tsx
  # Task 3 - storefront
  - Moxic.Web/src/lib/couponApi.ts
  - Moxic.Web/src/hooks/useCoupons.ts
  - Moxic.Web/src/pages/CouponWalletPage.tsx
  - Moxic.Web/src/components/checkout/CouponBox.tsx
  - Moxic.Web/src/pages/CheckoutPage.tsx
  - Moxic.Web/src/components/checkout/CartSummary.tsx
  - Moxic.Web/src/components/checkout/CheckoutForm.tsx
  - Moxic.Web/src/components/checkout/QRDisplay.tsx
  - Moxic.Web/src/components/checkout/ConfirmationContent.tsx
  - Moxic.Web/src/pages/ConfirmationPage.tsx
  - Moxic.Web/src/types/game.ts
  - Moxic.Web/src/lib/accountApi.ts
  - Moxic.Web/src/hooks/useAccount.ts
  - Moxic.Web/src/pages/OrderHistoryPage.tsx
  - Moxic.Web/src/pages/OrderHistoryDetailPage.tsx
  - Moxic.Web/src/lib/luckySpinApi.ts
  - Moxic.Web/src/components/lucky-spin/ResultModal.tsx
  - Moxic.Web/src/components/layout/Navbar.tsx
  - Moxic.Web/src/App.tsx
autonomous: true
requirements: [SMV-COUPON-MODEL, SMV-SPIN-COUPON, SMV-WALLET, SMV-CHECKOUT, SMV-ADMIN-COUPONS, SMV-COOLDOWN-MSG]

must_haves:
  truths:
    - "A logged-in, verified customer who wins a configured Discount prize gets a SpinReward coupon (code = reward code, owned by that account, expires DiscountValidDays after the win) that appears at once in /account/coupons; the result modal says it was added to the wallet. A guest winner sees the reward code with a 'Đăng nhập và nhận mã vào ví' link, and can claim it exactly once from /account/coupons ('Nhập mã thưởng'); a second account claiming the same code gets 'Mã thưởng đã được tài khoản khác nhận.' Game prizes and unconfigured (legacy) Discount prizes still say 'liên hệ Moxic' as before"
    - "/account/coupons ('Mã giảm giá của tôi') lists the customer's own coupons in tabs Có thể dùng / Đã dùng / Hết hạn with discount, conditions (min order, game scope), expiry, copyable code and a 'Dùng ngay' button to /checkout?coupon=CODE"
    - "At checkout a logged-in customer can type a code or pick one from the wallet; POST /api/coupons/validate returns a server-computed preview (subtotal, discount, total) and the summary shows Tạm tính / Giảm giá (CODE) / Tổng cộng. Guests see 'Đăng nhập để dùng mã giảm giá'. One coupon per order"
    - "Order creation prices every line from Game.SalePrice (client prices are ignored), re-validates the coupon (active, dates, total and per-customer limits, owner, MinOrderAmount on the applicable subtotal, GameId scope, Percent cap, discount <= applicable amount, rounded to whole đồng) and redeems it atomically in the same transaction as the order; parallel orders can never push UsedCount above MaxTotalUses or a customer above MaxUsesPerCustomer"
    - "When an order becomes Cancelled (admin transition or the 24h payment timeout) its redemption is released exactly once (ReleasedAt set, UsedCount - 1) inside the cancel transaction"
    - "The confirmation page (items, Tạm tính, Giảm giá, Tổng cộng, and a 'Số tiền cần chuyển' line next to the QR), order history list/detail, admin order list/detail, and the admin new-order email all show the discount line and the discounted total"
    - "Admin 'Mã giảm giá sự kiện' page: create one code or bulk-generate N codes with a prefix, edit terms, toggle active, delete only unused codes, see usage count and the redemption list (customer, order, amount, released); a filter shows SpinReward coupons with their owner. The Lucky Spin prize form configures Discount prizes (type, value, max discount, min order, game scope, valid days)"
    - "The FreeInterval 409 COOLDOWN message states the real remaining wait (e.g. 'sau 23 giờ 59 phút') instead of 'sau ít phút nữa'"
    - "dotnet build API/Moxic.slnx and npm run build in Moxic.Web and Moxic.Admin all pass"
  artifacts:
    - path: "API/Moxic.Infrastructure/Data/CouponSchemaBootstrap.cs"
      provides: "Idempotent DDL for Coupons, CouponRedemptions, Orders.CouponId/CouponCode/DiscountAmount, SpinPrizes.Discount* columns"
      contains: "CREATE TABLE IF NOT EXISTS \"Coupons\""
    - path: "API/Moxic.Api/Services/CouponRules.cs"
      provides: "Code normalization/generation, term validation, Evaluate (all rules) + ComputeDiscount, spin reward coupon factory, FormatVnd, ToUtc"
      contains: "ComputeDiscount"
    - path: "API/Moxic.Api/Services/CouponService.cs"
      provides: "PriceLinesAsync, QuoteAsync, RedeemAsync (conditional UPDATE + per-customer recount), ReleaseForOrderAsync, ClaimAsync, GetWalletAsync"
      contains: "ReleasedAt == null"
    - path: "API/Moxic.Api/Controllers/CouponsController.cs"
      provides: "POST /api/coupons/validate"
      contains: "validate"
    - path: "API/Moxic.Api/Controllers/AccountCouponsController.cs"
      provides: "GET /api/account/coupons, POST /api/account/coupons/claim"
      contains: "claim"
    - path: "API/Moxic.Api/Controllers/AdminCouponsController.cs"
      provides: "Admin CRUD, bulk generate, toggle, redemptions"
      contains: "Authorize(Roles = \"Admin\")"
    - path: "Moxic.Admin/src/pages/Coupons.tsx"
      provides: "Admin 'Mã giảm giá sự kiện' page"
      min_lines: 200
    - path: "Moxic.Web/src/pages/CouponWalletPage.tsx"
      provides: "Customer wallet + claim"
      min_lines: 120
    - path: "Moxic.Web/src/components/checkout/CouponBox.tsx"
      provides: "Checkout code input + wallet picker + server preview"
      contains: "validateCoupon"
  key_links:
    - from: "API/Moxic.Api/Controllers/OrdersController.cs"
      to: "CouponService.RedeemAsync"
      via: "called inside the order-creation transaction before SaveChanges/Commit"
      pattern: "RedeemAsync"
    - from: "API/Moxic.Api/Controllers/AdminOrdersController.cs"
      to: "CouponService.ReleaseForOrderAsync"
      via: "inside the status-change transaction when newStatus == Cancelled"
      pattern: "ReleaseForOrderAsync"
    - from: "API/Moxic.Api/Services/PaymentTimeoutService.cs"
      to: "CouponService.ReleaseForOrderAsync"
      via: "per-order transaction after the conditional Pending -> Cancelled update"
      pattern: "ReleaseForOrderAsync"
    - from: "API/Moxic.Api/Controllers/LuckySpinController.cs"
      to: "CouponRules.TryBuildSpinRewardCoupon"
      via: "coupon added in the open transaction on a configured Discount win"
      pattern: "TryBuildSpinRewardCoupon"
    - from: "API/Moxic.Api/Program.cs"
      to: "CouponSchemaBootstrap"
      via: "startup call right after LuckySpinCasesSchemaBootstrap.EnsureAsync"
      pattern: "CouponSchemaBootstrap.EnsureAsync"
    - from: "Moxic.Web/src/components/checkout/CheckoutForm.tsx"
      to: "POST /api/orders couponCode"
      via: "OrderCreateRequest.couponCode from the applied quote"
      pattern: "couponCode"
    - from: "Moxic.Web/src/pages/ConfirmationPage.tsx"
      to: "QRDisplay amount"
      via: "order.totalAmount (already discounted)"
      pattern: "amount="
---

<objective>
Make Discount prizes and event promo codes real, server-applied discounts for logged-in customers, fully wired across API, admin SPA and storefront:

1. Coupon + CouponRedemption model; Order gets CouponId, CouponCode (snapshot) and DiscountAmount (default 0). TotalAmount stays equal to the sum of line prices minus DiscountAmount (locked: idempotent bootstrap SQL + EF migration; existing orders get DiscountAmount 0).
2. Spin Discount prizes gain discount terms. A configured Discount win creates a SpinReward coupon in the open transaction: owned by the account when logged in, otherwise claimable later from the wallet.
3. Customer wallet "Mã giảm giá của tôi" with claim.
4. Checkout coupon input/wallet picker with server preview. Order creation re-prices and re-validates server-side, redeems atomically, and releases on cancellation (locked: login required, one coupon per order, server computes everything, usage counted at order creation and released on cancel, VND rounded to whole đồng).
5. Admin "Mã giảm giá sự kiện" page (single/bulk create, toggle, usage, redemptions, SpinReward filter), prize form discount fields, and discount shown in admin order views.
6. Runtime-testing fix: the FreeInterval COOLDOWN message states the real remaining time.

Purpose: implements every item of the 261103-smv-CONTEXT.md Task Boundary and all locked decisions.
Output: 2 tables + 9 columns (bootstrap + migration), 1 rules class, 1 service, 3 new controllers, 1 admin page, 1 wallet page, 1 checkout component, plus discount display on every order view.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@AGENTS.md
@.planning/quick/261103-smv-coupons-account-wallet-and-event-discoun/261103-smv-CONTEXT.md
@.planning/quick/261103-sls-multi-cases-points-music-and-reel-near-m/261103-sls-SUMMARY.md  (bootstrap pattern, PointsService "caller owns the transaction" pattern, conditional ExecuteUpdateAsync, BOM/EOL notes)
@.planning/quick/261103-sa8-customer-accounts-order-history-and-moxi/261103-sa8-SUMMARY.md  (MoxicCustomer scheme, CustomerAuthRules.Scheme/CustomerRole, RequireCustomer, useMe, accountApi.ts)

Backend sources (read each once; only what the current task needs):
- API/Moxic.Api/Controllers/OrdersController.cs: CreateOrder currently trusts the client `Price` and sums it. It authenticates the customer via `HttpContext.AuthenticateAsync(CustomerAuthRules.Scheme)` and enqueues `SendNewOrderNotificationToAdminAsync`. GetOrder builds OrderConfirmationResponse.
- API/Moxic.Api/Controllers/AdminOrdersController.cs: UpdateOrderStatus wraps SaveChanges in `await using (var tx = ...)` and calls `_points.AwardForCompletedOrderAsync` on Completed. Cancelled is reachable from Pending/AwaitingConfirmation/Verifying/ActionRequired and is terminal.
- API/Moxic.Api/Services/PaymentTimeoutService.cs: every 15 min it auto-cancels Pending orders older than 24h. This is the **second cancel path**.
- API/Moxic.Api/Services/PointsService.cs: the pattern to copy. It never begins a transaction, uses conditional ExecuteUpdateAsync, and adds ledger rows to the context.
- API/Moxic.Api/Controllers/LuckySpinController.cs: OpenCase steps (4)-(9). There is a reward-code uniqueness loop over SpinHistories, the history snapshot and SaveChanges/Commit. The FreeInterval 409 message sits in step (5).
- API/Moxic.Api/Services/LuckySpinRules.cs: `CodeAlphabet` "ABCDEFGHJKMNPQRSTUVWXYZ23456789", `GenerateCode(int)`, `GenerateRewardCode()` ("MX" + 8), `NormalizeCode` (6..32).
- API/Moxic.Api/Controllers/AdminLuckySpinController.cs: `ApplyPrizeAsync` has a per-type switch, Discount currently only requires a name. `PrizeUpsertRequest` and `AdminPrizeDto` are positional records at the bottom of the file. `GET game-options?search=` returns `[{ id, name }]` (max 50). ExpiresAt UTC normalization is at lines ~228-236.
- API/Moxic.Infrastructure/Data/LuckySpinCasesSchemaBootstrap.cs: bootstrap shape to copy (PartA/PartB/PartC raw strings, `DO $EF$` block, no curly braces, separate ExecuteSqlRawAsync calls).
- API/Moxic.Infrastructure/Data/MoxicDbContext.cs: IdentityDbContext<IdentityUser> (`_db.Users` available), Order config at ~line 102, PointsTransaction config pattern at ~line 265.
- API/Moxic.Api/Program.cs: DI at ~line 85-90, AddRateLimiter at ~line 164 (policies partitioned by `LuckySpinRules.GetClientIp(ctx)`), bootstrap calls at ~line 246-248, global JsonStringEnumConverter.
- API/Moxic.Api/Controllers/AccountOrdersController.cs and AccountPointsController.cs: the customer `[Authorize(AuthenticationSchemes = CustomerAuthRules.Scheme, Roles = CustomerAuthRules.CustomerRole)]` pattern and the projections.

Admin SPA (Task 2): Moxic.Admin/src/lib/api.ts (apiFetch/apiUrl), lib/luckySpinAdmin.ts (readApiError), pages/LuckySpinCodes.tsx (generate modal + table + datetime-local → toISOString), pages/Customers.tsx (list styling), pages/LuckySpinPrizes.tsx, pages/OrderDetailModal.tsx, pages/OrderList.tsx, App.tsx (navItems + lazy routes; the mobile bottom nav already scrolls horizontally).
Storefront (Task 3): lib/accountApi.ts (own axios instance pattern), hooks/useAccount.ts, pages/PointsHistoryPage.tsx (account page styling), components/checkout/*, pages/CheckoutPage.tsx, pages/ConfirmationPage.tsx, pages/OrderHistory*.tsx, components/lucky-spin/ResultModal.tsx, lib/luckySpinApi.ts, components/layout/Navbar.tsx (account dropdown ~line 150-185 and mobile menu ~line 245-270), App.tsx (RequireCustomer element route), lib/utils.ts (formatPrice → "1.234đ", formatDate).

**File-encoding hazards.** Use targeted Edit only and never rewrite these whole. Check the BOM after editing.
- **UTF-8 BOM:** Program.cs, OrdersController.cs, AdminOrdersController.cs, Models/Dtos.cs, Order.cs, MoxicDbContext.cs, PaymentTimeoutService.cs, EmailService.cs, IServices.cs, Moxic.Admin/src/App.tsx, OrderDetailModal.tsx, OrderList.tsx, Moxic.Web/src/types/game.ts, ConfirmationPage.tsx.
- **Byte-identical:** AdminOrdersController.cs contains garbled strings such as "Kh?ng c? l? do". PaymentTimeoutService has "Het han thanh toan sau 24 gio". Leave both exactly as they are.
- **New files:** plain UTF-8 (no BOM), LF.

The working-copy EOL does not matter because core.autocrlf=true. Do not read appsettings*.json or .env. Do not use `python` in the shell.

<interfaces>
JSON is camelCase. Enums serialize as strings. Coupon errors are `{ error: string, code: string }` with HTTP 400 unless noted. Other errors are `{ error }`.

ENUMS (Moxic.Shared/Enums, one file each, stored as strings):
- CouponSource { Event, SpinReward }  (max length 20)
- CouponDiscountType { Percent, Fixed }  (max length 10)

ENTITIES (Moxic.Core/Entities):
- Coupon:
  - Id Guid; Code string (32, required, unique, UPPERCASE); Name string (100, required); Source CouponSource.
  - DiscountType CouponDiscountType; Value decimal (18,2); MaxDiscountAmount decimal? (18,2, Percent only); MinOrderAmount decimal? (18,2); GameId Guid? (no FK — a deleted game makes the coupon match nothing).
  - StartsAt DateTime?; ExpiresAt DateTime?; MaxTotalUses int?; MaxUsesPerCustomer int (initializer 1); UsedCount int; IsActive bool (initializer true).
  - OwnerUserId string? (no FK, indexed; set for SpinReward once owned); ClaimedAt DateTime?; SpinHistoryId Guid? (no FK).
  - CreatedBy string? (256); CreatedAt; UpdatedAt; Redemptions ICollection<CouponRedemption>.
  - No HasDefaultValue on Coupon columns (the table is new).
- CouponRedemption: Id Guid; CouponId Guid (FK Coupons, **Restrict**); UserId string (required, no FK); OrderId Guid (FK Orders, Cascade, **UNIQUE** — one coupon per order); DiscountAmount decimal (18,2); CreatedAt; ReleasedAt DateTime?; navigations Coupon? and Order?.
- Order (+): CouponId Guid? (FK Coupons, SetNull, configured via HasOne<Coupon>().WithMany(); no navigation on Order); CouponCode string? (32, snapshot); DiscountAmount decimal (decimal(18,2), HasDefaultValue(0m)).
- SpinPrize (+): DiscountType CouponDiscountType? (string, 10); DiscountValue decimal? (18,2); DiscountMaxAmount decimal? (18,2); DiscountMinOrderAmount decimal? (18,2); DiscountGameId Guid? (no FK; separate from GameId so Discount prizes never show a game cover); DiscountValidDays int?.
- DbSets: Coupons, CouponRedemptions. Indexes: Coupons(Code) unique, Coupons(OwnerUserId), Coupons(Source, CreatedAt), CouponRedemptions(OrderId) unique, CouponRedemptions(CouponId, UserId), Orders(CouponId).

BOOTSTRAP DDL (CouponSchemaBootstrap: same shape as LuckySpinCasesSchemaBootstrap; PartA, PartB and PartC run as three ExecuteSqlRawAsync calls in order; NO curly braces anywhere; reconcile names/types with `dotnet ef migrations script AddSpinCasesPointsMusic AddCoupons` output):

```sql
-- Part A
CREATE TABLE IF NOT EXISTS "Coupons" (
    "Id" uuid NOT NULL,
    "Code" character varying(32) NOT NULL,
    "Name" character varying(100) NOT NULL,
    "Source" character varying(20) NOT NULL,
    "DiscountType" character varying(10) NOT NULL,
    "Value" numeric(18,2) NOT NULL,
    "MaxDiscountAmount" numeric(18,2),
    "MinOrderAmount" numeric(18,2),
    "GameId" uuid,
    "StartsAt" timestamp with time zone,
    "ExpiresAt" timestamp with time zone,
    "MaxTotalUses" integer,
    "MaxUsesPerCustomer" integer NOT NULL,
    "UsedCount" integer NOT NULL,
    "IsActive" boolean NOT NULL,
    "OwnerUserId" text,
    "ClaimedAt" timestamp with time zone,
    "SpinHistoryId" uuid,
    "CreatedBy" character varying(256),
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_Coupons" PRIMARY KEY ("Id")
);
CREATE TABLE IF NOT EXISTS "CouponRedemptions" (
    "Id" uuid NOT NULL,
    "CouponId" uuid NOT NULL,
    "UserId" text NOT NULL,
    "OrderId" uuid NOT NULL,
    "DiscountAmount" numeric(18,2) NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "ReleasedAt" timestamp with time zone,
    CONSTRAINT "PK_CouponRedemptions" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_CouponRedemptions_Coupons_CouponId" FOREIGN KEY ("CouponId") REFERENCES "Coupons" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_CouponRedemptions_Orders_OrderId" FOREIGN KEY ("OrderId") REFERENCES "Orders" ("Id") ON DELETE CASCADE
);
ALTER TABLE "Orders" ADD COLUMN IF NOT EXISTS "CouponId" uuid;
ALTER TABLE "Orders" ADD COLUMN IF NOT EXISTS "CouponCode" character varying(32);
ALTER TABLE "Orders" ADD COLUMN IF NOT EXISTS "DiscountAmount" numeric(18,2) NOT NULL DEFAULT 0.0;
ALTER TABLE "SpinPrizes" ADD COLUMN IF NOT EXISTS "DiscountType" character varying(10);
ALTER TABLE "SpinPrizes" ADD COLUMN IF NOT EXISTS "DiscountValue" numeric(18,2);
ALTER TABLE "SpinPrizes" ADD COLUMN IF NOT EXISTS "DiscountMaxAmount" numeric(18,2);
ALTER TABLE "SpinPrizes" ADD COLUMN IF NOT EXISTS "DiscountMinOrderAmount" numeric(18,2);
ALTER TABLE "SpinPrizes" ADD COLUMN IF NOT EXISTS "DiscountGameId" uuid;
ALTER TABLE "SpinPrizes" ADD COLUMN IF NOT EXISTS "DiscountValidDays" integer;

-- Part B (single DO block; PostgreSQL has no ADD CONSTRAINT IF NOT EXISTS)
DO $EF$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_Orders_Coupons_CouponId') THEN
        ALTER TABLE "Orders" ADD CONSTRAINT "FK_Orders_Coupons_CouponId" FOREIGN KEY ("CouponId") REFERENCES "Coupons" ("Id") ON DELETE SET NULL;
    END IF;
END $EF$;

-- Part C
CREATE UNIQUE INDEX IF NOT EXISTS "IX_Coupons_Code" ON "Coupons" ("Code");
CREATE INDEX IF NOT EXISTS "IX_Coupons_OwnerUserId" ON "Coupons" ("OwnerUserId");
CREATE INDEX IF NOT EXISTS "IX_Coupons_Source_CreatedAt" ON "Coupons" ("Source", "CreatedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "IX_CouponRedemptions_OrderId" ON "CouponRedemptions" ("OrderId");
CREATE INDEX IF NOT EXISTS "IX_CouponRedemptions_CouponId_UserId" ON "CouponRedemptions" ("CouponId", "UserId");
CREATE INDEX IF NOT EXISTS "IX_Orders_CouponId" ON "Orders" ("CouponId");
```

CouponRules (static, Moxic.Api/Services/CouponRules.cs):
- `const string RateLimitPolicy = "coupon"`; `const int MaxCartItems = 50`; `const int DefaultValidDays = 30`; `const int MaxBulkCount = 500`.
- `string? NormalizeCode(string? raw)`: trims, removes spaces and '-', uppercases. Returns null unless the result is 4..32 chars of A-Z0-9.
- `string? NormalizePrefix(string? raw)`: same cleaning. Allows 0..12 chars ("" is fine). Returns null if invalid.
- `string GenerateCode(string prefix)` = prefix + `LuckySpinRules.GenerateCode(8)`.
- `record PricedLine(Guid GameId, string GameName, decimal Price)`.
- `record CouponTerms(CouponDiscountType Type, decimal Value, decimal? MaxDiscountAmount, decimal? MinOrderAmount, Guid? GameId)`.
- `(CouponTerms? Terms, string? Error) NormalizeTerms(CouponDiscountType type, decimal value, decimal? max, decimal? min, Guid? gameId)`. It rounds the money fields to whole đồng.
  - **Percent:** value is rounded to 2 decimals and must be in (0, 100]. Max is null or > 0.
  - **Fixed:** value must be in [1, 100000000]. Max is forced to null.
  - **Min:** null, or >= 0 (0 becomes null).
  - **Error messages:** "Phần trăm giảm phải lớn hơn 0 và tối đa 100.", "Số tiền giảm không hợp lệ.", "Mức giảm tối đa phải lớn hơn 0.", "Giá trị đơn tối thiểu không hợp lệ.".
- `decimal ComputeDiscount(CouponTerms t, decimal applicable)`:
  - raw = Percent ? applicable * Value / 100 : Value.
  - If Percent and Max is set, cap at Max.
  - Round with `Math.Round(raw, 0, MidpointRounding.AwayFromZero)`, then cap at applicable.
- `record CouponEvaluation(bool Ok, string? ErrorCode, string? Error, decimal Subtotal, decimal ApplicableAmount, decimal DiscountAmount, decimal Total)`.
- `CouponEvaluation Evaluate(Coupon c, string userId, IReadOnlyList<PricedLine> lines, int userActiveRedemptions, DateTime now, string? scopedGameName)`. Checks run in this order and the first failure wins:
  1. COUPON_INACTIVE "Mã giảm giá đã bị vô hiệu hóa."
  2. COUPON_NOT_STARTED "Mã giảm giá chưa đến thời gian áp dụng." (StartsAt > now)
  3. COUPON_EXPIRED "Mã giảm giá đã hết hạn." (ExpiresAt <= now)
  4. COUPON_NOT_OWNER "Mã giảm giá này thuộc về tài khoản khác." (OwnerUserId set and != userId)
  5. COUPON_EXHAUSTED "Mã giảm giá đã hết lượt sử dụng." (MaxTotalUses set and UsedCount >= it)
  6. COUPON_USER_LIMIT "Bạn đã dùng hết lượt cho mã này." (userActiveRedemptions >= MaxUsesPerCustomer)
  7. applicable = GameId null ? subtotal : the sum of lines with that GameId. If GameId is set and applicable == 0 → COUPON_GAME_SCOPE "Mã chỉ áp dụng cho {scopedGameName ?? "một game khác"} — game này không có trong giỏ hàng."
  8. MinOrderAmount set and applicable < it → COUPON_MIN_ORDER "Đơn hàng cần tối thiểu {FormatVnd(min)} (phần được áp dụng) để dùng mã này."
  9. discount = ComputeDiscount. If discount <= 0 → COUPON_NOT_APPLICABLE "Mã không áp dụng được cho giỏ hàng này."

  On success, Total = subtotal - discount.
- Additional failure codes used by the service: COUPON_NOT_FOUND "Mã giảm giá không tồn tại.", COUPON_LOGIN_REQUIRED "Đăng nhập để dùng mã giảm giá.".
- `Coupon? TryBuildSpinRewardCoupon(SpinPrize prize, string code, Guid spinId, string? ownerUserId, DateTime now)`. Returns null unless Type == Discount, DiscountType is set and DiscountValue > 0. Otherwise it builds:
  - Source SpinReward, Code = code, Name = prize.Name (truncated to 100).
  - Terms copied from the prize. MaxDiscountAmount only for Percent. GameId = DiscountGameId.
  - ExpiresAt = now.AddDays(DiscountValidDays ?? 30). MaxTotalUses 1, MaxUsesPerCustomer 1, IsActive true.
  - OwnerUserId = ownerUserId, ClaimedAt = owner != null ? now : null, SpinHistoryId = spinId, CreatedAt = UpdatedAt = now.
- `string FormatVnd(decimal v)` = v.ToString("N0", CultureInfo.GetCultureInfo("vi-VN")) + "đ".
- `DateTime? ToUtc(DateTime? v)`: Unspecified → SpecifyKind Utc, else ToUniversalTime (same as AdminLuckySpinController).
- `string WalletStatus(Coupon c, int userActive, DateTime now)` returns "Inactive" | "Expired" | "Used" | "Upcoming" | "Usable", in that precedence. Used = userActive >= MaxUsesPerCustomer, or total exhausted.

CouponService (scoped, Moxic.Api/Services/CouponService.cs; ctor MoxicDbContext + ILogger). **Never begins a transaction — callers own it** (PointsService pattern).
- `Task<(List<PricedLine>? Lines, string? Error)> PriceLinesAsync(IReadOnlyList<Guid> gameIds)`:
  - Empty list → "Giỏ hàng trống". More than MaxCartItems → "Giỏ hàng quá lớn.".
  - Loads `Games.SalePrice` and `Name`. Any missing id → "Một số game trong giỏ hàng không còn bán, vui lòng cập nhật giỏ hàng.".
  - Lines keep request order. Duplicates stay as separate lines.
- `Task<CouponEvaluation> QuoteAsync(string userId, string? rawCode, IReadOnlyList<PricedLine> lines)`: read-only preview.
  - Normalize, load AsNoTracking by Code, count the user's active redemptions (ReleasedAt == null), resolve the scoped game name, then Evaluate.
  - An unowned SpinReward coupon (OwnerUserId null) previews as usable.
- `Task<(CouponEvaluation Eval, Coupon? Coupon)> RedeemAsync(string userId, string? rawCode, IReadOnlyList<PricedLine> lines, Guid orderId)`. It **must run inside the caller's transaction**, and the caller rolls back whenever Eval.Ok is false.
  - (a) Normalize the code and load the coupon. Not found → COUPON_NOT_FOUND.
  - (b) If Source == SpinReward and OwnerUserId is null, call BindOwnerAsync(coupon.Id, userId, now). If it returns false, re-read the owner; when it is not userId → COUPON_NOT_OWNER.
  - (c) Run Evaluate as a pre-check.
  - (d) Atomic claim with `ExecuteUpdateAsync`. WHERE Id = x AND IsActive AND (StartsAt null or <= now) AND (ExpiresAt null or > now) AND (OwnerUserId null or == userId) AND (MaxTotalUses null or UsedCount < MaxTotalUses). SET UsedCount + 1, UpdatedAt.
    - affected == 0: re-read the coupon, Evaluate again to map the reason, and fall back to COUPON_EXHAUSTED.
  - (e) **After** the UPDATE (the row lock is now held until commit), count the user's active redemptions again. If the count is >= MaxUsesPerCustomer → COUPON_USER_LIMIT. Each READ COMMITTED statement sees concurrent committed redemptions.
  - (f) Add a tracked CouponRedemption (DiscountAmount = Eval.DiscountAmount, CreatedAt now). Do not save; the caller's SaveChanges inserts it together with the order.
- `Task<bool> ReleaseForOrderAsync(Guid orderId, CancellationToken ct = default)`:
  - Find the active redemption for the order (OrderId, ReleasedAt == null).
  - Run a conditional ExecuteUpdate that sets ReleasedAt = now WHERE Id AND ReleasedAt == null.
  - Only when that affects 1 row, run `UsedCount - 1, UpdatedAt` WHERE Id AND UsedCount > 0. Return true when released.
- `Task<bool> BindOwnerAsync(Guid couponId, string userId, DateTime now)`:
  - Runs ExecuteUpdate SET OwnerUserId, ClaimedAt WHERE Id AND OwnerUserId == null.
  - When it affects 1 row and the coupon has SpinHistoryId, it also sets SpinHistories.IsClaimed = true and ClaimedAt = now WHERE IsClaimed == false.
- `Task<(int Status, object Body)> ClaimAsync(string userId, string? rawCode)`. Status values: 200 with ClaimCouponResponse, 400/409 with `{ error, code }`.
  - Invalid or not a coupon: if SpinHistories has that RewardCode with PrizeType Discount → 400 COUPON_LEGACY_REWARD "Mã thưởng này được phát trước khi có ví mã giảm giá — vui lòng liên hệ Moxic để được hỗ trợ.". With PrizeType Game → 400 COUPON_GAME_REWARD "Đây là mã thưởng game — vui lòng liên hệ Moxic để nhận game.". Otherwise 400 COUPON_NOT_FOUND "Mã thưởng không hợp lệ.".
  - An Event coupon → 400 COUPON_EVENT_CODE "Mã giảm giá sự kiện không cần lưu vào ví — hãy nhập trực tiếp khi thanh toán.".
  - Owner == userId → 200 with AlreadyOwned true.
  - Owner is someone else → 409 COUPON_TAKEN "Mã thưởng đã được tài khoản khác nhận.".
  - Owner null → BindOwnerAsync, then SaveChanges is not needed (ExecuteUpdate only). A lost race is re-read and mapped as above.
- `Task<List<WalletCouponDto>> GetWalletAsync(string userId)`:
  - Loads OwnerUserId == userId, newest first, Take 200.
  - Counts active redemptions grouped by CouponId and maps game names in one query each.
  - Status via WalletStatus. UsesLeft = max(0, MaxUsesPerCustomer - userActive), and 0 when total is exhausted.

CUSTOMER DTOs (Moxic.Api/Models/CouponDtos.cs, positional records):
- `CouponCartItemDto(Guid GameId)`; `CouponValidateRequest(string? Code, IReadOnlyList<CouponCartItemDto>? Items)`
- `CouponQuoteDto(string Code, string Name, CouponSource Source, CouponDiscountType DiscountType, decimal Value, decimal? MaxDiscountAmount, decimal? MinOrderAmount, Guid? GameId, string? GameName, DateTime? ExpiresAt, decimal Subtotal, decimal ApplicableAmount, decimal DiscountAmount, decimal Total)`
- `WalletCouponDto(Guid Id, string Code, string Name, CouponSource Source, CouponDiscountType DiscountType, decimal Value, decimal? MaxDiscountAmount, decimal? MinOrderAmount, Guid? GameId, string? GameName, DateTime? StartsAt, DateTime? ExpiresAt, string Status, int UsesLeft, DateTime CreatedAt)`
- `WalletCouponsResponse(IReadOnlyList<WalletCouponDto> Items)`; `ClaimCouponRequest(string? Code)`; `ClaimCouponResponse(WalletCouponDto Coupon, bool AlreadyOwned)`

ADMIN DTOs (appended to CouponDtos.cs in Task 2):
- `AdminCouponUpsertRequest(string? Code, string? Name, CouponDiscountType DiscountType, decimal Value, decimal? MaxDiscountAmount, decimal? MinOrderAmount, Guid? GameId, DateTime? StartsAt, DateTime? ExpiresAt, int? MaxTotalUses, int? MaxUsesPerCustomer, bool IsActive)`
- `AdminCouponBulkRequest(string? Prefix, int Count, string? Name, CouponDiscountType DiscountType, decimal Value, decimal? MaxDiscountAmount, decimal? MinOrderAmount, Guid? GameId, DateTime? StartsAt, DateTime? ExpiresAt, int? MaxTotalUses, int? MaxUsesPerCustomer, bool IsActive)`
- `ToggleCouponRequest(bool IsActive)`
- `AdminCouponDto(Guid Id, string Code, string Name, CouponSource Source, CouponDiscountType DiscountType, decimal Value, decimal? MaxDiscountAmount, decimal? MinOrderAmount, Guid? GameId, string? GameName, DateTime? StartsAt, DateTime? ExpiresAt, int? MaxTotalUses, int MaxUsesPerCustomer, int UsedCount, bool IsActive, string? OwnerUserId, string? OwnerEmail, DateTime? ClaimedAt, Guid? SpinHistoryId, string? CreatedBy, DateTime CreatedAt, DateTime UpdatedAt)`
- `AdminCouponListResponse(IReadOnlyList<AdminCouponDto> Items, int TotalCount, int Page, int PageSize)`; `AdminCouponBulkResponse(int Count, IReadOnlyList<string> Codes)`
- `AdminCouponRedemptionDto(Guid Id, Guid OrderId, string OrderCode, string OrderStatus, string? UserEmail, decimal DiscountAmount, DateTime CreatedAt, DateTime? ReleasedAt)`

ENDPOINTS:
- `POST /api/coupons/validate`
  - Auth: `[Authorize(AuthenticationSchemes = CustomerAuthRules.Scheme, Roles = CustomerAuthRules.CustomerRole)]`. Guests get a bare 401, and the client shows "Đăng nhập để dùng mã giảm giá.".
  - `[EnableRateLimiting(CouponRules.RateLimitPolicy)]`.
  - Body CouponValidateRequest. Returns 200 CouponQuoteDto, or 400 `{error, code}` (cart errors use code "CART_INVALID").
- `GET /api/account/coupons` (same customer Authorize) → 200 WalletCouponsResponse.
- `POST /api/account/coupons/claim` (customer Authorize + coupon rate limit), body ClaimCouponRequest → 200 ClaimCouponResponse, or 400/409 `{error, code}`.
- `POST /api/orders`: CreateOrderRequest gains `public string? CouponCode { get; init; }`. Client `Price` is now ignored. CreateOrderResponse gains `DiscountAmount` (decimal) and `CouponCode` (string?). `[EnableRateLimiting(CouponRules.RateLimitPolicy)]`. A coupon from a guest → 400 COUPON_LOGIN_REQUIRED.
- `GET /api/orders/{orderCode}` (Task 2): OrderConfirmationResponse gains SubtotalAmount, DiscountAmount, CouponCode.
- Admin `api/admin/coupons` (`[Authorize(Roles = "Admin")]`, Task 2):
  - `GET ?source=Event|SpinReward&search=&page=1&pageSize=50` → AdminCouponListResponse. pageSize is clamped to 1..200. search matches Code (uppercased contains) or Name (lowercased contains). Newest first.
  - `POST /` AdminCouponUpsertRequest → 201 AdminCouponDto, 400 or 409.
  - `POST /bulk` AdminCouponBulkRequest → 200 AdminCouponBulkResponse.
  - `PUT /{id:guid}` AdminCouponUpsertRequest (Code and Source immutable, Code ignored) → 200 AdminCouponDto.
  - `PATCH /{id:guid}/active` ToggleCouponRequest → 200 AdminCouponDto.
  - `DELETE /{id:guid}` → 204, or 409 "Mã đã có lượt sử dụng — hãy tắt mã thay vì xóa." when any redemption row exists.
  - `GET /{id:guid}/redemptions` → AdminCouponRedemptionDto[], newest first.
- Admin prizes (Task 2): PrizeUpsertRequest gains trailing optional params `CouponDiscountType? DiscountType = null, decimal? DiscountValue = null, decimal? DiscountMaxAmount = null, decimal? DiscountMinOrderAmount = null, Guid? DiscountGameId = null, int? DiscountValidDays = null`. AdminPrizeDto gains trailing `DiscountType, DiscountValue, DiscountMaxAmount, DiscountMinOrderAmount, DiscountGameId, string? DiscountGameName, DiscountValidDays`.
- Lucky spin open (Task 1): OpenCaseResultDto gains trailing `bool CouponCreated, bool CouponInWallet, DateTime? CouponExpiresAt`.
- Order read models (Task 2): AdminOrderListItem gains DiscountAmount and CouponCode. AdminOrderDetailResponse and OrderConfirmationResponse gain SubtotalAmount (= TotalAmount + DiscountAmount), DiscountAmount and CouponCode. AccountOrderSummaryDto (inherited by the detail DTO) gains SubtotalAmount, DiscountAmount and CouponCode.

STOREFRONT TS (Task 3, Moxic.Web/src/lib/couponApi.ts; own axios instance with withCredentials like accountApi.ts):
- `type CouponDiscountType = "Percent" | "Fixed"`, `type CouponSource = "Event" | "SpinReward"`, `type WalletCouponStatus = "Usable" | "Upcoming" | "Used" | "Expired" | "Inactive"`.
- Interfaces `CouponQuote` and `WalletCoupon` mirror the DTOs (camelCase, dates as string | null, decimals as number).
- `validateCoupon(code: string, gameIds: string[]): Promise<CouponQuote>` posts `{ code, items: gameIds.map(gameId => ({ gameId })) }`.
- `getMyCoupons(): Promise<WalletCoupon[]>` returns `.items`.
- `claimCoupon(code: string): Promise<{ coupon: WalletCoupon; alreadyOwned: boolean }>`.
- `describeCouponDiscount(c)` → "Giảm 10% (tối đa 50.000đ)" or "Giảm 50.000đ".
- `describeCouponConditions(c)` → string[]: "Đơn tối thiểu 200.000đ", "Chỉ áp dụng cho {gameName ?? "một game"}".
- `getCouponErrorMessage(err, fallback)`: 401 → "Đăng nhập để dùng mã giảm giá."; 429 → "Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút."; otherwise data.error or fallback.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Backend coupon engine — model, bootstrap + migration, rules/service, validate/wallet/claim APIs, checkout redemption, cancel release, spin Discount → coupon, cooldown message fix</name>
  <files>API/Moxic.Shared/Enums/CouponSource.cs, API/Moxic.Shared/Enums/CouponDiscountType.cs, API/Moxic.Core/Entities/Coupon.cs, API/Moxic.Core/Entities/CouponRedemption.cs, API/Moxic.Core/Entities/Order.cs, API/Moxic.Core/Entities/SpinPrize.cs, API/Moxic.Infrastructure/Data/MoxicDbContext.cs, API/Moxic.Infrastructure/Data/CouponSchemaBootstrap.cs, API/Moxic.Infrastructure/Data/Migrations/*_AddCoupons.cs, API/Moxic.Infrastructure/Data/Migrations/*_AddCoupons.Designer.cs, API/Moxic.Infrastructure/Data/Migrations/MoxicDbContextModelSnapshot.cs, API/Moxic.Api/Services/CouponRules.cs, API/Moxic.Api/Services/CouponService.cs, API/Moxic.Api/Models/CouponDtos.cs, API/Moxic.Api/Controllers/CouponsController.cs, API/Moxic.Api/Controllers/AccountCouponsController.cs, API/Moxic.Api/Controllers/OrdersController.cs, API/Moxic.Api/Models/Dtos.cs, API/Moxic.Api/Controllers/AdminOrdersController.cs, API/Moxic.Api/Services/PaymentTimeoutService.cs, API/Moxic.Api/Controllers/LuckySpinController.cs, API/Moxic.Api/Services/LuckySpinRules.cs, API/Moxic.Api/Models/LuckySpinDtos.cs, API/Moxic.Core/Interfaces/IServices.cs, API/Moxic.Infrastructure/Services/EmailService.cs, API/Moxic.Api/Program.cs</files>
  <action>
**PRECONDITION** (stop if it fails):
- `git log --oneline -10` must contain 5c65817 and d083bc0.
- `git status --short` must show only `.planning/` entries.
- Record baseline builds for the SUMMARY: `dotnet build API/Moxic.slnx`, then `npm run build` in Moxic.Web and in Moxic.Admin. The expected baseline is 0 errors plus the existing 8 NU1902/NU1903 warnings.

**Model** (CONTEXT item 1; locked: bootstrap + migration):
- Create the two enums and the Coupon / CouponRedemption entities exactly as in `<interfaces>`.
- Order.cs (BOM): add CouponId, CouponCode and DiscountAmount with XML doc comments.
- SpinPrize.cs: add the six Discount* properties.
- MoxicDbContext (BOM, targeted inserts only):
  - DbSets Coupons and CouponRedemptions.
  - Coupon config: Code 32 required and unique; Name 100 required; Source and DiscountType via HasConversion<string> with max lengths 20 and 10; HasPrecision(18,2) on Value / MaxDiscountAmount / MinOrderAmount; CreatedBy 256; indexes OwnerUserId and (Source, CreatedAt).
  - CouponRedemption config: HasOne(Coupon).WithMany(Redemptions) with OnDelete Restrict; HasOne(Order).WithMany() with Cascade; unique OrderId; index (CouponId, UserId); DiscountAmount precision (18,2).
  - In the Order block: CouponCode max 32; DiscountAmount HasColumnType("decimal(18,2)").HasDefaultValue(0m); HasOne<Coupon>().WithMany().HasForeignKey(CouponId).OnDelete(SetNull) plus HasIndex(CouponId).
  - In the SpinPrize block: DiscountType HasConversion<string>().HasMaxLength(10); HasPrecision(18,2) on the three Discount money fields.

**Migration and bootstrap:**
- Run `dotnet ef migrations add AddCoupons --project API/Moxic.Infrastructure --startup-project API/Moxic.Api` and keep EF's output as generated.
- Run `dotnet ef migrations script AddSpinCasesPointsMusic AddCoupons --project API/Moxic.Infrastructure --startup-project API/Moxic.Api`. Reconcile it with the `<interfaces>` DDL and report any unrelated drift in the SUMMARY. This migration is safe on a populated DB: only nullable columns are added, plus DiscountAmount DEFAULT 0.
- Create CouponSchemaBootstrap.cs (namespace Moxic.Infrastructure.Data, public static class, XML doc like LuckySpinCasesSchemaBootstrap). PartA, PartB and PartC are const raw strings with the exact `<interfaces>` DDL. `EnsureAsync(MoxicDbContext db)` runs three ExecuteSqlRawAsync calls in order. No curly braces anywhere in the SQL.

**CouponRules.cs and CouponService.cs:** implement exactly per `<interfaces>`. Notes:
- Evaluate and ComputeDiscount are pure static functions.
- RedeemAsync performs the conditional UPDATE **before** the per-customer recount. The correctness argument depends on the row lock taken by that UPDATE, so put it in a code comment.
- Every money value is decimal, rounded to whole đồng, and never double.
- Use `RandomNumberGenerator` only, through `LuckySpinRules.GenerateCode`.

**CouponDtos.cs:** customer records only in this task.

**CouponsController** (`[Route("api/coupons")]`, POST `validate`):
- Get the user id from `User.FindFirstValue(ClaimTypes.NameIdentifier)`.
- PriceLinesAsync(request.Items gameIds). On error → 400 `{ error, code = "CART_INVALID" }`.
- Missing or blank code → 400 COUPON_NOT_FOUND "Vui lòng nhập mã giảm giá.".
- QuoteAsync. Ok → 200 CouponQuoteDto built from the coupon and the evaluation; otherwise 400 `{ error, code }`.

**AccountCouponsController** (`[Route("api/account/coupons")]`, same customer Authorize):
- GET → WalletCouponsResponse from GetWalletAsync.
- POST `claim` (with the coupon rate limit) → ClaimAsync, returning `StatusCode(status, body)`.

**OrdersController.CreateOrder** (BOM; targeted edits that keep the existing validation and the Xbox password protection):
- Add `[EnableRateLimiting(CouponRules.RateLimitPolicy)]` and inject CouponService.
- Move the customer authentication above pricing and store `customerId`.
- Normalize `couponCode = string.IsNullOrWhiteSpace(request.CouponCode) ? null : request.CouponCode`. If it is set while `customerId == null` → 400 `{ error = "Đăng nhập để dùng mã giảm giá.", code = "COUPON_LOGIN_REQUIRED" }`.
- `PriceLinesAsync(request.Items.Select(i => i.GameId).ToList())`. On error → 400 `{ error }`. This replaces the "Unknown Game" fallback and the client price (T-smv-01). subtotal = sum of line prices.
- Inside `await using var tx = await _db.Database.BeginTransactionAsync()`:
  - Add the order and one OrderDetail per priced line (GameName and Price from the server).
  - If a coupon code is present, call RedeemAsync(customerId, couponCode, lines, order.Id). If not Ok → `await tx.RollbackAsync()` and return 400 `{ error, code }`. Otherwise set order.CouponId, CouponCode (the coupon's stored Code), DiscountAmount, and TotalAmount = subtotal - discount.
  - SaveChangesAsync, then CommitAsync.
- After the commit, enqueue the admin email with discount and code.
- CreateOrderResponse also returns DiscountAmount and CouponCode.
- Dtos.cs (BOM): add the CreateOrderRequest.CouponCode and CreateOrderResponse fields. Keep `OrderItemRequest.Price` for compatibility and add a comment that the server ignores it.

**Release on cancel** (CONTEXT item 4: exactly once):
- AdminOrdersController (BOM, garbled strings byte-identical, targeted hunks only):
  - Inject CouponService.
  - Inside the existing `await using (var tx ...)` block, after SaveChangesAsync: when newStatus == Cancelled, call `ReleaseForOrderAsync(order.Id)`. When it returns true, LogInformation "Released coupon redemption for cancelled order {OrderCode}".
- PaymentTimeoutService (BOM), rewrite CheckExpiredOrdersAsync:
  - Select the candidates (Id, OrderCode, CustomerXboxEmail) that are Pending and older than the cutoff.
  - For each candidate, open its own transaction and run a conditional ExecuteUpdateAsync: Status = Cancelled, CancellationReason = "Het han thanh toan sau 24 gio" (identical text), UpdatedAt WHERE Id AND Status == Pending.
  - Skip and roll back when it affects 0 rows. That closes the race with an admin status change.
  - Then resolve CouponService from the same scope, call `ReleaseForOrderAsync(id, ct)`, commit, and send the cancellation email after the commit (keep the existing try/catch warning).
  - Log the number actually cancelled.

**Lucky spin** (CONTEXT item 2):
- LuckySpinController:
  - The reward-code loop also requires `!await _db.Coupons.AnyAsync(c => c.Code == candidate)`.
  - After the history entity is built and before SaveChanges: `ownerUserId = customer != null && customer.Value.User.EmailConfirmed ? customer.Value.UserId : null`, then `var coupon = rewardCode == null ? null : CouponRules.TryBuildSpinRewardCoupon(winner, rewardCode, spinId, ownerUserId, now)`.
  - If a coupon was built, add it to `_db.Coupons`. When the owner is set, also mark the history IsClaimed = true and ClaimedAt = now. Keep the history in a local variable so you can set these.
  - It commits in the same transaction (T-smv-10).
  - Pass `coupon != null`, `coupon?.OwnerUserId != null` and `coupon?.ExpiresAt` to the extended OpenCaseResultDto.
- Unconfigured Discount prizes keep the legacy behaviour: reward code only.
- Cooldown fix:
  - Add `LuckySpinRules.FormatWaitVi(TimeSpan remaining)`. Take total minutes = max(1, ceil(remaining.TotalMinutes)). Parts are "{d} ngày" when d > 0, "{h} giờ" when h > 0, and "{m} phút" only when d == 0 and m > 0, joined by spaces. Example: 1439 minutes → "23 giờ 59 phút".
  - The COOLDOWN 409 error becomes `$"Bạn đã dùng lượt miễn phí. Lượt tiếp theo sẽ mở sau {LuckySpinRules.FormatWaitVi(next - now)}."`. The code and nextFreeOpenAt stay unchanged.

**Email:**
- IServices.cs (BOM): `SendNewOrderNotificationToAdminAsync(string orderCode, string customerPhone, decimal totalAmount, decimal discountAmount = 0, string? couponCode = null)`.
- EmailService (BOM), same signature: when discountAmount > 0, add `<p>Tạm tính: {subtotal:N0}đ</p><p>Giảm giá ({WebUtility.HtmlEncode(couponCode)}): -{discountAmount:N0}đ</p>` before the existing "Tiền" line, where subtotal = totalAmount + discountAmount.

**Program.cs** (BOM, targeted inserts):
- `builder.Services.AddScoped<CouponService>();` next to PointsService.
- A third rate-limit policy `CouponRules.RateLimitPolicy`: fixed window of 20 per minute per `LuckySpinRules.GetClientIp(ctx)`, QueueLimit 0.
- `await CouponSchemaBootstrap.EnsureAsync(dbContext);` right after `LuckySpinCasesSchemaBootstrap.EnsureAsync`.

**Smoke test:** only if Postgres on localhost:5432 already accepts connections. Never start containers.
- Run the API.
- Create an event coupon directly via SQL INSERT or skip to the spin path.
- Check: validate → preview numbers; an order with the coupon → UsedCount 1 and a redemption row; cancel → ReleasedAt set and UsedCount 0; cancel again → no change.
- Record the results, or "skipped: DB not reachable", in the SUMMARY.

**Commit** with explicit paths only: `feat(quick-261103-smv): coupon engine, checkout redemption, spin discount coupons, wallet API`.
  </action>
  <verify>
    <automated>cd /c/Users/trung/OneDrive/Documents/project-moxic && dotnet build API/Moxic.slnx -nologo -v q && ls API/Moxic.Infrastructure/Data/Migrations/*_AddCoupons.cs && B=API/Moxic.Infrastructure/Data/CouponSchemaBootstrap.cs && grep -q 'CREATE TABLE IF NOT EXISTS "Coupons"' $B && grep -q 'CREATE TABLE IF NOT EXISTS "CouponRedemptions"' $B && grep -q 'ADD COLUMN IF NOT EXISTS "DiscountAmount"' $B && grep -q 'ADD COLUMN IF NOT EXISTS "DiscountValidDays"' $B && grep -q 'FK_Orders_Coupons_CouponId' $B && grep -q 'IX_CouponRedemptions_OrderId' $B && grep -q 'CouponSchemaBootstrap.EnsureAsync' API/Moxic.Api/Program.cs && grep -q 'AddScoped<CouponService>' API/Moxic.Api/Program.cs && grep -q 'CouponRules.RateLimitPolicy' API/Moxic.Api/Program.cs && grep -q 'RedeemAsync' API/Moxic.Api/Controllers/OrdersController.cs && grep -q 'PriceLinesAsync' API/Moxic.Api/Controllers/OrdersController.cs && grep -q 'ReleaseForOrderAsync' API/Moxic.Api/Controllers/AdminOrdersController.cs && grep -q 'ReleaseForOrderAsync' API/Moxic.Api/Services/PaymentTimeoutService.cs && grep -q 'SalePrice' API/Moxic.Api/Services/CouponService.cs && grep -q 'ReleasedAt == null' API/Moxic.Api/Services/CouponService.cs && grep -q 'UsedCount < [a-z]*.MaxTotalUses' API/Moxic.Api/Services/CouponService.cs && grep -q 'ComputeDiscount' API/Moxic.Api/Services/CouponRules.cs && grep -q 'TryBuildSpinRewardCoupon' API/Moxic.Api/Controllers/LuckySpinController.cs && grep -q 'FormatWaitVi' API/Moxic.Api/Controllers/LuckySpinController.cs && grep -q 'CustomerAuthRules.Scheme' API/Moxic.Api/Controllers/CouponsController.cs && grep -q 'CustomerAuthRules.Scheme' API/Moxic.Api/Controllers/AccountCouponsController.cs && grep -q 'CouponInWallet' API/Moxic.Api/Models/LuckySpinDtos.cs && grep -v '^\s*//' API/Moxic.Api/Services/CouponRules.cs API/Moxic.Api/Services/CouponService.cs | grep -c 'new Random\|Random\.Shared\|(double)' | grep -qx 0 && for f in API/Moxic.Api/Program.cs API/Moxic.Api/Controllers/OrdersController.cs API/Moxic.Api/Controllers/AdminOrdersController.cs API/Moxic.Api/Models/Dtos.cs API/Moxic.Core/Entities/Order.cs API/Moxic.Infrastructure/Data/MoxicDbContext.cs API/Moxic.Api/Services/PaymentTimeoutService.cs API/Moxic.Infrastructure/Services/EmailService.cs API/Moxic.Core/Interfaces/IServices.cs; do head -c3 $f | od -An -tx1 | grep -q 'ef bb bf' || { echo "BOM lost: $f"; exit 1; }; done && grep -q 'Het han thanh toan sau 24 gio' API/Moxic.Api/Services/PaymentTimeoutService.cs && echo OK</automated>
  </verify>
  <done>
- dotnet build passes with only the baseline NU190x warnings.
- Migration AddCoupons and the snapshot exist, and the bootstrap DDL matches the script output.
- Orders are priced from Game.SalePrice, and a coupon is redeemed atomically in the order transaction (total and per-customer limits are race-safe).
- Cancel by admin or timeout releases a redemption exactly once.
- A configured Discount win creates a SpinReward coupon (owned when logged in), and the reward code is unique across SpinHistories and Coupons.
- validate, wallet and claim endpoints work for customers and return 401 for guests.
- The cooldown message shows the real remaining time.
- BOMs are intact and the garbled strings are byte-identical.
- Committed with explicit paths.
  </done>
</task>

<task type="auto">
  <name>Task 2: Admin vertical — event coupons API + "Mã giảm giá sự kiện" page, prize discount config, discount in order read models and admin order views</name>
  <files>API/Moxic.Api/Controllers/AdminCouponsController.cs, API/Moxic.Api/Models/CouponDtos.cs, API/Moxic.Api/Controllers/AdminLuckySpinController.cs, API/Moxic.Api/Controllers/AdminOrdersController.cs, API/Moxic.Api/Controllers/OrdersController.cs, API/Moxic.Api/Models/Dtos.cs, API/Moxic.Api/Controllers/AccountOrdersController.cs, API/Moxic.Api/Models/AccountDtos.cs, Moxic.Admin/src/lib/couponAdmin.ts, Moxic.Admin/src/pages/Coupons.tsx, Moxic.Admin/src/App.tsx, Moxic.Admin/src/pages/LuckySpinPrizes.tsx, Moxic.Admin/src/pages/OrderDetailModal.tsx, Moxic.Admin/src/pages/OrderList.tsx</files>
  <action>
**Backend (CONTEXT item 5)**

**Admin DTOs:** append the admin records from `<interfaces>` to CouponDtos.cs.

**AdminCouponsController** (`[Route("api/admin/coupons")]`, `[ApiController]`, `[Authorize(Roles = "Admin")]`). Endpoints per `<interfaces>`. Rules:
- **Create (single):**
  - Name: trimmed, 1..100, otherwise "Vui lòng nhập tên mã (tối đa 100 ký tự).".
  - Code: blank means auto-generate `CouponRules.GenerateCode("")`. Otherwise NormalizeCode; null → "Mã chỉ gồm chữ A-Z và số, dài 4–32 ký tự.".
  - Uniqueness against Coupons.Code **and** SpinHistories.RewardCode → 409 "Mã đã tồn tại.".
  - Terms via CouponRules.NormalizeTerms. GameId, when set, must exist ("Game không tồn tại.").
  - Dates are normalized via ToUtc. If both are set, ExpiresAt must be > StartsAt ("Thời gian kết thúc phải sau thời gian bắt đầu."). ExpiresAt must be in the future on create.
  - MaxTotalUses: null or 1..1000000. MaxUsesPerCustomer: null means 1, otherwise 1..100.
  - Source = Event, CreatedBy = `User.Identity?.Name` (max 256), timestamps now.
- **Bulk:**
  - Count 1..500 ("Số lượng phải từ 1 đến 500."). Prefix via NormalizePrefix (null → "Tiền tố chỉ gồm A-Z và số, tối đa 12 ký tự."). Name is required. Terms and limits are validated as for single create.
  - Generate codes into a HashSet. In up to 5 rounds, remove collisions found in Coupons.Code / SpinHistories.RewardCode with one query per round and top up the set.
  - Insert everything with one SaveChanges and return the codes.
- **Update:**
  - Same validation, except Code and Source are immutable and ExpiresAt may lie in the past (this lets an admin end a code early).
  - MaxTotalUses must be >= UsedCount: "Tổng lượt không được nhỏ hơn số lượt đã dùng ({UsedCount}).".
  - Never touches OwnerUserId or UsedCount.
- **Toggle:** sets IsActive and UpdatedAt.
- **Delete:** 409 when any CouponRedemptions row exists.
- **List:** batch-load game names and owner emails with one query each (`_db.Games`, `_db.Users` where Id is in the owner ids).
- **Redemptions:** join Orders (OrderCode, Status.ToString()) and Users (Email) by UserId.

**AdminLuckySpinController ApplyPrizeAsync:**
- Discount case:
  - When `req.DiscountType` is null, store all six Discount* fields as null. This is the legacy/manual mode and keeps toggling old prizes working.
  - Otherwise use CouponRules.NormalizeTerms. DiscountValidDays: null → 30, must be 1..365 ("Hiệu lực mã phải từ 1 đến 365 ngày."). DiscountGameId must exist. Then assign the fields.
- Game and Luck: clear every Discount* field.
- Extend PrizeUpsertRequest and AdminPrizeDto with the trailing params and fields. ToAdminPrizeAsync fills DiscountGameName with a single name lookup when DiscountGameId is set.

**Order read models:**
- Dtos.cs (BOM): AdminOrderListItem gains DiscountAmount and CouponCode. AdminOrderDetailResponse and OrderConfirmationResponse gain SubtotalAmount, DiscountAmount and CouponCode.
- AdminOrdersController (BOM, garbled strings byte-identical): fill these in GetOrders and GetOrderDetail.
- OrdersController.GetOrder (BOM): fill them as well.
- AccountDtos.cs: AccountOrderSummaryDto gains `SubtotalAmount`, `DiscountAmount` and `CouponCode` (init properties).
- AccountOrdersController: add o.DiscountAmount and o.CouponCode to both projections and the OrderRow record, and map them, with Subtotal = Total + Discount.

**Admin SPA**

**couponAdmin.ts** (new):
- Types: CouponSource, CouponDiscountType, AdminCoupon, AdminCouponRedemption.
- `DISCOUNT_TYPE_LABELS` = { Percent: "Phần trăm", Fixed: "Số tiền cố định" }.
- `formatVnd(n)` = n.toLocaleString("vi-VN") + "₫".
- `describeDiscount({ discountType, value, maxDiscountAmount })` → "Giảm 10% (tối đa 50.000₫)" or "Giảm 50.000₫".
- Fetch helpers: list, create, bulk, update, toggle, remove, redemptions. Each uses apiFetch/apiUrl and throws `new Error(await readApiError(res, fallback))` (import readApiError from luckySpinAdmin.ts).

**Coupons.tsx** (new page; heading "Mã giảm giá sự kiện"). Reuse the steam-* styling of LuckySpinCodes.tsx / Customers.tsx.
- **Filters:** source tabs "Sự kiện" (Event, default) | "Thưởng vòng quay" (SpinReward) | "Tất cả". Debounced search (300 ms). Paging at 50.
- **Desktop table columns:**
  - Mã (mono, copy button)
  - Tên
  - Giảm (describeDiscount)
  - Điều kiện: "Đơn từ X" and/or "Game: name"
  - Hiệu lực: "dd/mm/yyyy – dd/mm/yyyy" or "Không giới hạn"
  - Lượt dùng: `usedCount / (maxTotalUses ?? "∞")` with "mỗi khách N" below
  - Chủ sở hữu: SpinReward only — ownerEmail, or "Chưa nhận"
  - Trạng thái: toggle switch calling PATCH
  - Actions: "Sửa", "Lượt dùng" (redemptions modal) and "Xóa" (window.confirm, shows the 409 message)
- **Mobile (< md):** cards instead of the table.
- **Create modal ("Tạo mã"):**
  - Mode switch "Một mã" (Code input, hint "Để trống để tạo ngẫu nhiên") | "Tạo hàng loạt" (Tiền tố + Số lượng).
  - Shared fields: Tên/đợt sự kiện; Loại giảm (Phần trăm | Số tiền); Giá trị (% or ₫); Giảm tối đa (₫, Percent only); Đơn tối thiểu (₫); Áp dụng cho game (optional debounced picker on `/api/admin/lucky-spin/game-options?search=`, as in LuckySpinPrizes.tsx, with a clear button); Bắt đầu / Kết thúc (datetime-local → toISOString, blank = null); Tổng lượt dùng (blank = không giới hạn; bulk default 1); Lượt mỗi khách (default 1); Kích hoạt checkbox.
  - Client-side checks mirror the server.
  - After a bulk success, show the generated codes in a read-only textarea with "Sao chép tất cả".
- **Edit:** the same modal with the code shown read-only. For SpinReward coupons it also shows the owner email.
- **Redemptions modal:** lists order code, order status, customer email, −amount and created time, plus an "Đã hoàn lượt" badge with time when releasedAt is set. Empty state: "Chưa có lượt sử dụng.".

**App.tsx** (BOM): import TicketPercent from lucide-react. Add the navItem `{ to: "/coupons", label: "Mã giảm giá", icon: TicketPercent }` after Lucky Spin, the lazy `Coupons` import, and `<Route path="/coupons" element={<Coupons />} />`.

**LuckySpinPrizes.tsx:**
- AdminPrize gains the discount fields.
- FormState gains discountType ("Percent" default), discountValue, discountMaxAmount, discountMinOrderAmount, discountGameId, discountGameName and discountValidDays ("30").
- When type === "Discount", render a "Cấu hình mã giảm giá" fieldset: Loại; Giá trị; Giảm tối đa (Percent only); Đơn tối thiểu; Áp dụng cho game (optional); Hiệu lực (ngày) with the hint "Khách đăng nhập nhận mã vào ví ngay khi trúng; mã hết hạn sau số ngày này.".
- The debounced game-search effect must also run for type Discount, and selecting a game there writes discountGameId/discountGameName.
- Validation for Discount: value > 0 (≤ 100 for Percent) and validDays 1..365.
- The save body sends the discount fields. For non-Discount types send nulls.
- **toggleActive** must pass every stored discount field through unchanged, otherwise toggling would wipe the config.
- In the prize list, Discount prizes show describeDiscount + " · HSD {n} ngày" (+ game). When discountType is null, show the amber chip "Chưa cấu hình mã — trao thủ công".

**OrderDetailModal.tsx (BOM) and OrderList.tsx (BOM):**
- Extend the interfaces with subtotalAmount, discountAmount and couponCode.
- In the modal, when discountAmount > 0, show rows "Subtotal" and "Discount ({couponCode})" with −amount (green) above Total.
- In OrderList (both the desktop table and the mobile card), show a small line under the total: `−{formatPrice(discountAmount)} · {couponCode}` when discountAmount > 0.

**Builds and commit:** run `npm run build` in Moxic.Admin and `dotnet build API/Moxic.slnx`. Commit with explicit paths: `feat(quick-261103-smv): admin event coupons, prize discount config, order discount views`.
  </action>
  <verify>
    <automated>cd /c/Users/trung/OneDrive/Documents/project-moxic && dotnet build API/Moxic.slnx -nologo -v q && grep -q 'Authorize(Roles = "Admin")' API/Moxic.Api/Controllers/AdminCouponsController.cs && grep -q 'bulk' API/Moxic.Api/Controllers/AdminCouponsController.cs && grep -q 'redemptions' API/Moxic.Api/Controllers/AdminCouponsController.cs && grep -q 'DiscountValidDays' API/Moxic.Api/Controllers/AdminLuckySpinController.cs && grep -q 'DiscountAmount' API/Moxic.Api/Controllers/AccountOrdersController.cs && grep -q 'SubtotalAmount' API/Moxic.Api/Models/Dtos.cs && grep -q 'CouponCode' API/Moxic.Api/Controllers/AdminOrdersController.cs && grep -q 'DiscountAmount' API/Moxic.Api/Controllers/OrdersController.cs && cd Moxic.Admin && npm run build && grep -q '/api/admin/coupons' src/lib/couponAdmin.ts && grep -q '"/coupons"' src/App.tsx && grep -q 'TicketPercent' src/App.tsx && grep -q 'discountValidDays' src/pages/LuckySpinPrizes.tsx && grep -q 'discountAmount' src/pages/OrderDetailModal.tsx && grep -q 'discountAmount' src/pages/OrderList.tsx && for f in src/App.tsx src/pages/OrderDetailModal.tsx src/pages/OrderList.tsx ../API/Moxic.Api/Models/Dtos.cs ../API/Moxic.Api/Controllers/AdminOrdersController.cs ../API/Moxic.Api/Controllers/OrdersController.cs; do head -c3 $f | od -An -tx1 | grep -q 'ef bb bf' || { echo "BOM lost: $f"; exit 1; }; done && echo OK</automated>
  </verify>
  <done>
- Admin can create single or bulk event coupons, edit, toggle, delete unused ones, filter SpinReward coupons (with owner), and view redemptions (customer, order, amount, released).
- Discount prizes can be configured, and toggling a prize keeps its config.
- Admin order list/detail, the storefront confirmation API and the account order APIs expose subtotal, discount and code.
- Admin build and dotnet build pass, and BOMs are intact.
- Committed with explicit paths.
  </done>
</task>

<task type="auto">
  <name>Task 3: Storefront — wallet + claim, checkout coupon box with server preview, discount on totals/QR/confirmation/history, spin result wallet messaging, nav</name>
  <files>Moxic.Web/src/lib/couponApi.ts, Moxic.Web/src/hooks/useCoupons.ts, Moxic.Web/src/pages/CouponWalletPage.tsx, Moxic.Web/src/components/checkout/CouponBox.tsx, Moxic.Web/src/pages/CheckoutPage.tsx, Moxic.Web/src/components/checkout/CartSummary.tsx, Moxic.Web/src/components/checkout/CheckoutForm.tsx, Moxic.Web/src/components/checkout/QRDisplay.tsx, Moxic.Web/src/components/checkout/ConfirmationContent.tsx, Moxic.Web/src/pages/ConfirmationPage.tsx, Moxic.Web/src/types/game.ts, Moxic.Web/src/lib/accountApi.ts, Moxic.Web/src/hooks/useAccount.ts, Moxic.Web/src/pages/OrderHistoryPage.tsx, Moxic.Web/src/pages/OrderHistoryDetailPage.tsx, Moxic.Web/src/lib/luckySpinApi.ts, Moxic.Web/src/components/lucky-spin/ResultModal.tsx, Moxic.Web/src/components/layout/Navbar.tsx, Moxic.Web/src/App.tsx</files>
  <action>
Covers CONTEXT items 2-4. All copy is in Vietnamese, and every screen must work at 360px and on desktop.

**couponApi.ts:** create it exactly per `<interfaces>`.

**useCoupons.ts:**
- `export const COUPONS_QUERY_KEY = ["account", "coupons"] as const`.
- `useMyCoupons(enabled = true)` is a useQuery on getMyCoupons with staleTime 30 s.
- `useClaimCoupon()` is a useMutation on claimCoupon that invalidates COUPONS_QUERY_KEY on success.
- `useValidateCoupon()` is a useMutation on validateCoupon.
- useAccount.ts: useLogout also runs `qc.removeQueries({ queryKey: COUPONS_QUERY_KEY })` (import from useCoupons; there is no cycle).

**CouponWalletPage.tsx** (route /account/coupons; title "Mã giảm giá của tôi"; styling from PointsHistoryPage):
- **Claim card "Nhập mã thưởng":**
  - Input auto-uppercases and is prefilled from `?claim=` (useSearchParams, initial state). Button "Nhận vào ví" shows MoxicLoader size sm while pending.
  - Success toasts: "Đã thêm mã vào ví", or "Mã đã có trong ví của bạn" when alreadyOwned. Then clear the input and the claim param.
  - Errors appear inline via getCouponErrorMessage.
  - Hint: "Mã thưởng giảm giá từ vòng quay sẽ tự vào ví nếu bạn đã đăng nhập khi mở hòm.".
- **Tabs with counts:**
  - "Có thể dùng": Usable + Upcoming. Upcoming shows "Bắt đầu từ dd/mm/yyyy" and a disabled button.
  - "Đã dùng": Used.
  - "Hết hạn": Expired + Inactive. Inactive is labelled "Đã vô hiệu".
- **Ticket-style card:**
  - Gold left stub with TicketPercent.
  - Name, plus a "Thưởng vòng quay" / "Sự kiện" badge.
  - describeCouponDiscount in large gold text.
  - Condition chips.
  - "HSD: dd/mm/yyyy" or "Không thời hạn".
  - Monospace code with a copy button.
  - "Dùng ngay" (Usable only) → navigate(`/checkout?coupon=${encodeURIComponent(code)}`).
- **States:** loading uses SectionLoader; each tab has an empty state.

**CouponBox.tsx** (checkout). Props `{ gameIds: string[]; applied: CouponQuote | null; onApplied: (q: CouponQuote | null) => void; initialCode?: string }`.
- **Guest (useMe null):** a row with TicketPercent, "Có mã giảm giá?" and the Link "Đăng nhập để dùng mã giảm giá" → `/login?redirect=${encodeURIComponent("/checkout")}`.
- **Logged in:**
  - Input + "Áp dụng" button driven by useValidateCoupon; errors show inline.
  - Up to 6 wallet chips from useMyCoupons filtered to Usable ("CODE · Giảm 10%"); clicking one applies that code.
  - Applied state: a green box "Đã áp dụng {code} — {name}" with "−{formatPrice(discountAmount)}" and a "Bỏ mã" button that calls onApplied(null).
- **Auto-apply initialCode:** exactly once, when me is loaded and gameIds is non-empty. Use a useRef guard and call mutate inside useEffect; only mutate there and never call setState synchronously in the effect.
- **Re-validate on cart change:** keep the gameIds key (join(",")) used for the applied quote. When it changes while a coupon is applied, re-validate. On failure, call onApplied(null) and show the error.

**CheckoutPage.tsx:**
- Read `coupon` from useSearchParams. Hold `const [coupon, setCoupon] = useState<CouponQuote | null>(null)`.
- The right column gets `order-first lg:order-none` so summary and coupon sit above the form on mobile.
- Pass to CartSummary: `quote={coupon}` and `couponSlot={<CouponBox gameIds={items.map(i => i.gameId)} applied={coupon} onApplied={setCoupon} initialCode={...} />}`.
- Pass to CheckoutForm: `couponCode={coupon?.code}` and `onCouponRejected={() => setCoupon(null)}`.

**CartSummary.tsx:**
- New optional props `quote?: CouponQuote | null` and `couponSlot?: React.ReactNode`. Render couponSlot between the item list and the totals.
- `sticky top-20` becomes `lg:sticky lg:top-20`.
- With a quote, the totals show server numbers: "Tạm tính" quote.subtotal, "Giảm giá ({code})" −quote.discountAmount (green) and "Tổng cộng" quote.total. Without one, keep the existing total.

**CheckoutForm.tsx:**
- New optional props `couponCode?: string` and `onCouponRejected?: () => void`. The request includes `couponCode`.
- In the catch: when `err.response?.data?.code` starts with "COUPON_", call onCouponRejected and set the error to `${msg} Mã giảm giá đã được gỡ — bạn có thể đặt hàng lại.`.

**types/game.ts (BOM):**
- OrderCreateRequest gains `couponCode?: string`.
- OrderCreateResponse gains `discountAmount: number; couponCode?: string | null`.
- OrderConfirmationData gains `subtotalAmount: number; discountAmount: number; couponCode?: string | null`.

**ConfirmationContent.tsx:** optional props subtotalAmount, discountAmount and couponCode. When discountAmount > 0, render "Tạm tính" and "Giảm giá ({couponCode})" −amount (green) before "Tổng cộng".

**QRDisplay.tsx:** optional `amount?: number`. When it is set, render a "Số tiền cần chuyển" row above the transfer content with formatPrice(amount) and a copy button that copies `String(Math.round(amount))`, with its own copied state. Add a hint "Đã trừ mã giảm giá" when a new optional `discounted?: boolean` is true.

**ConfirmationPage.tsx (BOM):** pass subtotalAmount, discountAmount and couponCode to ConfirmationContent, and pass `amount={order.totalAmount}` and `discounted={order.discountAmount > 0}` to QRDisplay.

**Order history:**
- accountApi.ts: AccountOrderSummary gains `subtotalAmount: number; discountAmount: number; couponCode: string | null`.
- OrderHistoryPage: after "Tổng: X", add `(đã giảm {formatPrice(discountAmount)})` when > 0.
- OrderHistoryDetailPage: before "Tổng cộng", add "Tạm tính" and "Giảm giá ({couponCode})" rows when > 0.

**Spin result:**
- luckySpinApi.ts: OpenCaseResult gains `couponCreated: boolean; couponInWallet: boolean; couponExpiresAt: string | null`.
- ResultModal, for non-Luck wins:
  - **couponCreated && couponInWallet:** text "Mã giảm giá đã được thêm vào ví của bạn{couponExpiresAt ? ` — hạn dùng đến ${formatDate(couponExpiresAt)}` : ""}. Dùng khi thanh toán." plus a Link button "Xem ví mã giảm giá" → /account/coupons that calls onClose. No contact buttons.
  - **couponCreated && !couponInWallet:** text "Đăng nhập và nhận mã vào ví để dùng khi thanh toán." plus a Link button "Nhận mã vào ví" → `/account/coupons?claim=${encodeURIComponent(rewardCode)}` (RequireCustomer redirects guests to login and back with the query preserved).
  - **Otherwise:** keep the existing contact text and buttons unchanged.
  - The reward code box stays in every case.

**Navigation:**
- App.tsx: lazy CouponWalletPage and `<Route path="/account/coupons" element={<CouponWalletPage />} />` inside the RequireCustomer element route.
- Navbar.tsx: add a "Mã giảm giá của tôi" Link with the TicketPercent icon after "Điểm thưởng", in both the desktop dropdown and the mobile menu. Use the same classes and onClick close behaviour as the neighbouring items.

**Builds and commit:**
- Run `npm run build` in Moxic.Web, then `npx oxlint` on the touched storefront files and fix any findings in them.
- Run `npm run build` in Moxic.Admin and `dotnet build API/Moxic.slnx` as the final full check.
- Write the manual QA checklist into the SUMMARY:
  - spin logged in vs guest + claim
  - claim by a second account → 409
  - wallet tabs
  - checkout preview, Percent cap, GameId scope, MinOrderAmount, Fixed capped at the line
  - guest prompt
  - stale coupon at submit → removed with message
  - two parallel orders with a 1-use code → one fails
  - admin cancel and 24h timeout release
  - confirmation/QR/history/admin/email totals
  - cooldown message
- Worked numbers to include: games 749.000đ + 1.799.000đ.
  - 10% capped at 50.000đ → discount 50.000đ, total 2.498.000đ.
  - 15% scoped to the 749.000đ game → discount 112.350đ, total 2.435.650đ.
  - Fixed 1.000.000đ scoped to the 749.000đ game → discount 749.000đ.
  - Fixed 100.000đ with min 1.000.000đ scoped to the 749.000đ game → COUPON_MIN_ORDER.
- Commit with explicit paths: `feat(quick-261103-smv): storefront coupon wallet, checkout coupons, discount totals`.
  </action>
  <verify>
    <automated>cd /c/Users/trung/OneDrive/Documents/project-moxic/Moxic.Web && npm run build && grep -q '/coupons/validate' src/lib/couponApi.ts && grep -q '/account/coupons' src/lib/couponApi.ts && grep -q 'COUPONS_QUERY_KEY' src/hooks/useAccount.ts && grep -q 'claim' src/pages/CouponWalletPage.tsx && grep -q 'validateCoupon\|useValidateCoupon' src/components/checkout/CouponBox.tsx && grep -q 'couponSlot' src/pages/CheckoutPage.tsx && grep -q 'couponCode' src/components/checkout/CheckoutForm.tsx && grep -q 'discountAmount' src/components/checkout/ConfirmationContent.tsx && grep -q 'amount=' src/pages/ConfirmationPage.tsx && grep -q 'couponInWallet' src/components/lucky-spin/ResultModal.tsx && grep -q 'couponInWallet' src/lib/luckySpinApi.ts && grep -q '"/account/coupons"' src/App.tsx && grep -q 'account/coupons' src/components/layout/Navbar.tsx && grep -q 'discountAmount' src/pages/OrderHistoryDetailPage.tsx && for f in src/types/game.ts src/pages/ConfirmationPage.tsx; do head -c3 $f | od -An -tx1 | grep -q 'ef bb bf' || { echo "BOM lost: $f"; exit 1; }; done && cd ../Moxic.Admin && npm run build && cd .. && dotnet build API/Moxic.slnx -nologo -v q && echo OK</automated>
  </verify>
  <done>
- Logged-in customers manage coupons at /account/coupons, including claiming guest reward codes.
- At checkout they apply a typed code or a wallet coupon with a server-computed preview; guests see the login prompt.
- A rejected coupon at submit is removed with a clear message.
- Confirmation, QR amount, order history and the spin result modal reflect the coupon.
- All three builds pass, and oxlint is clean on the touched files.
- Manual QA is in the SUMMARY. Committed with explicit paths.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → POST /api/orders | Untrusted cart (game ids, prices), coupon code |
| browser → /api/coupons/validate, /api/account/coupons/claim | Untrusted codes; potential enumeration |
| customer cookie → wallet/claim | Must only see/own their own coupons |
| admin SPA → /api/admin/coupons | Admin-only management |
| background service → order cancel | Concurrent with admin status changes |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-smv-01 | Tampering | OrdersController.CreateOrder | mitigate | Line prices come from Games.SalePrice through CouponService.PriceLinesAsync, and the client Price is ignored. Discount and total are computed only by CouponRules. Unknown games give 400. |
| T-smv-02 | Tampering (race) | CouponService.RedeemAsync | mitigate | A conditional UPDATE re-checks active, dates, owner and `UsedCount < MaxTotalUses` under the row lock. The per-customer recount runs after the lock. Everything is inside the order transaction (rolled back on failure). There is a UNIQUE index on CouponRedemptions.OrderId. |
| T-smv-03 | Tampering | ReleaseForOrderAsync | mitigate | `ReleasedAt IS NULL` conditional update. UsedCount only decrements when that affected 1 row, and only while UsedCount > 0. It runs in the cancel transaction for both the admin and the timeout path, and the timeout cancel is a conditional `Status == Pending` update. |
| T-smv-04 | Information disclosure / brute force | validate, claim, CreateOrder | mitigate | The "coupon" rate-limit policy allows 20/min/IP, keyed by the Cloudflare-aware GetClientIp. Generated codes are 8 CSPRNG chars from a 31-char alphabet. Validate requires login. |
| T-smv-05 | Elevation / spoofing | owned SpinReward coupons | mitigate | The OwnerUserId check runs both in Evaluate and in the UPDATE WHERE. Claim and bind use the conditional `OwnerUserId IS NULL`. Claiming someone else's code gives 409 without revealing who owns it. |
| T-smv-06 | Information disclosure | wallet / quote DTOs | mitigate | The wallet returns only OwnerUserId == caller. Customer DTOs carry no OwnerUserId, emails or redemption details. Admin DTOs exist only under `[Authorize(Roles = "Admin")]`. |
| T-smv-07 | Elevation | AdminCouponsController, prize config | mitigate | `[Authorize(Roles = "Admin")]`. Customer endpoints use the MoxicCustomer scheme plus the Customer role. |
| T-smv-08 | Repudiation | coupon usage | mitigate | CouponRedemptions is an append-only ledger (user, order, amount, release time). Admin-created coupons record CreatedBy. Admins can only delete unused coupons. |
| T-smv-09 | Denial of service | bulk / wallet / validate | mitigate | Bulk is limited to 500. The wallet is capped at 200 rows. A cart holds at most 50 items. Admin list pageSize is at most 200. Lookups are batched (no N+1). |
| T-smv-10 | Tampering | spin Discount → coupon | mitigate | The coupon is created in the same transaction as consume + draw + history, so no orphans. The reward code is unique across SpinHistories and Coupons. The terms are snapshotted from the prize at win time. |
| T-smv-11 | Tampering (XSS) | admin new-order email | mitigate | The coupon code is passed through WebUtility.HtmlEncode. Codes are already restricted to A-Z0-9. |
| T-smv-12 | Spoofing | guest reward code shown in modal | accept | Whoever holds the code can claim it first. That is the same trust model as today's reward codes, and it is documented in the UI ("Nhận mã vào ví"). |
</threat_model>

<verification>
- Baseline and final: `dotnet build API/Moxic.slnx` and `npm run build` in Moxic.Web and Moxic.Admin all pass, with no new warnings from touched files.
- `*_AddCoupons.cs` exists. The snapshot contains Coupon, CouponRedemption, Order.CouponId/CouponCode/DiscountAmount and SpinPrize.Discount*. The bootstrap DDL matches the `migrations script` names. The bootstrap is safe to re-run.
- Invariant: for every order, TotalAmount == sum(OrderDetails.Price) − DiscountAmount, and DiscountAmount >= 0. Existing orders read DiscountAmount 0.
- BOMs are preserved on the files listed in context. The garbled strings in AdminOrdersController.cs are unchanged (`git diff` shows only targeted hunks). After the last commit, `git status --short` shows only `.planning/` untracked, and no build output is committed.
</verification>

<success_criteria>
- **Spin:** a configured Discount win makes a real coupon (owned when logged in, claimable once otherwise). Game prizes and legacy Discount prizes behave as before.
- **Wallet:** shows usable / used / expired coupons with claim.
- **Checkout:** server preview, then server re-validation and atomic redemption at order creation. One coupon per order, login required, and every CONTEXT rule enforced.
- **Cancellation:** releases the redemption exactly once (admin and 24h timeout).
- **Display:** the discount line and discounted total appear on confirmation + QR amount, order history, admin order list/detail, and the admin email.
- **Admin:** the event coupon page (single/bulk, toggle, usage, redemptions, SpinReward filter) and the prize discount config both work.
- **Cooldown:** the 409 message shows the real remaining time.
</success_criteria>

## Source coverage audit

| Source item | Covered by |
|-------------|-----------|
| CONTEXT 1: Coupon/CouponRedemption model, Order.CouponId + DiscountAmount | Task 1 (entities, DbContext, bootstrap, migration) |
| CONTEXT 2: Discount prize config + logged-in auto coupon + guest claim | Task 1 (TryBuildSpinRewardCoupon, ClaimAsync, OpenCaseResultDto), Task 2 (prize form + ApplyPrizeAsync), Task 3 (ResultModal, wallet claim) |
| CONTEXT 3: Customer wallet "Mã giảm giá của tôi" | Task 1 (GET/claim API), Task 3 (CouponWalletPage, navbar, route) |
| CONTEXT 4: Checkout validate + server recompute, all rules, atomic redemption, release on cancel, guests blocked, QR/totals/emails/admin show discount | Task 1 (CouponRules/Service, CreateOrder, release in admin + timeout, email), Task 2 (read models + admin order views), Task 3 (CouponBox, CartSummary, CheckoutForm, QR/confirmation/history) |
| CONTEXT 5: Admin event coupon page (single/bulk, toggle, usage, redemptions, SpinReward filter) + order detail coupon | Task 2 |
| Decisions: login required, one coupon/order, server computes; usage at creation, release on cancel; bootstrap + migration; whole-đồng VND | Tasks 1-3 as cited |
| Discretion: routes (/account/coupons, /api/coupons/validate, /api/admin/coupons), CSPRNG code charset reused from LuckySpinRules, auto-bind of an unowned SpinReward code at checkout | Tasks 1-3 |
| Runtime fix: FreeInterval cooldown message | Task 1 (LuckySpinRules.FormatWaitVi) |
| Not re-planned (already verified at runtime): sls A+B data migration, code race, accounts, free/points cases, points award idempotency | n/a |

<output>
Create `.planning/quick/261103-smv-coupons-account-wallet-and-event-discoun/261103-smv-SUMMARY.md` when done (baseline/final builds, migration drift report, smoke-test result or skip reason, discretion choices, deviations, threat coverage, manual QA checklist).
</output>
