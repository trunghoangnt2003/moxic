import axios from "axios";

// Share rooms: 2 customers buy one game together, each pays their own part by bank transfer (content MXR…).
const API_URL = import.meta.env.VITE_API_URL || "/api";
const api = axios.create({ baseURL: API_URL, withCredentials: true });

export type ShareAccountType = "Owner" | "Moxic";
export type ShareRoomStatus = "Open" | "Full" | "Funded" | "Cancelled";
/** chờ người / chờ thanh toán / đã đủ / đang cài / hoàn tất / đã hủy */
export type ShareDisplayStatus = "waiting" | "paying" | "full" | "installing" | "done" | "cancelled";

export interface ShareSeat {
  id: string;
  displayName: string;
  isOwner: boolean;
  isMe: boolean;
  percent: number;
  shareAmount: number;
  discountAmount: number;
  couponCode: string | null;
  amountDue: number;
  paid: boolean;
  paidAt: string | null;
  payDeadline: string | null;
  shareCount: number;
}

export interface ShareMyPayment {
  paymentCode: string | null;
  amountDue: number;
  paidAmount: number;
  paid: boolean;
  qrUrl: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
  autoConfirm: boolean;
}

export interface ShareRoom {
  code: string;
  gameId: string;
  gameName: string;
  coverUrl: string | null;
  totalPrice: number;
  accountType: ShareAccountType;
  ownerPercent: number;
  isPublic: boolean;
  status: ShareRoomStatus;
  displayStatus: ShareDisplayStatus;
  locked: boolean;
  isMember: boolean;
  isOwner: boolean;
  createdAt: string;
  fullAt: string | null;
  expiresAt: string;
  seats: ShareSeat[];
  myPayment: ShareMyPayment | null;
  orderCode: string | null;
  ownerXboxSet: boolean;
  myXboxEmail: string | null;
  cancelReason: string | null;
  myLeftReason: string | null;
  myNeedsRefund: boolean;
  myRefundedAt: string | null;
}

export interface ShareRoomCard {
  code: string;
  gameId: string;
  gameName: string;
  coverUrl: string | null;
  accountType: ShareAccountType;
  ownerPercent: number;
  openPercent: number;
  openAmount: number;
  totalPrice: number;
  expiresAt: string;
  ownerName: string;
  ownerShareCount: number;
  createdAt: string;
  status: ShareRoomStatus;
  displayStatus: ShareDisplayStatus;
  /** Only rooms waiting for a partner can be joined; full and paid ones are listed for show. */
  joinable: boolean;
  paidCount: number;
  partnerName: string | null;
}

export interface ShareMessage {
  id: string;
  authorName: string | null;
  mine: boolean;
  system: boolean;
  text: string;
  reported: boolean;
  createdAt: string;
}

export interface ShareListQuery {
  gameId?: string;
  accountType?: ShareAccountType;
  percent?: number;
  sort?: "new" | "ending";
  /** true = only rooms still looking for a partner. */
  open?: boolean;
}

export interface CreateShareRoomInput {
  gameId: string;
  editionId: string | null;
  accountType: ShareAccountType;
  ownerPercent: number;
  isPublic: boolean;
}

export const listShareRooms = (q: ShareListQuery) => api.get<ShareRoomCard[]>("/share", { params: q }).then((r) => r.data);
export const getShareRoom = (code: string) => api.get<ShareRoom>(`/share/${encodeURIComponent(code)}`).then((r) => r.data);
export const createShareRoom = (body: CreateShareRoomInput) => api.post<ShareRoom>("/share", body).then((r) => r.data);
export const myShareRooms = () => api.get<ShareRoom[]>("/account/share").then((r) => r.data);

const act = (code: string, path: string, method: "post" | "put" = "post", body?: unknown) =>
  api.request<ShareRoom>({ url: `/share/${encodeURIComponent(code)}/${path}`, method, data: body ?? {} }).then((r) => r.data);

export const joinShareRoom = (code: string) => act(code, "join");
export const leaveShareRoom = (code: string) => act(code, "leave");
export const kickSharePartner = (code: string) => act(code, "kick");
export const cancelShareRoom = (code: string) => act(code, "cancel");
export const setSharePercent = (code: string, percent: number) => act(code, "percent", "put", { percent });
export const setShareCoupon = (code: string, couponCode: string | null) => act(code, "coupon", "put", { code: couponCode });
export const setShareXbox = (code: string, email: string, password: string) => act(code, "xbox", "put", { email, password });
export const startSharePayment = (code: string) => act(code, "pay");

export const getShareMessages = (code: string) =>
  api.get<ShareMessage[]>(`/share/${encodeURIComponent(code)}/messages`).then((r) => r.data);
export const postShareMessage = (code: string, text: string) =>
  api.post<ShareMessage>(`/share/${encodeURIComponent(code)}/messages`, { text }).then((r) => r.data);
export const reportShareMessage = (code: string, id: string) =>
  api.post(`/share/${encodeURIComponent(code)}/messages/${id}/report`, {}).then((r) => r.data);

/** Room link in the current language (for copying / Facebook). */
export function shareRoomUrl(code: string, langPrefix: string) {
  return `${window.location.origin}${langPrefix}/share/${code}`;
}

export interface ShareableGame {
  id: string;
  name: string;
  salePrice: number;
  coverUrl: string | null;
  editions: { id: string; name: string; salePrice: number; isDefault: boolean }[];
}

export const listShareableGames = (q: string) =>
  api.get<ShareableGame[]>("/share/games", { params: q ? { q } : {} }).then((r) => r.data);

/** Mirrors the server split: partner rounded down to 1.000đ, owner takes the rest. */
export function splitAmounts(total: number, ownerPercent: number) {
  const partner = Math.floor((total * (100 - ownerPercent)) / 100 / 1000) * 1000;
  return { owner: total - partner, partner };
}
