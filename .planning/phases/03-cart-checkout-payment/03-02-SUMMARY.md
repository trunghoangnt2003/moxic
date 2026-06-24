---
phase: 03-cart-checkout-payment
plan: 02
type: auto
subsystem: frontend
tags: [checkout, form, navigation]
key-files:
  - Moxic.Web/src/pages/CheckoutPage.tsx
  - Moxic.Web/src/components/checkout/CheckoutForm.tsx
  - Moxic.Web/src/components/checkout/CartSummary.tsx
  - Moxic.Web/src/components/checkout/PrivacyNotice.tsx
  - Moxic.Web/src/components/shared/CartDrawer.tsx
  - Moxic.Web/src/pages/GameDetailPage.tsx
  - Moxic.Web/src/App.tsx
metrics:
  files_created: 5
  files_modified: 4
  commits: 1
---

## Tasks

### Task 1: Add API types + createOrder/getOrder functions
- Extended 	ypes/game.ts with OrderCreateRequest, OrderCreateResponse, OrderConfirmationData
- Added createOrder() and getOrder() to pi.ts using axios pattern

### Task 2: Create CheckoutPage with cart summary + form + privacy notice
- CartSummary.tsx — Read-only cart item list with total
- CheckoutForm.tsx — Form with phone, Xbox email, Xbox password, Zalo/FB, validation, submit ? POST /api/orders ? clear cart ? navigate to confirmation
- PrivacyNotice.tsx — Collapsible disclosure about Xbox credential encryption
- CheckoutPage.tsx — Full page with cart summary + form, empty state handling
- Updated App.tsx with /checkout route

### Task 3: Wire navigation buttons
- CartDrawer "Thanh toán" ? close() + navigate("/checkout")
- GameDetailPage "Mua ngay" ? add to cart + navigate("/checkout")
- "Thêm vào gi?" keeps existing behavior (adds to cart + drawer)

## Deviations
- None

## Self-Check

- [x] /checkout page renders with cart summary + form
- [x] Empty cart shows empty state with "Ti?p t?c mua s?m" button
- [x] Form validates required fields with inline errors
- [x] Submit calls createOrder, clears cart, navigates to confirmation
- [x] CartDrawer "Thanh toán" ? /checkout
- [x] GameDetailPage "Mua ngay" ? cart ? /checkout
- [x] Privacy notice collapsible
- [x] TypeScript: tsc --noEmit passed
