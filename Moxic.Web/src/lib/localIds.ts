import { useSyncExternalStore } from "react";

/**
 * Tiny localStorage-backed id lists (guest wishlist, recently viewed). Only ids are stored:
 * cover URLs are short-lived presigned links, so game data is always re-fetched.
 * Every access is wrapped — storage can be unavailable (private mode, blocked site data).
 */
function createIdStore(key: string, max: number) {
  const listeners = new Set<() => void>();
  let cache: string[] | null = null;

  const read = (): string[] => {
    if (cache) return cache;
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      cache = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string").slice(0, max) : [];
    } catch {
      cache = [];
    }
    return cache;
  };

  const write = (ids: string[]) => {
    cache = ids.slice(0, max);
    try {
      localStorage.setItem(key, JSON.stringify(cache));
    } catch {
      /* ignore */
    }
    listeners.forEach((l) => l());
  };

  const subscribe = (l: () => void) => {
    listeners.add(l);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) {
        cache = null;
        l();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(l);
      window.removeEventListener("storage", onStorage);
    };
  };

  return {
    get: read,
    set: write,
    /** Move/insert id at the front. */
    push: (id: string) => write([id, ...read().filter((x) => x !== id)]),
    remove: (id: string) => write(read().filter((x) => x !== id)),
    clear: () => write([]),
    useIds: () => useSyncExternalStore(subscribe, read, () => []),
  };
}

export const guestWishlist = createIdStore("moxic.wishlist", 200);
export const recentlyViewed = createIdStore("moxic.recentlyViewed", 12);
/** Games picked for side-by-side comparison (max 3). */
export const compareList = createIdStore("moxic.compare", 3);
