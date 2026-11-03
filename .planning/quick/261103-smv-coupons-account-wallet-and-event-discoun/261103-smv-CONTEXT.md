# Quick Task 261103-smv: Coupons — account wallet, checkout discount, admin event codes - Context

**Gathered:** 2026-11-03
**Status:** Ready for planning
**Depends on:** 261103-qmv (lucky spin v1), 261103-sa8 (customer accounts), 261103-sls (multiple cases + points). Read all three SUMMARYs first; build on what actually exists.

<domain>
## Task Boundary

Now that customers can log in, discount prizes and event promo codes become real, server-applied discounts.

1. **Coupon model.** `Coupon`: Code (unique, uppercase), Name, Source (`Event` | `SpinReward`), DiscountType (`Percent` | `Fixed`), Value, MaxDiscountAmount (nullable, for Percent), MinOrderAmount (nullable), GameId (nullable → only applies to that game's line), StartsAt/ExpiresAt (nullable), MaxTotalUses (nullable), MaxUsesPerCustomer (default 1), UsedCount, IsActive, OwnerUserId (nullable — set for SpinReward coupons: only that account can use it), CreatedAt. `CouponRedemption`: CouponId, UserId, OrderId, DiscountAmount, CreatedAt, ReleasedAt (nullable). Order gets `CouponId`, `DiscountAmount` (default 0), keeps subtotal/total consistent.
2. **Spin Discount prize → real coupon.** The Discount prize config gains DiscountType/Value/MaxDiscountAmount/MinOrderAmount/GameId/ValidDays (coupon expires N days after win). On a Discount win:
   - logged-in customer → a SpinReward coupon owned by that account is created immediately (code = the reward code) and appears in their wallet;
   - guest (Code case without login) → reward code shown as today; the customer can later **claim** it into their wallet from the account page ("Nhập mã thưởng") — one-time, binds OwnerUserId. Game prizes remain manual (contact admin) as before.
3. **Customer wallet.** Account area "Mã giảm giá của tôi": list usable / used / expired coupons owned by the user + a field to claim a reward code.
4. **Checkout.** Logged-in customers can enter a code or pick one from their wallet; `POST /api/coupons/validate` (cart → computed discount preview) and order creation re-validates and recomputes server-side (never trust client amounts). One coupon per order. Rules: active, within dates, not exhausted (total + per-customer), owner matches if OwnerUserId set, MinOrderAmount on applicable subtotal, GameId scope (discount applies to that game's line only), Percent capped by MaxDiscountAmount, discount ≤ applicable amount. Redemption is atomic (conditional UPDATE on UsedCount) inside the order-creation transaction. If the order is Cancelled, release the redemption (UsedCount-1, ReleasedAt) exactly once. Guests can't use coupons (show "Đăng nhập để dùng mã giảm giá"). QR transfer amount and all order totals/emails/admin views show the discounted total and the discount line.
5. **Admin "Mã giảm giá sự kiện" page.** CRUD event coupons (single or bulk-generate N codes with a prefix), toggle active, see usage count + redemption list (who/which order/amount). Also a filter to view SpinReward coupons. Admin order detail shows coupon code + discount.

</domain>

<decisions>
## Decisions (defaults chosen by orchestrator; user may adjust later)
- Login required to use any coupon; one coupon per order; server computes everything.
- Usage counted at order creation; released on cancellation.
- Schema via idempotent bootstrap SQL at startup + EF migration (same approach as previous tasks); existing orders get DiscountAmount 0.
- Money as decimal VND, round discount to whole đồng.

### Claude's Discretion
- Route names, exact UI; code charset reuse from LuckySpinRules.
</decisions>

<specifics>
- Vietnamese UI copy; mobile + desktop.
- Builds must pass (dotnet + both npm builds). Explicit-path commits, no push.
</specifics>
