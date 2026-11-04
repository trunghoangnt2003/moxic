import { Copy, Check } from "lucide-react";
import { formatPrice, formatDate } from "../../lib/utils";
import { useState } from "react";
import type { OrderConfirmationItem } from "../../types/game";

import { t } from "../../lib/i18n";
interface Props {
  orderCode: string;
  items: OrderConfirmationItem[];
  totalAmount: number;
  createdAt: string;
  subtotalAmount?: number;
  discountAmount?: number;
  couponCode?: string | null;
}

/** Order summary card (code, lines, discount, total). */
export default function ConfirmationContent({ orderCode, items, totalAmount, createdAt, subtotalAmount, discountAmount = 0, couponCode }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(orderCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="bg-bg-surface border border-white/10">
      <div className="px-4 py-3 border-b border-white/10">
        <p className="text-[11px] text-text-muted">{t("Mã đơn hàng")}</p>
        <div className="flex items-center gap-2">
          <span className="font-mono text-base font-semibold text-text-primary truncate">{orderCode}</span>
          <button
            type="button"
            onClick={handleCopy}
            className="w-7 h-7 shrink-0 bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
            aria-label={t("Sao chép mã đơn hàng")}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-positive" /> : <Copy className="w-3.5 h-3.5 text-text-muted" />}
          </button>
        </div>
        <p className="text-text-muted text-xs">{formatDate(createdAt)}</p>
      </div>

      <ul className="px-4 py-3 space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start justify-between gap-3 text-sm">
            <span className="text-text-primary min-w-0">{item.gameName}</span>
            <span className="text-text-secondary shrink-0 tabular-nums">
              {item.listPrice && item.listPrice > item.price && <s className="text-text-muted text-xs mr-1.5">{formatPrice(item.listPrice)}</s>}
              {formatPrice(item.price)}
            </span>
          </li>
        ))}
      </ul>

      <div className="px-4 py-3 border-t border-white/10 space-y-1.5 text-sm">
        {discountAmount > 0 && (
          <>
            <div className="flex justify-between gap-3">
              <span className="text-text-muted">{t("Tạm tính")}</span>
              <span className="text-text-secondary tabular-nums">{formatPrice(subtotalAmount ?? totalAmount + discountAmount)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-text-muted truncate">
                {t("Giảm giá")}{couponCode ? <> (<span className="font-mono">{couponCode}</span>)</> : null}
              </span>
              <span className="text-positive font-semibold tabular-nums">−{formatPrice(discountAmount)}</span>
            </div>
          </>
        )}
        <div className="flex items-baseline justify-between gap-3 pt-1">
          <span className="text-text-secondary font-semibold">{t("Tổng cộng")}</span>
          <span className="font-display text-xl font-bold text-accent tabular-nums">{formatPrice(totalAmount)}</span>
        </div>
      </div>
    </div>
  );
}
