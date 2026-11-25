import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { onApiActivity } from "../lib/api";

/**
 * Shows that the admin is talking to the server: a running bar across the top and a small "Đang xử lý…" badge while any
 * request is in flight. Appears after 250ms so quick requests don't flicker.
 */
export default function GlobalActivity() {
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = onApiActivity((n) => {
      clearTimeout(timer);
      if (n > 0) timer = setTimeout(() => setBusy(true), 250);
      else setBusy(false);
    });
    return () => {
      clearTimeout(timer);
      off();
    };
  }, []);
  if (!busy) return null;
  return (
    <>
      <div className="fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden bg-steam-blue/20" role="progressbar" aria-label="Đang xử lý">
        <div className="h-full w-1/3 animate-[activity_1.1s_ease-in-out_infinite] bg-steam-blue" />
      </div>
      <div className="fixed right-3 top-3 z-[60] inline-flex items-center gap-1.5 rounded-sm border border-steam-border bg-steam-surface/95 px-2.5 py-1 text-xs text-steam-text shadow-lg" aria-live="polite">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-steam-blue" /> Đang xử lý…
      </div>
    </>
  );
}
