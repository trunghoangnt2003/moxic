import axios, { isAxiosError } from "axios";

// Own axios instance (mirrors accountApi.ts). withCredentials sends the MoxicCustomer cookie.
const API_URL = import.meta.env.VITE_API_URL || "/api";
const api = axios.create({ baseURL: API_URL, withCredentials: true });

export function apiError(err: unknown, fallback: string) {
  if (isAxiosError(err)) {
    const msg = (err.response?.data as { error?: string } | undefined)?.error;
    if (msg) return msg;
    if (err.response?.status === 401) return "Vui lòng đăng nhập.";
  }
  return fallback;
}

export interface CommentItem {
  id: string;
  parentId: string | null;
  displayName: string;
  content: string;
  createdAt: string;
  isMine: boolean;
  isBuyer: boolean;
}

export interface CommentThread {
  comment: CommentItem;
  replies: CommentItem[];
}

export async function getComments(gameId: string, page = 1) {
  const { data } = await api.get<{ total: number; page: number; pageSize: number; items: CommentThread[] }>(`/games/${gameId}/comments`, { params: { page } });
  return data;
}

export async function postComment(gameId: string, content: string, parentId?: string) {
  const { data } = await api.post<CommentItem>(`/games/${gameId}/comments`, { content, parentId });
  return data;
}

export async function deleteComment(id: string) {
  await api.delete(`/comments/${id}`);
}

export interface MyReview {
  signedIn: boolean;
  displayName?: string;
  purchased?: boolean;
  review?: { id: string; rating: number; content: string; isHidden: boolean } | null;
}

export async function getMyReview(gameId: string) {
  const { data } = await api.get<MyReview>(`/games/${gameId}/my-review`);
  return data;
}

export type ReportReason = "Spam" | "Offensive" | "Scam" | "Spoiler" | "Other";

export async function reportContent(targetType: "Review" | "Comment", targetId: string, reason: ReportReason, note?: string) {
  const { data } = await api.post<{ message: string }>("/reports", { targetType, targetId, reason, note });
  return data;
}

export interface AccountProfile {
  email: string;
  displayName: string;
  points: number;
  priceAlerts: boolean;
  memberSince: string | null;
  stats: { orders: number; spent: number; wishlist: number; activeRentals: number; reviews: number };
}

export async function getProfile() {
  const { data } = await api.get<AccountProfile>("/account/profile");
  return data;
}

export async function updateProfile(patch: { displayName?: string; priceAlerts?: boolean }) {
  await api.put("/account/profile", patch);
}

export async function changePassword(currentPassword: string, newPassword: string) {
  await api.post("/account/change-password", { currentPassword, newPassword });
}

export interface Library {
  owned: {
    gameId: string;
    name: string;
    editionName: string | null;
    orderCode: string;
    purchasedAt: string;
    installStatus: "Installed" | "Installing" | "ActionRequired";
    coverUrl: string | null;
  }[];
  rentals: { code: string; gameId: string; gameName: string; status: "Active" | "Expired"; endsAt: string | null; coverUrl: string | null }[];
}

export async function getLibrary() {
  const { data } = await api.get<Library>("/account/library");
  return data;
}

export interface SavingsSummary {
  saved: number;
  games: number;
  spent: number;
  orders: number;
  badges: string[];
}

export async function getSavings() {
  const { data } = await api.get<SavingsSummary>("/account/savings");
  return data;
}
