# Phase 5: Notifications & Polish — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-24
**Phase:** 5-Notifications & Polish
**Areas discussed:** Email Provider, Admin Notification, Edge Cases, UI Polish Scope

---

## Email Provider

| Option | Description | Selected |
|--------|-------------|----------|
| SMTP + Mailpit | Self-hosted SMTP with Mailpit container for dev | |
| SendGrid | External transactional email API | |
| Resend | Modern transactional email API, .NET SDK available | ✓ |

**User choice:** Resend
**Notes:** User provided Resend API key. Use Resend .NET SDK. HTML templates via Razor/FluentEmail. Sender name: "Moxic GameStore".

---

## Admin Notification

| Option | Description | Selected |
|--------|-------------|----------|
| Email + in-app badge | Send email + show dashboard notification count | |
| Email only | Send to admin email when new order created | ✓ |
| Dashboard only | In-app badge without email | |

**User choice:** Email only to moxmoz29@gmail.com
**Notes:** No in-app dashboard badge needed in Phase 5.

---

## Edge Cases

| Sub-area | Option | Selected |
|----------|--------|----------|
| Payment timeout | 12h / 24h / 48h / never | ✓ 24h |
| Failed email send | Retry then log / queue / ignore | ✓ Retry 3x (Polly exp backoff) then log |
| Cancellation email | Yes / No | ✓ Yes, with reason |
| Wrong Xbox info | New status ActionRequired + auto-email | ✓ |
| Install failure recovery | Allow rollback to Processing | ✓ |

**Notes:**
- 24h timeout: sweet spot for digital game store — long enough for bank delays, short enough to prevent phantom holds
- Polly retry: 2s → 4s → 8s exponential backoff, covers 95% of transient HTTP failures
- Cancellation email: required for UX — customer needs to know why
- Wrong Xbox info: new status ActionRequired/OnHold, auto-email with update link
- Install failure: admin needs ability to rollback, not locked into forward-only transitions

---

## UI Polish Scope

| Sub-area | Decision | Selected |
|----------|----------|----------|
| Loading states | Skeleton screens + spinners for games, orders, details | ✓ |
| Empty states | Cart (bag+icon+button), search (clear filters), order list (status-based) | ✓ |
| 404 page | Custom Moxic-branded, "Back to Storefront" button | ✓ |
| Navigation gaps | "Continue Shopping" on confirmation page | ✓ |
| Toast notifications | Add-to-cart + error states only | ✓ |
| Checkout success | Full-page redirect (not toast) | ✓ |
| Form validation | onBlur triggering, keep current inline style | ✓ |
| Card micro-interactions | Lift/scale hover + shadow transition | ✓ |
| Disabled buttons | Grayed out + not-allowed during processing | ✓ |

**Notes:** 3 pillars: (1) Loading states — eliminate flash-of-white, (2) Empty states & navigation gaps, (3) Feedback, validation & micro-interactions. No ripple effects or complex page transitions.

---

## Agent Discretion

- Exact skeleton screen shapes and dimensions for each page
- Empty state icon choice and visual hierarchy
- Toast positioning (top-right default), auto-dismiss duration
- Email template HTML structure within "clean branded" constraint
- Background job interval for payment timeout (recommended 15-30 min)

## Deferred Ideas

- Zalo notification integration — v2 (NOTF-04)
- Multi-language support — v2 (UI-05)
- Real-time dashboard updates (SignalR) — future phase
- Message queue (RabbitMQ/Hangfire) for email reliability — not needed in Phase 5
- User registration / order history — v2 (USR-01, USR-02)
