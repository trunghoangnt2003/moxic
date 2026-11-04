import { useMemo } from "react";
import { History } from "lucide-react";
import { useGames } from "../../hooks/useGames";
import { recentlyViewed } from "../../lib/localIds";
import GameRail from "./GameRail";

/** "Đã xem gần đây", ids live in localStorage, game data (fresh covers/prices) is re-fetched. */
export default function RecentlyViewed({ excludeId }: { excludeId?: string }) {
  const allIds = recentlyViewed.useIds();
  const ids = useMemo(() => allIds.filter((id) => id !== excludeId).slice(0, 10), [allIds, excludeId]);
  const { data } = useGames({ ids, pageSize: 12 }, { enabled: ids.length > 0 });

  const games = useMemo(() => {
    const order = new Map(ids.map((id, i) => [id, i]));
    return [...(data?.items ?? [])].filter((g) => order.has(g.id)).sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  }, [data, ids]);

  if (ids.length === 0 || games.length === 0) return null;

  return (
    <GameRail
      title={
        <>
          <History className="w-5 h-5 text-accent" /> Bạn đã xem gần đây
        </>
      }
      games={games}
      action={
        <button type="button" onClick={() => recentlyViewed.clear()} className="text-xs text-text-muted hover:text-white cursor-pointer">
          Xóa lịch sử
        </button>
      }
    />
  );
}
