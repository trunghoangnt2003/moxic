import { Link } from "react-router-dom";
import { Clock, Coins, Gift, KeyRound } from "lucide-react";
import PrizeCard, { RARITY_COLORS } from "./PrizeCard";
import { formatPoints, openMethodLabel, type CaseSummary } from "../../lib/luckySpinApi";
import { formatCountdown } from "../../hooks/useCountdown";

const CHAMFER = 12;
const chamferPolygon = (c: number) =>
  `polygon(${c}px 0, calc(100% - ${c}px) 0, 100% ${c}px, 100% calc(100% - ${c}px), calc(100% - ${c}px) 100%, ${c}px 100%, 0 calc(100% - ${c}px), 0 ${c}px)`;

interface CaseCardProps {
  c: CaseSummary;
  /** Server-corrected now (ms). */
  now: number;
  loggedIn: boolean;
  points: number | null;
}

const METHOD_ICON = { Code: KeyRound, FreeInterval: Clock, Points: Coins } as const;

function StatusLine({ c, now, loggedIn, points }: CaseCardProps) {
  if (!c.available) return <span className="text-caution">Đang cập nhật</span>;

  if (c.openMethod === "FreeInterval") {
    if (!loggedIn) return <span className="text-white/60">Đăng nhập để mở</span>;
    const next = c.nextFreeOpenAt ? Date.parse(c.nextFreeOpenAt) : NaN;
    if (Number.isFinite(next) && next > now) {
      return (
        <span className="text-white/70">
          Mở lại sau <span className="font-mono text-highlight">{formatCountdown(next - now)}</span>
        </span>
      );
    }
    return <span className="text-positive">Sẵn sàng mở</span>;
  }

  if (c.openMethod === "Points") {
    if (!loggedIn) return <span className="text-white/60">Đăng nhập để mở</span>;
    const balance = points ?? 0;
    if (balance < c.pointsCost) {
      return <span className="text-caution">Cần thêm {formatPoints(c.pointsCost - balance)} điểm</span>;
    }
    return <span className="text-positive">Sẵn sàng mở</span>;
  }

  return <span className="text-white/60">Nhập mã quay để mở</span>;
}

export default function CaseCard({ c, now, loggedIn, points }: CaseCardProps) {
  const rarest = c.previewPrizes[0];
  const glow = rarest ? RARITY_COLORS[rarest.rarity] : "var(--color-spin-glow)";
  const Icon = METHOD_ICON[c.openMethod];
  const fan = c.previewPrizes.slice(0, 3);
  const fanOrder = [1, 0, 2].filter((i) => i < fan.length).map((i) => fan[i]);
  const mid = (fanOrder.length - 1) / 2;

  return (
    <Link
      to={`/lucky-spin/${encodeURIComponent(c.slug)}`}
      className="group relative block focus-visible:outline-none"
      style={{ filter: `drop-shadow(0 0 12px ${glow}33)` }}
    >
      <div
        className="absolute inset-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 opacity-70"
        style={{
          clipPath: chamferPolygon(CHAMFER),
          background: "linear-gradient(135deg, var(--color-spin-glow) 0%, var(--color-spin-pink) 50%, var(--color-spin-glow) 100%)",
        }}
      />
      <div
        className="relative m-px flex h-full flex-col overflow-hidden"
        style={{
          clipPath: chamferPolygon(CHAMFER - 1),
          background: "radial-gradient(ellipse at 50% 30%, var(--color-spin-panel) 0%, var(--color-spin-ink) 60%, var(--color-spin-void) 100%)",
        }}
      >
        {/* Art */}
        <div className="relative flex h-[120px] items-center justify-center overflow-hidden sm:h-[150px]">
          {c.imageUrl ? (
            <img
              src={c.imageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
            />
          ) : fanOrder.length > 0 ? (
            <div className="relative h-full w-full">
              {fanOrder.map((p, i) => {
                const off = i - mid;
                return (
                  <div
                    key={p.id}
                    className="absolute left-1/2 top-1/2"
                    style={{
                      transform: `translate(-50%, -50%) translateX(${off * 34}px) translateY(${Math.abs(off) * 6}px) rotate(${off * 8}deg) scale(0.62)`,
                      zIndex: 10 - Math.abs(Math.round(off)),
                      filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.55))",
                    }}
                  >
                    <PrizeCard prize={p} size="reel" />
                  </div>
                );
              })}
            </div>
          ) : (
            <Gift className="h-12 w-12 text-highlight/70" strokeWidth={1.5} />
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-spin-ink to-transparent" />
          {/* Method badge */}
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-sm border border-white/15 bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
            <Icon className="h-3 w-3" /> {openMethodLabel(c)}
          </span>
        </div>

        {/* Copy */}
        <div className="flex flex-1 flex-col px-3 pb-3 pt-1">
          <h3 className="line-clamp-1 font-display text-sm font-bold text-white sm:text-base">{c.name}</h3>
          {c.description && <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-white/55">{c.description}</p>}
          <div className="mt-auto pt-2 text-[11px]">
            <p className="text-white/45">{c.prizeCount} vật phẩm</p>
            <p className="mt-0.5 line-clamp-1">
              <StatusLine c={c} now={now} loggedIn={loggedIn} points={points} />
            </p>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: glow, boxShadow: `0 0 10px ${glow}` }} />
      </div>
    </Link>
  );
}
