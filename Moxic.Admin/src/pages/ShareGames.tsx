import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Search, Users } from "lucide-react";
import { apiFetch, apiUrl } from "../lib/api";
import { readApiError } from "../lib/luckySpinAdmin";

interface ShareGameRow {
  id: string;
  name: string;
  salePrice: number;
  status: string;
  allowShare: boolean;
  shareSurcharge: number;
  openRooms: number;
}

const vnd = (n: number) => n.toLocaleString("vi-VN") + "đ";

function Row({ g, onSaved }: { g: ShareGameRow; onSaved: (row: ShareGameRow) => void }) {
  const [allow, setAllow] = useState(g.allowShare);
  const [surcharge, setSurcharge] = useState(String(g.shareSurcharge));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const amount = Math.max(0, Math.round(Number(surcharge) || 0));
  const dirty = allow !== g.allowShare || amount !== g.shareSurcharge;

  const save = async (nextAllow = allow) => {
    setBusy(true);
    setMsg(null);
    const res = await apiFetch(apiUrl(`/api/admin/share/games/${g.id}`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allowShare: nextAllow, shareSurcharge: amount }),
    });
    setBusy(false);
    if (res.ok) {
      onSaved({ ...g, allowShare: nextAllow, shareSurcharge: amount });
      setMsg("Đã lưu");
    } else setMsg(await readApiError(res, "Không lưu được"));
  };

  return (
    <tr className="border-t border-steam-border">
      <td className="py-2 pr-3">
        <input
          type="checkbox"
          checked={allow}
          disabled={busy}
          aria-label={`Cho phép share ${g.name}`}
          onChange={(e) => {
            setAllow(e.target.checked);
            save(e.target.checked);
          }}
          className="rounded border-steam-border bg-steam-surface-3"
        />
      </td>
      <td className="py-2 pr-3 text-white">
        {g.name}
        {g.status === "Preorder" && <span className="ml-2 text-[10px] text-steam-gold">PRE-ORDER</span>}
      </td>
      <td className="py-2 pr-3 font-mono text-steam-text">{vnd(g.salePrice)}</td>
      <td className="py-2 pr-3">
        <input
          type="number"
          min={0}
          step={1000}
          value={surcharge}
          onChange={(e) => setSurcharge(e.target.value)}
          className="steam-input w-32 font-mono"
          aria-label={`Tiền chênh share ${g.name}`}
        />
      </td>
      <td className="py-2 pr-3 font-mono text-steam-green">{vnd(g.salePrice + amount)}</td>
      <td className="py-2 pr-3 text-steam-muted">{g.openRooms > 0 ? `${g.openRooms} phòng mở` : "—"}</td>
      <td className="py-2 text-right">
        {dirty ? (
          <button type="button" disabled={busy} onClick={() => save()} className="steam-btn bg-steam-blue text-black text-xs px-3 disabled:opacity-50">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Lưu"}
          </button>
        ) : msg ? (
          <span className="inline-flex items-center gap-1 text-xs text-steam-muted"><Check className="w-3.5 h-3.5" />{msg}</span>
        ) : null}
      </td>
    </tr>
  );
}

/**
 * "Game share": tick which games customers can buy together (share rooms) and the extra amount added to the price
 * for a share purchase. Kept apart from the game edit form on purpose.
 */
export default function ShareGames() {
  const [q, setQ] = useState("");
  const [onlyShared, setOnlyShared] = useState(false);
  const [rows, setRows] = useState<ShareGameRow[] | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (onlyShared) params.set("onlyShared", "true");
    const res = await apiFetch(apiUrl(`/api/admin/share/games?${params}`));
    setRows(res.ok ? await res.json() : []);
  }, [q, onlyShared]);

  useEffect(() => {
    const id = setTimeout(load, 250);
    return () => clearTimeout(id);
  }, [load]);

  const shared = rows?.filter((r) => r.allowShare).length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto flex items-center gap-2 text-xl font-bold text-white"><Users className="w-5 h-5 text-steam-blue" /> Game share</h1>
        <label className="flex items-center gap-2 text-sm text-steam-text">
          <input type="checkbox" checked={onlyShared} onChange={(e) => setOnlyShared(e.target.checked)} className="rounded border-steam-border bg-steam-surface-3" />
          Chỉ game đang mở share
        </label>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-steam-muted" />
          <input className="steam-input pl-8 w-60" placeholder="Tìm game" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <p className="text-sm text-steam-muted">
        Tick để khách tạo được phòng share cho game. <b className="text-steam-text">Tiền chênh</b> được cộng vào giá game khi mua chung
        (giá share = giá bán + tiền chênh), áp dụng cho phòng tạo sau khi lưu; phòng đã tạo giữ giá cũ.
        {rows && <> Đang mở share: <b className="text-steam-text">{shared}</b> game.</>}
      </p>

      {!rows ? (
        <Loader2 className="w-5 h-5 animate-spin text-steam-blue" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-steam-muted">Không có game nào.</p>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-steam-border bg-steam-surface p-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-steam-muted">
                <th className="pb-2 pr-3">Share</th>
                <th className="pb-2 pr-3">Game</th>
                <th className="pb-2 pr-3">Giá bán</th>
                <th className="pb-2 pr-3">Tiền chênh (₫)</th>
                <th className="pb-2 pr-3">Giá share</th>
                <th className="pb-2 pr-3">Phòng</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => (
                <Row key={g.id} g={g} onSaved={(row) => setRows((list) => list?.map((x) => (x.id === row.id ? row : x)) ?? null)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
