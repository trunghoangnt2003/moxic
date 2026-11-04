import { create } from "zustand";

/**
 * React Router v7 renders route changes inside a transition, so while a lazy page chunk loads the old page
 * stays on screen and nothing happens visually. We watch history changes ourselves to know a navigation
 * started, and the layout clears it once the new location is actually rendered.
 */
interface NavPending {
  target: string | null;
  startedAt: number;
  clear: () => void;
}

export const useNavPending = create<NavPending>((set) => ({
  target: null,
  startedAt: 0,
  clear: () => set({ target: null }),
}));

let installed = false;

export function installNavPendingTracker() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const start = (url: string | URL | null | undefined) => {
    if (url == null) return;
    const next = new URL(String(url), window.location.href);
    // Only real page changes (query-string tweaks like filters are instant).
    if (next.pathname === window.location.pathname) return;
    useNavPending.setState({ target: next.pathname, startedAt: Date.now() });
  };
  const push = history.pushState.bind(history);
  const replace = history.replaceState.bind(history);
  history.pushState = (data, unused, url) => {
    start(url);
    push(data, unused, url);
  };
  history.replaceState = (data, unused, url) => {
    start(url);
    replace(data, unused, url);
  };
  // Back/forward: the URL has already changed when this fires.
  window.addEventListener("popstate", () => useNavPending.setState({ target: window.location.pathname, startedAt: Date.now() }));
}
