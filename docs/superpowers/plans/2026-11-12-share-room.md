# Phòng share mua game — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khách tạo phòng share 2 người cho một game, mỗi người tự trả phần mình qua SePay (mã MXR…), đủ 2 phần thì tạo một đơn cài game như đơn thường; có trang công khai, trang phòng + thảo luận, tab Tài khoản, admin, og:image.

**Architecture:** Một module mới `ShareRoom` (entity + schema bootstrap + `ShareRules` thuần + `ShareRoomService` + `ShareNotifier` + job nền) cắm vào các điểm có sẵn: nhánh `MXR` trong `BankPaymentService`, sở hữu đơn trong `AccountOrdersController`, thông báo trong `OrderStatusService`, điểm trong `PointsService`, coupon trong `CouponService`. Web/admin là trang React mới gọi REST; thảo luận cập nhật bằng polling TanStack Query (như `ChatPanel`, 4s).

**Tech Stack:** .NET 10 Web API, EF Core + Npgsql (EnsureCreated + `*SchemaBootstrap`, không migration), xUnit (project test mới), React 19 + Vite + Tailwind 4 + TanStack Query, React Router v7.

**Spec:** `docs/superpowers/specs/2026-11-12-share-room-design.md` · Mockup: `.superpowers/brainstorm/6592-1794475676/content/share-room.html`

## Global Constraints

- Tối đa **2 người**/phòng. Mã phòng 6 ký tự, mã chuyển khoản `MXR` + 8 ký tự; bảng ký tự dùng `LuckySpinRules.GenerateCode` (đã tránh ký tự dễ nhầm).
- Hạn: người chưa trả bị đưa ra sau **48 giờ** kể từ lúc phòng đủ người; nhắc trước **12 giờ**; phòng đóng sau **7 ngày** kể từ lúc tạo nếu chưa đủ 2 phần.
- Tỷ lệ chủ phòng **10–90%, bước 5%**, mặc định 50; làm tròn từng phần đến **1.000đ**, phần lẻ cho chủ phòng; tổng 2 phần = giá chụp lúc tạo.
- Tối đa **3 phòng đang mở**/người (Open hoặc Full, tạo hoặc tham gia).
- Có người trả → khoá tỷ lệ, kiểu tài khoản, game.
- Chỉ SePay/QR ngân hàng. Hoàn tiền thủ công.
- Không trả mật khẩu Xbox ra API khách (trừ tài khoản Moxic cấp, đơn Completed, cho thành viên phòng). Mật khẩu mã hoá bằng `IDataProtectionProvider`, purpose `"XboxPassword"` (như `OrdersController`).
- Schema: lớp `ShareRoomSchemaBootstrap.EnsureAsync`, SQL có guard `IF NOT EXISTS`, **không dùng ngoặc nhọn trong SQL** (ExecuteSqlRaw). Đăng ký sau `CouponSchemaBootstrap` trong `Program.cs`.
- Server 1GB RAM: một `BackgroundService` chu kỳ 5 phút, không thêm dịch vụ.
- Mọi chuỗi hiển thị cho khách có bản vi + en (`RequestLanguage.T`, `NotificationService.AddLocalizedAsync`, web `t()` + `i18n.en.ts`).
- **Điểm thưởng (chỉnh so với spec §5):** điểm hiện tính theo `Game.RewardPoints`, không theo tiền, nên mỗi thành viên nhận `RewardPoints × tỷ lệ của mình`, nhân hệ số hạng của họ.

## Review Focus

1. **Webhook trùng / chuyển 2 lần / chuyển thiếu rồi bù** — seat chỉ chuyển Paid một lần, cộng dồn Underpaid, đơn chỉ tạo một lần (test ở Task 4).
2. **Hai người bấm "Vào phòng" cùng lúc** — chỉ một người vào được (UPDATE có điều kiện, test ở Task 3).
3. **Tiền về sau khi seat đã bị đưa ra / phòng đã đóng** — ghi `BankTransaction` trạng thái `AlreadyPaid`, báo Telegram, seat đánh dấu cần hoàn tiền; không mở lại phòng (test ở Task 4).
4. **Chủ phòng chưa trả bị đưa ra khi người kia đã trả** — người đã trả thành chủ phòng; kiểu tài khoản chủ phòng thì Xbox của chủ cũ bị xoá (test ở Task 5).
5. **Voucher hết lượt giữa lúc giữ và lúc tạo đơn** — vẫn tôn trọng `DiscountAmount` đã khoá trên seat, log cảnh báo, không chặn đơn (test ở Task 4).

---

## File Structure

