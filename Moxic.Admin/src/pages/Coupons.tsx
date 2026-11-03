import { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Edit3,
  ListChecks,
  Loader2,
  Plus,
  Save,
  Search,
  TicketPercent,
  Trash2,
  X,
} from "lucide-react";
import {
  bulkCreateCoupons,
  createCoupon,
  describeDiscount,
  DISCOUNT_TYPE_LABELS,
  fetchCouponRedemptions,
  fetchCoupons,
  formatVnd,
  removeCoupon,
  searchGameOptions,
  toggleCoupon,
  updateCoupon,
  type AdminCoupon,
  type AdminCouponList,
  type AdminCouponRedemption,
  type CouponDiscountType,
  type CouponSource,
  type CouponTermsInput,
  type GameOption,
} from "../lib/couponAdmin";

const PAGE_SIZE = 50;

type SourceTab = CouponSource | "";

const SOURCE_TABS: { value: SourceTab; label: string }[] = [
  { value: "Event", label: "Sự kiện" },
  { value: "SpinReward", label: "Thưởng vòng quay" },
  { value: "", label: "Tất cả" },
];

const fmtDay = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("vi-VN") : "");
const fmtDateTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString("vi-VN") : "");

function validityText(c: AdminCoupon): string {
  if (!c.startsAt && !c.expiresAt) return "Không giới hạn";
  if (c.startsAt && c.expiresAt) return `${fmtDay(c.startsAt)} – ${fmtDay(c.expiresAt)}`;
  if (c.startsAt) return `Từ ${fmtDay(c.startsAt)}`;
  return `Đến ${fmtDay(c.expiresAt)}`;
}

function conditionParts(c: AdminCoupon): string[] {
  const parts: string[] = [];
  if (c.minOrderAmount) parts.push(`Đơn từ ${formatVnd(c.minOrderAmount)}`);
  if (c.gameId) parts.push(`Game: ${c.gameName ?? "(đã xóa)"}`);
  return parts;
}

