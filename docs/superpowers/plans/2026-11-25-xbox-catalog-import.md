# Cào game Xbox + import CSV — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin cào game hàng loạt từ Xbox Store VN và import CSV vào hàng chờ duyệt, giá bán theo công thức hoặc tự chỉnh, đăng hàng loạt.

**Architecture:** `Game.IsPublished` + EF global query filter ẩn game chờ duyệt khỏi mọi truy vấn khách; admin sửa game và module import dùng `IgnoreQueryFilters()`. Module mới `Catalog/`: `PriceFormula` (thuần), `XboxBrowseClient` (gọi + parse API xbox.com), `CatalogImportService` (tạo game, ảnh MinIO, CSV, đăng/xoá, áp công thức), `CatalogCrawlJob` (job nền một-tại-một-thời-điểm, tiến độ trong bộ nhớ). Admin React một trang `XboxCatalog.tsx` 4 tab.

**Tech Stack:** .NET 10, EF Core + Npgsql (bootstrap SQL), xUnit trên Postgres docker, React admin.

**Spec:** `docs/superpowers/specs/2026-11-25-xbox-catalog-import-design.md`

## Global Constraints

- Nguồn: `POST https://emerald.xboxservices.com/xboxcomfd/browse?locale=vi-VN`, header `x-ms-api-version: 1.1`, `MS-CV`, body `Filters` = base64 của `{"orderby":{"id":"orderby","choices":[{"id":"<SORT>"}]},"PlayWith":{"id":"PlayWith","choices":[{"id":"XboxSeriesX|S"},{"id":"XboxOne"}]}}`, phân trang bằng `EncodedCT`.
- Danh sách → SORT: `popular` = `MostPopular desc` (Bán chạy), `new` = `ReleaseDate desc` (Mới & sắp ra mắt), `discount` = `DiscountPercentage desc` (Đang giảm giá), `wishlist` = `WishlistCountTotal desc` (Được mong muốn nhất).
- Giá gốc = `specificPrices.purchaseable[0].msrp` (VND). Bỏ qua: `productKind != "Game"`, msrp null/≤0, trùng `XboxProductId` (kể cả game chờ duyệt).
- Công thức: `ceil((goc × pct/100 + add) / round) × round`, tối thiểu 0; chưa có cấu hình → 0.
- Game hiện có: `IsPublished = true`, `PriceMode = "Manual"`. Game cào/import: `IsPublished = false`, `PriceMode = "Formula"` (trừ CSV có giá bán → `"Manual"`).
- Số lượng cào: 50/100/200/500. Một job tại một thời điểm. Ảnh: poster (chính) + superHeroArt, stream lên MinIO qua `IMinioService.UploadImageAsync`, bỏ ảnh > 10MB.
- CSV: UTF-8 (BOM), `,` hoặc `;`, ≤1000 dòng, ≤2MB, cột `xbox_product_id,ten_game,mo_ta,gia_goc,gia_ban,trang_thai,ngay_ra_mat,nha_phat_hanh,the_loai,vung,link_anh`.
- Không thêm dependency.

## Review Focus

1. Game chờ duyệt lọt ra phía khách qua một truy vấn quên filter (global filter + test `Public_queries_hide_unpublished_games`).
2. Đăng game giá 0 → bị chặn, báo lỗi từng game (test ở Task 4).
3. CSV có ô chứa dấu phẩy trong ngoặc kép / dấu `;` / BOM → parse đúng (test ở Task 5).
4. Bấm cào lần hai khi job đang chạy → từ chối, không chạy song song (test ở Task 6).
5. "Áp dụng công thức" không đụng game `Manual` (test ở Task 4).

---

### Task 1: Schema, trạng thái ẩn, filter toàn cục