**API — mới**
- `API/Moxic.Core/Entities/ShareRoom.cs` — `ShareRoom`, `ShareSeat`, `ShareMessage`.
- `API/Moxic.Infrastructure/Data/ShareRoomSchemaBootstrap.cs` — DDL.
- `API/Moxic.Api/Services/ShareRules.cs` — hàm thuần: chia tiền, parse mã, trạng thái hiển thị, hạn.
- `API/Moxic.Api/Services/ShareRoomService.cs` — tạo/vào/rời/mời ra/đổi tỷ lệ/hủy/giữ voucher/Xbox chủ phòng/thanh toán/tạo đơn.
- `API/Moxic.Api/Services/ShareNotifier.cs` — chuông + email + Telegram cho các sự kiện phòng.
- `API/Moxic.Api/Services/ShareMaintenanceService.cs` — job 48h/12h/7 ngày.
- `API/Moxic.Api/Controllers/ShareRoomsController.cs` — API khách (`/api/share`).
- `API/Moxic.Api/Controllers/AdminShareRoomsController.cs` — API admin (`/api/admin/share`).
- `API/Moxic.Api/Models/ShareDtos.cs` — DTO.
- `API/Moxic.Tests/` — xUnit project (`Moxic.Tests.csproj`, `ShareRulesTests.cs`, `ShareRoomServiceTests.cs`, `TestDb.cs`).

**API — sửa**
- `Game.cs` (+`AllowShare`), `Order.cs` (+`ShareRoomId`, `ProvidedAccountEmail`, `ProvidedAccountPasswordEncrypted`), `MoxicDbContext` (DbSet + cấu hình), `Program.cs` (DI, bootstrap, hosted service), `BankPaymentService.cs` (nhánh MXR), `AccountOrdersController.cs` (OwnedBy + DTO share), `AccountDtos.cs`, `OrderStatusService.cs` (thông báo partner), `PointsService.cs` (chia điểm), `CouponService.cs` (release mọi redemption của đơn), `AdminGamesController` + DTO game (AllowShare), `AdminOrdersController` (đặt tài khoản Moxic cấp), `SeoController.cs` + `SeoContentService.cs` (trang crawler `/share/{code}`), `nginx/spa.conf` (route crawler), `Moxic.slnx`.

**Web — mới**: `src/lib/shareApi.ts`, `src/hooks/useShare.ts`, `src/pages/ShareListPage.tsx`, `src/pages/ShareRoomPage.tsx`, `src/pages/AccountSharesPage.tsx`, `src/components/share/` (`RoomCard.tsx`, `SeatCard.tsx`, `ShareSteps.tsx`, `SharePayPanel.tsx`, `ShareDiscussion.tsx`, `CreateRoomDialog.tsx`, `SplitPicker.tsx`).
**Web — sửa**: `App.tsx` (routes), `AccountLayout.tsx` (mục "Phòng share", icon `Users`), `GameDetailPage.tsx` (nút), `OrderHistoryPage.tsx` + `OrderHistoryDetailPage.tsx` (nhãn Share, phần của bạn, tài khoản Moxic cấp), `lib/accountApi.ts` (type), `lib/i18n.en.ts`.
**Admin — mới**: `src/pages/ShareRooms.tsx`. **Sửa**: `App.tsx` + menu, `GameForm.tsx` (toggle), `OrderDetailModal.tsx` (nhãn + nhập tài khoản cấp), `OrderList.tsx` (nhãn).
**Khác**: `.gitignore` (+`.superpowers/`).

---

### Task 0: Nhánh, test project, gitignore

**Files:** Create `API/Moxic.Tests/Moxic.Tests.csproj`, `API/Moxic.Tests/TestDb.cs`; Modify `API/Moxic.slnx`, `.gitignore`

- [ ] **Step 1:** `git checkout -b feat/share-room`; thêm dòng `.superpowers/` vào `.gitignore`.
- [ ] **Step 2:** Tạo xUnit project net10.0 tham chiếu `Moxic.Api`, `Moxic.Infrastructure`; packages `xunit`, `xunit.runner.visualstudio`, `Microsoft.NET.Test.Sdk`, `Microsoft.EntityFrameworkCore.Sqlite`. Thêm vào `Moxic.slnx`.
- [ ] **Step 3:** `TestDb.Create()` → `MoxicDbContext` trên SQLite in-memory (`DataSource=:memory:`, mở connection, `EnsureCreated`). Nếu mapping Npgsql-specific làm SQLite lỗi, ghi chú và dùng `UseInMemoryDatabase` cho test service (khi đó test đồng thời ở Task 3 chạy với Postgres thật ở Task 13).
- [ ] **Step 4:** Test giả `TestDb_creates_schema` (đếm `Games` = 0) → `dotnet test API/Moxic.Tests` PASS.
- [ ] **Step 5:** Commit `chore: test project for share rooms`.

