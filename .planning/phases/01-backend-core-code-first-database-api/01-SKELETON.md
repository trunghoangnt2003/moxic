# Walking Skeleton — Moxic GameStore

**Phase:** 1
**Generated:** 2026-06-23

## Capability Proven End-to-End

An admin can log in, create a game with a cover image uploaded to MinIO, view the game in a list with presigned image URL, and configure payment QR codes — all running locally via Docker Compose + .NET 10 API + React admin page.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Backend framework | .NET 10 Web API | HTTP/2, native AOT, Minimal APIs, latest LTS |
| Data layer | EF Core 10 Code First + Npgsql | PostgreSQL support, migration tooling, strong typing |
| Database | PostgreSQL 16 | JSON columns for future flexibility, spatial data, full-text search |
| Object storage | MinIO (S3-compatible) | Presigned URL support, local dev with Docker, S3 API future-proof |
| Auth (Admin) | ASP.NET Core Identity + Cookie | Built-in, secure, simple for single-admin model |
| Encryption | ASP.NET Core Data Protection (AES-256) | Built-in key management, purpose strings, decryptable |
| API style | Controllers (admin) + Minimal APIs (public) | Pragmatic split — admin needs structure, public can be lean |
| Frontend (admin) | React 19 + Vite + Tailwind CSS 4 Dark | Epic-style dark theme, fast dev, minimal overhead |
| ORM mapping | Value Conversion for enums (Npgsql) | Store enums as strings in PostgreSQL for readability |
| ID generation | Guid (UUID v4) | Safe for exposed IDs, no sequential guessing |
| Migrations | EF Core migrations in CI | Version-controlled, repeatable, rollback-able |

## Stack Touched in Phase 1

- [x] Project scaffold (.NET 10 solution, React Vite app, Docker Compose)
- [x] Routing — game CRUD API routes, admin login, admin pages
- [x] Database — Game + Order + PaymentConfig tables via Code First migration
- [x] Object storage — MinIO image upload + presigned URL retrieval
- [x] UI — minimal React admin page: game list, game form, payment config form
- [x] Deployment — `docker-compose up` starts all services, documented run commands

## Out of Scope (Deferred to Later Slices)

- Public storefront UI (Phase 2)
- Cart + checkout flow (Phase 3)
- Full order management dashboard (Phase 4)
- Email notifications (Phase 5)
- User registration
- Automated game delivery
- Any payment gateway integration

## Subsequent Slice Plan

- **Phase 2:** Public Storefront — Epic-style dark UI, game grid, carousel, detail pages
- **Phase 3:** Cart, Checkout & Payment — add to cart, checkout form, QR display, order creation
- **Phase 4:** Admin Order Management — order dashboard, status workflow, preorder handling
- **Phase 5:** Notifications & Polish — email notifications, edge cases, admin alerts
