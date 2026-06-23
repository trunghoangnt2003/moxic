# Features Research: Moxic GameStore

## Domain: Game Key E-commerce (Xbox)

### Market Context
- Vietnamese gamers seek discounted Xbox games but lack trusted sources
- Current market: Facebook groups, Zalo groups, random resellers — low trust, scattered
- Key winning factor: **Trust** (verify payment, clear process, responsive support)
- Epic Games Store aesthetic resonates with gamer audience

### Feature Categories

#### 1. Catalog & Browsing
**Table stakes:**
- Game listing with grid cards (cover image, name, price)
- Carousel/banner for featured/hot games
- Game detail page (description, system req, screenshots)
- Search by game name
- Filter by genre / status (Available / Preorder)
- Sort by price, name, release date

**Differentiators:**
- Purchase guide embedded in game detail page (3-step visual)
- Price comparison display (original price struck through, sale price prominent)
- Preorder countdown timer

#### 2. Cart & Checkout
**Table stakes:**
- Add game to cart
- View cart (summary, total)
- Checkout form: phone, Xbox email, Xbox password
- QR payment display with transfer content

**Differentiators:**
- Clear privacy notice about Xbox credentials (builds trust)
- Order code auto-generated for transfer reference
- Multi-QR support (bank + crypto tabs)
- Confirmation page after order placed

#### 3. Order Management (Admin)
**Table stakes:**
- Order list sorted by time (newest first)
- Order detail: game info, customer info, payment status
- Status workflow: Pending → Verifying → Installing → Completed
- Action buttons per status transition

**Differentiators:**
- One-click "Mark as paid" + auto-send email notification
- "Send installation guide to customer" action
- Order search/filter by status, date range
- Order notes (admin internal notes)

#### 4. Game Management (Admin)
**Table stakes:**
- Create/edit game: name, description, original price, sale price, genre, status
- Upload cover image → MinIO
- Set release date (for preorder games)
- Game list with search/filter

**Differentiators:**
- Bulk game import (future)
- Image preview before saving
- Preorder date auto-calculates "Days until release"

#### 5. Payment Config (Admin)
**Table stakes:**
- Upload bank QR image
- Upload crypto wallet QR image + address
- Set default transfer content template

**Differentiators:**
- QR preview before saving
- Multiple bank QRs (future)

#### 6. Notifications
**Table stakes:**
- Email notification on order status change
- Admin notification on new order

**Differentiators:**
- Zalo notification integration (future)
- SMS notification (future)

### Preorder-Specific Features
- Game marked as "Preorder" status
- Preorder button vs Buy button (different visual)
- Release date display with countdown
- Order held until release date
- Notification to admin when release date approaches

---
*Research completed: 2026-06-23*
