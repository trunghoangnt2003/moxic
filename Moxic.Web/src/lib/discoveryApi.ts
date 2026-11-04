import axios from "axios";
import type { GameListItem } from "../types/game";

// withCredentials so "Dành cho bạn" can use the customer's wishlist/purchases.
const API_URL = import.meta.env.VITE_API_URL || "/api";
const api = axios.create({ baseURL: API_URL, withCredentials: true });

export async function getSimilar(gameId: string) {
  const { data } = await api.get<GameListItem[]>(`/games/${gameId}/similar`, { params: { limit: 10 } });
  return data;
}

export async function getAlsoBought(gameId: string) {
  const { data } = await api.get<GameListItem[]>(`/games/${gameId}/also-bought`, { params: { limit: 10 } });
  return data;
}

export async function getForYou(seedIds: string[]) {
  const { data } = await api.get<{ personalised: boolean; items: GameListItem[] }>("/recommendations", {
    params: { seed: seedIds.join(","), limit: 12 },
  });
  return data;
}

export async function getReleaseCalendar() {
  const { data } = await api.get<GameListItem[]>("/games/release-calendar");
  return data;
}