### Task 1: ShareRules (thuần)

**Files:** Create `API/Moxic.Api/Services/ShareRules.cs`, Test `API/Moxic.Tests/ShareRulesTests.cs`

**Interfaces — Produces:**
- `static (decimal Owner, decimal Partner) ShareRules.Split(decimal total, int ownerPercent)`
- `static bool ShareRules.IsValidPercent(int p)` (10..90, chia hết 5)
- `static string? ShareRules.FindPaymentCode(string? content)` → `"MXR"+8` hoặc null (chuẩn hoá như `SpinCodeShopService.FindOrderCode`)
- `static string ShareRules.DisplayStatus(ShareRoom room, Order? order)` → `"waiting" | "paying" | "full" | "installing" | "done" | "cancelled"` (= chờ người / chờ thanh toán / đã đủ / đang cài / hoàn tất / đã hủy)
- `static DateTime ShareRules.PayDeadline(DateTime fullAt)` = +48h; `ReminderAt` = +36h; `RoomExpiry(createdAt)` = +7d
- consts `MaxOpenRoomsPerUser = 3`, `PayWindow = 48h`, `RoomLifetime = 7d`

- [ ] **Step 1: Test**
```csharp
[Theory]
[InlineData(900000, 50, 450000, 450000)]
[InlineData(900000, 60, 540000, 360000)]
[InlineData(1099000, 50, 550000, 549000)]   // lẻ dồn chủ phòng, partner làm tròn xuống 1.000đ
[InlineData(1100000, 35, 385000, 715000)]
public void Split_rounds_to_thousand_and_sums_to_total(decimal total, int p, decimal o, decimal r)
{ var (a, b) = ShareRules.Split(total, p); Assert.Equal(o, a); Assert.Equal(r, b); Assert.Equal(total, a + b); }
// IsValidPercent: 10,50,90 true; 5,95,52 false
// FindPaymentCode("CK MXR8F3K2Q1X nguyen") == "MXR8F3K2Q1X"; ("mxr-8f3k2q1x") == "MXR8F3K2Q1X"; ("MXS12345678") == null
// DisplayStatus: Open→waiting; Full chưa ai/1 người trả→paying; Funded + order Verifying→full; Installing/Downloading→installing; Completed→done; Cancelled→cancelled
```
- [ ] **Step 2:** `dotnet test --filter ShareRules` → FAIL (chưa có type).
- [ ] **Step 3:** Implement. `Split`: partner = floor(total × (100−p) / 100 / 1000) × 1000; owner = total − partner.
- [ ] **Step 4:** PASS. **Step 5:** Commit `feat(share): split and code rules`.

### Task 2: Entities + schema + game/order fields

**Files:** Create `ShareRoom.cs`, `ShareRoomSchemaBootstrap.cs`; Modify `Game.cs`, `Order.cs`, `MoxicDbContext.cs`, `Program.cs`

**Interfaces — Produces (entities):**
- `ShareRoom { Guid Id; string Code(6, unique); Guid GameId; Guid? EditionId; string GameName; decimal TotalPrice; string AccountType ("Owner"|"Moxic"); int OwnerPercent; bool IsPublic; string Status ("Open"|"Full"|"Funded"|"Cancelled"); string OwnerUserId; bool Locked; Guid? OrderId; string? CancelReason; DateTime CreatedAt, UpdatedAt; DateTime? FullAt, FundedAt, ClosedAt; ICollection<ShareSeat> Seats }`
- `ShareSeat { Guid Id; Guid RoomId; string UserId; string DisplayName; bool IsOwner; int Percent; decimal ShareAmount; decimal DiscountAmount; Guid? CouponId; string? CouponCode; decimal AmountDue /*Share−Discount*/; string? PaymentCode (MXR, unique); decimal PaidAmount; DateTime? PaidAt; string? XboxEmail; string? XboxPasswordEncrypted; string Lang; DateTime JoinedAt; DateTime? LeftAt; string? LeftReason ("left"|"kicked"|"timeout"|"closed"); DateTime? ReminderSentAt; bool NeedsRefund; DateTime? RefundedAt }` — seat “đang ở phòng” = `LeftAt == null`.
- `ShareMessage { Guid Id; Guid RoomId; string? UserId /*null = hệ thống*/; string Text(≤1000); string? TextEn /*chỉ tin hệ thống*/; bool Reported; DateTime CreatedAt }`
- `Game.AllowShare` (bool, default false); `Order.ShareRoomId` (Guid?), `Order.ProvidedAccountEmail` (string?), `Order.ProvidedAccountPasswordEncrypted` (string?).
- Index: `ShareRooms(Status, IsPublic, GameId)`, unique `ShareRooms(Code)`, unique `ShareSeats(PaymentCode)` (partial non-null), `ShareSeats(UserId)`, `ShareMessages(RoomId, CreatedAt)`, `Orders(ShareRoomId)`.

