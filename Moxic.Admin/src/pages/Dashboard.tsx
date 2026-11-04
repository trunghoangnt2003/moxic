import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Clock,
  Gift,
  Loader2,
  Package,
  Percent,
  ShoppingBag,
  Table2,
  UserPlus,
  Wallet,
} from "lucide-react";
import { apiFetch, apiUrl } from "../lib/api";
import { readApiError } from "../lib/luckySpinAdmin";

interface Overview {
  days: number;
  from: string;
  to: string;
  kpis: {
    revenue: number;
    revenuePrev: number;
    paidOrders: number;
    paidOrdersPrev: number;
    averageOrderValue: number;
    averageOrderValuePrev: number;
    newCustomers: number;
    newCustomersPrev: number;
    discountGiven: number;
    totalOrders: number;
    cancelledOrders: number;
    conversionRate: number;
    spins: number;
  };
  series: { date: string; revenue: number; orders: number }[];
  statusBreakdown: { status: string; count: number; amount: number }[];
  paymentSplit: { method: string; count: number; revenue: number }[];
  topGames: { gameId: string; name: string; quantity: number; revenue: number }[];
  byProductType: { type: string; quantity: number; revenue: number }[];
  queue: { status: string; count: number }[];
}

const RANGES = [
  { days: 7, label: "7 ngày" },
  { days: 30, label: "30 ngày" },
  { days: 90, label: "90 ngày" },
  { days: 365, label: "12 tháng" },
];

const STATUS_LABELS: Record<string, string> = {
  Pending: "Chờ thanh toán",
  AwaitingConfirmation: "Chờ xác nhận CK",
  Verifying: "Đang xác minh",
  Installing: "Đang cài đặt",
  ActionRequired: "Cần khách xử lý",
  Completed: "Hoàn thành",
  Cancelled: "Đã hủy",
};

const TYPE_LABELS: Record<string, string> = {
  Game: "Game",
  GamePass: "Game Pass",
  GiftCard: "Gift Card",
  DLC: "DLC",
  Bundle: "Bundle",
};

const vnd = (n: number) => n.toLocaleString("vi-VN") + "đ";
const compact = (n: number) =>
  n >= 1_000_000_000 ? `${+(n / 1_000_000_000).toFixed(1)} tỷ` : n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}tr` : n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`;
const dayLabel = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

