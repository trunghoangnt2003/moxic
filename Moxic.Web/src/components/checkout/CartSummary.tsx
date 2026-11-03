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
    <div className="bg-[#252019] border border-[#3d352a] p-6 lg:sticky lg:top-20">
      <h3 className="text-xs text-[#7a6f63] uppercase tracking-widest font-semibold mb-4 pb-3 border-b border-[#3d352a]">
        Tóm tắt đơn hàng
      </h3>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.gameId} className="flex items-center gap-3 pb-3 border-b border-[#3d352a]/50 last:border-0">
            <img
              src={item.coverImageUrl || ""}
              alt={item.name}
              className="w-16 h-9 object-cover flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[#ede6db] font-semibold truncate">{item.name}</p>
            </div>
            <p className="text-[#b5a898] font-semibold text-sm">{formatPrice(item.price * item.quantity)}</p>
          </div>
        ))}
      </div>
      {couponSlot && <div className="pt-4 mt-1 border-t border-[#3d352a]">{couponSlot}</div>}
      {quote && (
        <div className="pt-4 mt-4 border-t border-[#3d352a] space-y-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[#7a6f63]">Tạm tính</span>
            <span className="text-[#b5a898] font-semibold">{formatPrice(quote.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate text-[#7a6f63]">
              Giảm giá (<span className="font-mono">{quote.code}</span>)
            </span>
            <span className="flex-shrink-0 font-semibold text-green-400">−{formatPrice(quote.discountAmount)}</span>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between pt-5 mt-4 border-t border-[#3d352a]">
        <span className="text-[#7a6f63] text-sm font-semibold uppercase tracking-wider">Tổng cộng</span>
        <span className="font-display text-xl text-[#c9a96e] font-bold">{formatPrice(quote ? quote.total : total)}</span>
      </div>
    </div>
  );
}
