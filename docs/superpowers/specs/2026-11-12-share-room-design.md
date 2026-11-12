# Phòng share mua game — thiết kế

Ngày: 2026-11-12 · Trạng thái: chờ duyệt · Mockup đã duyệt: `.superpowers/brainstorm/6592-1794475676/content/share-room.html`

## 1. Ý định

Một bản quyền game Xbox chơi được trên 2 người (một người đặt máy làm Home Xbox, người kia đăng nhập tài khoản). Khách hiện phải tự tìm bạn share trên Facebook, tự góp tiền với nhau, rồi một người đứng ra đặt đơn. Tính năng này cho Moxic làm **chỗ để người ta tìm nhau share**: tạo phòng, đăng link lên Facebook hoặc đưa mã phòng, mỗi người tự trả phần của mình qua SePay. Moxic chỉ mua và cài game khi cả hai đã trả đủ.

Moxic **không phân xử** ai giữ suất Home Xbox hay ai chơi bằng đăng nhập. Hai người tự thoả thuận trong khu thảo luận của phòng.

**Thành công nghĩa là:** một người lạ thấy link trên Facebook, vào phòng, thoả thuận và trả tiền mà không cần nhắn admin. Sau đó cả hai cùng theo dõi một đơn đến lúc cài xong.

## 2. Mục tiêu / Không làm / Tuyệt đối tránh

**Mục tiêu**
- Tạo phòng share cho một game, tối đa **2 người** (chủ phòng + 1 người share).
- Hai kiểu tài khoản: **tài khoản Xbox của chủ phòng**, hoặc **tài khoản do Moxic cấp**.
- Chủ phòng chọn tỷ lệ chia tiền.
- Vào phòng bằng link (đăng Facebook), bằng mã phòng, từ trang công khai "Tìm người share", hoặc từ nút trên trang chi tiết game.
- Mỗi người tự thanh toán phần của mình, vào lúc khác nhau. Room hiện công khai ai đã trả.
- Theo dõi trong tab Tài khoản và trong "Đơn hàng".
- Giao diện đẹp, hiện đại, đúng phong cách Moxic hiện tại (theo mockup đã duyệt).

**Không làm (lần này)**
- Phòng nhiều hơn 2 người.
- Thanh toán bằng crypto cho phần share: chỉ dùng SePay/QR ngân hàng, vì cần webhook để tự khớp từng phần.
- Hoàn tiền tự động. Hoàn tiền làm thủ công, admin bấm xác nhận.
- Mục "Lịch sử giao dịch" chung (gom đơn thường, phần share, lượt quay, hoàn tiền). Đã đề xuất và **để làm sau**.

**Tuyệt đối tránh**
- Tạo đơn hoặc báo admin cài game khi chưa đủ 2 phần tiền.
- Người này thấy mật khẩu Xbox, số điện thoại hay email của người kia. Trong phòng chỉ hiện tên hiển thị.
- Tiền về mà không gán được cho đúng người, đúng phòng.
- Người đã trả bị mất chỗ hoặc mất tiền vì người kia bỏ ngang.

## 3. Luồng chính

1. **Tạo phòng** (phải đăng nhập, email đã xác minh). Chọn game (và edition nếu có), chỉ game được admin bật "Cho phép share". Chọn kiểu tài khoản, tỷ lệ chia (xem §5), công khai hay riêng tư. Hệ thống sinh **mã phòng** 6 ký tự (ví dụ `MX7K2Q`) và link `/share/{mã}`.
2. **Chờ người**: phòng hiện trên trang `/share` (nếu công khai) và trên trang game. Người xem đã đăng nhập bấm "Vào phòng" để chiếm chỗ thứ 2. Chưa đăng nhập thì được chuyển sang đăng nhập rồi quay lại phòng.
3. **Đủ người**: cả hai nhận email và thông báo chuông. Nút **"Thanh toán phần của tôi"** chỉ bật từ lúc này.
4. **Thanh toán**: mỗi người có **mã chuyển khoản riêng** dạng `MXR` + 8 ký tự. Người đó có thể áp voucher của mình trước khi trả. Webhook SePay khớp tiền vào đúng chỗ của người đó. Phòng hiện "Đã thanh toán · giờ" hoặc "Chưa thanh toán · còn hh:mm:ss".
   - Kể từ khi có người đầu tiên trả, **tỷ lệ, kiểu tài khoản và game bị khoá**.
   - Kiểu "tài khoản chủ phòng": chủ phòng nhập email và mật khẩu Xbox ở bước thanh toán của mình. Mật khẩu được mã hoá như đơn thường và chỉ admin xem được.
