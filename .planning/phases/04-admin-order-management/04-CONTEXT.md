# Phase 4: Admin Order Management — Context

**Gathered:** 2026-06-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Full admin order management dashboard with order listing, detail view, status transitions (Pending ? Verifying ? Installing ? Completed), cancel, and filter/search. Also includes fixing existing Admin API issues (GameMedia presigned URLs, DTO missing fields, extended entity field handling) that block admin usability.

**Requirements:** ORDR-01, ORDR-02, ORDR-03, ORDR-04, ORDR-05, ORDR-06, ORDR-07, ORDR-08
</domain>

<backlog_fixes>
## Prior-Phase Fixes (included in Phase 4 scope per D-05)

These are admin bugs from Phase 1 that must be fixed before building Order dashboard:

### GameMedia Missing Presigned URLs
- GameMedia entity lacks [NotMapped] PresignedUrl field (PaymentConfig has this pattern)
- GET /api/admin/games/{id} returns GameMedia objects with ObjectKey but admin frontend needs PresignedUrl to display images
- GET /api/admin/games returns only imageCount, no primary image presigned URL — admin GameList grid view shows empty placeholder

### DTO Missing Extended Fields
- CreateGameDto / UpdateGameDto missing: IsFeatured, SystemRequirements, Ratings
- AdminGamesController.CreateGame() / UpdateGame() don't set these fields
- Game entity already has these fields with EF Core owned entity config (ToJson() for SystemRequirements, Ratings as JSON collection)

### Scope
- These fixes happen FIRST in Phase 4, before Order dashboard
- They touch only API + entity layer (AdminGamesController, Dtos, GameMedia), no frontend changes needed beyond what's already in Moxic.Admin
</backlog_fixes>

<design_system>
## Design System (Moxic.Admin)

Admin frontend has its own Steam-inspired design system, **separate from Moxic.Web storefront**.

| Role | Value | Usage |
|------|-------|-------|
| Background | #0b0b0e | Page bg |
| Surface | #121216 | Cards, sidebar |
| Surface-2 | #1a1a20 | Hover state |
| Surface-3 | #1f1f26 | Elevated cards, inputs |
| Border | #2a2a30 | Borders |
| Text | #c8c8d0 | Primary text |
| Muted | #6b6b78 | Secondary text |
| Blue (primary) | #66c0f4 | CTA, links, accent |
| Gold | #c9963b | Prices, discount |
| Green | #4caf50 | Available status |
| Red (danger) | #dc2626 | Delete, cancel |

**Corner style:** ounded-sm (4px) or ounded (8px). NOT square like Moxic.Web.

**Components:** Custom Steam-styled classes via App.css (.steam-input, .steam-btn, .steam-card).

**Icons:** lucide-react.

**Routing:** React Router v6 in BrowserRouter (already set up).
</design_system>

<decisions>
## Implementation Decisions

### 1. Prior-Phase Fixes (Wave 1)
- **D-01:** Add [NotMapped] PresignedUrl property to GameMedia entity (matching PaymentConfig pattern)
- **D-02:** GET /api/admin/games/{id} — after loading game, generate presigned URLs for all media items, map to PresignedUrl. Return DTO with presigned URLs, not raw entity.
- **D-03:** GET /api/admin/games — include primary image presigned URL in response (for admin GameList grid view)
- **D-04:** Add IsFeatured, SystemRequirements, Ratings to CreateGameDto / UpdateGameDto. Update controller to set these fields on create/update.
- **D-05:** These fixes are part of Phase 4 (not separate phase). Execute before Order dashboard work.

### 2. Order Dashboard — Backend (Wave 2)
- **D-06:** RESTful controller pattern: [Route("api/admin/orders")], [Authorize(Roles = "Admin")]. Match AdminGamesController pattern.
- **D-07:** Endpoints:
  - GET /api/admin/orders — list orders, newest first. Query params: status, romDate, 	oDate, search (by orderCode or customerPhone). Paginated. Returns items with summary fields (orderCode, customerPhone, totalAmount, status, createdAt, itemCount).
  - GET /api/admin/orders/{id} — full detail. Includes OrderDetails (gameName, price), customer Xbox info (decrypt password for admin viewing).
  - PUT /api/admin/orders/{id}/status — transition status. Body: { status: "Verifying" | "Installing" | "Completed" | "Cancelled" }. Validate status flow: Pending?Verifying?Installing?Completed. Cancel allowed from Pending or Verifying only. Preorder orders held until release date.
- **D-08:** Xbox password decryption: Create protector with same purpose "XboxPassword" via IDataProtectionProvider.Unprotect(). Decrypt only in GET detail endpoint for admin viewing.
- **D-09:** Order status transitions validated server-side: prevent invalid jumps (Pending?Completed directly), prevent processing preorder before release date.

### 3. Order Dashboard — Frontend (Wave 2)
- **D-10:** **Table view** — match GameList existing pattern (.steam-table, sortable columns). New route /admin/orders.
- **D-11:** **Modal detail** — Click order row ? opens modal overlay showing:
  - Order code, date, status badge
  - Item list: game name + price per item
  - Total amount
  - Customer info: phone, Xbox email, Xbox password (toggleable visibility with eye icon — D-12)
  - Zalo/FB (if provided)
  - Action buttons at bottom of modal: status transition buttons (active ones), Cancel (if applicable)
