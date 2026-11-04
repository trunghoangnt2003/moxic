import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { AlertCircle, ArrowDown, ArrowUp, Layers, Loader2, Plus, Star, Trash2 } from "lucide-react";
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
  saleEndsAt: string | null;
}

const TYPES = [
  { value: "Game", label: "Game" },
  { value: "GamePass", label: "Game Pass" },
  { value: "GiftCard", label: "Gift Card" },
  { value: "DLC", label: "DLC / Expansion" },
  { value: "Bundle", label: "Bundle" },
];

const toLocal = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

const REGIONS = ["Global", "US", "VN", "AR", "TR", "IN", "EU", "UK", "JP", "KR", "BR"];

const PRESETS: { name: string; includes: string }[] = [
  { name: "Standard", includes: "Game gốc" },
  { name: "Deluxe", includes: "Game gốc\nGói vật phẩm Deluxe\nSoundtrack số" },
  { name: "Ultimate", includes: "Game gốc\nSeason Pass (tất cả DLC)\nGói vật phẩm Deluxe\nChơi sớm (nếu có)" },
];

export interface CatalogEditorHandle {
  /** Client-side checks before anything is saved; returns an error message or null. */
  validate: () => string | null;
  /** Saves classification + editions for the given game (called by the main form after the game itself is saved). */
  save: (gameId: string) => Promise<{ ok: boolean; error?: string }>;
}

interface Props {
  /** Missing while creating a new game — edits are kept locally and saved right after the game is created. */
  gameId?: string | null;
  /** Live: called whenever the default edition's prices change, so the main price fields mirror them. */
  onPricesSynced: (original: number, sale: number) => void;
  /** Live: whether the game is sold by editions (then the main price fields are read-only). */
  onHasEditions?: (has: boolean) => void;
}

const EMPTY: Catalog = { productType: "Game", region: null, publisher: null, developer: null, editions: [], xboxProductId: null, priceRegion: null, saleEndsAt: null };

const GameCatalogEditor = forwardRef<CatalogEditorHandle, Props>(function GameCatalogEditor({ gameId, onPricesSynced, onHasEditions }, ref) {
  const [data, setData] = useState<Catalog | null>(gameId ? null : EMPTY);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const dataRef = useRef<Catalog | null>(data);
  dataRef.current = data;
  const syncRef = useRef({ onPricesSynced, onHasEditions });
  syncRef.current = { onPricesSynced, onHasEditions };
  const loadedFor = useRef<string | null>(null);

  // Mirror the default edition into the main price fields as the admin edits.
  useEffect(() => {
    if (!data) return;
    const active = data.editions.filter((e) => e.isActive);
    syncRef.current.onHasEditions?.(active.length > 0);
    const def = active.find((e) => e.isDefault) ?? active[0];
    if (def) syncRef.current.onPricesSynced(def.originalPrice, def.salePrice);
  }, [data]);

  useImperativeHandle(ref, () => ({
    validate: () => {
      const d = dataRef.current;
      if (!d) return null;
      const names = new Set<string>();
      for (const e of d.editions) {
        const n = e.name.trim();
        if (!n) return "Phiên bản chưa có tên.";
        if (names.has(n.toLowerCase())) return `Tên phiên bản bị trùng: ${n}`;
        names.add(n.toLowerCase());
        if (e.originalPrice < 0 || e.salePrice < 0) return "Giá không được âm.";
        if (e.originalPrice > 0 && e.salePrice > e.originalPrice) return `Giá bán của "${n}" lớn hơn giá gốc.`;
      }
      return null;
    },
    save: async (targetId: string) => {
      const d = dataRef.current;
      if (!d) return { ok: true };
      setError("");
      try {
        const res = await apiFetch(apiUrl(`/api/admin/games/${targetId}/catalog`), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...d, editions: d.editions.map((e, i) => ({ ...e, name: e.name.trim(), displayOrder: i })) }),
        });
        if (!res.ok) throw new Error(await readApiError(res, "Không lưu được phiên bản"));
        const fresh: Catalog = await res.json();
        loadedFor.current = targetId;
        setData(fresh);
        setDirty(false);
        return { ok: true };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Không lưu được phiên bản";
        setError(msg);
        return { ok: false, error: msg };
      }
    },
  }));

  useEffect(() => {
    // A brand-new game keeps its local draft; only existing games load from the server (once per id).
    if (!gameId || loadedFor.current === gameId) return;
    loadedFor.current = gameId;
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
    setDirty(true);
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
          <label className="block text-[11px] text-steam-muted mb-1">⚡ Flash sale kết thúc lúc (đếm ngược trên web)</label>
          <input
            type="datetime-local"
            value={data.saleEndsAt ? toLocal(data.saleEndsAt) : ""}
            onChange={(e) => set({ saleEndsAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
            className="w-full steam-input text-xs"
          />
          <p className="text-[10px] text-steam-muted mt-0.5">Chỉ hiện khi giá bán thấp hơn giá gốc. Hết giờ thì nhớ chỉnh lại giá.</p>
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
      <p className="text-[11px] text-steam-muted">
        {dirty ? <span className="text-steam-gold">● Có thay đổi chưa lưu — </span> : null}
        Phân loại và phiên bản được lưu cùng nút <b>{gameId ? "Update Game" : "Create Game"}</b> bên dưới.
      </p>
    </div>
  );
});

export default GameCatalogEditor;
