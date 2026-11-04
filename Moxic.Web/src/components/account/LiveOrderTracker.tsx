import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, CreditCard, Download, LogIn, PartyPopper, Receipt, XCircle } from "lucide-react";
import { confetti, haptic } from "../../lib/fx";

export interface TrackerOrder {
  orderCode: string;
  status: string;
  createdAt: string;
  paidAt?: string | null;
  installStartedAt?: string | null;
  downloadingAt?: string | null;
  completedAt?: string | null;
}

const STEPS = [
  { label: "Đặt hàng", icon: Receipt },
  { label: "Đã nhận tiền", icon: CreditCard },
  { label: "Đăng nhập Xbox", icon: LogIn },
  { label: "Đang tải game", icon: Download },
  { label: "Xong", icon: PartyPopper },
] as const;

/** Index of the last completed step (0..4). */
function reached(o: TrackerOrder) {
  if (o.status === "Completed") return 4;
  if (o.status === "Installing") return o.downloadingAt ? 3 : 2;
  if (o.status === "Verifying" || o.status === "ActionRequired") return 1;
  return 0;
}

const hhmm = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "");

function since(iso: string | null | undefined, now: number) {
  if (!iso) return "";
  const m = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (m < 1) return "vừa xong";
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} giờ trước` : `${Math.floor(h / 24)} ngày trước`;
}

/**
 * Delivery-style live tracker: "Đã nhận tiền → Đăng nhập Xbox → Đang tải game → Xong 🎉".
 * The parent keeps polling the order; this animates each step as it lands and celebrates completion.
 */
export default function LiveOrderTracker({ order }: { order: TrackerOrder }) {
  const step = reached(order);
  const cancelled = order.status === "Cancelled";
  const action = order.status === "ActionRequired";
  const done = order.status === "Completed";
  const [now, setNow] = useState(() => Date.now());
  const prevStep = useRef<number | null>(null);

  useEffect(() => {
    if (done || cancelled) return;
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, [done, cancelled]);

  // Celebrate: when completion happens while watching, or the first visit within a day after it.
  useEffect(() => {
    const prev = prevStep.current;
    prevStep.current = step;
    if (prev != null && step > prev) haptic([15, 40, 15]);
    if (!done) return;
    const key = `moxic.celebrated.${order.orderCode}`;
    let seen = false;
    try {
      seen = localStorage.getItem(key) === "1";
      localStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
    const fresh = order.completedAt && Date.now() - new Date(order.completedAt).getTime() < 86_400_000;
    if ((prev != null && prev < 4) || (!seen && fresh)) {
      window.setTimeout(() => confetti(), 250);
      haptic([30, 60, 30, 60, 80]);
    }
  }, [step, done, order.orderCode, order.completedAt]);

  const times = [order.createdAt, order.paidAt, order.installStartedAt, order.downloadingAt, order.completedAt];
  const pct = cancelled ? 0 : (step / (STEPS.length - 1)) * 100;

  const headline = cancelled
    ? { emoji: "❌", title: "Đơn đã bị hủy", sub: "Liên hệ Moxic nếu bạn cần hỗ trợ." }
    : action
      ? { emoji: "⚠️", title: "Cần bạn kiểm tra tài khoản Xbox", sub: "Thông tin đăng nhập chưa đúng — cập nhật để Moxic cài tiếp." }
      : [
          { emoji: "🧾", title: "Chờ thanh toán", sub: "Quét QR để thanh toán — hệ thống tự nhận diện khi tiền về." },
          { emoji: "💸", title: "Đã nhận tiền!", sub: "Moxic sắp đăng nhập Xbox của bạn để cài game. Thường xong trong 15–30 phút." },
          { emoji: "🔐", title: "Đang đăng nhập Xbox", sub: "Vui lòng KHÔNG đăng nhập tài khoản Xbox lúc này để tránh bị văng." },
          { emoji: "⬇️", title: "Đang tải game", sub: "Game đang được thêm vào thư viện của bạn. Sắp xong rồi!" },
          { emoji: "🎉", title: "Xong! Game đã vào tài khoản", sub: "Mở Xbox → Thư viện để tải về và chơi thôi. Chúc vui!" },
        ][step];

  const lastAt = times[step];

  return (
    <div className="relative overflow-hidden border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent p-4 sm:p-5">
      {/* Headline */}
      <div className="flex items-start gap-3" aria-live="polite">
        <span key={`${order.status}-${step}`} className="text-3xl leading-none animate-[popIn_0.4s_ease-out]">
          {headline.emoji}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-display text-lg font-bold leading-tight">{headline.title}</p>
          <p className="text-sm text-text-secondary mt-0.5">{headline.sub}</p>
        </div>
        {!done && !cancelled && step > 0 && (
          <span className="shrink-0 inline-flex items-center gap-1.5 text-[11px] text-emerald-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Trực tiếp
          </span>
        )}
      </div>

      {/* Progress */}
      <div className="relative mt-6 mb-1 px-3 sm:px-4">
        <div className="absolute left-3 right-3 sm:left-4 sm:right-4 top-4 h-1 rounded-full bg-white/10" />
        <div
          className={`absolute left-3 sm:left-4 top-4 h-1 rounded-full transition-[width] duration-1000 ease-out ${action ? "bg-orange-400" : "bg-gradient-to-r from-emerald-500 to-accent"}`}
          style={{ width: `calc((100% - 1.5rem) * ${pct / 100})` }}
        />
        <ol className="relative flex justify-between">
          {STEPS.map((s, i) => {
            const isDone = !cancelled && i <= step;
            const isNext = !cancelled && !done && i === step + 1;
            const warn = action && i === 2;
            const Icon = warn ? AlertTriangle : isDone && i < 4 ? Check : s.icon;
            return (
              <li key={s.label} className="flex flex-col items-center w-0 grow">
                <span
                  className={`relative z-10 w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
                    warn
                      ? "border-orange-400 bg-orange-500/20 text-orange-300"
                      : isDone
                        ? i === 4
                          ? "border-accent bg-accent text-bg-base scale-110 shadow-[0_0_20px_rgba(201,169,110,.6)]"
                          : "border-emerald-400 bg-emerald-500 text-bg-base"
                        : isNext
                          ? "border-accent bg-bg-base text-accent"
                          : "border-white/15 bg-bg-base text-text-muted"
                  }`}
                >
                  {isNext && <span className="absolute inset-0 rounded-full border-2 border-accent animate-ping opacity-60 motion-reduce:hidden" />}
                  <Icon className="w-4 h-4" />
                </span>
                <span className={`mt-2 text-[10px] sm:text-xs text-center leading-tight ${isDone || isNext ? "text-white font-semibold" : "text-text-muted"}`}>
                  {warn ? "Cần xử lý" : s.label}
                </span>
                <span className="text-[10px] text-text-muted h-3">{isDone ? hhmm(times[i]) : ""}</span>
              </li>
            );
          })}
        </ol>
        {cancelled && (
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-red-300">
            <XCircle className="w-4 h-4" /> Đơn đã hủy
          </p>
        )}
      </div>

      {!done && !cancelled && step > 0 && lastAt && (
        <p className="mt-3 text-center text-[11px] text-text-muted">
          Cập nhật {since(lastAt, now)} · trang tự cập nhật, không cần tải lại
        </p>
      )}
    </div>
  );
}
