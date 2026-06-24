# Roadmap: Moxic GameStore

**5 phases** | **36 requirements** | All v1 requirements covered ✓

---

### Phase 1: Backend Core — Code First Database & API

**Goal:** Thiết lập .NET 10 solution, thiết kế domain models, EF Core migrations → PostgreSQL, MinIO integration, game CRUD API, and a minimal admin page for image upload mockup.
**Mode:** mvp
**Success Criteria:**

1. Admin can create/edit/delete game with all fields via API
2. Admin can upload game cover image → stored in MinIO → presigned URL returned
3. Admin can configure bank + crypto QR payment images
4. Full DB schema generated via EF Core Code First migrations
5. Admin can view game list with search and filter via API

**Requirements:** GAME-01, GAME-02, GAME-03, GAME-04, GAME-05, PAY-01, PAY-02, PAY-03, PAY-04

---

### ✅ Phase 2: Public Storefront (Complete — 2026-06-24) — Epic-Style Dark UI

**Goal:** Build React frontend with Epic Games Store-inspired dark theme, game grid, carousel, detail pages, preorder display.
**Mode:** mvp
**Success Criteria:**

1. Home page shows carousel banner with featured games
2. Game card grid displays cover image, name, original price (strikethrough), sale price
3. Game detail page shows description, system requirements, purchase guide
4. Preorder games show countdown + "Đặt trước" button instead of "Mua ngay"
5. User can search and filter games by genre and status
6. Full dark theme consistent across all pages

**Requirements:** CAT-01, CAT-02, CAT-03, CAT-04, CAT-05, CAT-06, UI-01, UI-02, UI-04

---

### Phase 3: Cart, Checkout & Payment

**Goal:** End-to-end purchase flow: add to cart → checkout form (Xbox info) → QR payment display → order confirmation.
**Mode:** mvp
**Success Criteria:**

1. User can add games to cart and view cart summary
2. Checkout form collects phone, Xbox email, Xbox password, optional Zalo/FB
3. System generates DH-prefix order code for transfer reference
4. Checkout page displays bank QR + crypto QR with transfer content
5. Privacy notice shown about Xbox credential handling
6. Order confirmation page shown after submission

**Requirements:** CART-01, CART-02, CART-03, CART-04, CART-05, CART-06, UI-03

---

### Phase 4: Admin Order Management

**Goal:** Full admin order dashboard with status workflow, preorder management, order filtering.
**Mode:** mvp
**Success Criteria:**

1. Admin order dashboard lists all orders newest-first
2. Order detail shows game info, amount, customer Xbox info (password encrypted)
3. Admin can move order through statuses: Pending → Verifying → Installing → Completed
4. Admin can cancel orders
5. Admin can filter/search orders by status and date range
6. Preorder orders flagged and held until release date

**Requirements:** ORDR-01, ORDR-02, ORDR-03, ORDR-04, ORDR-05, ORDR-06, ORDR-07, ORDR-08

---

### Phase 5: Notifications & Polish

**Goal:** Email notifications for order lifecycle, admin alerts, UI polish, edge case handling.
**Mode:** mvp
**Success Criteria:**

1. Customer receives email when payment is confirmed (Verifying status)
2. Customer receives email when game is installed (Completed status)
3. Admin receives notification for new orders
4. All edge cases handled (payment timeout, cancelled orders, failed installation)

**Requirements:** NOTF-01, NOTF-02, NOTF-03

---

## Phase Summary

| # | Phase | Requirements | Mode |
|---|-------|-------------|------|
| 1 | Backend Core — DB & API | GAME-01-05, PAY-01-04 | mvp |
| 2 | Public Storefront UI | CAT-01-06, UI-01-04 | mvp |
| 3 | Cart, Checkout & Payment | CART-01-06, UI-03 | mvp |
| 4 | Admin Order Management | ORDR-01-08 | mvp |
| 5 | 3/3 | Complete    | 2026-06-24 |

**Coverage:** 36/36 v1 requirements mapped ✓

---
*Roadmap created: 2026-06-23*
