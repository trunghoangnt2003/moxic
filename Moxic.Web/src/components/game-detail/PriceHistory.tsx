import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, LineChart, TrendingDown } from "lucide-react";
import axios from "axios";
import { formatPrice } from "../../lib/utils";

import { t, locale } from "../../lib/i18n";
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "/api" });

interface Point {
  at: string;
  sale: number;
  base: number;
}
interface Series {
  region: string | null;
  currency: string | null;
  points: Point[];
  lowest: { price: number; at: string } | null;
  highest: number | null;
  trackedSince: string | null;
}
interface History {
  current: number;
  original: number;
  moxic: Series;
  xbox: Series | null;
  serverNow: string;
}

const money = (v: number, currency: string) =>
  currency === "VND" ? formatPrice(v) : new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(v);
const day = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });

/** Single-series step chart (price holds between changes) with a hover crosshair + tooltip. */
function StepChart({ points, now, currency, height = 160 }: { points: Point[]; now: string; currency: string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = height;
  const pad = { l: 8, r: 8, t: 14, b: 22 };

  const data = useMemo(() => {
    const pts = points.map((p) => ({ t: new Date(p.at).getTime(), v: p.sale }));
    if (pts.length > 0) pts.push({ t: new Date(now).getTime(), v: pts[pts.length - 1].v });
    return pts;
  }, [points, now]);
  if (data.length === 0) return null;

  const t0 = data[0].t;
  const t1 = Math.max(data[data.length - 1].t, t0 + 1);
  const vals = data.map((d) => d.v);
  const vMax = Math.max(...vals);
  const vMin = Math.min(...vals);
  const span = vMax - vMin || vMax * 0.2 || 1;
  const lo = Math.max(0, vMin - span * 0.35);
  const hi = vMax + span * 0.25;
  const x = (t: number) => pad.l + ((t - t0) / (t1 - t0)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);

  let d = `M${x(data[0].t)},${y(data[0].v)}`;
  for (let i = 1; i < data.length; i++) d += ` H${x(data[i].t)} V${y(data[i].v)}`;
  const area = `${d} V${H - pad.b} H${x(data[0].t)} Z`;

  const changes = data.slice(0, -1);
  const minIdx = changes.reduce((m, p, i) => (p.v < changes[m].v ? i : m), 0);
  const h = hover != null ? changes[hover] : null;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const t = t0 + ((e.clientX - rect.left) / rect.width) * (t1 - t0);
    let idx = 0;
    for (let i = 0; i < changes.length; i++) if (changes[i].t <= t) idx = i;
    setHover(idx);
  };

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto touch-none" role="img" aria-label={t("Biểu đồ lịch sử giá")} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="ph-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="currentColor" className="text-white/10" strokeWidth={1} />
        <g className="text-accent">
          <path d={area} fill="url(#ph-fill)" />
          <path d={d} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
          {changes.map((p, i) => (
            <circle key={i} cx={x(p.t)} cy={y(p.v)} r={i === hover ? 5 : 3} fill="currentColor" stroke="var(--color-bg-surface)" strokeWidth={2} />
          ))}
        </g>
        {/* lowest marker label */}
        <text x={Math.min(W - 60, Math.max(pad.l + 4, x(changes[minIdx].t)))} y={y(changes[minIdx].v) + 16} fontSize="10" className="fill-positive">
          {t("thấp nhất")}
        </text>
        <text x={pad.l} y={H - 6} fontSize="10" className="fill-text-muted">
          {day(new Date(t0).toISOString())}
        </text>
        <text x={W - pad.r} y={H - 6} fontSize="10" textAnchor="end" className="fill-text-muted">
          {t("Hôm nay")}
        </text>
        {h && <line x1={x(h.t)} x2={x(h.t)} y1={pad.t} y2={H - pad.b} stroke="currentColor" className="text-white/30" strokeWidth={1} strokeDasharray="3 3" />}
      </svg>
      {h && (
        <div
          className="pointer-events-none absolute top-0 px-2.5 py-1.5 bg-bg-base/95 border border-white/15 text-xs whitespace-nowrap shadow-lg"
          style={{ left: `${Math.min(70, Math.max(0, (x(h.t) / W) * 100 - 10))}%` }}
        >
          <p className="text-text-muted">{t("Từ {0}", [day(new Date(h.t).toISOString())])}</p>
          <p className="font-semibold text-white">{money(h.v, currency)}</p>
        </div>
      )}
    </div>
  );
}

