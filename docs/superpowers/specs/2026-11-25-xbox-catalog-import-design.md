# Cào game Xbox + import file — thiết kế

Ngày: 2026-11-25 · Trạng thái: chờ duyệt

## 1. Ý định

Admin muốn bổ sung kho game nhanh. Hiện mỗi game phải nhập tay trong form sửa game: tên, ảnh, giá, thể loại. Tính năng này có hai cách thêm game:
1. **Cào hàng loạt** từ Xbox Store Việt Nam bằng một nút bấm.
2. **Import từ file** theo file mẫu tải về được.

Game thêm theo cả hai cách đều vào **hàng chờ duyệt**. Khách chưa thấy những game này cho tới khi admin bấm Đăng. Giá bán tính bằng **công thức** (admin tự nhập sau) hoặc **sửa tay** từng game.

## 2. Mục tiêu / Không làm / Tuyệt đối tránh

**Mục tiêu**
- Cào theo danh sách của Xbox Store VN: **Bán chạy**, **Mới ra**, **Sắp ra mắt**, **Đang giảm giá**. Admin chọn danh sách và số lượng muốn lấy.
- **Giá gốc = giá gốc trên Xbox Store VN (VND)**.
- Màn **Công thức giá**: giá bán = giá gốc × hệ số % + cộng thêm, làm tròn lên tới bội số admin chọn.
- Mỗi game có chế độ giá **Công thức** hoặc **Tự chỉnh**. Game ở chế độ Tự chỉnh không bao giờ bị công thức ghi đè.
- **Import CSV**, có nút tải file mẫu.
- **Hàng chờ duyệt**: xem, sửa giá, tick nhiều game, bấm **Đăng** hoặc **Xoá**.

**Không làm (lần này)**
- Phiên bản (edition): chỉ lấy sản phẩm chính, admin tự thêm edition sau.
- DLC, Game Pass, game miễn phí.
- Cào tự động theo lịch.
- Tự cập nhật giá gốc theo Xbox về sau.
- Gõ công thức tự do.

**Tuyệt đối tránh**
- Game cào về hiện ra store trước khi admin đăng.
- Game giá 0 được đăng.
- Thêm trùng game đã có.
- Làm hỏng giá hoặc thông tin của game đang bán.
- Làm server 1GB hết RAM khi tải ảnh.

## 3. Nguồn dữ liệu (đã kiểm tra 2026-11-25)

API duyệt game mà chính xbox.com đang dùng (không có tài liệu chính thức, không cần key):
`POST https://emerald.xboxservices.com/xboxcomfd/browse?locale=vi-VN`
- Header: `x-ms-api-version: 1.1`, `MS-CV: <chuỗi bất kỳ>`, `Content-Type: application/json`.
- Body: `{"Filters": "<base64 JSON bộ lọc/sắp xếp>", "ReturnFilters": false, "ChannelKeyToBeUsedInResponse": "...", "EncodedCT": "<trang tiếp>", "ChannelId": ""}`.
- Mỗi trang trả 25 `productSummaries`. Trang tiếp lấy từ `channels[...].encodedCT` (có `HasMore` và `TotalCount`).
- Mỗi sản phẩm có:
  - `productId`, `productKind`, `title`, `shortDescription`, `publisherName`, `releaseDate`, `categories` (tiếng Việt).
  - `images.poster` / `images.boxArt` / `images.superHeroArt` (link `store-images.s-microsoft.com`).
  - `specificPrices.purchaseable[0]`: `msrp` = giá gốc, `listPrice` = giá đang bán, `discountPercentage`, `currency` = `"VND"`.
- Cách mã hoá bộ lọc "Bán chạy / Mới ra / Sắp ra mắt / Đang giảm giá": người làm tự tìm bằng cách xem request mà trang xbox.com/vi-VN/games/browse gửi. Giá trị nào dùng được thì ghi vào code thành hằng số kèm chú thích.
- Mô tả đầy đủ (không bắt buộc): `displaycatalog.mp.microsoft.com/v7.0/products?bigIds=…&market=VN&languages=vi-vn`. `PriceTrackerService` đang dùng đúng endpoint này.

