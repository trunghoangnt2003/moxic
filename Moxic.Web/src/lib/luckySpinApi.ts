import axios from "axios";

// Own axios instance mirroring lib/api.ts (kept separate so lib/api.ts stays untouched).
const API_URL = import.meta.env.VITE_API_URL || "/api";
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

export type SpinPrizeType = "Luck" | "Discount" | "Game";
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface PublicPrize {
  id: string;
  name: string;
  type: SpinPrizeType;
  rarity: Rarity;
  gameId: string | null;
  imageUrl: string | null;
}

export interface LuckySpinPrizesResponse {
  available: boolean;
  prizes: PublicPrize[];
}

export interface SpinResult {
  spinId: string;
  prize: PublicPrize;
  rewardCode: string | null;
  remainingUses: number;
  winningIndex: number;
  reel: PublicPrize[];
}

export interface ContactSettings {
  messengerUrl: string | null;
  zaloUrl: string | null;
  phoneNumber: string | null;
  phoneHref: string | null;
}

export async function getLuckySpinPrizes() {
  const { data } = await api.get<LuckySpinPrizesResponse>("/lucky-spin/prizes");
  return data;
}

export async function spinWithCode(code: string) {
  const { data } = await api.post<SpinResult>("/lucky-spin/spin", { code });
  return data;
}

export async function getContactSettings() {
  const { data } = await api.get<ContactSettings>("/contact-settings");
  return data;
}