**Files:** Modify `Game.cs` (+`IsPublished` bool = true, +`PriceMode` string = "Manual"); Create `Core/Entities/CatalogSettings.cs` (`Id`, `PricePercent` decimal, `PriceAdd` decimal, `PriceRoundTo` decimal, `UpdatedAt`); `MoxicDbContext` (DbSet, `HasQueryFilter(g => g.IsPublished)`, cấu hình cột); `ShareRoomSchemaBootstrap` → thêm vào bootstrap mới `CatalogSchemaBootstrap`? — **dùng file mới `XboxCatalogSchemaBootstrap.cs`** (ALTER Games ADD IsPublished boolean NOT NULL DEFAULT TRUE, PriceMode varchar(10) NOT NULL DEFAULT 'Manual', CREATE TABLE CatalogSettings), đăng ký trong `Program.cs`; `AdminGamesController` + `AdminGameCatalogController`: mọi `_db.Games` → `.IgnoreQueryFilters()`; admin list DTO +`IsPublished`.
- [ ] Test `Public_queries_hide_unpublished_games` (tạo 1 game published + 1 unpublished; `ctx.Games.Count()` = 1; `IgnoreQueryFilters().Count()` = 2) và bootstrap-upgrade test (drop cột/bảng, chạy bootstrap 2 lần, cột mặc định đúng). FAIL → implement → PASS (toàn bộ suite xanh). Commit.

### Task 2: PriceFormula

**Files:** Create `Api/Services/Catalog/PriceFormula.cs` — `static decimal Compute(decimal original, CatalogSettings? s)`; `static bool IsSet(CatalogSettings? s)`.
- [ ] Tests: (1.499.000, 70%, +0, round 1.000) → 1.050.000 (1.049.300 làm tròn lên); (1.499.000, 70, -50.000, 10.000) → 1.000.000; null settings → 0; kết quả âm → 0. FAIL → implement → PASS. Commit.

### Task 3: XboxBrowseClient

**Files:** Create `Api/Services/Catalog/XboxBrowseClient.cs`.
- `record XboxProduct(string ProductId, string Kind, string Title, string? ShortDescription, string? Publisher, DateTime? ReleaseDate, List<string> Categories, string? PosterUrl, string? HeroUrl, decimal? Msrp)`
- `static (List<XboxProduct> Items, string? NextToken) ParsePage(string json)` (thuần).
- `static string SortFor(string list)` (Global Constraints map; khác → ArgumentException).
- `Task<(List<XboxProduct> Items, string? NextToken)> FetchPageAsync(string list, string? token, CancellationToken ct)` qua `IHttpClientFactory` client tên `"xboxcatalog"` (đăng ký trong Program.cs, timeout 30s).
- `Task<XboxProduct?> FetchByIdAsync(string productId, CancellationToken ct)` — displaycatalog `market=VN&languages=vi-vn` (cho CSV chỉ có id): title, LongDescription, publisher, ảnh (`Images` ImagePurpose `Poster`/`SuperHeroArt`), msrp VND.
- [ ] Test `ParsePage_reads_products_prices_and_next_token` với JSON fixture rút gọn (2 sản phẩm: 1 có msrp 1.499.000, 1 không có giá; encodedCT có giá trị) — kiểm tra field và NextToken; `NextToken` null khi `HasMore` false. FAIL → implement → PASS. Commit.

### Task 4: CatalogImportService

**Files:** Create `Api/Services/Catalog/CatalogImportService.cs` (scoped), `Models/CatalogDtos.cs`.
- `Task<(bool Created, string? Skip)> AddFromXboxAsync(XboxProduct p, CancellationToken ct)` — quy tắc bỏ qua + tạo game (spec §4), ghép thể loại theo tên (không phân biệt hoa thường, so sánh trim), ảnh qua `Task DownloadImagesAsync(Game g, IEnumerable<string> urls)`.
- `Task<List<PendingGameDto>> PendingAsync()`; `Task<string?> SetPriceAsync(Guid id, decimal? salePrice, string mode)` (sửa tay → Manual; mode Formula → tính lại).
- `Task<List<(Guid Id, string Error)>> PublishAsync(IEnumerable<Guid> ids)` — chặn SalePrice ≤ 0.
- `Task DeletePendingAsync(IEnumerable<Guid> ids)` — chỉ game `IsPublished=false`, xoá ảnh MinIO (nếu `IMinioService` có delete; không có thì bỏ, ghi `shortcut:`).
- `Task<int> CountFormulaTargetsAsync(bool includePublished)`, `Task<int> ApplyFormulaAsync(bool includePublished)` — chỉ `PriceMode == "Formula"`.
- `Task<CatalogSettings?> GetSettingsAsync()`, `Task SaveSettingsAsync(decimal pct, decimal add, decimal roundTo)` (validate pct 1..500, roundTo ∈ {1,1000,5000,10000}).
- Ảnh: test dùng `IMinioService` giả ghi nhận lời gọi; HTTP ảnh qua client `"xboxcatalog"` → test truyền URL rỗng/không ảnh.
- [ ] Tests: `AddFromXbox_creates_pending_game_with_formula_price`, `AddFromXbox_skips_duplicates_non_games_and_free`, `Publish_blocks_zero_price_and_publishes_rest`, `ApplyFormula_leaves_manual_games_alone`, `SetPrice_manual_switches_mode`. FAIL → implement → PASS. Commit.

