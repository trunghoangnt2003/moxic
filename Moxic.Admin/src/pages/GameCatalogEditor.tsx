import { useEffect, useState } from "react";
import { AlertCircle, ArrowDown, ArrowUp, CheckCircle2, Layers, Loader2, Plus, Save, Star, Trash2 } from "lucide-react";
import { apiFetch, apiUrl } from "../lib/api";
import { readApiError } from "../lib/luckySpinAdmin";

interface Edition {
  id: string | null;
  name: string;
  includes: string;
  originalPrice: number;
  salePrice: number;
  isDefault: boolean;
  isActive: boolean;
  displayOrder: number;
}

interface Catalog {
  productType: string;
  region: string | null;
  publisher: string | null;
  developer: string | null;
  editions: Edition[];
  xboxProductId: string | null;
  priceRegion: string | null;
}

const TYPES = [
  { value: "Game", label: "Game" },
  { value: "GamePass", label: "Game Pass" },
  { value: "GiftCard", label: "Gift Card" },
  { value: "DLC", label: "DLC / Expansion" },
  { value: "Bundle", label: "Bundle" },
];

const REGIONS = ["Global", "US", "VN", "AR", "TR", "IN", "EU", "UK", "JP", "KR", "BR"];

const PRESETS: { name: string; includes: string }[] = [
  { name: "Standard", includes: "Game gốc" },
  { name: "Deluxe", includes: "Game gốc\nGói vật phẩm Deluxe\nSoundtrack số" },
  { name: "Ultimate", includes: "Game gốc\nSeason Pass (tất cả DLC)\nGói vật phẩm Deluxe\nChơi sớm (nếu có)" },
];

