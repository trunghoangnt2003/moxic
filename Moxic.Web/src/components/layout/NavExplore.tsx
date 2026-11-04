import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { CalendarDays, ChevronDown, Puzzle, Trophy } from "lucide-react";

const ITEMS = [
  { to: "/doan-game", label: "Đoán game", desc: "Mỗi ngày một câu, nhận điểm", icon: Puzzle, tone: "text-sky-300" },
  { to: "/leaderboard", label: "Xếp hạng", desc: "Đua top tháng, nhận thưởng", icon: Trophy, tone: "text-amber-300" },
  { to: "/release-calendar", label: "Sắp ra mắt", desc: "Lịch phát hành game", icon: CalendarDays, tone: "text-fuchsia-300" },
];

/** Desktop "Khám phá ▾" menu — keeps the header on one line as features grow. */
export default function NavExplore() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const active = ITEMS.some((i) => pathname.startsWith(i.to));

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`inline-flex items-center gap-1 whitespace-nowrap text-sm font-semibold transition-colors cursor-pointer ${active || open ? "text-text-primary" : "text-text-secondary hover:text-text-primary"}`}
      >
        Khám phá
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        // pt-3 bridges the gap so the menu doesn't close while moving the mouse down
        <div className="absolute left-1/2 -translate-x-1/2 top-full pt-3 z-50">
          <div role="menu" className="w-64 bg-bg-elevated border border-white/10 shadow-2xl shadow-black/60 p-1.5 animate-[popIn_0.15s_ease-out]">
            {ITEMS.map((i) => (
              <NavLink
                key={i.to}
                to={i.to}
                role="menuitem"
                className={({ isActive }) => `flex items-start gap-3 px-3 py-2.5 hover:bg-white/5 ${isActive ? "bg-white/5" : ""}`}
              >
                <i.icon className={`w-5 h-5 mt-0.5 shrink-0 ${i.tone}`} />
                <span>
                  <span className="block text-sm font-semibold text-text-primary">{i.label}</span>
                  <span className="block text-xs text-text-muted">{i.desc}</span>
                </span>
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
