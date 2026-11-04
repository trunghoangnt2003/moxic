import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Check, Copy, Send, Share2 } from "lucide-react";

function Facebook({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21h3z" />
    </svg>
  );
}
import { useMe } from "../../hooks/useAccount";
import { getLoyalty } from "../../lib/loyaltyApi";

interface Props {
  /** Path on the site, e.g. /games/{id}. */
  path: string;
  title: string;
  text?: string;
  className?: string;
}

/**
 * Share a page: native share sheet on phones, otherwise a small menu (copy, Facebook, Messenger, Telegram, X).
 * Signed-in customers share with their referral code attached so friends who join earn them points.
 */
export default function ShareButton({ path, title, text, className = "" }: Props) {
  const { data: me } = useMe();
  const { data: loyalty } = useQuery({ queryKey: ["loyalty"], queryFn: getLoyalty, enabled: !!me, staleTime: 5 * 60_000 });
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const code = loyalty?.referral.code;
  const url = `${window.location.origin}${path}${code ? `?ref=${code}` : ""}`;
  const enc = encodeURIComponent;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(code ? "Đã copy link — bạn bè đăng ký qua link này, bạn được cộng điểm!" : "Đã copy link");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Không copy được, hãy copy thủ công: " + url);
    }
  };

  const onClick = async () => {
    const coarse = window.matchMedia?.("(pointer: coarse)").matches;
    if (coarse && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
      } catch {
        /* cancelled */
      }
      return;
    }
    setOpen((v) => !v);
  };

  const links = [
    { label: "Facebook", icon: Facebook, href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { label: "Telegram", icon: Send, href: `https://t.me/share/url?url=${enc(url)}&text=${enc(title)}` },
    { label: "X (Twitter)", icon: Share2, href: `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(title)}` },
  ];

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={onClick}
        className="w-full inline-flex items-center justify-center gap-2 h-10 px-4 border border-white/15 text-sm font-semibold text-text-secondary hover:text-white hover:border-white/30 transition-colors cursor-pointer"
      >
        <Share2 className="w-4 h-4" /> Chia sẻ{code ? " · nhận điểm" : ""}
      </button>
      {open && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-bg-elevated border border-white/10 shadow-2xl shadow-black/60 py-1 animate-[popIn_0.15s_ease-out]">
          <button type="button" onClick={copy} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:bg-white/5 hover:text-white cursor-pointer">
            {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />} Copy link
          </button>
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:bg-white/5 hover:text-white"
            >
              <l.icon className="w-4 h-4" /> {l.label}
            </a>
          ))}
          {code && <p className="px-3 pt-1 pb-1.5 text-[11px] text-text-muted border-t border-white/5 mt-1">Link có mã giới thiệu {code} của bạn</p>}
        </div>
      )}
    </div>
  );
}
