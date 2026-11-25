const API_BASE = import.meta.env.VITE_API_URL || "";

export function apiUrl(path: string): string {
  return API_BASE ? `${API_BASE}${path}` : path;
}

// Requests in flight, shown by <GlobalActivity /> so every screen shows that work is being done.
let inFlight = 0;
const listeners = new Set<(n: number) => void>();
const emit = () => listeners.forEach((l) => l(inFlight));

export function onApiActivity(listener: (n: number) => void): () => void {
  listeners.add(listener);
  listener(inFlight);
  return () => {
    listeners.delete(listener);
  };
}

export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  inFlight++;
  emit();
  const done = () => {
    inFlight = Math.max(0, inFlight - 1);
    emit();
  };
  return fetch(input, {
    ...init,
    credentials: "include",
  }).then(
    (res) => {
      done();
      if (res.status === 401 && !window.location.pathname.includes("/login")) {
        localStorage.removeItem("admin_user");
        window.location.href = "/";
        return new Promise<Response>(() => {});
      }
      return res;
    },
    (err) => {
      done();
      throw err;
    },
  );
}
