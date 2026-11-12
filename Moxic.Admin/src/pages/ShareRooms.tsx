import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Flag, Handshake, Loader2, RefreshCw, Search, X } from "lucide-react";
import { apiFetch, apiUrl } from "../lib/api";
import { readApiError } from "../lib/luckySpinAdmin";

type RoomStatus = "Open" | "Full" | "Funded" | "Cancelled";

interface Seat {
  id: string;
  displayName: string;
  userId: string;
  email?: string | null;
  isOwner: boolean;
  percent: number;
  shareAmount: number;
  discountAmount: number;
  couponCode: string | null;
  amountDue: number;
  paymentCode: string | null;
  paidAmount: number;
  paidAt: string | null;
  xboxEmail?: string | null;
  joinedAt: string;
  leftAt: string | null;
  leftReason: string | null;
  needsRefund: boolean;
  refundedAt: string | null;
}

interface RoomRow {
  code: string;
  gameName: string;
  totalPrice: number;
  accountType: "Owner" | "Moxic";
  ownerPercent: number;
  isPublic: boolean;
  status: RoomStatus;
  locked: boolean;
  createdAt: string;
  updatedAt: string;
  fullAt: string | null;
  fundedAt: string | null;
  closedAt: string | null;
  cancelReason: string | null;
  order: { orderCode: string; status: string } | null;
  seats: Seat[];
  needsRefund?: boolean;
}

interface RoomDetail extends Omit<RoomRow, "order"> {
  order: { id: string; orderCode: string; status: string; hasProvidedAccount: boolean; providedAccountEmail: string | null } | null;
  transfers: { id: string; amount: number; content: string | null; status: string; note: string | null; orderCode: string; createdAt: string }[];
  messages: { id: string; author: string | null; text: string; reported: boolean; createdAt: string }[];
}

const vnd = (n: number) => n.toLocaleString("vi-VN") + "đ";
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : "—");
const STATUS: Record<RoomStatus, { label: string; cls: string }> = {
  Open: { label: "Chờ người", cls: "text-steam-blue border-steam-blue/40" },
  Full: { label: "Chờ thanh toán", cls: "text-steam-gold border-steam-gold/40" },
  Funded: { label: "Đã đủ tiền", cls: "text-steam-green border-steam-green/40" },
  Cancelled: { label: "Đã đóng", cls: "text-steam-muted border-steam-border" },
};
const FILTERS: { key: string; label: string }[] = [
  { key: "", label: "Tất cả" },
  { key: "refund", label: "Cần hoàn tiền" },
  { key: "Open", label: "Chờ người" },
  { key: "Full", label: "Chờ thanh toán" },
  { key: "Funded", label: "Đã đủ tiền" },
  { key: "Cancelled", label: "Đã đóng" },
];

