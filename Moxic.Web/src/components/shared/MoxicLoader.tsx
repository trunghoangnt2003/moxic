import { useId } from "react";

type LoaderSize = "sm" | "md" | "lg";

interface MoxicLoaderProps {
  size?: LoaderSize;
  label?: string;
  className?: string;
}

const SIZE_PX: Record<Exclude<LoaderSize, "sm">, number> = { md: 72, lg: 128 };

// Circle of radius 38 centred in a 100x100 viewBox (circumference ≈ 238.76).
const ORBIT_RADIUS = 38;
const ORBIT_CIRCUMFERENCE = 2 * Math.PI * ORBIT_RADIUS;
const ORBIT_PATH = `M 50 50 m -${ORBIT_RADIUS} 0 a ${ORBIT_RADIUS} ${ORBIT_RADIUS} 0 1 1 ${ORBIT_RADIUS * 2} 0 a ${ORBIT_RADIUS} ${ORBIT_RADIUS} 0 1 1 -${ORBIT_RADIUS * 2} 0`;

// Five dots (one per M-O-X-I-C letter), 72° apart, for the tiny button variant.
// They use currentColor so they stay legible on gold (dark text) and purple (white text) buttons.
const DOTS = Array.from({ length: 5 }, (_, i) => {
  const angle = (i * 72 * Math.PI) / 180;
  return { cx: 10 + 7 * Math.sin(angle), cy: 10 - 7 * Math.cos(angle), opacity: 1 - i * 0.16 };
});

/**
 * Branded MOXIC loader: the word MOXIC on a rotating circular path with a gold glow,
 * a counter-rotating dashed purple ring and a pulsing gold core.
 * `sm` (18px) is a dot-only inline variant for buttons.
 */
export function MoxicLoader({ size = "md", label, className = "" }: MoxicLoaderProps) {
  const rawId = useId();
  // React 19 ids contain characters (« » :) that break url(#…) / href="#…" fragments.
  const pathId = `moxic-orbit-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  if (size === "sm") {
    return (
      <svg
        viewBox="0 0 20 20"
        width={18}
        height={18}
        aria-hidden="true"
        className={`inline-block shrink-0 animate-moxic-orbit motion-reduce:animate-none ${className}`}
      >
        {DOTS.map((d, i) => (
          <circle key={i} cx={d.cx} cy={d.cy} r={2} fill="currentColor" opacity={d.opacity} />
        ))}
      </svg>
    );
  }

  const px = SIZE_PX[size];

  return (
    <div role="status" aria-live="polite" className={`flex flex-col items-center gap-3 ${className}`}>
      <div className="relative" style={{ width: px, height: px }}>
        {/* (1) MOXIC letters orbiting on a circle */}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full animate-moxic-orbit motion-reduce:animate-none drop-shadow-[0_0_6px_rgba(229,211,179,0.6)]"
          aria-hidden="true"
        >
          <defs>
            <path id={pathId} d={ORBIT_PATH} fill="none" />
          </defs>
          <text
            fill="#e5d3b3"
            fontSize={11}
            fontWeight="bold"
            className="font-display"
            style={{ whiteSpace: "pre" }}
          >
            <textPath href={`#${pathId}`} textLength={ORBIT_CIRCUMFERENCE} lengthAdjust="spacing">
              {"MOXIC • MOXIC • "}
            </textPath>
          </text>
        </svg>

        {/* (2) Counter-rotating dashed purple ring */}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full animate-moxic-orbit-reverse motion-reduce:animate-none drop-shadow-[0_0_6px_rgba(168,85,247,0.7)]"
          aria-hidden="true"
        >
          <circle cx={50} cy={50} r={26} fill="none" stroke="#a855f7" strokeWidth={2} strokeDasharray="4 6" opacity={0.8} />
        </svg>

        {/* (3) Pulsing gold core */}
        <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <div
            className="h-1/4 w-1/4 rounded-full animate-moxic-pulse motion-reduce:animate-none"
            style={{ background: "radial-gradient(circle, rgba(229,211,179,0.95) 0%, rgba(201,169,110,0.45) 45%, transparent 70%)" }}
          />
        </div>
      </div>

      {label ? (
        <p className="font-display text-xs sm:text-sm uppercase tracking-[0.3em] text-text-muted">{label}</p>
      ) : (
        <>
          <span className="sr-only">Đang tải...</span>
          {/* Under reduced motion the ring is static, so show the text visibly too. */}
          <span aria-hidden="true" className="hidden motion-reduce:block font-display text-xs uppercase tracking-[0.3em] text-text-muted">
            Đang tải...
          </span>
        </>
      )}
    </div>
  );
}

/** Full-page loader (lazy routes, page-level queries). */
export function PageLoader({ label = "Đang tải..." }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <MoxicLoader size="lg" label={label} />
    </div>
  );
}

/** Section-level loader (grids, panels). */
export function SectionLoader({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[280px] items-center justify-center">
      <MoxicLoader size="md" label={label} />
    </div>
  );
}
