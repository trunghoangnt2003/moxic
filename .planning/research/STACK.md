# Stack Research: Moxic GameStore

## Backend: .NET 10 + EF Core

### .NET 10
- Latest LTS release with native AOT, improved minimal APIs, and OpenAPI built-in
- **Recommendation**: Use **Minimal APIs** for simple endpoints (game CRUD, cart) and **Controller-based** for admin panel — pragmatic split
- Built-in OpenAPI/Swagger for API documentation
- Strong typing, great async support for I/O-bound operations (MinIO uploads, DB queries)

### EF Core 10
- Code First is ideal for Phase 1 — define domain models → generate migrations → PostgreSQL
- Key patterns:
  - `Owned Entities` for value objects (e.g., Price {OriginalPrice, SalePrice})
  - `Shadow Properties` for audit fields (CreatedAt, UpdatedAt)
  - `Enum Conversions` for OrderStatus, GameStatus
  - `JSON Columns` (PostgreSQL) for flexible metadata if needed
- **Watch out**: EF Core lazy loading is off by default — explicit eager loading with `.Include()` is safer

### Authentication
- ASP.NET Core Identity for admin auth (cookie-based)
- JWT Bearer for API auth (if needed for future API clients)
- Phase 1: Admin only — simple Identity setup sufficient

## Frontend: React

### Framework
- **React 19 + Vite** for fast dev/build
- **React Router v7** for routing
- **Tailwind CSS 4** + dark mode (utility-first, matches Epic-style custom design)
- No heavy component library — build custom Epic-style components for authenticity

### State Management
- **React Query (TanStack Query)** for server state (game list, game detail, orders)
- **Zustand** for client state (cart, UI state) — lightweight, no boilerplate

### Image Handling
- Presigned URLs from MinIO — treat as regular `<img src>` URLs
- No need for image optimization pipeline in Phase 1

## Database: PostgreSQL

### Why PostgreSQL for this project
- JSON support for flexible game metadata (system requirements, screenshots)
- Full-text search for game search (no extra search service needed in Phase 1)
- Great EF Core support via Npgsql provider
- Enums natively supported by Npgsql

### Key considerations
- Use `uuid` for primary keys (vs auto-increment) — safer for exposed IDs
- Use `timestamp with time zone` consistently
- Index on: Game.Status, Game.Genre, Order.Status, Order.CreatedAt

## Object Storage: MinIO

### Setup
- Docker Compose for local MinIO instance
- Bucket: `moxic-games` for game cover images
- Presigned URL: GET only, expiry 1 hour for viewing
- Upload: Admin uses presigned POST or direct PUT with temporary token

### Security
- MinIO access key + secret key in environment variables
- Bucket policy: private, access only via presigned URLs
- CORS configured for frontend domain

### Alternative considered
- Azure Blob / AWS S3 — overkill for Phase 1, MinIO is S3-compatible and local
- Local filesystem — doesn't scale, presigned URL pattern is requirement

## Payment: Static QR

### Approach
- No payment gateway integration
- Admin uploads QR image to MinIO (bank + crypto variants)
- Checkout page displays QR + order code as transfer content
- Admin manually verifies payment in bank app → clicks "Received" in admin

### Security considerations
- Order code in transfer message prevents confusion
- Manual verification is the weakest link — build clear UI workflow

## Email

- **FluentEmail** + SMTP (or SendGrid if available) for order notifications
- Templates: Order confirmation, Payment received, Game installed

---
*Research completed: 2026-06-23*
