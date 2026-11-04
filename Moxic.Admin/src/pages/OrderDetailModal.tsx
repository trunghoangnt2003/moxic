import { useEffect, useState } from "react";
import {
  X,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  Ban,
  CheckCircle2,
} from "lucide-react";
import { apiFetch, apiUrl } from "../lib/api";

interface OrderDetailItem {
  gameName: string;
  price: number;
}

interface OrderDetail {
  id: string;
  orderCode: string;
  customerPhone: string;
  customerXboxEmail: string;
  customerXboxPassword: string;
  customerZalo?: string;
  totalAmount: number;
  subtotalAmount?: number;
  discountAmount?: number;
  couponCode?: string | null;
  status: string;
  paymentMethod: string;
  notes?: string;
  items: OrderDetailItem[];
  paymentProofUrl?: string | null;
  cancellationReason?: string | null;
  createdAt: string;
  updatedAt: string;
  isGift?: boolean;
  giftFromName?: string | null;
  giftRecipientName?: string | null;
  giftMessage?: string | null;
  giftRecipientPhone?: string | null;
  giftClaimedAt?: string | null;
}

const formatPrice = (n: number) => n.toLocaleString() + "₫";

const statusBadge = (status: string, large = false) => {
  const styles: Record<string, string> = {
    Pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    AwaitingConfirmation: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    Verifying: "bg-steam-blue/10 text-steam-blue border-steam-blue/20",
    Installing: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    Completed: "bg-steam-green/10 text-steam-green border-steam-green/20",
    Cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  const s = styles[status] || "bg-steam-surface-3 text-steam-muted border-steam-border";
  const size = large ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-[11px]";
  return (
    <span className={`inline-flex items-center gap-1 ${size} rounded font-medium border ${s}`}>
      {status}
    </span>
  );
};

interface Props {
  orderId: string;
  onClose: () => void;
  onStatusChange: () => void;
}

export default function OrderDetailModal({ orderId, onClose, onStatusChange }: Props) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [transitioning, setTransitioning] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError("");
    apiFetch(apiUrl(`/api/admin/orders/${orderId}`))
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then(setOrder)
      .catch(() => setError("Failed to load order detail"))
      .finally(() => setLoading(false));
  }, [orderId]);

  const handleStatusTransition = async (newStatus: string) => {
    if (newStatus === "Cancelled" && !rejectReason) {
      setShowRejectInput(true);
      return;
    }
    const msg = newStatus === "Cancelled"
      ? `Reject order "${order?.orderCode}"? Reason: ${rejectReason}`
      : `Change status to "${newStatus}"?`;
    if (!window.confirm(msg)) return;
    setTransitioning(newStatus);
    try {
      const body: any = { status: newStatus };
      if (newStatus === "Cancelled" && rejectReason) body.reason = rejectReason;
      const res = await apiFetch(apiUrl(`/api/admin/orders/${orderId}/status`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to update status");
        return;
      }
      onStatusChange();
    } finally {
      setTransitioning(null);
    }
  };

  const getActions = () => {
    if (!order) return [];
    switch (order.status) {
      case "Pending":
        return [
          { label: "Received Payment", status: "Verifying", color: "bg-steam-blue text-black hover:bg-steam-blue-hover", icon: ArrowRight },
          { label: "Cancel", status: "Cancelled", color: "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20", icon: Ban },
        ];
      case "AwaitingConfirmation":
        return [
          { label: "Verify", status: "Verifying", color: "bg-steam-blue text-black hover:bg-steam-blue-hover", icon: CheckCircle2 },
          { label: "Reject", status: "Cancelled", color: "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20", icon: Ban },
        ];
      case "Verifying":
        return [
          { label: "Installing", status: "Installing", color: "bg-orange-500/10 text-orange-400 border border-orange-500/30 hover:bg-orange-500/20", icon: ArrowRight },
          { label: "Cancel", status: "Cancelled", color: "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20", icon: Ban },
        ];
      case "Installing":
        return [
          { label: "Completed", status: "Completed", color: "bg-steam-green text-black hover:bg-steam-green/80", icon: ArrowRight },
        ];
      default:
        return [];
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-steam-surface border border-steam-border rounded-t sm:rounded max-w-2xl w-full mx-0 sm:mx-4 max-h-[90vh] sm:max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <div className="py-12 md:py-16 text-center">
            <Loader2 size={28} className="mx-auto mb-3 text-steam-muted animate-spin" />
            <p className="text-sm text-steam-muted">Loading order detail...</p>
          </div>
        ) : error ? (
          <div className="py-12 md:py-16 text-center px-4">
            <p className="text-sm text-steam-muted">{error}</p>
            <button onClick={onClose} className="mt-4 steam-btn bg-steam-blue text-black">Close</button>
          </div>
        ) : order ? (
          <>
            <div className="flex items-center justify-between px-4 md:px-5 py-4 border-b border-steam-border sticky top-0 bg-steam-surface z-10">
              <div className="flex items-center gap-2 md:gap-3 min-w-0">
                <h2 className="text-sm md:text-base font-bold text-white font-mono truncate">{order.orderCode}</h2>
                {statusBadge(order.status, true)}
              </div>
              <button onClick={onClose} className="p-1.5 rounded text-steam-muted hover:text-steam-text hover:bg-steam-surface-3 transition-colors flex-shrink-0">
                <X size={16} />
              </button>
            </div>

            <div className="p-4 md:p-5 space-y-4 md:space-y-5">
              {/* Items */}
              <div>
                <h3 className="text-xs font-semibold text-steam-muted uppercase tracking-wider mb-2">Items</h3>
                <div className="space-y-1">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-steam-text truncate">{item.gameName}</span>
                      <span className="text-steam-gold font-mono flex-shrink-0">{formatPrice(item.price)}</span>
                    </div>
                  ))}
                </div>
                {(order.discountAmount ?? 0) > 0 && (
                  <div className="pt-2 mt-2 border-t border-steam-border space-y-1 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-steam-muted">Subtotal</span>
                      <span className="text-steam-text font-mono">
                        {formatPrice(order.subtotalAmount ?? order.totalAmount + (order.discountAmount ?? 0))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-steam-muted truncate">
                        Discount{order.couponCode ? <> (<span className="font-mono">{order.couponCode}</span>)</> : null}
                      </span>
                      <span className="text-steam-green font-mono flex-shrink-0">−{formatPrice(order.discountAmount ?? 0)}</span>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 mt-2 border-t border-steam-border">
                  <span className="text-sm font-semibold text-white">Total</span>
                  <span className="text-base font-bold text-steam-gold font-mono">{formatPrice(order.totalAmount)}</span>
                </div>
              </div>

              {order.isGift && (
                <div className={`rounded-lg border px-3 py-2.5 text-sm space-y-1 ${order.giftClaimedAt ? "border-pink-500/30 bg-pink-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
                  <p className="font-semibold text-white">🎁 Đơn quà tặng</p>
                  <p className="text-steam-muted text-xs">
                    Từ <b className="text-steam-text">{order.giftFromName || "—"}</b> → <b className="text-steam-text">{order.giftRecipientName || "—"}</b>
                  </p>
                  {order.giftMessage && <p className="text-xs text-steam-text italic whitespace-pre-line">“{order.giftMessage}”</p>}
                  {order.giftClaimedAt ? (
                    <p className="text-xs text-pink-300">
                      Người nhận đã nhập Xbox lúc {new Date(order.giftClaimedAt).toLocaleString("vi-VN")}
                      {order.giftRecipientPhone ? ` · SĐT/Zalo người nhận: ${order.giftRecipientPhone}` : ""}
                    </p>
                  ) : (
                    <p className="text-xs text-amber-300">Người nhận chưa mở quà — chưa có tài khoản Xbox để cài. SĐT bên dưới là của người tặng.</p>
                  )}
                </div>
              )}

              {/* Customer Info */}
              <div>
                <h3 className="text-xs font-semibold text-steam-muted uppercase tracking-wider mb-2">Customer Info</h3>
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-steam-muted flex-shrink-0">Phone</span>
                    <span className="text-steam-text text-right break-all">{order.customerPhone}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-steam-muted flex-shrink-0">Xbox Email</span>
                    <span className="text-steam-text text-right break-all">{order.customerXboxEmail}</span>
                  </div>
                  <div className="flex justify-between gap-2 items-center">
                    <span className="text-steam-muted flex-shrink-0">Xbox Pass</span>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-steam-text font-mono text-xs truncate">
                        {showPassword ? order.customerXboxPassword : "•••••••••"}
                      </span>
                      <button
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-1 rounded text-steam-muted hover:text-steam-blue hover:bg-steam-blue/10 transition-colors flex-shrink-0"
                        title={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                  </div>
                  {order.customerZalo && (
                    <div className="flex justify-between gap-2">
                      <span className="text-steam-muted flex-shrink-0">Zalo/FB</span>
                      <span className="text-steam-text text-right break-all">{order.customerZalo}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-2">
                    <span className="text-steam-muted flex-shrink-0">Payment</span>
                    <span className="text-steam-text text-right">{order.paymentMethod}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-steam-muted flex-shrink-0">Date</span>
                    <span className="text-steam-text text-right">{new Date(order.createdAt).toLocaleString("vi-VN")}</span>
                  </div>
                </div>
              </div>

              {/* Payment Proof */}
              {order.paymentProofUrl && (
                <div>
                  <h3 className="text-xs font-semibold text-steam-muted uppercase tracking-wider mb-2">Payment Proof</h3>
                  <img
                    src={order.paymentProofUrl}
                    alt="Payment proof"
                    className="w-full max-w-md rounded border border-steam-border bg-white"
                  />
                </div>
              )}

              {/* Cancellation Reason */}
              {order.cancellationReason && (
                <div>
                  <h3 className="text-xs font-semibold text-steam-muted uppercase tracking-wider mb-2">Cancellation Reason</h3>
                  <p className="text-sm text-red-400 bg-red-500/10 rounded p-3 border border-red-500/20">{order.cancellationReason}</p>
                </div>
              )}

              {/* Notes */}
              {order.notes && (
                <div>
                  <h3 className="text-xs font-semibold text-steam-muted uppercase tracking-wider mb-2">Notes</h3>
                  <p className="text-sm text-steam-text bg-steam-surface-3 rounded p-3 border border-steam-border">{order.notes}</p>
                </div>
              )}

              {/* Reject reason input */}
              {showRejectInput && (
                <div>
                  <h3 className="text-xs font-semibold text-steam-muted uppercase tracking-wider mb-2">Rejection Reason</h3>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="w-full steam-input h-20 resize-none"
                    placeholder="Enter reason for rejection..."
                  />
                  <div className="flex flex-col sm:flex-row gap-2 mt-2">
                    <button
                      onClick={() => handleStatusTransition("Cancelled")}
                      disabled={!rejectReason || transitioning !== null}
                      className="steam-btn bg-red-500 text-white disabled:opacity-50 justify-center"
                    >
                      {transitioning === "Cancelled" ? <Loader2 size={12} className="animate-spin" /> : null}
                      Confirm Reject
                    </button>
                    <button
                      onClick={() => { setShowRejectInput(false); setRejectReason(""); }}
                      className="steam-btn bg-steam-surface-3 text-steam-muted justify-center"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            {!showRejectInput && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 px-4 md:px-5 py-4 border-t border-steam-border bg-steam-bg/30">
                {getActions().map((action) => (
                  <button
                    key={action.status}
                    onClick={() => handleStatusTransition(action.status)}
                    disabled={transitioning !== null}
                    className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded text-xs font-medium transition-all ${action.color} disabled:opacity-50`}
                  >
                    {transitioning === action.status ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <action.icon size={12} />
                    )}
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