- [ ] **Step 1: Test** `Schema_roundtrip_room_with_two_seats` (TestDb: thêm room + 2 seat + message, đọc lại `Include(Seats)` có 2 seat).
- [ ] **Step 2:** FAIL. **Step 3:** Entities, DbSet `ShareRooms/ShareSeats/ShareMessages`, cấu hình (`ShareRoom.Seats` cascade, `Status`/`AccountType` varchar(20)), bootstrap SQL (bảng + 4 cột ALTER), gọi `await ShareRoomSchemaBootstrap.EnsureAsync(dbContext);` trong `Program.cs`.
- [ ] **Step 4:** PASS; `dotnet build API/Moxic.slnx` không lỗi. **Step 5:** Commit `feat(share): entities and schema`.

### Task 3: ShareRoomService — vòng đời phòng

**Files:** Create `ShareRoomService.cs`, `ShareDtos.cs`; Test `ShareRoomServiceTests.cs`

**Interfaces — Consumes:** `ShareRules`, `CouponService.QuoteAsync(userId, code, lines)`, `CouponService.PriceLinesAsync`. `ShareNotifier` (Task 6) — inject interface `IShareEvents` với các method rỗng trước, Task 6 implement.
**Produces** (tất cả trả `(T? Value, string? Error)`; lỗi là chuỗi đã bản địa hoá):
- `CreateAsync(string userId, CreateShareRoomRequest req)` → `ShareRoom` · `req { Guid GameId; Guid? EditionId; string AccountType; int OwnerPercent; bool IsPublic }`
- `JoinAsync(string code, string userId)` → `ShareRoom`
- `LeaveAsync(string code, string userId)`, `KickAsync(string code, string ownerId)`, `CancelAsync(string code, string ownerId)`
- `SetPercentAsync(string code, string ownerId, int percent)`
- `ApplyCouponAsync(string code, string userId, string? couponCode)` → `ShareSeat` (null code = bỏ voucher)
- `SetOwnerXboxAsync(string code, string userId, string email, string password)`
- `StartPaymentAsync(string code, string userId)` → `ShareSeat` (sinh `PaymentCode` nếu chưa có; phòng chỉ khoá khi có người *trả*, ở Task 4)
- `PostMessageAsync(string code, string userId, string text)`, `AddSystemMessageAsync(Guid roomId, string textVi, string textEn)` (lưu `Text` = vi, `TextEn` = en)

Quy tắc phải có test:
- [ ] **Step 1: Tests**
  - `Create_rejects_game_without_AllowShare`, `Create_rejects_bad_percent` (52 → lỗi, 55 → ok), `Create_snapshots_price_and_creates_owner_seat` (TotalPrice = giá edition, seat owner Percent = OwnerPercent, ShareAmount = Split.Owner).
  - `Create_and_join_respect_max_three_open_rooms` (phòng thứ 4 bị từ chối, phòng Cancelled/Funded không tính).
  - `Join_fills_room_sets_Full_and_FullAt`, `Join_own_room_rejected`, `Join_full_room_rejected`.
  - `Join_concurrent_only_one_wins` — 2 lời gọi `JoinAsync` song song trên 2 DbContext (Postgres thật ở Task 13 nếu SQLite không hỗ trợ; khi đó đánh dấu `[Trait("db","pg")]`). Cài đặt: `UPDATE "ShareRooms" SET "Status"='Full' WHERE "Id"=@id AND "Status"='Open'` qua `ExecuteUpdateAsync`, chỉ thêm seat khi affected == 1.
  - `SetPercent_after_payment_rejected`, `SetPercent_recomputes_both_seats_and_posts_system_message`.
  - `Leave_unpaid_partner_reopens_room`, `Leave_paid_seat_rejected`, `Kick_paid_partner_rejected`.
  - `Cancel_with_any_payment_rejected`, `Cancel_unpaid_room_ok`.
  - `ApplyCoupon_discount_evaluated_on_seat_share` (coupon 10% → DiscountAmount = 10% ShareAmount, AmountDue giảm; partner không đổi). Đánh giá bằng `QuoteAsync(userId, code, [PricedLine(game, edition, price = ShareAmount)])`.
  - `ApplyCoupon_after_paid_rejected`.
  - `StartPayment_requires_Full_room` (Open → lỗi "Phòng chưa đủ người").
  - `StartPayment_owner_account_requires_xbox_on_owner_seat`.
  - `Message_only_by_current_members` (người ngoài / seat đã rời → lỗi).
