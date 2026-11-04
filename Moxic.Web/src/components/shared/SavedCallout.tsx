import { PiggyBank } from "lucide-react";
import { formatPrice } from "../../lib/utils";
import ShareButton from "./ShareButton";

import { t } from "../../lib/i18n";
interface Props {
  amount: number;
  /** e.g. "cho đơn này", "từ trước tới giờ" */
  suffix?: string;
  share?: boolean;
  compact?: boolean;
}

/** "Bạn đã tiết kiệm 1.240.000đ so với Xbox Store", the core Moxic promise, made visible. */
export default function SavedCallout({ amount, suffix, share = false, compact = false }: Props) {
  if (!amount || amount <= 0) return null;
  const text = t("Mình vừa tiết kiệm {0} so với Xbox Store khi mua game ở Moxic GameStore 😎", [formatPrice(amount)]);
  if (compact)
    return (
      <p className="flex items-center gap-1.5 text-sm text-positive">
        <PiggyBank className="w-4 h-4 shrink-0" /> {t("Tiết kiệm")} <b>{formatPrice(amount)}</b> {t("so với Xbox Store")}
      </p>
    );
  return (
    <div className="relative overflow-hidden border border-positive/30 bg-gradient-to-r from-positive/15 via-positive/5 to-transparent p-4 flex flex-wrap items-center gap-3">
      <PiggyBank className="absolute -right-3 -bottom-4 w-24 h-24 text-positive/10" />
      <div className="w-11 h-11 rounded-full bg-positive/20 flex items-center justify-center shrink-0">
        <PiggyBank className="w-6 h-6 text-positive" />
      </div>
      <div className="flex-1 min-w-[180px]">
        <p className="text-xs text-positive/80">{t("Bạn đã tiết kiệm{0}", [suffix ? ` ${suffix}` : ""])}</p>
        <p className="font-display text-2xl font-extrabold text-positive leading-tight">{formatPrice(amount)}</p>
        <p className="text-[11px] text-text-muted">{t("so với giá Xbox Store chính hãng")}</p>
      </div>
      {share && <ShareButton path="/" title={t("Moxic GameStore, game Xbox rẻ hơn Store")} text={text} label="Khoe ngay" className="w-36" />}
    </div>
  );
}
