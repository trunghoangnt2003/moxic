import { useState } from "react";
import { Copy, Check, Banknote, Bitcoin } from "lucide-react";

interface Props {
  bankQrUrl?: string | null;
  cryptoQrUrl?: string | null;
  transferContent: string;
}

export default function QRDisplay({ bankQrUrl, cryptoQrUrl, transferContent }: Props) {
  const [mode, setMode] = useState<"bank" | "crypto">("bank");
  const [copied, setCopied] = useState(false);

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
    <div className="bg-bg-surface border border-border p-5">
      {/* Tabs */}
      <div className="flex mb-5 border border-border overflow-hidden">
        <button
          onClick={() => setMode("bank")}
          className={lex-1 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer }
        >
          <Banknote className="w-4 h-4" /> Chuy\u1ec3n kho\u1ea3n
        </button>
        <button
          onClick={() => setMode("crypto")}
          className={lex-1 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer }
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
            alt={QR }
            className="max-w-[280px] w-full aspect-square object-contain bg-white p-2"
          />
        ) : (
          <div className="max-w-[280px] w-full aspect-square bg-bg-elevated flex items-center justify-center border border-dashed border-border">
            <p className="text-text-muted text-xs">
              {mode === "bank" ? "Ch\u01b0a c\u00f3 m\u00e3 QR ng\u00e2n h\u00e0ng" : "Ch\u01b0a c\u00f3 m\u00e3 QR Crypto"}
            </p>
          </div>
        )}
      </div>

      {/* Transfer content */}
      <div className="bg-accent/10 border border-accent/20 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] text-text-muted uppercase tracking-wider mb-0.5">
              N\u1ed9i dung chuy\u1ec3n kho\u1ea3n
            </p>
            <p className="text-accent font-mono text-sm font-semibold truncate">
              {transferContent}
            </p>
          </div>
          <button
            onClick={handleCopy}
            className="flex-shrink-0 w-8 h-8 bg-accent/20 hover:bg-accent/30 flex items-center justify-center transition-colors cursor-pointer"
          >
            {copied ? (
              <Check className="w-4 h-4 text-success" />
            ) : (
              <Copy className="w-4 h-4 text-accent" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