5. **Đủ 2 phần**: hệ thống tạo **một đơn** (`Order`) gắn với phòng, trạng thái như một đơn đã thanh toán, rồi báo admin qua Telegram. Từ đây là quy trình cài đặt thủ công như hiện nay. Cả hai cùng thấy một tiến trình cài đặt (tái dùng live order tracker).
6. **Hoàn tất**: đơn Completed. Phòng chuyển "Hoàn tất", và cả hai được +1 lượt "share thành công".

## 4. Hết hạn, rời phòng, hoàn tiền (đã chốt)

- Người **chưa trả** có thể tự rời phòng bất cứ lúc nào. Chủ phòng có thể **mời người chưa trả ra**. Người đã trả thì không bị mời ra.
- Kể từ lúc phòng đủ người, nếu một người chưa trả sau **48 giờ** thì người đó bị đưa ra khỏi phòng. Phòng mở lại để tìm người mới, còn người đã trả **giữ chỗ**. Trước hạn **12 giờ**, người chưa trả nhận thông báo nhắc.
  - Trường hợp chủ phòng là người chưa trả mà bị đưa ra: *(quyết định của mình)* người đã trả trở thành chủ phòng. Riêng phòng kiểu "tài khoản chủ phòng", người đó phải nhập tài khoản Xbox của mình khi phòng đủ người lại.
- Nếu **7 ngày** kể từ lúc tạo phòng vẫn chưa đủ 2 phần thì phòng **đóng (Đã hủy)**. Ai đã trả sẽ vào **hàng chờ hoàn tiền**: admin chuyển khoản tay rồi bấm "Đã hoàn tiền", khách nhận thông báo.
- Người đã trả mà muốn rút trước hạn: *(quyết định của mình)* không có nút tự rút. Khách nhắn hỗ trợ, admin có thể đóng phòng thủ công để hoàn tiền.
- Phòng chưa ai trả mà chủ phòng muốn hủy: hủy ngay, không cần admin.

## 5. Tiền

- **Tổng tiền = giá game trên Moxic** (giá của edition đã chọn), *(quyết định của mình)* chụp lại lúc tạo phòng. Nếu giá game đổi về sau, phòng vẫn giữ giá cũ.
- **Tỷ lệ**: chủ phòng chọn phần của mình, *(quyết định của mình)* từ 10% đến 90%, bước 5%, mặc định 50/50. Có các nút nhanh 50/50, 60/40, 70/30. Số tiền mỗi phần làm tròn đến 1.000đ, phần lẻ dồn cho chủ phòng, để tổng hai phần luôn đúng bằng tổng tiền.
- Trước khi có ai trả, chủ phòng **đổi được tỷ lệ**. Nếu người share đã vào phòng, hệ thống ghi một dòng vào khu thảo luận ("Minh đổi tỷ lệ thành 60/40").
- **Voucher áp riêng cho từng người** và chỉ giảm phần của người đó. Điều kiện voucher (game áp dụng, giá trị tối thiểu, phần trăm…) *(quyết định của mình)* được xét như một đơn một dòng: game đó, giá bằng phần của người đó. Voucher được giữ khi người đó tạo mã thanh toán, ghi nhận khi tiền về, và trả lại cho khách nếu phòng hủy hoặc hoàn tiền (theo cách `CouponService` đang giữ và trả voucher cho đơn).
- **Khớp tiền SePay**: nội dung chứa `MXR…`. Nhánh này đặt cạnh nhánh `MXS…` trong `BankPaymentService.HandleIncomingAsync`, trước nhánh đơn thường. Trả thiếu thì báo admin như hiện nay ("Underpaid"), cộng dồn các lần chuyển. Trả thừa vẫn tính là đã trả. Tiền về cho phòng đã đóng, hoặc chỗ đã bị huỷ, thì báo Telegram để admin xử lý tay.
- **Điểm thưởng**: *(quyết định của mình)* điểm của game (`Game.RewardPoints`) chia theo tỷ lệ của từng người, nhân hệ số hạng thành viên của người đó, cộng khi đơn Completed.

## 6. Hai kiểu tài khoản

