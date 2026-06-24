---
phase: 03-cart-checkout-payment
plan: 03
type: auto
subsystem: frontend
tags: [confirmation, qr, payment]
key-files:
  - Moxic.Web/src/pages/ConfirmationPage.tsx
  - Moxic.Web/src/components/checkout/QRDisplay.tsx
  - Moxic.Web/src/components/checkout/ConfirmationContent.tsx
  - Moxic.Web/src/App.tsx
metrics:
  files_created: 3
  commits: 1
---

## Tasks

### Task 1: Create QRDisplay accordion component
- QRDisplay.tsx — Bank/crypto toggle with segmented-control buttons
- Shows QR image (max-w-[280px]) or placeholder if URL missing
- Transfer content box with copy button
- Inactive crypto tab dimmed when no URL

### Task 2: Create ConfirmationContent component
- ConfirmationContent.tsx — Order code (copyable), item list, total, date
- Instruction text about payment flow

### Task 3: Create ConfirmationPage with API fetch + route
- ConfirmationPage.tsx — TanStack Query fetch from getOrder(orderCode)
- Three states: loading (HeroSkeleton), error (not found + link back), success (content + QR + instructions)
- Route /confirmation/:orderCode already added to App.tsx

## Deviations
- None

## Self-Check

- [x] /confirmation/:orderCode shows order details
- [x] Loading/error/success states handled
- [x] Bank QR shown by default, can switch to crypto
- [x] Transfer content (order code) copyable
- [x] Instructions visible
- [x] TypeScript: tsc --noEmit passed
