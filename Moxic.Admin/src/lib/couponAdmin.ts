import { apiFetch, apiUrl } from "./api";
import { readApiError } from "./luckySpinAdmin";

export type CouponSource = "Event" | "SpinReward" | "PointsReward";
export type CouponDiscountType = "Percent" | "Fixed";

export interface AdminCoupon {
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
  maxTotalUses: number | null;
  maxUsesPerCustomer: number;
  usedCount: number;
  isActive: boolean;
  ownerUserId: string | null;
  ownerEmail: string | null;
  claimedAt: string | null;
  spinHistoryId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCouponList {
  items: AdminCoupon[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface AdminCouponRedemption {
  id: string;
  orderId: string;
  orderCode: string;
  orderStatus: string;
  userEmail: string | null;
  discountAmount: number;
  createdAt: string;
  releasedAt: string | null;
}

/** Shared terms for create / bulk / update. */
export interface CouponTermsInput {
  name: string;
  discountType: CouponDiscountType;
  value: number;
  maxDiscountAmount: number | null;
  minOrderAmount: number | null;
  gameId: string | null;
  startsAt: string | null;
  expiresAt: string | null;
  maxTotalUses: number | null;
  maxUsesPerCustomer: number | null;
  isActive: boolean;
}

export interface CouponUpsertInput extends CouponTermsInput {
  code: string | null;
}

export interface CouponBulkInput extends CouponTermsInput {
  prefix: string;
  count: number;
}

export const DISCOUNT_TYPE_LABELS: Record<CouponDiscountType, string> = {
  Percent: "Phần trăm",
  Fixed: "Số tiền cố định",
};

export const formatVnd = (n: number) => `${Math.round(n).toLocaleString("vi-VN")}₫`;

export function describeDiscount(c: {
  discountType: CouponDiscountType;
  value: number;
  maxDiscountAmount: number | null;
}): string {
  if (c.discountType === "Percent") {
    const pct = Number.isInteger(c.value) ? String(c.value) : c.value.toLocaleString("vi-VN");
    return c.maxDiscountAmount ? `Giảm ${pct}% (tối đa ${formatVnd(c.maxDiscountAmount)})` : `Giảm ${pct}%`;
  }
  return `Giảm ${formatVnd(c.value)}`;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function fetchCoupons(params: {
  source?: CouponSource | "";
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<AdminCouponList> {
  const qs = new URLSearchParams({ page: String(params.page ?? 1), pageSize: String(params.pageSize ?? 50) });
  if (params.source) qs.set("source", params.source);
  if (params.search) qs.set("search", params.search);
  const res = await apiFetch(apiUrl(`/api/admin/coupons?${qs.toString()}`));
  if (!res.ok) throw new Error(await readApiError(res, "Không tải được danh sách mã giảm giá"));
  return res.json();
}

export async function createCoupon(input: CouponUpsertInput): Promise<AdminCoupon> {
  const res = await apiFetch(apiUrl("/api/admin/coupons"), {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readApiError(res, "Không tạo được mã giảm giá"));
  return res.json();
}

export async function bulkCreateCoupons(input: CouponBulkInput): Promise<{ count: number; codes: string[] }> {
  const res = await apiFetch(apiUrl("/api/admin/coupons/bulk"), {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readApiError(res, "Không tạo được mã hàng loạt"));
  return res.json();
}

export async function updateCoupon(id: string, input: CouponUpsertInput): Promise<AdminCoupon> {
  const res = await apiFetch(apiUrl(`/api/admin/coupons/${id}`), {
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readApiError(res, "Không cập nhật được mã giảm giá"));
  return res.json();
}

export async function toggleCoupon(id: string, isActive: boolean): Promise<AdminCoupon> {
  const res = await apiFetch(apiUrl(`/api/admin/coupons/${id}/active`), {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify({ isActive }),
  });
  if (!res.ok) throw new Error(await readApiError(res, "Không cập nhật được trạng thái"));
  return res.json();
}

export async function removeCoupon(id: string): Promise<void> {
  const res = await apiFetch(apiUrl(`/api/admin/coupons/${id}`), { method: "DELETE" });
  if (!res.ok) throw new Error(await readApiError(res, "Không xóa được mã giảm giá"));
}

export async function fetchCouponRedemptions(id: string): Promise<AdminCouponRedemption[]> {
  const res = await apiFetch(apiUrl(`/api/admin/coupons/${id}/redemptions`));
  if (!res.ok) throw new Error(await readApiError(res, "Không tải được lượt sử dụng"));
  return res.json();
}

export interface GameOption {
  id: string;
  name: string;
}

export async function searchGameOptions(search: string): Promise<GameOption[]> {
  const res = await apiFetch(apiUrl(`/api/admin/lucky-spin/game-options?search=${encodeURIComponent(search.trim())}`));
  if (!res.ok) return [];
  return res.json();
}
