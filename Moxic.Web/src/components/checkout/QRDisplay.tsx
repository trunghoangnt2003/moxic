import { useState } from "react";
import { Copy, Check, Banknote, Bitcoin } from "lucide-react";
import { formatPrice } from "../../lib/utils";

interface Props {
  bankQrUrl?: string | null;
  cryptoQrUrl?: string | null;
  transferContent: string;
  /** Amount to transfer (already discounted). */
  amount?: number;
  /** Show the "Đã trừ mã giảm giá" hint. */
  discounted?: boolean;
  /** Per-order QR + bank webhook: payment is confirmed automatically. */
  autoConfirm?: boolean;
}

export default function QRDisplay({ bankQrUrl, cryptoQrUrl, transferContent, amount, discounted, autoConfirm }: Props) {
  const [mode, setMode] = useState<"bank" | "crypto">("bank");
  const [copied, setCopied] = useState(false);
  const [amountCopied, setAmountCopied] = useState(false);

  const handleCopyAmount = async () => {
    if (amount == null) return;
    try {
      await navigator.clipboard.writeText(String(Math.round(amount)));
      setAmountCopied(true);
      setTimeout(() => setAmountCopied(false), 2000);
    } catch {}
  };

  const qrUrl = mode === "bank" ? bankQrUrl : cryptoQrUrl;
  const hasCrypto = !!cryptoQrUrl;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(transferContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="bg-[#252019] border border-[#3d352a] p-5">
      {/* Tabs */}
      <div className="flex mb-5 border border-[#3d352a] overflow-hidden">
        <button
          onClick={() => setMode("bank")}
          className={`flex-1 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${mode === "bank" ? "text-[#c9a96e] border-b-2 border-[#c9a96e] bg-[#c9a96e]/5" : "text-[#7a6f63] hover:text-[#b5a898]"}`}
        >
          <Banknote className="w-4 h-4" /> Chuyển khoản
        </button>
        <button
          onClick={() => setMode("crypto")}
          className={`flex-1 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${mode === "crypto" ? "text-[#c9a96e] border-b-2 border-[#c9a96e] bg-[#c9a96e]/5" : "text-[#7a6f63] hover:text-[#b5a898]"}`}
          style={!hasCrypto ? { pointerEvents: "none", opacity: 0.4 } : {}}
        >
          <Bitcoin className="w-4 h-4" /> USDT/BTC
        </button>
      </div>

      {/* QR Image */}
      <div className="flex justify-center mb-4">
        {qrUrl ? (
          <img
            src={qrUrl}
            alt={`Mã QR ${mode === "bank" ? "ngân hàng" : "crypto"}`}
            className="max-w-[280px] w-full aspect-square object-contain bg-white p-2"
          />
        ) : (
          <div className="max-w-[280px] w-full aspect-square bg-[#2d261e] flex items-center justify-center border border-dashed border-[#3d352a]">
            <p className="text-[#7a6f63] text-xs">
              {mode === "bank" ? "Chưa có mã QR ngân hàng" : "Chưa có mã QR Crypto"}
            </p>
          </div>
        )}
      </div>

      {autoConfirm && mode === "bank" && (
        <p className="mb-4 flex items-center justify-center gap-2 text-xs text-emerald-300">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          QR đã điền sẵn số tiền & nội dung — tự xác nhận khi tiền về
        </p>
      )}

      {/* Amount */}
      {amount != null && (
        <div className="mb-2 bg-[#c9a96e]/10 border border-[#c9a96e]/20 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] text-[#7a6f63] uppercase tracking-wider mb-0.5">Số tiền cần chuyển</p>
              <p className="text-[#c9a96e] font-display text-lg font-bold">{formatPrice(amount)}</p>
              {discounted && <p className="text-[11px] text-green-400">Đã trừ mã giảm giá</p>}
            </div>
            <button
              onClick={handleCopyAmount}
              className="flex-shrink-0 w-8 h-8 bg-[#c9a96e]/20 hover:bg-[#c9a96e]/30 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Sao chép số tiền cần chuyển"
            >
              {amountCopied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-[#c9a96e]" />}
            </button>
          </div>
        </div>
      )}

      {/* Transfer content */}
      <div className="bg-[#c9a96e]/10 border border-[#c9a96e]/20 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] text-[#7a6f63] uppercase tracking-wider mb-0.5">
              Nội dung chuyển khoản
            </p>
            <p className="text-[#c9a96e] font-mono text-sm font-semibold truncate">
              {transferContent}
            </p>
          </div>
          <button
            onClick={handleCopy}
            className="flex-shrink-0 w-8 h-8 bg-[#c9a96e]/20 hover:bg-[#c9a96e]/30 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Sao chép nội dung chuyển khoản"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : (
              <Copy className="w-4 h-4 text-[#c9a96e]" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
