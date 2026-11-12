import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { apiError } from "../lib/communityApi";
import { t } from "../lib/i18n";
import {
  getShareMessages,
  getShareRoom,
  listShareRooms,
  myShareRooms,
  type ShareListQuery,
  type ShareRoom,
} from "../lib/shareApi";

export const shareRoomKey = (code: string) => ["share", "room", code.toUpperCase()] as const;

export function useShareRooms(q: ShareListQuery) {
  return useQuery({ queryKey: ["share", "list", q], queryFn: () => listShareRooms(q), staleTime: 15_000 });
}

/** A room, polled while it can still change (5s), slower once settled. */
export function useShareRoom(code: string) {
  return useQuery({
    queryKey: shareRoomKey(code),
    queryFn: () => getShareRoom(code),
    enabled: !!code,
    retry: false,
    refetchInterval: (q) => {
      const r = q.state.data as ShareRoom | undefined;
      if (!r) return false;
      return r.status === "Open" || r.status === "Full" ? 5000 : 30_000;
    },
  });
}

export function useShareMessages(code: string, enabled: boolean) {
  return useQuery({
    queryKey: ["share", "messages", code.toUpperCase()],
    queryFn: () => getShareMessages(code),
    enabled: enabled && !!code,
    refetchInterval: enabled ? 4000 : false,
  });
}

export function useMyShareRooms(enabled = true) {
  return useQuery({ queryKey: ["share", "mine"], queryFn: myShareRooms, enabled, refetchInterval: 30_000 });
}

/** Runs a room action and puts the returned room into the cache; errors become a toast. */
export function useShareAction<TArg>(code: string, fn: (arg: TArg) => Promise<ShareRoom>, success?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (room) => {
      qc.setQueryData(shareRoomKey(code), room);
      qc.invalidateQueries({ queryKey: ["share", "messages", code.toUpperCase()] });
      qc.invalidateQueries({ queryKey: ["share", "mine"] });
      if (success) toast.success(success);
    },
    onError: (e) => toast.error(apiError(e, t("Có lỗi xảy ra, thử lại nhé."))),
  });
}