export default function PriceHistory({ gameId }: { gameId: string }) {
  const { data } = useQuery({
    queryKey: ["price-history", gameId],
    queryFn: async () => (await api.get<History>(`/games/${gameId}/price-history`)).data,
    staleTime: 10 * 60_000,
  });
  if (!data || data.moxic.points.length === 0) return null;

  const low = data.moxic.lowest;
  const atLowest = low != null && data.current <= low.price;
  const changes = data.moxic.points.length;
  const xbox = data.xbox;
  const xboxNow = xbox?.points.at(-1);

  return (
    <section className="mt-12">
      <h2 className="font-display text-xl text-text-primary flex items-center gap-2 mb-5">
        <LineChart className="w-5 h-5 text-accent" /> {t("Lịch sử giá")}
      </h2>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-bg-surface border border-border p-4">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
            <div>
              <p className="text-[11px] text-text-muted">{t("Giá Moxic hiện tại")}</p>
              <p className="font-display text-2xl font-bold text-white">{formatPrice(data.current)}</p>
            </div>
            {atLowest ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold bg-positive/15 text-positive border border-positive/40">
                <BadgeCheck className="w-4 h-4" /> {t("Đang ở mức giá thấp nhất")}
              </span>
            ) : (
              low && (
                <span className="text-xs text-text-muted">
                  {t("Thấp nhất")} <b className="text-white">{formatPrice(low.price)}</b> ({day(low.at)})
                </span>
              )
            )}
          </div>
          {changes > 1 ? (
            <StepChart points={data.moxic.points} now={data.serverNow} currency="VND" />
          ) : (
            <p className="text-xs text-text-muted py-8 text-center border border-dashed border-white/10">
              {t("Giá chưa thay đổi kể từ")} {data.moxic.trackedSince ? day(data.moxic.trackedSince) : t("khi bắt đầu theo dõi")}.
            </p>
          )}
        </div>

        <div className="bg-bg-surface border border-border p-4 space-y-3">
          {xbox && xboxNow ? (
            <>
              <p className="text-[11px] text-text-muted">{t("Giá Xbox Store ({0})", [(xbox.region ?? "us").toUpperCase()])}</p>
              <p className="font-display text-xl font-bold text-white">{money(xboxNow.sale, xbox.currency ?? "USD")}</p>
              {xboxNow.base > xboxNow.sale && <p className="text-xs text-text-muted line-through">{money(xboxNow.base, xbox.currency ?? "USD")}</p>}
              {xbox.lowest && (
                <p className="text-xs text-text-muted">
                  {t("Thấp nhất trên Store:")} <b className="text-white">{money(xbox.lowest.price, xbox.currency ?? "USD")}</b>
                </p>
              )}
              {xbox.points.length > 1 && <StepChart points={xbox.points} now={data.serverNow} currency={xbox.currency ?? "USD"} height={110} />}
            </>
          ) : (
            <>
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <TrendingDown className="w-4 h-4 text-positive" /> {t("Rẻ hơn Store chính hãng")}
              </p>
              <p className="text-xs text-text-muted">
                {data.original > data.current
                  ? t("Tiết kiệm {0} ({1}%) so với giá niêm yết.", [formatPrice(data.original - data.current), Math.round((1 - data.current / data.original) * 100)])
                  : t("Giá đã bao gồm dịch vụ cài đặt cho tài khoản Xbox của bạn.")}
              </p>
            </>
          )}
          <p className="text-[11px] text-text-muted border-t border-white/5 pt-3">{t("♥ Thêm vào Yêu thích để nhận email khi game giảm giá.")}</p>
        </div>
      </div>
    </section>
  );
}