/** ISO (UTC) → value for <input type="datetime-local"> in local time. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const STATUS_BADGE = "inline-flex px-1.5 py-0.5 rounded-sm text-[10px] font-semibold border whitespace-nowrap";

// ───────────────────────── Form modal ─────────────────────────

interface FormState {
  mode: "single" | "bulk";
  code: string;
  prefix: string;
  count: string;
  name: string;
  discountType: CouponDiscountType;
  value: string;
  maxDiscountAmount: string;
  minOrderAmount: string;
  gameId: string | null;
  gameName: string;
  startsAt: string;
  expiresAt: string;
  maxTotalUses: string;
  maxUsesPerCustomer: string;
  isActive: boolean;
}

const emptyForm: FormState = {
  mode: "single",
  code: "",
  prefix: "",
  count: "10",
  name: "",
  discountType: "Percent",
  value: "",
  maxDiscountAmount: "",
  minOrderAmount: "",
  gameId: null,
  gameName: "",
  startsAt: "",
  expiresAt: "",
  maxTotalUses: "",
  maxUsesPerCustomer: "1",
  isActive: true,
};

function formFromCoupon(c: AdminCoupon): FormState {
  return {
    mode: "single",
    code: c.code,
    prefix: "",
    count: "1",
    name: c.name,
    discountType: c.discountType,
    value: String(c.value),
    maxDiscountAmount: c.maxDiscountAmount != null ? String(c.maxDiscountAmount) : "",
    minOrderAmount: c.minOrderAmount != null ? String(c.minOrderAmount) : "",
    gameId: c.gameId,
    gameName: c.gameName ?? "",
    startsAt: toLocalInput(c.startsAt),
    expiresAt: toLocalInput(c.expiresAt),
    maxTotalUses: c.maxTotalUses != null ? String(c.maxTotalUses) : "",
    maxUsesPerCustomer: String(c.maxUsesPerCustomer),
    isActive: c.isActive,
  };
}

const parseOptionalNumber = (s: string): number | null | "invalid" => {
  if (!s.trim()) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : "invalid";
};

/** Client-side mirror of the server rules. Returns an error or the terms payload. */
function buildTerms(form: FormState, isCreate: boolean): { error: string } | { terms: CouponTermsInput } {
  const name = form.name.trim();
  if (name.length < 1 || name.length > 100) return { error: "Vui lòng nhập tên mã (tối đa 100 ký tự)." };

  const value = Number(form.value);
  if (form.discountType === "Percent") {
    if (!Number.isFinite(value) || value <= 0 || value > 100) return { error: "Phần trăm giảm phải lớn hơn 0 và tối đa 100." };
  } else if (!Number.isFinite(value) || value < 1 || value > 100_000_000) {
    return { error: "Số tiền giảm không hợp lệ." };
  }

  const max = form.discountType === "Percent" ? parseOptionalNumber(form.maxDiscountAmount) : null;
  if (max === "invalid" || (max !== null && max <= 0)) return { error: "Mức giảm tối đa phải lớn hơn 0." };
  const min = parseOptionalNumber(form.minOrderAmount);
  if (min === "invalid" || (min !== null && min < 0)) return { error: "Giá trị đơn tối thiểu không hợp lệ." };

  const starts = form.startsAt ? new Date(form.startsAt) : null;
  const expires = form.expiresAt ? new Date(form.expiresAt) : null;
  if (starts && Number.isNaN(starts.getTime())) return { error: "Thời gian bắt đầu không hợp lệ." };
  if (expires && Number.isNaN(expires.getTime())) return { error: "Thời gian kết thúc không hợp lệ." };
  if (starts && expires && expires.getTime() <= starts.getTime())
    return { error: "Thời gian kết thúc phải sau thời gian bắt đầu." };
  if (isCreate && expires && expires.getTime() <= Date.now()) return { error: "Thời gian kết thúc phải ở tương lai." };

  const total = parseOptionalNumber(form.maxTotalUses);
  if (total === "invalid" || (total !== null && (!Number.isInteger(total) || total < 1 || total > 1_000_000)))
    return { error: "Tổng lượt dùng phải từ 1 đến 1.000.000 (để trống = không giới hạn)." };
  const per = parseOptionalNumber(form.maxUsesPerCustomer);
  if (per === "invalid" || (per !== null && (!Number.isInteger(per) || per < 1 || per > 100)))
    return { error: "Lượt dùng mỗi khách phải từ 1 đến 100." };

  return {
    terms: {
      name,
      discountType: form.discountType,
      value,
      maxDiscountAmount: max,
      minOrderAmount: min,
      gameId: form.gameId,
      startsAt: starts ? starts.toISOString() : null,
      expiresAt: expires ? expires.toISOString() : null,
      maxTotalUses: total,
      maxUsesPerCustomer: per,
      isActive: form.isActive,
    },
  };
}

interface CouponFormModalProps {
  editing: AdminCoupon | null;
  onClose: () => void;
  onSaved: () => void;
}

