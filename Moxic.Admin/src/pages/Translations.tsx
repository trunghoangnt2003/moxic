import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Languages, Loader2, Save } from "lucide-react";
import { apiFetch, apiUrl } from "../lib/api";
import { readApiError } from "../lib/luckySpinAdmin";

interface Field {
  field: string;
  label: string;
  vi: string | null;
  en: string | null;
  multiline: boolean;
}
interface Row {
  entity: string;
  id: string;
  title: string;
  fields: Field[];
}

const GROUPS: { entity: string; label: string }[] = [
  { entity: "Game", label: "Game" },
  { entity: "Faq", label: "Hỏi đáp" },
  { entity: "Announcement", label: "Thông báo" },
  { entity: "SpinCase", label: "Hòm quay" },
  { entity: "SpinPrize", label: "Giải thưởng" },
  { entity: "RewardItem", label: "Quà đổi điểm" },
];

const keyOf = (r: Row, f: Field) => `${r.entity}:${r.id}:${f.field}`;

/** English (moxic.co/en) version of every customer-facing text. Empty = the site shows the Vietnamese. */
export default function Translations() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [group, setGroup] = useState("Game");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const res = await apiFetch(apiUrl("/api/admin/translations"));
    if (res.ok) setRows(await res.json());
    else setErr(await readApiError(res, "Không tải được"));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, { total: number; missing: number }> = {};
    for (const r of rows ?? [])
      for (const f of r.fields) {
        if (!f.vi?.trim()) continue;
        c[r.entity] ??= { total: 0, missing: 0 };
        c[r.entity].total++;
        if (!f.en?.trim()) c[r.entity].missing++;
      }
    return c;
  }, [rows]);

  const visible = (rows ?? [])
    .filter((r) => r.entity === group)
    .map((r) => ({ ...r, fields: r.fields.filter((f) => f.vi?.trim() && (!onlyMissing || !f.en?.trim())) }))
    .filter((r) => r.fields.length > 0);

  const save = async (r: Row, f: Field) => {
    const k = keyOf(r, f);
    setBusy(k);
    setErr("");
    try {
      const res = await apiFetch(apiUrl("/api/admin/translations"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity: r.entity, id: r.id, field: f.field, value: drafts[k] ?? "" }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "Lưu thất bại"));
      setRows((list) =>
        list!.map((x) => (x.entity === r.entity && x.id === r.id ? { ...x, fields: x.fields.map((y) => (y.field === f.field ? { ...y, en: drafts[k] || null } : y)) } : x)),
      );
      setDrafts((d) => {
        const n = { ...d };
        delete n[k];
        return n;
      });
      setSaved(k);
      setTimeout(() => setSaved((s) => (s === k ? null : s)), 1500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lưu thất bại");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <div>
        <h1 className="text-lg font-bold text-white font-mono tracking-tight flex items-center gap-2">
          <Languages size={18} /> Bản dịch tiếng Anh
        </h1>
        <p className="text-xs text-steam-muted">
          Nội dung hiển thị ở moxic.co/en. Để trống thì trang tiếng Anh dùng bản tiếng Việt. Lưu từng ô, trang khách cập nhật trong vòng 1 phút.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {GROUPS.map((g) => {
          const c = counts[g.entity];
          return (
            <button
              key={g.entity}
              type="button"
              onClick={() => setGroup(g.entity)}
              className={`px-3 py-1.5 rounded-sm border text-sm ${group === g.entity ? "border-steam-blue bg-steam-blue/20 text-white" : "border-steam-border text-steam-text"}`}
            >
              {g.label}
              {c && <span className={`ml-1.5 text-xs ${c.missing ? "text-amber-300" : "text-green-400"}`}>{c.missing ? `thiếu ${c.missing}` : "đủ"}</span>}
            </button>
          );
        })}
        <label className="ml-auto flex items-center gap-2 text-xs text-steam-muted cursor-pointer">
          <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} /> Chỉ hiện ô chưa dịch
        </label>
      </div>

      {err && (
        <p className="flex items-center gap-2 text-sm text-red-300">
          <AlertCircle size={14} /> {err}
        </p>
      )}

      {rows == null ? (
        <Loader2 className="animate-spin text-steam-muted" />
      ) : visible.length === 0 ? (
        <p className="text-sm text-steam-muted">Không có gì cần dịch ở mục này.</p>
      ) : (
        visible.map((r) => (
          <div key={r.id} className="bg-steam-surface border border-steam-border rounded-sm p-4 space-y-3">
            <p className="text-sm font-semibold text-white truncate">{r.title}</p>
            {r.fields.map((f) => {
              const k = keyOf(r, f);
              const value = drafts[k] ?? f.en ?? "";
              const dirty = drafts[k] !== undefined && drafts[k] !== (f.en ?? "");
              const Input = f.multiline ? "textarea" : "input";
              return (
                <div key={f.field} className="grid md:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-steam-muted mb-1">{f.label} (Tiếng Việt)</p>
                    <p className={`text-sm text-steam-text bg-steam-surface-3/40 rounded-sm px-2 py-1.5 ${f.multiline ? "whitespace-pre-line max-h-40 overflow-y-auto" : "truncate"}`}>{f.vi}</p>
                  </div>
                  <div>
                    <p className="text-xs text-steam-muted mb-1">{f.label} (English)</p>
                    <div className="flex gap-2 items-start">
                      <Input
                        value={value}
                        onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDrafts((d) => ({ ...d, [k]: e.target.value }))}
                        {...(f.multiline ? { rows: 5 } : {})}
                        placeholder="Chưa dịch, đang dùng bản tiếng Việt"
                        className="flex-1 steam-input text-sm"
                      />
                      <button
                        type="button"
                        disabled={!dirty || busy !== null}
                        onClick={() => save(r, f)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-sm bg-steam-blue text-white text-xs font-semibold disabled:opacity-40"
                      >
                        {busy === k ? <Loader2 size={12} className="animate-spin" /> : saved === k ? <Check size={12} /> : <Save size={12} />} Lưu
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}
