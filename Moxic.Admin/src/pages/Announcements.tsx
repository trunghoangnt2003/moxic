import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { apiFetch, apiUrl } from "../lib/api";
import { readApiError } from "../lib/luckySpinAdmin";

type Kind = "GameLaunch" | "Event" | "News";

interface Announcement {
  id: string;
  kind: Kind;
  title: string;
  subtitle: string | null;
  body: string | null;
  imageUrl: string | null;
  gameId: string | null;
  gameName: string | null;
  countdownTo: string | null;
  countdownLabel: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  priority: number;
  hasOwnImage: boolean;
  updatedAt: string;
}

interface GameOption {
  id: string;
  name: string;
}

const KIND_LABELS: Record<Kind, string> = {
  GameLaunch: "Game sắp ra mắt",
  Event: "Sự kiện",
  News: "Tin tức",
};

const KIND_STYLES: Record<Kind, string> = {
  GameLaunch: "bg-steam-gold/10 text-steam-gold border-steam-gold/30",
  Event: "bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/30",
  News: "bg-steam-blue/10 text-steam-blue border-steam-blue/30",
};

/** ISO (UTC) → value for <input type="datetime-local"> in the admin's local time. */
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : null);

function daysLeft(iso: string | null) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Đã tới";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  return d > 0 ? `còn ${d} ngày ${h} giờ` : `còn ${h} giờ`;
}

function statusOf(a: Announcement): { label: string; cls: string } {
  const now = Date.now();
  if (!a.isActive) return { label: "Đang tắt", cls: "text-steam-muted border-steam-border" };
  if (a.startsAt && new Date(a.startsAt).getTime() > now) return { label: "Chờ hiển thị", cls: "text-steam-blue border-steam-blue/30" };
  if (a.endsAt && new Date(a.endsAt).getTime() <= now) return { label: "Đã hết hạn", cls: "text-red-400 border-red-500/30" };
  return { label: "Đang hiển thị", cls: "text-steam-green border-steam-green/30" };
}

