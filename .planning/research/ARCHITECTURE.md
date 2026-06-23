# Architecture Research: Moxic GameStore

## High-Level Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   React App  │────▶│  .NET 10     │────▶│  PostgreSQL  │
│  (Vite +     │     │  Web API     │     │              │
│   Tailwind)  │◀────│  + Identity  │◀────│              │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │
                     ┌──────▼───────┐
                     │    MinIO     │
                     │  (Images)    │
                     └──────────────┘
```

### Layer Architecture (Backend)

```
Moxic.API          → Controllers / Minimal API endpoints
Moxic.Core         → Domain models, interfaces, DTOs
Moxic.Infrastructure → EF Core DbContext, Repositories, MinIO client, Email
Moxic.Shared       → Constants, Enums, Extensions (lightweight)
```

### Database Design (Phase 1 Entities)

```
Game
├── Id (Guid)
├── Name, Description
├── OriginalPrice (decimal)
├── SalePrice (decimal)
├── Genre (string/enum)
├── Status (Available | Preorder)
├── ReleaseDate (DateTime?, nullable for preorder)
├── CoverImageUrl (string — MinIO presigned path)
├── CreatedAt, UpdatedAt

Order
├── Id (Guid)
├── OrderCode (string — "DH" + sequential number)
├── CustomerPhone, CustomerXboxEmail, CustomerXboxPassword
├── CustomerZalo (string?, optional)
├── TotalAmount (decimal)
├── Status (Pending | Verifying | Installing | Completed | Cancelled)
├── PaymentMethod (Bank | Crypto)
├── Notes (string?)
├── CreatedAt, UpdatedAt

OrderItem
├── Id (Guid)
├── OrderId → Order
├── GameId → Game
├── GameName (snapshot)
├── Price (snapshot)

PaymentConfig
├── Id (Guid)
├── Type (Bank | Crypto)
├── ImageUrl (MinIO path)
├── WalletAddress (string?, for crypto)
├── TransferContentTemplate (string)
├── IsActive (bool)
├── UpdatedAt
```

### API Endpoints (Phase 1)

**Public:**
- `GET /api/games` — list games (with filtering, sorting, pagination)
- `GET /api/games/{id}` — game detail
- `POST /api/orders` — create order (checkout)
- `GET /api/orders/{id}` — order detail (by tracking code)

**Admin:**
- `POST /api/admin/games` — create game
- `PUT /api/admin/games/{id}` — update game
- `POST /api/admin/games/{id}/image` — upload cover image
- `GET /api/admin/orders` — list orders
- `GET /api/admin/orders/{id}` — order detail
- `PUT /api/admin/orders/{id}/status` — update order status
- `POST /api/admin/payment-config` — create/update payment config
- `GET /api/admin/payment-config` — get payment config

### Authentication Flow
- Admin: ASP.NET Core Identity with cookie auth
- Admin login page (separate from public site)
- Orders API protected with `[Authorize(Roles = "Admin")]`
- Public API: no auth required (anonymous browsing)

### MinIO Integration
- Use MinIO .NET SDK (`Minio` NuGet package)
- Presigned GET URL: `PresignedGetObjectAsync` with 1-hour expiry
- Admin upload: direct `PutObjectAsync` with admin credentials
- Images stored at path: `games/{game-id}/cover.{ext}`

### Order Status Machine

```
Pending ──▶ Verifying ──▶ Installing ──▶ Completed
  │            │
  └── Cancelled┘
```

- Pending → Verifying: Admin confirms payment received
- Verifying → Installing: Admin starts installation
- Installing → Completed: Installation done
- Pending → Cancelled: Order cancelled before payment
- Verifying → Cancelled: Refund issued (manual process)

---
*Research completed: 2026-06-23*
