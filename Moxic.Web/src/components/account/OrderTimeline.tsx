import { AlertTriangle, Check, CreditCard, PackageCheck, ScanSearch, Wrench, XCircle } from "lucide-react";

const STEPS = [
  { key: "Pending", label: "Đặt hàng", icon: CreditCard },
  { key: "AwaitingConfirmation", label: "Đã chuyển khoản", icon: CreditCard },
  { key: "Verifying", label: "Xác nhận thanh toán", icon: ScanSearch },
  { key: "Installing", label: "Đang cài đặt", icon: Wrench },
  { key: "Completed", label: "Hoàn tất", icon: PackageCheck },
] as const;

/** Visual progress of an order; ActionRequired/Cancelled show as an interruption on the current step. */
export default function OrderTimeline({ status }: { status: string }) {
  const cancelled = status === "Cancelled";
  const action = status === "ActionRequired";
  const reached = action ? STEPS.findIndex((s) => s.key === "Installing") : STEPS.findIndex((s) => s.key === status);
  const current = cancelled ? -1 : reached;

  return (
    <ol className="flex items-start" aria-label="Tiến trình đơn hàng">
      {STEPS.map((s, i) => {
        const done = !cancelled && i < current;
        const active = !cancelled && i === current;
        const Icon = active && action ? AlertTriangle : done || (active && status === "Completed") ? Check : s.icon;
        const tone =
          active && action
            ? "border-orange-400 bg-orange-500/15 text-orange-300"
            : done || (active && status === "Completed")
              ? "border-emerald-400 bg-emerald-500 text-bg-base"
              : active
                ? "border-accent bg-accent/15 text-accent animate-pulse motion-reduce:animate-none"
                : "border-white/15 text-text-muted";
        return (
          <li key={s.key} className="flex-1 flex flex-col items-center text-center relative">
            {i > 0 && <span className={`absolute top-4 right-1/2 w-full h-0.5 -z-0 ${done || active ? "bg-emerald-500/70" : "bg-white/10"}`} />}
            <span className={`relative z-10 w-8 h-8 rounded-full border-2 flex items-center justify-center ${tone}`}>
              <Icon className="w-4 h-4" />
            </span>
            <span className={`mt-1.5 text-[10px] sm:text-xs leading-tight px-0.5 ${active ? "text-white font-semibold" : done ? "text-text-secondary" : "text-text-muted"}`}>
              {active && action ? "Cần bạn xử lý" : s.label}
            </span>
          </li>
        );
      })}
      {cancelled && (
        <li className="flex flex-col items-center text-center">
          <span className="w-8 h-8 rounded-full border-2 border-red-400 bg-red-500/15 text-red-300 flex items-center justify-center">
            <XCircle className="w-4 h-4" />
          </span>
          <span className="mt-1.5 text-[10px] sm:text-xs text-red-300 font-semibold">Đã hủy</span>
        </li>
      )}
    </ol>
  );
}
