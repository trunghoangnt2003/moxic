import SavedCallout from "../shared/SavedCallout";
import type { ReactNode } from "react";
import { formatPrice } from "../../lib/utils";
import type { CouponQuote } from "../../lib/couponApi";
import type { CartItem } from "../../types/game";

interface Props {
  items: CartItem[];
  total: number;
  /** Server-computed coupon preview; when set the totals show server numbers. */
  quote?: CouponQuote | null;
  /** Coupon input rendered between the item list and the totals. */
  couponSlot?: ReactNode;
}

export default function CartSummary({ items, total, quote, couponSlot }: Props) {
  return (
    <div className="bg-bg-surface border border-white/10 p-6 lg:sticky lg:top-20">
      <h3 className="text-xs text-text-muted uppercase tracking-widest font-semibold mb-4 pb-3 border-b border-white/10">
        Tóm tắt đơn hàng
      </h3>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.gameId} className="flex items-center gap-3 pb-3 border-b border-white/5 last:border-0">
            <img loading="lazy" decoding="async"
              src={item.coverImageUrl || ""}
              alt={item.name}
              className="w-16 h-9 object-cover flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text-primary font-semibold truncate">{item.name}</p>
            </div>
            <p className="text-text-secondary font-semibold text-sm">{formatPrice(item.price * item.quantity)}</p>
          </div>
        ))}
      </div>
      {couponSlot && <div className="pt-4 mt-1 border-t border-white/10">{couponSlot}</div>}
      {quote && (
        <div className="pt-4 mt-4 border-t border-white/10 space-y-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-text-muted">Tạm tính</span>
            <span className="text-text-secondary font-semibold">{formatPrice(quote.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate text-text-muted">
              Giảm giá (<span className="font-mono">{quote.code}</span>)
            </span>
            <span className="flex-shrink-0 font-semibold text-green-400">−{formatPrice(quote.discountAmount)}</span>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between pt-5 mt-4 border-t border-white/10">
        <span className="text-text-muted text-sm font-semibold uppercase tracking-wider">Tổng cộng</span>
        <span className="font-display text-xl text-accent font-bold">{formatPrice(quote ? quote.total : total)}</span>
      </div>
      {(() => {
        const list = items.reduce((s, i) => s + (i.originalPrice || i.price) * i.quantity, 0);
        const saved = list - (quote ? quote.total : total);
        return saved > 0 ? (
          <div className="mt-3">
            <SavedCallout amount={saved} compact />
          </div>
        ) : null;
      })()}
    </div>
  );
}
