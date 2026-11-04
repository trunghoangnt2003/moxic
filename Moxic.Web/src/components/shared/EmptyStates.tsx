import { ShoppingBag, SearchX } from "lucide-react";
import { Link } from "react-router-dom";

import { t } from "../../lib/i18n";
export function EmptyCart() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <ShoppingBag className="w-16 h-16 text-text-muted mb-4 opacity-30" />
      <h3 className="font-display text-lg text-text-primary mb-2">{t("Giỏ hàng trống")}</h3>
      <p className="text-text-muted text-sm mb-6 max-w-xs">
        {t("Chưa có game nào trong giỏ. Hãy khám phá cửa hàng và thêm game bạn yêu thích!")}
      </p>
      <Link
        to="/games"
        className="inline-flex items-center gap-2 px-6 py-2.5 bg-accent hover:bg-accent-hover text-on-accent text-sm font-semibold rounded transition-colors"
      >
        {t("Khám phá game")}
      </Link>
    </div>
  );
}

export function EmptySearch({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <SearchX className="w-16 h-16 text-text-muted mb-4 opacity-30" />
      <h3 className="font-display text-lg text-text-primary mb-2">{t("Không tìm thấy game")}</h3>
      <p className="text-text-muted text-sm mb-6 max-w-xs">
        {t("Không có game nào phù hợp với bộ lọc của bạn. Thử xóa bộ lọc để xem tất cả game.")}
      </p>
      <button
        onClick={onClear}
        className="inline-flex items-center gap-2 px-6 py-2.5 bg-accent hover:bg-accent-hover text-on-accent text-sm font-semibold rounded transition-colors cursor-pointer"
      >
        {t("Xóa bộ lọc")}
      </button>
    </div>
  );
}

export function EmptyOrders({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <h3 className="font-body text-base text-text-primary mb-1">
        {hasFilters ? t("Không có đơn hàng phù hợp") : t("Chưa có đơn hàng nào")}
      </h3>
      <p className="text-text-muted text-sm">
        {hasFilters ? t("Thử thay đổi bộ lọc để xem thêm kết quả.") : t("Đơn hàng sẽ xuất hiện tại đây sau khi khách hàng đặt mua.")}
      </p>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="text-8xl font-display text-accent opacity-30 mb-4">404</div>
      <h1 className="font-display text-2xl text-text-primary mb-3">{t("Oops! Trang này bị lỗi rồi")}</h1>
      <p className="text-text-muted text-sm mb-8 max-w-md">
        {t("Có vẻ như trang bạn đang tìm kiếm không tồn tại hoặc đã bị di chuyển.")}
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-6 py-2.5 bg-accent hover:bg-accent-hover text-on-accent text-sm font-semibold rounded transition-colors"
      >
        {t("Quay lại cửa hàng")}
      </Link>
    </div>
  );
}
