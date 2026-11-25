import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, X } from "lucide-react";
import { apiUrl } from "../lib/api";

interface PublishStatus {
  running: boolean;
  total: number;
  done: number;
  published: number;
  current: string | null;
  errors: string[];
}

export const PUBLISH_STARTED = "catalog-publish-started";

/**
 * Small floating card (bottom-right, on every admin screen) for the background "Đăng game" queue: progress, the game being
 * published, errors. Minimizes to a pill; disappears when dismissed after it finishes.
 */
export default function PublishWidget() {
  const [status, setStatus] = useState<PublishStatus | null>(null);
  const [polling, setPolling] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [showErrors, setShowErrors] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/admin/catalog/publish"), { credentials: "include" }); // not apiFetch: polling shouldn't light the global spinner
      if (!res.ok) return;
      const s: PublishStatus = await res.json();
      setStatus(s);
      if (s.running) setDismissed(false);
      else setPolling(false);
    } catch {
      /* offline: keep the last status */
    }
  }, []);

  useEffect(() => {
    load(); // a queue may already be running (another tab, page reload)
    const start = () => {
      setDismissed(false);
      setMinimized(false);
      setPolling(true);
    };
    window.addEventListener(PUBLISH_STARTED, start);
    return () => window.removeEventListener(PUBLISH_STARTED, start);
  }, [load]);

  useEffect(() => {
    if (!polling && !status?.running) return;
    const id = setInterval(load, 1500);
    return () => clearInterval(id);
  }, [polling, status?.running, load]);

  if (dismissed || !status || status.total === 0) return null;
  const pct = status.total ? Math.round((status.done / status.total) * 100) : 0;

  if (minimized)
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className="fixed bottom-16 right-3 z-50 inline-flex items-center gap-2 rounded-full border border-steam-border bg-steam-surface px-3 py-1.5 text-xs text-white shadow-xl md:bottom-4"
        aria-label="Mở tiến trình đăng game"
      >
        {status.running ? <Loader2 className="h-3.5 w-3.5 animate-spin text-steam-blue" /> : <CheckCircle2 className="h-3.5 w-3.5 text-steam-green" />}
        Đăng game {status.done}/{status.total}
        <ChevronUp className="h-3.5 w-3.5 text-steam-muted" />
      </button>
    );

  return (
    <div className="fixed bottom-16 right-3 z-50 w-80 rounded-sm border border-steam-border bg-steam-surface p-3 text-sm shadow-2xl md:bottom-4" role="status">
      <div className="mb-2 flex items-center gap-2">
        {status.running ? <Loader2 className="h-4 w-4 animate-spin text-steam-blue" /> : <CheckCircle2 className="h-4 w-4 text-steam-green" />}
        <p className="flex-1 font-semibold text-white">{status.running ? "Đang đăng game…" : "Đã đăng xong"}</p>
        <button type="button" onClick={() => setMinimized(true)} className="p-0.5 text-steam-muted hover:text-white" aria-label="Thu nhỏ"><ChevronDown className="h-4 w-4" /></button>
        {!status.running && (
          <button type="button" onClick={() => setDismissed(true)} className="p-0.5 text-steam-muted hover:text-white" aria-label="Đóng"><X className="h-4 w-4" /></button>
        )}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-steam-surface-3">
        <div className="h-full bg-steam-blue transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs text-steam-text">
        {status.done}/{status.total} · đã đăng <b className="text-steam-green">{status.published}</b>
        {status.errors.length > 0 && (
          <>
            {" "}· lỗi{" "}
            <button type="button" onClick={() => setShowErrors((v) => !v)} className="font-semibold text-steam-error underline">{status.errors.length}</button>
          </>
        )}
      </p>
      {status.running && status.current && <p className="mt-1 truncate text-xs text-steam-muted">Đang xử lý: {status.current}</p>}
      {showErrors && status.errors.length > 0 && (
        <ul className="mt-2 max-h-32 space-y-0.5 overflow-y-auto text-xs text-steam-error">
          {status.errors.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      )}
    </div>
  );
}
