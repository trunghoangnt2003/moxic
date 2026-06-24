---
plan_index: 02
phase: "05-notifications-and-polish"
status: completed
date: "2026-06-24"
objective: "Edge Cases & Background Jobs"
tasks_completed:
  - Added ActionRequired to OrderStatus enum (MoxicEnums.cs)
  - Updated status transition rules in AdminOrdersController for Verifying→ActionRequired, ActionRequired→Verifying, ActionRequired→Cancelled, Installing→Verifying (rollback)
  - Created PaymentTimeoutService (BackgroundService) in Moxic.Api/Services
  - Registered PaymentTimeoutService in Program.cs
key_files:
  created:
    - API/Moxic.Api/Services/PaymentTimeoutService.cs
  modified:
    - API/Moxic.Shared/Enums/MoxicEnums.cs
    - API/Moxic.Api/Controllers/AdminOrdersController.cs
    - API/Moxic.Infrastructure/Moxic.Infrastructure.csproj
commits:
  - feat(05-02): payment timeout bg service, ActionRequired status, install rollback
---

Plan 02 completed. All edge cases covered.
