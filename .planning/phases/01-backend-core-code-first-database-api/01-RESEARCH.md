# Phase 1 Research: Backend Core — Code First Database & API

## Scope
R1: GAME-01 to GAME-05, PAY-01 to PAY-04

## Key Technical Mandates

### 1. AES-256 Encryption for XboxPassword
- Use ASP.NET Core Data Protection API (IDataProtector) with purpose string "XboxPassword"
- Symmetric encryption → decryptable in Admin panel for order fulfillment
- Store encrypted bytes as Base64 string in `Orders.XboxPasswordEncrypted`
- Never expose plaintext in API responses to public endpoints
- Access logged for audit trail

### 2. PaymentConfig Table
- Single-row config table (or key-value) storing:
  - BankQRImageUrl (MinIO path for VietQR)
  - CryptoQRImageUrl (MinIO path for wallet QR)
  - CryptoWalletAddress (USDT/BTC address string)
  - TransferContentTemplate (e.g., "DH{OrderCode}")
- Admin UI to upload QR images → MinIO → store path

### 3. MinIO Presigned URLs
- Bucket: `moxic-games` for game covers, `moxic-config` for QR images
- Presigned GET URL: 1-hour expiry, generated at API level
- Upload: Admin PUT directly via API with MinIO SDK
- Frontend receives URL, displays as regular `<img src>`

## Database Schema (Code First Entities)

### Game
| Column | Type | Notes |
|--------|------|-------|
| Id | Guid | PK |
| Name | string(200) | Required |
| Description | text | Required |
| OriginalPrice | decimal(18,2) | Giá gốc Store |
| SalePrice | decimal(18,2) | Giá bán của bạn |
| Genre | string(100) | Enum-like |
| Status | enum (Available/Preorder) | |
| ReleaseDate | DateTime? | Null for available games |
| CoverImagePath | string(500) | MinIO object path |
| CreatedAt | DateTime | |
| UpdatedAt | DateTime | |

### Order
| Column | Type | Notes |
|--------|------|-------|
| Id | Guid | PK |
| OrderCode | string(50) | "DH-YYYYMMDD-XXX" |
| CustomerPhone | string(20) | Required |
| CustomerXboxEmail | string(200) | Required |
| CustomerXboxPasswordEncrypted | string(500) | AES-256 encrypted |
| CustomerZalo | string(100) | Optional |
| TotalAmount | decimal(18,2) | |
| Status | enum (Pending/Verifying/Installing/Completed/Cancelled) | |
| PaymentMethod | enum (Bank/Crypto) | |
| Notes | text? | Admin internal |
| GameId | Guid | FK → Game |
| GameName | string(200) | Snapshot |
| GamePrice | decimal | Snapshot |
| CreatedAt | DateTime | |
| UpdatedAt | DateTime | |

### PaymentConfig
| Column | Type | Notes |
|--------|------|-------|
| Id | Guid | PK |
| Type | enum (Bank/Crypto) | |
| ImageUrl | string(500) | MinIO path |
| WalletAddress | string(200) | Crypto only |
| TransferContentTemplate | string(200) | |
| IsActive | bool | |
| UpdatedAt | DateTime | |

## API Endpoints

### Public
- `GET /api/games` → list with pagination, filter, sort
- `GET /api/games/{id}` → detail with presigned cover URL

### Admin (cookie auth)
- `POST /api/admin/games` → create
- `PUT /api/admin/games/{id}` → update
- `DELETE /api/admin/games/{id}` → delete
- `POST /api/admin/games/{id}/image` → upload cover
- `GET /api/admin/games` → admin list
- `GET /api/admin/payment-config` → get config
- `PUT /api/admin/payment-config` → upsert
- `POST /api/admin/payment-config/bank-qr` → upload bank QR
- `POST /api/admin/payment-config/crypto-qr` → upload crypto QR

## Tech Dependencies
- .NET 10 SDK
- EF Core 10 + Npgsql (PostgreSQL)
- Minio.DotNet SDK
- Swagger/OpenAPI
- ASP.NET Core Identity (admin auth)

---
*Research completed: 2026-06-23*
