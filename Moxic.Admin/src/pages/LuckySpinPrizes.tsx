import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  Edit3,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Clover,
  TicketPercent,
  Gift,
  X,
  Save,
  Search,
} from "lucide-react";
import { apiFetch, apiUrl } from "../lib/api";
import { describeDiscount, DISCOUNT_TYPE_LABELS, type CouponDiscountType } from "../lib/couponAdmin";

type SpinPrizeType = "Luck" | "Discount" | "Game";
type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

interface AdminPrize {
  id: string;
  name: string;
  type: SpinPrizeType;
  gameId: string | null;
  gameName: string | null;
  imageUrl: string | null;
  probability: number;
  rarity: Rarity;
  isActive: boolean;
  displayOrder: number;
  discountType: CouponDiscountType | null;
  discountValue: number | null;
  discountMaxAmount: number | null;
  discountMinOrderAmount: number | null;
  discountGameId: string | null;
  discountGameName: string | null;
  discountValidDays: number | null;
}

interface GameOption {
  id: string;
  name: string;
}

interface FormState {
  type: SpinPrizeType;
  gameId: string | null;
  gameName: string;
  name: string;
  probability: string;
  displayOrder: string;
  isActive: boolean;
  /** "" = legacy/manual Discount prize (reward code only, no coupon). */
  discountType: CouponDiscountType | "";
  discountValue: string;
  discountMaxAmount: string;
  discountMinOrderAmount: string;
  discountGameId: string | null;
  discountGameName: string;
  discountValidDays: string;
}

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

const RARITY_COLORS: Record<Rarity, string> = {
  common: "#b0c3d9",
  uncommon: "#4b69ff",
  rare: "#8847ff",
  epic: "#eb4b4b",
  legendary: "#e4ae39",
};

const RARITY_LABELS: Record<Rarity, string> = {
  common: "Phổ thông",
  uncommon: "Hiếm vừa",
  rare: "Hiếm",
  epic: "Cực hiếm",
  legendary: "Huyền thoại",
};

const DEFAULT_NAME_PLACEHOLDER: Record<SpinPrizeType, string> = {
  Luck: "Mặc định: Chúc bạn may mắn lần sau",
  Discount: "Giảm 10%",
  Game: "Mặc định: tên game",
};

const toBp = (percent: number) => Math.round(percent * 100);
const fmtPct = (bp: number) => `${(bp / 100).toFixed(2)}%`;

const emptyForm: FormState = {
  type: "Luck",
  gameId: null,
  gameName: "",
  name: "",
  probability: "",
  displayOrder: "0",
  isActive: true,
  discountType: "Percent",
  discountValue: "",
  discountMaxAmount: "",
  discountMinOrderAmount: "",
  discountGameId: null,
  discountGameName: "",
  discountValidDays: "30",
};

const optNum = (s: string): number | null => {
  if (!s.trim()) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/** Discount fields exactly as stored (used by toggleActive so the config is never wiped). */
const storedDiscountFields = (p: AdminPrize) => ({
  discountType: p.discountType,
  discountValue: p.discountValue,
  discountMaxAmount: p.discountMaxAmount,
  discountMinOrderAmount: p.discountMinOrderAmount,
  discountGameId: p.discountGameId,
  discountValidDays: p.discountValidDays,
});

function PrizeThumb({ prize }: { prize: AdminPrize }) {
  const color = RARITY_COLORS[prize.rarity];
  return (
    <div
      className="w-12 h-12 rounded-sm overflow-hidden flex items-center justify-center flex-shrink-0 bg-steam-surface-3 border-b-2"
      style={{ borderBottomColor: color }}
    >
      {prize.type === "Game" && prize.imageUrl ? (
        <img src={prize.imageUrl} alt="" className="w-full h-full object-cover" />
      ) : prize.type === "Luck" ? (
        <Clover size={20} style={{ color }} />
      ) : prize.type === "Discount" ? (
        <TicketPercent size={20} style={{ color }} />
      ) : (
        <Gift size={20} style={{ color }} />
      )}
    </div>
  );
}

function RarityChip({ rarity }: { rarity: Rarity }) {
  const color = RARITY_COLORS[rarity];
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] font-semibold uppercase tracking-wider border"
      style={{ color, borderColor: `${color}55`, backgroundColor: `${color}1a` }}
    >
      {RARITY_LABELS[rarity]}
    </span>
  );
}