- [ ] **Step 2:** FAIL. **Step 3:** Implement; mọi thay đổi trạng thái thêm system message (vi + en). Mật khẩu Xbox: `CreateProtector("XboxPassword").Protect`. Giới hạn gửi tin: tối đa 20 tin/phút/người (đếm DB).
- [ ] **Step 4:** PASS. **Step 5:** Commit `feat(share): room lifecycle service`.

### Task 4: Thanh toán MXR + tạo đơn

**Files:** Modify `ShareRoomService.cs`, `BankPaymentService.cs`, `CouponService.cs`; Test `ShareRoomServiceTests.cs`

**Produces:** `Task<bool> ShareRoomService.HandleTransferAsync(BankTransaction tx, string paymentCode)` (cùng hợp đồng với `SpinCodeShopService.HandleTransferAsync`: false = webhook trùng). `Task<Order> CreateOrderAsync(ShareRoom room)` (private).

- [ ] **Step 1: Tests**
  - `Transfer_full_amount_marks_seat_paid_and_locks_room`.
  - `Transfer_underpaid_then_topup_pays_seat` (2 tx cộng dồn theo `tx.OrderCode == PaymentCode && Status == "Underpaid"`).
  - `Duplicate_txn_id_ignored` (cùng ProviderTxnId → false, PaidAmount không đổi).
  - `Second_seat_paid_creates_single_order` — đơn: `ShareRoomId`, `CustomerId = owner`, `TotalAmount = sum AmountDue`, `DiscountAmount = sum DiscountAmount`, `CouponCode` = mã chủ phòng (hoặc partner nếu chủ không có), `Details` 1 dòng (game, giá = TotalPrice), `CustomerXboxEmail/Password` = Xbox seat chủ (Owner) hoặc `""` (Moxic), `CustomerPhone/Zalo` từ `CustomerProfile` chủ phòng, `Lang` = seat chủ, `Status = Pending`; room `Status = Funded`, `FundedAt`, `OrderId`. Sau commit gọi `OrderStatusService.ChangeAsync(order.Id, Verifying, null)` (giống luồng đơn thường) và `TelegramOrderNotifier.NotifyInBackground(…, "🤝 Phòng share MX… đã đủ tiền — cần cài game")`.
  - `Coupons_redeemed_against_order_for_each_member` (2 `CouponRedemption` cùng `OrderId`, mỗi cái `UserId` riêng); `Coupon_exhausted_at_order_time_still_honours_seat_discount` (Review Focus 5).
  - `Transfer_to_left_seat_or_cancelled_room_marks_AlreadyPaid_and_NeedsRefund` (Review Focus 3).
  - `Transfer_unknown_code_Unmatched`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. Trong `BankPaymentService.HandleIncomingAsync`, ngay sau nhánh MXS: `var shareCode = ShareRules.FindPaymentCode(content); if (shareCode != null) return await scope…GetRequiredService<ShareRoomService>().HandleTransferAsync(tx, shareCode);`. Đổi `CouponService.ReleaseForOrderAsync` để release **mọi** redemption chưa release của đơn (vòng lặp), trả true nếu ≥1. Seat trả xong → `room.Locked = true` + system message + `IShareEvents.SeatPaid`.
- [ ] **Step 4:** PASS. **Step 5:** Commit `feat(share): MXR transfers settle seats and create the order`.

### Task 5: Job hết hạn

**Files:** Create `ShareMaintenanceService.cs`; Modify `ShareRoomService.cs` (+`RunMaintenanceAsync(DateTime now)`), `Program.cs`

**Produces:** `Task<int> ShareRoomService.RunMaintenanceAsync(DateTime now)` — trả số phòng bị tác động; hosted service gọi mỗi 5 phút trong scope mới.

- [ ] **Step 1: Tests** (truyền `now` giả)
  - `Unpaid_partner_after_48h_removed_room_reopens` (LeftReason "timeout", room Open, FullAt null, seat chủ đã trả giữ nguyên).
  - `Unpaid_owner_after_48h_removed_paid_partner_becomes_owner` — seat còn lại `IsOwner = true`, `room.OwnerUserId` đổi; AccountType Owner → xoá Xbox của seat cũ (seat cũ LeftAt), room `Locked` vẫn true (Review Focus 4).
  - `Both_unpaid_after_48h_partner_removed_only` (chủ không bị đưa ra khi chưa ai trả; phòng mở lại).
  - `Reminder_sent_once_at_36h` (`ReminderSentAt` set; chạy lại không gửi lần 2).
  - `Room_older_than_7_days_not_funded_cancelled_paid_seats_NeedsRefund` (LeftReason "closed", Status Cancelled, CancelReason "expired").
  - `Funded_room_untouched_by_maintenance`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement (mỗi phòng một transaction, UPDATE có điều kiện trạng thái để không đụng webhook đang chạy). Đăng ký `AddScoped<ShareRoomService>()`, `AddHostedService<ShareMaintenanceService>()`.
