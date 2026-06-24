# Phase 5: Notifications & Polish — Context

**Gathered:** 2026-06-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Email notification system for order lifecycle events (new order → admin, Verifying → customer, Completed → customer), admin alerts, plus UI polish (loading states, empty states, navigation gaps, micro-interactions) and edge case handling (payment timeout, retry logic, cancellation emails, wrong Xbox info, install failure recovery).

**Requirements:** NOTF-01, NOTF-02, NOTF-03

</domain>

<decisions>
## Implementation Decisions

### 1. Email Infrastructure
- **D-01:** Use **Resend .NET SDK** for transactional email sending. No local SMTP container in docker-compose.
- **D-02:** Resend API key: `re_REDACTED` (store in appsettings or env var, never commit to public VCS).
- **D-03:** Email templates: **HTML via Razor/FluentEmail template engine**. Clean branded templates matching the dark gaming aesthetic.
- **D-04:** Sender name: **"Moxic GameStore"** — display name customers see in inbox.
- **D-05:** NuGet packages needed: `Resend` SDK + `FluentEmail.Razor` for template rendering.

### 2. Admin Notification
- **D-06:** New order notification sent to **moxmoz29@gmail.com** only.
- **D-07:** No in-app dashboard badge — email-only for Phase 5.
- **D-08:** Trigger: on successful POST /api/orders (in `OrdersController.CreateOrder()`).

### 3. Customer Notifications (Triggers)
- **D-09:** NOTF-01: Email when order moves to **Verifying** (payment confirmed). Trigger: in `AdminOrdersController.UpdateOrderStatus()` on transition to Verifying.
- **D-10:** NOTF-02: Email when order moves to **Completed** (game installed). Trigger: same controller, transition to Completed.
- **D-11:** NOTF-03: Email to `moxmoz29@gmail.com` when any new order is created (see D-06).
- **D-12:** Cancellation notification: email to customer with reason when order is cancelled (by admin or payment timeout auto-cancel).
- **D-13:** Wrong Xbox info: email auto-sent when admin marks order as ActionRequired/OnHold — asks customer to update credentials.

### 4. Edge Cases
- **D-14:** **Payment timeout** — background job auto-cancels orders still in Pending after 24 hours.
- **D-15:** **Failed email send** — retry 3 times with exponential backoff (Polly library), then log error and skip. No message queue needed for Phase 5.
- **D-16:** **Wrong Xbox info** — new order status `ActionRequired` (or `OnHold`). Admin transitions failed-login orders here, system emails customer with update link.
- **D-17:** **Install failure recovery** — Admin can transition an Installing order back to Verifying/Processing. Not locked to forward-only.

### 5. UI Polish — Loading States
- **D-18:** Skeleton screens for game list, order list, and detail pages — pulsing gray rectangles matching component dimensions.
- **D-19:** Spinner/loader during API calls where skeleton is impractical.
- **D-20:** No white flash-of-dead-content on any page.

### 6. UI Polish — Empty States & Navigation Gaps
- **D-21:** **Cart empty**: shopping bag icon + "Your cart is empty. Let's fill it with games!" + "Browse Games" button.
- **D-22:** **Game search/catalog no results**: "No games found matching your filters" + "Clear Filters" button.
- **D-23:** **Admin order list empty**: "No orders placed yet" or "No orders matching this status" depending on filter context.
- **D-24:** **404 page**: Custom Moxic-branded error page — "Oops! This page glitched out" + "Back to Storefront" button. No hard redirect.
- **D-25:** **Confirmation page**: Add "Continue Shopping" link after order success.

### 7. UI Polish — Feedback, Validation & Micro-interactions
- **D-26:** **Toast notifications** for: add-to-cart ("Game added to cart!" with "View Cart" shortcut), error states ("Failed to update cart", "Invalid Xbox info").
- **D-27:** Checkout success uses full-page redirect (not toast) — feels more official/secure for paid transactions.
- **D-28:** **Form validation**: trigger onBlur (when leaving the input field). Keep current inline error style, no heavy library upgrade.
- **D-29:** **Card hover**: subtle lift `translateY(-4px)` + smooth shadow transition on game cards.
- **D-30:** **Disabled button states**: grayed out with `not-allowed` cursor during order processing to prevent double-submit.
- **D-31:** No ripple effects or complex page transitions — keep code lightweight.

### 8. Technical Approach
- **D-32:** Use **Polly** NuGet package for retry with exponential backoff on email send failures.
- **D-33:** Email service as a scoped/transient service (`IEmailService`), injected into controllers. Controllers don't implement retry — service handles it.
- **D-34:** Resend service configuration: `builder.Services.AddResend(options => { options.ApiKey = config["Resend:ApiKey"]; })`.
- **D-35:** Background job for payment timeout: use `IHostedService` with a timer (runs every 15-30 min), queries orders Pending > 24h → auto-cancel → send email.
- **D-36:** Template files stored in `Moxic.Api/Emails/Templates/` as `.cshtml` (Razor views).

