---
phase: 1
title: "Backend Core — Code First Database & API"
mode: mvp
skeleton: true
requirements_addressed: [GAME-01, GAME-02, GAME-03, GAME-04, GAME-05, PAY-01, PAY-02, PAY-03, PAY-04]
waves: 3
generated: 2026-06-23
---

# Plan: Phase 1 — Backend Core

**Goal:** Thiết lập .NET 10 solution với Code First database, MinIO integration, game CRUD API, payment config API, và admin page tối thiểu để mockup ảnh.

## Wave 1: Foundation — Scaffold & Database

### Tasks

**W1.1: Create .NET 10 solution structure**
- Create solution `Moxic.sln` with projects:
  - `Moxic.Api` — Web API (Controllers + Minimal APIs)
  - `Moxic.Core` — Domain models, interfaces, DTOs
  - `Moxic.Infrastructure` — EF Core DbContext, MinIO service, Email service
  - `Moxic.Shared` — Enums, constants, extensions
- Configure solution for .NET 10 (target `net10.0`)
- Set up `.editorconfig`, `Directory.Build.props`

**W1.2: Docker Compose for local development**
- `docker-compose.yml` with:
  - PostgreSQL 16 container (port 5432, volume for data)
  - MinIO container (ports 9000 API, 9001 Console)
- `docker-compose.override.yml` for dev settings
- Init script for MinIO bucket creation (`moxic-games`, `moxic-config`)

**W1.3: Define domain models**
- Game entity (Id, Name, Description, OriginalPrice, SalePrice, Genre, Status, ReleaseDate, CoverImagePath, CreatedAt, UpdatedAt)
- Order entity (Id, OrderCode, CustomerPhone, CustomerXboxEmail, CustomerXboxPasswordEncrypted, CustomerZalo, TotalAmount, Status, PaymentMethod, Notes, GameId, GameName, GamePrice, CreatedAt, UpdatedAt)
- PaymentConfig entity (Id, Type, ImageUrl, WalletAddress, TransferContentTemplate, IsActive, UpdatedAt)
- Enums: GameStatus (Available, Preorder), OrderStatus (Pending, Verifying, Installing, Completed, Cancelled), PaymentMethod (Bank, Crypto), PaymentConfigType (Bank, Crypto)

**W1.4: EF Core DbContext + Configuration**
- `MoxicDbContext` with DbSet<Game>, DbSet<Order>, DbSet<PaymentConfig>
- Fluent API configurations:
  - Game: Name max 200, SalePrice decimal(18,2), index on Status+Genre
  - Order: OrderCode unique index, encrypted column for XboxPassword
  - PaymentConfig: Type+IsActive composite check
- Shadow properties for audit (CreatedAt, UpdatedAt)
- Seed data: default PaymentConfig row (placeholder)

**W1.5: Generate EF Core migration**
- `Add-Migration InitialCreate` → initial schema
- Script for `dotnet ef migrations add`
- Verify migration SQL targets PostgreSQL (Npgsql)

**W1.6: ASP.NET Core Identity for Admin auth**
- Add Identity with UI (default Razor Pages or simple login)
- Seed admin user (config from appsettings)
- Cookie authentication for admin endpoints

### Success Criteria
- [ ] Solution compiles with `dotnet build`
- [ ] Docker Compose starts PostgreSQL + MinIO successfully
- [ ] `dotnet ef database update` creates all 3 tables
- [ ] Admin can log in with seeded credentials
- [ ] Swagger UI loads at `/swagger`

### Dependencies
Dotnet SDK 10.0, Docker Desktop

---

## Wave 2: Game Management — CRUD API + MinIO

### Tasks

**W2.1: Game service layer**
- `IGameService` / `GameService` in Infrastructure
- Methods: GetList, GetById, Create, Update, Delete
- AutoMapper or manual mapping to DTOs
- Pagination + filtering (genre, status) + sorting

**W2.2: Game API endpoints (public)**
- `GET /api/games` — paginated list with presigned cover URLs
- `GET /api/games/{id:guid}` — detail with presigned cover URL
- DTOs: GameListItemDto, GameDetailDto (exclude sensitive fields)

