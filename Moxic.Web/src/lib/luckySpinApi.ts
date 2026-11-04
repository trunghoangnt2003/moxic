import axios from "axios";

import { t, locale } from "./i18n";
// Own axios instance mirroring lib/api.ts (kept separate so lib/api.ts stays untouched).
// withCredentials sends the MoxicCustomer cookie (free / points cases need the account).
const API_URL = import.meta.env.VITE_API_URL || "/api";
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

export type SpinPrizeType = "Luck" | "Discount" | "Game";
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type OpenMethod = "Code" | "FreeInterval" | "Points";

export interface PublicPrize {
  id: string;
  name: string;
  type: SpinPrizeType;
  rarity: Rarity;
  gameId: string | null;
  imageUrl: string | null;
}

export interface CaseSummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  openMethod: OpenMethod;
  freeIntervalHours: number;
  pointsCost: number;
  /** Active prizes total exactly 100%. */
  available: boolean;
  prizeCount: number;
  previewPrizes: PublicPrize[];
  /** FreeInterval + logged-in customer with an active cooldown only. */
  nextFreeOpenAt: string | null;
}

export interface CasesPage {
  items: CaseSummary[];
  total: number;
  page: number;
  pageSize: number;
  loggedIn: boolean;
  serverNow: string;
}

export interface CaseViewer {
  loggedIn: boolean;
  emailVerified: boolean;
  points: number | null;
  nextFreeOpenAt: string | null;
  canOpen: boolean;
}

export interface CaseDetail {
  case: CaseSummary;
  prizes: PublicPrize[];
  viewer: CaseViewer;
  serverNow: string;
}

export interface OpenCaseResult {
  spinId: string;
  caseSlug: string;
  prize: PublicPrize;
  rewardCode: string | null;
  /** Code cases only. */
  remainingUses: number | null;
  pointsSpent: number;
  /** Points cases only: balance after the open. */
  pointsBalance: number | null;
  /** FreeInterval cases only. */
  nextFreeOpenAt: string | null;
  winningIndex: number;
  /** Fraction of a card width from the winning card's centre (server-chosen), [-0.45, 0.45]. */
  stopOffset: number;
  reel: PublicPrize[];
  /** A configured Discount win created a real coupon (code = rewardCode). */
  couponCreated: boolean;
  /** The coupon is already in the logged-in customer's wallet. */
  couponInWallet: boolean;
  couponExpiresAt: string | null;
}

export interface SpinMusicTrack {
  id: string;
  name: string;
  url: string;
}

export interface LiveDrop {
  id: string;
  prizeName: string;
  prizeType: "Discount" | "Game";
  rarity: Rarity;
  imageUrl: string | null;
  caseName: string;
  caseSlug: string | null;
  winnerName: string;
  createdAt: string;
}

export interface LiveDropsResponse {
  wow: LiveDrop[];
  feed: LiveDrop[];
  serverNow: string;
}

export interface ContactSettings {
  messengerUrl: string | null;
  zaloUrl: string | null;
  phoneNumber: string | null;
  phoneHref: string | null;
}

export interface CasesQuery {
  page: number;
  pageSize: number;
  method?: OpenMethod | null;
  q?: string | null;
}

export async function getCases({ page, pageSize, method, q }: CasesQuery) {
  const params: Record<string, string | number> = { page, pageSize };
  if (method) params.method = method;
  if (q && q.trim()) params.q = q.trim();
  const { data } = await api.get<CasesPage>("/lucky-spin/cases", { params });
  return data;
}

export async function getCase(slug: string) {
  const { data } = await api.get<CaseDetail>(`/lucky-spin/cases/${encodeURIComponent(slug)}`);
  return data;
}

/** The request carries nothing but an optional code — the server decides everything else. */
export async function openCase(slug: string, code?: string) {
  const { data } = await api.post<OpenCaseResult>(`/lucky-spin/cases/${encodeURIComponent(slug)}/open`, {
    code: code || null,
  });
  return data;
}

export async function lookupSpinCode(code: string) {
  const { data } = await api.get<{ slug: string }>("/lucky-spin/code-lookup", { params: { code } });
  return data;
}

export async function getSpinMusic() {
  const { data } = await api.get<SpinMusicTrack[]>("/lucky-spin/music");
  return data;
}

export async function getLiveDrops() {
  const { data } = await api.get<LiveDropsResponse>("/lucky-spin/live-drops");
  return data;
}

export async function getContactSettings() {
  const { data } = await api.get<ContactSettings>("/contact-settings");
  return data;
}

export function formatPoints(n: number): string {
  return n.toLocaleString(locale);
}

/** "Nhập mã" | "Miễn phí mỗi 24h" | "500 điểm" */
export function openMethodLabel(c: Pick<CaseSummary, "openMethod" | "freeIntervalHours" | "pointsCost">): string {
  if (c.openMethod === "FreeInterval") return t("Miễn phí mỗi {0}h", [c.freeIntervalHours]);
  if (c.openMethod === "Points") return t("{0} điểm", [formatPoints(c.pointsCost)]);
  return t("Nhập mã");
}
