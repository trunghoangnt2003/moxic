import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CloudDownload, Download, Flame, Loader2, Search, Upload } from "lucide-react";
import { apiFetch, apiUrl } from "../lib/api";
import { readApiError } from "../lib/luckySpinAdmin";
import { PUBLISH_STARTED } from "../components/PublishWidget";

interface CrawlStatus {
  running: boolean;
  limit: number;
  pages: number;
  scanned: number;
  added: number;
  updated: number;
  skipped: number;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
}

interface PendingGame {
  id: string;
  name: string;
  xboxProductId: string | null;
  releaseDate: string | null;
  status: string;
  originalPrice: number;
  salePrice: number;
  priceMode: "Formula" | "Manual";
  popularityRank: number | null;
  posterUrl: string | null;
  publisher: string | null;
  importSource: string | null;
}

interface Formula {
  pricePercent: number;
  priceAdd: number;
  priceRoundTo: number;
}

const vnd = (n: number) => n.toLocaleString("vi-VN") + "đ";
const tabCls = (on: boolean) =>
  `px-4 py-2 text-sm border-b-2 -mb-px ${on ? "border-steam-blue text-white font-semibold" : "border-transparent text-steam-muted hover:text-white"}`;
const thumb = (url: string | null) => (url ? `${url}${url.includes("?") ? "&" : "?"}w=120` : null);

function computeFormula(original: number, f: Formula | null) {
  if (!f || f.pricePercent <= 0 || f.priceRoundTo <= 0) return 0;
  const raw = (original * f.pricePercent) / 100 + f.priceAdd;
  return raw <= 0 ? 0 : Math.ceil(raw / f.priceRoundTo) * f.priceRoundTo;
}

// ───────── Crawl ─────────
function CrawlTab() {
  const [status, setStatus] = useState<CrawlStatus | null>(null);
  const [limit, setLimit] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch(apiUrl("/api/admin/catalog/crawl"));
    if (res.ok) setStatus(await res.json());
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (!status?.running) return;
    const id = setInterval(load, 2000);
    return () => clearInterval(id);
  }, [status?.running, load]);

  const start = async () => {
    setMsg(null);
    const res = await apiFetch(apiUrl("/api/admin/catalog/crawl"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit }),
    });
    if (res.ok) setStatus(await res.json());
    else setMsg(await readApiError(res, "Không bắt đầu được"));
  };
  const stop = async () => {
    await apiFetch(apiUrl("/api/admin/catalog/crawl/stop"), { method: "POST" });
    load();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-steam-muted">
        Lấy toàn bộ game chơi được trên Xbox (Series X|S, One) từ Xbox Store Việt Nam, xếp theo độ phổ biến. Giá gốc là giá trên Store (VND).
        Game mới vào <b className="text-steam-text">Chờ duyệt</b>, khách chưa thấy. Game đã có thì bỏ qua; game đang chờ duyệt được cập nhật thứ hạng và giá gốc.
        Không lấy DLC và game miễn phí.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} disabled={status?.running} className="steam-input w-48">
          <option value={0}>Toàn bộ (~11.000 game)</option>
          <option value={2000}>2.000 game hot nhất</option>
          <option value={500}>500 game hot nhất</option>
          <option value={100}>100 game hot nhất</option>
        </select>
        {status?.running ? (
          <button type="button" onClick={stop} className="steam-btn border border-steam-accent/50 text-steam-accent text-xs">Dừng</button>
        ) : (
          <button type="button" onClick={start} className="steam-btn bg-steam-blue text-black text-xs inline-flex items-center gap-1.5">
            <CloudDownload className="w-4 h-4" /> Bắt đầu cào
          </button>
        )}
        {msg && <span className="text-sm text-steam-error">{msg}</span>}
      </div>
      {status && status.startedAt && (
        <div className="rounded-sm border border-steam-border bg-steam-surface p-4 text-sm text-steam-text space-y-1.5">
          <p className="flex items-center gap-2 font-semibold text-white">
            {status.running && <Loader2 className="w-4 h-4 animate-spin text-steam-blue" />}
            {status.running ? "Đang cào…" : status.error ? status.error : "Đã xong"}
          </p>
          <p>
            Đã quét <b>{status.scanned.toLocaleString("vi-VN")}</b>
            {status.limit > 0 ? ` / ${status.limit.toLocaleString("vi-VN")}` : ""} sản phẩm · thêm mới <b className="text-steam-green">{status.added}</b> · cập nhật{" "}
            <b>{status.updated}</b> · bỏ qua <b>{status.skipped}</b>
          </p>
          <p className="text-xs text-steam-muted">
            Bắt đầu {new Date(status.startedAt).toLocaleString("vi-VN")}
            {status.finishedAt ? ` · xong ${new Date(status.finishedAt).toLocaleString("vi-VN")}` : ""}
          </p>
        </div>
      )}
    </div>
  );
}