## 4. Quy tắc khi cào

- Bỏ qua sản phẩm nếu thuộc một trong các trường hợp:
  - `productKind != "Game"`;
  - không có giá mua, hoặc `msrp <= 0` (game miễn phí / không bán);
  - đã có game cùng `XboxProductId` (không phân biệt hoa thường), kể cả game đang chờ duyệt.
- Game mới nhận các giá trị sau:
  - `Name` = title, `Description` = mô tả đầy đủ nếu lấy được, không thì shortDescription.
  - `OriginalPrice` = msrp. `SalePrice` = giá theo công thức nếu đã có công thức, chưa có thì 0. `PriceMode = Formula`.
  - `Status` = Đặt trước nếu ngày ra mắt còn ở tương lai, ngược lại là Có sẵn. `ReleaseDate`, `Publisher`, `XboxProductId`, `ProductType = "Game"`.
  - `PriceRegion = "vn"` để bộ so giá hằng ngày theo dõi đúng giá VND.
  - **Thể loại**: ghép theo tên với thể loại sẵn có. Tên chưa có thì bỏ qua, không tự tạo thể loại mới.
  - **Ảnh**: tải poster (ảnh chính) và superHeroArt về MinIO thành `GameMedia`, đúng cách upload hiện có (`games/{id}/…`). Tải lần lượt từng ảnh và stream thẳng lên MinIO, không đọc cả file vào RAM. Ảnh quá 10MB hoặc tải lỗi thì bỏ qua ảnh đó, game vẫn được tạo.
  - `IsPublished = false`.
- Cào chạy ở **nền**, mỗi lần chỉ một tác vụ. Admin thấy tiến độ: đã quét, đã thêm, bỏ qua (lý do), lỗi. Giữa các trang nghỉ khoảng 0,5–1 giây.

## 5. Hàng chờ duyệt (trạng thái ẩn)

- Thêm `Game.IsPublished` (mặc định **true**, nên game hiện có vẫn hiện như cũ). Game cào hoặc import về có `false`.
- **Mọi chỗ khách nhìn thấy game đều phải lọc `IsPublished`**:
  - danh sách, tìm kiếm, nổi bật, bộ lọc (facets), chi tiết game, bảng giá, lịch ra mắt, so sánh, yêu thích;
  - game cho thuê, game share (`/api/share/games`), giỏ hàng / tạo đơn (không mua được game chưa đăng);
  - trang SEO, sitemap, llms.txt, IndexNow, đoán game, bảng xếp hạng, mục "khám phá".
  - Người làm phải grep mọi chỗ đọc `Games` ở phía khách để không sót. Có thể chọn query filter toàn cục (`HasQueryFilter`) hoặc thêm `Where` vào từng chỗ; người làm chọn cách an toàn hơn, nhưng admin và luồng đơn cũ phải vẫn thấy mọi game.
- Admin: danh sách game hiện có thêm nhãn "Chờ duyệt". Màn mới (§7) có tab Chờ duyệt.
- **Đăng** bị chặn nếu `SalePrice <= 0`. Lỗi báo cho từng game.
- **Xoá** game chờ duyệt thì xoá luôn ảnh trên MinIO.

## 6. Công thức giá

- Một cấu hình dùng chung: **hệ số %** (vd 70), **cộng thêm** (VND, có thể âm), **làm tròn lên tới** (vd 1.000 / 5.000 / 10.000).
- `giá bán = ceil((giá gốc × hệ số / 100 + cộng thêm) / làm tròn) × làm tròn`, tối thiểu 0.
- Lưu cấu hình bằng cơ chế lưu thiết lập sẵn có của dự án (`ContactSetting`, nếu hợp). Chưa lưu lần nào thì xem như chưa có công thức.
- **Lưu công thức không tự đổi giá game đang bán.** Có nút riêng **"Áp dụng công thức"**:
  - mặc định chỉ áp dụng cho game chờ duyệt ở chế độ Công thức;
  - có tuỳ chọn áp dụng cho cả game đã đăng ở chế độ Công thức;
  - trước khi áp dụng hiện số game sẽ đổi giá để admin xác nhận.
