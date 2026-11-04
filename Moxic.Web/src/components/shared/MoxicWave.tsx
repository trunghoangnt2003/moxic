import { useId } from "react";

import { t } from "../../lib/i18n";
/**
 * "MOXIC sóng sánh": the MOXIC wordmark filled with sloshing liquid gold, two offset waves
 * scrolling sideways while the liquid level bobs up and down.
 */
export default function MoxicWave({ width = 220, label }: { width?: number; label?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const clip = `mw-clip-${id}`;
  const grad = `mw-grad-${id}`;
  // One wave period = 150 units; the path spans 600 so a -150 shift loops seamlessly.
  const wave = (y: number, amp: number) => {
    let d = `M0 ${y}`;
    for (let x = 0; x < 600; x += 75) d += ` Q ${x + 37.5} ${x % 150 === 0 ? y - amp : y + amp} ${x + 75} ${y}`;
    return `${d} V 100 H 0 Z`;
  };

  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 300 90" width={width} height={(width * 90) / 300} aria-hidden="true" className="overflow-visible drop-shadow-[0_0_18px_color-mix(in_oklab,var(--color-accent)_35%,transparent)]">
        <defs>
          <clipPath id={clip}>
            <text x="150" y="72" textAnchor="middle" fontSize="78" fontWeight="900" letterSpacing="2" className="font-display">
              MOXIC
            </text>
          </clipPath>
          <linearGradient id={grad} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f5e6c4" />
            <stop offset="55%" stopColor="#c9a96e" />
            <stop offset="100%" stopColor="#8f7340" />
          </linearGradient>
        </defs>

        {/* Empty glass: faint outline of the letters */}
        <text x="150" y="72" textAnchor="middle" fontSize="78" fontWeight="900" letterSpacing="2" className="font-display" strokeWidth="1.2" style={{ fill: "color-mix(in oklab, var(--color-accent) 7%, transparent)", stroke: "color-mix(in oklab, var(--color-accent) 40%, transparent)" }}>
          MOXIC
        </text>

        {/* Liquid, clipped to the letters */}
        <g clipPath={`url(#${clip})`}>
          <g className="moxic-wave-bob">
            <path d={wave(48, 9)} fill="#a855f7" opacity="0.45" className="moxic-wave-back" />
            <path d={wave(46, 8)} fill={`url(#${grad})`} className="moxic-wave-front" />
          </g>
        </g>
      </svg>
      {label && <p className="font-display text-[11px] text-text-muted">{label}</p>}
      <span className="sr-only">{t("Đang tải…")}</span>
    </div>
  );
}
