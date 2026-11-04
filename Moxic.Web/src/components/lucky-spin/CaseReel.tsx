import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { flushSync } from "react-dom";
import type { PublicPrize } from "../../lib/luckySpinApi";
import PrizeCard from "./PrizeCard";

/** What the reel needs from the server result (OpenCaseResult satisfies it). */
export interface ReelSpin {
  reel: PublicPrize[];
  winningIndex: number;
  /** Server-chosen landing point: fraction of a card width from the winning card centre. */
  stopOffset: number;
}

export interface CaseReelHandle {
  /** Animate the reel to the server-decided result. Resolves once the reel has stopped. */
  spin: (result: ReelSpin) => Promise<void>;
}

interface CaseReelProps {
  idleItems: PublicPrize[];
  ref?: Ref<CaseReelHandle>;
}

// Fast start, long dramatic deceleration.
// Total spin time is exactly 10s: very fast start (~7x average speed), then a steady,
// dramatic deceleration to a smooth stop (zero velocity at the end).
const SPIN_DURATION_MS = 10000;
const REDUCED_MOTION_DURATION_MS = 1200;
const SPIN_EASING = "cubic-bezier(0.08, 0.6, 0.1, 1)";
const MAX_STOP_OFFSET = 0.48;
const IDLE_COUNT = 20;
const IMAGE_PRELOAD_CAP_MS = 1500;

const CHAMFER = 20;
const chamferPolygon = (c: number) =>
  `polygon(${c}px 0, calc(100% - ${c}px) 0, 100% ${c}px, 100% calc(100% - ${c}px), calc(100% - ${c}px) 100%, ${c}px 100%, 0 calc(100% - ${c}px), 0 ${c}px)`;

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

function preloadImages(urls: string[]): Promise<void> {
  if (urls.length === 0) return Promise.resolve();
  const loads = urls.map(
    (url) =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = url;
      })
  );
  const cap = new Promise<void>((resolve) => window.setTimeout(resolve, IMAGE_PRELOAD_CAP_MS));
  return Promise.race([Promise.all(loads).then(() => undefined), cap]);
}

function buildIdle(items: PublicPrize[]): PublicPrize[] {
  if (items.length === 0) return [];
  return Array.from({ length: IDLE_COUNT }, (_, i) => items[i % items.length]);
}