### Agent's Discretion
- Exact skeleton screen shapes and dimensions for each page
- Empty state icon choice and visual hierarchy
- Toast positioning (top-right default), auto-dismiss duration (3-5s typical)
- Email template HTML structure within the "clean branded" constraint
- Background job interval exact value (recommended 15-30 min)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Context & Requirements
- `.planning/ROADMAP.md` — Phase 5 goal: Notifications & Polish (NOTF-01-03)
- `.planning/REQUIREMENTS.md` — NOTF-01..03 requirement details

### Backend — Existing Controllers (hook points)
- `API/Moxic.Api/Controllers/OrdersController.cs` — Order creation, add admin notification hook in `CreateOrder()`
- `API/Moxic.Api/Controllers/AdminOrdersController.cs` — Status transitions, add customer email hooks in `UpdateOrderStatus()`
- `API/Moxic.Api/Program.cs` — DI setup pattern, where to add `AddResend()` and `AddHostedService()`
- `API/Moxic.Api/Moxic.Api.csproj` — Add Polly, Resend, FluentEmail.Razor NuGet packages

### Backend — Entities (order status reference)
- `API/Moxic.Core/Entities/Order.cs` — Order entity with Status, OrderCode, CustomerXboxEmail, etc.
- `API/Moxic.Shared/Enums/MoxicEnums.cs` — OrderStatus enum
- `API/Moxic.Infrastructure/Data/MoxicDbContext.cs` — DbContext

### Frontend (Polish targets)
- `Moxic.Web/src/App.tsx` — Route setup, add 404 route
- `Moxic.Web/src/components/shared/CartDrawer.tsx` — Add empty state
- `Moxic.Web/src/pages/GamesPage.tsx` — Add empty search state + skeleton
- `Moxic.Admin/src/pages/OrderList.tsx` — Add empty filter state + skeleton
- `Moxic.Web/src/pages/ConfirmationPage.tsx` — Add "Continue Shopping" link
- `Moxic.Web/src/components/checkout/CheckoutForm.tsx` — onBlur validation

### Design System
- `Moxic.Web/src/index.css` — Web storefront design tokens (dark theme, fonts: Outfit/Inter, cream accent #e5d3b3)
- `Moxic.Admin/src/App.css` — Admin Steam-style design system (dark zinc palette, blue accent #66c0f4)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Moxic.Web/src/components/shared/CartDrawer.tsx` — Already has slide-in drawer pattern, add empty state inside
- `Moxic.Web/src/components/shared/Skeleton.tsx` — HeroSkeleton exists, extend for card/grid/list skeletons
- `Moxic.Web/src/components/layout/Navbar.tsx` — Navbar with cart count badge, update for toast integration

### Established Patterns
- **Controller DI:** Constructor injection via IMinioService, IDataProtectionProvider pattern — replicate for IEmailService
- **Frontend lazy loading:** lazy(() => import(...)) + Suspense — add for 404 page
- **Tailwind dark theme:** CSS variables in @theme directive (Moxic.Web) / custom classes (Moxic.Admin)

### Integration Points
- `OrdersController.CreateOrder()` — After SaveChangesAsync(), call IEmailService.SendNewOrderNotification()
- `AdminOrdersController.UpdateOrderStatus()` — After status transition, call appropriate email method based on new status
- `Program.cs` — Add services.AddResend(), services.AddSingleton<IEmailService, EmailService>(), services.AddHostedService<PaymentTimeoutService>()

</code_context>

<specifics>
## Specific Ideas

- Email templates should match the dark gaming aesthetic — dark background, orange #f97316 accent (storefront) / blue #66c0f4 (admin)
- Customer-facing emails in Vietnamese, admin notification email in Vietnamese
- Payment timeout should not immediately cancel — order remains in Pending for 24h, then auto-cancel
- Skeleton screens preferred over spinners for list/grid views (matches Epic Games Store pattern)
- 404 page: "Oops! This page glitched out" text with game-themed illustration

</specifics>

<deferred>
## Deferred Ideas

- Zalo notification integration — v2 (NOTF-04)
- Multi-language support — v2 (UI-05)
- Real-time dashboard updates (SignalR) — future phase
- Message queue (RabbitMQ/Hangfire) for email reliability — not needed in Phase 5, Polly retry sufficient
- User registration / order history — v2 (USR-01, USR-02)

</deferred>

---

*Phase: 05-notifications-and-polish*
*Context gathered: 2026-06-24*