// ───────── Review queue ─────────
function PendingTab({ formula }: { formula: Formula | null }) {
  const [q, setQ] = useState("");
  const [hot, setHot] = useState(false);
  const [sort, setSort] = useState("popular");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: PendingGame[]; total: number; hotRank: number } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const pageSize = 50;

  const load = useCallback(async () => {
    const params = new URLSearchParams({ sort, page: String(page), pageSize: String(pageSize) });
    if (q.trim()) params.set("q", q.trim());
    if (hot) params.set("hot", "true");
    const res = await apiFetch(apiUrl(`/api/admin/catalog/pending?${params}`));
    if (res.ok) setData(await res.json());
  }, [q, hot, sort, page]);
  useEffect(() => {
    const id = setTimeout(load, 250);
    return () => clearTimeout(id);
  }, [load]);
  useEffect(() => {
    setPage(1);
  }, [q, hot, sort]);

  const items = data?.items ?? [];
  const allOnPage = items.length > 0 && items.every((g) => selected.has(g.id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const setPrice = async (g: PendingGame, body: { salePrice?: number; mode: string }) => {
    const res = await apiFetch(apiUrl(`/api/admin/catalog/pending/${g.id}/price`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) setNotice(await readApiError(res, "Không lưu được giá"));
    load();
  };

  const act = async (kind: "publish" | "delete") => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (kind === "delete" && !confirm(`Xoá ${ids.length} game khỏi hàng chờ?`)) return;
    setBusy(true);
    setNotice(null);
    const res = await apiFetch(apiUrl(`/api/admin/catalog/${kind}`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    setBusy(false);
    if (!res.ok) {
      setNotice(await readApiError(res, "Có lỗi xảy ra"));
      return;
    }
    // Gone from the queue right away; publishing continues in the background (see the widget, bottom-right).
    setData((d) => (d ? { ...d, items: d.items.filter((g) => !selected.has(g.id)), total: Math.max(0, d.total - ids.length) } : d));
    setSelected(new Set());
    if (kind === "publish") {
      window.dispatchEvent(new Event(PUBLISH_STARTED));
      setNotice(`Đang đăng ${ids.length} game ở chế độ nền. Xem tiến trình ở góc dưới bên phải.`);
    } else setNotice(`Đã xoá ${(await res.json()).deleted} game.`);
    load();
  };

  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-steam-muted" />
          <input className="steam-input pl-8 w-64" placeholder="Tên game hoặc mã Xbox" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button
          type="button"
          onClick={() => setHot((v) => !v)}
          className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs border rounded-sm ${hot ? "border-steam-gold text-steam-gold bg-steam-gold/10" : "border-steam-border text-steam-muted hover:text-white"}`}
        >
          <Flame className="w-3.5 h-3.5" /> Game hot{data ? ` (top ${data.hotRank})` : ""}
        </button>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="steam-input w-48 text-xs">
          <option value="popular">Phổ biến nhất</option>
          <option value="new">Mới phát hành</option>
          <option value="price">Giá cao nhất</option>
          <option value="added">Mới cào về</option>
        </select>
        <span className="text-xs text-steam-muted">{data ? `${data.total.toLocaleString("vi-VN")} game chờ duyệt` : ""}</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-steam-muted">Đã chọn {selected.size}</span>
          <button type="button" disabled={busy || selected.size === 0} onClick={() => act("publish")} className="steam-btn bg-steam-green text-black text-xs disabled:opacity-40">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Đăng"}
          </button>
          <button type="button" disabled={busy || selected.size === 0} onClick={() => act("delete")} className="steam-btn border border-steam-accent/50 text-steam-accent text-xs disabled:opacity-40">
            Xoá
          </button>
        </div>
      </div>
      {notice && <p className="text-sm text-steam-text bg-steam-surface border border-steam-border rounded-sm px-3 py-2">{notice}</p>}

      {!data ? (
        <Loader2 className="w-5 h-5 animate-spin text-steam-blue" />
      ) : items.length === 0 ? (
        <p className="text-sm text-steam-muted">Không có game nào. Vào tab Cào hoặc Import để thêm.</p>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-steam-border bg-steam-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-steam-muted">
                <th className="p-2">
                  <input
                    type="checkbox"
                    checked={allOnPage}
                    aria-label="Chọn cả trang"
                    onChange={() =>
                      setSelected((s) => {
                        const n = new Set(s);
                        items.forEach((g) => (allOnPage ? n.delete(g.id) : n.add(g.id)));
                        return n;
                      })
                    }
                  />
                </th>
                <th className="p-2">Game</th>
                <th className="p-2">Hạng</th>
                <th className="p-2">Phát hành</th>
                <th className="p-2">Giá gốc</th>
                <th className="p-2">Giá bán</th>
                <th className="p-2">Rẻ hơn</th>
              </tr>
            </thead>
            <tbody>
              {items.map((g) => (
                <PendingRow key={g.id} g={g} checked={selected.has(g.id)} onToggle={() => toggle(g.id)} onPrice={(b) => setPrice(g, b)} formula={formula} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center gap-2 text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="steam-btn border border-steam-border text-xs disabled:opacity-40">‹</button>
          <span className="text-steam-muted">Trang {page} / {pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="steam-btn border border-steam-border text-xs disabled:opacity-40">›</button>
        </div>
      )}
    </div>
  );
}

function PendingRow({ g, checked, onToggle, onPrice, formula }: {
  g: PendingGame;
  checked: boolean;
  onToggle: () => void;
  onPrice: (b: { salePrice?: number; mode: string }) => void;
  formula: Formula | null;
}) {
  const [price, setPrice] = useState(String(g.salePrice));
  useEffect(() => setPrice(String(g.salePrice)), [g.salePrice]);
  const cheaper = g.originalPrice > 0 && g.salePrice > 0 ? Math.round((1 - g.salePrice / g.originalPrice) * 100) : null;
  const img = thumb(g.posterUrl);
  return (
    <tr className="border-t border-steam-border">
      <td className="p-2"><input type="checkbox" checked={checked} onChange={onToggle} aria-label={`Chọn ${g.name}`} /></td>
      <td className="p-2">
        <div className="flex items-center gap-2.5">
          {img ? <img src={img} alt="" className="h-12 w-9 shrink-0 rounded-sm object-cover" loading="lazy" /> : <div className="h-12 w-9 shrink-0 rounded-sm bg-steam-surface-3" />}
          <div className="min-w-0">
            <Link to={`/games/${g.id}/edit`} className="font-semibold text-white hover:text-steam-blue line-clamp-1">{g.name}</Link>
            <p className="text-xs text-steam-muted">
              {g.publisher ?? ""}
              {g.status === "Preorder" ? " · PRE-ORDER" : ""}
              {g.importSource === "csv" ? " · CSV" : ""}
            </p>
          </div>
        </div>
      </td>
      <td className="p-2 font-mono text-steam-text">{g.popularityRank ?? "—"}</td>
      <td className="p-2 text-steam-text">{g.releaseDate ? new Date(g.releaseDate).toLocaleDateString("vi-VN") : "—"}</td>
      <td className="p-2 font-mono text-steam-text">{vnd(g.originalPrice)}</td>
      <td className="p-2">
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={0}
            step={1000}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onBlur={() => Number(price) !== g.salePrice && onPrice({ salePrice: Math.max(0, Math.round(Number(price) || 0)), mode: "Manual" })}
            className={`steam-input w-28 font-mono text-xs ${g.salePrice <= 0 ? "border-steam-error" : ""}`}
            aria-label={`Giá bán ${g.name}`}
          />
          {g.priceMode === "Manual" ? (
            <button type="button" onClick={() => onPrice({ mode: "Formula" })} title={`Theo công thức: ${vnd(computeFormula(g.originalPrice, formula))}`} className="text-[10px] text-steam-gold hover:underline">
              tự chỉnh · dùng CT
            </button>
          ) : (
            <span className="text-[10px] text-steam-muted">công thức</span>
          )}
        </div>
      </td>
      <td className="p-2 text-steam-green">{cheaper !== null ? `${cheaper}%` : "—"}</td>
    </tr>
  );
}

// ───────── CSV import ─────────
function ImportTab() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<{ row: number; status: string; message: string | null }[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    const res = await apiFetch(apiUrl("/api/admin/catalog/template"));
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "mau-import-game.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const upload = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    const res = await apiFetch(apiUrl("/api/admin/catalog/import"), { method: "POST", body: form });
    setBusy(false);
    if (res.ok) setRows(await res.json());
    else setError(await readApiError(res, "Import thất bại"));
  };
  const counts = useMemo(() => {
    const c = { added: 0, skipped: 0, error: 0 };
    rows?.forEach((r) => (c[r.status as keyof typeof c] += 1));
    return c;
  }, [rows]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-steam-muted">
        Điền file CSV theo mẫu (mở bằng Excel được). Có <code>xbox_product_id</code> thì chỉ cần mã, các thông tin còn lại tự lấy từ Xbox. Không có mã thì bắt buộc{" "}
        <code>ten_game</code> và <code>gia_goc</code>. Có <code>gia_ban</code> thì dùng giá đó, để trống thì tính theo công thức. Game import vào Chờ duyệt.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={download} className="steam-btn border border-steam-border text-xs inline-flex items-center gap-1.5"><Download className="w-4 h-4" /> Tải file mẫu</button>
        <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm text-steam-text" />
        <button type="button" disabled={!file || busy} onClick={upload} className="steam-btn bg-steam-blue text-black text-xs inline-flex items-center gap-1.5 disabled:opacity-40">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Import
        </button>
        {error && <span className="text-sm text-steam-error">{error}</span>}
      </div>
      {rows && (
        <div className="rounded-sm border border-steam-border bg-steam-surface p-3 text-sm">
          <p className="mb-2 text-white">Thêm <b className="text-steam-green">{counts.added}</b> · bỏ qua <b>{counts.skipped}</b> · lỗi <b className="text-steam-error">{counts.error}</b></p>
          <div className="max-h-72 overflow-y-auto space-y-0.5">
            {rows.map((r) => (
              <p key={r.row} className={r.status === "error" ? "text-steam-error" : r.status === "skipped" ? "text-steam-muted" : "text-steam-text"}>
                Dòng {r.row}: {r.status === "added" ? "đã thêm" : r.status === "skipped" ? "bỏ qua" : "lỗi"} {r.message ? `— ${r.message}` : ""}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ───────── Price formula ─────────
function FormulaTab({ formula, onSaved }: { formula: Formula | null; onSaved: (f: Formula) => void }) {
  const [pct, setPct] = useState(String(formula?.pricePercent ?? 70));
  const [add, setAdd] = useState(String(formula?.priceAdd ?? 0));
  const [round, setRound] = useState(String(formula?.priceRoundTo ?? 1000));
  const [includePublished, setIncludePublished] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState<"save" | "apply" | null>(null);
  const draft: Formula = { pricePercent: Number(pct) || 0, priceAdd: Number(add) || 0, priceRoundTo: Number(round) || 1000 };

  const save = async () => {
    setMsg(null);
    setSaving("save");
    const res = await apiFetch(apiUrl("/api/admin/catalog/formula"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    setSaving(null);
    if (res.ok) {
      onSaved(await res.json());
      setMsg("Đã lưu công thức. Bấm \"Áp dụng\" để tính lại giá các game theo công thức.");
    } else setMsg(await readApiError(res, "Không lưu được"));
  };
  const apply = async () => {
    const pre = await apiFetch(apiUrl(`/api/admin/catalog/formula/preview?includePublished=${includePublished}`));
    const { count } = await pre.json();
    if (!confirm(`Tính lại giá cho ${count} game đang dùng công thức${includePublished ? " (gồm cả game đã đăng)" : " trong hàng chờ"}? Game tự chỉnh giá không bị đổi.`)) return;
    setSaving("apply");
    const res = await apiFetch(apiUrl("/api/admin/catalog/formula/apply"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ includePublished }),
    });
    setSaving(null);
    const r = await res.json();
    setMsg(`Đã cập nhật giá ${r.changed} game.`);
  };

  return (
    <div className="max-w-xl space-y-4">
      <p className="text-sm text-steam-muted">Giá bán = giá gốc Xbox (VND) × hệ số % + cộng thêm, rồi làm tròn lên.</p>
      <div className="grid grid-cols-3 gap-3">
        <label className="text-xs text-steam-muted">Hệ số %<input type="number" min={1} max={500} value={pct} onChange={(e) => setPct(e.target.value)} className="steam-input mt-1 w-full font-mono" /></label>
        <label className="text-xs text-steam-muted">Cộng thêm (₫)<input type="number" step={1000} value={add} onChange={(e) => setAdd(e.target.value)} className="steam-input mt-1 w-full font-mono" /></label>
        <label className="text-xs text-steam-muted">Làm tròn lên
          <select value={round} onChange={(e) => setRound(e.target.value)} className="steam-input mt-1 w-full">
            <option value="1">Không làm tròn</option>
            <option value="1000">1.000đ</option>
            <option value="5000">5.000đ</option>
            <option value="10000">10.000đ</option>
          </select>
        </label>
      </div>
      <p className="text-sm text-steam-text">Ví dụ: giá gốc 1.499.000đ → giá bán <b className="text-steam-green">{vnd(computeFormula(1499000, draft))}</b></p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={saving !== null} className="steam-btn bg-steam-blue text-black text-xs inline-flex items-center gap-1.5 disabled:opacity-60">
          {saving === "save" && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Lưu công thức
        </button>
        <button type="button" onClick={apply} disabled={!formula || saving !== null} className="steam-btn border border-steam-border text-xs inline-flex items-center gap-1.5 disabled:opacity-40">
          {saving === "apply" && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Áp dụng công thức
        </button>
        <label className="flex items-center gap-1.5 text-xs text-steam-text">
          <input type="checkbox" checked={includePublished} onChange={(e) => setIncludePublished(e.target.checked)} /> Gồm cả game đã đăng
        </label>
      </div>
      {msg && <p className="text-sm text-steam-text">{msg}</p>}
    </div>
  );
}

/** "Kho game Xbox": crawl the Xbox Store VN catalog into a review queue, CSV import, and the selling-price formula. */
export default function XboxCatalog() {
  const [tab, setTab] = useState<"crawl" | "pending" | "import" | "formula">("pending");
  const [formula, setFormula] = useState<Formula | null>(null);
  useEffect(() => {
    apiFetch(apiUrl("/api/admin/catalog/formula")).then(async (res) => {
      if (res.ok && res.status !== 204) setFormula(await res.json());
    });
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">Kho game Xbox</h1>
      {!formula && <p className="text-sm text-steam-gold">Chưa có công thức giá: game cào về có giá bán 0 và chưa đăng được. Vào tab Công thức giá để nhập.</p>}
      <div className="flex gap-1 border-b border-steam-border">
        <button type="button" className={tabCls(tab === "pending")} onClick={() => setTab("pending")}>Chờ duyệt</button>
        <button type="button" className={tabCls(tab === "crawl")} onClick={() => setTab("crawl")}>Cào từ Xbox</button>
        <button type="button" className={tabCls(tab === "import")} onClick={() => setTab("import")}>Import file</button>
        <button type="button" className={tabCls(tab === "formula")} onClick={() => setTab("formula")}>Công thức giá</button>
      </div>
      {tab === "crawl" && <CrawlTab />}
      {tab === "pending" && <PendingTab formula={formula} />}
      {tab === "import" && <ImportTab />}
      {tab === "formula" && <FormulaTab formula={formula} onSaved={setFormula} />}
    </div>
  );
}
