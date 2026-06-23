# Phase 1 Summary: Backend Core — Code First Database & API

**Status:** Execution Complete
**Date:** 2026-06-23

## Wave 1: Foundation — Scaffold & Database ✓
- .NET 10 solution with 4 projects (Api, Core, Infrastructure, Shared)
- Docker Compose: PostgreSQL 16 + MinIO + bucket init
- Domain models: Game, GameMedia, Order, OrderDetail, PaymentConfig
- EF Core IdentityDbContext with PostgreSQL (13 tables total)
- ASP.NET Core Identity admin auth (cookie-based)
- Data Protection (AES-256) for Xbox password encryption
- Migration applied to running PostgreSQL instance

## Wave 2: Game CRUD + MinIO Media ✓
- Public game endpoints: GET /api/games (list), GET /api/games/{id} (detail with presigned URLs)
- Admin game endpoints: CRUD, image upload/delete/set-primary
- MinIO service integration with presigned URL generation (1h expiry)
- Image validation (jpg/png/webp, 5MB max)
- Multiple images per game via GameMedia table (IsPrimary flag)

## Wave 3: Payment Config ✓
- Admin endpoints: GET/PUT payment config, upload bank QR, upload crypto QR
- Public endpoint: GET /api/payment-config/active (for checkout display)
- Single-row PaymentConfig table with MinIO object keys
- Transfer syntax template configurable ("MOXIC {OrderCode}")
- Presigned URLs generated at API layer for QR images

## Admin UI ✓
- React 19 + Vite + Tailwind CSS 4 (dark theme)
- Login page (ASP.NET Identity integration)
- Game list with search, create/edit form with image upload manager
- Payment config page with QR upload and transfer template config

## Walking Skeleton ✓
- Full stack working: .NET API ↔ PostgreSQL ↔ MinIO
- Admin login → create game → upload images → set primary → view via presigned URL
- Payment config upload with preview
- All services run via `docker compose up`

## Key Numbers
- 5 domain tables + 6 Identity tables
- 9 API controllers (public + admin)
- 1 React admin app with 4 pages
- 0 warnings, 0 errors on build
