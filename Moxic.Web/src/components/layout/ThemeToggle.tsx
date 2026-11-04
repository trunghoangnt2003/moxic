import { useEffect, useRef, useState } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemePref } from "../../lib/theme";

const OPTIONS: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: "dark", label: "Tối", icon: Moon },
  { value: "light", label: "Sáng", icon: Sun },
  { value: "system", label: "Theo hệ thống", icon: Monitor },
];

/** Navbar icon button: shows the mode in effect, opens a three-way menu (Tối, Sáng, Theo hệ thống). */
export function ThemeMenuButton() {
  const { pref, theme, setPref } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const Icon = theme === "light" ? Sun : Moon;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Giao diện: ${theme === "light" ? "sáng" : "tối"}`}
        className="w-9 h-9 flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
      >
        <Icon className="w-5 h-5" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full mt-2 w-48 py-1 bg-bg-surface border border-border shadow-xl shadow-black/20 z-50">
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="menuitemradio"
              aria-checked={pref === o.value}
              onClick={() => {
                setPref(o.value);
                setOpen(false);
              }}
              className={`w-full h-10 px-3 flex items-center gap-3 text-sm transition-colors cursor-pointer ${
                pref === o.value ? "text-accent" : "text-text-secondary hover:text-text-primary hover:bg-bg-surface-hover"
              }`}
            >
              <o.icon className="w-4 h-4" />
              <span className="flex-1 text-left">{o.label}</span>
              {pref === o.value && <Check className="w-4 h-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Mobile menu: the three modes as one segmented control. */
export function ThemeSegmented() {
  const { pref, setPref } = useTheme();
  return (
    <div>
      <p className="text-sm text-text-muted mb-2">Giao diện</p>
      <div role="radiogroup" aria-label="Giao diện" className="grid grid-cols-3 border border-border">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={pref === o.value}
            onClick={() => setPref(o.value)}
            className={`h-11 inline-flex items-center justify-center gap-1.5 text-sm transition-colors cursor-pointer ${
              pref === o.value ? "bg-accent/15 text-accent font-semibold" : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <o.icon className="w-4 h-4" />
            {o.value === "system" ? "Tự động" : o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
