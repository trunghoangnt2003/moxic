import { Link, useParams } from "react-router-dom";
import { OrderSkeleton } from "../components/shared/Skeleton";
import { AlertTriangle, Clock, Gamepad2, PackageX } from "lucide-react";
import Container from "../components/layout/Container";
import OrderStatusBadge from "../components/account/OrderStatusBadge";
import { useMyOrder } from "../hooks/useAccount";
import { formatDate, formatPrice } from "../lib/utils";
import LiveOrderTracker from "../components/account/LiveOrderTracker";
import SavedCallout from "../components/shared/SavedCallout";
import GiftLinkCard from "../components/gift/GiftLinkCard";
import { useChatUi } from "../lib/chatApi";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  Bank: "Chuyển khoản ngân hàng",
  Crypto: "Crypto",
};

function BackLink() {
  return (
    <Link to="/account/orders" className="inline-block text-sm text-[#b5a898] hover:text-[#c9a96e] transition-colors mb-5">
      ← Lịch sử mua hàng
    </Link>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-4 py-2.5 border-b border-[#3d352a] last:border-b-0">
      <dt className="text-xs uppercase tracking-wide text-[#7a6f63]">{label}</dt>
      <dd className="text-sm text-[#ede6db] break-all sm:text-right">{value}</dd>
    </div>
  );
}

export default function OrderHistoryDetailPage() {
  const { orderCode = "" } = useParams();
  const { data: order, isLoading, isError } = useMyOrder(orderCode);

  if (isLoading) return <OrderSkeleton />;

  if (isError || !order) {
    return (
      <div className="min-h-screen bg-[#1a1714] py-8 md:py-12">
        <Container>
          <div className="max-w-3xl mx-auto">
            <BackLink />
            <div className="bg-[#252019] border border-[#3d352a] p-10 text-center">
              <PackageX className="w-12 h-12 text-[#3d352a] mx-auto mb-3" />
              <p className="text-[#ede6db] font-display uppercase tracking-wider">Không tìm thấy đơn hàng</p>
            </div>
          </div>
        </Container>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1714] py-8 md:py-12">
      <Container>
        <div className="max-w-3xl mx-auto">
          <BackLink />

          <div className="bg-[#252019] border border-[#3d352a] p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-[#7a6f63]">Mã đơn hàng</p>
                <h1 className="font-mono text-lg sm:text-xl text-[#ede6db] break-all">{order.orderCode}</h1>
              </div>
              <OrderStatusBadge status={order.status} />
            </div>

            <div className="mt-5 mb-2">
              <LiveOrderTracker order={order} />
            </div>
            {order.status !== "Cancelled" && (order.savedAmount ?? 0) > 0 && (
              <div className="mt-4">
                <SavedCallout amount={order.savedAmount!} suffix="với đơn này" share={order.status === "Completed"} />
              </div>
            )}

            {order.status === "Cancelled" && order.cancellationReason && (
              <p className="mt-4 bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300">
                Lý do hủy: {order.cancellationReason}
              </p>
            )}
            {order.status === "AwaitingConfirmation" && (
              <p className="mt-4 flex items-center gap-2 bg-sky-500/10 border border-sky-500/30 px-4 py-3 text-sm text-sky-300">
                <Clock className="w-4 h-4 flex-shrink-0" />
                Chúng tôi đang kiểm tra thanh toán của bạn.
              </p>
            )}
            {order.status === "ActionRequired" && (
              <p className="mt-4 flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 px-4 py-3 text-sm text-orange-300">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                Vui lòng kiểm tra email hoặc liên hệ hỗ trợ để cập nhật thông tin.
              </p>
            )}

            <dl className="mt-5">
              <InfoRow label="Ngày đặt" value={formatDate(order.createdAt)} />
              <InfoRow label="Cập nhật" value={formatDate(order.updatedAt)} />
              <InfoRow label="Thanh toán" value={PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod} />
              {order.isGift ? (
                <InfoRow label="Quà tặng cho" value={`${order.giftRecipientName ?? "—"}${order.giftClaimedAt ? " · đã nhận" : " · chưa nhận"}`} />
              ) : (
                <InfoRow label="Email Xbox" value={order.xboxEmail} />
              )}
            </dl>
          </div>

          <button
            type="button"
            onClick={() => useChatUi.getState().openChat(order.orderCode)}
            className="mt-4 w-full h-11 inline-flex items-center justify-center gap-2 border border-[#c9a96e]/40 text-[#c9a96e] text-sm font-semibold hover:bg-[#c9a96e]/10 cursor-pointer"
          >
            💬 Chat với Moxic về đơn này
          </button>

          {order.giftToken && (
            <div className="mt-4">
              <GiftLinkCard token={order.giftToken} recipientName={order.giftRecipientName} claimedAt={order.giftClaimedAt} />
            </div>
          )}

          <div className="mt-4 bg-[#252019] border border-[#3d352a] p-5 sm:p-6">
            <h2 className="font-display text-sm uppercase tracking-wider text-[#b5a898] mb-4">
              Game trong đơn ({order.items.length})
            </h2>
            <ul className="space-y-3">
              {order.items.map((item) => (
                <li key={item.gameId} className="flex items-center gap-3">
                  {item.coverUrl ? (
                    <img
                      src={item.coverUrl}
                      alt=""
                      loading="lazy"
                      className="w-12 h-16 object-cover flex-shrink-0 bg-[#2d261e]"
                    />
                  ) : (
                    <div className="w-12 h-16 flex-shrink-0 bg-[#2d261e] border border-[#3d352a] flex items-center justify-center">
                      <Gamepad2 className="w-5 h-5 text-[#7a6f63]" />
                    </div>
                  )}
                  <Link
                    to={`/games/${item.gameId}`}
                    className="flex-1 min-w-0 truncate text-sm text-[#ede6db] hover:text-[#c9a96e] transition-colors"
                  >
                    {item.gameName}
                  </Link>
                  <span className="text-sm text-[#b5a898] flex-shrink-0">{formatPrice(item.price)}</span>
                </li>
              ))}
            </ul>
            {order.discountAmount > 0 && (
              <div className="mt-5 pt-4 border-t border-[#3d352a] space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[#b5a898]">Tạm tính</span>
                  <span className="text-[#ede6db]">{formatPrice(order.subtotalAmount)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-[#b5a898]">
                    Giảm giá{order.couponCode ? <> (<span className="font-mono">{order.couponCode}</span>)</> : null}
                  </span>
                  <span className="flex-shrink-0 font-semibold text-green-400">−{formatPrice(order.discountAmount)}</span>
                </div>
              </div>
            )}
            <div className="mt-5 pt-4 border-t border-[#3d352a] flex items-center justify-between">
              <span className="text-sm text-[#b5a898]">Tổng cộng</span>
              <span className="text-lg font-bold text-[#c9a96e]">{formatPrice(order.totalAmount)}</span>
            </div>
          </div>

          {order.status === "Pending" && (
            <Link
              to={`/confirmation/${encodeURIComponent(order.orderCode)}`}
              className="mt-4 block w-full text-center bg-[#c9a96e] hover:bg-[#d4b87a] text-[#1a1714] font-bold py-3.5 text-sm uppercase tracking-wider transition-colors"
            >
              Tiếp tục thanh toán
            </Link>
          )}
        </div>
      </Container>
    </div>
  );
}
