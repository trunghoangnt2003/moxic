import { Clover, TicketPercent } from "lucide-react";
import type { PublicPrize, Rarity } from "../../lib/luckySpinApi";

import { t } from "../../lib/i18n";
export const RARITY_COLORS: Record<Rarity, string> = {
  common: "#b0c3d9",
  uncommon: "#4b69ff",
  rare: "#8847ff",
  epic: "#eb4b4b",
  legendary: "#e4ae39",
};

export const RARITY_LABELS: Record<Rarity, string> = {
  common: t("Phổ thông"),
  uncommon: t("Hiếm vừa"),
  rare: t("Hiếm"),
  epic: t("Cực hiếm"),
  legendary: t("Huyền thoại"),
};

/** Lower = rarer (used to sort "rarest first"). */
export const RARITY_RANK: Record<Rarity, number> = {
  legendary: 0,
  epic: 1,
  rare: 2,
  uncommon: 3,
  common: 4,
};

type CardSize = "reel" | "large" | "tile";

const SIZE_CLASSES: Record<CardSize, { box: string; icon: string; text: string }> = {
  // Fixed size so the reel stride is constant: 104px mobile, 160px from md.
  reel: {
    box: "w-[104px] h-[124px] md:w-[160px] md:h-[176px]",
    icon: "w-9 h-9 md:w-14 md:h-14",
    text: "text-[10px] md:text-xs",
  },
  large: {
    box: "w-[200px] h-[236px] sm:w-[220px] sm:h-[260px]",
    icon: "w-20 h-20",
    text: "text-sm",
  },
  tile: {
    box: "w-full h-[132px] sm:h-[150px]",
    icon: "w-10 h-10 sm:w-12 sm:h-12",
    text: "text-[11px] sm:text-xs",
  },
};

interface PrizeCardProps {
  prize: PublicPrize;
  size?: CardSize;
  highlighted?: boolean;
  className?: string;
}

export default function PrizeCard({ prize, size = "reel", highlighted = false, className = "" }: PrizeCardProps) {
  const color = RARITY_COLORS[prize.rarity];
  const s = SIZE_CLASSES[size];
  const showImage = prize.type === "Game" && !!prize.imageUrl;

  return (
    <div
      className={`relative flex-shrink-0 overflow-hidden rounded-[3px] select-none transition-[transform,box-shadow] duration-500 ease-out ${s.box} ${className}`}
      style={{
        background: "linear-gradient(180deg, var(--color-spin-card) 0%, var(--color-spin-card-2) 100%)",
        transform: highlighted ? "scale(1.06)" : undefined,
        boxShadow: highlighted
          ? `0 0 0 1px ${color}, 0 0 28px ${color}99, inset 0 0 24px ${color}33`
          : "inset 0 0 0 1px rgba(255,255,255,0.05)",
        zIndex: highlighted ? 5 : undefined,
      }}
    >
      {/* Faint rarity glow rising from the bottom (CS2 look) */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-3/4"
        style={{ background: `linear-gradient(to top, ${color}45 0%, ${color}14 45%, transparent 100%)` }}
      />

      <div className="relative flex h-full flex-col">
        {/* Art */}
        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
          {showImage ? (
            <>
              <img
                src={prize.imageUrl!}
                alt=""
                draggable={false}
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-spin-deep to-transparent" />
            </>
          ) : (
            <>
              <div
                className="pointer-events-none absolute inset-0"
                style={{ background: `radial-gradient(circle at 50% 55%, ${color}40 0%, ${color}10 40%, transparent 70%)` }}
              />
              {prize.type === "Luck" ? (
                <Clover className={`relative ${s.icon}`} style={{ color, filter: `drop-shadow(0 0 8px ${color}aa)` }} strokeWidth={1.6} />
              ) : (
                <TicketPercent className={`relative ${s.icon}`} style={{ color, filter: `drop-shadow(0 0 8px ${color}aa)` }} strokeWidth={1.6} />
              )}
            </>
          )}
        </div>

        {/* Name */}
        <div className="relative px-1.5 pb-2.5 pt-1 text-center">
          <p className={`line-clamp-2 font-semibold leading-tight text-white/90 ${s.text}`} title={prize.name}>
            {prize.name}
          </p>
        </div>
      </div>

      {/* Rarity bar */}
      <div className="absolute inset-x-0 bottom-0 h-1" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
    </div>
  );
}
