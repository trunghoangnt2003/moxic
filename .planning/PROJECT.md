# Moxic GameStore

## What This Is

Moxic GameStore là nền tảng thương mại điện tử bán key game Xbox (dạng digital code/service) tại thị trường Việt Nam. Khách hàng có thể duyệt, mua và đặt trước (pre-order) game Xbox với giá rẻ hơn Store chính hãng từ 30%. Sau khi thanh toán trực tiếp qua QR Bank hoặc Crypto, khách cung cấp thông tin tài khoản Xbox và người bán (sole merchant) sẽ tiến hành cài đặt game thủ công. Giao diện dark mode theo phong cách Epic Games Store.

## Core Value

Khách hàng mua được game Xbox chính hãng giá rẻ hơn 30% so với Store với quy trình đặt niềm tin thông qua cài đặt thủ công uy tín.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] **Game CRUD**: Admin tạo/sửa/xóa game với tên, mô tả, giá gốc, giá bán, thể loại, trạng thái (Sẵn có/Đặt trước)
- [ ] **Image Upload (MinIO)**: Upload ảnh bìa game lên MinIO, hiển thị qua Presigned URL
- [ ] **QR Payment Config**: Admin upload ảnh QR Bank (VietQR) và QR Crypto (USDT/BTC)
- [ ] **Game Browsing (Anonymous + Registered)**: Khách xem danh sách game, carousel game hot, grid card
- [ ] **Game Detail Page**: Hiển thị mô tả, cấu hình, hướng dẫn mua hàng 3 bước bằng hình ảnh
- [ ] **Cart & Checkout**: Thêm game vào giỏ, checkout form thu thập: SĐT, Gmail Xbox, Password Xbox
- [ ] **Payment Display**: Hiển thị ảnh QR kèm nội dung chuyển khoản định sẵn (mã đơn hàng)
- [ ] **Pre-order Mechanism**: Game chưa phát hành hiển thị nút "Đặt trước", ghi chú ngày phát hành
- [ ] **Order Lifecycle**: Pending → Đã nhận tiền → Đang cài đặt → Hoàn thành
- [ ] **Admin Order Dashboard**: Danh sách đơn hàng theo thời gian, thao tác chuyển trạng thái
- [ ] **Email Notification**: Gửi mail thông báo khi đơn hàng đổi trạng thái
- [ ] **Dark Mode UI**: Toàn bộ giao diện tone đen/xám gaming, Epic Games Store style

### Out of Scope

- Hàng hóa vật lý / merchandise — Không kinh doanh
- Nhiều người bán / Publisher dashboard — Sole merchant model
- Tích hợp cổng thanh toán (Stripe/PayPal/VNPay) — Static QR payment
- Tự động giao game (Auto-delivery) — Fulfillment thủ công qua Zalo/FB
- Cơ chế đặt trước trả sau (Unpaid preorder) — Pay now only

## Context

- Thị trường: Người chơi game Xbox tại Việt Nam muốn mua game giá rẻ
- Quy trình hiện tại đang làm thủ công qua Zalo/Facebook, cần web để tự động hóa quy trình đặt hàng
- Merchant tự đăng nhập vào tài khoản Xbox của khách để install game (cần UX rõ ràng để tạo trust)

## Constraints

- **Stack**: .NET 10 (Web API + EF Core) cho backend, React cho frontend, PostgreSQL làm database, MinIO làm object storage
- **Thanh toán**: Chỉ dùng ảnh QR tĩnh, hiển thị nội dung chuyển khoản theo mã đơn hàng để đối soát thủ công
- **Fulfillment**: Hoàn toàn thủ công (admin login Xbox account khách → cài game → xác nhận)
- **Bảo mật**: Hệ thống lưu trữ Password tài khoản Xbox của khách — cần mã hóa và xử lý cẩn trọng

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| .NET 10 + EF Core Code First | Backend-first Phase 1, tận dụng Code First để thiết kế DB | — Pending |
| Static QR (không gateway) | Đơn giản, không mất phí gateway, phù hợp mô hình hiện tại | — Pending |
| Manual fulfillment | Quy trình cài đặt thủ công là đặc trưng business model | — Pending |
| MinIO cho ảnh | Presigned URL, chi phí thấp, tương thích S3 API | — Pending |
| Dark Mode Epic-style | Tập trung vào visual game, gaming audience | — Pending |

---
*Last updated: 2026-06-23 after initial project definition*
