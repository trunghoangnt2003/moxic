import { apiFetch, apiUrl } from "./api";

export type OpenMethod = "Code" | "FreeInterval" | "Points";

export interface AdminCase {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  openMethod: OpenMethod;
  freeIntervalHours: number;
  pointsCost: number;
  /** Code cases: price per spin bought by bank transfer (0 = not for sale). */
  codePrice?: number;
  isActive: boolean;
  displayOrder: number;
  prizeCount: number;
  activePrizeCount: number;
  activeTotalPercent: number;
  isPoolValid: boolean;
  codeCount: number;
  createdAt: string;
  updatedAt: string;
}

export const OPEN_METHOD_LABELS: Record<OpenMethod, string> = {
  Code: "Nhập mã",
  FreeInterval: "Miễn phí theo chu kỳ",
  Points: "Dùng điểm",
};

export const OPEN_METHODS: OpenMethod[] = ["Code", "FreeInterval", "Points"];

/** "Nhập mã" | "Miễn phí mỗi 24h" | "500 điểm" */
export function describeOpenMethod(c: Pick<AdminCase, "openMethod" | "freeIntervalHours" | "pointsCost" | "codePrice">): string {
  if (c.openMethod === "FreeInterval") return `Miễn phí mỗi ${c.freeIntervalHours}h`;
  if (c.openMethod === "Points") return `${c.pointsCost.toLocaleString("vi-VN")} điểm`;
  return c.codePrice ? `Nhập mã, bán ${c.codePrice.toLocaleString("vi-VN")}đ/lượt` : "Nhập mã";
}

/** Same rules as the server: lowercase ASCII, Vietnamese diacritics removed, non [a-z0-9] runs -> "-". */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

export async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    if (data && typeof data.error === "string" && data.error) return data.error;
  } catch {
    // ignore
  }
  return fallback;
}

export async function fetchAdminCases(): Promise<AdminCase[]> {
  const res = await apiFetch(apiUrl("/api/admin/lucky-spin/cases"));
  if (!res.ok) throw new Error(await readApiError(res, "Không tải được danh sách hòm"));
  return res.json();
}