- Admin sửa tay giá bán của một game thì game đó tự chuyển sang **Tự chỉnh**. Có thể chuyển lại Công thức.
- Game hiện có lúc thêm cột sẽ ở chế độ **Tự chỉnh**, để không bao giờ bị công thức đè.

## 7. Màn admin "Kho game Xbox"

- **Cào**: chọn danh sách (Bán chạy / Mới ra / Sắp ra mắt / Đang giảm giá), số lượng (50 / 100 / 200 / 500), bấm "Bắt đầu cào". Có thanh tiến độ và kết quả.
- **Chờ duyệt**: bảng gồm ảnh, tên, ngày ra mắt, giá gốc, giá bán (sửa tại chỗ), chế độ giá, % rẻ hơn Store. Có tick tất cả, **Đăng**, **Xoá**, và link mở form sửa game đầy đủ.
- **Import**: nút "Tải file mẫu", chọn file CSV, bấm "Import", rồi xem báo cáo từng dòng (đã thêm / bỏ qua / lỗi kèm lý do).
- **Công thức giá**: form 3 ô, có ví dụ tính trực tiếp ("giá gốc 1.499.000đ → giá bán …"), nút Lưu và nút Áp dụng.

## 8. Import CSV

- File CSV UTF-8 có BOM để Excel mở đúng tiếng Việt, chấp nhận dấu phẩy hoặc chấm phẩy. Tối đa 1.000 dòng và 2MB.
- Các cột trong file mẫu (dòng tiêu đề tiếng Việt không dấu, kèm 2 dòng ví dụ):
  `xbox_product_id, ten_game, mo_ta, gia_goc, gia_ban, trang_thai, ngay_ra_mat, nha_phat_hanh, the_loai, vung, link_anh`
  - Có `xbox_product_id` mà bỏ trống tên/giá/ảnh: lấy phần còn thiếu từ Microsoft như khi cào.
  - Không có `xbox_product_id`: bắt buộc có `ten_game` và `gia_goc`.
  - `gia_ban` trống thì dùng công thức (Công thức), có giá trị thì dùng giá đó (Tự chỉnh).
  - `the_loai` cách nhau bằng `|` và ghép theo tên như khi cào. `link_anh` tải về MinIO như khi cào.
  - Trùng `xbox_product_id` với game đã có thì bỏ qua.
- Mọi game import đều vào **chờ duyệt**. Dòng lỗi không chặn các dòng còn lại.

## 9. Ràng buộc

- .NET 10 / EF Core / PostgreSQL / React admin hiện có. Schema mới thêm bằng `*SchemaBootstrap` (cột `IsPublished` DEFAULT true, `PriceMode` DEFAULT 'Manual').
- Server 1GB RAM: một tác vụ cào tại một thời điểm, tải ảnh lần lượt, không giữ cả ảnh trong RAM.
- API Microsoft có thể đổi bất cứ lúc nào. Lỗi phải hiện rõ cho admin ("Không đọc được Xbox Store: …"), không làm sập API.

## 10. Phần để người làm quyết

Tên cột, bảng, route; cách chạy job nền và báo tiến độ (polling như các màn admin khác); ghép thể loại có phân biệt dấu hay không; chọn `HasQueryFilter` hay `Where` từng chỗ (§5); cách parse CSV (dùng thư viện có sẵn của .NET hoặc tự viết đơn giản, không thêm dependency nếu tránh được).

## 11. Quyết định Claude tự chọn (chờ bạn xác nhận)

1. Bỏ qua DLC, game miễn phí, edition; ghép thể loại chỉ với thể loại có sẵn.
2. Lưu công thức không tự đổi giá; phải bấm "Áp dụng". Game đang bán coi là Tự chỉnh.
3. Tải ảnh poster + ảnh nền lớn về MinIO lúc cào (để duyệt có ảnh).
4. Game sắp ra mắt cào về để trạng thái Đặt trước.
5. Import dùng CSV (không phải .xlsx).
6. Số lượng cào mỗi lần tối đa 500.
