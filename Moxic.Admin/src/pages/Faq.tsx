import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Eye, EyeOff, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { apiFetch, apiUrl } from "../lib/api";
import { readApiError } from "../lib/luckySpinAdmin";

interface Item {
  id: string;
  question: string;
  answer: string;
  displayOrder: number;
  isActive: boolean;
}

type Draft = Omit<Item, "id"> & { id?: string; dirty?: boolean };

/** Public FAQ — shown on /hoi-dap, read by Google and AI assistants (FAQ structured data, llms.txt). */
export default function Faq() {
  const [items, setItems] = useState<Draft[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const res = await apiFetch(apiUrl("/api/admin/faq"));
    if (res.ok) setItems(await res.json());
    else setErr(await readApiError(res, "Không tải được"));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const update = (i: number, patch: Partial<Draft>) =>
    setItems((list) => (list ? list.map((x, j) => (j === i ? { ...x, ...patch, dirty: true } : x)) : list));

  const save = async (i: number) => {
    const it = items![i];
    setBusy(it.id ?? `new-${i}`);
    setErr("");
    try {
      const res = await apiFetch(apiUrl(it.id ? `/api/admin/faq/${it.id}` : "/api/admin/faq"), {
        method: it.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: it.question, answer: it.answer, displayOrder: it.displayOrder, isActive: it.isActive }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "Lưu thất bại"));
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lưu thất bại");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (i: number) => {
    const it = items![i];
    if (!it.id) return setItems(items!.filter((_, j) => j !== i));
    if (!confirm(`Xóa câu hỏi "${it.question}"?`)) return;
    setBusy(it.id);
    await apiFetch(apiUrl(`/api/admin/faq/${it.id}`), { method: "DELETE" });
    setBusy(null);
    load();
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-white font-mono tracking-tight">Hỏi đáp (SEO / AI)</h1>
          <p className="text-xs text-steam-muted">
            Hiện ở moxic.co/hoi-dap, trong dữ liệu Google và file llms.txt cho ChatGPT/Gemini/Perplexity. Chỉ viết điều đúng với chính sách của shop.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setItems([...(items ?? []), { question: "", answer: "", displayOrder: (items?.length ?? 0) + 1, isActive: true, dirty: true }])}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-sm bg-steam-blue text-white text-sm font-semibold"
        >
          <Plus size={14} /> Thêm câu hỏi
        </button>
      </div>
      {err && (
        <p className="flex items-center gap-2 text-sm text-red-300">
          <AlertCircle size={14} /> {err}
        </p>
      )}
      {items == null ? (
        <Loader2 className="animate-spin text-steam-muted" />
      ) : (
        items.map((it, i) => (
          <div key={it.id ?? `new-${i}`} className={`bg-steam-surface border rounded-sm p-4 space-y-2 ${it.isActive ? "border-steam-border" : "border-steam-border opacity-60"}`}>
            <div className="flex gap-2">
              <input
                type="number"
                value={it.displayOrder}
                onChange={(e) => update(i, { displayOrder: Number(e.target.value) })}
                className="w-16 steam-input text-center"
                title="Thứ tự"
              />
              <input value={it.question} onChange={(e) => update(i, { question: e.target.value })} maxLength={300} placeholder="Câu hỏi" className="flex-1 steam-input font-semibold" />
            </div>
            <textarea value={it.answer} onChange={(e) => update(i, { answer: e.target.value })} maxLength={3000} rows={4} placeholder="Câu trả lời" className="w-full steam-input text-sm" />
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => update(i, { isActive: !it.isActive })} className="inline-flex items-center gap-1 px-2 py-1 rounded-sm border border-steam-border text-xs text-steam-text">
                {it.isActive ? <Eye size={12} /> : <EyeOff size={12} />} {it.isActive ? "Đang hiện" : "Đang ẩn"}
              </button>
              <span className="flex-1" />
              <button type="button" onClick={() => remove(i)} className="inline-flex items-center gap-1 px-2 py-1 rounded-sm border border-steam-border text-xs text-red-300">
                <Trash2 size={12} /> Xóa
              </button>
              <button
                type="button"
                disabled={!it.dirty || busy !== null}
                onClick={() => save(i)}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-sm bg-steam-blue text-white text-xs font-semibold disabled:opacity-40"
              >
                {busy === (it.id ?? `new-${i}`) ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Lưu
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
