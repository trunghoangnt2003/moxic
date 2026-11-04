import { useCallback, useEffect, useState } from "react";

import { t } from "../lib/i18n";
/** Seconds-remaining countdown (e.g. the 60 s "Gửi lại mã" cooldown). */
export function useCountdown(initialSeconds = 0) {
  const [remaining, setRemaining] = useState(initialSeconds);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setTimeout(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);

  const start = useCallback((seconds: number) => setRemaining(seconds), []);

  return { remaining, start, active: remaining > 0 };
}

/**
 * Server-corrected "now" in ms, ticking every second. `receivedAt` should be the query's
 * dataUpdatedAt so cached data does not skew the clock offset.
 */
export function useServerNow(serverNowIso: string | null | undefined, receivedAt: number) {
  const serverMs = serverNowIso ? Date.parse(serverNowIso) : NaN;
  const offset = Number.isFinite(serverMs) && receivedAt > 0 ? serverMs - receivedAt : 0;
  const [clientNow, setClientNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setClientNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return clientNow + offset;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** "HH:MM:SS", or "{d} ngày HH:MM:SS" from 24 h. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const days = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const hms = `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
  return days > 0 ? t("{0} ngày {1}", [days, hms]) : hms;
}
