import { useQuery } from "@tanstack/react-query";
import { Sparkles, ShoppingBag, Shapes } from "lucide-react";
import GameRail from "./GameRail";
import { getAlsoBought, getForYou, getSimilar } from "../../lib/discoveryApi";
import { recentlyViewed } from "../../lib/localIds";
import { useMe } from "../../hooks/useAccount";

/** Home: "Dành cho bạn" — personalised from recently viewed + (signed-in) wishlist/purchases. */
export function ForYouRail() {
  const seeds = recentlyViewed.useIds();
  const { data: me } = useMe();
  const { data } = useQuery({
    queryKey: ["for-you", seeds.slice(0, 8).join(","), me?.id ?? "guest"],
    queryFn: () => getForYou(seeds.slice(0, 8)),
    staleTime: 5 * 60_000,
  });
  if (!data || data.items.length === 0) return null;
  return (
    <GameRail
      title={
        <>
          <Sparkles className="w-6 h-6 text-fuchsia-400" /> {data.personalised ? "Dành cho bạn" : "Có thể bạn sẽ thích"}
        </>
      }
      games={data.items}
    />
  );
}

/** Game page: "Khách mua game này cũng mua" + "Game tương tự". */
export function GamePageRails({ gameId }: { gameId: string }) {
  const { data: also } = useQuery({ queryKey: ["also-bought", gameId], queryFn: () => getAlsoBought(gameId), staleTime: 10 * 60_000 });
  const { data: similar } = useQuery({ queryKey: ["similar", gameId], queryFn: () => getSimilar(gameId), staleTime: 10 * 60_000 });
  const alsoIds = new Set((also ?? []).map((g) => g.id));
  const similarOnly = (similar ?? []).filter((g) => !alsoIds.has(g.id));
  return (
    <div className="space-y-12">
      {also && also.length > 0 && (
        <GameRail
          title={
            <>
              <ShoppingBag className="w-5 h-5 text-accent" /> Khách mua game này cũng mua
            </>
          }
          games={also}
        />
      )}
      {similarOnly.length > 0 && (
        <GameRail
          title={
            <>
              <Shapes className="w-5 h-5 text-accent" /> Game tương tự
            </>
          }
          games={similarOnly}
        />
      )}
    </div>
  );
}
