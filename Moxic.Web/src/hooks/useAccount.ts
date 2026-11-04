import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import {
  forgotPassword,
  getMe,
  getMyOrder,
  getMyOrders,
  getMyPoints,
  loginAccount,
  logoutAccount,
  registerAccount,
  resendVerification,
  resetPassword,
  verifyEmail,
  type CustomerMe,
  type RegisterPayload,
} from "../lib/accountApi";
import { COUPONS_QUERY_KEY } from "./useCoupons";

export const ME_QUERY_KEY = ["account", "me"] as const;
const ORDERS_KEY = ["account", "orders"] as const;
export const POINTS_QUERY_KEY = ["account", "points"] as const;

export function useMe() {
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: getMe,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => loginAccount(email, password),
    onSuccess: (me: CustomerMe) => {
      qc.setQueryData(ME_QUERY_KEY, me);
      void qc.invalidateQueries({ queryKey: ORDERS_KEY });
    },
  });
}

export function useVerifyEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ email, code }: { email: string; code: string }) => verifyEmail(email, code),
    onSuccess: (me: CustomerMe) => {
      qc.setQueryData(ME_QUERY_KEY, me);
      void qc.invalidateQueries({ queryKey: ORDERS_KEY });
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (payload: RegisterPayload) => registerAccount(payload),
  });
}

export function useResendVerification() {
  return useMutation({
    mutationFn: (email: string) => resendVerification(email),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => forgotPassword(email),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ email, code, newPassword }: { email: string; code: string; newPassword: string }) =>
      resetPassword(email, code, newPassword),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: logoutAccount,
    onSettled: () => {
      qc.setQueryData(ME_QUERY_KEY, null);
      qc.removeQueries({ queryKey: ORDERS_KEY });
      qc.removeQueries({ queryKey: POINTS_QUERY_KEY });
      qc.removeQueries({ queryKey: COUPONS_QUERY_KEY });
    },
  });
}

export function useMyOrders(page: number, enabled = true) {
  return useQuery({
    queryKey: [...ORDERS_KEY, "list", page],
    queryFn: () => getMyOrders(page),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useMyOrder(orderCode: string, enabled = true) {
  return useQuery({
    queryKey: [...ORDERS_KEY, "detail", orderCode],
    queryFn: () => getMyOrder(orderCode),
    enabled: enabled && !!orderCode,
    retry: false,
    // Live tracking: keep polling until the order is finished.
    refetchInterval: (q) => (q.state.data && !["Completed", "Cancelled"].includes(q.state.data.status) ? 5000 : false),
  });
}

/** Points balance + ledger page for the logged-in customer. */
export function useMyPoints(page: number, enabled = true) {
  return useQuery({
    queryKey: [...POINTS_QUERY_KEY, page],
    queryFn: () => getMyPoints(page),
    enabled,
    placeholderData: keepPreviousData,
  });
}

/** Map an account API error to a Vietnamese message. */
export function getAccountErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    if (err.response?.status === 429) {
      return "Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.";
    }
    const data = err.response?.data as { error?: unknown } | undefined;
    if (data && typeof data.error === "string" && data.error.trim()) {
      return data.error;
    }
  }
  return fallback;
}

/** True when login was refused because the email is not verified yet (403 EMAIL_NOT_VERIFIED). */
export function isEmailNotVerifiedError(err: unknown): boolean {
  if (!isAxiosError(err) || err.response?.status !== 403) return false;
  const data = err.response.data as { code?: unknown } | undefined;
  return data?.code === "EMAIL_NOT_VERIFIED";
}
