import { create } from "zustand";

export type ThemePref = "dark" | "light" | "system";
export type Theme = "dark" | "light";

const KEY = "moxic.theme";
const META = { dark: "#0f0f11", light: "#f5f4f0" } as const;
const mq = typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: light)") : null;

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "system" || v === "dark" ? v : "dark";
  } catch {
    return "dark";
  }
}

const resolve = (p: ThemePref): Theme => (p === "system" ? (mq?.matches ? "light" : "dark") : p);

/** Applies a theme to <html> in one frame: transitions are suspended so nothing animates through a half-switched state. */
function apply(theme: Theme) {
  const root = document.documentElement;
  if (root.dataset.theme === theme) return;
  root.setAttribute("data-theme-switching", "");
  root.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", META[theme]);
  requestAnimationFrame(() => requestAnimationFrame(() => root.removeAttribute("data-theme-switching")));
}

interface ThemeState {
  pref: ThemePref;
  theme: Theme;
  setPref: (p: ThemePref) => void;
}

export const useTheme = create<ThemeState>((set) => {
  const pref = readPref();
  return {
    pref,
    theme: resolve(pref),
    setPref: (p) => {
      try {
        localStorage.setItem(KEY, p);
      } catch {
        /* storage unavailable: the choice lasts for this visit */
      }
      const theme = resolve(p);
      apply(theme);
      set({ pref: p, theme });
    },
  };
});

// Follow the OS while the preference is "system".
mq?.addEventListener("change", () => {
  const { pref } = useTheme.getState();
  if (pref !== "system") return;
  const theme = resolve(pref);
  apply(theme);
  useTheme.setState({ theme });
});

// The inline script in index.html already set data-theme before first paint; keep the store and <html> in step.
if (typeof document !== "undefined") apply(useTheme.getState().theme);
