import axios from "axios";

// Own axios instance (mirrors luckySpinApi.ts). withCredentials sends the HttpOnly
// MoxicCustomer cookie to the API (moxic.co -> api.moxic.co is same-site).
const API_URL = import.meta.env.VITE_API_URL || "/api";
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

export interface CustomerMe {
  id: string;
  email: string;
  displayName: string;
  points: number;
  emailVerified: boolean;
  createdAt: string;
}

export type OrderStatus =
  | "Pending"
  | "AwaitingConfirmation"
  | "Verifying"
  | "Installing"
  | "ActionRequired"
  | "Completed"
  | "Cancelled";

export interface AccountOrderItem {
  gameId: string;
  gameName: string;
  price: number;
  coverUrl: string | null;
}

export interface AccountOrderSummary {
  orderCode: string;
  status: OrderStatus;
  paymentMethod: string;
  totalAmount: number;
  subtotalAmount: number;
  discountAmount: number;
  couponCode: string | null;
  createdAt: string;
  updatedAt: string;
  items: AccountOrderItem[];
}

export interface AccountOrderDetail extends AccountOrderSummary {
  xboxEmail: string;
  isGift?: boolean;
  giftToken?: string | null;
  giftRecipientName?: string | null;
  giftClaimedAt?: string | null;
  savedAmount?: number;
  paidAt?: string | null;
  installStartedAt?: string | null;
  downloadingAt?: string | null;
  completedAt?: string | null;
  cancellationReason: string | null;
  isClientConfirmed: boolean;
  hasPaymentProof: boolean;
}

export interface AccountOrdersResponse {
  items: AccountOrderSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RegisterPayload {
  email: string;
  password: string;
  displayName: string;
}

export interface RegisterResponse {
  email: string;
  requiresVerification: boolean;
}

export interface MessageResponse {
  message: string;
}

export async function registerAccount(payload: RegisterPayload) {
  const { data } = await api.post<RegisterResponse>("/account/register", payload);
  return data;
}

export async function verifyEmail(email: string, code: string) {
  const { data } = await api.post<CustomerMe>("/account/verify-email", { email, code });
  return data;
}

export async function resendVerification(email: string) {
  const { data } = await api.post<MessageResponse>("/account/resend-verification", { email });
  return data;
}

export async function loginAccount(email: string, password: string) {
  const { data } = await api.post<CustomerMe>("/account/login", { email, password });
  return data;
}

export async function logoutAccount() {
  await api.post("/account/logout");
}

/** Current customer, or null for guests (API answers 204 No Content). */
export async function getMe(): Promise<CustomerMe | null> {
  const res = await api.get<CustomerMe | "">("/account/me");
  if (res.status === 204 || !res.data) return null;
  return res.data;
}

export async function forgotPassword(email: string) {
  const { data } = await api.post<MessageResponse>("/account/forgot-password", { email });
  return data;
}

export async function resetPassword(email: string, code: string, newPassword: string) {
  const { data } = await api.post<MessageResponse>("/account/reset-password", { email, code, newPassword });
  return data;
}

export async function getMyOrders(page: number, pageSize = 10) {
  const { data } = await api.get<AccountOrdersResponse>("/account/orders", { params: { page, pageSize } });
  return data;
}

export async function getMyOrder(orderCode: string) {
  const { data } = await api.get<AccountOrderDetail>(`/account/orders/${encodeURIComponent(orderCode)}`);
  return data;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  Pending: "Chờ thanh toán",
  AwaitingConfirmation: "Chờ xác nhận thanh toán",
  Verifying: "Đang xác minh",
  Installing: "Đang cài đặt",
  ActionRequired: "Cần cập nhật thông tin",
  Completed: "Hoàn tất",
  Cancelled: "Đã hủy",
};

export const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  Pending: "bg-yellow-500/10 text-yellow-300 border-yellow-500/40",
  AwaitingConfirmation: "bg-sky-500/10 text-sky-300 border-sky-500/40",
  Verifying: "bg-indigo-500/10 text-indigo-300 border-indigo-500/40",
  Installing: "bg-purple-500/10 text-purple-300 border-purple-500/40",
  ActionRequired: "bg-orange-500/10 text-orange-300 border-orange-500/40",
  Completed: "bg-green-500/10 text-green-300 border-green-500/40",
  Cancelled: "bg-red-500/10 text-red-300 border-red-500/40",
};

/**
 * Open-redirect guard for ?redirect= values: only same-origin absolute paths
 * ("/..." but not protocol-relative "//..." or "/\...").
 */
export function safeRedirect(raw: string | null, fallback = "/"): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  return raw;
}

// ───────────────────────── Loyalty points ─────────────────────────

export type PointsReason = "OrderCompleted" | "CaseOpen" | "AdminAdjust" | "CheckIn" | "Mission" | "Referral" | "Redeem" | "Leaderboard";

export interface PointsTransaction {
  id: string;
  delta: number;
  reason: PointsReason;
  note: string | null;
  balanceAfter: number;
  createdAt: string;
}

export interface PointsHistoryResponse {
  balance: number;
  items: PointsTransaction[];
  total: number;
  page: number;
  pageSize: number;
}

export async function getMyPoints(page: number, pageSize = 20) {
  const { data } = await api.get<PointsHistoryResponse>("/account/points", { params: { page, pageSize } });
  return data;
}

export const POINTS_REASON_LABELS: Record<PointsReason, string> = {
  OrderCompleted: "Hoàn tất đơn hàng",
  CaseOpen: "Mở hòm",
  AdminAdjust: "Điều chỉnh bởi Moxic",
  CheckIn: "Điểm danh hằng ngày",
  Mission: "Hoàn thành nhiệm vụ",
  Referral: "Giới thiệu bạn bè",
  Redeem: "Đổi điểm",
  Leaderboard: "Thưởng bảng xếp hạng",
};
