import axios from "axios";
import type { GamesResponse, GameDetail, ActivePaymentConfig, OrderCreateRequest, OrderCreateResponse, OrderConfirmationData } from "../types/game";

const api = axios.create({
  baseURL: "/api",
});

export async function getGames(params?: {
  page?: number;
  pageSize?: number;
  genre?: string;
  status?: string;
  search?: string;
}) {
  const { data } = await api.get<GamesResponse>("/games", { params });
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
