import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { addToWishlist, getGames, getWishlist, mergeWishlist, removeFromWishlist, type WishlistResponse } from "../lib/api";
import { guestWishlist } from "../lib/localIds";
import { useMe } from "./useAccount";

const KEY = ["wishlist"];

// Shared across every hook instance (many GameCards mount at once).
let merging = false;

/**
 * Wishlist ids for the current visitor: server-side when a customer is signed in, otherwise a
 * local list. The local list is merged into the account right after sign-in.
 */
export function useWishlistIds() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const localIds = guestWishlist.useIds();
  const loggedIn = !!me;

  const server = useQuery({ queryKey: KEY, queryFn: getWishlist, enabled: loggedIn, staleTime: 60_000 });

  // Merge the guest list once after login.
  useEffect(() => {
    if (!loggedIn || merging || guestWishlist.get().length === 0) return;
    merging = true;
    mergeWishlist(guestWishlist.get())
      .then((data) => {
        guestWishlist.clear();
        qc.setQueryData(KEY, data);
      })
      .catch(() => {})
      .finally(() => {
        merging = false;
      });
  }, [loggedIn, qc]);

  const ids = loggedIn ? (server.data?.ids ?? []) : localIds;
  return { ids, loggedIn };
}

export function useToggleWishlist() {
  const qc = useQueryClient();
  const { ids, loggedIn } = useWishlistIds();

  const mutation = useMutation({
    mutationFn: async ({ gameId, add }: { gameId: string; add: boolean }) => {
      if (add) await addToWishlist(gameId);
      else await removeFromWishlist(gameId);
    },
    onMutate: async ({ gameId, add }) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<WishlistResponse>(KEY);
      if (prev) {
        qc.setQueryData<WishlistResponse>(KEY, {
          ids: add ? [gameId, ...prev.ids.filter((x) => x !== gameId)] : prev.ids.filter((x) => x !== gameId),
          items: add ? prev.items : prev.items.filter((g) => g.id !== gameId),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev);
      toast.error("Không cập nhật được danh sách yêu thích");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  return (gameId: string, name?: string) => {
    const add = !ids.includes(gameId);
    if (loggedIn) mutation.mutate({ gameId, add });
    else if (add) guestWishlist.push(gameId);
    else guestWishlist.remove(gameId);
    if (add) toast.success(name ? `Đã thêm “${name}” vào Yêu thích` : "Đã thêm vào Yêu thích", { icon: "❤️" });
  };
}

/** Full game data for the wishlist page (fresh covers for guests too). */
export function useWishlistGames() {
  const { ids, loggedIn } = useWishlistIds();
  const server = useQuery({ queryKey: KEY, queryFn: getWishlist, enabled: loggedIn, staleTime: 60_000 });
  const guest = useQuery({
    queryKey: ["games", "byIds", ids],
    queryFn: () => getGames({ ids, pageSize: 60 }),
    enabled: !loggedIn && ids.length > 0,
  });

  if (loggedIn) return { games: server.data?.items ?? [], isLoading: server.isLoading };
  const order = new Map(ids.map((id, i) => [id, i]));
  const games = ids.length === 0 ? [] : [...(guest.data?.items ?? [])].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return { games, isLoading: ids.length > 0 && guest.isLoading };
}
