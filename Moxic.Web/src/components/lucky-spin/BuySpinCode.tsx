import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Copy, Loader2, Minus, Plus, ShoppingCart, Ticket, X } from "lucide-react";
import toast from "react-hot-toast";
import { buySpinCode, getSpinCodeOrder, type SpinCodeOrder } from "../../lib/luckySpinApi";
import { apiError } from "../../lib/communityApi";
import { formatPrice } from "../../lib/utils";
import { t } from "../../lib/i18n";

const MAX = 20;
const storeKey = (slug: string) => `moxic.spinorder.${slug}`;

function copy(text: string) {
  navigator.clipboard?.writeText(text).then(
    () => toast.success(t("Đã sao chép")),
    () => toast.error(t("Không sao chép được")),
  );
}

/**
 * Code cases with a price: buy spins by bank transfer. The QR carries the amount and a unique transfer
 * content; SePay confirms it and the server issues a spin code, which appears here with a "use it" button.
 */
export default function BuySpinCode({
  slug,
  price,
  loggedIn,
  onUseCode,
}: {
  slug: string;
  price: number;
  loggedIn: boolean;
  onUseCode: (code: string) => void;
}) {
  const [qty, setQty] = useState(1);
  const [orderId, setOrderId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(storeKey(slug));
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (orderId) sessionStorage.setItem(storeKey(slug), orderId);
      else sessionStorage.removeItem(storeKey(slug));
    } catch {
      /* storage unavailable */
    }
  }, [orderId, slug]);

  const { data: order } = useQuery({
    queryKey: ["spin-code-order", orderId],
    queryFn: () => getSpinCodeOrder(orderId!),
    enabled: !!orderId && loggedIn,
    refetchInterval: (q) => ((q.state.data as SpinCodeOrder | undefined)?.status === "Pending" ? 3000 : false),
    retry: false,
  });

  const buy = useMutation({
    mutationFn: () => buySpinCode(slug, qty),
    onSuccess: (o) => setOrderId(o.id),
    onError: (e) => toast.error(apiError(e, t("Không tạo được đơn mua lượt quay"))),
  });

  if (!loggedIn) {
    return (
      <div className="mx-auto mt-4 w-full max-w-xl rounded-sm border border-highlight/25 bg-spin-deep/60 p-4 text-center text-sm text-white/80">
        <Ticket className="mx-auto mb-2 h-5 w-5 text-highlight" />
        {t("Chưa có mã? Mua lượt quay chỉ {0}/lượt.", [formatPrice(price)])}{" "}
        <Link to={`/login?redirect=${encodeURIComponent(`/lucky-spin/${slug}`)}`} className="font-semibold text-highlight hover:underline">
          {t("Đăng nhập để mua")}
        </Link>
      </div>
    );
  }

  // Paid: the code is ready
  if (order?.status === "Paid" && order.spinCode) {
    return (
      <div className="mx-auto mt-4 w-full max-w-xl rounded-sm border border-positive/40 bg-positive/10 p-5 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-positive" />
        <p className="mt-2 font-display text-lg font-bold text-white">{t("Đã nhận tiền, mã quay của bạn")}</p>
        <button
          type="button"
          onClick={() => copy(order.spinCode!)}
          className="mt-3 inline-flex items-center gap-2 rounded-sm border border-white/20 bg-spin-deep px-4 py-2 font-mono text-xl font-bold tracking-wider text-white"
        >
          {order.spinCode} <Copy className="h-4 w-4 text-white/60" />
        </button>
        <p className="mt-2 text-sm text-white/70">{t("{0} lượt quay, mã cũng được gửi vào thông báo của bạn.", [order.quantity])}</p>
        <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => {
              onUseCode(order.spinCode!);
              setOrderId(null);
            }}
            className="h-11 rounded-sm bg-positive px-6 font-bold text-on-solid transition-[filter] hover:brightness-110"
          >
            {t("Dùng mã này để mở hòm")}
          </button>
        </div>
      </div>
    );
  }

  // Pending: pay by QR
  if (order && order.status === "Pending") {
    return (
      <div className="mx-auto mt-4 w-full max-w-xl rounded-sm border border-highlight/30 bg-spin-deep/70 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-lg font-bold text-white">{t("Thanh toán {0} lượt quay", [order.quantity])}</p>
            <p className="text-sm text-white/70">{order.caseName}</p>
          </div>
          <button type="button" onClick={() => setOrderId(null)} aria-label={t("Đóng")} className="p-1 text-white/60 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
          {order.qrUrl ? (
            <img src={order.qrUrl} alt={t("Mã QR thanh toán")} className="mx-auto w-[180px] rounded-sm bg-white p-2" />
          ) : (
            <p className="text-sm text-caution">{t("Chưa có mã QR ngân hàng")}</p>
          )}
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-white/60">{t("Số tiền")}</dt>
              <dd className="flex items-center gap-2 font-display text-2xl font-bold text-white num">
                {formatPrice(order.amount)}
                <button type="button" onClick={() => copy(String(order.amount))} aria-label={t("Sao chép số tiền cần chuyển")} className="text-white/50 hover:text-white">
                  <Copy className="h-4 w-4" />
                </button>
              </dd>
            </div>
            <div>
              <dt className="text-white/60">{t("Nội dung chuyển khoản")}</dt>
              <dd className="flex items-center gap-2 font-mono text-base font-bold text-highlight">
                {order.transferContent}
                <button type="button" onClick={() => copy(order.transferContent)} aria-label={t("Sao chép nội dung chuyển khoản")} className="text-white/50 hover:text-white">
                  <Copy className="h-4 w-4" />
                </button>
              </dd>
            </div>
            {order.bankAccountNumber && (
              <div className="text-white/70">
                {order.bankName}, {order.bankAccountNumber}
                {order.bankAccountHolder ? `, ${order.bankAccountHolder}` : ""}
              </div>
            )}
          </dl>
        </div>
        <p className="mt-4 flex items-center gap-2 text-sm text-white/80">
          <Loader2 className="h-4 w-4 animate-spin text-highlight motion-reduce:animate-none" />
          {order.autoConfirm ? t("Đang chờ tiền về, mã quay sẽ hiện ngay tại đây.") : t("Moxic sẽ xác nhận và gửi mã quay cho bạn.")}
        </p>
      </div>
    );
  }

  // Choose quantity
  return (
    <div className="mx-auto mt-4 w-full max-w-xl rounded-sm border border-highlight/25 bg-spin-deep/60 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-white">
        <Ticket className="h-4 w-4 text-highlight" /> {t("Chưa có mã? Mua lượt quay")}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center border border-white/15">
          <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label={t("Giảm số lượng")} className="flex h-11 w-11 items-center justify-center text-white/70 hover:bg-white/5 hover:text-white">
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-10 text-center font-semibold text-white num" aria-live="polite">{qty}</span>
          <button type="button" onClick={() => setQty((q) => Math.min(MAX, q + 1))} aria-label={t("Tăng số lượng")} className="flex h-11 w-11 items-center justify-center text-white/70 hover:bg-white/5 hover:text-white">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-white/60">{t("{0}/lượt", [formatPrice(price)])}</p>
          <p className="font-display text-xl font-bold text-white num">{formatPrice(price * qty)}</p>
        </div>
        <button
          type="button"
          onClick={() => buy.mutate()}
          disabled={buy.isPending}
          className="ml-auto inline-flex h-11 items-center gap-2 rounded-sm bg-highlight px-5 font-bold text-on-solid transition-[filter] hover:brightness-110 disabled:opacity-60"
        >
          {buy.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
          {t("Mua {0} lượt", [qty])}
        </button>
      </div>
      <p className="mt-2 text-xs text-white/60">{t("Thanh toán bằng QR ngân hàng, mã quay được cấp tự động khi tiền về.")}</p>
    </div>
  );
}
