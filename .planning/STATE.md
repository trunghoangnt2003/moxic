# Plan State: Moxic GameStore

## Current Phase
**Phase 1: Backend Core — Code First Database & API** — ✅ Complete
**Next:** Phase 2 — Public Storefront

## Project Reference
See: .planning/PROJECT.md (updated 2026-06-23)

**Core value:** Khách hàng mua được game Xbox chính hãng giá rẻ hơn 30% so với Store với quy trình đặt niềm tin thông qua cài đặt thủ công uy tín.
**Current focus:** Phase 2 — Public Storefront

## Phase History

| Phase | Status | Date |
|-------|--------|------|
| 0 — Project Init | ✓ Complete | 2026-06-23 |
| 1 — Backend Core | ✅ Complete | 2026-06-23 |

## Active Decisions

| Decision | Status |
|----------|--------|
| .NET 10 + EF Core Code First | ✅ Validated |
| Static QR payment (no gateway) | ✅ Validated |
| Manual fulfillment | ✅ Validated |
| MinIO presigned URLs | ✅ Validated |
| Dark mode Epic-style UI | Pending (Phase 2) |
| Vertical MVP mode | Committed |
| AES-256 encryption for XboxPassword | ✅ Validated |
| PaymentConfig QR storage | ✅ Validated |
| GameMedia table (multiple images per game) | ✅ Validated |
| Order + OrderDetail (1:N normalized) | ✅ Validated |
| IsClientConfirmed for manual payment | ✅ Validated |

---
*State updated: 2026-06-23*