- **Tài khoản của chủ phòng**: đơn dùng email và mật khẩu Xbox của chủ phòng. Người share chơi trên tài khoản đó theo thoả thuận của hai người.
- **Tài khoản Moxic cấp**: *(quyết định của mình, chờ bạn xác nhận)* đơn không có tài khoản khách. Khi xử lý đơn, admin tạo hoặc chọn một tài khoản Xbox của shop, mua game trên đó, rồi nhập email và mật khẩu (mã hoá) vào đơn. Sau khi đơn Completed, **cả hai thành viên** xem được thông tin đăng nhập trong chi tiết đơn của mình. Tài khoản này do shop sở hữu, nhưng mỗi phòng một tài khoản riêng, không dùng chung kho tài khoản cho thuê.

## 7. Màn hình (theo mockup đã duyệt)

- **`/share`: trang công khai "Tìm người share"**: ô nhập mã phòng, nút "Tạo phòng share", bộ lọc (đang thiếu người, kiểu tài khoản, tỷ lệ, sắp xếp), lưới thẻ phòng (ảnh game, tỷ lệ, kiểu tài khoản, thời gian còn lại, số tiền phần còn trống, nút "Vào phòng"). Chỉ hiện phòng công khai đang chờ người.
- **`/share/{mã}`: trang phòng**: hero (ảnh game, tên, mã phòng, sao chép link, đăng Facebook), thanh tiến trình 5 bước, hai ô thành viên (tỷ lệ, phần tiền, voucher, trạng thái/đếm ngược), ô "Phần thanh toán của bạn" (QR, mã MXR, áp voucher), khu thảo luận. Người ngoài phòng xem được bản rút gọn kèm nút "Vào phòng", nhưng không thấy khu thảo luận.
- **Trang chi tiết game**: nút "Tìm người share game này" (chỉ khi game cho phép share), mở `/share?game=…` hoặc tạo phòng với game đã chọn sẵn.
- **Tài khoản → "Phòng share"** (mục mới trong `AccountLayout`): danh sách phòng đang và đã tham gia. Trạng thái: **chờ người / chờ thanh toán / đã đủ / đang cài / hoàn tất / đã hủy**. Mỗi dòng hiện ai đã trả, kèm nút vào phòng và vào thảo luận.
- **Tài khoản → "Đơn hàng"**: đơn share hiện ở **cả hai tài khoản**, có nhãn **"Share"** và dòng "Phần của bạn: 450.000đ / tổng 900.000đ". Hai người cùng xem một tiến trình cài.
- **Ảnh xem trước khi đăng Facebook**: link phòng có og:image và tiêu đề riêng (ảnh game, "Thiếu 1 người · phần 450.000đ · mã MX7K2Q"), tái dùng cơ chế og:image hiện có (`SeoController`/`SeoContentService`).
- Song ngữ vi/en như phần còn lại của site.

## 8. Khu thảo luận

- Chỉ 2 thành viên đang ở phòng xem và gửi được. Người bị đưa ra thì mất quyền xem.
- Có dòng hệ thống tự động: tạo phòng, có người vào hoặc rời, đổi tỷ lệ, thanh toán, đủ tiền, đang cài, hoàn tất.
- Có nút **báo cáo tin nhắn**, gửi cảnh báo Telegram cho admin. Giới hạn tốc độ gửi để chống spam.
- Cập nhật gần thời gian thực bằng cùng cơ chế mà chat hỗ trợ (`ChatService`) đang dùng. Đây là tính năng riêng, không trộn vào luồng chat hỗ trợ khách ↔ shop.

## 9. Thông báo

Gửi qua email và chuông (có push nếu đã bật), theo ngôn ngữ của từng khách:
- Có người vào phòng (gửi chủ phòng) và phòng đủ người (gửi cả hai, kèm nút thanh toán).
- Người kia đã thanh toán.
- Còn 12 giờ trước hạn 48 giờ (gửi người chưa trả).
- Bị đưa ra khỏi phòng, phòng mở lại, phòng đóng hoặc hủy, đã hoàn tiền.
- Các mốc của đơn (đang cài, hoàn tất) gửi **cho cả hai**, không chỉ người đứng tên đơn.

Telegram cho admin: phòng đã trả đủ (cần cài), cần hoàn tiền, tiền về không khớp hoặc trả thiếu, tin nhắn bị báo cáo.

## 10. Admin

