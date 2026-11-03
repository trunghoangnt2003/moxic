import { useCallback, useEffect, useState } from "react";

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