- [ ] **Step 4:** PASS. **Step 5:** Commit `feat(share): 48h / 7-day expiry job`.

### Task 6: ShareNotifier

**Files:** Create `ShareNotifier.cs` (implements `IShareEvents`); Modify `Program.cs`

**Produces:** `IShareEvents { Task MemberJoined(ShareRoom r, ShareSeat s); Task RoomFull(ShareRoom r); Task SeatPaid(ShareRoom r, ShareSeat s); Task PayReminder(ShareRoom r, ShareSeat s); Task SeatRemoved(ShareRoom r, ShareSeat s, string reason); Task RoomCancelled(ShareRoom r); Task Refunded(ShareRoom r, ShareSeat s); Task MessageReported(ShareRoom r, ShareMessage m); }`

Kênh theo spec §9: chuông (`AddLocalizedAsync(userId, "share", …, link "/share/{code}")`) + email (`IBackgroundEmailQueue` + `IEmailService.SendNoticeAsync`, ngôn ngữ = `seat.Lang`) cho khách; Telegram (`TelegramOrderNotifier.TextInBackground`) cho admin: cần hoàn tiền (RoomCancelled có seat NeedsRefund, SeatRemoved của seat đã trả không xảy ra), tin bị báo cáo. "Đủ tiền" đã gửi ở Task 4.

- [ ] **Step 1: Test** `RoomFull_notifies_both_members` và `SeatPaid_notifies_only_the_other_member` (đếm `Notifications` rows trong TestDb; email queue giả ghi nhận số lần `Enqueue`).
- [ ] **Step 2:** FAIL. **Step 3:** Implement; mọi lỗi gửi chỉ log warning. **Step 4:** PASS. **Step 5:** Commit `feat(share): notifications`.

### Task 7: Tích hợp đơn hàng, điểm, tài khoản Moxic cấp

**Files:** Modify `AccountOrdersController.cs`, `AccountDtos.cs`, `OrderStatusService.cs`, `PointsService.cs`, `AdminOrdersController.cs`

- [ ] **Step 1: Tests**
  - `Partner_sees_share_order_in_history` (OwnedBy mở rộng: `o.CustomerId == uid || email match || (o.ShareRoomId != null && db.ShareSeats.Any(s => s.RoomId == o.ShareRoomId && s.UserId == uid && s.PaidAt != null))`).
  - DTO đơn có `Share { RoomCode, YourAmount, TotalAmount, PartnerName }` khi `ShareRoomId != null`; `ProvidedAccount { Email, Password }` chỉ khi đơn Completed + AccountType Moxic + người xem là thành viên đã trả (giải mã purpose `"XboxPassword"`).
  - `Status_change_notifies_partner_too` (OrderStatusService: với đơn share, chuông + email cho seat partner; email partner gửi tới email tài khoản Moxic của họ, không phải `CustomerXboxEmail`).
  - `Points_split_by_percent_per_member` (RewardPoints 100, 60/40 → chủ 60×tier, partner 40×tier; idempotent qua `PointsAwardedAt`).
- [ ] **Step 2:** FAIL. **Step 3:** Implement. Admin: `PUT /api/admin/orders/{id}/provided-account { email, password }` (chỉ đơn share AccountType Moxic; mã hoá). Đơn share AccountType Moxic không chặn Installing vì thiếu Xbox khách.
- [ ] **Step 4:** PASS. **Step 5:** Commit `feat(share): share orders visible to both members`.

### Task 8: API khách

**Files:** Create `ShareRoomsController.cs`; Modify `ShareDtos.cs`

Routes (`[Route("api/share")]`, đọc công khai, ghi cần `CustomerAuthRules` như `AccountOrdersController`):
- `GET /api/share?gameId=&accountType=&split=&sort=new|ending&page=` → phòng `IsPublic && Status == Open`, thẻ: code, game (tên, cover presigned như `ResolveCoversAsync`), AccountType, OwnerPercent, open percent + số tiền phần trống, ExpiresAt, owner {name, shareCount}.
- `GET /api/share/{code}` → khách lạ: bản rút gọn; thành viên: đầy đủ (seats: tên, %, ShareAmount, Discount, AmountDue, PaidAt, deadline, shareCount, isMe; `MyPayment { PaymentCode, AmountDue, qr info }` từ `PaymentConfig` như luồng SePay hiện có; DisplayStatus; order code nếu Funded). Không bao giờ trả email/phone/Xbox người kia.
- `POST /api/share` (create) · `POST {code}/join` · `POST {code}/leave` · `POST {code}/kick` · `POST {code}/cancel` · `PUT {code}/percent {percent}` · `PUT {code}/coupon {code}` · `PUT {code}/xbox {email,password}` · `POST {code}/pay` · `GET {code}/messages?after=` · `POST {code}/messages {text}` · `POST {code}/messages/{id}/report`.
- `GET /api/account/share` → phòng của tôi (đang và đã tham gia, gồm cả seat đã rời), DisplayStatus, ai đã trả.
- `shareCount` = số seat `PaidAt != null` của user trong phòng Funded có đơn Completed.

