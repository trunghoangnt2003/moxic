import { ShoppingCart } from "lucide-react";
import { formatPrice } from "../../lib/utils";
import type { CartItem } from "../../types/game";

interface Props {
  items: CartItem[];
  total: number;
}

export default function CartSummary({ items, total }: Props) {
  return (
    <div className="bg-bg-surface border border-border p-5">
      <h3 className="font-display text-sm text-text-primary uppercase tracking-wider mb-4">
        Gi\u1ecf h\u00e0ng c\u1ee7a b\u1ea1n
      </h3>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.gameId} className="flex items-center gap-3 pb-3 border-b border-border/50 last:border-0">
            <img
              src={item.coverImageUrl || ""}
              alt={item.name}
              className="w-12 h-12 object-cover flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text-primary font-semibold truncate">{item.name}</p>
              <p className="text-xs text-text-muted">S\u1ed1 l\u01b0\u1ee3ng: {item.quantity}</p>
            </div>
            <p className="text-accent font-semibold text-sm">{formatPrice(item.price * item.quantity)}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between pt-4 mt-2 border-t border-border">
        <span className="text-text-secondary text-sm">T\u1ed5ng c\u1ed9ng</span>
        <span className="font-display text-xl text-accent">{formatPrice(total)}</span>
      </div>
    </div>
  );
}