function Delta({ now, prev }: { now: number; prev: number }) {
  if (prev === 0 && now === 0) return <span className="text-[11px] text-steam-muted">—</span>;
  if (prev === 0) return <span className="text-[11px] text-steam-muted">mới</span>;
  const pct = Math.round(((now - prev) / prev) * 100);
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${up ? "text-steam-green" : "text-red-400"}`}>
      {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {Math.abs(pct)}%
      <span className="font-normal text-steam-muted ml-1">so với kỳ trước</span>
    </span>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  now,
  prev,
  hint,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  now?: number;
  prev?: number;
  hint?: string;
}) {
  return (
    <div className="bg-steam-surface border border-steam-border rounded-sm p-3 md:p-4 space-y-1.5 min-w-0">
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-steam-muted">
        <Icon size={12} /> {label}
      </p>
      <p className="text-xl md:text-2xl font-bold text-white font-mono truncate">{value}</p>
      {now !== undefined && prev !== undefined ? <Delta now={now} prev={prev} /> : <p className="text-[11px] text-steam-muted">{hint}</p>}
    </div>
  );
}

/** Single-series daily revenue columns with hover tooltip (orders shown in tooltip, never a 2nd axis). */
function RevenueChart({ series }: { series: Overview["series"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = 220;
  const pad = { l: 44, r: 8, t: 12, b: 26 };
  const max = Math.max(1, ...series.map((s) => s.revenue));
  // Nice ceiling for gridlines.
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const ceil = Math.ceil(max / step) * step;
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const slot = innerW / series.length;
  const gap = series.length > 60 ? 1 : 2;
  const barW = Math.max(1, slot - gap);
  const y = (v: number) => pad.t + innerH - (v / ceil) * innerH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * ceil);
  const labelEvery = Math.ceil(series.length / 8);
  const h = hover != null ? series[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Doanh thu theo ngày" onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="currentColor" className="text-steam-border" strokeWidth={t === 0 ? 1 : 0.5} strokeDasharray={t === 0 ? undefined : "2 4"} />
            <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" className="fill-steam-muted" fontSize="10">
              {compact(t)}
            </text>
          </g>
        ))}
        {series.map((s, i) => {
          const x = pad.l + i * slot + gap / 2;
          const top = y(s.revenue);
          const hgt = Math.max(0, pad.t + innerH - top);
          const r = Math.min(4, barW / 2, hgt);
          return (
            <g key={s.date}>
              {/* hit target: full column height */}
              <rect x={pad.l + i * slot} y={pad.t} width={slot} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} />
              {hgt > 0 && (
                <path
                  d={`M${x},${pad.t + innerH} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${pad.t + innerH} Z`}
                  className={hover === i ? "fill-steam-blue" : "fill-steam-blue/70"}
                  pointerEvents="none"
                />
              )}
              {i % labelEvery === 0 && (
                <text x={pad.l + i * slot + slot / 2} y={H - 8} textAnchor="middle" className="fill-steam-muted" fontSize="10">
                  {dayLabel(s.date)}
                </text>
              )}
            </g>
          );
        })}
        {hover != null && (
          <line x1={pad.l + hover * slot + slot / 2} x2={pad.l + hover * slot + slot / 2} y1={pad.t} y2={pad.t + innerH} stroke="currentColor" className="text-steam-muted" strokeWidth={0.5} pointerEvents="none" />
        )}
      </svg>
      {h && hover != null && (
        <div
          className="pointer-events-none absolute top-1 z-10 px-2.5 py-1.5 rounded-sm bg-steam-bg border border-steam-border shadow-lg text-[11px] whitespace-nowrap"
          style={{ left: `${Math.min(80, Math.max(8, ((pad.l + hover * slot) / W) * 100))}%` }}
        >
          <p className="text-steam-muted">{h.date.split("-").reverse().join("/")}</p>
          <p className="text-white font-semibold font-mono">{vnd(h.revenue)}</p>
          <p className="text-steam-muted">{h.orders} đơn đã thanh toán</p>
        </div>
      )}
    </div>
  );
}

/** Horizontal magnitude bars (single hue) with value labels in text ink. */
function BarList({ rows, emptyText }: { rows: { key: string; label: React.ReactNode; value: number; sub?: string }[]; emptyText: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="text-xs text-steam-muted py-6 text-center">{emptyText}</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key} className="group" title={`${vnd(r.value)}${r.sub ? " · " + r.sub : ""}`}>
          <div className="flex items-baseline justify-between gap-3 text-xs mb-1">
            <span className="text-steam-text truncate">{r.label}</span>
            <span className="text-white font-mono font-semibold whitespace-nowrap">
              {compact(r.value)}
              {r.sub && <span className="text-steam-muted font-normal ml-1.5">{r.sub}</span>}
            </span>
          </div>
          <div className="h-1.5 bg-steam-bg rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-steam-blue/70 group-hover:bg-steam-blue transition-colors" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function Dashboard() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await apiFetch(apiUrl(`/api/admin/reports/overview?days=${days}`));
        if (!res.ok) throw new Error(await readApiError(res, "Không tải được báo cáo"));
        const json: Overview = await res.json();
        if (!cancelled) {
          setData(json);
          setError("");
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Không tải được báo cáo");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [days]);

  const queueTotal = useMemo(() => data?.queue.reduce((s, q) => s + q.count, 0) ?? 0, [data]);

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-white font-mono tracking-tight">Tổng quan</h1>
          <p className="text-xs text-steam-muted mt-0.5">
            Doanh thu tính trên đơn đã xác nhận thanh toán{data ? ` · ${data.from.split("-").reverse().join("/")} – ${data.to.split("-").reverse().join("/")}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {loading && data && <Loader2 size={14} className="animate-spin text-steam-muted" />}
          <div className="flex rounded-sm border border-steam-border overflow-hidden" role="group" aria-label="Khoảng thời gian">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setDays(r.days)}
                aria-pressed={days === r.days}
                className={`px-3 py-1.5 text-xs font-semibold border-l border-steam-border first:border-l-0 ${
                  days === r.days ? "bg-steam-blue/15 text-steam-blue" : "text-steam-muted hover:text-steam-text"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-1.5 px-3 py-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          <AlertCircle size={12} /> {error}
        </div>
      )}

      {!data ? (
        <div className="py-16 flex justify-center text-steam-muted">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : (
        <div className={`space-y-4 md:space-y-5 transition-opacity ${loading ? "opacity-60" : ""}`}>
          {/* Work queue */}
          {queueTotal > 0 && (
            <Link
              to="/orders"
              className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 rounded-sm border border-steam-gold/30 bg-steam-gold/5 hover:bg-steam-gold/10 transition-colors"
            >
              <span className="flex items-center gap-1.5 text-xs font-semibold text-steam-gold">
                <Clock size={13} /> {queueTotal} đơn cần xử lý
              </span>
              {data.queue.map((q) => (
                <span key={q.status} className="text-xs text-steam-text">
                  {STATUS_LABELS[q.status] ?? q.status}: <b className="text-white">{q.count}</b>
                </span>
              ))}
              <span className="text-xs text-steam-blue sm:ml-auto">Mở danh sách đơn →</span>
            </Link>
          )}

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi icon={Wallet} label="Doanh thu" value={vnd(data.kpis.revenue)} now={data.kpis.revenue} prev={data.kpis.revenuePrev} />
            <Kpi icon={ShoppingBag} label="Đơn đã thanh toán" value={String(data.kpis.paidOrders)} now={data.kpis.paidOrders} prev={data.kpis.paidOrdersPrev} />
            <Kpi icon={BarChart3} label="Giá trị TB / đơn" value={vnd(data.kpis.averageOrderValue)} now={data.kpis.averageOrderValue} prev={data.kpis.averageOrderValuePrev} />
            <Kpi icon={UserPlus} label="Khách mới" value={String(data.kpis.newCustomers)} now={data.kpis.newCustomers} prev={data.kpis.newCustomersPrev} />
            <Kpi icon={Package} label="Tổng đơn tạo" value={String(data.kpis.totalOrders)} hint={`${data.kpis.cancelledOrders} đơn đã hủy`} />
            <Kpi icon={Percent} label="Tỷ lệ thanh toán" value={`${data.kpis.conversionRate}%`} hint="đơn đã thanh toán / đơn tạo" />
            <Kpi icon={Percent} label="Đã giảm giá" value={vnd(data.kpis.discountGiven)} hint="tổng coupon trên đơn đã thanh toán" />
            <Kpi icon={Gift} label="Lượt mở hòm" value={String(data.kpis.spins)} hint="trong khoảng thời gian" />
          </div>

          {/* Revenue over time */}
          <section className="bg-steam-surface border border-steam-border rounded-sm p-3 md:p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-semibold text-steam-muted uppercase tracking-widest">Doanh thu theo ngày</h2>
              <button onClick={() => setShowTable((v) => !v)} className="inline-flex items-center gap-1 text-[11px] text-steam-muted hover:text-steam-text">
                {showTable ? <BarChart3 size={12} /> : <Table2 size={12} />} {showTable ? "Xem biểu đồ" : "Xem bảng"}
              </button>
            </div>
            {showTable ? (
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-steam-surface">
                    <tr className="text-steam-muted text-left">
                      <th className="py-1.5 font-medium">Ngày</th>
                      <th className="py-1.5 font-medium text-right">Đơn</th>
                      <th className="py-1.5 font-medium text-right">Doanh thu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-steam-border">
                    {[...data.series].reverse().map((s) => (
                      <tr key={s.date}>
                        <td className="py-1.5 text-steam-text">{s.date.split("-").reverse().join("/")}</td>
                        <td className="py-1.5 text-right text-steam-text font-mono">{s.orders}</td>
                        <td className="py-1.5 text-right text-white font-mono">{vnd(s.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : data.kpis.revenue === 0 ? (
              <p className="text-xs text-steam-muted py-12 text-center">Chưa có doanh thu trong khoảng thời gian này.</p>
            ) : (
              <RevenueChart series={data.series} />
            )}
          </section>

          <div className="grid lg:grid-cols-3 gap-3 md:gap-4">
            <section className="lg:col-span-2 bg-steam-surface border border-steam-border rounded-sm p-3 md:p-4">
              <h2 className="text-xs font-semibold text-steam-muted uppercase tracking-widest mb-3">Top game theo doanh thu</h2>
              <BarList
                emptyText="Chưa có đơn đã thanh toán."
                rows={data.topGames.map((g) => ({ key: g.gameId, label: g.name, value: g.revenue, sub: `${g.quantity} bản` }))}
              />
            </section>
            <section className="bg-steam-surface border border-steam-border rounded-sm p-3 md:p-4 space-y-5">
              <div>
                <h2 className="text-xs font-semibold text-steam-muted uppercase tracking-widest mb-3">Theo loại sản phẩm</h2>
                <BarList
                  emptyText="Chưa có dữ liệu."
                  rows={data.byProductType.map((t) => ({ key: t.type, label: TYPE_LABELS[t.type] ?? t.type, value: t.revenue, sub: `${t.quantity}` }))}
                />
              </div>
              <div>
                <h2 className="text-xs font-semibold text-steam-muted uppercase tracking-widest mb-3">Phương thức thanh toán</h2>
                <BarList
                  emptyText="Chưa có dữ liệu."
                  rows={data.paymentSplit.map((p) => ({ key: p.method, label: p.method === "Crypto" ? "Crypto" : "Chuyển khoản", value: p.revenue, sub: `${p.count} đơn` }))}
                />
              </div>
            </section>
          </div>

          <section className="bg-steam-surface border border-steam-border rounded-sm p-3 md:p-4">
            <h2 className="text-xs font-semibold text-steam-muted uppercase tracking-widest mb-3">Đơn theo trạng thái (trong kỳ)</h2>
            {data.statusBreakdown.length === 0 ? (
              <p className="text-xs text-steam-muted py-4 text-center">Chưa có đơn.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                {data.statusBreakdown.map((s) => (
                  <div key={s.status} className="px-3 py-2 rounded-sm border border-steam-border bg-steam-bg/40">
                    <p className="text-[11px] text-steam-muted truncate">{STATUS_LABELS[s.status] ?? s.status}</p>
                    <p className="text-lg font-bold text-white font-mono">{s.count}</p>
                    <p className="text-[10px] text-steam-muted font-mono truncate">{compact(s.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
