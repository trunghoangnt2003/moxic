import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { lang, switchLanguage, type Lang } from "../../lib/i18n";

/** Flags are drawn, not emoji: Windows renders flag emoji as two letters. */
function FlagVN({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 20" className={className} aria-hidden="true">
      <rect width="30" height="20" fill="#da251d" />
      <polygon fill="#ffff00" points="15,4 16.18,7.64 20,7.64 16.91,9.88 18.09,13.52 15,11.28 11.91,13.52 13.09,9.88 10,7.64 13.82,7.64" />
    </svg>
  );
}

function FlagGB({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 30" className={className} aria-hidden="true">
      <clipPath id="gb-s"><path d="M0,0 v30 h60 v-30 z" /></clipPath>
      <clipPath id="gb-t"><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" /></clipPath>
      <g clipPath="url(#gb-s)">
        <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
        <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#gb-t)" stroke="#C8102E" strokeWidth="4" />
        <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
        <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
      </g>
    </svg>
  );
}

const LANGS: { value: Lang; label: string; country: string; short: string; Flag: typeof FlagVN }[] = [
  { value: "vi", label: "Tiếng Việt", country: "Việt Nam", short: "VN", Flag: FlagVN },
  { value: "en", label: "English", country: "United Kingdom", short: "EN", Flag: FlagGB },
];

/** Beside the logo: the current flag + code; the menu lists each language with its flag and country. */
export default function LanguageSwitcher() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LANGS.find((l) => l.value === lang) ?? LANGS[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={lang === "en" ? "Language: English" : "Ngôn ngữ: Tiếng Việt"}
        className="h-8 px-1.5 inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
      >
        <current.Flag className="w-5 h-[14px] rounded-[2px] ring-1 ring-white/15" />
        <span className="font-semibold">{current.short}</span>
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-full mt-2 w-56 py-1 bg-bg-surface border border-border shadow-xl shadow-black/20 z-50">
          {LANGS.map((l) => {
            const active = l.value === lang;
            return (
              <button
                key={l.value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                lang={l.value}
                onClick={() => {
                  setOpen(false);
                  switchLanguage(l.value);
                }}
                className={`w-full px-3 py-2.5 flex items-center gap-3 text-left transition-colors cursor-pointer ${
                  active ? "bg-accent/10" : "hover:bg-bg-surface-hover"
                }`}
              >
                <l.Flag className="w-6 h-4 shrink-0 rounded-[2px] ring-1 ring-white/15" />
                <span className="flex-1 min-w-0">
                  <span className={`block text-sm font-semibold ${active ? "text-accent" : "text-text-primary"}`}>{l.label}</span>
                  <span className="block text-xs text-text-muted">{l.country}</span>
                </span>
                {active && <Check className="w-4 h-4 text-accent" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
