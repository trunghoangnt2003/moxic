import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Box, CheckCircle2, Loader2, Pencil, Plus, Ticket, Trash2, X } from "lucide-react";
import { apiFetch, apiUrl } from "../lib/api";
import { readApiError } from "../lib/luckySpinAdmin";

interface Item {
  id: string;
  name: string;
  description: string | null;
  kind: "Coupon" | "CaseCode";
  pointsCost: number;
  discountType: "Percent" | "Fixed" | null;
  discountValue: number | null;
  discountMaxAmount: number | null;
  discountMinOrderAmount: number | null;
  spinCaseId: string | null;
  validDays: number;
  stock: number | null;
  redeemedCount: number;
  perUserLimit: number | null;
  isActive: boolean;
  displayOrder: number;
  redeemed30d: number;
}

interface CaseOpt {
  id: string;
  name: string;
  isActive: boolean;
}

type Form = {
  id?: string;
  name: string;
  description: string;
  kind: "Coupon" | "CaseCode";
  pointsCost: string;
  discountType: "Percent" | "Fixed";
  discountValue: string;
  discountMaxAmount: string;
  discountMinOrderAmount: string;
  spinCaseId: string;
  validDays: string;
  stock: string;
  perUserLimit: string;
  isActive: boolean;
  displayOrder: string;
};

const EMPTY: Form = {
  name: "",
  description: "",
  kind: "Coupon",
  pointsCost: "500",
  discountType: "Fixed",
  discountValue: "30000",
  discountMaxAmount: "",
  discountMinOrderAmount: "",
  spinCaseId: "",
  validDays: "30",
  stock: "",
  perUserLimit: "",
  isActive: true,
  displayOrder: "0",
};

const vnd = (n: number) => n.toLocaleString("vi-VN") + "₫";
const s = (v: number | null | undefined) => (v == null ? "" : String(v));
const num = (v: string) => (v.trim() === "" ? null : Number(v));

function describe(i: Item, cases: CaseOpt[]) {
  if (i.kind === "CaseCode") return `Mã mở hòm: ${cases.find((c) => c.id === i.spinCaseId)?.name ?? "?"}`;
  const v = i.discountType === "Percent" ? `-${i.discountValue}%${i.discountMaxAmount ? ` (tối đa ${vnd(i.discountMaxAmount)})` : ""}` : `-${vnd(i.discountValue ?? 0)}`;
  return `${v}${i.discountMinOrderAmount ? ` · đơn từ ${vnd(i.discountMinOrderAmount)}` : ""}`;
}

