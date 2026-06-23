---
phase: 1
title: "Backend Core — Code First Database & API"
mode: mvp
skeleton: true
requirements_addressed: [GAME-01, GAME-02, GAME-03, GAME-04, GAME-05, PAY-01, PAY-02, PAY-03, PAY-04]
waves: 3
generated: 2026-06-23
revised: 2026-06-23
---

# Plan: Phase 1 — Backend Core

**Goal:** Thiết lập .NET 10 solution với Code First database (Game, GameMedia, Order, OrderDetail, PaymentConfig), MinIO integration, game CRUD API, image management, payment config API, và admin page tối thiểu.

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

*Game entity:*
- Id (Guid PK), Name (string 200), Description (text)
- OriginalPrice (decimal 18,2), SalePrice (decimal 18,2)
- Genre (string 100)
- Tags (string 500) — comma-separated: "Hot", "Sắp ra mắt"
- Status (enum: Available, Preorder)
- ReleaseDate (DateTime?, nullable)
- CreatedAt, UpdatedAt (shadow properties)
- Navigation: ICollection<GameMedia>

*GameMedia entity:*
- Id (Guid PK), GameId (Guid FK → Game)
- ObjectKey (string 500) — MinIO key: `games/{game-id}/{filename}`
- IsPrimary (bool) — flag for avatar/banner
- DisplayOrder (int) — sorting
- CreatedAt (DateTime)

*Order entity:*
- Id (Guid PK)
- OrderCode (string 50) — unique, format: "MOXIC-YYYYMMDD-XXXXX"
- CustomerPhone (string 20), CustomerXboxEmail (string 200)
- CustomerXboxPasswordEncrypted (string 500) — AES-256 encrypted
- CustomerZalo (string 100, nullable)
- TotalAmount (decimal 18,2)
- Status (enum: Pending, Verifying, Installing, Completed, Cancelled)
- PaymentMethod (enum: Bank, Crypto)
- IsClientConfirmed (bool) — client clicked "Đã chuyển khoản"
- ClientConfirmedAt (DateTime?, nullable)
- Notes (text?, nullable)
- CreatedAt, UpdatedAt
- Navigation: ICollection<OrderDetail>

*OrderDetail entity:*
- Id (Guid PK), OrderId (Guid FK → Order), GameId (Guid FK → Game)
- GameName (string 200) — snapshot
- Price (decimal 18,2) — snapshot price at purchase

*PaymentConfig entity:*
- Id (int PK) — single row
- BankBucketName (string 100) — default "moxic-config"
- BankQrObjectKey (string 500) — MinIO key for bank QR
- CryptoBucketName (string 100?, nullable)
- CryptoQrObjectKey (string 500?, nullable)
- TransferSyntaxTemplate (string 256) — "MOXIC {OrderCode}"
- UpdatedAt (DateTime)
- NotMapped: BankQrPresignedUrl, CryptoQrPresignedUrl

*Enums:* GameStatus, OrderStatus, PaymentMethod

**W1.4: EF Core DbContext + Configuration**
- `MoxicDbContext` with DbSet<Game>, DbSet<GameMedia>, DbSet<Order>, DbSet<OrderDetail>, DbSet<PaymentConfig>
- Fluent API:
  - Game: Name max 200, SalePrice decimal(18,2), index on Status+Genre+Tags
  - GameMedia: composite index on GameId+IsPrimary, cascade delete with Game
  - Order: OrderCode unique index, encrypted column config
  - OrderDetail: composite unique on OrderId+GameId
  - PaymentConfig: single-row enforce (check constraint or app-level)
- Shadow properties for audit (CreatedAt, UpdatedAt)
- Seed data: default PaymentConfig row with placeholder values

**W1.5: Generate EF Core migration**
- `Add-Migration InitialCreate` → initial schema with all 5 tables
- Verify migration SQL targets PostgreSQL (Npgsql)

**W1.6: ASP.NET Core Identity for Admin auth**
- Add Identity with UI (default Razor Pages)
- Seed admin user (credentials from appsettings)
- Cookie authentication for admin razor pages + API

### Success Criteria
- [ ] Solution compiles with `dotnet build`
- [ ] Docker Compose starts PostgreSQL + MinIO successfully
- [ ] `dotnet ef database update` creates all 5 tables
- [ ] Admin can log in with seeded credentials
- [ ] Swagger UI loads at `/swagger`

---

## Wave 2: Game Management — CRUD API + MinIO Media

### Tasks

**W2.1: Service layer**
- `IGameService` / `GameService` in Infrastructure
- Methods: GetList, GetById, Create, Update, Delete
- GetList filters: genre, status, tags, search keyword
- AutoMapper or manual mapping to DTOs
- `IGameMediaService` / `GameMediaService`
- Methods: AddMedia, DeleteMedia, SetPrimary, GetMediaByGameId

