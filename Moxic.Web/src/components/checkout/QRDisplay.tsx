import { useState } from "react";
import { Copy, Check, Banknote, Bitcoin } from "lucide-react";
import { formatPrice } from "../../lib/utils";

import { t } from "../../lib/i18n";
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
    <div>
      {/* Tabs (only when crypto is offered) */}
      <div className={`flex mb-5 border border-white/10 overflow-hidden ${hasCrypto ? "" : "hidden"}`}>
        <button
          onClick={() => setMode("bank")}
          className={`flex-1 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${mode === "bank" ? "text-accent border-b-2 border-accent bg-accent/5" : "text-text-muted hover:text-text-secondary"}`}
        >
          <Banknote className="w-4 h-4" /> {t("Chuyển khoản")}
        </button>
        <button
          onClick={() => setMode("crypto")}
          className={`flex-1 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${mode === "crypto" ? "text-accent border-b-2 border-accent bg-accent/5" : "text-text-muted hover:text-text-secondary"}`}
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
            alt={`Mã QR ${mode === "bank" ? t("ngân hàng") : "crypto"}`}
            className="max-w-[260px] w-full aspect-square object-contain bg-white p-3 rounded-2xl shadow-xl shadow-accent/10"
          />
        ) : (
          <div className="max-w-[260px] w-full aspect-square bg-bg-elevated rounded-2xl flex items-center justify-center border border-dashed border-white/10">
            <p className="text-text-muted text-xs">
              {mode === "bank" ? t("Chưa có mã QR ngân hàng") : t("Chưa có mã QR Crypto")}
            </p>
          </div>
        )}
      </div>

      {autoConfirm && mode === "bank" && (
        <p className="mb-4 flex items-center justify-center gap-2 text-xs text-positive">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-positive opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-positive" />
          </span>
          {t("QR đã điền sẵn số tiền & nội dung, tự xác nhận khi tiền về")}
        </p>
      )}

      {/* Amount */}
      {amount != null && (
        <div className="mb-2 bg-accent/10 border border-accent/20 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] text-text-muted mb-0.5">{t("Số tiền cần chuyển")}</p>
              <p className="text-accent font-display text-lg font-bold">{formatPrice(amount)}</p>
              {discounted && <p className="text-[11px] text-positive">{t("Đã trừ mã giảm giá")}</p>}
            </div>
            <button
              onClick={handleCopyAmount}
              className="flex-shrink-0 w-8 h-8 bg-accent/20 hover:bg-accent/30 flex items-center justify-center transition-colors cursor-pointer"
              aria-label={t("Sao chép số tiền cần chuyển")}
            >
              {amountCopied ? <Check className="w-4 h-4 text-positive" /> : <Copy className="w-4 h-4 text-accent" />}
            </button>
          </div>
        </div>
      )}

      {/* Transfer content */}
      <div className="bg-accent/10 border border-accent/20 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] text-text-muted mb-0.5">
              {t("Nội dung chuyển khoản")}
            </p>
            <p className="text-accent font-mono text-sm font-semibold truncate">
              {transferContent}
            </p>
          </div>
          <button
            onClick={handleCopy}
            className="flex-shrink-0 w-8 h-8 bg-accent/20 hover:bg-accent/30 flex items-center justify-center transition-colors cursor-pointer"
            aria-label={t("Sao chép nội dung chuyển khoản")}
          >
            {copied ? (
              <Check className="w-4 h-4 text-positive" />
            ) : (
              <Copy className="w-4 h-4 text-accent" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
