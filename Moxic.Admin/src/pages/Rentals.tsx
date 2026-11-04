import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  KeyRound,
  Loader2,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  Server,
  Tag,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { apiFetch, apiUrl } from "../lib/api";
import { readApiError } from "../lib/luckySpinAdmin";

type Status = "PendingPayment" | "AwaitingConfirmation" | "Active" | "Expired" | "Returned" | "Completed" | "Cancelled";

interface RentalRow {
  id: string;
  code: string;
  kind: "Rental" | "Extension";
  parentCode: string | null;
  customerEmail: string;
  customerPhone: string | null;
  gameId: string;
  gameName: string;
  days: number;
  price: number;
  status: Status;
  assetId: string | null;
  assetLabel: string | null;
  startsAt: string | null;
  endsAt: string | null;
  paidAt: string | null;
  cancelReason: string | null;
  createdAt: string;
}

interface Asset {
  id: string;
  label: string;
  loginEmail: string;
  notes: string | null;
  slots: number;
  isActive: boolean;
  games: { gameId: string; name: string }[];
  used: number;
  active: { code: string; customerEmail: string; gameName: string; status: Status; endsAt: string | null }[];
}

interface PlanGame {
  id: string;
  name: string;
  plans: { id: string; days: number; price: number; isActive: boolean }[];
  slots: number;
}

const STATUS: Record<Status, { label: string; cls: string }> = {
  PendingPayment: { label: "Chờ thanh toán", cls: "text-steam-gold border-steam-gold/30 bg-steam-gold/10" },
  AwaitingConfirmation: { label: "Khách báo đã CK", cls: "text-steam-blue border-steam-blue/40 bg-steam-blue/10" },
  Active: { label: "Đang thuê", cls: "text-steam-green border-steam-green/30 bg-steam-green/10" },
  Expired: { label: "Hết hạn — cần thu hồi", cls: "text-red-400 border-red-500/30 bg-red-500/10" },
  Returned: { label: "Đã thu hồi", cls: "text-steam-muted border-steam-border" },
  Completed: { label: "Đã gia hạn", cls: "text-steam-green border-steam-green/30" },
  Cancelled: { label: "Đã hủy", cls: "text-steam-muted border-steam-border" },
};

const vnd = (n: number) => n.toLocaleString("vi-VN") + "đ";
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : "—");

