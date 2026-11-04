import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight, Megaphone, PartyPopper, Rocket, X } from "lucide-react";
import { getActiveAnnouncements, type Announcement } from "../../lib/api";
import { formatPrice } from "../../lib/utils";

const SESSION_KEY = "moxic.announce.seen";
const SNOOZE_KEY = "moxic.announce.snoozeDay";

const KIND_META: Record<Announcement["kind"], { label: string; icon: typeof Rocket; badge: string; glow: string; accent: string }> = {
  GameLaunch: {
    label: "Sắp ra mắt",
    icon: Rocket,
    badge: "bg-amber-400/15 text-amber-300 border-amber-400/40",
    glow: "shadow-[0_0_60px_-10px_rgba(251,191,36,0.45)]",
    accent: "from-amber-300 to-orange-400",
  },
  Event: {
    label: "Sự kiện",
    icon: PartyPopper,
    badge: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/40",
    glow: "shadow-[0_0_60px_-10px_rgba(217,70,239,0.5)]",
    accent: "from-fuchsia-400 to-violet-500",
  },
  News: {
    label: "Tin mới",
    icon: Megaphone,
    badge: "bg-sky-400/15 text-sky-300 border-sky-400/40",
    glow: "shadow-[0_0_60px_-10px_rgba(56,189,248,0.45)]",
    accent: "from-sky-300 to-indigo-400",
  },
};

const todayKey = () => new Date().toISOString().slice(0, 10);

function readStorage(store: () => Storage, key: string) {
  try {
    return store().getItem(key);
  } catch {
    return null;
  }
}
function writeStorage(store: () => Storage, key: string, value: string) {
  try {
    store().setItem(key, value);
  } catch {
    /* private mode — ignore */
  }
}

function useNow(offsetMs: number) {
  const [now, setNow] = useState(() => Date.now() + offsetMs);
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now() + offsetMs), 1000);
    return () => window.clearInterval(t);
  }, [offsetMs]);
  return now;
}

