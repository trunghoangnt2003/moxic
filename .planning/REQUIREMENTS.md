# Requirements: Moxic GameStore

**Defined:** 2026-06-23
**Core Value:** Khách hàng mua được game Xbox chính hãng giá rẻ hơn 30% so với Store với quy trình đặt niềm tin thông qua cài đặt thủ công uy tín.

## v1 Requirements

### Catalog & Browsing

- [ ] **CAT-01**: Anonymous user can view game listing as card grid (cover image, name, original price struck through, sale price)
- [ ] **CAT-02**: Home page shows carousel banner of hot/sale games
- [ ] **CAT-03**: User can view game detail page with description, system requirements, purchase guide (3-step visual)
- [ ] **CAT-04**: User can search games by name
- [ ] **CAT-05**: User can filter games by genre and status (Available / Preorder)
- [ ] **CAT-06**: Preorder games show countdown to release date and "Đặt trước" button instead of "Mua ngay"

### Cart & Checkout

- [ ] **CART-01**: User can add game to cart
- [ ] **CART-02**: User can view cart with item summary and total
- [ ] **CART-03**: Checkout form collects: phone number, Xbox Gmail, Xbox password, optional Zalo/FB link
- [ ] **CART-04**: System generates unique order code (DH-prefix) for transfer reference
- [ ] **CART-05**: Checkout displays static QR image (bank + crypto options) with transfer content showing order code
- [ ] **CART-06**: Order confirmation page shown after successful checkout submission

### Order Lifecycle & Admin Management

- [ ] **ORDR-01**: System creates order with "Pending" status on checkout submission
- [ ] **ORDR-02**: Admin order dashboard shows orders sorted by time (newest first)
- [ ] **ORDR-03**: Order detail shows: game info, total amount, customer info (phone, Xbox email, Xbox password encrypted)
- [ ] **ORDR-04**: Admin can mark order as "Đã nhận tiền — Đang cài đặt" (Verifying → Installing)
- [ ] **ORDR-05**: Admin can mark order as "Hoàn thành" (Installing → Completed)
- [ ] **ORDR-06**: Admin can cancel order (Pending → Cancelled)
- [ ] **ORDR-07**: Admin can filter/search orders by status, date range
- [ ] **ORDR-08**: Preorder orders are held until release date, flagged in dashboard

### Game Management (Admin)

- [ ] **GAME-01**: Admin can create game with name, description, original price, sale price, genre, status
- [ ] **GAME-02**: Admin can upload cover image to MinIO, stored at `games/{game-id}/`
- [ ] **GAME-03**: Admin can set release date and status to "Preorder" for upcoming games
- [ ] **GAME-04**: Admin can edit and delete existing games
- [ ] **GAME-05**: Admin game list shows all games with search and filter

### Payment Config (Admin)

- [ ] **PAY-01**: Admin can upload bank QR image (VietQR)
- [ ] **PAY-02**: Admin can upload crypto wallet QR image (USDT/BTC)
- [ ] **PAY-03**: Admin can configure transfer content template with order code variable
- [ ] **PAY-04**: Admin can preview active QR before saving

### Notifications

- [ ] **NOTF-01**: System sends email notification to customer when order status changes to "Verifying" (payment received)
- [ ] **NOTF-02**: System sends email notification when order is "Completed" (game installed)
- [ ] **NOTF-03**: Admin receives notification (email/dashboard) for new orders

### UI/UX

- [ ] **UI-01**: Entire website uses dark theme (dark gray/black gaming aesthetic, Epic Games Store style)
- [ ] **UI-02**: Game card grid responsive (mobile + desktop)
- [ ] **UI-03**: Checkout form includes clear privacy notice about Xbox credential handling
- [ ] **UI-04**: Navigation: home, games, preorder, cart, admin link

## v2 Requirements

- **USR-01**: User can register account and track order history
- **USR-02**: User can re-download purchase guide
- **ADMN-02**: Bulk game import via CSV
- **ADMN-03**: Dashboard statistics (total orders, revenue, pending count)
- **NOTF-04**: Zalo notification integration
- **UI-05**: Multi-language support (Vietnamese/English)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Physical merchandise | Digital games only |
| Third-party sellers / Publisher dashboard | Sole merchant model |
| Payment gateway integration | Static QR payment only |
| Automated game delivery | Manual fulfillment via Zalo/FB |
| Unpaid preorder (reservation) | Pay now only |
| Mobile native app | Web-first, mobile responsive |
| User registration in Phase 1 | Anonymous checkout sufficient for Phase 1 |
| Game reviews / ratings | Deferred to v2 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CAT-01 | Phase 2 | Pending |
| CAT-02 | Phase 2 | Pending |
| CAT-03 | Phase 2 | Pending |
| CAT-04 | Phase 2 | Pending |
| CAT-05 | Phase 2 | Pending |
| CAT-06 | Phase 2 | Pending |
| CART-01 | Phase 3 | Pending |
| CART-02 | Phase 3 | Pending |
| CART-03 | Phase 3 | Pending |
| CART-04 | Phase 3 | Pending |
| CART-05 | Phase 3 | Pending |
| CART-06 | Phase 3 | Pending |
| ORDR-01 | Phase 4 | Pending |
| ORDR-02 | Phase 4 | Pending |
| ORDR-03 | Phase 4 | Pending |
| ORDR-04 | Phase 4 | Pending |
| ORDR-05 | Phase 4 | Pending |
| ORDR-06 | Phase 4 | Pending |
| ORDR-07 | Phase 4 | Pending |
| ORDR-08 | Phase 4 | Pending |
| GAME-01 | Phase 1 | Pending |
| GAME-02 | Phase 1 | Pending |
| GAME-03 | Phase 1 | Pending |
| GAME-04 | Phase 1 | Pending |
| GAME-05 | Phase 1 | Pending |
| PAY-01 | Phase 1 | Pending |
| PAY-02 | Phase 1 | Pending |
| PAY-03 | Phase 1 | Pending |
| PAY-04 | Phase 1 | Pending |
| NOTF-01 | Phase 5 | Pending |
| NOTF-02 | Phase 5 | Pending |
| NOTF-03 | Phase 5 | Pending |
| UI-01 | Phase 2 | Pending |
| UI-02 | Phase 2 | Pending |
| UI-03 | Phase 3 | Pending |
| UI-04 | Phase 2 | Pending |

**Coverage:**
- v1 requirements: 36 total
- Mapped to phases: 36
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-23*
*Last updated: 2026-06-23 after roadmap creation*
