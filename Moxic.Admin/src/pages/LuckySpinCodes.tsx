import { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  KeyRound,
  Loader2,
  Power,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { apiFetch, apiUrl } from "../lib/api";
import type { OpenMethod } from "../lib/luckySpinAdmin";

type CodeStatus = "Active" | "UsedUp" | "Expired" | "Disabled";

interface AdminCode {
  id: string;
  code: string;
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
  note: string | null;
  status: CodeStatus;
  createdAt: string;
}

interface Paged<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 50;

const STATUS_STYLES: Record<CodeStatus, { label: string; cls: string }> = {
  Active: { label: "Còn hiệu lực", cls: "bg-steam-green/10 text-steam-green border-steam-green/30" },
  UsedUp: { label: "Hết lượt", cls: "bg-steam-surface-3 text-steam-muted border-steam-border" },
  Expired: { label: "Hết hạn", cls: "bg-steam-gold/10 text-steam-gold border-steam-gold/30" },
  Disabled: { label: "Vô hiệu", cls: "bg-red-500/10 text-red-400 border-red-500/30" },
};

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString("vi-VN") : "Không giới hạn");

interface LuckySpinCodesProps {
  caseId: string;
  openMethod: OpenMethod;
}

export default function LuckySpinCodes({ caseId, openMethod }: LuckySpinCodesProps) {
  const isCodeCase = openMethod === "Code";
  // Generate panel
  const [count, setCount] = useState("1");
  const [maxUses, setMaxUses] = useState("1");
  const [expiresAt, setExpiresAt] = useState("");
  const [note, setNote] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<string[]>([]);
  const [copiedAll, setCopiedAll] = useState(false);
  const [genError, setGenError] = useState("");

  // List
  const [data, setData] = useState<Paged<AdminCode>>({ items: [], totalCount: 0, page: 1, pageSize: PAGE_SIZE });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const h = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(h);
  }, [search]);

  const load = async (p = page, s = debouncedSearch) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
      if (s) qs.set("search", s);
      const res = await apiFetch(apiUrl(`/api/admin/lucky-spin/cases/${caseId}/codes?${qs.toString()}`));
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Không tải được danh sách mã");
        return;
      }
      setData(await res.json());
      setError("");
    } catch {
      setError("Không tải được danh sách mã");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(page, debouncedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenError("");
    const n = Number.parseInt(count, 10);
    const uses = Number.parseInt(maxUses, 10);
    if (!Number.isFinite(n) || n < 1 || n > 500) {
      setGenError("Số lượng mã phải từ 1 đến 500.");
      return;
    }
    if (!Number.isFinite(uses) || uses < 1 || uses > 1000) {
      setGenError("Số lượt dùng mỗi mã phải từ 1 đến 1000.");
      return;
    }

    const body: { count: number; maxUses: number; expiresAt?: string; note?: string } = { count: n, maxUses: uses };
    if (expiresAt) {
      const d = new Date(expiresAt);
      if (Number.isNaN(d.getTime()) || d.getTime() <= Date.now()) {
        setGenError("Thời hạn phải ở tương lai.");
        return;
      }
      body.expiresAt = d.toISOString();
    }
    if (note.trim()) body.note = note.trim();

    setGenerating(true);
    try {
      const res = await apiFetch(apiUrl(`/api/admin/lucky-spin/cases/${caseId}/codes/generate`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setGenError(err.error || "Không tạo được mã");
        return;
      }
      const json: { codes: string[] } = await res.json();
      setGenerated(json.codes);
      setCopiedAll(false);
      if (page !== 1) setPage(1);
      else await load(1, debouncedSearch);
    } catch {
      setGenError("Không tạo được mã");
    } finally {
      setGenerating(false);
    }
  };

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(generated.join("\n"));
      setCopiedAll(true);
      window.setTimeout(() => setCopiedAll(false), 1500);
    } catch {
      setGenError("Trình duyệt không cho phép sao chép — hãy chọn và copy thủ công.");
    }
  };

  const copyOne = async (c: AdminCode) => {
    try {
      await navigator.clipboard.writeText(c.code);
      setCopiedId(c.id);
      window.setTimeout(() => setCopiedId(null), 1200);
    } catch {
      /* ignore */
    }
  };

  const toggle = async (c: AdminCode) => {
    setBusyId(c.id);
    setError("");
    try {
      const res = await apiFetch(apiUrl(`/api/admin/lucky-spin/codes/${c.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !c.isActive }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Không cập nhật được mã");
        return;
      }
      const updated: AdminCode = await res.json();
      setData((d) => ({ ...d, items: d.items.map((x) => (x.id === updated.id ? updated : x)) }));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (c: AdminCode) => {
    if (!window.confirm(`Xóa mã ${c.code}?`)) return;
    setBusyId(c.id);
    setError("");
    try {
      const res = await apiFetch(apiUrl(`/api/admin/lucky-spin/codes/${c.id}`), { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Không xóa được mã");
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(data.totalCount / PAGE_SIZE));

  return (
    <div className="space-y-4">
      {!isCodeCase && (
        <div className="flex items-start gap-1.5 px-3 py-2 rounded-sm bg-steam-gold/5 border border-steam-gold/20 text-xs text-steam-gold">
          <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
          Hòm này không mở bằng mã quay — không cần tạo mã.
        </div>
      )}

      {/* Generate panel */}
      {isCodeCase && (
      <form onSubmit={handleGenerate} className="bg-steam-surface border border-steam-border rounded-sm p-4 md:p-5 space-y-3">
        <h2 className="text-xs font-semibold text-steam-muted uppercase tracking-widest">Tạo mã quay</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-steam-muted mb-1">Số lượng (1–500)</label>
            <input type="number" min={1} max={500} value={count} onChange={(e) => setCount(e.target.value)} className="w-full steam-input" />
          </div>
          <div>
            <label className="block text-xs text-steam-muted mb-1">Lượt dùng / mã</label>
            <input type="number" min={1} max={1000} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} className="w-full steam-input" />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="block text-xs text-steam-muted mb-1">Hết hạn (tùy chọn)</label>
            <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="w-full steam-input" />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="block text-xs text-steam-muted mb-1">Ghi chú (tùy chọn)</label>
            <input maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: Event tháng 11" className="w-full steam-input" />
          </div>
        </div>

        {genError && (
          <div className="flex items-center gap-1.5 px-3 py-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-400">
            <AlertCircle size={12} className="flex-shrink-0" /> {genError}
          </div>
        )}

        <div className="flex justify-end">
          <button type="submit" disabled={generating} className="steam-btn bg-steam-blue text-black hover:bg-steam-blue-hover glow-blue text-xs md:text-sm w-full sm:w-auto justify-center">
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Tạo mã
          </button>
        </div>

        {generated.length > 0 && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-steam-green">Đã tạo {generated.length} mã</p>
              <button
                type="button"
                onClick={copyAll}
                className="steam-btn bg-steam-surface-3 text-steam-text border border-steam-border hover:border-steam-blue/40 text-xs px-3 py-1.5"
              >
                {copiedAll ? <Check size={12} /> : <Copy size={12} />} Copy tất cả
              </button>
            </div>
            <textarea
              readOnly
              value={generated.join("\n")}
              rows={Math.min(8, Math.max(2, generated.length))}
              className="w-full steam-input font-mono text-xs tracking-wider resize-y"
              onFocus={(e) => e.currentTarget.select()}
            />
          </div>
        )}
      </form>
      )}

      {/* Search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-steam-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value.toUpperCase())}
            placeholder="Tìm mã..."
            className="w-full steam-input pl-8 font-mono uppercase"
          />
        </div>
        <p className="text-xs text-steam-muted">{data.totalCount} mã</p>
      </div>

      {error && (
        <div className="flex items-center gap-1.5 px-3 py-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          <AlertCircle size={12} /> {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-steam-surface border border-steam-border rounded-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="border-b border-steam-border bg-steam-bg/30">
              {["Mã", "Đã dùng", "Hết hạn", "Trạng thái", "Ghi chú", "Ngày tạo", ""].map((h, i) => (
                <th key={i} className="text-left px-3 py-2.5 text-[11px] font-medium text-steam-muted uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-steam-border">
            {data.items.map((c) => {
              const st = STATUS_STYLES[c.status];
              return (
                <tr key={c.id} className="hover:bg-steam-surface-2/50 transition-colors">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-white tracking-wider">{c.code}</span>
                      <button onClick={() => copyOne(c)} className="p-1 rounded text-steam-muted hover:text-steam-blue" title="Copy">
                        {copiedId === c.id ? <Check size={12} className="text-steam-green" /> : <Copy size={12} />}
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-steam-text whitespace-nowrap">
                    {c.usedCount}/{c.maxUses}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-steam-muted whitespace-nowrap">{fmtDate(c.expiresAt)}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex px-1.5 py-0.5 rounded-sm text-[10px] font-semibold border whitespace-nowrap ${st.cls}`}>
                      {st.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-steam-muted max-w-[180px] truncate" title={c.note ?? ""}>
                    {c.note || "—"}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-steam-muted whitespace-nowrap">
                    {new Date(c.createdAt).toLocaleString("vi-VN")}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      <button
                        onClick={() => toggle(c)}
                        disabled={busyId === c.id}
                        className={`p-1.5 rounded transition-colors ${
                          c.isActive
                            ? "text-steam-green hover:text-steam-accent hover:bg-steam-accent/10"
                            : "text-steam-muted hover:text-steam-green hover:bg-steam-green/10"
                        }`}
                        title={c.isActive ? "Vô hiệu hóa" : "Kích hoạt lại"}
                      >
                        {busyId === c.id ? <Loader2 size={13} className="animate-spin" /> : <Power size={13} />}
                      </button>
                      <button
                        onClick={() => remove(c)}
                        disabled={busyId === c.id}
                        className="p-1.5 rounded text-steam-muted hover:text-steam-accent hover:bg-steam-accent/10 transition-colors"
                        title="Xóa"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!loading && data.items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-steam-muted">
                  <KeyRound size={28} className="mx-auto mb-2 text-steam-border" />
                  <p className="text-sm">Chưa có mã quay nào</p>
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

      {/* Pagination */}
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
