<!-- GSD:project-start source:PROJECT.md -->

## Project

Moxic GameStore là nền tảng thương mại điện tử bán key game Xbox (dạng digital code/service) tại thị trường Việt Nam. Khách hàng có thể duyệt, mua và đặt trước (pre-order) game Xbox với giá rẻ hơn Store chính hãng từ 30%. Sau khi thanh toán trực tiếp qua QR Bank hoặc Crypto, khách cung cấp thông tin tài khoản Xbox và người bán (sole merchant) sẽ tiến hành cài đặt game thủ công. Giao diện dark mode theo phong cách Epic Games Store.

**Core Value:** Khách hàng mua được game Xbox chính hãng giá rẻ hơn 30% so với Store với quy trình đặt niềm tin thông qua cài đặt thủ công uy tín.

### Constraints

- **Stack**: .NET 10 (Web API + EF Core) cho backend, React cho frontend, PostgreSQL làm database, MinIO làm object storage
- **Thanh toán**: Chỉ dùng ảnh QR tĩnh, hiển thị nội dung chuyển khoản theo mã đơn hàng để đối soát thủ công
- **Fulfillment**: Hoàn toàn thủ công (admin login Xbox account khách → cài game → xác nhận)
- **Bảo mật**: Hệ thống lưu trữ Password tài khoản Xbox của khách — cần mã hóa và xử lý cẩn trọng

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Backend: .NET 10 + EF Core

### .NET 10

- Latest LTS release with native AOT, improved minimal APIs, and OpenAPI built-in
- **Recommendation**: Use **Minimal APIs** for simple endpoints (game CRUD, cart) and **Controller-based** for admin panel — pragmatic split
- Built-in OpenAPI/Swagger for API documentation
- Strong typing, great async support for I/O-bound operations (MinIO uploads, DB queries)

### EF Core 10

- Code First is ideal for Phase 1 — define domain models → generate migrations → PostgreSQL
- Key patterns:
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

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