function ProvidedAccountForm({ orderId, current, onSaved }: { orderId: string; current: string | null; onSaved: () => void }) {
  const [email, setEmail] = useState(current ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    setMsg(null);
    const res = await apiFetch(apiUrl(`/api/admin/orders/${orderId}/provided-account`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setBusy(false);
    if (res.ok) {
      setPassword("");
      setMsg("Đã lưu");
      onSaved();
    } else setMsg(await readApiError(res, "Không lưu được"));
  };
  return (
    <div className="rounded-sm border border-steam-gold/40 bg-steam-gold/5 p-3 space-y-2">
      <p className="text-xs font-semibold text-steam-gold">Tài khoản Xbox Moxic cấp (cả 2 thành viên thấy khi đơn hoàn tất)</p>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input className="steam-input" placeholder="Email Xbox" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="steam-input" type="password" placeholder={current ? "Mật khẩu mới" : "Mật khẩu"} value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="button" disabled={busy} onClick={save} className="steam-btn bg-steam-blue text-black text-xs px-3 disabled:opacity-50">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Lưu"}</button>
      </div>
      {msg && <p className="text-xs text-steam-muted">{msg}</p>}
    </div>
  );
}

function Detail({ code, onClose, onChanged }: { code: string; onClose: () => void; onChanged: () => void }) {
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const res = await apiFetch(apiUrl(`/api/admin/share/${code}`));
    if (res.ok) setRoom(await res.json());
    else setError(await readApiError(res, "Không tải được phòng"));
  }, [code]);
  useEffect(() => {
    load();
  }, [load]);

  const close = async () => {
    const reason = prompt("Lý do đóng phòng (khách sẽ thấy):", "Moxic đóng phòng");
    if (reason === null) return;
    const res = await apiFetch(apiUrl(`/api/admin/share/${code}/close`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) alert(await readApiError(res, "Không đóng được phòng"));
    await load();
    onChanged();
  };
  const refunded = async (seat: Seat) => {
    if (!confirm(`Xác nhận đã chuyển hoàn ${vnd(seat.paidAmount)} cho ${seat.displayName}?`)) return;
    const res = await apiFetch(apiUrl(`/api/admin/share/seats/${seat.id}/refunded`), { method: "POST" });
    if (!res.ok) alert(await readApiError(res, "Không cập nhật được"));
    await load();
    onChanged();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-steam-surface border-l border-steam-border p-5 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Phòng <span className="font-mono text-steam-blue">{code}</span></h2>
          <button type="button" onClick={onClose} className="p-1 text-steam-muted hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        {error && <p className="text-steam-error text-sm">{error}</p>}
        {!room ? (
          <Loader2 className="w-5 h-5 animate-spin text-steam-blue" />
        ) : (
          <>
            <div className="text-sm text-steam-text space-y-1">
              <p className="font-semibold text-white">{room.gameName} · {vnd(room.totalPrice)}</p>
              <p>
                <span className={`px-1.5 py-0.5 border text-xs ${STATUS[room.status].cls}`}>{STATUS[room.status].label}</span>{" "}
                {room.accountType === "Owner" ? "Tài khoản chủ phòng" : "TÀI KHOẢN MOXIC CẤP"} · chia {room.ownerPercent}/{100 - room.ownerPercent} · {room.isPublic ? "công khai" : "riêng tư"}
              </p>
              <p className="text-steam-muted text-xs">Tạo {fmt(room.createdAt)} · đủ người {fmt(room.fullAt)} · đủ tiền {fmt(room.fundedAt)} · đóng {fmt(room.closedAt)} {room.cancelReason ? `(${room.cancelReason})` : ""}</p>
              {room.order && (
                <p>Đơn: <Link to="/orders" className="font-mono text-steam-blue hover:underline">{room.order.orderCode}</Link> · {room.order.status}</p>
              )}
            </div>

            {room.order && room.accountType === "Moxic" && (
              <ProvidedAccountForm orderId={room.order.id} current={room.order.providedAccountEmail} onSaved={load} />
            )}

            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-steam-muted">Thành viên</h3>
              {room.seats.map((s) => (
                <div key={s.id} className={`rounded-sm border border-steam-border p-3 text-sm ${s.leftAt ? "opacity-60" : ""}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-white">
                      {s.displayName} {s.isOwner && <span className="text-xs text-steam-gold">(chủ phòng)</span>}{" "}
                      <span className="font-normal text-steam-muted">{s.email}</span>
                    </p>
                    <span className="font-mono text-xs text-steam-blue">{s.paymentCode ?? "chưa lấy mã"}</span>
                  </div>
                  <p className="text-steam-text mt-1">
                    {s.percent}% · phần {vnd(s.shareAmount)}{s.discountAmount > 0 ? ` − ${vnd(s.discountAmount)} (${s.couponCode})` : ""} = <b>{vnd(s.amountDue)}</b> · đã nhận{" "}
                    <b className={s.paidAt ? "text-steam-green" : "text-steam-gold"}>{vnd(s.paidAmount)}</b> {s.paidAt ? `lúc ${fmt(s.paidAt)}` : ""}
                  </p>
                  {s.xboxEmail && <p className="text-xs text-steam-muted mt-0.5">Xbox: {s.xboxEmail}</p>}
                  {s.leftAt && <p className="text-xs text-steam-muted mt-0.5">Rời phòng {fmt(s.leftAt)} ({s.leftReason})</p>}
                  {s.needsRefund && !s.refundedAt && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs font-semibold text-steam-accent">Cần hoàn {vnd(s.paidAmount)}</span>
                      <button type="button" onClick={() => refunded(s)} className="steam-btn bg-steam-blue text-black px-2.5 py-1 text-xs">Đã hoàn tiền</button>
                    </div>
                  )}
                  {s.refundedAt && <p className="text-xs text-steam-green mt-1">Đã hoàn tiền {fmt(s.refundedAt)}</p>}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-steam-muted">Giao dịch</h3>
              {room.transfers.length === 0 ? (
                <p className="text-sm text-steam-muted">Chưa có.</p>
              ) : (
                room.transfers.map((t) => (
                  <p key={t.id} className="text-sm text-steam-text">
                    {fmt(t.createdAt)} · <b>{vnd(t.amount)}</b> · <span className="font-mono">{t.orderCode}</span> · {t.status} {t.note ? `· ${t.note}` : ""}
                  </p>
                ))
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-steam-muted">Thảo luận</h3>
              <div className="max-h-72 overflow-y-auto space-y-1.5 rounded-sm border border-steam-border p-2">
                {room.messages.map((m) => (
                  <p key={m.id} className={`text-sm ${m.author ? "text-steam-text" : "text-steam-muted italic"} ${m.reported ? "bg-steam-accent/10" : ""}`}>
                    <span className="text-xs text-steam-muted">{fmt(m.createdAt)}</span> {m.author && <b>{m.author}:</b>} {m.text}
                    {m.reported && <Flag className="inline w-3 h-3 ml-1 text-steam-accent" />}
                  </p>
                ))}
              </div>
            </div>

            {(room.status === "Open" || room.status === "Full") && (
              <button type="button" onClick={close} className="w-full rounded-sm border border-steam-accent/50 py-2 text-sm font-semibold text-steam-accent hover:bg-steam-accent/10">
                Đóng phòng (người đã trả vào hàng chờ hoàn tiền)
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Share rooms: who is in which room, what they paid, the refund queue, and the account for "Moxic" rooms. */
export default function ShareRooms() {
  const [filter, setFilter] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<RoomRow[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (filter === "refund") params.set("needsRefund", "true");
    else if (filter) params.set("status", filter);
    if (q.trim()) params.set("q", q.trim());
    const res = await apiFetch(apiUrl(`/api/admin/share?${params}`));
    setRows(res.ok ? await res.json() : []);
  }, [filter, q]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto flex items-center gap-2 text-xl font-bold text-white"><Handshake className="w-5 h-5 text-steam-blue" /> Phòng share</h1>
        <form className="relative" onSubmit={(e) => { e.preventDefault(); load(); }}>
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-steam-muted" />
          <input className="steam-input pl-8 w-56" placeholder="Mã phòng, MXR…, tên game" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
        <button type="button" onClick={load} className="p-2 text-steam-muted hover:text-white" aria-label="Tải lại"><RefreshCw className="w-4 h-4" /></button>
      </div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" onClick={() => setFilter(f.key)} className={`px-3 py-1 text-xs border rounded-sm ${filter === f.key ? "border-steam-blue text-steam-blue bg-steam-blue/10" : "border-steam-border text-steam-muted hover:text-white"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {!rows ? (
        <Loader2 className="w-5 h-5 animate-spin text-steam-blue" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-steam-muted">Không có phòng nào.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const seats = r.seats.filter((s) => !s.leftAt);
            return (
              <button key={r.code} type="button" onClick={() => setOpen(r.code)} className="w-full text-left bg-steam-surface border border-steam-border hover:border-steam-blue/50 rounded-sm p-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-mono text-steam-blue">{r.code}</span>
                  <span className={`px-1.5 py-0.5 border text-xs ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>
                  {r.needsRefund && <span className="px-1.5 py-0.5 text-xs border border-steam-accent/50 text-steam-accent">Cần hoàn tiền</span>}
                  {r.accountType === "Moxic" && <span className="px-1.5 py-0.5 text-xs border border-steam-gold/50 text-steam-gold">TK Moxic cấp</span>}
                  <span className="font-semibold text-white truncate">{r.gameName}</span>
                  <span className="ml-auto text-steam-text">{vnd(r.totalPrice)}</span>
                </div>
                <p className="mt-1 text-xs text-steam-muted">
                  {seats.map((s) => `${s.displayName} ${s.percent}% ${s.paidAt ? "✓" : `(đã nhận ${vnd(s.paidAmount)})`}`).join(" · ")}
                  {r.order ? ` · đơn ${r.order.orderCode} (${r.order.status})` : ""} · cập nhật {fmt(r.updatedAt)}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {open && <Detail code={open} onClose={() => setOpen(null)} onChanged={load} />}
    </div>
  );
}