### Task 5: CSV import + file mẫu

**Files:** Create `Api/Services/Catalog/CatalogCsv.cs` — `static string Template()` (BOM + header + 2 dòng ví dụ), `static List<string[]> Parse(string text)` (ngoặc kép, `""`, `,`/`;` tự nhận theo dòng tiêu đề, bỏ BOM); `CatalogImportService.ImportCsvAsync(string text, CancellationToken ct) → List<CsvRowResult(int Row, string Status, string? Message)>`.
- [ ] Tests: `Csv_parse_handles_quotes_semicolons_and_bom`, `ImportCsv_creates_pending_games_and_reports_errors` (dòng thiếu tên+giá không id → lỗi; dòng có giá bán → Manual; trùng id → bỏ qua). FAIL → implement → PASS. Commit.

### Task 6: Job nền + API admin

**Files:** Create `Api/Services/Catalog/CatalogCrawlJob.cs` (singleton: `bool TryStart(string list, int count)`, `CrawlStatus Status` — running, list, target, scanned, added, skipped (theo lý do), errors, startedAt, finishedAt, lastError; chạy `Task.Run` với scope mới, dừng khi đủ `added == count` hoặc hết trang hoặc quét quá `count*6` sản phẩm); Create `Controllers/AdminCatalogController.cs` `[Authorize(Roles="Admin")]`, route `api/admin/catalog`: `POST crawl {list,count}`, `GET crawl`, `GET pending`, `PUT pending/{id}/price {salePrice?, mode}`, `POST publish {ids}`, `POST delete {ids}`, `GET formula`, `PUT formula`, `GET formula/preview?includePublished=` (số game), `POST formula/apply {includePublished}`, `GET template` (text/csv, `mau-import-game.csv`), `POST import` (multipart file, ≤2MB).
- [ ] Test `Crawl_job_refuses_second_start_while_running` (start với client giả chặn, `TryStart` lần 2 = false). FAIL → implement → PASS. Build API. Commit.

### Task 7: Admin UI

**Files:** Create `Moxic.Admin/src/pages/XboxCatalog.tsx` (tabs: Cào · Chờ duyệt · Import · Công thức giá); route `/xbox-catalog` + menu "Kho game Xbox"; `GameList.tsx` hiện nhãn "Chờ duyệt" khi `isPublished === false`.
- Cào: select danh sách + số lượng + nút; poll `GET crawl` mỗi 2s khi running.
- Chờ duyệt: bảng (ảnh, tên, ngày, giá gốc, giá bán input, chế độ, % rẻ hơn), tick tất cả, Đăng/Xoá (confirm), link sửa `/games/{id}/edit`, hiện lỗi đăng từng game.
- Import: link tải mẫu, input file, nút Import, bảng kết quả.
- Công thức: 3 ô + ví dụ trực tiếp 1.499.000đ, Lưu, "Áp dụng" (checkbox gồm game đã đăng, confirm với số game).
- [ ] `npm run build` sạch. Commit.

### Task 8: Kiểm tra thật + deploy

- [ ] Chạy API local trên DB test, gọi crawl `popular` 50 thật (mạng thật tới xbox.com, MinIO giả hay thật tuỳ có), xác nhận game chờ duyệt, không hiện ở `/api/games`; đăng 1 game → hiện.
- [ ] `dotnet test` toàn bộ xanh, web/admin build xanh.
- [ ] Merge `feat/xbox-catalog` → `main`, push; backup DB; build+push 3 image (script); deploy; kiểm tra log, `/api/games` 200, trang admin mở được.
