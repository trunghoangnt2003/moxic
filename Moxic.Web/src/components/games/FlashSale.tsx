import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Zap } from "lucide-react";
import { getGames } from "../../lib/api";
import GameRail from "./GameRail";

/** Ticks once per second (or per minute for long countdowns) and returns the time left. */
export function useCountdownTo(iso: string | null | undefined) {
  const target = iso ? new Date(iso).getTime() : 0;
  const [now, setNow] = useState(() => Date.now());
  const ms = Math.max(0, target - now);
  useEffect(() => {
    if (!target) return;
    const t = window.setInterval(() => setNow(Date.now()), ms > 86_400_000 ? 60_000 : 1000);
    return () => window.clearInterval(t);
  }, [target, ms > 86_400_000]);
  return {
    ms,
    d: Math.floor(ms / 86_400_000),
    h: Math.floor((ms % 86_400_000) / 3_600_000),
    m: Math.floor((ms % 3_600_000) / 60_000),
    s: Math.floor((ms % 60_000) / 1000),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Compact card badge: "⚡ 2 ngày" / "⚡ 05:12:09". */
export function SaleCountdownBadge({ endsAt, className = "" }: { endsAt: string; className?: string }) {
  const t = useCountdownTo(endsAt);
  if (t.ms <= 0) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold tabular-nums bg-gradient-to-r from-negative to-caution text-white ${className}`}>
      <Zap className="w-3 h-3 fill-white" />
      {t.d > 0 ? `${t.d} ngày ${t.h}h` : `${pad(t.h)}:${pad(t.m)}:${pad(t.s)}`}
    </span>
  );
}

/** Big segmented countdown used on the game page and the home rail header. */
export function SaleCountdown({ endsAt, label = "Kết thúc sau" }: { endsAt: string; label?: string }) {
  const t = useCountdownTo(endsAt);
  if (t.ms <= 0) return null;
  const parts = t.d > 0 ? [[t.d, "ngày"], [t.h, "giờ"], [t.m, "phút"]] : [[t.h, "giờ"], [t.m, "phút"], [t.s, "giây"]];
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-text-secondary">{label}</span>
      <div className="flex gap-1">
        {parts.map(([v, l]) => (
          <span key={l} className="min-w-9 px-1.5 py-1 bg-black/60 border border-negative/40 text-center leading-none">
            <span className="block font-display font-bold tabular-nums text-white">{pad(v as number)}</span>
            <span className="block text-[9px] text-text-muted mt-0.5">{l}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Home rail: running flash sales, soonest-ending first, with a countdown to the first end. */
export function FlashSaleRail() {
  const { data } = useQuery({ queryKey: ["games", "flash-sale"], queryFn: () => getGames({ flashSale: true, sort: "ending", pageSize: 12 }), staleTime: 60_000 });
  const games = data?.items ?? [];
  if (games.length === 0) return null;
  const firstEnd = games[0].saleEndsAt;
  return (
    <section className="relative p-4 sm:p-6 border border-negative/30 bg-gradient-to-br from-negative/10 via-transparent to-caution/10">
      <GameRail
        title={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="flex items-center gap-2">
              <Zap className="w-6 h-6 text-caution fill-caution" /> Flash Sale
            </span>
            {firstEnd && <SaleCountdown endsAt={firstEnd} />}
          </span>
        }
        games={games}
        action={
          <Link to="/games?sale=1&sort=discount" className="text-accent hover:text-accent-hover text-sm flex items-center gap-1">
            Tất cả ưu đãi <ArrowRight className="w-4 h-4" />
          </Link>
        }
      />
    </section>
  );
}