**W2.3: Game API endpoints (admin)**
- `POST /api/admin/games` — create game
- `PUT /api/admin/games/{id:guid}` — update game
- `DELETE /api/admin/games/{id:guid}` — soft delete, mark inactive
- `GET /api/admin/games` — admin list (all games including inactive)
- Protected by `[Authorize]`

**W2.4: MinIO service integration**
- `MinioService` wrapping `MinioClient` SDK
- Methods: UploadImage(bucket, objectName, stream), GetPresignedUrl(bucket, objectName, expiry)
- Configuration: endpoint, access key, secret key from appsettings/ENV
- Bucket name constants: `moxic-games`, `moxic-config`
- Default expiry: 1 hour

**W2.5: Game image upload endpoint**
- `POST /api/admin/games/{id:guid}/image`
- Accept multipart form file
- Validate file type (jpg, png, webp) and size (max 5MB)
- Upload to MinIO: `games/{game-id}/cover.{ext}`
- Update Game.CoverImagePath in DB
- Return presigned URL

**W2.6: Admin game list page (minimal React)**
- Basic React app (Vite + Tailwind dark theme)
- Game list table with search and filter
- Create/Edit game form (all fields)
- Image upload with preview
- Dark theme CSS variables matching Epic-style

### Success Criteria
- [ ] `GET /api/games` returns paginated list with presigned image URLs
- [ ] Admin can create game via API → stored in DB
- [ ] Admin can upload image → stored in MinIO → presigned URL returned
- [ ] Admin can view/edit/delete games
- [ ] Admin page shows game list with cover images loaded from presigned URLs
- [ ] Image upload validates file type and size

### Dependencies
Wave 1 complete (DB, Docker, MinIO running)

---

## Wave 3: Payment Config API + Admin

### Tasks

**W3.1: PaymentConfig service**
- `IPaymentConfigService` / `PaymentConfigService`
- Methods: GetActive, Upsert
- Single-row or two-row pattern (Bank + Crypto)

**W3.2: PaymentConfig API endpoints (admin)**
- `GET /api/admin/payment-config` — get both Bank + Crypto configs
- `PUT /api/admin/payment-config` — upsert config values (text fields)
- `POST /api/admin/payment-config/bank-qr` — upload bank QR image to MinIO (`config/bank-qr.{ext}`)
- `POST /api/admin/payment-config/crypto-qr` — upload crypto QR image to MinIO (`config/crypto-qr.{ext}`)

**W3.3: Public payment config endpoint**
- `GET /api/payment-config/active` — trả về ảnh QR + template nội dung chuyển khoản (cho Frontend gọi tại trang checkout)
- Không trả về wallet address public (chỉ trả QR image)

**W3.4: Admin payment config page (minimal React)**
- Form to upload Bank QR image + preview
- Form to upload Crypto QR image + preview
- Input for wallet address
- Input for transfer content template (with {OrderCode} variable hint)
- Save button → PUT API

### Success Criteria
- [ ] Admin can upload Bank QR → stored in MinIO → path saved
- [ ] Admin can upload Crypto QR → stored in MinIO → path saved
- [ ] Admin can configure transfer content template
- [ ] `GET /api/payment-config/active` returns active configs with presigned QR URLs
- [ ] Admin page shows QR preview before saving

### Dependencies
Wave 1 complete (DB, Docker, MinIO), Wave 2 complete (MinIO service)

---

## Cross-cutting Constraints

- All passwords (Xbox) encrypted with AES-256 via Data Protection — decryptable in Admin
- All image responses use presigned URLs with 1h expiry
- API responses use camelCase JSON
- All endpoints return proper HTTP status codes (200, 201, 400, 404, 401)
- Swagger/OpenAPI documented for all endpoints
- Vietnamese content supported (UTF-8)

## Post-Planning Gaps

To be run after plan creation:
- Verify all 9 requirements (GAME-01..05, PAY-01..04) are covered
- Verify 3 technical mandates (AES-256 encryption, PaymentConfig QR storage, MinIO presigned URLs) appear in task descriptions