- [ ] **Step 1: Test** `Get_room_as_stranger_hides_seat_private_fields` (gọi service projection `GetRoomViewAsync(code, viewerId?)`; partner seat không có Xbox, có `IsMe=false`).
- [ ] **Step 2–4:** FAIL → implement → PASS; chạy API local (`dotnet run --project API/Moxic.Api`) và `curl /api/share` trả `200 []`.
- [ ] **Step 5:** Commit `feat(share): customer API`.

### Task 9: API admin + og/crawler

**Files:** Create `AdminShareRoomsController.cs`; Modify admin game DTO/controller (`AllowShare` đọc/ghi), `SeoController.cs`, `SeoContentService.cs`, `nginx/spa.conf`

- Admin: `GET /api/admin/share?status=&needsRefund=` · `GET /api/admin/share/{code}` (gồm messages, giao dịch MXR theo `BankTransactions.OrderCode == PaymentCode`) · `POST {code}/close {reason}` (đóng phòng; seat đã trả → NeedsRefund; gọi `IShareEvents.RoomCancelled`) · `POST /api/admin/share/seats/{id}/refunded` (RefundedAt, `IShareEvents.Refunded`).
- Gán tay giao dịch: `BankPaymentService.AssignAsync` chấp nhận `orderCode` bắt đầu bằng `MXR` → chuyển sang `ShareRoomService` (cùng logic HandleTransfer, bỏ kiểm tra trùng).
- SEO: `GET /api/seo/share/{code}?lang=` → HTML có `og:title` "Share {Game} · thiếu 1 người · phần {x}đ · mã {code}", `og:image` = `/api/seo/games/{gameId}/image`, `og:url`; phòng không tồn tại/riêng tư vẫn trả trang chung không lộ thông tin. nginx: `location ~ ^/(en/)?share/[A-Z0-9]{6}/?$` → crawler rewrite `/api/seo/share/$code` theo mẫu `@crawler_game`.
- [ ] **Step 1: Test** `Admin_close_marks_paid_seats_for_refund`, `Seo_share_page_contains_og_tags`.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat(share): admin API and Facebook preview`.

### Task 10: Web — API client, trang công khai, trang phòng

**Files:** Create `lib/shareApi.ts`, `hooks/useShare.ts`, `pages/ShareListPage.tsx`, `pages/ShareRoomPage.tsx`, `components/share/*`; Modify `App.tsx`, `lib/i18n.en.ts`

- Bố cục, màu, chữ **đúng mockup đã duyệt**; dùng token Tailwind sẵn có (`bg-bg-surface`, `text-accent`, `text-positive`, `text-caution`, `font-display`…), không mã màu cứng; hỗ trợ light mode qua token.
- Routes: `/share`, `/share/:code` (công khai), cùng bản `/en/...` theo cách các route khác đang làm.
- `useShareRoom(code)` polling 5s khi phòng chưa Funded/Cancelled; 30s sau đó. `useShareMessages(code)` polling 4s khi trang mở (như `ChatPanel`).
- Đếm ngược bằng `hooks/useCountdown.ts` có sẵn.
- Nút "Thanh toán phần của tôi" disabled khi chưa đủ người, kèm dòng giải thích; QR + mã MXR có nút sao chép; Owner-account: form Xbox trước khi hiện QR.
- "Đăng Facebook": `https://www.facebook.com/sharer/sharer.php?u=<link phòng>`; "Sao chép link": `navigator.clipboard` + toast.
- Chưa đăng nhập bấm "Vào phòng" → `/login?next=/share/{code}` (theo cơ chế `RequireCustomer` hiện có).
- `CreateRoomDialog`: chọn game (search game có `allowShare`), edition, kiểu tài khoản, `SplitPicker` (slider 10–90 bước 5 + nút 50/50, 60/40, 70/30, hiện số tiền mỗi phần), công khai/riêng tư.
- [ ] **Step 1:** Implement. **Step 2:** `npm run build` và `npm run lint` trong `Moxic.Web` không lỗi. **Step 3:** Chạy `npm run dev` + API local, đi hết luồng tạo → vào phòng bằng tài khoản thứ 2 → thảo luận; chụp màn hình so với mockup. **Step 4:** Commit `feat(web): share list and room pages`.

### Task 11: Web — tab Tài khoản, đơn hàng, trang game

**Files:** Create `pages/AccountSharesPage.tsx`; Modify `AccountLayout.tsx`, `App.tsx`, `GameDetailPage.tsx`, `OrderHistoryPage.tsx`, `OrderHistoryDetailPage.tsx`, `lib/accountApi.ts`, `lib/i18n.en.ts`

- Mục "Phòng share" (`/account/share`, icon `Users`) sau "Đơn hàng"; danh sách theo mockup (ảnh, tên game, badge trạng thái 6 loại, 2 avatar với dấu ✓ đã trả, nút "Vào phòng"/"Thảo luận").
- Đơn hàng: badge "Share" + "Phần của bạn: X / tổng Y"; chi tiết đơn có khối "Tài khoản Moxic cấp" (email + mật khẩu ẩn/hiện + sao chép) khi API trả `providedAccount`.
- Trang game: nút "Tìm người share game này" khi `game.allowShare` → `/share?game={id}`; trong trang đó có CTA "Tạo phòng cho game này" mở dialog đã chọn sẵn game.
- [ ] **Step 1:** Implement. **Step 2:** build + lint sạch. **Step 3:** Kiểm tra trên trình duyệt với đơn share đã tạo ở Task 13 (hoặc dữ liệu seed tay). **Step 4:** Commit `feat(web): share rooms in account and game page`.

### Task 12: Admin web

**Files:** Create `Moxic.Admin/src/pages/ShareRooms.tsx`; Modify `App.tsx` (route `/share-rooms` + mục menu), `GameForm.tsx`, `OrderList.tsx`, `OrderDetailModal.tsx`

- Danh sách lọc trạng thái + "Cần hoàn tiền"; chi tiết: thành viên, phần tiền, giao dịch, tin nhắn (đánh dấu bị báo cáo), nút "Đóng phòng", "Đã hoàn tiền" từng seat.
- GameForm: toggle "Cho phép share".
- Đơn: badge "Share · MX…"; OrderDetailModal với đơn AccountType Moxic có form nhập tài khoản cấp (gọi `PUT /api/admin/orders/{id}/provided-account`).
- [ ] **Step 1:** Implement. **Step 2:** `npm run build` trong `Moxic.Admin` sạch. **Step 3:** Commit `feat(admin): share rooms`.

### Task 13: Kiểm tra đầu-cuối trên Postgres thật

- [ ] **Step 1:** `docker compose up -d` (postgres + minio local), chạy API + web + admin local.
- [ ] **Step 2:** Bật AllowShare cho 1 game; tài khoản A tạo phòng 60/40 kiểu Owner; tài khoản B vào bằng mã; kiểm tra email/chuông "đủ người".
- [ ] **Step 3:** Giả lập SePay: `curl -X POST localhost:<port>/api/payments/sepay -H "Authorization: Apikey $SEPAY_KEY" -d '{"id":1,"transferAmount":<A due>,"content":"<MXR của A>",...}'` (payload theo `PaymentsController`); kiểm tra seat A Paid, phòng khoá; gửi lại cùng id → không đổi; trả thiếu rồi bù cho B → đơn được tạo đúng một lần, ở trạng thái Verifying, hiện ở "Đơn hàng" của cả A và B.
- [ ] **Step 4:** Chạy test `[Trait("db","pg")]` (join đồng thời) trên Postgres local.
- [ ] **Step 5:** Kiểm tra og: `curl -A facebookexternalhit http://localhost/share/<code>` qua nginx container → có `og:title`.
- [ ] **Step 6:** `dotnet test` toàn bộ PASS, web/admin build sạch. Commit nếu có sửa.

### Task 14: Build, push Docker Hub, deploy

- [ ] **Step 1:** `bash scripts/build-and-push.sh trungdocker123` (đã `docker login`) → 3 image `:latest` push thành công.
- [ ] **Step 2:** Hỏi xác nhận trước khi đụng server `45.117.178.20`. SSH vào, xem `/opt/moxic` (compose, `.env`) đang chạy gì; **backup DB** (`docker compose exec postgres pg_dump … > /opt/moxic/backup-YYYYMMDD.sql`) trước khi đổi schema.
- [ ] **Step 3:** Copy `docker-compose.prod.yml` / `nginx/*.conf` nếu thay đổi (spa.conf có route crawler mới), `docker compose pull && docker compose up -d`, `docker image prune -f`.
- [ ] **Step 4:** Kiểm tra: log API thấy bootstrap chạy không lỗi, `curl https://<domain>/api/share` 200, trang `/share` mở được, RAM container API ổn (`docker stats --no-stream`).
- [ ] **Step 5:** Báo kết quả; nhắc đổi mật khẩu root + Docker Hub.
