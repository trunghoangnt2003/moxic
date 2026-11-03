import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Coins,
  History,
  Loader2,
  Minus,
  Plus,
  Save,
  Search,
  Users,
  X,
} from "lucide-react";
import { apiFetch, apiUrl } from "../lib/api";
import { readApiError } from "../lib/luckySpinAdmin";

interface AdminCustomer {
  userId: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  points: number;
  createdAt: string | null;
}

type PointsReason = "OrderCompleted" | "CaseOpen" | "AdminAdjust";

interface AdminPointsTx {
  id: string;
  delta: number;
  reason: PointsReason;
  refId: string | null;
  note: string | null;
  balanceAfter: number;
  createdBy: string | null;
  createdAt: string;
}

interface Paged<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

type SortKey = "newest" | "points";

const PAGE_SIZE = 20;
const LEDGER_PAGE_SIZE = 15;

const REASON_LABELS: Record<PointsReason, string> = {
  OrderCompleted: "Hoàn tất đơn hàng",
  CaseOpen: "Mở hòm",
  AdminAdjust: "Điều chỉnh thủ công",
};

const fmtPoints = (n: number) => n.toLocaleString("vi-VN");
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString("vi-VN") : "—");
const fmtDay = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("vi-VN") : "—");

function VerifiedBadge({ verified }: { verified: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] font-semibold border whitespace-nowrap ${
        verified
          ? "bg-steam-green/10 text-steam-green border-steam-green/30"
          : "bg-steam-gold/10 text-steam-gold border-steam-gold/30"
      }`}
    >
      {verified ? "Đã xác minh" : "Chưa xác minh"}
    </span>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto bg-steam-surface border border-steam-border rounded-t-md sm:rounded-sm p-4 md:p-5 space-y-3"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold text-steam-muted uppercase tracking-widest truncate">{title}</h2>
          <button type="button" onClick={onClose} className="p-1 rounded text-steam-muted hover:text-steam-text" aria-label="Đóng">
            <X size={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AdjustModal({
  customer,
  onClose,
  onDone,
}: {
  customer: AdminCustomer;
  onClose: () => void;
  onDone: (balance: number) => void;
}) {
  const [sign, setSign] = useState<1 | -1>(1);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const value = Number.parseInt(amount, 10);
  const delta = Number.isFinite(value) ? sign * value : 0;
  const resulting = customer.points + delta;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!Number.isFinite(value) || value < 1 || value > 1_000_000) {
      setError("Số điểm điều chỉnh phải khác 0 và không vượt quá 1.000.000.");
      return;
    }
    const trimmed = note.trim();
    if (trimmed.length < 2 || trimmed.length > 200) {
      setError("Vui lòng nhập lý do điều chỉnh (2–200 ký tự).");
      return;
    }
    if (resulting < 0) {
      setError(`Số dư không đủ để trừ (hiện có ${fmtPoints(customer.points)} điểm).`);
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch(apiUrl(`/api/admin/customers/${encodeURIComponent(customer.userId)}/points`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta, note: trimmed }),
      });
      if (!res.ok) {
        setError(await readApiError(res, "Không điều chỉnh được điểm"));
        return;
      }
      const json: { balance: number } = await res.json();
      onDone(json.balance);
    } catch {
      setError("Không điều chỉnh được điểm");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Điều chỉnh điểm · ${customer.email}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-xs text-steam-muted">
          Số dư hiện tại: <span className="text-steam-gold font-semibold">{fmtPoints(customer.points)} điểm</span>
        </p>
        <div className="flex gap-2">
          <div className="flex rounded-sm border border-steam-border overflow-hidden flex-shrink-0" role="group" aria-label="Cộng hoặc trừ">
            <button
              type="button"
              onClick={() => setSign(1)}
              aria-pressed={sign === 1}
              className={`px-3 py-2 text-xs font-semibold flex items-center gap-1 ${
                sign === 1 ? "bg-steam-green/15 text-steam-green" : "text-steam-muted hover:text-steam-text"
              }`}
            >
              <Plus size={12} /> Cộng
            </button>
            <button
              type="button"
              onClick={() => setSign(-1)}
              aria-pressed={sign === -1}
              className={`px-3 py-2 text-xs font-semibold flex items-center gap-1 border-l border-steam-border ${
                sign === -1 ? "bg-red-500/15 text-red-400" : "text-steam-muted hover:text-steam-text"
              }`}
            >
              <Minus size={12} /> Trừ
            </button>
          </div>
          <input
            type="number"
            min={1}
            max={1000000}
            step={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Số điểm"
            className="w-full steam-input"
            required
          />
        </div>
        <div>
          <label className="block text-xs text-steam-muted mb-1">
            Lý do <span className="text-steam-accent">*</span>
          </label>
          <input
            value={note}
            maxLength={200}
            onChange={(e) => setNote(e.target.value)}
            placeholder="VD: Bù điểm cho đơn MOXIC-..."
            className="w-full steam-input"
            required
          />
          <p className="text-[11px] text-steam-muted mt-1">Ghi chú sẽ hiển thị trong lịch sử điểm của khách hàng.</p>
        </div>
        <p className={`text-xs ${resulting < 0 ? "text-red-400" : "text-steam-text"}`}>
          Số dư sau điều chỉnh: <span className="font-semibold">{fmtPoints(resulting)} điểm</span>
        </p>
        {error && (
          <div className="flex items-center gap-1.5 px-3 py-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-400">
            <AlertCircle size={12} className="flex-shrink-0" /> {error}
          </div>
        )}
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="steam-btn bg-steam-surface-3 text-steam-muted hover:text-steam-text border border-steam-border text-xs md:text-sm"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={saving}
            className="steam-btn bg-steam-blue text-black hover:bg-steam-blue-hover text-xs md:text-sm"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Lưu
          </button>
        </div>
      </form>
    </Modal>
  );
}

function LedgerModal({ customer, onClose }: { customer: AdminCustomer; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<(Paged<AdminPointsTx> & { balance: number }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({ page: String(page), pageSize: String(LEDGER_PAGE_SIZE) });
        const res = await apiFetch(
          apiUrl(`/api/admin/customers/${encodeURIComponent(customer.userId)}/points?${qs.toString()}`)
        );
        if (!res.ok) {
          const msg = await readApiError(res, "Không tải được lịch sử điểm");
          if (!cancelled) setError(msg);
          return;
        }
        const json = await res.json();
        if (!cancelled) {
          setData(json);
          setError("");
        }
      } catch {
        if (!cancelled) setError("Không tải được lịch sử điểm");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [page, customer.userId]);

  const totalPages = data ? Math.max(1, Math.ceil(data.totalCount / LEDGER_PAGE_SIZE)) : 1;

  return (
    <Modal title={`Lịch sử điểm · ${customer.email}`} onClose={onClose}>
      {data && (
        <p className="text-xs text-steam-muted">
          Số dư: <span className="text-steam-gold font-semibold">{fmtPoints(data.balance)} điểm</span> · {data.totalCount} giao dịch
        </p>
      )}
      {error && (
        <div className="flex items-center gap-1.5 px-3 py-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          <AlertCircle size={12} /> {error}
        </div>
      )}
      <div className="border border-steam-border rounded-sm overflow-x-auto">
        <table className="w-full text-xs min-w-[620px]">
          <thead>
            <tr className="border-b border-steam-border bg-steam-bg/30">
              {["Thời gian", "Lý do", "Ghi chú", "Điểm", "Số dư", "Bởi"].map((h) => (
                <th key={h} className="text-left px-2.5 py-2 text-[10px] font-medium text-steam-muted uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-steam-border">
            {data?.items.map((t) => (
              <tr key={t.id}>
                <td className="px-2.5 py-2 text-steam-muted whitespace-nowrap">{fmtDate(t.createdAt)}</td>
                <td className="px-2.5 py-2 text-steam-text whitespace-nowrap">{REASON_LABELS[t.reason] ?? t.reason}</td>
                <td className="px-2.5 py-2 text-steam-muted max-w-[200px] truncate" title={t.note ?? ""}>
                  {t.note ?? "—"}
                </td>
                <td className={`px-2.5 py-2 font-mono font-semibold whitespace-nowrap ${t.delta >= 0 ? "text-steam-green" : "text-red-400"}`}>
                  {t.delta >= 0 ? "+" : ""}
                  {fmtPoints(t.delta)}
                </td>
                <td className="px-2.5 py-2 font-mono text-steam-text">{fmtPoints(t.balanceAfter)}</td>
                <td className="px-2.5 py-2 text-steam-muted max-w-[160px] truncate" title={t.createdBy ?? ""}>
                  {t.createdBy ?? "Hệ thống"}
                </td>
              </tr>
            ))}
            {!loading && data && data.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-steam-muted">
                  Chưa có giao dịch điểm nào.
                </td>
              </tr>
            )}
            {loading && !data && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-steam-muted">
                  <Loader2 size={16} className="mx-auto animate-spin" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {data && data.totalCount > LEDGER_PAGE_SIZE && (
        <div className="flex items-center justify-end gap-2 text-xs text-steam-muted">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="steam-btn bg-steam-surface-3 border border-steam-border px-2 py-1"
            aria-label="Trang trước"
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
            aria-label="Trang sau"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      )}
    </Modal>
  );
}

export default function Customers() {
  const [data, setData] = useState<Paged<AdminCustomer>>({ items: [], totalCount: 0, page: 1, pageSize: PAGE_SIZE });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [adjusting, setAdjusting] = useState<AdminCustomer | null>(null);
  const [viewing, setViewing] = useState<AdminCustomer | null>(null);
  const [flash, setFlash] = useState("");

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
        const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), sort });
        if (debouncedSearch) qs.set("search", debouncedSearch);
        const res = await apiFetch(apiUrl(`/api/admin/customers?${qs.toString()}`));
        if (!res.ok) {
          const msg = await readApiError(res, "Không tải được danh sách khách hàng");
          if (!cancelled) setError(msg);
          return;
        }
        const json: Paged<AdminCustomer> = await res.json();
        if (!cancelled) {
          setData(json);
          setError("");
        }
      } catch {
        if (!cancelled) setError("Không tải được danh sách khách hàng");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [page, debouncedSearch, sort, reloadKey]);

  const totalPages = Math.max(1, Math.ceil(data.totalCount / PAGE_SIZE));

  const actions = (c: AdminCustomer) => (
    <div className="flex items-center gap-1 flex-shrink-0">
      <button
        onClick={() => setAdjusting(c)}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-sm text-[11px] font-semibold bg-steam-gold/10 text-steam-gold border border-steam-gold/30 hover:bg-steam-gold/20 whitespace-nowrap"
      >
        <Coins size={11} /> Điều chỉnh điểm
      </button>
      <button
        onClick={() => setViewing(c)}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-sm text-[11px] text-steam-muted border border-steam-border hover:text-steam-text whitespace-nowrap"
      >
        <History size={11} /> Lịch sử điểm
      </button>
    </div>
  );

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="min-w-0">
        <h1 className="text-lg font-bold text-white font-mono tracking-tight">Khách hàng</h1>
        <p className="text-xs text-steam-muted mt-0.5">Tài khoản khách, điểm thưởng và lịch sử điểm</p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="relative w-full sm:max-w-sm">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-steam-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo email hoặc tên"
            className="w-full steam-input pl-8"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value as SortKey);
            setPage(1);
          }}
          className="steam-input sm:w-44"
          aria-label="Sắp xếp"
        >
          <option value="newest">Mới nhất</option>
          <option value="points">Nhiều điểm nhất</option>
        </select>
        <p className="text-xs text-steam-muted sm:ml-auto">{data.totalCount} khách hàng</p>
      </div>

      {flash && (
        <div className="flex items-center gap-1.5 px-3 py-2 rounded bg-steam-green/10 border border-steam-green/30 text-xs text-steam-green">
          <CheckCircle2 size={12} /> {flash}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-1.5 px-3 py-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          <AlertCircle size={12} /> {error}
        </div>
      )}

      {loading && data.items.length === 0 ? (
        <div className="py-10 flex justify-center text-steam-muted">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : data.items.length === 0 ? (
        <div className="py-12 text-center text-steam-muted bg-steam-surface border border-steam-border rounded-sm">
          <Users size={28} className="mx-auto mb-2 text-steam-border" />
          <p className="text-sm">{debouncedSearch ? "Không tìm thấy khách hàng phù hợp" : "Chưa có khách hàng nào"}</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden bg-steam-surface border border-steam-border rounded-sm divide-y divide-steam-border">
            {data.items.map((c) => (
              <div key={c.userId} className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-white font-medium truncate">{c.displayName || "—"}</p>
                    <p className="text-xs text-steam-muted truncate">{c.email}</p>
                  </div>
                  <span className="text-sm font-mono font-semibold text-steam-gold whitespace-nowrap">
                    {fmtPoints(c.points)} đ
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-steam-muted">
                  <VerifiedBadge verified={c.emailVerified} />
                  <span>Tham gia {fmtDay(c.createdAt)}</span>
                </div>
                {actions(c)}
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-steam-surface border border-steam-border rounded-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-steam-border bg-steam-bg/30">
                  {["Email", "Tên hiển thị", "Xác minh", "Điểm", "Tham gia", ""].map((h, i) => (
                    <th key={i} className="text-left px-3 py-2.5 text-[11px] font-medium text-steam-muted uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-steam-border">
                {data.items.map((c) => (
                  <tr key={c.userId} className="hover:bg-steam-surface-2/50 transition-colors">
                    <td className="px-3 py-2.5 text-xs text-steam-text max-w-[240px] truncate" title={c.email}>
                      {c.email}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-white max-w-[180px] truncate">{c.displayName || "—"}</td>
                    <td className="px-3 py-2.5">
                      <VerifiedBadge verified={c.emailVerified} />
                    </td>
                    <td className="px-3 py-2.5 font-mono text-sm font-semibold text-steam-gold whitespace-nowrap">
                      {fmtPoints(c.points)}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-steam-muted whitespace-nowrap">{fmtDay(c.createdAt)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end">{actions(c)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {data.totalCount > PAGE_SIZE && (
        <div className="flex items-center justify-end gap-2 text-xs text-steam-muted">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="steam-btn bg-steam-surface-3 border border-steam-border px-2 py-1"
            aria-label="Trang trước"
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
            aria-label="Trang sau"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      )}

      {adjusting && (
        <AdjustModal
          customer={adjusting}
          onClose={() => setAdjusting(null)}
          onDone={(balance) => {
            setFlash(`Đã cập nhật điểm cho ${adjusting.email}: số dư ${fmtPoints(balance)} điểm.`);
            setAdjusting(null);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
      {viewing && <LedgerModal customer={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
