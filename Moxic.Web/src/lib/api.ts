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
  ids?: string[];
  types?: string[];
  regions?: string[];
  publishers?: string[];
  minPrice?: number;
  maxPrice?: number;
  onSale?: boolean;
  rentable?: boolean;
  flashSale?: boolean;
  yearFrom?: number;
  yearTo?: number;
  minRating?: number;
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
  if (query.ids?.length) params.ids = query.ids.join(",");
  if (query.types?.length) params.type = query.types.join(",");
  if (query.regions?.length) params.region = query.regions.join(",");
  if (query.publishers?.length) params.publisher = query.publishers.join(",");
  if (query.minPrice != null) params.minPrice = query.minPrice;
  if (query.maxPrice != null) params.maxPrice = query.maxPrice;
  if (query.onSale) params.onSale = true;
  if (query.rentable) params.rentable = true;
  if (query.flashSale) params.flashSale = true;
  if (query.yearFrom != null) params.yearFrom = query.yearFrom;
  if (query.yearTo != null) params.yearTo = query.yearTo;
  if (query.minRating != null) params.minRating = query.minRating;
  if (query.sort) params.sort = query.sort;
  params.page = query.page ?? 1;
  params.pageSize = query.pageSize ?? 20;
  const { data } = await api.get<GamesResponse>("/games", { params });
  return data;
}

export interface Announcement {
  id: string;
  kind: "GameLaunch" | "Event" | "News";
  title: string;
  subtitle: string | null;
  body: string | null;
  imageUrl: string | null;
  gameId: string | null;
  gameName: string | null;
  gamePrice: number | null;
  gameOriginalPrice: number | null;
  countdownTo: string | null;
  countdownLabel: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  updatedAt: string;
}

export async function getActiveAnnouncements() {
  const { data } = await api.get<{ items: Announcement[]; serverNow: string }>("/announcements/active");
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



export interface WishlistResponse {
  ids: string[];
  items: GamesResponse["items"];
  priceAlerts?: boolean;
}

export async function setPriceAlerts(enabled: boolean) {
  await api.put("/account/wishlist/alerts", { enabled });
}

export async function getWishlist() {
  const { data } = await api.get<WishlistResponse>("/account/wishlist");
  return data;
}

export async function addToWishlist(gameId: string) {
  await api.put(`/account/wishlist/${gameId}`);
}

export async function removeFromWishlist(gameId: string) {
  await api.delete(`/account/wishlist/${gameId}`);
}

export async function mergeWishlist(gameIds: string[]) {
  const { data } = await api.post<WishlistResponse>("/account/wishlist/merge", { gameIds });
  return data;
}

export interface RecentPurchase {
  buyer: string;
  gameId: string;
  gameName: string;
  coverUrl: string | null;
  at: string;
}

export async function getRecentPurchases() {
  const { data } = await api.get<{ items: RecentPurchase[]; serverNow: string }>("/activity/recent-purchases");
  return data;
}

export interface GiftInfo {
  fromName: string | null;
  recipientName: string | null;
  message: string | null;
  items: { gameId: string; gameName: string; editionName: string | null; coverUrl: string | null }[];
  status: string;
  paid: boolean;
  claimed: boolean;
  claimedAt: string | null;
  xboxEmailHint: string | null;
  canClaim: boolean;
  createdAt: string;
}

export async function getGift(token: string) {
  const { data } = await api.get<GiftInfo>(`/gifts/${token}`);
  return data;
}

export async function claimGift(token: string, body: { xboxEmail: string; xboxPassword: string; phone?: string }) {
  const { data } = await api.post<{ message: string }>(`/gifts/${token}/claim`, body);
  return data;
}
