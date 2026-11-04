import axios, { isAxiosError } from "axios";

// Own axios instance (mirrors accountApi.ts). withCredentials sends the MoxicCustomer cookie.
const API_URL = import.meta.env.VITE_API_URL || "/api";
const api = axios.create({ baseURL: API_URL, withCredentials: true });

export type RentalStatus = "PendingPayment" | "AwaitingConfirmation" | "Active" | "Expired" | "Returned" | "Completed" | "Cancelled";

export interface RentalPlan {
  id: string;
  days: number;
  price: number;
}

export interface GameRentalInfo {
  plans: RentalPlan[];
  totalSlots: number;
  freeSlots: number;
  rentable: boolean;
}

export interface RentalSummary {
  code: string;
  gameId: string;
  gameName: string;
  days: number;
  price: number;
  status: RentalStatus;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  coverUrl: string | null;
}

export interface RentalExtension {
  code: string;
  days: number;
  price: number;
  status: RentalStatus;
  createdAt: string;
}

export interface RentalDetail extends RentalSummary {
  cancelReason: string | null;
  payBefore: string | null;
  credentials: { email: string; password: string | null } | null;
  extensions: RentalExtension[];
  plans: RentalPlan[];
  canExtend: boolean;
}

export const RENTAL_STATUS: Record<RentalStatus, { label: string; cls: string }> = {
  PendingPayment: { label: "Chờ thanh toán", cls: "bg-amber-500/15 text-amber-300 border-amber-500/40" },
  AwaitingConfirmation: { label: "Chờ xác nhận", cls: "bg-sky-500/15 text-sky-300 border-sky-500/40" },
  Active: { label: "Đang thuê", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" },
  Expired: { label: "Đã hết hạn", cls: "bg-rose-500/15 text-rose-300 border-rose-500/40" },
  Returned: { label: "Đã kết thúc", cls: "bg-white/5 text-text-muted border-white/15" },
  Completed: { label: "Hoàn tất", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" },
  Cancelled: { label: "Đã hủy", cls: "bg-white/5 text-text-muted border-white/15" },
};

export function rentalError(err: unknown, fallback: string) {
  if (isAxiosError(err)) {
    const msg = (err.response?.data as { error?: string } | undefined)?.error;
    if (msg) return msg;
  }
  return fallback;
}

export async function getGameRental(gameId: string) {
  const { data } = await api.get<GameRentalInfo>(`/rentals/games/${gameId}`);
  return data;
}

export async function createRental(gameId: string, planId: string, phone?: string) {
  const { data } = await api.post<{ code: string }>("/rentals", { gameId, planId, phone });
  return data;
}

export async function getMyRentals() {
  const { data } = await api.get<RentalSummary[]>("/rentals/mine");
  return data;
}

export async function getRental(code: string) {
  const { data } = await api.get<RentalDetail>(`/rentals/${encodeURIComponent(code)}`);
  return data;
}

export async function markRentalPaid(code: string) {
  await api.post(`/rentals/${encodeURIComponent(code)}/paid`);
}

export async function cancelRental(code: string) {
  await api.post(`/rentals/${encodeURIComponent(code)}/cancel`);
}

export async function extendRental(code: string, planId: string) {
  const { data } = await api.post<{ code: string; price: number; days: number }>(`/rentals/${encodeURIComponent(code)}/extend`, { planId });
  return data;
}