function Countdown({ target, offsetMs, accent }: { target: string; offsetMs: number; accent: string }) {
  const now = useNow(offsetMs);
  const ms = Math.max(0, new Date(target).getTime() - now);
  const parts = [
    { v: Math.floor(ms / 86_400_000), l: "Ngày" },
    { v: Math.floor((ms % 86_400_000) / 3_600_000), l: "Giờ" },
    { v: Math.floor((ms % 3_600_000) / 60_000), l: "Phút" },
    { v: Math.floor((ms % 60_000) / 1000), l: "Giây" },
  ];
  if (ms === 0) {
    return <p className={`text-lg font-display font-bold bg-gradient-to-r ${accent} bg-clip-text text-transparent`}>Đã chính thức ra mắt!</p>;
  }
  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-3" role="timer" aria-live="off">
      {parts.map((p, i) => (
        <div key={p.l} className="relative bg-black/50 border border-white/10 py-2 sm:py-3 text-center overflow-hidden">
          <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${accent} opacity-70`} />
          <span
            key={i === 3 ? p.v : undefined}
            className={`block font-display font-bold tabular-nums text-2xl sm:text-4xl leading-none ${
              i === 0 ? `bg-gradient-to-b ${accent} bg-clip-text text-transparent` : "text-white"
            } ${i === 3 ? "animate-[tick_0.35s_ease-out]" : ""}`}
          >
            {String(p.v).padStart(2, "0")}
          </span>
          <span className="block mt-1 text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-text-muted">{p.l}</span>
        </div>
      ))}
    </div>
  );
}

export default function AnnouncementModal() {
  const navigate = useNavigate();
  const { data } = useQuery({ queryKey: ["announcements", "active"], queryFn: getActiveAnnouncements, staleTime: 5 * 60 * 1000 });
  const items = useMemo(() => data?.items ?? [], [data]);
  const offsetMs = useMemo(() => (data ? new Date(data.serverNow).getTime() - Date.now() : 0), [data]);

  // Shown once per browser session (every new visit), unless snoozed for today.
  const [dismissed, setDismissed] = useState(
    () => readStorage(() => sessionStorage, SESSION_KEY) === "1" || readStorage(() => localStorage, SNOOZE_KEY) === todayKey(),
  );
  const [index, setIndex] = useState(0);
  const [snooze, setSnooze] = useState(false);
  const open = !dismissed && items.length > 0;

  const close = () => {
    writeStorage(() => sessionStorage, SESSION_KEY, "1");
    if (snooze) writeStorage(() => localStorage, SNOOZE_KEY, todayKey());
    setDismissed(true);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % items.length);
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + items.length) % items.length);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, items.length, snooze]);

  if (!open) return null;
  const a = items[Math.min(index, items.length - 1)];
  const meta = KIND_META[a.kind] ?? KIND_META.News;
  const Icon = meta.icon;
  const discount = a.gamePrice != null && a.gameOriginalPrice && a.gameOriginalPrice > a.gamePrice
    ? Math.round((1 - a.gamePrice / a.gameOriginalPrice) * 100)
    : 0;

  const go = () => {
    if (!a.ctaUrl) return close();
    close();
    if (a.ctaUrl.startsWith("/")) navigate(a.ctaUrl);
    else window.open(a.ctaUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="announce-title">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-[fadeIn_0.25s_ease-out]" onClick={close} />

      <div
        key={a.id}
        className={`relative w-full sm:max-w-[640px] max-h-[94vh] overflow-y-auto pb-[var(--sab)] sm:pb-0 bg-bg-surface border border-white/10 ${meta.glow} animate-[popIn_0.35s_cubic-bezier(0.2,0.9,0.25,1.1)]`}
      >
        {/* Banner */}
        <div className="relative aspect-[16/9] sm:aspect-[16/8] bg-bg-elevated overflow-hidden">
          {a.imageUrl ? (
            <img loading="lazy" decoding="async" src={a.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover scale-105 animate-[slowZoom_12s_ease-out_forwards]" />
          ) : (
            <div className={`absolute inset-0 bg-gradient-to-br ${meta.accent} opacity-30`} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-bg-surface via-bg-surface/30 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent" />

          <span className={`absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest border backdrop-blur-md ${meta.badge}`}>
            <Icon className="w-3.5 h-3.5" /> {meta.label}
          </span>
          <button
            type="button"
            onClick={close}
            aria-label="Đóng"
            className="absolute top-2.5 right-2.5 w-9 h-9 flex items-center justify-center bg-black/50 hover:bg-black/80 border border-white/15 text-white cursor-pointer backdrop-blur-md"
          >
            <X className="w-4 h-4" />
          </button>

          {items.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Thông báo trước"
                onClick={() => setIndex((i) => (i - 1 + items.length) % items.length)}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center bg-black/40 hover:bg-black/70 border border-white/10 text-white cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                aria-label="Thông báo sau"
                onClick={() => setIndex((i) => (i + 1) % items.length)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center bg-black/40 hover:bg-black/70 border border-white/10 text-white cursor-pointer"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
        </div>

        {/* Content */}
        <div className="relative px-5 sm:px-7 pb-5 sm:pb-6 -mt-10 sm:-mt-14 space-y-4">
          <div>
            {a.gameName && a.kind === "GameLaunch" && (
              <p className="text-[11px] uppercase tracking-[0.25em] text-text-muted mb-1">{a.gameName}</p>
            )}
            <h2 id="announce-title" className="font-display text-2xl sm:text-4xl font-extrabold leading-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
              {a.title}
            </h2>
            {a.subtitle && <p className={`mt-1.5 text-sm sm:text-base font-semibold bg-gradient-to-r ${meta.accent} bg-clip-text text-transparent`}>{a.subtitle}</p>}
          </div>

          {a.countdownTo && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs text-text-secondary">
                <CalendarDays className="w-3.5 h-3.5" />
                {a.countdownLabel || (a.kind === "Event" ? "Sự kiện bắt đầu sau" : "Ra mắt sau")}
                <span className="text-text-muted">
                  · {new Date(a.countdownTo).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}
                </span>
              </p>
              <Countdown target={a.countdownTo} offsetMs={offsetMs} accent={meta.accent} />
            </div>
          )}

          {a.body && <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">{a.body}</p>}

          {a.gamePrice != null && (
            <div className="flex items-baseline gap-2">
              {discount > 0 && <span className="px-1.5 py-0.5 text-xs font-bold bg-discount text-white">-{discount}%</span>}
              {discount > 0 && <span className="text-sm text-text-muted line-through">{formatPrice(a.gameOriginalPrice!)}</span>}
              <span className="text-xl font-bold text-white">{a.gamePrice === 0 ? "Miễn phí" : formatPrice(a.gamePrice)}</span>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-1">
            <button type="button" onClick={close} className="h-12 sm:flex-1 border border-white/15 text-sm font-semibold text-text-secondary hover:text-white hover:border-white/30 cursor-pointer">
              Để sau
            </button>
            {a.ctaUrl && (
              <button
                type="button"
                onClick={go}
                className={`group relative h-12 sm:flex-[2] overflow-hidden bg-gradient-to-r ${meta.accent} text-bg-base text-sm font-extrabold uppercase tracking-wider cursor-pointer`}
              >
                <span className="relative z-10">{a.ctaLabel || (a.kind === "GameLaunch" ? "Đặt trước ngay" : "Xem chi tiết")}</span>
                <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer select-none">
              <input type="checkbox" checked={snooze} onChange={(e) => setSnooze(e.target.checked)} className="accent-amber-400" />
              Không hiện lại hôm nay
            </label>
            {items.length > 1 && (
              <div className="flex gap-1.5" role="tablist" aria-label="Chọn thông báo">
                {items.map((x, i) => (
                  <button
                    key={x.id}
                    type="button"
                    role="tab"
                    aria-selected={i === index}
                    aria-label={`Thông báo ${i + 1}`}
                    onClick={() => setIndex(i)}
                    className={`h-1.5 transition-all cursor-pointer ${i === index ? "w-6 bg-amber-300" : "w-1.5 bg-white/25 hover:bg-white/50"}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
