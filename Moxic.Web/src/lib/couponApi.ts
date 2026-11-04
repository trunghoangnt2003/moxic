import axios, { isAxiosError } from "axios";
import { formatPrice } from "./utils";

// Own axios instance (mirrors accountApi.ts). withCredentials sends the MoxicCustomer cookie.
const API_URL = import.meta.env.VITE_API_URL || "/api";
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

export type CouponDiscountType = "Percent" | "Fixed";
export type CouponSource = "Event" | "SpinReward";
export type WalletCouponStatus = "Usable" | "Upcoming" | "Used" | "Expired" | "Inactive";

/** Server-computed checkout preview. */
export interface CouponQuote {
  code: string;
  name: string;
  source: CouponSource;
  discountType: CouponDiscountType;
  value: number;
  maxDiscountAmount: number | null;
  minOrderAmount: number | null;
  gameId: string | null;
  gameName: string | null;
  expiresAt: string | null;
  subtotal: number;
  applicableAmount: number;
  discountAmount: number;
  total: number;
}

export interface WalletCoupon {
  id: string;
  code: string;
  name: string;
  source: CouponSource;
  discountType: CouponDiscountType;
  value: number;
  maxDiscountAmount: number | null;
  minOrderAmount: number | null;
  gameId: string | null;
  gameName: string | null;
  startsAt: string | null;
  expiresAt: string | null;
  status: WalletCouponStatus;
  usesLeft: number;
  createdAt: string;
}

/** Cart line token for coupon previews: "gameId" or "gameId:editionId". */
export const cartLineToken = (gameId: string, editionId?: string | null) => (editionId ? `${gameId}:${editionId}` : gameId);

export async function validateCoupon(code: string, lineTokens: string[]): Promise<CouponQuote> {
  const { data } = await api.post<CouponQuote>("/coupons/validate", {
    code,
    items: lineTokens.map((token) => {
      const [gameId, editionId] = token.split(":");
      return editionId ? { gameId, editionId } : { gameId };
    }),
  });
  return data;
}

export async function getMyCoupons(): Promise<WalletCoupon[]> {
  const { data } = await api.get<{ items: WalletCoupon[] }>("/account/coupons");
  return data.items;
}

export async function claimCoupon(code: string): Promise<{ coupon: WalletCoupon; alreadyOwned: boolean }> {
  const { data } = await api.post<{ coupon: WalletCoupon; alreadyOwned: boolean }>("/account/coupons/claim", { code });
  return data;
}

type DiscountShape = Pick<WalletCoupon, "discountType" | "value" | "maxDiscountAmount">;

function formatPercent(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toLocaleString("vi-VN");
}

/** "Giảm 10% (tối đa 50.000đ)" or "Giảm 50.000đ". */
export function describeCouponDiscount(c: DiscountShape): string {
  if (c.discountType === "Percent") {
    const base = `Giảm ${formatPercent(c.value)}%`;
    return c.maxDiscountAmount ? `${base} (tối đa ${formatPrice(c.maxDiscountAmount)})` : base;
  }
  return `Giảm ${formatPrice(c.value)}`;
}

/** Short chip label: "Giảm 10%" / "Giảm 50.000đ" (no cap). */
export function shortCouponDiscount(c: DiscountShape): string {
  return c.discountType === "Percent" ? `Giảm ${formatPercent(c.value)}%` : `Giảm ${formatPrice(c.value)}`;
}

export function describeCouponConditions(c: Pick<WalletCoupon, "minOrderAmount" | "gameId" | "gameName">): string[] {
  const parts: string[] = [];
  if (c.minOrderAmount) parts.push(`Đơn tối thiểu ${formatPrice(c.minOrderAmount)}`);
  if (c.gameId) parts.push(`Chỉ áp dụng cho ${c.gameName ?? "một game"}`);
  return parts;
}

export function getCouponErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    if (err.response?.status === 401) return "Đăng nhập để dùng mã giảm giá.";
    if (err.response?.status === 429) return "Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.";
    const data = err.response?.data as { error?: unknown } | undefined;
    if (data && typeof data.error === "string" && data.error.trim()) return data.error;
  }
  return fallback;
}
