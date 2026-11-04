import { useLayoutEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Gift, TicketPercent } from "lucide-react";
import { RARITY_COLORS } from "./PrizeCard";
import { useLiveDrops } from "../../hooks/useLuckySpin";
import type { LiveDrop } from "../../lib/luckySpinApi";
import { timeAgo } from "../../lib/utils";

import { t } from "../../lib/i18n";
const WOW_GOLD = "#e4ae39";
const SLIDE_MS = 450;

function DropCard({ drop, featured = false }: { drop: LiveDrop; featured?: boolean }) {
  const color = RARITY_COLORS[drop.rarity] ?? RARITY_COLORS.common;
  const Icon = drop.prizeType === "Discount" ? TicketPercent : Gift;
  const title = `${drop.prizeName}, ${drop.caseName}, ${drop.winnerName}, ${timeAgo(drop.createdAt)}`;

  const body = (
    <div
      className="relative h-[68px] w-[104px] overflow-hidden rounded-[3px] sm:w-[120px]"
      style={{
        background: "linear-gradient(180deg, var(--color-spin-card) 0%, var(--color-spin-card-2) 100%)",
        boxShadow: featured ? `inset 0 0 0 1px ${WOW_GOLD}66` : "inset 0 0 0 1px rgba(255,255,255,0.06)",
      }}
    >
      {drop.imageUrl ? (
        <img
          src={drop.imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover opacity-45"
        />
      ) : (
        <Icon
          className="absolute right-1.5 top-1.5 h-6 w-6 opacity-80"
          style={{ color, filter: `drop-shadow(0 0 6px ${color}aa)` }}
          strokeWidth={1.6}
        />
      )}
      {/* rarity glow rising from the bottom */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: `linear-gradient(to top, ${color}55 0%, color-mix(in oklab, var(--color-spin-card-2) 80%, transparent) 45%, transparent 100%)` }}
      />
      <div className="relative flex h-full flex-col justify-end px-1.5 pb-1.5">
        <p className="line-clamp-1 text-[11px] font-semibold leading-tight text-white">{drop.prizeName}</p>
        <p className="line-clamp-1 text-[9px] leading-tight text-white/50">{drop.caseName}</p>
        <p className="line-clamp-1 text-[9px] leading-tight text-highlight/80">{drop.winnerName}</p>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
    </div>
  );

  if (drop.caseSlug) {
    return (
      <Link
        to={`/lucky-spin/${encodeURIComponent(drop.caseSlug)}`}
        title={title}
        className="block flex-none transition-[filter] hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-highlight"
      >
        {body}
      </Link>
    );
  }
  return (
    <div title={title} className="flex-none">
      {body}
    </div>
  );
}

/**
 * LIVE strip of REAL recent wins (our own SpinHistory, no PII). WOW block = latest epic/legendary
 * wins; feed = latest non-Luck wins, newest at the left, new ones slide in on later polls.
 */
export default function LiveDropsBar() {
  const { data } = useLiveDrops();
  const wow = data?.wow ?? [];
  const feed = data?.feed ?? [];
  const seenRef = useRef<Set<string> | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!data) return;
    const ids = data.feed.map((d) => d.id);
    const seen = seenRef.current;
    seenRef.current = new Set(ids);
    // First render: no animation.
    if (seen == null) return;

    const fresh = ids.filter((id) => !seen.has(id));
    const track = trackRef.current;
    if (fresh.length === 0 || !track) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    for (const id of fresh) {
      const el = track.querySelector<HTMLElement>(`[data-drop-id="${CSS.escape(id)}"]`);
      if (!el) continue;
      const width = el.offsetWidth;
      el.animate(
        [
          { maxWidth: "0px", opacity: 0, transform: "translateX(-24px)" },
          { maxWidth: `${width}px`, opacity: 1, transform: "translateX(0)" },
        ],
        { duration: SLIDE_MS, easing: "ease-out" }
      );
    }
  }, [data]);

  if (wow.length === 0 && feed.length === 0) return null;

  return (
    <section
      aria-label={t("Phần thưởng vừa trúng")}
      className="relative overflow-hidden rounded-sm border border-white/10 bg-spin-deep/85"
    >
      <div className="flex items-stretch gap-2 p-2">
        {/* LIVE label */}
        <div className="flex flex-none flex-col items-center justify-center gap-1 px-1">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-negative opacity-70 motion-reduce:animate-none" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-negative" />
          </span>
          <span className="text-[10px] font-bold text-negative [writing-mode:vertical-rl] rotate-180 sm:[writing-mode:horizontal-tb] sm:rotate-0">
            Live
          </span>
        </div>

        {/* WOW block */}
        {wow.length > 0 && (
          <div
            className="flex flex-none items-center gap-1.5 rounded-[3px] p-1.5"
            style={{
              border: `1px solid ${WOW_GOLD}`,
              boxShadow: `0 0 16px ${WOW_GOLD}40, inset 0 0 12px ${WOW_GOLD}1a`,
              background: "linear-gradient(135deg, var(--color-spin-gold-1) 0%, var(--color-spin-gold-2) 100%)",
            }}
          >
            <span
              className="text-[11px] font-black [writing-mode:vertical-rl] rotate-180"
              style={{ color: WOW_GOLD, textShadow: `0 0 8px ${WOW_GOLD}aa` }}
            >
              Wow
            </span>
            {wow.map((d, i) => (
              <div key={d.id} className={i > 0 ? "hidden sm:block" : ""}>
                <DropCard drop={d} featured />
              </div>
            ))}
          </div>
        )}

        {/* Feed */}
        <div
          className="relative min-w-0 flex-1 snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] sm:snap-none sm:overflow-hidden sm:[mask-image:linear-gradient(to_right,black_82%,transparent)] [&::-webkit-scrollbar]:hidden"
        >
          <div ref={trackRef} className="flex">
            {feed.map((d) => (
              <div key={d.id} data-drop-id={d.id} className="flex-none snap-start overflow-hidden pr-1.5">
                <DropCard drop={d} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