function CouponFormModal({ editing, onClose, onSaved }: CouponFormModalProps) {
  const [form, setForm] = useState<FormState>(() => (editing ? formFromCoupon(editing) : emptyForm));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [generated, setGenerated] = useState<string[]>([]);
  const [copiedAll, setCopiedAll] = useState(false);

  const [gameSearch, setGameSearch] = useState("");
  const [gameOptions, setGameOptions] = useState<GameOption[]>([]);
  const [gameLoading, setGameLoading] = useState(false);

  useEffect(() => {
    const h = window.setTimeout(async () => {
      setGameLoading(true);
      try {
        setGameOptions(await searchGameOptions(gameSearch));
      } finally {
        setGameLoading(false);
      }
    }, 300);
    return () => window.clearTimeout(h);
  }, [gameSearch]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const isBulk = !editing && form.mode === "bulk";

  const switchMode = (mode: "single" | "bulk") => {
    setForm((f) => ({
      ...f,
      mode,
      // Bulk codes default to single-use each.
      maxTotalUses: mode === "bulk" && !f.maxTotalUses ? "1" : f.maxTotalUses,
    }));
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const built = buildTerms(form, !editing);
    if ("error" in built) {
      setError(built.error);
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await updateCoupon(editing.id, { ...built.terms, code: null });
        onSaved();
        onClose();
      } else if (isBulk) {
        const count = Number.parseInt(form.count, 10);
        if (!Number.isFinite(count) || count < 1 || count > 500) {
          setError("Số lượng phải từ 1 đến 500.");
          return;
        }
        const prefix = form.prefix.trim().toUpperCase().replace(/[\s-]/g, "");
        if (!/^[A-Z0-9]{0,12}$/.test(prefix)) {
          setError("Tiền tố chỉ gồm A-Z và số, tối đa 12 ký tự.");
          return;
        }
        const res = await bulkCreateCoupons({ ...built.terms, prefix, count });
        setGenerated(res.codes);
        setCopiedAll(false);
        onSaved();
      } else {
        const code = form.code.trim().toUpperCase().replace(/[\s-]/g, "");
        if (code && !/^[A-Z0-9]{4,32}$/.test(code)) {
          setError("Mã chỉ gồm chữ A-Z và số, dài 4–32 ký tự.");
          return;
        }
        await createCoupon({ ...built.terms, code: code || null });
        onSaved();
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được mã giảm giá");
    } finally {
      setSaving(false);
    }
  };

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(generated.join("\n"));
      setCopiedAll(true);
      window.setTimeout(() => setCopiedAll(false), 1500);
    } catch {
      setError("Trình duyệt không cho phép sao chép — hãy chọn và copy thủ công.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto bg-steam-surface border border-steam-border rounded-t-lg sm:rounded-sm p-4 md:p-5 space-y-3"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-steam-muted uppercase tracking-widest">
            {editing ? "Sửa mã giảm giá" : "Tạo mã giảm giá"}
          </h2>
          <button type="button" onClick={onClose} className="p-1 rounded text-steam-muted hover:text-steam-text" aria-label="Đóng">
            <X size={14} />
          </button>
        </div>

        {!editing && (
          <div className="inline-flex rounded-sm border border-steam-border overflow-hidden text-xs">
            {(["single", "bulk"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`px-3 py-1.5 transition-colors ${
                  form.mode === m ? "bg-steam-blue/15 text-steam-blue" : "text-steam-muted hover:text-steam-text"
                }`}
              >
                {m === "single" ? "Một mã" : "Tạo hàng loạt"}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {editing ? (
            <div className="sm:col-span-2">
              <label className="block text-xs text-steam-muted mb-1">Mã</label>
              <p className="font-mono text-white tracking-wider">{editing.code}</p>
              {editing.source === "SpinReward" && (
                <p className="text-xs text-steam-muted mt-1">
                  Chủ sở hữu: {editing.ownerEmail ?? (editing.ownerUserId ? editing.ownerUserId : "Chưa nhận")}
                </p>
              )}
            </div>
          ) : isBulk ? (
            <>
              <div>
                <label className="block text-xs text-steam-muted mb-1">Tiền tố (tùy chọn)</label>
                <input
                  value={form.prefix}
                  maxLength={12}
                  onChange={(e) => set("prefix", e.target.value.toUpperCase())}
                  placeholder="VD: TET"
                  className="w-full steam-input font-mono uppercase"
                />
              </div>
              <div>
                <label className="block text-xs text-steam-muted mb-1">Số lượng (1–500)</label>
                <input type="number" min={1} max={500} value={form.count} onChange={(e) => set("count", e.target.value)} className="w-full steam-input" />
              </div>
            </>
          ) : (
            <div className="sm:col-span-2">
              <label className="block text-xs text-steam-muted mb-1">Mã</label>
              <input
                value={form.code}
                maxLength={32}
                onChange={(e) => set("code", e.target.value.toUpperCase())}
                placeholder="VD: TET2027"
                className="w-full steam-input font-mono uppercase"
              />
              <p className="text-[11px] text-steam-muted mt-1">Để trống để tạo ngẫu nhiên</p>
            </div>
          )}

          <div className="sm:col-span-2">
            <label className="block text-xs text-steam-muted mb-1">
              Tên / đợt sự kiện <span className="text-steam-accent">*</span>
            </label>
            <input value={form.name} maxLength={100} onChange={(e) => set("name", e.target.value)} placeholder="VD: Sale Tết 2027" className="w-full steam-input" />
          </div>

          <div>
            <label className="block text-xs text-steam-muted mb-1">Loại giảm</label>
            <select value={form.discountType} onChange={(e) => set("discountType", e.target.value as CouponDiscountType)} className="w-full steam-input">
              <option value="Percent">{DISCOUNT_TYPE_LABELS.Percent}</option>
              <option value="Fixed">{DISCOUNT_TYPE_LABELS.Fixed}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-steam-muted mb-1">
              Giá trị ({form.discountType === "Percent" ? "%" : "₫"}) <span className="text-steam-accent">*</span>
            </label>
            <input
              type="number"
              step={form.discountType === "Percent" ? 0.01 : 1000}
              min={0}
              value={form.value}
              onChange={(e) => set("value", e.target.value)}
              placeholder={form.discountType === "Percent" ? "VD: 10" : "VD: 50000"}
              className="w-full steam-input"
            />
          </div>
          {form.discountType === "Percent" && (
            <div>
              <label className="block text-xs text-steam-muted mb-1">Giảm tối đa (₫, tùy chọn)</label>
              <input type="number" step={1000} min={0} value={form.maxDiscountAmount} onChange={(e) => set("maxDiscountAmount", e.target.value)} className="w-full steam-input" />
            </div>
          )}
          <div>
            <label className="block text-xs text-steam-muted mb-1">Đơn tối thiểu (₫, tùy chọn)</label>
            <input type="number" step={1000} min={0} value={form.minOrderAmount} onChange={(e) => set("minOrderAmount", e.target.value)} className="w-full steam-input" />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs text-steam-muted mb-1">Áp dụng cho game (tùy chọn)</label>
            {form.gameId && (
              <div className="flex items-center gap-2 mb-2 px-2.5 py-1.5 rounded-sm bg-steam-blue/10 border border-steam-blue/30 text-xs text-steam-blue">
                <CheckCircle2 size={12} className="flex-shrink-0" />
                <span className="truncate flex-1">{form.gameName || form.gameId}</span>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, gameId: null, gameName: "" }))}
                  className="p-0.5 rounded hover:bg-steam-blue/20"
                  aria-label="Bỏ chọn game"
                >
                  <X size={12} />
                </button>
              </div>
            )}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-steam-muted" />
              <input value={gameSearch} onChange={(e) => setGameSearch(e.target.value)} placeholder="Tìm game theo tên..." className="w-full steam-input pl-8" />
              {gameLoading && <Loader2 size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-steam-muted" />}
            </div>
            <div className="mt-1.5 max-h-36 overflow-y-auto border border-steam-border rounded-sm divide-y divide-steam-border">
              {gameOptions.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, gameId: g.id, gameName: g.name }))}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                    form.gameId === g.id ? "bg-steam-blue/10 text-steam-blue" : "text-steam-text hover:bg-steam-surface-2"
                  }`}
                >
                  {g.name}
                </button>
              ))}
              {!gameLoading && gameOptions.length === 0 && <p className="px-3 py-2 text-xs text-steam-muted">Không tìm thấy game</p>}
            </div>
          </div>

          <div>
            <label className="block text-xs text-steam-muted mb-1">Bắt đầu (tùy chọn)</label>
            <input type="datetime-local" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} className="w-full steam-input" />
          </div>
          <div>
            <label className="block text-xs text-steam-muted mb-1">Kết thúc (tùy chọn)</label>
            <input type="datetime-local" value={form.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} className="w-full steam-input" />
          </div>
          <div>
            <label className="block text-xs text-steam-muted mb-1">Tổng lượt dùng{isBulk ? " (mỗi mã)" : ""}</label>
            <input type="number" min={1} step={1} value={form.maxTotalUses} onChange={(e) => set("maxTotalUses", e.target.value)} placeholder="Để trống = không giới hạn" className="w-full steam-input" />
          </div>
          <div>
            <label className="block text-xs text-steam-muted mb-1">Lượt mỗi khách</label>
            <input type="number" min={1} max={100} step={1} value={form.maxUsesPerCustomer} onChange={(e) => set("maxUsesPerCustomer", e.target.value)} className="w-full steam-input" />
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-steam-text cursor-pointer select-none">
          <input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} className="accent-steam-blue" />
          Kích hoạt
        </label>

        {error && (
          <div className="flex items-center gap-1.5 px-3 py-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-400">
            <AlertCircle size={12} className="flex-shrink-0" /> {error}
          </div>
        )}

        {generated.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-steam-green">Đã tạo {generated.length} mã</p>
              <button type="button" onClick={copyAll} className="steam-btn bg-steam-surface-3 text-steam-text border border-steam-border hover:border-steam-blue/40 text-xs px-3 py-1.5">
                {copiedAll ? <Check size={12} /> : <Copy size={12} />} Sao chép tất cả
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

        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="steam-btn bg-steam-surface-3 text-steam-muted hover:text-steam-text border border-steam-border text-xs md:text-sm">
            {generated.length > 0 ? "Đóng" : "Hủy"}
          </button>
          <button type="submit" disabled={saving} className="steam-btn bg-steam-blue text-black hover:bg-steam-blue-hover text-xs md:text-sm">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {isBulk ? "Tạo mã" : "Lưu"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ───────────────────────── Redemptions modal ─────────────────────────

function RedemptionsModal({ coupon, onClose }: { coupon: AdminCoupon; onClose: () => void }) {
  const [rows, setRows] = useState<AdminCouponRedemption[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchCouponRedemptions(coupon.id)
      .then((r) => {
        if (!cancelled) setRows(r);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Không tải được lượt sử dụng");
      });
    return () => {
      cancelled = true;
    };
  }, [coupon.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-2xl max-h-[85vh] overflow-y-auto bg-steam-surface border border-steam-border rounded-t-lg sm:rounded-sm p-4 md:p-5 space-y-3"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-xs font-semibold text-steam-muted uppercase tracking-widest">Lượt sử dụng</h2>
            <p className="font-mono text-white tracking-wider truncate">{coupon.code}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded text-steam-muted hover:text-steam-text" aria-label="Đóng">
            <X size={14} />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-1.5 px-3 py-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-400">
            <AlertCircle size={12} /> {error}
          </div>
        )}

        {rows === null && !error ? (
          <div className="py-8 flex justify-center text-steam-muted">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : rows && rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-steam-muted">Chưa có lượt sử dụng.</p>
        ) : (
          <div className="divide-y divide-steam-border border border-steam-border rounded-sm">
            {rows?.map((r) => (
              <div key={r.id} className="px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-white">{r.orderCode}</p>
                  <p className="text-steam-muted truncate">{r.userEmail ?? "—"}</p>
                </div>
                <span className={`${STATUS_BADGE} bg-steam-surface-3 text-steam-muted border-steam-border self-start sm:self-auto`}>{r.orderStatus}</span>
                <span className="font-mono text-steam-green whitespace-nowrap">−{formatVnd(r.discountAmount)}</span>
                <div className="text-steam-muted whitespace-nowrap sm:text-right">
                  <p>{fmtDateTime(r.createdAt)}</p>
                  {r.releasedAt && (
                    <span className={`${STATUS_BADGE} mt-0.5 bg-steam-gold/10 text-steam-gold border-steam-gold/30`} title={fmtDateTime(r.releasedAt)}>
                      Đã hoàn lượt · {fmtDateTime(r.releasedAt)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ───────────────────────── Page ─────────────────────────

export default function Coupons() {
  const [source, setSource] = useState<SourceTab>("Event");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminCouponList>({ items: [], totalCount: 0, page: 1, pageSize: PAGE_SIZE });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCoupon | null>(null);
  const [redemptionsOf, setRedemptionsOf] = useState<AdminCoupon | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const h = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(h);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    const h = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetchCoupons({ source, search: debouncedSearch, page, pageSize: PAGE_SIZE });
        if (!cancelled) {
          setData(res);
          setError("");
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Không tải được danh sách mã giảm giá");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(h);
    };
  }, [source, debouncedSearch, page, reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);

  const changeSource = (s: SourceTab) => {
    setSource(s);
    setPage(1);
  };

  const copyOne = async (c: AdminCoupon) => {
    try {
      await navigator.clipboard.writeText(c.code);
      setCopiedId(c.id);
      window.setTimeout(() => setCopiedId(null), 1200);
    } catch {
      /* ignore */
    }
  };

  const toggle = async (c: AdminCoupon) => {
    setBusyId(c.id);
    setError("");
    try {
      const updated = await toggleCoupon(c.id, !c.isActive);
      setData((d) => ({ ...d, items: d.items.map((x) => (x.id === updated.id ? updated : x)) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không cập nhật được trạng thái");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (c: AdminCoupon) => {
    if (!window.confirm(`Xóa mã ${c.code}?`)) return;
    setBusyId(c.id);
    setError("");
    try {
      await removeCoupon(c.id);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xóa được mã giảm giá");
    } finally {
      setBusyId(null);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (c: AdminCoupon) => {
    setEditing(c);
    setFormOpen(true);
  };

  const totalPages = Math.max(1, Math.ceil(data.totalCount / PAGE_SIZE));
  const showOwner = source !== "Event";

  const toggleSwitch = (c: AdminCoupon) => (
    <button
      onClick={() => toggle(c)}
      disabled={busyId === c.id}
      role="switch"
      aria-checked={c.isActive}
      title={c.isActive ? "Tắt mã" : "Bật mã"}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full border transition-colors ${
        c.isActive ? "bg-steam-green/30 border-steam-green/50" : "bg-steam-surface-3 border-steam-border"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full transition-transform ${
          c.isActive ? "translate-x-4 bg-steam-green" : "translate-x-0.5 bg-steam-muted"
        }`}
      />
    </button>
  );

  const actions = (c: AdminCoupon) => (
    <div className="flex items-center justify-end gap-0.5">
      <button onClick={() => openEdit(c)} className="p-1.5 rounded text-steam-muted hover:text-steam-blue hover:bg-steam-blue/10 transition-colors" title="Sửa">
        <Edit3 size={13} />
      </button>
      <button onClick={() => setRedemptionsOf(c)} className="p-1.5 rounded text-steam-muted hover:text-steam-blue hover:bg-steam-blue/10 transition-colors" title="Lượt dùng">
        <ListChecks size={13} />
      </button>
      <button
        onClick={() => remove(c)}
        disabled={busyId === c.id}
        className="p-1.5 rounded text-steam-muted hover:text-steam-accent hover:bg-steam-accent/10 transition-colors"
        title="Xóa"
      >
        {busyId === c.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
      </button>
    </div>
  );

  const codeCell = (c: AdminCoupon) => (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="font-mono text-white tracking-wider truncate">{c.code}</span>
      <button onClick={() => copyOne(c)} className="p-1 rounded text-steam-muted hover:text-steam-blue flex-shrink-0" title="Copy">
        {copiedId === c.id ? <Check size={12} className="text-steam-green" /> : <Copy size={12} />}
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg md:text-xl font-semibold text-white flex items-center gap-2">
            <TicketPercent size={20} className="text-steam-gold" /> Mã giảm giá sự kiện
          </h1>
          <p className="text-xs text-steam-muted mt-0.5">Khách phải đăng nhập để dùng mã. Mỗi đơn chỉ áp dụng một mã.</p>
        </div>
        <button onClick={openCreate} className="steam-btn bg-steam-blue text-black hover:bg-steam-blue-hover glow-blue text-xs md:text-sm px-3 md:px-5 justify-center">
          <Plus size={14} /> Tạo mã
        </button>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-2 justify-between">
        <div className="inline-flex rounded-sm border border-steam-border overflow-hidden text-xs self-start">
          {SOURCE_TABS.map((t) => (
            <button
              key={t.label}
              onClick={() => changeSource(t.value)}
              className={`px-3 py-1.5 transition-colors whitespace-nowrap ${
                source === t.value ? "bg-steam-blue/15 text-steam-blue" : "text-steam-muted hover:text-steam-text"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-64">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-steam-muted" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm mã hoặc tên..." className="w-full steam-input pl-8" />
          </div>
          <p className="text-xs text-steam-muted whitespace-nowrap">{data.totalCount} mã</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-1.5 px-3 py-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          <AlertCircle size={12} className="flex-shrink-0" /> {error}
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden md:block bg-steam-surface border border-steam-border rounded-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[960px]">
          <thead>
            <tr className="border-b border-steam-border bg-steam-bg/30">
              {["Mã", "Tên", "Giảm", "Điều kiện", "Hiệu lực", "Lượt dùng", ...(showOwner ? ["Chủ sở hữu"] : []), "Trạng thái", ""].map((h, i) => (
                <th key={i} className="text-left px-3 py-2.5 text-[11px] font-medium text-steam-muted uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-steam-border">
            {data.items.map((c) => {
              const conds = conditionParts(c);
              return (
                <tr key={c.id} className={`hover:bg-steam-surface-2/50 transition-colors ${c.isActive ? "" : "opacity-60"}`}>
                  <td className="px-3 py-2.5 max-w-[200px]">
                    {codeCell(c)}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-steam-text max-w-[180px]">
                    <p className="truncate" title={c.name}>{c.name}</p>
                    {source === "" && (
                      <p className="text-[10px] text-steam-muted">{c.source === "SpinReward" ? "Thưởng vòng quay" : "Sự kiện"}</p>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-steam-gold whitespace-nowrap">{describeDiscount(c)}</td>
                  <td className="px-3 py-2.5 text-xs text-steam-muted">
                    {conds.length ? conds.map((p) => <p key={p} className="whitespace-nowrap">{p}</p>) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-steam-muted whitespace-nowrap">{validityText(c)}</td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                    <p className="font-mono text-steam-text">
                      {c.usedCount} / {c.maxTotalUses ?? "∞"}
                    </p>
                    <p className="text-[10px] text-steam-muted">mỗi khách {c.maxUsesPerCustomer}</p>
                  </td>
                  {showOwner && (
                    <td className="px-3 py-2.5 text-xs text-steam-muted max-w-[180px] truncate">
                      {c.source === "SpinReward" ? c.ownerEmail ?? (c.ownerUserId ? "(tài khoản đã xóa)" : "Chưa nhận") : "—"}
                    </td>
                  )}
                  <td className="px-3 py-2.5">
                    {toggleSwitch(c)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {actions(c)}
                  </td>
                </tr>
              );
            })}
            {!loading && data.items.length === 0 && (
              <tr>
                <td colSpan={showOwner ? 9 : 8} className="px-4 py-12 text-center text-steam-muted">
                  <TicketPercent size={28} className="mx-auto mb-2 text-steam-border" />
                  <p className="text-sm">Chưa có mã giảm giá nào</p>
                </td>
              </tr>
            )}
            {loading && data.items.length === 0 && (
              <tr>
                <td colSpan={showOwner ? 9 : 8} className="px-4 py-10 text-center text-steam-muted">
                  <Loader2 size={18} className="mx-auto animate-spin" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {loading && data.items.length === 0 && (
          <div className="py-10 flex justify-center text-steam-muted">
            <Loader2 size={18} className="animate-spin" />
          </div>
        )}
        {!loading && data.items.length === 0 && (
          <div className="py-12 text-center text-steam-muted bg-steam-surface border border-steam-border rounded-sm">
            <TicketPercent size={28} className="mx-auto mb-2 text-steam-border" />
            <p className="text-sm">Chưa có mã giảm giá nào</p>
          </div>
        )}
        {data.items.map((c) => {
          const conds = conditionParts(c);
          return (
            <div key={c.id} className={`bg-steam-surface border border-steam-border rounded-sm p-3 space-y-2 ${c.isActive ? "" : "opacity-60"}`}>
              <div className="flex items-center justify-between gap-2">
                {codeCell(c)}
                {toggleSwitch(c)}
              </div>
              <p className="text-xs text-steam-text">{c.name}</p>
              <p className="text-sm font-semibold text-steam-gold">{describeDiscount(c)}</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-steam-muted">
                {conds.map((p) => (
                  <span key={p}>{p}</span>
                ))}
                <span>{validityText(c)}</span>
                <span>
                  Đã dùng {c.usedCount}/{c.maxTotalUses ?? "∞"} · mỗi khách {c.maxUsesPerCustomer}
                </span>
                {c.source === "SpinReward" && <span>Chủ: {c.ownerEmail ?? (c.ownerUserId ? "(tài khoản đã xóa)" : "Chưa nhận")}</span>}
              </div>
              {actions(c)}
            </div>
          );
        })}
      </div>

      {data.totalCount > PAGE_SIZE && (
        <div className="flex items-center justify-end gap-2 text-xs text-steam-muted">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="steam-btn bg-steam-surface-3 border border-steam-border px-2 py-1">
            <ChevronLeft size={13} />
          </button>
          <span>
            Trang {page}/{totalPages}
          </span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="steam-btn bg-steam-surface-3 border border-steam-border px-2 py-1">
            <ChevronRight size={13} />
          </button>
        </div>
      )}

      {formOpen && (
        <CouponFormModal
          key={editing?.id ?? "new"}
          editing={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSaved={reload}
        />
      )}
      {redemptionsOf && <RedemptionsModal coupon={redemptionsOf} onClose={() => setRedemptionsOf(null)} />}
    </div>
  );
}
