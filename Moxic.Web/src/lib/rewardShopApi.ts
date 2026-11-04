import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "/api";
const api = axios.create({ baseURL: API_URL, withCredentials: true });

export interface RewardShopItem {
  id: string;
  name: string;
  description: string | null;
  kind: "Coupon" | "CaseCode";
  pointsCost: number;
  discountType: "Percent" | "Fixed" | null;
  discountValue: number | null;
  discountMaxAmount: number | null;
  discountMinOrderAmount: number | null;
  caseName: string | null;
  validDays: number;
  remaining: number | null;
  perUserLimit: number | null;
  myRedeemed: number;
}

export interface RewardRedemptionRow {
  id: string;
  itemName: string;
  kind: "Coupon" | "CaseCode";
  pointsSpent: number;
  code: string;
  expiresAt: string | null;
  createdAt: string;
  used: boolean;
  caseSlug: string | null;
}

export async function getRewardShop() {
  const { data } = await api.get<{ balance: number | null; items: RewardShopItem[] }>("/rewards/shop");
  return data;
}

export async function redeemReward(id: string) {
  const { data } = await api.post<{ balance: number; code: string; kind: string; expiresAt: string; caseSlug: string | null }>(
    `/rewards/shop/${id}/redeem`,
  );
  return data;
}

export async function getRedemptions() {
  const { data } = await api.get<RewardRedemptionRow[]>("/rewards/shop/history");
  return data;
}
