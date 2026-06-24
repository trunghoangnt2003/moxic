# Payment Proof Upload & AwaitingConfirmation Status

**Date:** 2026-06-24
**Status:** Design — Approved
**Phase:** Post-Phase 4 enhancement

## Flow

```
Checkout → Confirmation page (QR + bank info + upload)
  ├── User uploads payment proof → AwaitingConfirmation
  │     └── Admin verifies → Verifying → Installing → Complete
  │     └── Admin rejects (with reason) → Cancelled
  └── User clicks "Chuyển sau" → Pending (unchanged, waits for consultation)
```

## Status Diagram

```
Pending ──(upload proof)──→ AwaitingConfirmation
Pending ──(chuyển sau)────→ Pending (no change)
AwaitingConfirmation ──(verify)──→ Verifying
AwaitingConfirmation ──(reject)──→ Cancelled
Pending ──(admin cancel)──→ Cancelled
Verifying → Installing → Completed
```

## Entity Changes

### OrderStatus enum (MoxicEnums.cs)
Add `AwaitingConfirmation` (value between Pending and Verifying).

### Order entity (Order.cs)
| Field | Type | Notes |
|-------|------|-------|
| `PaymentProofObjectKey` | `string?` | MinIO key for proof image |
| `CancellationReason` | `string?` | Reason when admin rejects |

### PaymentConfig entity (PaymentConfig.cs)
| Field | Type | Notes |
|-------|------|-------|
| `BankName` | `string` | e.g. "Vietcombank" |
| `BankAccountNumber` | `string` | e.g. "0123456789" |
| `BankAccountHolder` | `string` | e.g. "NGUYEN VAN A" |

Requires EF Core migration.

## API Changes

### OrdersController (public)

**POST /api/orders/{orderCode}/proof**
- Content-Type: multipart/form-data
- Field: `file` (jpg/png/webp, max 5MB)
- Upload to MinIO at `proofs/{orderCode}/{guid}{ext}` using `moxic-games` bucket
- Set `order.PaymentProofObjectKey`, `order.Status = OrderStatus.AwaitingConfirmation`, `order.UpdatedAt`
- Return 200: `{ orderCode, status: "AwaitingConfirmation" }`

**GET /api/orders/{orderCode}**
Add to response:
- `paymentProofUrl: string?` — presigned URL if proof exists
- `paymentConfig.bankName`, `paymentConfig.bankAccountNumber`, `paymentConfig.bankAccountHolder`

### AdminOrdersController

**PUT /api/admin/orders/{id}/status**
Add transitions:
- `AwaitingConfirmation → Verifying` (required)
- `AwaitingConfirmation → Cancelled` (with reason)

Extend request DTO to allow optional `reason` field. When rejecting, save `order.CancellationReason = request.Reason`.

**GET /api/admin/orders/{id}**
Add to response:
- `paymentProofUrl: string?` — presigned URL of proof image
- `cancellationReason: string?`

### Admin PaymentConfigController

Expose new fields via GET/PUT:
- `bankName`, `bankAccountNumber`, `bankAccountHolder`

## Frontend Changes

### ConfirmationPage (Moxic.Web)

Layout below order summary:

```
[Bank Info section]
  Bank name, account number, account holder
  (from paymentConfig API response)

[QR display]
  Current bank/crypto tabs, QR, transfer content

[Upload section]  -- only shown if status is Pending
  File input (click to upload image)
  Preview thumbnail after selection
  Button "Tôi đã chuyển khoản"
    → POST /api/orders/{orderCode}/proof
    → On success: show "Đã gửi ảnh xác nhận, chờ admin duyệt"
  Button "Chuyển sau"
    → Navigate to /games, status stays Pending

[If status = AwaitingConfirmation]
  Show "Đã gửi ảnh xác nhận, vui lòng chờ admin duyệt" message
  No upload buttons
```

### PaymentConfig page (Moxic.Admin)

Add 3 input fields below the template section:
- Bank Name (text)
- Account Number (text)
- Account Holder (text)

Save triggers PUT /api/admin/payment-config with all fields.

### OrderDetailModal (Moxic.Admin)

**Status AwaitingConfirmation:**
- Show proof image (presigned URL, max-w-md)
- Show customer info as before
- Action buttons: "Verify" (→ Verifying), "Reject" (→ show reason input → Cancelled)

**Status Cancelled:**
- Show cancellation reason if present

**Status filter in OrderList:**
- Add "Awaiting Confirmation" option

## Transitions & Validation (server-side)

```
Pending → Cancelled: allowed (admin cancel)
Pending → Verifying: allowed (admin verify without proof)
AwaitingConfirmation → Verifying: allowed (admin approves proof)
AwaitingConfirmation → Cancelled: allowed (admin rejects proof, needs reason)
All other transitions: same as before
```

Preorder check remains: cannot advance past Pending if release date not reached.

## Migration

Standard EF Core migration for:
- Order table: add `PaymentProofObjectKey`, `CancellationReason`
- PaymentConfig table: add `BankName`, `BankAccountNumber`, `BankAccountHolder`

## Files Modified

### Backend
- API/Moxic.Shared/Enums/MoxicEnums.cs — add AwaitingConfirmation
- API/Moxic.Core/Entities/Order.cs — add 2 fields
- API/Moxic.Core/Entities/PaymentConfig.cs — add 3 fields
- API/Moxic.Infrastructure/Data/MoxicDbContext.cs — seed defaults for new PaymentConfig fields?
- API/Moxic.Api/Models/Dtos.cs — update DTOs
- API/Moxic.Api/Controllers/OrdersController.cs — add proof endpoint, update GET
- API/Moxic.Api/Controllers/AdminOrdersController.cs — add transitions, proof URL, reason
- API/Moxic.Api/Controllers/PaymentConfigController.cs — expose bank info fields

### Frontend (Moxic.Web)
- Moxic.Web/src/lib/api.ts — add uploadProof()
- Moxic.Web/src/types/game.ts — update types
- Moxic.Web/src/pages/ConfirmationPage.tsx — add upload + bank info sections

### Frontend (Moxic.Admin)
- Moxic.Admin/src/pages/PaymentConfig.tsx — add bank info form fields
- Moxic.Admin/src/pages/OrderList.tsx — add AwaitingConfirmation filter option
- Moxic.Admin/src/pages/OrderDetailModal.tsx — add proof image, verify/reject buttons

## Off-Scope for This Design

- Email notification when status changes to AwaitingConfirmation (Phase 5)
- Zalo notification for new proof upload (v2)
- Auto-verify via OCR (v2)
