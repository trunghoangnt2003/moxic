import { Copy, Check } from "lucide-react";
import { formatPrice, formatDate } from "../../lib/utils";
import { useState } from "react";
import type { OrderConfirmationItem } from "../../types/game";

interface Props {
  orderCode: string;
  items: OrderConfirmationItem[];
  totalAmount: number;
  createdAt: string;
}

export default function ConfirmationContent({ orderCode, items, totalAmount, createdAt }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(orderCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="bg-bg-surface border border-border p-5 space-y-4">
      {/* Order Code */}
      <div>
        <p className="text-xs text-text-muted uppercase tracking-wider mb-1">M\u00e3 \u0111\u01a1n h\u00e0ng</p>
        <div className="flex items-center gap-2">
          <h2 className="font-display text-2xl text-accent">{orderCode}</h2>
          <button
            onClick={handleCopy}
            className="w-7 h-7 bg-accent/20 hover:bg-accent/30 flex items-center justify-center transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5 text-accent" />}
          </button>
        </div>
        <p className="text-text-muted text-xs mt-1">{formatDate(createdAt)}</p>
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Items */}
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className="text-sm text-text-primary">{item.gameName}</span>
            <span className="text-sm text-text-secondary">{formatPrice(item.price)}</span>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Total */}
      <div className="flex items-center justify-between">
        <span className="text-text-secondary text-sm font-semibold">T\u1ed5ng c\u1ed9ng</span>
        <span className="font-display text-xl text-accent">{formatPrice(totalAmount)}</span>
      </div>

      {/* Instruction */}
      <div className="bg-accent/5 border border-accent/10 px-4 py-3">
        <p className="text-xs text-text-secondary leading-relaxed">
          Vui l\u00f2ng chuy\u1ec3n kho\u1ea3n \u0111\u00fang n\u1ed9i dung \u0111\u1ec3 \u0111\u1ed1i so\u00e1t. Nh\u00e2n vi\u00ean s\u1ebd x\u00e1c nh\u1eadn v\u00e0 c\u00e0i game trong 15-30 ph\u00fat sau khi nh\u1eadn \u0111\u01b0\u1ee3c thanh to\u00e1n.
        </p>
      </div>
    </div>
  );
}
