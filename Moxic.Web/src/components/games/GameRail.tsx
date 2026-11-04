import { useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { GameListItem } from "../../types/game";
import GameCard from "./GameCard";

import { t } from "../../lib/i18n";
interface Props {
  title: ReactNode;
  games: GameListItem[];
  action?: ReactNode;
  /** Optional rank number badge (1, 2, 3…) on each card. */
  ranked?: boolean;
}

/** Horizontal, swipeable row of game cards with desktop arrow buttons. */
export default function GameRail({ title, games, action, ranked }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => {
    const el = scroller.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  if (games.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between gap-3 mb-5">
        <h2 className="font-display text-xl md:text-2xl font-bold text-text-primary flex items-center gap-2">{title}</h2>
        <div className="flex items-center gap-2">
          {action}
          <div className="hidden md:flex gap-1">
            <button type="button" aria-label={t("Cuộn trái")} onClick={() => scroll(-1)} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/15 text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button type="button" aria-label={t("Cuộn phải")} onClick={() => scroll(1)} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/15 text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      <div
        ref={scroller}
        className="flex gap-3 sm:gap-5 overflow-x-auto overscroll-x-contain snap-x snap-mandatory scroll-smooth pb-2 -mx-4 px-4 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {games.map((g, i) => (
          <div key={g.id} className="shrink-0 snap-start w-[44%] sm:w-[30%] md:w-[23%] lg:w-[calc((100%-4*1.25rem)/5)]">
            <GameCard game={g} variant="vertical" rank={ranked ? i + 1 : undefined} />
          </div>
        ))}
      </div>
    </section>
  );
}