function TypeBadge({ type }: { type: SpinPrizeType }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] font-semibold border ${TYPE_BADGE[type]}`}>
      {TYPE_LABELS[type]}
    </span>
  );
}

interface LuckySpinPrizesProps {
  caseId: string;
  /** Called after a save / delete / toggle so the parent can refresh case validity chips. */
  onChanged?: () => void;
}

export default function LuckySpinPrizes({ caseId, onChanged }: LuckySpinPrizesProps) {
  const [prizes, setPrizes] = useState<AdminPrize[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Game picker
  const [gameSearch, setGameSearch] = useState("");
  const [gameOptions, setGameOptions] = useState<GameOption[]>([]);
  const [gameLoading, setGameLoading] = useState(false);

  const load = async () => {
    try {
      const res = await apiFetch(apiUrl(`/api/admin/lucky-spin/cases/${caseId}/prizes`));
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Không tải được danh sách giải thưởng");
        return;
      }
      setPrizes(await res.json());
    } catch {
      setError("Không tải được danh sách giải thưởng");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [caseId]);

  // Debounced game search (only while the form is open with type Game or Discount)
  useEffect(() => {
    if (!formOpen || form.type === "Luck") return;
    const handle = window.setTimeout(async () => {
      setGameLoading(true);
      try {
        const q = encodeURIComponent(gameSearch.trim());
        const res = await apiFetch(apiUrl(`/api/admin/lucky-spin/game-options?search=${q}`));
        if (res.ok) setGameOptions(await res.json());
      } finally {
        setGameLoading(false);
      }
    }, 300);
    return () => window.clearTimeout(handle);
  }, [gameSearch, formOpen, form.type]);

  const activeTotalBp = useMemo(
    () => prizes.filter((p) => p.isActive).reduce((sum, p) => sum + toBp(p.probability), 0),
    [prizes]
  );

  const editingPrize = editingId ? prizes.find((p) => p.id === editingId) ?? null : null;
  const formProbability = Number(form.probability);
  const formBp = Number.isFinite(formProbability) ? toBp(formProbability) : 0;
  const totalAfterSaveBp =
    activeTotalBp -
    (editingPrize && editingPrize.isActive ? toBp(editingPrize.probability) : 0) +
    (form.isActive ? formBp : 0);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
    setGameSearch("");
    setFormOpen(true);
  };

  const openEdit = (p: AdminPrize) => {
    setEditingId(p.id);
    setForm({
      type: p.type,
      gameId: p.gameId,
      gameName: p.gameName ?? "",
      name: p.name,
      probability: String(p.probability),
      displayOrder: String(p.displayOrder),
      isActive: p.isActive,
      discountType: p.type === "Discount" ? p.discountType ?? "" : "Percent",
      discountValue: p.discountValue != null ? String(p.discountValue) : "",
      discountMaxAmount: p.discountMaxAmount != null ? String(p.discountMaxAmount) : "",
      discountMinOrderAmount: p.discountMinOrderAmount != null ? String(p.discountMinOrderAmount) : "",
      discountGameId: p.discountGameId,
      discountGameName: p.discountGameName ?? "",
      discountValidDays: p.discountValidDays != null ? String(p.discountValidDays) : "30",
    });
    setFormError("");
    setGameSearch("");
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setFormError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!Number.isFinite(formProbability) || formProbability < 0.01 || formProbability > 100) {
      setFormError("Tỉ lệ phải nằm trong khoảng 0.01% đến 100%.");
      return;
    }
    if (form.type === "Game" && !form.gameId) {
      setFormError("Vui lòng chọn game cho giải thưởng.");
      return;
    }
    if (form.type === "Discount" && !form.name.trim()) {
      setFormError("Vui lòng nhập tên giải giảm giá (ví dụ: \"Giảm 10%\").");
      return;
    }
    const configuredDiscount = form.type === "Discount" && form.discountType !== "";
    if (configuredDiscount) {
      const v = Number(form.discountValue);
      if (!Number.isFinite(v) || v <= 0 || (form.discountType === "Percent" && v > 100)) {
        setFormError(form.discountType === "Percent" ? "Phần trăm giảm phải lớn hơn 0 và tối đa 100." : "Số tiền giảm không hợp lệ.");
        return;
      }
      const days = Number(form.discountValidDays || "30");
      if (!Number.isInteger(days) || days < 1 || days > 365) {
        setFormError("Hiệu lực mã phải từ 1 đến 365 ngày.");
        return;
      }
    }
    if (totalAfterSaveBp > 10000) {
      setFormError(`Tổng tỉ lệ các giải đang bật sẽ vượt quá 100% (${fmtPct(totalAfterSaveBp)}).`);
      return;
    }

    setSaving(true);
    try {
      const body = {
        name: form.name.trim() || undefined,
        type: form.type,
        gameId: form.type === "Game" ? form.gameId : null,
        probability: Math.round(formProbability * 100) / 100,
        isActive: form.isActive,
        displayOrder: Number.parseInt(form.displayOrder, 10) || 0,
        discountType: configuredDiscount ? form.discountType : null,
        discountValue: configuredDiscount ? Number(form.discountValue) : null,
        discountMaxAmount: configuredDiscount && form.discountType === "Percent" ? optNum(form.discountMaxAmount) : null,
        discountMinOrderAmount: configuredDiscount ? optNum(form.discountMinOrderAmount) : null,
        discountGameId: configuredDiscount ? form.discountGameId : null,
        discountValidDays: configuredDiscount ? Number(form.discountValidDays || "30") : null,
      };
      const res = await apiFetch(
        apiUrl(editingId ? `/api/admin/lucky-spin/prizes/${editingId}` : `/api/admin/lucky-spin/cases/${caseId}/prizes`),
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setFormError(err.error || "Không lưu được giải thưởng");
        return;
      }
      closeForm();
      await load();
      onChanged?.();
    } catch {
      setFormError("Không lưu được giải thưởng");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p: AdminPrize) => {
    setBusyId(p.id);
    setError("");
    try {
      const res = await apiFetch(apiUrl(`/api/admin/lucky-spin/prizes/${p.id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: p.name,
          type: p.type,
          gameId: p.type === "Game" ? p.gameId : null,
          probability: p.probability,
          isActive: !p.isActive,
          displayOrder: p.displayOrder,
          ...storedDiscountFields(p),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Không cập nhật được trạng thái");
        return;
      }
      await load();
      onChanged?.();
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (p: AdminPrize) => {
    if (!window.confirm(`Xóa giải thưởng "${p.name}"?`)) return;
    setBusyId(p.id);
    setError("");
    try {
      const res = await apiFetch(apiUrl(`/api/admin/lucky-spin/prizes/${p.id}`), { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Không xóa được giải thưởng");
        return;
      }
      if (editingId === p.id) closeForm();
      await load();
      onChanged?.();
    } finally {
      setBusyId(null);
    }
  };

  const totalOk = activeTotalBp === 10000;

  return (
    <div className="space-y-4">
      {/* Total bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div
          className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-sm border text-xs md:text-sm ${
            totalOk
              ? "bg-steam-green/10 border-steam-green/30 text-steam-green"
              : "bg-steam-gold/10 border-steam-gold/30 text-steam-gold"
          }`}
        >
          {totalOk ? <CheckCircle2 size={14} className="flex-shrink-0" /> : <AlertCircle size={14} className="flex-shrink-0" />}
          <span className="font-semibold whitespace-nowrap">
            Tổng tỉ lệ của hòm (giải đang bật): {fmtPct(activeTotalBp)} / 100%
          </span>
        </div>
        {!formOpen && (
          <button
            onClick={openCreate}
            className="steam-btn bg-steam-blue text-black hover:bg-steam-blue-hover glow-blue text-xs md:text-sm px-3 md:px-5 justify-center"
          >
            <Plus size={14} /> Thêm giải
          </button>
        )}
      </div>

      {!totalOk && !loading && (
        <div className="flex items-start gap-1.5 px-3 py-2 rounded-sm bg-steam-gold/5 border border-steam-gold/20 text-xs text-steam-gold">
          <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
          Tổng tỉ lệ các giải đang bật của hòm này phải bằng 100%. Hòm đang bị khóa cho tới khi chỉnh đúng.
        </div>
      )}

      {error && (
        <div className="flex items-center gap-1.5 px-3 py-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          <AlertCircle size={12} /> {error}
        </div>
      )}

      {/* Create / edit panel */}
      {formOpen && (
        <form onSubmit={handleSubmit} className="bg-steam-surface border border-steam-border rounded-sm p-4 md:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-steam-muted uppercase tracking-widest">
              {editingId ? "Sửa giải thưởng" : "Thêm giải thưởng"}
            </h2>
            <button type="button" onClick={closeForm} className="p-1 rounded text-steam-muted hover:text-steam-text">
              <X size={14} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-steam-muted mb-1">Loại giải</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as SpinPrizeType })}
                className="w-full steam-input"
              >
                <option value="Luck">{TYPE_LABELS.Luck}</option>
                <option value="Discount">{TYPE_LABELS.Discount}</option>
                <option value="Game">{TYPE_LABELS.Game}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-steam-muted mb-1">
                Tên giải {form.type === "Discount" ? <span className="text-steam-accent">*</span> : "(tùy chọn)"}
              </label>
              <input
                value={form.name}
                maxLength={100}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={DEFAULT_NAME_PLACEHOLDER[form.type]}
                className="w-full steam-input"
              />
            </div>

            {form.type === "Game" && (
              <div className="md:col-span-2">
                <label className="block text-xs text-steam-muted mb-1">
                  Game <span className="text-steam-accent">*</span>
                </label>
                {form.gameId && (
                  <div className="flex items-center gap-2 mb-2 px-2.5 py-1.5 rounded-sm bg-steam-blue/10 border border-steam-blue/30 text-xs text-steam-blue">
                    <CheckCircle2 size={12} className="flex-shrink-0" />
                    <span className="truncate flex-1">{form.gameName || form.gameId}</span>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, gameId: null, gameName: "" })}
                      className="p-0.5 rounded hover:bg-steam-blue/20"
                      aria-label="Bỏ chọn game"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-steam-muted" />
                  <input
                    value={gameSearch}
                    onChange={(e) => setGameSearch(e.target.value)}
                    placeholder="Tìm game theo tên..."
                    className="w-full steam-input pl-8"
                  />
                  {gameLoading && (
                    <Loader2 size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-steam-muted" />
                  )}
                </div>
                <div className="mt-1.5 max-h-44 overflow-y-auto border border-steam-border rounded-sm divide-y divide-steam-border">
                  {gameOptions.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setForm({ ...form, gameId: g.id, gameName: g.name })}
                      className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                        form.gameId === g.id
                          ? "bg-steam-blue/10 text-steam-blue"
                          : "text-steam-text hover:bg-steam-surface-2"
                      }`}
                    >
                      {g.name}
                    </button>
                  ))}
                  {!gameLoading && gameOptions.length === 0 && (
                    <p className="px-3 py-2 text-xs text-steam-muted">Không tìm thấy game</p>
                  )}
                </div>
              </div>
            )}

            {form.type === "Discount" && (
              <fieldset className="md:col-span-2 border border-steam-gold/30 rounded-sm p-3 space-y-3">
                <legend className="px-1 text-xs font-semibold text-steam-gold">Cấu hình mã giảm giá</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-steam-muted mb-1">Loại</label>
                    <select
                      value={form.discountType}
                      onChange={(e) => setForm({ ...form, discountType: e.target.value as CouponDiscountType | "" })}
                      className="w-full steam-input"
                    >
                      <option value="Percent">{DISCOUNT_TYPE_LABELS.Percent}</option>
                      <option value="Fixed">{DISCOUNT_TYPE_LABELS.Fixed}</option>
                      <option value="">Chưa cấu hình — trao thủ công</option>
                    </select>
                  </div>
                  {form.discountType !== "" && (
                    <>
                      <div>
                        <label className="block text-xs text-steam-muted mb-1">
                          Giá trị ({form.discountType === "Percent" ? "%" : "₫"}) <span className="text-steam-accent">*</span>
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={form.discountType === "Percent" ? 0.01 : 1000}
                          value={form.discountValue}
                          onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                          placeholder={form.discountType === "Percent" ? "VD: 10" : "VD: 50000"}
                          className="w-full steam-input"
                        />
                      </div>
                      {form.discountType === "Percent" && (
                        <div>
                          <label className="block text-xs text-steam-muted mb-1">Giảm tối đa (₫, tùy chọn)</label>
                          <input
                            type="number"
                            min={0}
                            step={1000}
                            value={form.discountMaxAmount}
                            onChange={(e) => setForm({ ...form, discountMaxAmount: e.target.value })}
                            className="w-full steam-input"
                          />
                        </div>
                      )}
                      <div>
                        <label className="block text-xs text-steam-muted mb-1">Đơn tối thiểu (₫, tùy chọn)</label>
                        <input
                          type="number"
                          min={0}
                          step={1000}
                          value={form.discountMinOrderAmount}
                          onChange={(e) => setForm({ ...form, discountMinOrderAmount: e.target.value })}
                          className="w-full steam-input"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-steam-muted mb-1">Hiệu lực (ngày)</label>
                        <input
                          type="number"
                          min={1}
                          max={365}
                          step={1}
                          value={form.discountValidDays}
                          onChange={(e) => setForm({ ...form, discountValidDays: e.target.value })}
                          className="w-full steam-input"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs text-steam-muted mb-1">Áp dụng cho game (tùy chọn)</label>
                        {form.discountGameId && (
                          <div className="flex items-center gap-2 mb-2 px-2.5 py-1.5 rounded-sm bg-steam-blue/10 border border-steam-blue/30 text-xs text-steam-blue">
                            <CheckCircle2 size={12} className="flex-shrink-0" />
                            <span className="truncate flex-1">{form.discountGameName || form.discountGameId}</span>
                            <button
                              type="button"
                              onClick={() => setForm({ ...form, discountGameId: null, discountGameName: "" })}
                              className="p-0.5 rounded hover:bg-steam-blue/20"
                              aria-label="Bỏ chọn game"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        )}
                        <div className="relative">
                          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-steam-muted" />
                          <input
                            value={gameSearch}
                            onChange={(e) => setGameSearch(e.target.value)}
                            placeholder="Tìm game theo tên..."
                            className="w-full steam-input pl-8"
                          />
                          {gameLoading && (
                            <Loader2 size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-steam-muted" />
                          )}
                        </div>
                        <div className="mt-1.5 max-h-36 overflow-y-auto border border-steam-border rounded-sm divide-y divide-steam-border">
                          {gameOptions.map((g) => (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => setForm({ ...form, discountGameId: g.id, discountGameName: g.name })}
                              className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                                form.discountGameId === g.id
                                  ? "bg-steam-blue/10 text-steam-blue"
                                  : "text-steam-text hover:bg-steam-surface-2"
                              }`}
                            >
                              {g.name}
                            </button>
                          ))}
                          {!gameLoading && gameOptions.length === 0 && (
                            <p className="px-3 py-2 text-xs text-steam-muted">Không tìm thấy game</p>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <p className="text-[11px] text-steam-muted">
                  {form.discountType === ""
                    ? "Giải chỉ phát mã thưởng, admin áp dụng thủ công như trước."
                    : "Khách đăng nhập nhận mã vào ví ngay khi trúng; mã hết hạn sau số ngày này."}
                </p>
              </fieldset>
            )}

            <div>
              <label className="block text-xs text-steam-muted mb-1">Tỉ lệ trúng (%)</label>
              <input
                type="number"
                step={0.01}
                min={0.01}
                max={100}
                required
                value={form.probability}
                onChange={(e) => setForm({ ...form, probability: e.target.value })}
                placeholder="VD: 12.5"
                className="w-full steam-input"
              />
            </div>

            <div>
              <label className="block text-xs text-steam-muted mb-1">Thứ tự hiển thị</label>
              <input
                type="number"
                step={1}
                value={form.displayOrder}
                onChange={(e) => setForm({ ...form, displayOrder: e.target.value })}
                className="w-full steam-input"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-steam-text cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="accent-steam-blue"
            />
            Đang bật (tham gia vòng quay)
          </label>

          <p
            className={`text-xs ${
              totalAfterSaveBp > 10000
                ? "text-red-400"
                : totalAfterSaveBp === 10000
                  ? "text-steam-green"
                  : "text-steam-gold"
            }`}
          >
            Tổng sau khi lưu: {fmtPct(totalAfterSaveBp)}
          </p>

          {formError && (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              <AlertCircle size={12} className="flex-shrink-0" /> {formError}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={closeForm}
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
      )}

      {/* Prize list */}
      {loading ? (
        <div className="py-10 flex justify-center text-steam-muted">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : prizes.length === 0 ? (
        <div className="py-12 text-center text-steam-muted bg-steam-surface border border-steam-border rounded-sm">
          <Gift size={28} className="mx-auto mb-2 text-steam-border" />
          <p className="text-sm">Chưa có giải thưởng nào</p>
        </div>
      ) : (
        <div className="bg-steam-surface border border-steam-border rounded-sm divide-y divide-steam-border">
          {prizes.map((p) => (
            <div
              key={p.id}
              className={`flex items-center gap-3 px-3 md:px-4 py-3 ${p.isActive ? "" : "opacity-50"}`}
            >
              <span className="hidden sm:block w-6 text-[11px] text-steam-muted font-mono text-right flex-shrink-0">
                {p.displayOrder}
              </span>
              <PrizeThumb prize={p} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white font-medium truncate">{p.name}</p>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  <TypeBadge type={p.type} />
                  <RarityChip rarity={p.rarity} />
                  {p.type === "Game" && p.gameName && p.gameName !== p.name && (
                    <span className="text-[11px] text-steam-muted truncate">{p.gameName}</span>
                  )}
                  {p.type === "Discount" &&
                    (p.discountType && p.discountValue != null ? (
                      <span className="text-[11px] text-steam-gold truncate">
                        {describeDiscount({ discountType: p.discountType, value: p.discountValue, maxDiscountAmount: p.discountMaxAmount })}
                        {` · HSD ${p.discountValidDays ?? 30} ngày`}
                        {p.discountGameName ? ` · ${p.discountGameName}` : ""}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] font-semibold border bg-amber-500/10 text-amber-400 border-amber-500/30">
                        Chưa cấu hình mã — trao thủ công
                      </span>
                    ))}
                </div>
              </div>
              <span className="text-sm font-mono font-semibold text-white flex-shrink-0">
                {p.probability.toFixed(2)}%
              </span>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button
                  onClick={() => toggleActive(p)}
                  disabled={busyId === p.id}
                  className={`px-2 py-1 rounded-sm text-[10px] font-semibold border transition-colors ${
                    p.isActive
                      ? "bg-steam-green/10 text-steam-green border-steam-green/30 hover:bg-steam-green/20"
                      : "bg-steam-surface-3 text-steam-muted border-steam-border hover:text-steam-text"
                  }`}
                  title={p.isActive ? "Tắt giải" : "Bật giải"}
                >
                  {busyId === p.id ? <Loader2 size={10} className="animate-spin" /> : p.isActive ? "BẬT" : "TẮT"}
                </button>
                <button
                  onClick={() => openEdit(p)}
                  className="p-1.5 rounded text-steam-muted hover:text-steam-blue hover:bg-steam-blue/10 transition-colors"
                  title="Sửa"
                >
                  <Edit3 size={13} />
                </button>
                <button
                  onClick={() => handleDelete(p)}
                  disabled={busyId === p.id}
                  className="p-1.5 rounded text-steam-muted hover:text-steam-accent hover:bg-steam-accent/10 transition-colors"
                  title="Xóa"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
