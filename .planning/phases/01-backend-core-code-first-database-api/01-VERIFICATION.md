# Verification: Phase 1 — Backend Core

**Status:** PASSED
**Date:** 2026-06-23

## Success Criteria from ROADMAP

| Criterion | Status | Notes |
|-----------|--------|-------|
| Admin can create/edit/delete game with all fields via API | ✓ | POST/GET/PUT/DELETE /api/admin/games implemented |
| Admin can upload cover image → MinIO → presigned URL returned | ✓ | POST /api/admin/games/{id}/media stores in MinIO, returns presigned URL |
| Admin can configure bank + crypto QR payment images | ✓ | POST /api/admin/payment-config/bank-qr and /crypto-qr with MinIO storage |
| Full DB schema via EF Core Code First migrations | ✓ | 13 tables (5 business + 6 Identity + 1 EF) via InitialCreate migration |
| Admin can view game list with search/filter via API | ✓ | GET /api/admin/games with ?search query param |

## Requirements Coverage (9/9)

| REQ-ID | Status | Notes |
|--------|--------|-------|
| GAME-01 | ✓ | Game CRUD with name, desc, original/sale price, genre, tags, status |
| GAME-02 | ✓ | Image upload to MinIO with presigned URL generation |
| GAME-03 | ✓ | ReleaseDate + Preorder status on Game entity |
| GAME-04 | ✓ | Edit + delete games with cascading media cleanup |
| GAME-05 | ✓ | Admin game list with search |
| PAY-01 | ✓ | Bank QR upload endpoint |
| PAY-02 | ✓ | Crypto QR upload endpoint |
| PAY-03 | ✓ | TransferSyntaxTemplate configurable via PUT |
| PAY-04 | ✓ | QR preview via presigned URLs in admin page |

## Technical Mandates

| Mandate | Status | Notes |
|---------|--------|-------|
| AES-256 for XboxPassword | ✓ | Data Protection (PersistKeysToFileSystem) configured |
| PaymentConfig exact class | ✓ | BankBucketName, BankQrObjectKey, CryptoBucketName, CryptoQrObjectKey, TransferSyntaxTemplate |
| MinIO presigned URLs | ✓ | 1-hour expiry, served via API DTOs |
| IsClientConfirmed | ✓ | bool + DateTime? on Order entity |
| GameMedia table | ✓ | Multiple images per game with IsPrimary flag |
| Order + OrderDetail (1:N) | ✓ | Normalized order lines with snapshots |

## Build & Deploy

| Check | Status |
|-------|--------|
| dotnet build | ✓ 0 errors, 0 warnings |
| npm run build (admin) | ✓ 0 errors |
| dotnet ef migrations | ✓ Applied to PostgreSQL |
| Docker Compose up | ✓ PostgreSQL + MinIO + buckets created |
| Database tables | ✓ All 13 tables present |
| GET /api/games | ✓ 200: empty list (expected) |
| Swagger/OpenAPI | ✓ Available at /openapi/v1.json |

## Gaps

None identified for Phase 1 scope.