export default function RewardShop() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [cases, setCases] = useState<CaseOpt[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch(apiUrl("/api/admin/reward-items"));
      if (!res.ok) throw new Error(await readApiError(res, "Không tải được"));
      const data = await res.json();
      setItems(data.items);
      setCases(data.cases);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Không tải được" });
      setItems([]);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const edit = (i: Item) =>
    setForm({
      id: i.id,
      name: i.name,
      description: i.description ?? "",
      kind: i.kind,
      pointsCost: String(i.pointsCost),
      discountType: i.discountType ?? "Fixed",
      discountValue: s(i.discountValue),
      discountMaxAmount: s(i.discountMaxAmount),
      discountMinOrderAmount: s(i.discountMinOrderAmount),
      spinCaseId: i.spinCaseId ?? "",
      validDays: String(i.validDays),
      stock: s(i.stock),
      perUserLimit: s(i.perUserLimit),
      isActive: i.isActive,
      displayOrder: String(i.displayOrder),
    });

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setMsg(null);
    try {
      const body = {
        name: form.name,
        description: form.description || null,
        kind: form.kind,
        pointsCost: Number(form.pointsCost),
        discountType: form.kind === "Coupon" ? form.discountType : null,
        discountValue: num(form.discountValue),
        discountMaxAmount: num(form.discountMaxAmount),
        discountMinOrderAmount: num(form.discountMinOrderAmount),
        spinCaseId: form.kind === "CaseCode" ? form.spinCaseId || null : null,
        validDays: Number(form.validDays) || 30,
        stock: num(form.stock),
        perUserLimit: num(form.perUserLimit),
        isActive: form.isActive,
        displayOrder: Number(form.displayOrder) || 0,
      };
      const res = await apiFetch(apiUrl(form.id ? `/api/admin/reward-items/${form.id}` : "/api/admin/reward-items"), {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await readApiError(res, "Lưu thất bại"));
      setForm(null);
      setMsg({ ok: true, text: "Đã lưu phần quà." });
      load();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Lưu thất bại" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (i: Item) => {
    if (!confirm(`Xóa "${i.name}"? Mã đã đổi trước đó vẫn dùng được.`)) return;
    const res = await apiFetch(apiUrl(`/api/admin/reward-items/${i.id}`), { method: "DELETE" });
    if (!res.ok) setMsg({ ok: false, text: await readApiError(res, "Xóa thất bại") });
    else load();
  };

  const input = "w-full bg-steam-surface-2 border border-steam-border rounded-sm px-3 py-2 text-sm text-steam-text focus:outline-none focus:border-steam-blue";
  const label = "block text-xs text-steam-muted mb-1";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-white font-mono tracking-tight">Đổi điểm</h1>
          <p className="text-xs text-steam-muted">Khách dùng điểm Moxic Rewards để đổi mã giảm giá (vào ví) hoặc mã mở hòm.</p>
        </div>
        <button type="button" onClick={() => setForm({ ...EMPTY })} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-sm bg-steam-blue text-white text-sm font-semibold">
          <Plus size={14} /> Thêm phần quà
        </button>
      </div>

      {msg && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-sm text-sm border ${msg.ok ? "border-green-500/30 bg-green-500/10 text-green-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>
          {msg.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />} {msg.text}
        </div>
      )}

      {items == null ? (
        <div className="flex justify-center py-10 text-steam-muted"><Loader2 className="animate-spin" /></div>
      ) : items.length === 0 ? (
        <p className="text-sm text-steam-muted py-10 text-center">Chưa có phần quà nào.</p>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {items.map((i) => (
            <div key={i.id} className={`bg-steam-surface border border-steam-border rounded-sm p-4 space-y-2 ${i.isActive ? "" : "opacity-50"}`}>
              <div className="flex items-start gap-2">
                {i.kind === "CaseCode" ? <Box size={18} className="text-fuchsia-300 mt-0.5" /> : <Ticket size={18} className="text-steam-gold mt-0.5" />}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white truncate">{i.name}</p>
                  <p className="text-xs text-steam-muted">{describe(i, cases)}</p>
                </div>
                <span className="text-sm font-bold text-steam-gold font-mono whitespace-nowrap">{i.pointsCost.toLocaleString("vi-VN")} đ.</span>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-steam-muted">
                <span>HSD {i.validDays} ngày</span>
                <span>Kho: {i.stock == null ? "∞" : `${Math.max(0, i.stock - i.redeemedCount)}/${i.stock}`}</span>
                {i.perUserLimit && <span>Tối đa {i.perUserLimit}/khách</span>}
                <span>Đã đổi {i.redeemedCount} (30 ngày: {i.redeemed30d})</span>
                {!i.isActive && <span className="text-amber-300">Đang ẩn</span>}
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => edit(i)} className="inline-flex items-center gap-1 px-2 py-1 rounded-sm border border-steam-border text-xs text-steam-text hover:border-steam-blue">
                  <Pencil size={12} /> Sửa
                </button>
                <button type="button" onClick={() => remove(i)} className="inline-flex items-center gap-1 px-2 py-1 rounded-sm border border-steam-border text-xs text-red-300 hover:border-red-400">
                  <Trash2 size={12} /> Xóa
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {form && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => !saving && setForm(null)}>
          <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-steam-surface border border-steam-border rounded-t-lg sm:rounded-sm p-4 md:p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-steam-muted uppercase tracking-widest">{form.id ? "Sửa phần quà" : "Thêm phần quà"}</h2>
              <button type="button" onClick={() => setForm(null)} className="p-1 text-steam-muted hover:text-steam-text" aria-label="Đóng"><X size={16} /></button>
            </div>

            <div className="inline-flex rounded-sm border border-steam-border overflow-hidden text-xs">
              {(["Coupon", "CaseCode"] as const).map((k) => (
                <button key={k} type="button" onClick={() => setForm({ ...form, kind: k })} className={`px-3 py-1.5 ${form.kind === k ? "bg-steam-blue/15 text-steam-blue" : "text-steam-muted hover:text-steam-text"}`}>
                  {k === "Coupon" ? "Mã giảm giá" : "Mã mở hòm"}
                </button>
              ))}
            </div>

            <div>
              <label className={label}>Tên hiển thị *</label>
              <input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Giảm 30.000đ" maxLength={100} />
            </div>
            <div>
              <label className={label}>Mô tả ngắn</label>
              <input className={input} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={300} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Giá (điểm) *</label>
                <input type="number" min={1} className={input} value={form.pointsCost} onChange={(e) => setForm({ ...form, pointsCost: e.target.value })} />
              </div>
              <div>
                <label className={label}>Hạn dùng (ngày)</label>
                <input type="number" min={1} max={365} className={input} value={form.validDays} onChange={(e) => setForm({ ...form, validDays: e.target.value })} />
              </div>
            </div>

            {form.kind === "Coupon" ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={label}>Kiểu giảm</label>
                    <select className={input} value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value as Form["discountType"] })}>
                      <option value="Fixed">Số tiền (₫)</option>
                      <option value="Percent">Phần trăm (%)</option>
                    </select>
                  </div>
                  <div>
                    <label className={label}>Giá trị *</label>
                    <input type="number" min={1} className={input} value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {form.discountType === "Percent" && (
                    <div>
                      <label className={label}>Giảm tối đa (₫)</label>
                      <input type="number" min={0} className={input} value={form.discountMaxAmount} onChange={(e) => setForm({ ...form, discountMaxAmount: e.target.value })} />
                    </div>
                  )}
                  <div>
                    <label className={label}>Đơn tối thiểu (₫)</label>
                    <input type="number" min={0} className={input} value={form.discountMinOrderAmount} onChange={(e) => setForm({ ...form, discountMinOrderAmount: e.target.value })} />
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label className={label}>Hòm (chỉ hòm mở bằng mã) *</label>
                <select className={input} value={form.spinCaseId} onChange={(e) => setForm({ ...form, spinCaseId: e.target.value })}>
                  <option value="">— Chọn hòm —</option>
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.isActive ? "" : " (đang tắt)"}
                    </option>
                  ))}
                </select>
                {cases.length === 0 && <p className="text-[11px] text-amber-300 mt-1">Chưa có hòm nào loại "mở bằng mã" — tạo trong Lucky Spin.</p>}
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={label}>Tồn kho</label>
                <input type="number" min={0} className={input} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} placeholder="∞" />
              </div>
              <div>
                <label className={label}>Tối đa/khách</label>
                <input type="number" min={1} className={input} value={form.perUserLimit} onChange={(e) => setForm({ ...form, perUserLimit: e.target.value })} placeholder="∞" />
              </div>
              <div>
                <label className={label}>Thứ tự</label>
                <input type="number" className={input} value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: e.target.value })} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-steam-text">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Hiển thị cho khách
            </label>

            <button type="button" disabled={saving} onClick={save} className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-sm bg-steam-blue text-white text-sm font-semibold disabled:opacity-50">
              {saving && <Loader2 size={14} className="animate-spin" />} Lưu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
