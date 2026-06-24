---
status: testing
phase: 03-cart-checkout-payment
source: [03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md]
started: 2026-06-24T17:52:17Z
updated: 2026-06-24T17:52:17Z
---

## Current Test

number: 1
name: CartDrawer shows game after adding from GameDetailPage
expected: |
  Open /games/:id for any game. Click "Thêm vào gi?". Cart drawer slides in from right showing the game name, price, quantity controls.
awaiting: user response

## Tests

### 1. Add to Cart from GameDetailPage
expected: Open /games/:id for any game. Click "Thêm vào gi?". Cart drawer slides in showing the game with name, price, quantity +/-, and delete. Cart badge appears on Navbar cart icon.
result: [pending]

### 2. "Mua ngay" navigates to Checkout
expected: On GameDetailPage, click "Mua ngay". Game adds to cart. Page navigates to /checkout. Cart drawer closes automatically.
result: [pending]

### 3. Checkout Page shows Cart Summary
expected: At /checkout with items in cart. Shows cart summary (game list, quantity, prices, total). Checkout form below with fields: phone, Xbox email, Xbox password, Zalo/FB.
result: [pending]

### 4. Empty Cart Handling
expected: Visit /checkout with empty cart. Shows empty state "Gi? hàng tr?ng" with "Ti?p t?c mua s?m" button linking to /games.
result: [pending]

### 5. Form Validation
expected: At /checkout, leave all fields empty and click "Ð?t hàng". Inline error messages appear below each required field: phone, email, password. Form does not submit.
result: [pending]

### 6. Privacy Notice Collapsible
expected: Below the form, a collapsible privacy notice about Xbox credential encryption. Click to expand: shows details about AES-256 encryption, data deletion after install, password change recommendation.
result: [pending]

### 7. CartDrawer "Thanh toán" navigates to Checkout
expected: With items in cart, open CartDrawer. Click "Thanh toán". Drawer closes, navigates to /checkout with cart items intact.
result: [pending]

### 8. POST /api/orders creates order
expected: Using browser DevTools Network tab or curl: POST /api/orders with valid data returns 201 with orderCode starting with "MOXIC-". Order created in database.
result: [pending]

### 9. GET /api/orders/{orderCode} returns order details
expected: After creating an order, GET /api/orders/{orderCode} returns order with items list, total amount, status "Pending", and payment config with QR URLs.
result: [pending]

### 10. Confirmation Page shows order result
expected: After successful checkout submit, user lands on /confirmation/:orderCode. Shows success icon "Ð?t hàng thành công!", order code (copyable), game list, total, QR display with bank/crypto tabs, transfer content, and "Ti?p t?c mua s?m" button.
result: [pending]

### 11. QR Display Toggle
expected: On confirmation page, QR display shows "Chuy?n kho?n" tab active by default with bank QR. Click "USDT/BTC" tab switches to crypto QR (or placeholder if not configured). Transfer content shows order code with copy button.
result: [pending]

### 12. Confirmation Not Found
expected: Visit /confirmation/NONEXISTENT. Shows "Không tìm th?y don hàng" error state with "Quay l?i c?a hàng" link.
result: [pending]

## Summary

total: 12
passed: 0
issues: 0
pending: 12
skipped: 0

## Gaps

[none yet]