async function call(path: string, method = "GET", body?: unknown, fallback = "Thao tác thất bại") {
  const res = await apiFetch(apiUrl(path), {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await readApiError(res, fallback));
  return res.status === 204 ? null : res.json();
}

function Banner({ kind, text }: { kind: "ok" | "err"; text: string }) {
  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-2 rounded text-xs border ${
        kind === "ok" ? "bg-steam-green/10 border-steam-green/30 text-steam-green" : "bg-red-500/10 border-red-500/20 text-red-400"
      }`}
    >
      {kind === "ok" ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />} {text}
    </div>
  );
}

// ───────────────────────── Orders ─────────────────────────

const FILTERS: { key: string; label: string; statuses: Status[] }[] = [
  { key: "todo", label: "Cần xử lý", statuses: ["AwaitingConfirmation", "Expired", "PendingPayment"] },
  { key: "active", label: "Đang thuê", statuses: ["Active"] },
  { key: "done", label: "Đã kết thúc", statuses: ["Returned", "Completed", "Cancelled"] },
  { key: "all", label: "Tất cả", statuses: [] },
];

function OrdersTab() {
  const [filter, setFilter] = useState("todo");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [data, setData] = useState<{ items: RentalRow[]; total: number; counts: { status: Status; count: number }[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setQ(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    const f = FILTERS.find((x) => x.key === filter)!;
    const qs = new URLSearchParams();
    if (f.statuses.length) qs.set("status", f.statuses.join(","));
    if (q) qs.set("search", q);
    try {
      setData(await call(`/api/admin/rentals?${qs}`));
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Không tải được" });
    }
  }, [filter, q]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (r: RentalRow, action: "confirm" | "return" | "cancel") => {
    let body: unknown;
    if (action === "cancel") {
      const reason = window.prompt(`Lý do hủy ${r.code}?`, "Không nhận được thanh toán");
      if (reason === null) return;
      body = { reason };
    }
    if (action === "return" && !window.confirm(`Đã đổi mật khẩu tài khoản ${r.assetLabel ?? ""} để thu hồi ${r.code}?`)) return;
    setBusy(r.id);
    try {
      await call(`/api/admin/rentals/${r.id}/${action}`, "POST", body);
      setMsg({
        kind: "ok",
        text:
          action === "confirm"
            ? r.kind === "Extension"
              ? `Đã gia hạn ${r.parentCode}.`
              : `Đã bàn giao ${r.code} — khách thấy thông tin đăng nhập ngay.`
            : action === "return"
              ? `Đã thu hồi ${r.code}, slot đã trống.`
              : `Đã hủy ${r.code}.`,
      });
      await load();
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Thao tác thất bại" });
    } finally {
      setBusy(null);
    }
  };

  const countOf = (statuses: Status[]) =>
    statuses.length === 0 ? data?.counts.reduce((s, c) => s + c.count, 0) : data?.counts.filter((c) => statuses.includes(c.status)).reduce((s, c) => s + c.count, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="flex rounded-sm border border-steam-border overflow-hidden">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 text-xs font-semibold border-l border-steam-border first:border-l-0 ${filter === f.key ? "bg-steam-blue/15 text-steam-blue" : "text-steam-muted hover:text-steam-text"}`}
            >
              {f.label} <span className="opacity-60">{countOf(f.statuses) ?? ""}</span>
            </button>
          ))}
        </div>
        <div className="relative sm:ml-auto sm:w-72">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-steam-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Mã đơn, email, game" className="w-full steam-input pl-8" />
        </div>
      </div>
      {msg && <Banner kind={msg.kind} text={msg.text} />}

      {!data ? (
        <div className="py-10 flex justify-center text-steam-muted">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : data.items.length === 0 ? (
        <p className="py-10 text-center text-sm text-steam-muted bg-steam-surface border border-steam-border rounded-sm">Không có đơn thuê.</p>
      ) : (
        <div className="space-y-2">
          {data.items.map((r) => {
            const st = STATUS[r.status];
            return (
              <div key={r.id} className="bg-steam-surface border border-steam-border rounded-sm p-3 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded-sm text-[10px] font-semibold border ${st.cls}`}>{st.label}</span>
                    <span className="font-mono text-xs text-white">{r.code}</span>
                    {r.kind === "Extension" && <span className="text-[10px] text-steam-muted">gia hạn cho {r.parentCode}</span>}
                  </div>
                  <p className="text-sm text-white truncate">
                    {r.gameName} · <span className="text-steam-gold font-mono">{vnd(r.price)}</span> · {r.days} ngày
                  </p>
                  <p className="text-[11px] text-steam-muted truncate">
                    {r.customerEmail}
                    {r.customerPhone ? ` · ${r.customerPhone}` : ""} · TK: <b className="text-steam-text">{r.assetLabel ?? "—"}</b> · tạo {fmt(r.createdAt)}
                    {r.endsAt && <> · hết hạn <b className="text-steam-text">{fmt(r.endsAt)}</b></>}
                    {r.cancelReason && <> · {r.cancelReason}</>}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 shrink-0">
                  {(r.status === "PendingPayment" || r.status === "AwaitingConfirmation") && (
                    <>
                      <button disabled={busy === r.id} onClick={() => act(r, "confirm")} className="steam-btn text-xs bg-steam-green/15 text-steam-green border border-steam-green/30">
                        {busy === r.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                        {r.kind === "Extension" ? "Đã nhận tiền → gia hạn" : "Đã nhận tiền → bàn giao"}
                      </button>
                      <button disabled={busy === r.id} onClick={() => act(r, "cancel")} className="steam-btn text-xs bg-steam-surface-3 text-steam-muted border border-steam-border">
                        <XCircle size={12} /> Hủy
                      </button>
                    </>
                  )}
                  {(r.status === "Active" || r.status === "Expired") && r.kind === "Rental" && (
                    <button
                      disabled={busy === r.id}
                      onClick={() => act(r, "return")}
                      className={`steam-btn text-xs border ${r.status === "Expired" ? "bg-red-500/15 text-red-400 border-red-500/30" : "bg-steam-surface-3 text-steam-muted border-steam-border"}`}
                    >
                      {busy === r.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} Đã đổi MK → thu hồi
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Assets ─────────────────────────

function AssetModal({ asset, games, onClose, onSaved }: { asset: Asset | null; games: PlanGame[]; onClose: () => void; onSaved: (m: string) => void }) {
  const [label, setLabel] = useState(asset?.label ?? "");
  const [email, setEmail] = useState(asset?.loginEmail ?? "");
  const [password, setPassword] = useState("");
  const [notes, setNotes] = useState(asset?.notes ?? "");
  const [slots, setSlots] = useState(String(asset?.slots ?? 1));
  const [active, setActive] = useState(asset?.isActive ?? true);
  const [gameIds, setGameIds] = useState<string[]>(asset?.games.map((g) => g.gameId) ?? []);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = { label, loginEmail: email, password: password || null, notes, slots: Number(slots) || 1, isActive: active, gameIds };
      if (asset) await call(`/api/admin/rental-assets/${asset.id}`, "PUT", body);
      else await call("/api/admin/rental-assets", "POST", body);
      onSaved(asset ? `Đã cập nhật ${label}.` : `Đã thêm tài sản ${label}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được");
    } finally {
      setBusy(false);
    }
  };

  const shown = games.filter((g) => g.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60" onClick={onClose}>
      <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-xl max-h-[92vh] overflow-y-auto bg-steam-surface border border-steam-border rounded-t-md sm:rounded-sm p-4 md:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-steam-muted uppercase tracking-widest">{asset ? "Sửa tài sản" : "Thêm tài sản cho thuê"}</h2>
          <button type="button" onClick={onClose} className="text-steam-muted hover:text-steam-text">
            <X size={14} />
          </button>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-steam-muted mb-1">Tên gợi nhớ *</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="VD: Acc 01" className="w-full steam-input" required />
          </div>
          <div>
            <label className="block text-xs text-steam-muted mb-1">Số slot (khách cùng lúc)</label>
            <input type="number" min={1} max={20} value={slots} onChange={(e) => setSlots(e.target.value)} className="w-full steam-input" />
          </div>
          <div>
            <label className="block text-xs text-steam-muted mb-1">Email đăng nhập *</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full steam-input font-mono" required />
          </div>
          <div>
            <label className="block text-xs text-steam-muted mb-1">{asset ? "Mật khẩu mới (để trống = giữ nguyên)" : "Mật khẩu *"}</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} className="w-full steam-input font-mono" required={!asset} />
          </div>
        </div>
        <div>
          <label className="block text-xs text-steam-muted mb-1">Ghi chú</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full steam-input" />
        </div>
        <div>
          <label className="block text-xs text-steam-muted mb-1">Game tài khoản sở hữu ({gameIds.length})</label>
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Lọc game…" className="w-full steam-input mb-2" />
          <div className="max-h-48 overflow-y-auto border border-steam-border rounded-sm divide-y divide-steam-border">
            {shown.map((g) => (
              <label key={g.id} className="flex items-center gap-2 px-3 py-1.5 text-xs text-steam-text cursor-pointer hover:bg-steam-surface-3">
                <input type="checkbox" checked={gameIds.includes(g.id)} onChange={(e) => setGameIds(e.target.checked ? [...gameIds, g.id] : gameIds.filter((x) => x !== g.id))} />
                {g.name}
              </label>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-steam-text">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Đang dùng để cho thuê
        </label>
        {error && <Banner kind="err" text={error} />}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="steam-btn bg-steam-surface-3 text-steam-muted border border-steam-border text-xs">
            Hủy
          </button>
          <button type="submit" disabled={busy} className="steam-btn bg-steam-blue text-black text-xs">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Lưu
          </button>
        </div>
      </form>
    </div>
  );
}

function AssetsTab({ games }: { games: PlanGame[] }) {
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [editing, setEditing] = useState<Asset | "new" | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setAssets(await call("/api/admin/rental-assets"));
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Không tải được" });
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const reveal = async (a: Asset) => {
    try {
      const r: { password: string | null } = await call(`/api/admin/rental-assets/${a.id}/password`);
      setRevealed((m) => ({ ...m, [a.id]: r.password ?? "(không giải mã được)" }));
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Không xem được" });
    }
  };

  const remove = async (a: Asset) => {
    if (!window.confirm(`Xóa tài sản ${a.label}?`)) return;
    try {
      await call(`/api/admin/rental-assets/${a.id}`, "DELETE");
      setMsg({ kind: "ok", text: `Đã xóa ${a.label}.` });
      load();
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Không xóa được" });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-steam-muted">Tài khoản Xbox của shop dùng để cho thuê. Mật khẩu được mã hóa; chỉ khách đang thuê mới thấy.</p>
        <button onClick={() => setEditing("new")} className="steam-btn bg-steam-blue text-black text-xs shrink-0">
          <Plus size={13} /> Thêm tài sản
        </button>
      </div>
      {msg && <Banner kind={msg.kind} text={msg.text} />}
      {!assets ? (
        <div className="py-10 flex justify-center text-steam-muted">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : assets.length === 0 ? (
        <p className="py-10 text-center text-sm text-steam-muted bg-steam-surface border border-steam-border rounded-sm">Chưa có tài sản nào.</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {assets.map((a) => (
            <div key={a.id} className={`bg-steam-surface border border-steam-border rounded-sm p-3 space-y-2 ${a.isActive ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-white font-semibold flex items-center gap-1.5">
                    <Server size={13} className="text-steam-blue" /> {a.label}
                  </p>
                  <p className="text-xs text-steam-muted font-mono truncate">{a.loginEmail}</p>
                </div>
                <span className={`text-xs font-mono font-semibold ${a.used >= a.slots ? "text-red-400" : "text-steam-green"}`}>
                  {a.used}/{a.slots} slot
                </span>
              </div>
              <div className="h-1.5 bg-steam-bg rounded-full overflow-hidden">
                <div className={`h-full ${a.used >= a.slots ? "bg-red-400" : "bg-steam-green"}`} style={{ width: `${Math.min(100, (a.used / a.slots) * 100)}%` }} />
              </div>
              <p className="text-[11px] text-steam-muted line-clamp-2">{a.games.map((g) => g.name).join(", ") || "Chưa gắn game"}</p>
              {a.active.length > 0 && (
                <ul className="text-[11px] space-y-0.5">
                  {a.active.map((x) => (
                    <li key={x.code} className="flex justify-between gap-2 text-steam-text">
                      <span className="truncate">
                        <span className="font-mono">{x.code}</span> · {x.customerEmail}
                      </span>
                      <span className="text-steam-muted whitespace-nowrap">{STATUS[x.status].label}</span>
                    </li>
                  ))}
                </ul>
              )}
              {revealed[a.id] && <p className="text-xs font-mono text-steam-gold bg-steam-bg px-2 py-1 rounded-sm">{revealed[a.id]}</p>}
              <div className="flex gap-1.5">
                <button onClick={() => setEditing(a)} className="inline-flex items-center gap-1 px-2 py-1 rounded-sm text-[11px] text-steam-blue border border-steam-blue/30">
                  <Pencil size={11} /> Sửa
                </button>
                <button onClick={() => reveal(a)} className="inline-flex items-center gap-1 px-2 py-1 rounded-sm text-[11px] text-steam-muted border border-steam-border">
                  <Eye size={11} /> Xem mật khẩu
                </button>
                <button onClick={() => remove(a)} className="inline-flex items-center gap-1 px-2 py-1 rounded-sm text-[11px] text-red-400 border border-red-500/30 ml-auto">
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {editing && (
        <AssetModal
          asset={editing === "new" ? null : editing}
          games={games}
          onClose={() => setEditing(null)}
          onSaved={(m) => {
            setMsg({ kind: "ok", text: m });
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

// ───────────────────────── Plans ─────────────────────────

function PlanRow({ game, onSaved }: { game: PlanGame; onSaved: (m: string, ok: boolean) => void }) {
  const [plans, setPlans] = useState(game.plans.map((p) => ({ ...p, days: String(p.days), price: String(p.price) })));
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(plans.map((p) => [p.id, +p.days, +p.price, p.isActive])) !== JSON.stringify(game.plans.map((p) => [p.id, p.days, p.price, p.isActive]));

  const save = async () => {
    setBusy(true);
    try {
      await call(
        `/api/admin/rental-plans/${game.id}`,
        "PUT",
        plans.map((p) => ({ id: p.id || null, days: Number(p.days), price: Number(p.price), isActive: p.isActive })),
      );
      onSaved(`Đã lưu gói thuê cho ${game.name}.`, true);
    } catch (e) {
      onSaved(e instanceof Error ? e.message : "Không lưu được", false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-steam-surface border border-steam-border rounded-sm p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-white font-semibold truncate">{game.name}</p>
        <span className={`text-[11px] whitespace-nowrap ${game.slots > 0 ? "text-steam-green" : "text-steam-muted"}`}>
          {game.slots > 0 ? `${game.slots} slot` : "chưa có tài sản"}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {plans.map((p, i) => (
          <div key={p.id || `n${i}`} className={`flex items-center gap-1 border rounded-sm px-1.5 py-1 ${p.isActive ? "border-steam-border" : "border-steam-border opacity-50"}`}>
            <input value={p.days} onChange={(e) => setPlans(plans.map((x, j) => (j === i ? { ...x, days: e.target.value } : x)))} className="w-10 steam-input text-xs px-1 py-0.5 font-mono" aria-label="Số ngày" />
            <span className="text-[11px] text-steam-muted">ngày</span>
            <input value={p.price} onChange={(e) => setPlans(plans.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} className="w-20 steam-input text-xs px-1 py-0.5 font-mono" aria-label="Giá" />
            <span className="text-[11px] text-steam-muted">đ</span>
            <button type="button" onClick={() => setPlans(plans.filter((_, j) => j !== i))} className="text-steam-muted hover:text-red-400 p-0.5" aria-label="Xóa gói">
              <X size={11} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setPlans([...plans, { id: "", days: String([7, 30, 90].find((d) => !plans.some((p) => +p.days === d)) ?? 14), price: "0", isActive: true }])}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-sm text-[11px] text-steam-muted border border-dashed border-steam-border hover:text-steam-text"
        >
          <Plus size={11} /> Gói
        </button>
        {dirty && (
          <button type="button" onClick={save} disabled={busy} className="steam-btn bg-steam-blue text-black text-[11px] px-2 py-1 ml-auto">
            {busy ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Lưu
          </button>
        )}
      </div>
    </div>
  );
}

function PlansTab({ games, reload }: { games: PlanGame[]; reload: () => void }) {
  const [filter, setFilter] = useState("");
  const [onlyPlans, setOnlyPlans] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const shown = games.filter((g) => g.name.toLowerCase().includes(filter.toLowerCase()) && (!onlyPlans || g.plans.length > 0));
  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Lọc game…" className="steam-input sm:w-72" />
        <label className="flex items-center gap-1.5 text-xs text-steam-muted">
          <input type="checkbox" checked={onlyPlans} onChange={(e) => setOnlyPlans(e.target.checked)} /> Chỉ game đã có gói
        </label>
        <p className="text-[11px] text-steam-muted sm:ml-auto">Game chỉ hiện "Thuê" khi có gói đang bật và có tài sản sở hữu game.</p>
      </div>
      {msg && <Banner kind={msg.kind} text={msg.text} />}
      <div className="grid lg:grid-cols-2 gap-2">
        {shown.map((g) => (
          <PlanRow
            key={g.id + JSON.stringify(g.plans)}
            game={g}
            onSaved={(text, ok) => {
              setMsg({ kind: ok ? "ok" : "err", text });
              if (ok) reload();
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ───────────────────────── Page ─────────────────────────

export default function Rentals() {
  const [tab, setTab] = useState<"orders" | "assets" | "plans">("orders");
  const [games, setGames] = useState<PlanGame[]>([]);

  const loadGames = useCallback(async () => {
    try {
      setGames(await call("/api/admin/rental-plans"));
    } catch {
      /* shown per tab */
    }
  }, []);
  useEffect(() => {
    loadGames();
  }, [loadGames, tab]);

  const tabs = useMemo(
    () => [
      { key: "orders" as const, label: "Đơn thuê", icon: Package },
      { key: "assets" as const, label: "Tài sản", icon: KeyRound },
      { key: "plans" as const, label: "Gói thuê", icon: Tag },
    ],
    [],
  );

  return (
    <div className="space-y-4 md:space-y-5">
      <div>
        <h1 className="text-lg font-bold text-white font-mono tracking-tight">Thuê game</h1>
        <p className="text-xs text-steam-muted mt-0.5">Đơn thuê, tài khoản cho thuê và bảng giá thuê theo game</p>
      </div>
      <div className="flex border-b border-steam-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm border-b-2 -mb-px ${tab === t.key ? "border-steam-blue text-steam-blue" : "border-transparent text-steam-muted hover:text-steam-text"}`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>
      {tab === "orders" && <OrdersTab />}
      {tab === "assets" && <AssetsTab games={games} />}
      {tab === "plans" && <PlansTab games={games} reload={loadGames} />}
    </div>
  );
}