export default function CaseReel({ idleItems, ref }: CaseReelProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<Animation | null>(null);
  const animatingRef = useRef(false);
  const landedRef = useRef<{ index: number; offsetFraction: number } | null>(null);

  const [items, setItems] = useState<PublicPrize[]>(() => buildIdle(idleItems));
  const [hasSpun, setHasSpun] = useState(false);
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);

  // Idle state follows the prize list until the first spin.
  useEffect(() => {
    if (!hasSpun) setItems(buildIdle(idleItems));
  }, [idleItems, hasSpun]);

  /** Translate X that puts card `index` (shifted by offsetFraction of a card) under the center marker. */
  const computeTargetX = useCallback((index: number, offsetFraction: number): number | null => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track || track.children.length < 2) return null;
    const cards = track.children as HTMLCollectionOf<HTMLElement>;
    const first = cards[0];
    const stride = cards[1].offsetLeft - first.offsetLeft;
    const cardWidth = first.offsetWidth;
    const viewportWidth = viewport.clientWidth;
    const offset = offsetFraction * cardWidth;
    return viewportWidth / 2 - (first.offsetLeft + index * stride + cardWidth / 2 + offset);
  }, []);

  // Keep the landed position correct when the layout changes (rotation, resize, md breakpoint).
  useEffect(() => {
    const onResize = () => {
      const landed = landedRef.current;
      const track = trackRef.current;
      if (!landed || !track || animatingRef.current) return;
      const x = computeTargetX(landed.index, landed.offsetFraction);
      if (x != null) track.style.transform = `translate3d(${x}px, 0, 0)`;
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [computeTargetX]);

  // Cancel any running animation on unmount.
  useEffect(() => () => animationRef.current?.cancel(), []);

  useImperativeHandle(
    ref,
    () => ({
      spin: async (result: ReelSpin) => {
        const track = trackRef.current;
        if (!track) return;

        animatingRef.current = true;
        landedRef.current = null;
        animationRef.current?.cancel();
        animationRef.current = null;

        try {
          // Reset instantly, then swap in the server reel synchronously.
          track.style.transform = "translate3d(0, 0, 0)";
          flushSync(() => {
            setWinnerIndex(null);
            setHasSpun(true);
            setItems(result.reel);
          });

          // Wait for layout, then make sure cover images are ready (capped).
          await nextFrame();
          await nextFrame();
          const urls = Array.from(
            new Set(result.reel.map((p) => p.imageUrl).filter((u): u is string => !!u))
          );
          await preloadImages(urls);

          // Landing point inside the winning card comes from the server (near-miss teasing);
          // the client never invents it.
          const raw = Number.isFinite(result.stopOffset) ? result.stopOffset : 0;
          const offsetFraction = Math.max(-MAX_STOP_OFFSET, Math.min(MAX_STOP_OFFSET, raw));
          const targetX = computeTargetX(result.winningIndex, offsetFraction);
          if (targetX == null) return;

          const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          const duration = reduceMotion ? REDUCED_MOTION_DURATION_MS : SPIN_DURATION_MS;
          const finalTransform = `translate3d(${targetX}px, 0, 0)`;

          // Web Animations API (not a CSS transition): index.css forces transition-duration 0s
          // under prefers-reduced-motion, which would make transitionend never fire.
          track.style.willChange = "transform";
          const animation = track.animate(
            [{ transform: "translate3d(0, 0, 0)" }, { transform: finalTransform }],
            { duration, easing: SPIN_EASING, fill: "forwards" }
          );
          animationRef.current = animation;

          try {
            await animation.finished;
          } catch {
            // Cancelled (unmount / new spin), leave state as is.
            return;
          }

          track.style.transform = finalTransform;
          animation.cancel();
          animationRef.current = null;
          landedRef.current = { index: result.winningIndex, offsetFraction };
          setWinnerIndex(result.winningIndex);
        } finally {
          track.style.willChange = "auto";
          animatingRef.current = false;
        }
      },
    }),
    [computeTargetX]
  );

  return (
    <div className="relative" style={{ filter: "drop-shadow(0 0 22px rgba(168, 85, 247, 0.35))" }}>
      {/* 1px gradient frame (outer clipped layer) */}
      <div
        className="absolute inset-0"
        style={{
          clipPath: chamferPolygon(CHAMFER),
          background: "linear-gradient(135deg, var(--color-spin-glow) 0%, var(--color-spin-pink) 50%, var(--color-spin-glow) 100%)",
        }}
      />
      {/* Panel (inner clipped layer, inset 1px) */}
      <div
        className="relative m-px py-5 md:py-7"
        style={{
          clipPath: chamferPolygon(CHAMFER - 1),
          background: "radial-gradient(ellipse at center, var(--color-spin-panel) 0%, var(--color-spin-ink) 55%, var(--color-spin-void) 100%)",
        }}
      >
        {/* Subtle top/bottom rails */}
        <div className="pointer-events-none absolute inset-x-8 top-3 h-px bg-gradient-to-r from-transparent via-highlight/40 to-transparent md:top-4" />
        <div className="pointer-events-none absolute inset-x-8 bottom-3 h-px bg-gradient-to-r from-transparent via-highlight/40 to-transparent md:bottom-4" />

        <div className="relative">
          {/* Reel viewport with horizontal edge fade */}
          <div
            ref={viewportRef}
            className="relative overflow-hidden py-3"
            style={{
              maskImage: "linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)",
            }}
          >
            <div ref={trackRef} className="flex w-max gap-2 md:gap-3" style={{ transform: "translate3d(0, 0, 0)" }}>
              {items.length > 0
                ? items.map((prize, i) => (
                    <PrizeCard key={`${i}-${prize.id}`} prize={prize} size="reel" highlighted={winnerIndex === i} />
                  ))
                : Array.from({ length: IDLE_COUNT }, (_, i) => (
                    <div
                      key={i}
                      className="w-[104px] h-[124px] md:w-[160px] md:h-[176px] flex-shrink-0 rounded-[3px] bg-white/[0.03] ring-1 ring-inset ring-white/5"
                    />
                  ))}
            </div>
          </div>

          {/* Center marker: pink line + triangles, above the cards */}
          <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 -translate-x-1/2">
            <div
              className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-highlight"
              style={{ boxShadow: "0 0 8px var(--color-spin-pink), 0 0 16px color-mix(in oklab, var(--color-spin-pink) 60%, transparent)" }}
            />
            <div
              className="absolute left-1/2 top-0 h-0 w-0 -translate-x-1/2"
              style={{
                borderLeft: "10px solid transparent",
                borderRight: "10px solid transparent",
                borderTop: "13px solid var(--color-spin-pink)",
                filter: "drop-shadow(0 0 6px var(--color-spin-pink))",
              }}
            />
            <div
              className="absolute bottom-0 left-1/2 h-0 w-0 -translate-x-1/2"
              style={{
                borderLeft: "10px solid transparent",
                borderRight: "10px solid transparent",
                borderBottom: "13px solid var(--color-spin-pink)",
                filter: "drop-shadow(0 0 6px var(--color-spin-pink))",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
