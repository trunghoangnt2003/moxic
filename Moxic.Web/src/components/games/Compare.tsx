import { Link, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { Columns3, X } from "lucide-react";
import { compareList } from "../../lib/localIds";
import { useGames } from "../../hooks/useGames";

const MAX = 3;

export function toggleCompare(id: string, name?: string) {
  const ids = compareList.get();
  if (ids.includes(id)) {
    compareList.remove(id);
    return;
  }
  if (ids.length >= MAX) {
    toast.error(`Chỉ so sánh tối đa ${MAX} game, bỏ bớt một game trước nhé`);
    return;
  }
  compareList.set([...ids, id]);
  toast.success(name ? `Đã thêm “${name}” vào so sánh` : "Đã thêm vào so sánh");
}

/** Labelled toggle for the game page. */
export function CompareButton({ gameId, gameName, className = "" }: { gameId: string; gameName: string; className?: string }) {
  const ids = compareList.useIds();
  const active = ids.includes(gameId);
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => toggleCompare(gameId, gameName)}
      className={`inline-flex items-center justify-center gap-2 h-10 px-4 border text-sm font-semibold transition-colors cursor-pointer ${
        active ? "border-info/60 bg-info/10 text-info" : "border-white/15 text-text-secondary hover:text-white hover:border-white/30"
      } ${className}`}
    >
      <Columns3 className="w-4 h-4" /> {active ? "Đang so sánh" : "So sánh"}
    </button>
  );
}

/** Floating tray listing picked games, with a jump to /compare. */
export function CompareBar() {
  const ids = compareList.useIds();
  const { pathname } = useLocation();
  const { data } = useGames({ ids, pageSize: MAX }, { enabled: ids.length > 0 });
  if (ids.length === 0 || pathname.startsWith("/compare") || pathname.startsWith("/checkout")) return null;
  const games = ids.map((id) => data?.items.find((g) => g.id === id)).filter(Boolean);

  return (
    <div className="fixed bottom-[calc(0.75rem+var(--sab))] left-1/2 -translate-x-1/2 z-40 w-[calc(100vw-1.5rem)] max-w-md">
      <div className="flex items-center gap-2 p-2 bg-bg-surface/95 backdrop-blur-md border border-info/30 shadow-2xl shadow-black/60">
        <div className="flex gap-1.5 flex-1 min-w-0">
          {Array.from({ length: MAX }).map((_, i) => {
            const g = games[i];
            return g ? (
              <div key={g.id} className="relative w-10 h-12 shrink-0 bg-bg-elevated overflow-hidden" title={g.name}>
                {g.coverImageUrl && <img loading="lazy" decoding="async" src={g.coverImageUrl} alt="" className="w-full h-full object-cover" />}
                <button
                  type="button"
                  onClick={() => compareList.remove(g.id)}
                  aria-label={`Bỏ ${g.name}`}
                  className="absolute top-0 right-0 w-4 h-4 flex items-center justify-center bg-black/80 text-white cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div key={i} className="w-10 h-12 shrink-0 border border-dashed border-white/15" />
            );
          })}
        </div>
        <Link
          to={`/compare?ids=${ids.join(",")}`}
          className={`h-10 px-4 inline-flex items-center gap-1.5 text-sm font-bold ${ids.length >= 2 ? "bg-info text-bg-base" : "bg-white/10 text-text-muted pointer-events-none"}`}
        >
          <Columns3 className="w-4 h-4" /> So sánh {ids.length}/{MAX}
        </Link>
        <button type="button" onClick={() => compareList.clear()} aria-label="Xóa danh sách so sánh" className="p-2 text-text-muted hover:text-white cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