**W2.2: MinIO service integration**
- `MinioService` wrapping `MinioClient` SDK
- Methods: UploadObject(bucket, objectKey, stream, contentType), GetPresignedUrl(bucket, objectKey, expiry), DeleteObject(bucket, objectKey)
- Configuration: endpoint, access key, secret key from appsettings/ENV
- Bucket constants: `moxic-games`, `moxic-config`
- Default presigned URL expiry: 1 hour

**W2.3: Game API endpoints (public)**
- `GET /api/games` — paginated list, each item includes primary image presigned URL
- `GET /api/games/{id:guid}` — detail with all media presigned URLs
- `GET /api/games/{id:guid}/media` — list media files for game
- DTOs filter sensitive fields, include computed presigned URLs

**W2.4: Game API endpoints (admin)**
- `POST /api/admin/games` — create game
- `PUT /api/admin/games/{id:guid}` — update game
- `DELETE /api/admin/games/{id:guid}` — soft delete
- `GET /api/admin/games` — admin list (all games)
- `POST /api/admin/games/{id:guid}/media` — upload image → MinIO → create GameMedia record
- `DELETE /api/admin/games/{id:guid}/media/{mediaId:guid}` — delete media from MinIO + DB
- `PUT /api/admin/games/{id:guid}/media/{mediaId:guid}/primary` — set as primary (unset others)
- Protected by `[Authorize]`

**W2.5: Admin game management page (minimal React)**
- Basic React app (Vite + Tailwind dark theme)
- Game list table with search and filter
- Create/Edit game form: name, desc, original/sale price, genre, tags, status, release date
- Image gallery manager: upload multiple, set primary, reorder, delete
- Image preview with presigned URLs
- Dark theme CSS variables matching Epic-style

**W2.6: Image validation**
- Accept formats: jpg, png, webp
- Max file size: 5MB per image
- Auto-generate object key: `games/{game-id}/{guid}.{ext}`

### Success Criteria
- [ ] `GET /api/games` returns paginated list with primary image presigned URL
- [ ] Admin can create game → game + media saved to DB + MinIO
- [ ] Admin can upload multiple images per game → GameMedia records created
- [ ] Admin can set primary image → frontend loads correct avatar/banner
- [ ] Admin can delete media → object removed from MinIO + DB
- [ ] Admin page shows game list with cover images loaded from presigned URLs

---

## Wave 3: Payment Config API + Admin

### Tasks

**W3.1: PaymentConfig service**
- `IPaymentConfigService` / `PaymentConfigService`
- Methods: GetActive (single row), Upsert (update text fields)
- Presigned URL generation appended to NotMapped properties

**W3.2: PaymentConfig API endpoints (admin)**
- `GET /api/admin/payment-config` — get config with presigned QR URLs
- `PUT /api/admin/payment-config` — update TransferSyntaxTemplate only (text)
- `POST /api/admin/payment-config/bank-qr` — upload bank QR to MinIO (`config/bank-qr.{ext}`), update BankQrObjectKey
- `POST /api/admin/payment-config/crypto-qr` — upload crypto QR to MinIO (`config/crypto-qr.{ext}`), update CryptoQrObjectKey

**W3.3: Public payment config endpoint**
- `GET /api/payment-config/active` — returns TransferSyntaxTemplate + bank QR presigned URL + crypto QR presigned URL
- No wallet addresses exposed publicly

**W3.4: Admin payment config page (minimal React)**
- Image upload zones for Bank QR + Crypto QR with preview
- Text input for transfer syntax template (with {OrderCode} hint)
- Save button → PUT API
- Visual indicator showing last updated time

### Success Criteria
- [ ] Admin can upload Bank QR → MinIO → BankQrObjectKey saved
- [ ] Admin can upload Crypto QR → MinIO → CryptoQrObjectKey saved
- [ ] Admin can configure transfer template
- [ ] `GET /api/payment-config/active` returns QRs with presigned URLs + template
- [ ] Admin page shows QR previews before saving

---

## Cross-cutting Constraints

- All Xbox passwords encrypted with AES-256 via Data Protection (IDataProtector) — decryptable in Admin
- All image responses use presigned URLs with 1h expiry
- API responses use camelCase JSON
- All endpoints return proper HTTP status codes (200, 201, 400, 404, 401)
- Swagger/OpenAPI documented for all endpoints
- Vietnamese content supported (UTF-8)
- OrderCode format: "MOXIC-YYYYMMDD-XXXXX" (date + random/sequential suffix)
- IsClientConfirmed records customer self-confirmation timestamp
