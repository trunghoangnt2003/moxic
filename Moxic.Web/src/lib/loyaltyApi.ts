import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "/api";
const api = axios.create({ baseURL: API_URL, withCredentials: true });

export interface LoyaltyStatus {
  points: number;
  tier: { key: string; name: string; pointsMultiplier: number; perk: string };
  spent: number;
  next: { key: string; name: string; minSpent: number; remaining: number } | null;
  checkIn: {
    checkedToday: boolean;
    streak: number;
    todayReward: number;
    week: { day: number; reward: number; done: boolean; today: boolean }[];
  };
  missions: { key: string; title: string; description: string; points: number; link: string | null; done: boolean; claimed: boolean }[];
  referral: {
    code: string | null;
    invited: number;
    rewarded: number;
    referrerReward: number;
    refereeReward: number;
    referredBy: boolean;
    canEnterCode: boolean;
  };
}

export interface LoyaltyProgram {
  tiers: { key: string; name: string; minSpent: number; pointsMultiplier: number; perk: string }[];
  checkIn: { daily: number; weeklyBonus: number };
  missions: { key: string; title: string; description: string; points: number }[];
  referral: { referrer: number; referee: number };
}

export async function getLoyalty() {
  const { data } = await api.get<LoyaltyStatus>("/loyalty");
  return data;
}

export async function getLoyaltyProgram() {
  const { data } = await api.get<LoyaltyProgram>("/loyalty/program");
  return data;
}

export async function checkIn() {
  const { data } = await api.post<{ reward: number; streak: number; balance: number; weekly: boolean }>("/loyalty/check-in");
  return data;
}

export async function claimMission(key: string) {
  const { data } = await api.post<{ reward: number; balance: number }>(`/loyalty/missions/${key}/claim`);
  return data;
}

export async function enterReferral(code: string) {
  const { data } = await api.post<{ message: string }>("/loyalty/referral", { code });
  return data;
}

export const TIER_STYLES: Record<string, { ring: string; text: string; bg: string }> = {
  member: { ring: "from-zinc-400 to-zinc-600", text: "text-zinc-200", bg: "bg-zinc-500/10" },
  silver: { ring: "from-slate-200 to-slate-500", text: "text-slate-100", bg: "bg-slate-400/10" },
  gold: { ring: "from-amber-200 to-amber-600", text: "text-amber-200", bg: "bg-amber-400/10" },
  diamond: { ring: "from-cyan-200 via-sky-400 to-fuchsia-500", text: "text-cyan-200", bg: "bg-cyan-400/10" },
};
