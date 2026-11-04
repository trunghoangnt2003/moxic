import { useState } from "react";
import { Check, Copy, Gift, Send } from "lucide-react";

interface Props {
  token: string;
  recipientName?: string | null;
  claimedAt?: string | null;
}

/** Shown to the buyer of a gift order: the link to send to the recipient. */
export default function GiftLinkCard({ token, recipientName, claimedAt }: Props) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/gift/${token}`;
  const text = `🎁 Bạn có một món quà game Xbox từ Moxic GameStore! Mở quà tại đây:`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const share = async () => {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Quà tặng game Xbox", text, url });
        return;
      } catch {
        /* cancelled */
      }
    }
    copy();
  };

  return (
    <div className="relative overflow-hidden border border-[#c9a96e]/40 bg-gradient-to-br from-[#c9a96e]/15 via-[#252019] to-[#252019] p-5 space-y-3">
      <Gift className="absolute -right-4 -top-4 w-24 h-24 text-[#c9a96e]/10 rotate-12" />
      <div className="flex items-center gap-2">
        <Gift className="w-5 h-5 text-[#c9a96e]" />
        <h3 className="font-display text-lg text-[#ede6db]">Link quà tặng{recipientName ? ` cho ${recipientName}` : ""}</h3>
      </div>
      {claimedAt ? (
        <p className="text-sm text-green-400">✓ Người nhận đã mở quà và nhập tài khoản Xbox.</p>
      ) : (
        <p className="text-xs text-[#b5a898] leading-relaxed">
          Gửi link này cho người nhận. Họ mở link, nhập tài khoản Xbox của họ và Moxic sẽ cài game sau khi bạn thanh toán. Đừng chia sẻ link công khai.
        </p>
      )}
      <div className="flex items-stretch gap-2">
        <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="flex-1 min-w-0 bg-[#1a1714] border border-[#3d352a] px-3 py-2 text-xs text-[#ede6db] font-mono" />
        <button type="button" onClick={copy} aria-label="Copy link quà" className="px-3 bg-[#c9a96e]/20 hover:bg-[#c9a96e]/30 text-[#c9a96e] cursor-pointer">
          {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={share} className="h-10 inline-flex items-center justify-center gap-2 bg-[#c9a96e] hover:bg-[#d4b87a] text-[#1a1714] text-sm font-bold cursor-pointer">
          <Send className="w-4 h-4" /> Gửi quà
        </button>
        <a href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" className="h-10 inline-flex items-center justify-center gap-2 border border-[#3d352a] hover:border-[#c9a96e]/50 text-sm text-[#ede6db]">
          Telegram
        </a>
      </div>
    </div>
  );
}