async function api(path: string, method = "GET", body?: unknown, fallback = "Thao tác thất bại") {
  const res = await apiFetch(apiUrl(`/api/admin/announcements${path}`), {
    method,
    headers: body !== undefined && !(body instanceof FormData) ? { "Content-Type": "application/json" } : undefined,
    body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await readApiError(res, fallback));
  return res.status === 204 ? null : res.json();
}

function GamePicker({ value, valueName, onChange }: { value: string | null; valueName: string | null; onChange: (g: GameOption | null) => void }) {
  const [term, setTerm] = useState("");
  const [options, setOptions] = useState<GameOption[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const h = window.setTimeout(async () => {
      try {
        const qs = term.trim() ? `?search=${encodeURIComponent(term.trim())}` : "";
        const res = await apiFetch(apiUrl(`/api/admin/lucky-spin/game-options${qs}`));
        if (res.ok) setOptions(await res.json());
      } catch {
        /* ignore */
      }
    }, 250);
    return () => window.clearTimeout(h);
  }, [term, open]);

  if (value) {
    return (
      <div className="flex items-center gap-2 steam-input">
        <span className="flex-1 truncate text-steam-text">{valueName ?? value}</span>
        <button type="button" onClick={() => onChange(null)} className="text-steam-muted hover:text-steam-text" aria-label="Bỏ chọn game">
          <X size={13} />
        </button>
      </div>
    );
  }
  return (
    <div className="relative">
      <input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        placeholder="Tìm game trong kho (không bắt buộc)"
        className="w-full steam-input"
      />
      {open && options.length > 0 && (
        <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto bg-steam-surface-2 border border-steam-border rounded-sm shadow-lg">
          {options.map((g) => (
            <button
              key={g.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(g);
                setTerm("");
                setOpen(false);
              }}
              className="block w-full text-left px-3 py-2 text-xs text-steam-text hover:bg-steam-surface-3"
            >
              {g.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FormModal({ item, onClose, onSaved }: { item: Announcement | null; onClose: () => void; onSaved: (a: Announcement, msg: string) => void }) {
  const [current, setCurrent] = useState<Announcement | null>(item);
  const [kind, setKind] = useState<Kind>(item?.kind ?? "GameLaunch");
  const [title, setTitle] = useState(item?.title ?? "");
  const [subtitle, setSubtitle] = useState(item?.subtitle ?? "");
  const [body, setBody] = useState(item?.body ?? "");
  const [game, setGame] = useState<{ id: string; name: string | null } | null>(item?.gameId ? { id: item.gameId, name: item.gameName } : null);
  const [countdownTo, setCountdownTo] = useState(toLocalInput(item?.countdownTo ?? null));
  const [countdownLabel, setCountdownLabel] = useState(item?.countdownLabel ?? "");
  const [ctaLabel, setCtaLabel] = useState(item?.ctaLabel ?? "");
  const [ctaUrl, setCtaUrl] = useState(item?.gameId && item.ctaUrl === `/games/${item.gameId}` ? "" : (item?.ctaUrl ?? ""));
  const [startsAt, setStartsAt] = useState(toLocalInput(item?.startsAt ?? null));
  const [endsAt, setEndsAt] = useState(toLocalInput(item?.endsAt ?? null));
  const [priority, setPriority] = useState(String(item?.priority ?? 0));
  const [isActive, setIsActive] = useState(item?.isActive ?? true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy("save");
    try {
      const payload = {
        kind,
        title,
        subtitle,
        body,
        gameId: game?.id ?? null,
        countdownTo: fromLocalInput(countdownTo),
        countdownLabel,
        ctaLabel,
        ctaUrl,
        startsAt: fromLocalInput(startsAt),
        endsAt: fromLocalInput(endsAt),
        isActive,
        priority: Number.parseInt(priority, 10) || 0,
      };
      const saved: Announcement = current
        ? await api(`/${current.id}`, "PUT", payload, "Không lưu được")
        : await api("", "POST", payload, "Không tạo được");
      const wasNew = !current;
      setCurrent(saved);
      if (wasNew) {
        // Stay open so an image can be uploaded straight away.
        onSaved(saved, "Đã tạo thông báo — có thể tải ảnh banner ngay bên dưới.");
      } else {
        onSaved(saved, "Đã lưu thông báo.");
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được");
    } finally {
      setBusy(null);
    }
  };

  const upload = async (file: File) => {
    if (!current) return;
    setError("");
    setBusy("image");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const saved: Announcement = await api(`/${current.id}/image`, "POST", fd, "Không tải được ảnh");
      setCurrent(saved);
      onSaved(saved, "Đã cập nhật ảnh.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được ảnh");
    } finally {
      setBusy(null);
    }
  };

  const removeImage = async () => {
    if (!current) return;
    setBusy("image");
    try {
      const saved: Announcement = await api(`/${current.id}/image`, "DELETE");
      setCurrent(saved);
      onSaved(saved, "Đã xóa ảnh riêng.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xóa được ảnh");
    } finally {
      setBusy(null);
    }
  };

  const label = "block text-xs text-steam-muted mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto bg-steam-surface border border-steam-border rounded-t-md sm:rounded-sm p-4 md:p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-steam-muted uppercase tracking-widest">{current ? "Sửa thông báo" : "Thông báo mới"}</h2>
          <button type="button" onClick={onClose} className="p-1 text-steam-muted hover:text-steam-text" aria-label="Đóng">
            <X size={14} />
          </button>
        </div>

        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-3 gap-1.5">
            {(Object.keys(KIND_LABELS) as Kind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`py-2 text-xs font-semibold rounded-sm border ${kind === k ? KIND_STYLES[k] : "border-steam-border text-steam-muted hover:text-steam-text"}`}
              >
                {KIND_LABELS[k]}
              </button>
            ))}
          </div>

          <div>
            <label className={label}>Tiêu đề *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} required className="w-full steam-input" placeholder="VD: GTA VI sắp ra mắt!" />
          </div>
          <div>
            <label className={label}>Dòng phụ</label>
            <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} maxLength={300} className="w-full steam-input" placeholder="VD: Đặt trước ngay hôm nay — giá chỉ từ 1.299.000đ" />
          </div>
          <div>
            <label className={label}>Nội dung</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} rows={3} className="w-full steam-input resize-y" />
          </div>
          <div>
            <label className={label}>Game liên kết (ảnh bìa + nút mặc định tới trang game)</label>
            <GamePicker value={game?.id ?? null} valueName={game?.name ?? null} onChange={(g) => setGame(g ? { id: g.id, name: g.name } : null)} />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={label}>
                <CalendarClock size={11} className="inline mr-1" />
                Đếm ngược tới
              </label>
              <input type="datetime-local" value={countdownTo} onChange={(e) => setCountdownTo(e.target.value)} className="w-full steam-input" />
            </div>
            <div>
              <label className={label}>Nhãn đếm ngược</label>
              <input value={countdownLabel} onChange={(e) => setCountdownLabel(e.target.value)} maxLength={100} className="w-full steam-input" placeholder="VD: Ra mắt sau" />
            </div>
            <div>
              <label className={label}>Chữ trên nút</label>
              <input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} maxLength={60} className="w-full steam-input" placeholder="VD: Đặt trước ngay" />
            </div>
            <div>
              <label className={label}>Link nút (để trống = trang game)</label>
              <input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} maxLength={500} className="w-full steam-input" placeholder="/lucky-spin hoặc https://..." />
            </div>
            <div>
              <label className={label}>Bắt đầu hiển thị</label>
              <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="w-full steam-input" />
            </div>
            <div>
              <label className={label}>Kết thúc hiển thị</label>
              <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="w-full steam-input" />
            </div>
            <div>
              <label className={label}>Độ ưu tiên (cao hiện trước)</label>
              <input type="number" value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full steam-input" />
            </div>
            <label className="flex items-center gap-2 text-xs text-steam-text cursor-pointer self-end pb-2">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Đang bật
            </label>
          </div>

          {error && (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              <AlertCircle size={12} /> {error}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="steam-btn bg-steam-surface-3 text-steam-muted border border-steam-border text-xs md:text-sm">
              Đóng
            </button>
            <button type="submit" disabled={busy !== null} className="steam-btn bg-steam-blue text-black hover:bg-steam-blue-hover text-xs md:text-sm">
              {busy === "save" ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {current ? "Lưu" : "Tạo"}
            </button>
          </div>
        </form>

        <div className="border-t border-steam-border pt-3">
          <p className="text-[11px] font-semibold text-steam-muted uppercase tracking-widest mb-2">Ảnh banner (16:9, tối đa 5MB)</p>
          {!current ? (
            <p className="text-xs text-steam-muted">Tạo thông báo trước, sau đó tải ảnh. Nếu không có ảnh riêng sẽ dùng ảnh bìa của game liên kết.</p>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 items-start">
              <div className="w-full sm:w-64 aspect-video bg-steam-bg border border-steam-border rounded-sm overflow-hidden flex items-center justify-center">
                {current.imageUrl ? <img src={current.imageUrl} alt="" className="w-full h-full object-cover" /> : <Megaphone className="text-steam-border" />}
              </div>
              <div className="flex flex-col gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) upload(f);
                    e.target.value = "";
                  }}
                />
                <button type="button" disabled={busy !== null} onClick={() => fileRef.current?.click()} className="steam-btn text-xs bg-steam-surface-3 border border-steam-border text-steam-text">
                  {busy === "image" ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />} Tải ảnh lên
                </button>
                {current.hasOwnImage && (
                  <button type="button" disabled={busy !== null} onClick={removeImage} className="steam-btn text-xs bg-red-500/10 border border-red-500/30 text-red-400">
                    <Trash2 size={13} /> Xóa ảnh riêng
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Announcements() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [editing, setEditing] = useState<Announcement | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Announcement | null>(null);

  const load = async () => {
    try {
      setItems(await api("", "GET", undefined, "Không tải được danh sách"));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được danh sách");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const upsertLocal = (a: Announcement) =>
    setItems((list) => (list.some((x) => x.id === a.id) ? list.map((x) => (x.id === a.id ? a : x)) : [a, ...list]));

  const toggle = async (a: Announcement) => {
    try {
      const saved: Announcement = await api(`/${a.id}`, "PUT", {
        kind: a.kind,
        title: a.title,
        subtitle: a.subtitle,
        body: a.body,
        gameId: a.gameId,
        countdownTo: a.countdownTo,
        countdownLabel: a.countdownLabel,
        ctaLabel: a.ctaLabel,
        ctaUrl: a.gameId && a.ctaUrl === `/games/${a.gameId}` ? null : a.ctaUrl,
        startsAt: a.startsAt,
        endsAt: a.endsAt,
        isActive: !a.isActive,
        priority: a.priority,
      });
      upsertLocal(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không cập nhật được");
    }
  };

  const remove = async (a: Announcement) => {
    try {
      await api(`/${a.id}`, "DELETE");
      setItems((list) => list.filter((x) => x.id !== a.id));
      setFlash("Đã xóa thông báo.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không xóa được");
    } finally {
      setConfirmDelete(null);
    }
  };

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-white font-mono tracking-tight">Thông báo</h1>
          <p className="text-xs text-steam-muted mt-0.5">Pop-up hiện khi khách vào web: game bom tấn sắp ra mắt, sự kiện sắp tới…</p>
        </div>
        <button onClick={() => setEditing("new")} className="steam-btn bg-steam-blue text-black hover:bg-steam-blue-hover text-xs md:text-sm flex-shrink-0">
          <Plus size={14} /> Thêm thông báo
        </button>
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

      {loading ? (
        <div className="py-10 flex justify-center text-steam-muted">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center text-steam-muted bg-steam-surface border border-steam-border rounded-sm">
          <Megaphone size={28} className="mx-auto mb-2 text-steam-border" />
          <p className="text-sm">Chưa có thông báo nào</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((a) => {
            const st = statusOf(a);
            return (
              <div key={a.id} className={`bg-steam-surface border border-steam-border rounded-sm overflow-hidden flex ${a.isActive ? "" : "opacity-60"}`}>
                <div className="w-28 sm:w-36 shrink-0 bg-steam-bg">
                  {a.imageUrl ? <img src={a.imageUrl} alt="" className="w-full h-full object-cover" /> : <Megaphone className="m-auto mt-8 text-steam-border" />}
                </div>
                <div className="flex-1 min-w-0 p-3 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`px-1.5 py-0.5 rounded-sm text-[10px] font-semibold border ${KIND_STYLES[a.kind]}`}>{KIND_LABELS[a.kind]}</span>
                    <span className={`px-1.5 py-0.5 rounded-sm text-[10px] font-semibold border ${st.cls}`}>{st.label}</span>
                    {a.priority !== 0 && <span className="text-[10px] text-steam-muted">ưu tiên {a.priority}</span>}
                  </div>
                  <p className="text-sm text-white font-semibold truncate">{a.title}</p>
                  {a.subtitle && <p className="text-xs text-steam-muted truncate">{a.subtitle}</p>}
                  <p className="text-[11px] text-steam-muted">
                    {a.countdownTo && (
                      <>
                        <CalendarClock size={10} className="inline mr-1" />
                        {fmt(a.countdownTo)} · <span className="text-steam-gold">{daysLeft(a.countdownTo)}</span>
                      </>
                    )}
                    {a.gameName && <span className="block truncate">Game: {a.gameName}</span>}
                  </p>
                  <div className="flex gap-1 pt-1">
                    <button onClick={() => setEditing(a)} className="inline-flex items-center gap-1 px-2 py-1 rounded-sm text-[11px] text-steam-blue border border-steam-blue/30 hover:bg-steam-blue/10">
                      <Pencil size={11} /> Sửa
                    </button>
                    <button onClick={() => toggle(a)} className="inline-flex items-center gap-1 px-2 py-1 rounded-sm text-[11px] text-steam-muted border border-steam-border hover:text-steam-text">
                      {a.isActive ? <EyeOff size={11} /> : <Eye size={11} />} {a.isActive ? "Tắt" : "Bật"}
                    </button>
                    <button onClick={() => setConfirmDelete(a)} className="inline-flex items-center gap-1 px-2 py-1 rounded-sm text-[11px] text-red-400 border border-red-500/30 hover:bg-red-500/10 ml-auto">
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <FormModal
          item={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(a, msg) => {
            upsertLocal(a);
            setFlash(msg);
          }}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setConfirmDelete(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm bg-steam-surface border border-steam-border rounded-sm p-4 space-y-3">
            <p className="text-sm text-steam-text">
              Xóa thông báo <b>{confirmDelete.title}</b>?
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} className="steam-btn text-xs bg-steam-surface-3 border border-steam-border text-steam-muted">
                Hủy
              </button>
              <button onClick={() => remove(confirmDelete)} className="steam-btn text-xs bg-red-500 text-white">
                <Trash2 size={13} /> Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
