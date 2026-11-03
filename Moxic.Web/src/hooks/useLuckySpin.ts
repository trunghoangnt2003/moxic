import { useMutation, useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { getContactSettings, getLuckySpinPrizes, spinWithCode } from "../lib/luckySpinApi";

export function useLuckySpinPrizes() {
  return useQuery({
    queryKey: ["lucky-spin", "prizes"],
    queryFn: getLuckySpinPrizes,
    staleTime: 60 * 1000,
  });
}

export function useSpin() {
  return useMutation({
    mutationFn: (code: string) => spinWithCode(code),
  });
}

export function useContactSettings() {
  return useQuery({
    queryKey: ["contact-settings"],
    queryFn: getContactSettings,
    staleTime: 5 * 60 * 1000,
  });
}

/** Map an axios error from the spin endpoint to a Vietnamese message. */
export function getSpinErrorMessage(err: unknown): string {
  if (isAxiosError(err)) {
    if (err.response?.status === 429) {
      return "Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.";
    }
    const data = err.response?.data as { error?: unknown } | undefined;
    if (data && typeof data.error === "string" && data.error.trim()) {
      return data.error;
    }
  }
  return "Không thể quay lúc này, vui lòng thử lại.";
}