export default function GameCatalogEditor({ gameId, onPricesSynced }: { gameId: string; onPricesSynced: (original: number, sale: number) => void }) {
  const [data, setData] = useState<Catalog | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch(apiUrl(`/api/admin/games/${gameId}/catalog`));
        if (!res.ok) throw new Error(await readApiError(res, "Không tải được"));
        setData(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Không tải được");
      }
    })();
  }, [gameId]);

  if (!data) {
    return (
      <div className="bg-steam-surface border border-steam-border rounded-sm p-4 md:p-5 text-steam-muted text-xs">
        {error || <Loader2 size={14} className="animate-spin" />}
      </div>
    );
  }

  const set = (patch: Partial<Catalog>) => {
    setSaved(false);
    setData({ ...data, ...patch });
  };
  const setEdition = (i: number, patch: Partial<Edition>) =>
    set({ editions: data.editions.map((e, j) => (j === i ? { ...e, ...patch } : patch.isDefault ? { ...e, isDefault: false } : e)) });
  const move = (i: number, dir: -1 | 1) => {
    const list = [...data.editions];
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    set({ editions: list });
  };
  const addEdition = (preset?: { name: string; includes: string }) =>
    set({
      editions: [
        ...data.editions,
        {
          id: null,
          name: preset?.name ?? "",
          includes: preset?.includes ?? "",
          originalPrice: 0,
          salePrice: 0,
          isDefault: data.editions.length === 0,
          isActive: true,
          displayOrder: data.editions.length,
        },
      ],
    });

  const save = async () => {
    setError("");
    setSaving(true);
    try {
      const res = await apiFetch(apiUrl(`/api/admin/games/${gameId}/catalog`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, editions: data.editions.map((e, i) => ({ ...e, displayOrder: i })) }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "Không lưu được"));
      const fresh: Catalog = await res.json();
      setData(fresh);
      setSaved(true);
      const def = fresh.editions.find((e) => e.isDefault && e.isActive);
      if (def) onPricesSynced(def.originalPrice, def.salePrice);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được");
    } finally {
      setSaving(false);
    }
  };

  const unused = PRESETS.filter((p) => !data.editions.some((e) => e.name.trim().toLowerCase() === p.name.toLowerCase()));

  return (
    <div className="bg-steam-surface border border-steam-border rounded-sm p-4 md:p-5 space-y-4">
      <h2 className="text-xs font-semibold text-steam-muted uppercase tracking-widest flex items-center gap-2">
        <Layers size={14} /> Phân loại & phiên bản
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] text-steam-muted mb-1">Loại sản phẩm</label>
          <select value={data.productType} onChange={(e) => set({ productType: e.target.value })} className="w-full steam-input text-xs">
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-steam-muted mb-1">Region</label>
          <input list="moxic-regions" value={data.region ?? ""} onChange={(e) => set({ region: e.target.value })} placeholder="Global, US, AR…" className="w-full steam-input text-xs" />
          <datalist id="moxic-regions">
            {REGIONS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="block text-[11px] text-steam-muted mb-1">Nhà phát hành</label>
          <input value={data.publisher ?? ""} onChange={(e) => set({ publisher: e.target.value })} placeholder="VD: Rockstar Games" className="w-full steam-input text-xs" />
        </div>
        <div>
          <label className="block text-[11px] text-steam-muted mb-1">Nhà phát triển</label>
          <input value={data.developer ?? ""} onChange={(e) => set({ developer: e.target.value })} placeholder="VD: Rockstar North" className="w-full steam-input text-xs" />
        </div>
        <div>
          <label className="block text-[11px] text-steam-muted mb-1">Xbox Store product ID (theo dõi giá)</label>
          <input value={data.xboxProductId ?? ""} onChange={(e) => set({ xboxProductId: e.target.value })} placeholder="VD: 9NBLGGH4R2R6" className="w-full steam-input text-xs font-mono uppercase" />
          <p className="text-[10px] text-steam-muted mt-0.5">Lấy từ link xbox.com/…/store/…/<b>9XXXXXXXXXXX</b></p>
        </div>
        <div>
          <label className="block text-[11px] text-steam-muted mb-1">Region lấy giá Store</label>
          <input value={data.priceRegion ?? ""} onChange={(e) => set({ priceRegion: e.target.value })} placeholder="us" maxLength={5} className="w-full steam-input text-xs font-mono lowercase" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-steam-muted">
            Phiên bản (Standard/Deluxe/Ultimate…). Có phiên bản thì giá game = giá bản mặc định. Không có thì bán theo giá ở trên.
          </p>
          <div className="flex flex-wrap gap-1">
            {unused.map((p) => (
              <button key={p.name} type="button" onClick={() => addEdition(p)} className="steam-btn bg-steam-surface-3 text-steam-muted hover:text-steam-text border border-steam-border text-[11px] px-2 py-1">
                <Plus size={11} /> {p.name}
              </button>
            ))}
            <button type="button" onClick={() => addEdition()} className="steam-btn bg-steam-surface-3 text-steam-muted hover:text-steam-text border border-steam-border text-[11px] px-2 py-1">
              <Plus size={11} /> Khác
            </button>
          </div>
        </div>

        {data.editions.map((e, i) => (
          <div key={e.id ?? `new-${i}`} className={`border rounded-sm p-3 space-y-2 ${e.isDefault ? "border-steam-gold/40 bg-steam-gold/5" : "border-steam-border bg-steam-surface-3"}`}>
            <div className="flex items-center gap-2">
              <input value={e.name} onChange={(ev) => setEdition(i, { name: ev.target.value })} placeholder="Tên phiên bản" maxLength={60} className="flex-1 steam-input text-xs font-semibold" />
              <button type="button" title="Đặt làm mặc định" onClick={() => setEdition(i, { isDefault: true })} className={`p-1.5 rounded ${e.isDefault ? "text-steam-gold" : "text-steam-muted hover:text-steam-gold"}`}>
                <Star size={13} fill={e.isDefault ? "currentColor" : "none"} />
              </button>
              <button type="button" title="Lên" onClick={() => move(i, -1)} className="p-1.5 rounded text-steam-muted hover:text-steam-text">
                <ArrowUp size={13} />
              </button>
              <button type="button" title="Xuống" onClick={() => move(i, 1)} className="p-1.5 rounded text-steam-muted hover:text-steam-text">
                <ArrowDown size={13} />
              </button>
              <button type="button" title="Xóa" onClick={() => set({ editions: data.editions.filter((_, j) => j !== i) })} className="p-1.5 rounded text-steam-muted hover:text-steam-accent">
                <Trash2 size={13} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-steam-muted mb-0.5">Giá gốc (Store)</label>
                <input type="number" min={0} value={e.originalPrice} onChange={(ev) => setEdition(i, { originalPrice: Number(ev.target.value) })} className="w-full steam-input text-xs font-mono" />
              </div>
              <div>
                <label className="block text-[10px] text-steam-muted mb-0.5">Giá bán</label>
                <input type="number" min={0} value={e.salePrice} onChange={(ev) => setEdition(i, { salePrice: Number(ev.target.value) })} className="w-full steam-input text-xs font-mono" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] text-steam-muted mb-0.5">Bao gồm (mỗi dòng một mục — dùng cho bảng so sánh)</label>
              <textarea rows={3} value={e.includes} onChange={(ev) => setEdition(i, { includes: ev.target.value })} className="w-full steam-input text-xs resize-y" />
            </div>
            <label className="inline-flex items-center gap-1.5 text-[11px] text-steam-muted">
              <input type="checkbox" checked={e.isActive} onChange={(ev) => setEdition(i, { isActive: ev.target.checked })} /> Đang bán
            </label>
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-1.5 px-3 py-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          <AlertCircle size={12} /> {error}
        </div>
      )}
      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={saving} className="steam-btn bg-steam-blue text-black hover:bg-steam-blue-hover text-xs">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Lưu phân loại & phiên bản
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-xs text-steam-green">
            <CheckCircle2 size={12} /> Đã lưu
          </span>
        )}
      </div>
    </div>
  );
}
