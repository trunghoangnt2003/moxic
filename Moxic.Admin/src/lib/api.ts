const API_BASE = import.meta.env.VITE_API_URL || "";

export function apiUrl(path: string): string {
  return API_BASE ? `${API_BASE}${path}` : path;
}

export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  return fetch(input, {
    ...init,
    credentials: "include",
  }).then((res) => {
    if (res.status === 401 && !window.location.pathname.includes("/login")) {
      localStorage.removeItem("admin_user");
      window.location.href = "/";
      return new Promise<Response>(() => {});
    }
    return res;
  });
}
