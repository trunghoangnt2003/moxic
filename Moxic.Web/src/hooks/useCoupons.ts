import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { claimCoupon, getMyCoupons, validateCoupon } from "../lib/couponApi";

export const COUPONS_QUERY_KEY = ["account", "coupons"] as const;

/** The logged-in customer's coupon wallet. */
export function useMyCoupons(enabled = true) {
  return useQuery({
    queryKey: COUPONS_QUERY_KEY,
    queryFn: getMyCoupons,
    enabled,
    staleTime: 30 * 1000,
  });
}

export function useClaimCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => claimCoupon(code),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: COUPONS_QUERY_KEY });
    },
  });
}

export function useValidateCoupon() {
  return useMutation({
    mutationFn: ({ code, gameIds }: { code: string; gameIds: string[] }) => validateCoupon(code, gameIds),
  });
}
