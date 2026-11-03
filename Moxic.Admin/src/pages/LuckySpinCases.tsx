import { useRef, useState } from "react";
import {
  AlertCircle,
  Archive,
  Clock,
  Coins,
  Edit3,
  Gift,
  ImagePlus,
  KeyRound,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { apiFetch, apiUrl } from "../lib/api";
import { describeOpenMethod, OPEN_METHOD_LABELS, OPEN_METHODS, readApiError, slugify } from "../lib/luckySpinAdmin";
import type { AdminCase, OpenMethod } from "../lib/luckySpinAdmin";

interface LuckySpinCasesProps {
  cases: AdminCase[];
  reload: () => Promise<void>;
  onManagePrizes: (caseId: string) => void;
}

interface CaseForm {
  name: string;
  slug: string;
  slugTouched: boolean;
  description: string;
  openMethod: OpenMethod;
  freeIntervalHours: string;
  pointsCost: string;
  displayOrder: string;
  isActive: boolean;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const METHOD_ICON: Record<OpenMethod, typeof KeyRound> = {
  Code: KeyRound,
  FreeInterval: Clock,
  Points: Coins,
};

const METHOD_HINT: Record<OpenMethod, string> = {
  Code: "Khách nhập mã quay do admin tạo. Không cần đăng nhập.",
  FreeInterval: "Mỗi tài khoản đã xác minh được mở miễn phí 1 lần mỗi chu kỳ.",
  Points: "Trừ điểm thưởng của khách mỗi lần mở.",
};

const emptyForm: CaseForm = {
  name: "",
  slug: "",
  slugTouched: false,
  description: "",
  openMethod: "Code",
  freeIntervalHours: "24",
  pointsCost: "500",
  displayOrder: "0",
  isActive: true,
};

function toForm(c: AdminCase): CaseForm {
  return {
    name: c.name,
    slug: c.slug,
    slugTouched: true,
    description: c.description ?? "",
    openMethod: c.openMethod,
    freeIntervalHours: String(c.freeIntervalHours || 24),
    pointsCost: String(c.pointsCost || 500),
    displayOrder: String(c.displayOrder),
    isActive: c.isActive,
  };
}

function caseBody(c: AdminCase, overrides: Partial<{ isActive: boolean }> = {}) {
  return {
    name: c.name,
    slug: c.slug,
    description: c.description,
    openMethod: c.openMethod,
    freeIntervalHours: c.freeIntervalHours,
    pointsCost: c.pointsCost,
    isActive: overrides.isActive ?? c.isActive,
    displayOrder: c.displayOrder,
  };
}

function Thumb({ c }: { c: AdminCase }) {
  return (
    <div className="w-12 h-12 rounded-sm overflow-hidden flex items-center justify-center flex-shrink-0 bg-steam-surface-3 border border-steam-border">
      {c.imageUrl ? (
        <img src={c.imageUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <Archive size={20} className="text-steam-muted" />
      )}
    </div>
  );
}

function PoolChip({ c }: { c: AdminCase }) {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] font-semibold border whitespace-nowrap ${
        c.isPoolValid
          ? "bg-steam-green/10 text-steam-green border-steam-green/30"
          : "bg-steam-gold/10 text-steam-gold border-steam-gold/30"
      }`}
      title="Tổng tỉ lệ các giải đang bật"
    >
      {c.activePrizeCount}/{c.prizeCount} giải · {c.activeTotalPercent.toFixed(2)}%
    </span>
  );
}

function MethodChip({ c }: { c: AdminCase }) {
  const Icon = METHOD_ICON[c.openMethod];
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[10px] font-semibold border bg-steam-blue/10 text-steam-blue border-steam-blue/30 whitespace-nowrap">
      <Icon size={10} /> {describeOpenMethod(c)}
    </span>
  );
}

export default function LuckySpinCases({ cases, reload, onManagePrizes }: LuckySpinCasesProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCase | null>(null);
  const [form, setForm] = useState<CaseForm>(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (c: AdminCase) => {
    setEditing(c);
    setForm(toForm(c));
    setFormError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving || uploading) return;
    setModalOpen(false);
    setEditing(null);
  };

  const setName = (name: string) =>
    setForm((f) => ({ ...f, name, slug: f.slugTouched ? f.slug : slugify(name) }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    const name = form.name.trim();
    if (name.length < 2 || name.length > 100) {
      setFormError("Tên hòm phải từ 2 đến 100 ký tự.");
      return;
    }
    const hours = Number.parseInt(form.freeIntervalHours, 10);
    const cost = Number.parseInt(form.pointsCost, 10);
    if (form.openMethod === "FreeInterval" && (!Number.isFinite(hours) || hours < 1 || hours > 720)) {
      setFormError("Chu kỳ miễn phí phải từ 1 đến 720 giờ.");
      return;
    }
    if (form.openMethod === "Points" && (!Number.isFinite(cost) || cost < 1 || cost > 1_000_000)) {
      setFormError("Số điểm mở hòm phải từ 1 đến 1.000.000.");
      return;
    }

    setSaving(true);
    try {
      const body = {
        name,
        slug: form.slug.trim() || null,
        description: form.description.trim() || null,
        openMethod: form.openMethod,
        freeIntervalHours: form.openMethod === "FreeInterval" ? hours : null,
        pointsCost: form.openMethod === "Points" ? cost : null,
        isActive: form.isActive,
        displayOrder: Number.parseInt(form.displayOrder, 10) || 0,
      };
      const res = await apiFetch(
        apiUrl(editing ? `/api/admin/lucky-spin/cases/${editing.id}` : "/api/admin/lucky-spin/cases"),
        {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        setFormError(await readApiError(res, "Không lưu được hòm"));
        return;
      }
      const saved: AdminCase = await res.json();
      await reload();
      if (editing) {
        setModalOpen(false);
        setEditing(null);
      } else {
        // Stay open in edit mode so the admin can add a cover image right away.
        setEditing(saved);
        setForm(toForm(saved));
      }
    } catch {
      setFormError("Không lưu được hòm");
    } finally {
      setSaving(false);
    }
  };

  const uploadImage = async (file: File) => {
    if (!editing) return;
    setFormError("");
    const ext = file.name.toLowerCase().split(".").pop() ?? "";
    if (!["jpg", "jpeg", "png", "webp"].includes(ext)) {
      setFormError("Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setFormError("Ảnh tối đa 5MB.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiFetch(apiUrl(`/api/admin/lucky-spin/cases/${editing.id}/image`), {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        setFormError(await readApiError(res, "Không tải ảnh lên được"));
        return;
      }
      const saved: AdminCase = await res.json();
      setEditing(saved);
      await reload();
    } catch {
      setFormError("Không tải ảnh lên được");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeImage = async () => {
    if (!editing) return;
    setUploading(true);
    setFormError("");
    try {
      const res = await apiFetch(apiUrl(`/api/admin/lucky-spin/cases/${editing.id}/image`), { method: "DELETE" });
      if (!res.ok) {
        setFormError(await readApiError(res, "Không xóa được ảnh"));
        return;
      }
      setEditing(await res.json());
      await reload();
    } finally {
      setUploading(false);
    }
  };

  const toggleActive = async (c: AdminCase) => {
    setBusyId(c.id);
    setError("");
    try {
      const res = await apiFetch(apiUrl(`/api/admin/lucky-spin/cases/${c.id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(caseBody(c, { isActive: !c.isActive })),
      });
      if (!res.ok) {
        setError(await readApiError(res, "Không cập nhật được trạng thái hòm"));
        return;
      }
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (c: AdminCase) => {
    if (
      !window.confirm(
        `Xóa hòm "${c.name}"?\n\nXóa hòm sẽ xóa toàn bộ giải thưởng và mã quay của hòm. Lịch sử quay vẫn được giữ lại.`
      )
    )
      return;
    setBusyId(c.id);
    setError("");
    try {
      const res = await apiFetch(apiUrl(`/api/admin/lucky-spin/cases/${c.id}`), { method: "DELETE" });
      if (!res.ok) {
        setError(await readApiError(res, "Không xóa được hòm"));
        return;
      }
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  const renderToggle = (c: AdminCase) => (
    <button
      onClick={() => toggleActive(c)}
      disabled={busyId === c.id}
      className={`px-2 py-1 rounded-sm text-[10px] font-semibold border transition-colors ${
        c.isActive
          ? "bg-steam-green/10 text-steam-green border-steam-green/30 hover:bg-steam-green/20"
          : "bg-steam-surface-3 text-steam-muted border-steam-border hover:text-steam-text"
      }`}
      title={c.isActive ? "Tắt hòm" : "Bật hòm"}
    >
      {busyId === c.id ? <Loader2 size={10} className="animate-spin" /> : c.isActive ? "BẬT" : "TẮT"}
    </button>
  );

  const renderActions = (c: AdminCase) => (
    <div className="flex items-center gap-0.5 flex-shrink-0">
      {renderToggle(c)}
      <button
        onClick={() => onManagePrizes(c.id)}
        className="p-1.5 rounded text-steam-muted hover:text-steam-gold hover:bg-steam-gold/10 transition-colors"
        title="Quản lý giải thưởng"
      >
        <Gift size={13} />
      </button>
      <button
        onClick={() => openEdit(c)}
        className="p-1.5 rounded text-steam-muted hover:text-steam-blue hover:bg-steam-blue/10 transition-colors"
        title="Sửa"
      >
        <Edit3 size={13} />
      </button>
      <button
        onClick={() => handleDelete(c)}
        disabled={busyId === c.id}
        className="p-1.5 rounded text-steam-muted hover:text-steam-accent hover:bg-steam-accent/10 transition-colors"
        title="Xóa"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <p className="text-xs text-steam-muted">
          {cases.length} hòm · mỗi hòm có danh sách giải riêng, tổng tỉ lệ giải đang bật phải bằng 100%.
        </p>
        <button
          onClick={openCreate}
          className="steam-btn bg-steam-blue text-black hover:bg-steam-blue-hover glow-blue text-xs md:text-sm px-3 md:px-5 justify-center"
        >
          <Plus size={14} /> Tạo hòm
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-1.5 px-3 py-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          <AlertCircle size={12} /> {error}
        </div>
      )}

      {cases.length === 0 ? (
        <div className="py-12 text-center text-steam-muted bg-steam-surface border border-steam-border rounded-sm">
          <Archive size={28} className="mx-auto mb-2 text-steam-border" />
          <p className="text-sm">Chưa có hòm nào</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden bg-steam-surface border border-steam-border rounded-sm divide-y divide-steam-border">
            {cases.map((c) => (
              <div key={c.id} className={`p-3 space-y-2 ${c.isActive ? "" : "opacity-60"}`}>
                <div className="flex items-start gap-3">
                  <Thumb c={c} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white font-medium truncate">{c.name}</p>
                    <p className="text-[11px] text-steam-muted font-mono truncate">/{c.slug}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <MethodChip c={c} />
                      <PoolChip c={c} />
                      {c.openMethod === "Code" && (
                        <span className="text-[10px] text-steam-muted">{c.codeCount} mã</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  {renderActions(c)}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-steam-surface border border-steam-border rounded-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-steam-border bg-steam-bg/30">
                  {["#", "Hòm", "Cách mở", "Giải thưởng", "Mã quay", ""].map((h, i) => (
                    <th
                      key={i}
                      className="text-left px-3 py-2.5 text-[11px] font-medium text-steam-muted uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-steam-border">
                {cases.map((c) => (
                  <tr key={c.id} className={`hover:bg-steam-surface-2/50 transition-colors ${c.isActive ? "" : "opacity-60"}`}>
                    <td className="px-3 py-2.5 text-[11px] text-steam-muted font-mono">{c.displayOrder}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <Thumb c={c} />
                        <div className="min-w-0">
                          <p className="text-sm text-white font-medium truncate max-w-[260px]">{c.name}</p>
                          <p className="text-[11px] text-steam-muted font-mono truncate max-w-[260px]">/{c.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <MethodChip c={c} />
                    </td>
                    <td className="px-3 py-2.5">
                      <PoolChip c={c} />
                    </td>
                    <td className="px-3 py-2.5 text-xs text-steam-muted">
                      {c.openMethod === "Code" ? `${c.codeCount} mã` : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end">
                        {renderActions(c)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Create / edit modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60"
          onClick={closeModal}
        >
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-steam-surface border border-steam-border rounded-t-md sm:rounded-sm p-4 md:p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-steam-muted uppercase tracking-widest">
                {editing ? "Sửa hòm" : "Tạo hòm"}
              </h2>
              <button type="button" onClick={closeModal} className="p-1 rounded text-steam-muted hover:text-steam-text" aria-label="Đóng">
                <X size={14} />
              </button>
            </div>

            <div>
              <label className="block text-xs text-steam-muted mb-1">
                Tên hòm <span className="text-steam-accent">*</span>
              </label>
              <input
                value={form.name}
                maxLength={100}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Hòm miễn phí mỗi ngày"
                className="w-full steam-input"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-steam-muted mb-1">Slug (đường dẫn)</label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-steam-muted font-mono">/lucky-spin/</span>
                <input
                  value={form.slug}
                  maxLength={80}
                  onChange={(e) => setForm({ ...form, slug: e.target.value, slugTouched: true })}
                  onBlur={() => setForm((f) => ({ ...f, slug: slugify(f.slug) }))}
                  placeholder={slugify(form.name) || "tu-dong-tao"}
                  className="w-full steam-input font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-steam-muted mb-1">Mô tả (tùy chọn)</label>
              <textarea
                value={form.description}
                maxLength={1000}
                rows={3}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full steam-input resize-y"
              />
            </div>

            <div>
              <span className="block text-xs text-steam-muted mb-1">Cách mở hòm</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup">
                {OPEN_METHODS.map((m) => {
                  const Icon = METHOD_ICON[m];
                  const active = form.openMethod === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setForm({ ...form, openMethod: m })}
                      className={`text-left px-3 py-2 rounded-sm border transition-colors ${
                        active
                          ? "border-steam-blue bg-steam-blue/10 text-steam-blue"
                          : "border-steam-border text-steam-muted hover:text-steam-text hover:border-steam-blue/40"
                      }`}
                    >
                      <span className="flex items-center gap-1.5 text-xs font-semibold">
                        <Icon size={13} /> {OPEN_METHOD_LABELS[m]}
                      </span>
                      <span className="block text-[10px] leading-snug mt-1 opacity-80">{METHOD_HINT[m]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {form.openMethod === "FreeInterval" && (
                <div>
                  <label className="block text-xs text-steam-muted mb-1">Chu kỳ miễn phí (giờ)</label>
                  <input
                    type="number"
                    min={1}
                    max={720}
                    step={1}
                    value={form.freeIntervalHours}
                    onChange={(e) => setForm({ ...form, freeIntervalHours: e.target.value })}
                    className="w-full steam-input"
                  />
                </div>
              )}
              {form.openMethod === "Points" && (
                <div>
                  <label className="block text-xs text-steam-muted mb-1">Số điểm mỗi lần mở</label>
                  <input
                    type="number"
                    min={1}
                    max={1000000}
                    step={1}
                    value={form.pointsCost}
                    onChange={(e) => setForm({ ...form, pointsCost: e.target.value })}
                    className="w-full steam-input"
                  />
                </div>
              )}
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
              Đang bật (hiển thị trên cửa hàng)
            </label>

            {editing ? (
              <div className="border-t border-steam-border pt-3">
                <span className="block text-xs text-steam-muted mb-2">Ảnh bìa (JPG/PNG/WEBP, tối đa 5MB)</span>
                <div className="flex items-center gap-3">
                  <div className="w-20 h-20 rounded-sm overflow-hidden flex items-center justify-center bg-steam-surface-3 border border-steam-border flex-shrink-0">
                    {editing.imageUrl ? (
                      <img src={editing.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Archive size={24} className="text-steam-muted" />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadImage(f);
                      }}
                    />
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => fileRef.current?.click()}
                      className="steam-btn bg-steam-surface-3 text-steam-text border border-steam-border hover:border-steam-blue/40 text-xs px-3 py-1.5"
                    >
                      {uploading ? <Loader2 size={12} className="animate-spin" /> : <ImagePlus size={12} />}
                      {editing.imageUrl ? "Đổi ảnh" : "Tải ảnh lên"}
                    </button>
                    {editing.imageUrl && (
                      <button
                        type="button"
                        disabled={uploading}
                        onClick={removeImage}
                        className="steam-btn bg-steam-surface-3 text-steam-muted border border-steam-border hover:text-steam-accent text-xs px-3 py-1.5"
                      >
                        <Trash2 size={12} /> Xóa ảnh
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-steam-muted">Có thể thêm ảnh bìa sau khi tạo hòm.</p>
            )}

            {formError && (
              <div className="flex items-center gap-1.5 px-3 py-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                <AlertCircle size={12} className="flex-shrink-0" /> {formError}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={closeModal}
                className="steam-btn bg-steam-surface-3 text-steam-muted hover:text-steam-text border border-steam-border text-xs md:text-sm"
              >
                {editing ? "Đóng" : "Hủy"}
              </button>
              <button
                type="submit"
                disabled={saving || uploading}
                className="steam-btn bg-steam-blue text-black hover:bg-steam-blue-hover text-xs md:text-sm"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Lưu
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