- **D-12:** Xbox password display: **Toggle visibility** — initially masked as "••••••••". Eye icon toggles to show plaintext (fetched from detail API which decrypts server-side).
- **D-13:** Filter toolbar above table: Status dropdown (All/Pending/Verifying/Installing/Completed/Cancelled), Date range (from/to), Search input for order code or phone.
- **D-14:** Preorder orders: flagged with "Preorder" badge, show release date in table. Status cannot advance past Pending if preorder release date not reached.
- **D-15:** Sidebar nav item "Orders" added to Moxic.Admin App.tsx. Icon: Package or ClipboardList.

### 4. the agent's Discretion
- Table column layout and widths
- Modal transition animation
- Pagination style (page numbers vs infinite scroll)
- Empty state and error state design
- Confirmation dialog style for status transitions and cancel

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Context & Requirements
- .planning/ROADMAP.md — Phase 4 goal: Admin Order Management (ORDR-01..08)
- .planning/REQUIREMENTS.md — ORDR-01..08 requirement details

### Backend Entities (Existing)
- API/Moxic.Core/Entities/Order.cs — Order entity (OrderCode, CustomerPhone, CustomerXboxEmail, CustomerXboxPasswordEncrypted, TotalAmount, Status enum, PaymentMethod, CreatedAt)
- API/Moxic.Core/Entities/OrderDetail.cs — OrderDetail entity (GameId, GameName snapshot, Price)
- API/Moxic.Core/Entities/GameMedia.cs — GameMedia entity (needs [NotMapped] PresignedUrl)
- API/Moxic.Core/Entities/Game.cs — Game entity (has IsFeatured, SystemRequirements, Ratings fields)
- API/Moxic.Core/Entities/SystemRequirementData.cs — SystemRequirement owned entity
- API/Moxic.Core/Entities/GameRating.cs — GameRating owned entity
- API/Moxic.Shared/Enums/MoxicEnums.cs — OrderStatus, PaymentMethod enums
- API/Moxic.Infrastructure/Data/MoxicDbContext.cs — DbContext config for all entities
- API/Moxic.Api/Models/Dtos.cs — DTOs (extend CreateGameDto/UpdateGameDto)

### Backend Controllers (Pattern Reference)
- API/Moxic.Api/Controllers/AdminGamesController.cs — Pattern for admin RESTful controller with Auth
- API/Moxic.Api/Controllers/OrdersController.cs — Pattern for order POST/GET, Data Protection usage
- API/Moxic.Api/Controllers/PaymentConfigController.cs — Pattern for MinIO presigned URL generation

### Frontend Admin (Pattern Reference)
- Moxic.Admin/src/App.tsx — Routes, sidebar nav, layout
- Moxic.Admin/src/pages/GameList.tsx — Table view pattern with search, stats, view toggle
- Moxic.Admin/src/pages/GameForm.tsx — Form/upload pattern
- Moxic.Admin/src/pages/PaymentConfig.tsx — Admin card layout pattern
- Moxic.Admin/src/App.css — Steam design system CSS classes

### Infrastructure
- API/Moxic.Infrastructure/Services/MinioService.cs — GetPresignedUrlAsync pattern
- API/Moxic.Api/Program.cs — Data Protection config (IDataProtectionProvider)
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (Frontend)
- GameList.tsx — Table pattern with search, stats cards, status badges, view toggle. Direct analog for OrderList.
- GameForm.tsx — Modal/detail pattern if needed.
- Steam CSS classes (.steam-input, .steam-btn, .steam-card, .steam-table) in App.css.

### Reusable Assets (Backend)
- AdminGamesController.cs — Full CRUD pattern with [Authorize], route structure, query params, pagination.
- OrdersController.cs (public) — Already has Data Protection usage pattern for encrypt/decrypt.
- PaymentConfigController.cs — Presigned URL generation pattern.

### Integration Points
- Moxic.Admin/src/App.tsx — Add /orders route + nav item to sidebar.
- Moxic.Admin/package.json — Has lucide-react for icons, React Router for routing.
- API/Moxic.Api/Program.cs — AddDataProtection() already configured.
</code_context>

<specifics>
## Specific Ideas

- Admin order table should feel like GameList but focused on order workflow
- Status transitions matching existing OrderStatus enum: Pending ? Verifying ? Installing ? Completed
- Cancel allowed from Pending or Verifying (not after Installing started)
- Encryption key: use same IDataProtectionProvider.CreateProtector("XboxPassword") for both encrypt (OrdersController) and decrypt (AdminOrdersController)
- Preorder check: game.Status == Preorder && game.ReleaseDate > DateTime.UtcNow — block status advancement past Pending
- GameMedia PresignedUrl: add [NotMapped] property + populate in controller (not service layer) — simplest fix, matches PaymentConfig pattern
</specifics>

<deferred>
## Deferred Ideas

- Email notification on order status change — Phase 5
- Auto-assign admin to order — future
- Export orders to CSV — future
</deferred>

---

*Phase: 04-admin-order-management*
*Context gathered: 2026-06-24*