- Mỗi game có công tắc **"Cho phép share"** (mặc định tắt).
- Trang **"Phòng share"**: danh sách và lọc theo trạng thái. Chi tiết phòng hiện thành viên, các phần đã trả, giao dịch SePay, lịch sử thảo luận (khi có báo cáo) và đơn đã tạo. Admin có các thao tác đóng phòng và đánh dấu đã hoàn tiền từng phần.
- **Hàng chờ hoàn tiền** (hoặc bộ lọc "cần hoàn tiền") hiện số tiền và người nhận. Thông tin ngân hàng của khách lấy qua chat hỗ trợ, vì hiện chưa lưu.
- Đơn share trong danh sách đơn có nhãn "Share" và link về phòng. Với kiểu "tài khoản Moxic cấp", đơn có ô nhập thông tin tài khoản Xbox đã cấp.
- Giao dịch MXR không khớp thì gán tay được như giao dịch thường.

## 11. Chống lạm dụng

- Mỗi người tối đa **3 phòng đang mở** (đang chờ người hoặc chờ thanh toán), tính cả phòng mình tạo và phòng mình vào.
- Không vào được phòng của chính mình. Không vào được phòng đã đủ người hoặc đã đóng.
- Hai người cùng bấm vào chỗ trống một lúc: chỉ một người được, nên cần khoá hoặc kiểm tra đồng thời ở DB.
- Bên cạnh tên trong phòng và trên thẻ phòng hiện số lần "share thành công" của mỗi người để tăng uy tín.

## 12. Ràng buộc kỹ thuật

- Stack hiện có: .NET 10 Web API + EF Core + PostgreSQL, React 19 + Vite + Tailwind 4 + TanStack Query, admin là app React riêng (`Moxic.Admin`).
- **Schema:** dự án không dùng migration. Bảng mới phải được tạo bằng một lớp `*SchemaBootstrap.EnsureAsync` (SQL `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE … ADD COLUMN IF NOT EXISTS`), đăng ký trong `Program.cs` như các bootstrap khác.
- **Server production chỉ có 1GB RAM**: không thêm dịch vụ nền nặng. Các việc hết hạn 48 giờ / 7 ngày và nhắc 12 giờ chạy chung một `BackgroundService` có chu kỳ, giống `PaymentTimeoutService`.
- Đơn được tạo khi đủ tiền, nên khách thứ hai chỉ thấy đơn thông qua tư cách thành viên phòng. Truy vấn sở hữu đơn (`AccountOrdersController.OwnedBy`) phải mở rộng cho thành viên phòng share. Vẫn chỉ đọc qua projection rõ ràng: không bao giờ trả mật khẩu Xbox, trừ tài khoản Moxic cấp đã Completed theo §6.
- Đơn tạo từ phòng: `CustomerId` là chủ phòng, số điện thoại và Zalo lấy từ hồ sơ chủ phòng, `Lang` theo chủ phòng, `PaymentMethod = Bank`, `TotalAmount` bằng tổng hai người thực trả, `DiscountAmount` bằng tổng voucher của hai người. Email người share chỉ dùng cho thông báo.
- Game pre-order được tạo phòng nếu admin bật "Cho phép share". Đơn tạo ra đi theo luồng pre-order sẵn có.
- Thời gian lưu UTC (`timestamp with time zone`), khoá chính kiểu `uuid`.

## 13. Phần để người làm quyết

Tên bảng và cột, cách chia controller và service, cơ chế cập nhật thời gian thực của khu thảo luận (dựa trên những gì chat hỗ trợ đang dùng), cách sinh mã phòng và mã MXR (phải là duy nhất, tránh ký tự dễ nhầm), chi tiết giao diện admin, nội dung email, và chi tiết tách component phía web (giữ đúng bố cục mockup).

## 14. Các quyết định do Claude tự chọn (chờ bạn xác nhận khi đọc)

1. Tài khoản Moxic cấp: mỗi phòng một tài khoản riêng, admin nhập thông tin, cả hai xem được sau khi hoàn tất (§6).
2. Giá chụp lại lúc tạo phòng (§5).
3. Tỷ lệ 10–90%, bước 5%, làm tròn đến 1.000đ, phần lẻ cho chủ phòng (§5).
4. Điều kiện voucher xét theo phần của từng người (§5).
5. Chủ phòng chưa trả bị đưa ra thì người đã trả lên làm chủ phòng (§4).
6. Người đã trả không có nút tự rút; muốn rút thì qua admin (§4).
7. Chỉ hỗ trợ SePay/QR ngân hàng, không hỗ trợ crypto cho phần share (§2).
8. Điểm thưởng của game chia theo tỷ lệ của từng người (§5).
