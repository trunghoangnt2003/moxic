# Research Summary: Moxic GameStore

## Stack
- **Backend**: .NET 10 + EF Core 10 (Code First), ASP.NET Core Identity (admin auth)
- **Frontend**: React 19 + Vite + Tailwind CSS 4 + TanStack Query + Zustand
- **Database**: PostgreSQL 16 (Npgsql EF Core provider)
- **Storage**: MinIO (S3-compatible, presigned URLs)
- **Email**: FluentEmail + SMTP/SendGrid

## Table Stakes
| Category | Features |
|----------|----------|
| Catalog | Game grid, carousel, detail page, search, filter by genre/status |
| Checkout | Cart, info form (phone, Xbox email/password), QR display |
| Admin Orders | Order list, status workflow (Pending→Verifying→Installing→Done) |
| Admin Games | CRUD game with image upload to MinIO, preorder date |
| Admin Config | QR bank + crypto upload, transfer content template |
| Notifications | Email on order status change |

## Key Architecture Decisions
1. **Vertical slice** via layer architecture (API → Core → Infrastructure)
2. **Minimal APIs** for public endpoints, Controllers for admin
3. **JWT** for API auth (future), Cookies for admin UI
4. **Order status state machine** with clear transitions
5. **AES-256 encryption** for Xbox account passwords

## Watch Out For
- **Xbox password encryption** is the highest security risk — use Data Protection API
- **Manual payment verification** needs clear UX to prevent human error
- **Presigned URL expiry** requires frontend retry logic or proxy endpoint
- **Preorder management** needs admin alerts for release date
- **Email deliverability** configure SPF/DKIM from day one

## Phase 1 Recommendation
Start with backend-first Code First approach: define domain models → EF Core migrations → PostgreSQL schema → core API endpoints (game CRUD, order workflow) → MinIO integration. Admin UI can be a minimal React SPA for Phase 1.

---
*Research completed: 2026-06-23*
