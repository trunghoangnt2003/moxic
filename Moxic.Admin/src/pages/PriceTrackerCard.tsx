import { useEffect, useState } from "react";
import { LineChart, Loader2, RefreshCw } from "lucide-react";
import { apiFetch, apiUrl } from "../lib/api";
import { readApiError } from "../lib/luckySpinAdmin";

interface Status {
  xboxConfigured: boolean;
  xboxSource?: string;
  trackedGames: number;
  snapshots: number;
  lastXboxSyncAt: string | null;
  lastXboxSyncResult: string | null;
}

/** Dashboard card: price-tracker health + manual sync. */
export default function PriceTrackerCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");

  const load = async () => {
    try {
      const res = await apiFetch(apiUrl("/api/admin/price-tracker"));
      if (res.ok) setStatus(await res.json());
    } catch {
      /* ignore */
    }
  };
  useEffect(() => {
    load();
  }, []);

  const sync = async () => {
    setBusy(true);
    setResult("");
    try {
      const res = await apiFetch(apiUrl("/api/admin/price-tracker/sync"), { method: "POST" });
      if (!res.ok) throw new Error(await readApiError(res, "Không đồng bộ được"));
      const r: { moxicSnapshots: number; xboxSnapshots: number; xboxError: string | null; alertsSent: number } = await res.json();
      setResult(`Giá Moxic mới: ${r.moxicSnapshots} · Giá Xbox mới: ${r.xboxSnapshots} · Email báo giảm giá: ${r.alertsSent}${r.xboxError ? ` · Xbox: ${r.xboxError}` : ""}`);
      load();
    } catch (e) {
      setResult(e instanceof Error ? e.message : "Không đồng bộ được");
    } finally {
      setBusy(false);
    }
  };

  if (!status) return null;
  return (
    <section className="bg-steam-surface border border-steam-border rounded-sm p-3 md:p-4 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold text-steam-muted uppercase tracking-widest flex items-center gap-1.5">
          <LineChart size={13} /> Theo dõi giá
        </h2>
        <button onClick={sync} disabled={busy} className="steam-btn text-xs bg-steam-surface-3 text-steam-text border border-steam-border">
          {busy ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Đồng bộ ngay
        </button>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-steam-text">
        <span>
          Xbox Store:{" "}
          <b className="text-steam-green">{status.xboxSource ?? "Microsoft Store catalog"}</b>
        </span>
        <span>
          Game gắn Xbox ID: <b className="text-white">{status.trackedGames}</b>
        </span>
        <span>
          Điểm giá đã lưu: <b className="text-white">{status.snapshots}</b>
        </span>
        {status.lastXboxSyncAt && (
          <span className="text-steam-muted">
            Lần cuối {new Date(status.lastXboxSyncAt).toLocaleString("vi-VN")} — {status.lastXboxSyncResult}
          </span>
        )}
      </div>
      {result && <p className="text-[11px] text-steam-muted">{result}</p>}
    </section>
  );
}
