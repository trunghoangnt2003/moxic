import SavedCallout from "../shared/SavedCallout";
import type { ReactNode } from "react";
import { formatPrice } from "../../lib/utils";
import type { CouponQuote } from "../../lib/couponApi";
import type { CartItem } from "../../types/game";

import { t } from "../../lib/i18n";
interface Props {
  items: CartItem[];
  total: number;
  /** Server-computed coupon preview; when set the totals show server numbers. */
  quote?: CouponQuote | null;
  /** Coupon input rendered between the item list and the totals. */
  couponSlot?: ReactNode;
}

export default function CartSummary({ items, total, quote, couponSlot }: Props) {
  const list = items.reduce((s, i) => s + (i.originalPrice || i.price) * i.quantity, 0);
  const pay = quote ? quote.total : total;
  const saved = list - pay;

  return (
    <aside className="bg-bg-surface border border-white/10 p-5 sm:p-6 lg:sticky lg:top-20">
      <h2 className="font-display text-lg font-semibold text-text-primary">{t("Đơn hàng của bạn")}</h2>

      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={`${item.gameId}-${item.editionId ?? ""}`} className="flex items-center gap-3">
            <img loading="lazy" decoding="async" src={item.coverImageUrl || ""} alt="" className="w-20 aspect-video object-cover shrink-0 bg-bg-elevated" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text-primary font-medium line-clamp-2 leading-snug">{item.name}</p>
              {(item.editionName || item.quantity > 1) && (
                <p className="text-xs text-text-muted mt-0.5">
                  {item.editionName}
                  {item.editionName && item.quantity > 1 ? ", " : ""}
                  {item.quantity > 1 ? t("số lượng {0}", [item.quantity]) : ""}
                </p>
              )}
            </div>
            <p className="text-sm text-text-primary font-semibold num shrink-0">{formatPrice(item.price * item.quantity)}</p>
          </li>
        ))}
      </ul>

      {couponSlot && <div className="mt-5">{couponSlot}</div>}

      <dl className="mt-5 pt-5 border-t border-white/10 space-y-2.5 text-sm">
        {quote ? (
          <>
            <div className="flex justify-between gap-3">
              <dt className="text-text-secondary">{t("Tạm tính")}</dt>
              <dd className="text-text-primary num">{formatPrice(quote.subtotal)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="min-w-0 truncate text-text-secondary">
                {t("Mã")} <span className="font-mono">{quote.code}</span>
              </dt>
              <dd className="shrink-0 text-positive num">-{formatPrice(quote.discountAmount)}</dd>
            </div>
          </>
        ) : (
          <div className="flex justify-between gap-3">
            <dt className="text-text-secondary">{t("Tạm tính")}</dt>
            <dd className="text-text-primary num">{formatPrice(total)}</dd>
          </div>
        )}
      </dl>

      <div className="mt-4 pt-4 border-t border-white/10 flex items-baseline justify-between gap-3">
        <span className="text-text-secondary">{t("Tổng cộng")}</span>
        <span className="font-display text-2xl sm:text-3xl text-accent font-bold num">{formatPrice(pay)}</span>
      </div>
      {saved > 0 && (
        <div className="mt-3">
          <SavedCallout amount={saved} compact />
        </div>
      )}
    </aside>
  );
}
