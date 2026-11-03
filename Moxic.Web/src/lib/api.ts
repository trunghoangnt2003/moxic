import axios from "axios";
import type { GamesResponse, GameFacets, GameDetail, GameReview, ActivePaymentConfig, OrderCreateRequest, OrderCreateResponse, OrderConfirmationData } from "../types/game";

const API_URL = import.meta.env.VITE_API_URL || "/api";
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

export interface GameQuery {
  q?: string;
  status?: string;
  genres?: string[];
  tags?: string[];
  minPrice?: number;
  maxPrice?: number;
  onSale?: boolean;
  sort?: string;
  page?: number;
  pageSize?: number;
}

export async function getGames(query: GameQuery = {}) {
  const params: Record<string, string | number | boolean> = {};
  if (query.q) params.q = query.q;
  if (query.status) params.status = query.status;
  if (query.genres?.length) params.genres = query.genres.join(",");
  if (query.tags?.length) params.tags = query.tags.join(",");
  if (query.minPrice != null) params.minPrice = query.minPrice;
  if (query.maxPrice != null) params.maxPrice = query.maxPrice;
  if (query.onSale) params.onSale = true;
  if (query.sort) params.sort = query.sort;
  params.page = query.page ?? 1;
  params.pageSize = query.pageSize ?? 20;
  const { data } = await api.get<GamesResponse>("/games", { params });
  return data;
}

export async function getGameFacets() {
  const { data } = await api.get<GameFacets>("/games/facets");
  return data;
}

export async function getFeaturedGames(limit: number = 5) {
  const { data } = await api.get<GamesResponse["items"]>("/games/featured", { params: { limit } });
  return data;
}

export async function getGameDetail(id: string) {
  const { data } = await api.get<GameDetail>(`/games/${id}`);
  return data;
}

export async function getActivePaymentConfig() {
  const { data } = await api.get<ActivePaymentConfig>("/payment-config/active");
  return data;
}

export async function createOrder(request: OrderCreateRequest) {
  const { data } = await api.post<OrderCreateResponse>("/orders", request);
  return data;
}

export async function getOrder(orderCode: string) {
  const { data } = await api.get<OrderConfirmationData>(`/orders/${orderCode}`);
  return data;
}

export async function uploadPaymentProof(orderCode: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post<{ orderCode: string; status: string }>(
    `/orders/${orderCode}/proof`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return data;
}
export async function createReview(gameId: string, data: { displayName?: string; rating: number; content: string }) {
  const { data: review } = await api.post<GameReview>(`/games/${gameId}/reviews`, data);
  return review;
}


