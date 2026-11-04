/** Small, dependency-free UI effects: confetti, haptics, fly-to-cart. All respect prefers-reduced-motion. */

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Light haptic tick on supporting phones (Android; iOS Safari ignores it). */
export function haptic(pattern: number | number[] = 12) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}

const COLORS = ["#c9a96e", "#e5d3b3", "#f43f5e", "#38bdf8", "#a3e635", "#f59e0b", "#a855f7"];

/** Full-screen confetti burst (canvas, ~2.5s). */
export function confetti(opts: { particles?: number; origin?: { x: number; y: number } } = {}) {
  if (reduced() || typeof document === "undefined") return;
  const canvas = document.createElement("canvas");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100vw", height: "100vh", pointerEvents: "none", zIndex: "100" });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas.remove();
  ctx.scale(dpr, dpr);

  const ox = (opts.origin?.x ?? 0.5) * window.innerWidth;
  const oy = (opts.origin?.y ?? 0.35) * window.innerHeight;
  const n = opts.particles ?? (window.innerWidth < 640 ? 110 : 170);
  const parts = Array.from({ length: n }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 6 + Math.random() * 10;
    return {
      x: ox,
      y: oy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 6,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 10,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      color: COLORS[(Math.random() * COLORS.length) | 0],
    };
  });

  const start = performance.now();
  const frame = (t: number) => {
    const elapsed = t - start;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (const p of parts) {
      p.vx *= 0.985;
      p.vy = p.vy * 0.985 + 0.35;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - elapsed / 2600);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.rot * 2)));
      ctx.restore();
    }
    if (elapsed < 2600) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}

/** Animates a copy of `source` (usually the game cover) into the navbar cart icon, then bumps the icon. */
export function flyToCart(source: Element | null | undefined) {
  const target = document.getElementById("nav-cart-button");
  if (!target) return;
  const bump = () => target.animate([{ transform: "scale(1)" }, { transform: "scale(1.3)" }, { transform: "scale(1)" }], { duration: 380, easing: "ease-out" });
  if (!source || reduced()) return void bump();

  const from = source.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  if (from.width === 0) return void bump();
  const ghost = (source.tagName === "IMG" ? source.cloneNode(true) : document.createElement("div")) as HTMLElement;
  const size = Math.min(from.width, from.height, 140);
  Object.assign(ghost.style, {
    position: "fixed",
    left: `${from.left + from.width / 2 - size / 2}px`,
    top: `${from.top + from.height / 2 - size / 2}px`,
    width: `${size}px`,
    height: `${size}px`,
    objectFit: "cover",
    borderRadius: "12px",
    zIndex: "100",
    pointerEvents: "none",
    boxShadow: "0 10px 30px rgba(0,0,0,.5)",
    background: "#c9a96e",
  });
  document.body.appendChild(ghost);
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const anim = ghost.animate(
    [
      { transform: "translate(0,0) scale(1)", opacity: 1 },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 60}px) scale(0.6)`, opacity: 0.9, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.12)`, opacity: 0.4 },
    ],
    { duration: 700, easing: "cubic-bezier(.5,0,.75,0)" },
  );
  anim.onfinish = () => {
    ghost.remove();
    bump();
  };
}
