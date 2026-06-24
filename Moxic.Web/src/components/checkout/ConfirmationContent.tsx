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
    <div className="bg-[#252019] border border-[#3d352a] p-5 space-y-4">
      {/* Order Code */}
      <div>
        <p className="text-xs text-[#7a6f63] uppercase tracking-wider mb-1">Mã đơn hàng</p>
        <div className="flex items-center gap-2">
          <h2 className="font-display text-2xl text-[#c9a96e]">{orderCode}</h2>
          <button
            onClick={handleCopy}
            className="w-7 h-7 bg-[#c9a96e]/20 hover:bg-[#c9a96e]/30 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Sao chép mã đơn hàng"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-[#c9a96e]" />}
          </button>
        </div>
        <p className="text-[#7a6f63] text-xs mt-1">{formatDate(createdAt)}</p>
      </div>

      {/* Divider */}
      <div className="border-t border-[#3d352a]" />

      {/* Items */}
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className="text-sm text-[#ede6db]">{item.gameName}</span>
            <span className="text-sm text-[#b5a898]">{formatPrice(item.price)}</span>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="border-t border-[#3d352a]" />

      {/* Total */}
      <div className="flex items-center justify-between">
        <span className="text-[#b5a898] text-sm font-semibold">Tổng cộng</span>
        <span className="font-display text-xl text-[#c9a96e]">{formatPrice(totalAmount)}</span>
      </div>

      {/* Instruction */}
      <div className="bg-[#c9a96e]/5 border border-[#c9a96e]/10 px-4 py-3">
        <p className="text-xs text-[#b5a898] leading-relaxed">
          Vui lòng chuyển khoản đúng nội dung để đối soát. Nhân viên sẽ xác nhận và cài game trong 15-30 phút sau khi nhận được thanh toán.
        </p>
      </div>
    </div>
  );
}
