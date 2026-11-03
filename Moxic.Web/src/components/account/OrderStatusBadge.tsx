import { ORDER_STATUS_LABELS, ORDER_STATUS_STYLES, type OrderStatus } from "../../lib/accountApi";

const NEUTRAL = "bg-white/5 text-[#b5a898] border-[#3d352a]";

export default function OrderStatusBadge({ status }: { status: string }) {
  const known = status in ORDER_STATUS_LABELS;
  const label = known ? ORDER_STATUS_LABELS[status as OrderStatus] : status;
  const style = known ? ORDER_STATUS_STYLES[status as OrderStatus] : NEUTRAL;

  return (
    <span className={`inline-flex items-center border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${style}`}>
      {label}
    </span>
  );
}
