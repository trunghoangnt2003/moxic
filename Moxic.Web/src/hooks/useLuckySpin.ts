import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import {
  getCase,
  getCases,
  getContactSettings,
  getLiveDrops,
  getSpinMusic,
  openCase,
  type OpenMethod,
} from "../lib/luckySpinApi";
import { ME_QUERY_KEY } from "./useAccount";

import { t } from "../lib/i18n";
const CASES_PAGE_SIZE = 24;

export function useLuckySpinCases({ method, q }: { method: OpenMethod | null; q: string }) {
  return useInfiniteQuery({
    queryKey: ["lucky-spin", "cases", { method, q }],
    queryFn: ({ pageParam }) => getCases({ page: pageParam, pageSize: CASES_PAGE_SIZE, method, q }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
    staleTime: 30 * 1000,
  });
}

/** First 12 cases, for the home banner. */
export function useLuckySpinCasesPreview() {
  return useQuery({
    queryKey: ["lucky-spin", "cases", "preview"],
    queryFn: () => getCases({ page: 1, pageSize: 12 }),
    staleTime: 60 * 1000,
  });
}

export function useLuckySpinCase(slug: string) {
  return useQuery({
    queryKey: ["lucky-spin", "case", slug],
    queryFn: () => getCase(slug),
    enabled: !!slug,
    staleTime: 15 * 1000,
    retry: (count, err) => !(isAxiosError(err) && err.response?.status === 404) && count < 2,
  });
}

export function useOpenCase(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code?: string) => openCase(slug, code),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ME_QUERY_KEY });
      void qc.invalidateQueries({ queryKey: ["account", "points"] });
      void qc.invalidateQueries({ queryKey: ["lucky-spin", "case", slug] });
      void qc.invalidateQueries({ queryKey: ["lucky-spin", "cases"] });
    },
  });
}

/** Presigned URLs live 1 h, so keep the list for 30 min. */
export function useSpinMusic() {
  return useQuery({
    queryKey: ["lucky-spin", "music"],
    queryFn: getSpinMusic,
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });
}

/** LIVE strip: polled every 8 s while the tab is visible (server caches 5 s). */
export function useLiveDrops() {
  return useQuery({
    queryKey: ["lucky-spin", "live-drops"],
    queryFn: getLiveDrops,
    refetchInterval: 8000,
    refetchIntervalInBackground: false,
    staleTime: 4000,
    retry: 1,
  });
}

export function useContactSettings() {
  return useQuery({
    queryKey: ["contact-settings"],
    queryFn: getContactSettings,
    staleTime: 5 * 60 * 1000,
  });
}

/** Map an axios error from the lucky-spin endpoints to a Vietnamese message. */
export function getSpinErrorMessage(err: unknown): string {
  if (isAxiosError(err)) {
    if (err.response?.status === 429) {
      return t("Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.");
    }
    const data = err.response?.data as { error?: unknown } | undefined;
    if (data && typeof data.error === "string" && data.error.trim()) {
      return data.error;
    }
  }
  return t("Không thể mở hòm lúc này, vui lòng thử lại.");
}

/** Machine-readable code from an open error (LOGIN_REQUIRED, EMAIL_NOT_VERIFIED, COOLDOWN, INSUFFICIENT_POINTS). */
export function getSpinErrorCode(err: unknown): string | null {
  if (!isAxiosError(err)) return null;
  const data = err.response?.data as { code?: unknown } | undefined;
  return typeof data?.code === "string" ? data.code : null;
}
