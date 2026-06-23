import type { GamesResponse, GameDetail, ActivePaymentConfig } from "../types/game";

const BASE = "/api";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(`${BASE}${url}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function getGames(params?: { page?: number; pageSize?: number; genre?: string; status?: string; search?: string; }) {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.pageSize) q.set("pageSize", String(params.pageSize));
  if (params?.genre) q.set("genre", params.genre);
  if (params?.status) q.set("status", params.status);
  if (params?.search) q.set("search", params.search);
  const qs = q.toString();
  return fetchJson<GamesResponse>(`/games${qs ? `?${qs}` : ""}`);
}

export function getGameDetail(id: string) {
  return fetchJson<GameDetail>(`/games/${id}`);
}

export function getActivePaymentConfig() {
  return fetchJson<ActivePaymentConfig>("/payment-config/active");
}

