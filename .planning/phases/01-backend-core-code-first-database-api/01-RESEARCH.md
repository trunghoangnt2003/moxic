# Phase 1 Research: Backend Core — Code First Database & API (Revised)

**Updated:** 2026-06-23 (incorporated refined entity design)

## Scope
R1: GAME-01 to GAME-05, PAY-01 to PAY-04

## Key Technical Mandates

### 1. AES-256 Encryption for XboxPassword
- Use ASP.NET Core Data Protection API (IDataProtector) with purpose string "XboxPassword"
- Symmetric encryption → decryptable in Admin panel for order fulfillment
- Store encrypted bytes as Base64 string in `Order.CustomerXboxPasswordEncrypted`
- Never expose plaintext in API responses to public endpoints
- Access logged for audit trail

### 2. PaymentConfig (Exact Design)
```csharp
public class PaymentConfig
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string BankBucketName { get; set; } = "moxic-config";

    [Required]
    [MaxLength(500)]
    public string BankQrObjectKey { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? CryptoBucketName { get; set; }

    [MaxLength(500)]
    public string? CryptoQrObjectKey { get; set; }

    [Required]
    [MaxLength(256)]
    public string TransferSyntaxTemplate { get; set; } = "MOXIC {OrderCode}";

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [NotMapped]
    public string? BankQrPresignedUrl { get; set; }
    [NotMapped]
    public string? CryptoQrPresignedUrl { get; set; }
}
```
- Single-row table (only one active config)
- Stores MinIO object keys + bucket names for bank QR and crypto QR separately
- Transfer template uses `{OrderCode}` placeholder
- Presigned URLs are not-mapped, generated at API layer

### 3. MinIO Presigned URLs
- Buckets: `moxic-games` (game media), `moxic-config` (QR images)
- Presigned GET URL: 1-hour expiry, generated at API layer
- Upload: Admin PUT directly via API with MinIO SDK
- Frontend receives URL, displays as regular `<img src>`

### 4. Client Payment Confirmation
- `IsClientConfirmed` (bool) + `ClientConfirmedAt` (DateTime?) on Order
- After scanning QR, customer clicks "Tôi đã chuyển khoản" button
- System records confirmation timestamp
- Admin sees both "client confirmed" and still manually verifies in bank app

## Database Schema (Code First Entities)

### Game
| Column | Type | Notes |
|--------|------|-------|
| Id | Guid | PK |
| Name | string(200) | Required |
| Description | text | Required |
| OriginalPrice | decimal(18,2) | Giá gốc Store |
| SalePrice | decimal(18,2) | Giá bán |
| Genre | string(100) | Genre/tag |
| Tags | string(500) | Comma-separated: "Hot", "Sắp ra mắt", etc. |
| Status | enum (Available/Preorder) | |
| ReleaseDate | DateTime? | Null for available games |
| CreatedAt | DateTime | |
| UpdatedAt | DateTime | |

### GameMedia
| Column | Type | Notes |
|--------|------|-------|
| Id | Guid | PK |
| GameId | Guid | FK → Game |
| ObjectKey | string(500) | MinIO object key: `games/{game-id}/{filename}` |
| IsPrimary | bool | Flag for avatar/banner image |
| DisplayOrder | int | Sorting order |
| CreatedAt | DateTime | |

### Order
| Column | Type | Notes |
|--------|------|-------|
| Id | Guid | PK |
| OrderCode | string(50) | "MOXIC-YYYYMMDD-XXXXX" |
| CustomerPhone | string(20) | Required |
| CustomerXboxEmail | string(200) | Required |
| CustomerXboxPasswordEncrypted | string(500) | AES-256 encrypted |
| CustomerZalo | string(100) | Optional |
| TotalAmount | decimal(18,2) | Sum of details |
| Status | enum (Pending/Verifying/Installing/Completed/Cancelled) | |
| PaymentMethod | enum (Bank/Crypto) | |
| IsClientConfirmed | bool | Customer clicked "Đã chuyển khoản" |
| ClientConfirmedAt | DateTime? | When customer confirmed |
| Notes | text? | Admin internal |
| CreatedAt | DateTime | |
| UpdatedAt | DateTime | |

### OrderDetail
| Column | Type | Notes |
|--------|------|-------|
| Id | Guid | PK |
| OrderId | Guid | FK → Order |
| GameId | Guid | FK → Game |
| GameName | string(200) | Snapshot |
| Price | decimal(18,2) | Snapshot price at purchase |

### PaymentConfig
(Single-row, design as specified above)

## API Endpoints

### Public
- `GET /api/games` → list with pagination, filter, sort, includes primary media presigned URL
- `GET /api/games/{id}` → detail with all media presigned URLs
- `GET /api/games/{id}/media` → list media for a game
- `GET /api/payment-config/active` → active QR config + transfer template (presigned URLs)

### Admin (cookie auth)
- `POST /api/admin/games` → create game
- `PUT /api/admin/games/{id}` → update game
- `DELETE /api/admin/games/{id}` → delete (soft)
- `GET /api/admin/games` → admin list
- `POST /api/admin/games/{id}/media` → upload media image
- `DELETE /api/admin/games/{id}/media/{mediaId}` → delete media
- `PUT /api/admin/games/{id}/media/{mediaId}/primary` → set primary
- `GET /api/admin/payment-config` → get config
- `PUT /api/admin/payment-config` → update text fields
- `POST /api/admin/payment-config/bank-qr` → upload bank QR
- `POST /api/admin/payment-config/crypto-qr` → upload crypto QR

## Tech Dependencies
- .NET 10 SDK
- EF Core 10 + Npgsql (PostgreSQL)
- Minio.DotNet SDK
- Swagger/OpenAPI
- ASP.NET Core Identity (admin auth)

---
*Research completed (revised): 2026-06-23*
