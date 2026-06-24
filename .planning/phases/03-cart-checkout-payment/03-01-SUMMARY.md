---
phase: 03-cart-checkout-payment
plan: 01
type: auto
subsystem: backend-api
tags: [orders, api, encryption]
key-files:
  - API/Moxic.Api/Controllers/OrdersController.cs
  - API/Moxic.Api/Models/Dtos.cs
metrics:
  files_created: 2
  files_modified: 1
  commits: 1
---

## Tasks

### Task 1: Create OrdersController with POST + GET endpoints
- Created OrdersController.cs with POST /api/orders and GET /api/orders/{orderCode}
- POST encrypts Xbox password via ASP.NET Data Protection (AES-256), creates Order + OrderDetail records
- GET returns order summary with payment config presigned QR URLs
- Extended Dtos.cs with request/response DTOs

### Task 2: PaymentConfig seed migration
- PaymentConfigController already exists with GET /api/payment-config/active
- PaymentConfig entity already configured in DbContext
- Presigned URL generation already implemented in controller

## Deviations
- PaymentConfig seed migration not needed — PaymentConfigController already returns config with presigned URLs via existing getActivePaymentConfig() endpoint

## Self-Check

- [x] POST /api/orders creates order with encrypted password
- [x] GET /api/orders/{orderCode} returns order summary
- [x] Order code format: MOXIC-YYYYMMDD-XXXXX
- [x] Xbox password encrypted with Data Protection (Base64 stored)
- [x] Build: dotnet build succeeded
