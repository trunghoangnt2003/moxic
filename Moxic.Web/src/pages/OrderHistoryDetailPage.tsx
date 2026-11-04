import { Link, useParams } from "react-router-dom";
import { OrderSkeleton } from "../components/shared/Skeleton";
import { AlertTriangle, Clock, Gamepad2, MessageCircleMore, PackageX } from "lucide-react";
import Container from "../components/layout/Container";
import OrderStatusBadge from "../components/account/OrderStatusBadge";
import { useMyOrder } from "../hooks/useAccount";
import { formatDate, formatPrice } from "../lib/utils";
import LiveOrderTracker from "../components/account/LiveOrderTracker";
import SavedCallout from "../components/shared/SavedCallout";
import GiftLinkCard from "../components/gift/GiftLinkCard";
import { useChatUi } from "../lib/chatApi";

import { t } from "../lib/i18n";
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  Bank: t("Chuyển khoản ngân hàng"),
  Crypto: "Crypto",
};

function BackLink() {
  return (
    <Link to="/account/orders" className="inline-block text-sm text-text-secondary hover:text-accent transition-colors mb-5">
      {t("Lịch sử mua hàng")}
    </Link>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-4 py-2.5 border-b border-white/10 last:border-b-0">
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-sm text-text-primary break-all sm:text-right">{value}</dd>
    </div>
  );
}

export default function OrderHistoryDetailPage() {
  const { orderCode = "" } = useParams();
  const { data: order, isLoading, isError } = useMyOrder(orderCode);

  if (isLoading) return <OrderSkeleton />;

  if (isError || !order) {
    return (
      <div>
        <Container>
          <div className="max-w-4xl">
            <BackLink />
            <div className="bg-bg-surface border border-white/10 p-10 text-center">
              <PackageX className="w-12 h-12 text-white/10 mx-auto mb-3" />
              <p className="text-text-primary font-display">{t("Không tìm thấy đơn hàng")}</p>
            </div>
          </div>
        </Container>
      </div>
    );
  }

  return (
    <div>
      <Container>
        <div className="max-w-4xl">
          <BackLink />

          <div className="bg-bg-surface border border-white/10 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-text-muted">{t("Mã đơn hàng")}</p>
                <h1 className="font-mono text-lg sm:text-xl text-text-primary break-all">{order.orderCode}</h1>
              </div>
              <OrderStatusBadge status={order.status} />
            </div>

            <div className="mt-5 mb-2">
              <LiveOrderTracker order={order} />
            </div>
            {order.status !== "Cancelled" && (order.savedAmount ?? 0) > 0 && (
              <div className="mt-4">
                <SavedCallout amount={order.savedAmount!} suffix={t("với đơn này")} share={order.status === "Completed"} />
              </div>
            )}

            {order.status === "Cancelled" && order.cancellationReason && (
              <p className="mt-4 bg-negative/10 border border-negative/30 px-4 py-3 text-sm text-negative">
                {t("Lý do hủy: {0}", [order.cancellationReason])}
              </p>
            )}
            {order.status === "AwaitingConfirmation" && (
              <p className="mt-4 flex items-center gap-2 bg-info/10 border border-info/30 px-4 py-3 text-sm text-info">
                <Clock className="w-4 h-4 flex-shrink-0" />
                {t("Chúng tôi đang kiểm tra thanh toán của bạn.")}
              </p>
            )}
            {order.status === "ActionRequired" && (
              <p className="mt-4 flex items-center gap-2 bg-caution/10 border border-caution/30 px-4 py-3 text-sm text-caution">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {t("Vui lòng kiểm tra email hoặc liên hệ hỗ trợ để cập nhật thông tin.")}
              </p>
            )}

            <dl className="mt-5">
              <InfoRow label={t("Ngày đặt")} value={formatDate(order.createdAt)} />
              <InfoRow label={t("Cập nhật")} value={formatDate(order.updatedAt)} />
              <InfoRow label={t("Thanh toán")} value={PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod} />
              {order.isGift ? (
                <InfoRow label={t("Quà tặng cho")} value={`${order.giftRecipientName ?? "—"}${order.giftClaimedAt ? t(", đã nhận") : t(", chưa nhận")}`} />
              ) : (
                <InfoRow label="Email Xbox" value={order.xboxEmail} />
              )}
            </dl>
          </div>

          <button
            type="button"
            onClick={() => useChatUi.getState().openChat(order.orderCode)}
            className="mt-4 w-full h-11 inline-flex items-center justify-center gap-2 border border-accent/40 text-accent text-sm font-semibold hover:bg-accent/10 cursor-pointer"
          >
            <MessageCircleMore className="w-4 h-4" aria-hidden="true" /> {t("Chat với Moxic về đơn này")}
          </button>

          {order.giftToken && (
            <div className="mt-4">
              <GiftLinkCard token={order.giftToken} recipientName={order.giftRecipientName} claimedAt={order.giftClaimedAt} />
            </div>
          )}

          <div className="mt-4 bg-bg-surface border border-white/10 p-5 sm:p-6">
            <h2 className="font-display text-sm text-text-secondary mb-4">
              {t("Game trong đơn ({0})", [order.items.length])}
            </h2>
            <ul className="space-y-3">
              {order.items.map((item) => (
                <li key={item.gameId} className="flex items-center gap-3">
                  {item.coverUrl ? (
                    <img
                      src={item.coverUrl}
                      alt=""
                      loading="lazy"
                      className="w-12 h-16 object-cover flex-shrink-0 bg-bg-elevated"
                    />
                  ) : (
                    <div className="w-12 h-16 flex-shrink-0 bg-bg-elevated border border-white/10 flex items-center justify-center">
                      <Gamepad2 className="w-5 h-5 text-text-muted" />
                    </div>
                  )}
                  <Link
                    to={`/games/${item.gameId}`}
                    className="flex-1 min-w-0 truncate text-sm text-text-primary hover:text-accent transition-colors"
                  >
                    {item.gameName}
                  </Link>
                  <span className="text-sm text-text-secondary flex-shrink-0">{formatPrice(item.price)}</span>
                </li>
              ))}
            </ul>
            {order.discountAmount > 0 && (
              <div className="mt-5 pt-4 border-t border-white/10 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-text-secondary">{t("Tạm tính")}</span>
                  <span className="text-text-primary">{formatPrice(order.subtotalAmount)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-text-secondary">
                    {t("Giảm giá")}{order.couponCode ? <> (<span className="font-mono">{order.couponCode}</span>)</> : null}
                  </span>
                  <span className="flex-shrink-0 font-semibold text-positive">−{formatPrice(order.discountAmount)}</span>
                </div>
              </div>
            )}
            <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between">
              <span className="text-sm text-text-secondary">{t("Tổng cộng")}</span>
              <span className="text-lg font-bold text-accent">{formatPrice(order.totalAmount)}</span>
            </div>
          </div>

          {order.status === "Pending" && (
            <Link
              to={`/confirmation/${encodeURIComponent(order.orderCode)}`}
              className="mt-4 block w-full text-center bg-accent hover:bg-accent-hover text-on-accent font-bold py-3.5 text-sm transition-colors"
            >
              {t("Tiếp tục thanh toán")}
            </Link>
          )}
        </div>
      </Container>
    </div>
  );
}
