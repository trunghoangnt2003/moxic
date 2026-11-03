import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  History,
  Loader2,
  RotateCcw,
  Search,
} from "lucide-react";
import { apiFetch, apiUrl } from "../lib/api";

type SpinPrizeType = "Luck" | "Discount" | "Game";

interface AdminSpin {
  id: string;
  codeText: string;
  prizeName: string;
  prizeType: SpinPrizeType;
  gameId: string | null;
  rewardCode: string | null;
  isClaimed: boolean;
  claimedAt: string | null;
  clientIp: string | null;
  createdAt: string;
}

interface Paged<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

type ClaimedFilter = "all" | "false" | "true";

const PAGE_SIZE = 50;

const TYPE_LABELS: Record<SpinPrizeType, string> = {
  Luck: "Chúc may mắn",
  Discount: "Giảm giá",
  Game: "Game",
};

const TYPE_BADGE: Record<SpinPrizeType, string> = {
  Luck: "bg-steam-surface-3 text-steam-muted border-steam-border",
  Discount: "bg-steam-gold/10 text-steam-gold border-steam-gold/30",
  Game: "bg-steam-blue/10 text-steam-blue border-steam-blue/30",
};

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("vi-VN") : "—");

export default function LuckySpinHistory() {
  const [data, setData] = useState<Paged<AdminSpin>>({ items: [], totalCount: 0, page: 1, pageSize: PAGE_SIZE });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [claimed, setClaimed] = useState<ClaimedFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const h = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(h);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
        if (debouncedSearch) qs.set("search", debouncedSearch);
        if (claimed !== "all") qs.set("claimed", claimed);
        const res = await apiFetch(apiUrl(`/api/admin/lucky-spin/history?${qs.toString()}`));
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          if (!cancelled) setError(err.error || "Không tải được lịch sử quay");
          return;
        }
        const json: Paged<AdminSpin> = await res.json();
        if (!cancelled) {
          setData(json);
          setError("");
        }
      } catch {
        if (!cancelled) setError("Không tải được lịch sử quay");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [page, debouncedSearch, claimed]);

  const setClaim = async (s: AdminSpin, value: boolean) => {
    setBusyId(s.id);
    setError("");
    try {
      const res = await apiFetch(apiUrl(`/api/admin/lucky-spin/history/${s.id}/claim`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isClaimed: value }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Không cập nhật được trạng thái trao giải");
        return;
      }
      const updated: AdminSpin = await res.json();
      setData((d) => ({ ...d, items: d.items.map((x) => (x.id === updated.id ? updated : x)) }));
    } finally {
      setBusyId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(data.totalCount / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="relative w-full sm:max-w-sm">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-steam-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value.toUpperCase())}
            placeholder="Tìm theo mã quay hoặc mã thưởng"
            className="w-full steam-input pl-8 font-mono"
          />
        </div>
        <select
          value={claimed}
          onChange={(e) => {
            setClaimed(e.target.value as ClaimedFilter);
            setPage(1);
          }}
          className="steam-input sm:w-40"
        >
          <option value="all">Tất cả</option>
          <option value="false">Chưa trao</option>
          <option value="true">Đã trao</option>
        </select>
        <p className="text-xs text-steam-muted sm:ml-auto">{data.totalCount} lượt quay</p>
      </div>

      {error && (
        <div className="flex items-center gap-1.5 px-3 py-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          <AlertCircle size={12} /> {error}
        </div>
      )}

      <div className="bg-steam-surface border border-steam-border rounded-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead>
            <tr className="border-b border-steam-border bg-steam-bg/30">
              {["Thời gian", "Mã quay", "Giải thưởng", "Mã thưởng", "IP", "Trao giải", "Lúc trao"].map((h) => (
                <th key={h} className="text-left px-3 py-2.5 text-[11px] font-medium text-steam-muted uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-steam-border">
            {data.items.map((s) => (
              <tr key={s.id} className="hover:bg-steam-surface-2/50 transition-colors">
                <td className="px-3 py-2.5 text-xs text-steam-muted whitespace-nowrap">{fmt(s.createdAt)}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-steam-text tracking-wider">{s.codeText}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-white text-xs font-medium truncate max-w-[200px]" title={s.prizeName}>
                      {s.prizeName}
                    </span>
                    <span className={`inline-flex px-1.5 py-0.5 rounded-sm text-[10px] font-semibold border whitespace-nowrap ${TYPE_BADGE[s.prizeType]}`}>
                      {TYPE_LABELS[s.prizeType]}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2.5 font-mono text-xs tracking-wider text-steam-gold">{s.rewardCode ?? "—"}</td>
                <td className="px-3 py-2.5 font-mono text-[11px] text-steam-muted">{s.clientIp ?? "—"}</td>
                <td className="px-3 py-2.5">
                  {s.prizeType === "Luck" ? (
                    <span className="text-xs text-steam-muted">—</span>
                  ) : s.isClaimed ? (
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 text-[11px] text-steam-green whitespace-nowrap">
                        <CheckCircle2 size={12} /> Đã trao
                      </span>
                      <button
                        onClick={() => setClaim(s, false)}
                        disabled={busyId === s.id}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[10px] text-steam-muted border border-steam-border hover:text-steam-text whitespace-nowrap"
                      >
                        {busyId === s.id ? <Loader2 size={10} className="animate-spin" /> : <RotateCcw size={10} />} Hoàn tác
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setClaim(s, true)}
                      disabled={busyId === s.id}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-sm text-[11px] font-semibold bg-steam-blue/10 text-steam-blue border border-steam-blue/30 hover:bg-steam-blue/20 whitespace-nowrap"
                    >
                      {busyId === s.id ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />} Đánh dấu đã trao
                    </button>
                  )}
                </td>
                <td className="px-3 py-2.5 text-xs text-steam-muted whitespace-nowrap">{fmt(s.claimedAt)}</td>
              </tr>
            ))}
            {!loading && data.items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-steam-muted">
                  <History size={28} className="mx-auto mb-2 text-steam-border" />
                  <p className="text-sm">Chưa có lượt quay nào</p>
                </td>
              </tr>
            )}
            {loading && data.items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-steam-muted">
                  <Loader2 size={18} className="mx-auto animate-spin" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data.totalCount > PAGE_SIZE && (
        <div className="flex items-center justify-end gap-2 text-xs text-steam-muted">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="steam-btn bg-steam-surface-3 border border-steam-border px-2 py-1"
          >
            <ChevronLeft size={13} />
          </button>
          <span>
            Trang {page}/{totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="steam-btn bg-steam-surface-3 border border-steam-border px-2 py-1"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
