import { Link } from "react-router-dom";
import type { GameListItem } from "../../types/game";
import { formatPrice } from "../../lib/utils";
import Badge from "../shared/Badge";

interface Props {
  games: GameListItem[];
}

function HorizontalGameCard({ game }: { game: GameListItem }) {
  const discount =
    game.originalPrice > 0
      ? Math.round((1 - game.salePrice / game.originalPrice) * 100)
      : 0;

  return (
    <Link
      to={`/games/${game.id}`}
      className="flex items-center gap-3 p-2 hover:bg-bg-surface-hover transition-all duration-300 cursor-pointer group border border-transparent hover:border-white/5"
    >
      <img
        src={game.coverImageUrl || ""}
        alt={game.name}
        className="w-[72px] h-[72px] object-cover flex-shrink-0 group-hover:brightness-110 group-hover:scale-105 transition-all duration-300 shadow-md"
        loading="lazy"
      />
      <div className="min-w-0 flex-1">
        <h3 className="font-body font-semibold text-sm text-text-primary truncate leading-tight group-hover:text-accent transition-colors">
          {game.name}
        </h3>
        <div className="flex items-center gap-2 mt-1.5">
          {discount > 0 && <Badge variant="discount">-{discount}%</Badge>}
          {game.status === "Preorder" && (
            <Badge variant="preorder">Sắp ra mắt</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          {game.originalPrice > 0 && game.salePrice < game.originalPrice && (
            <span className="text-text-muted text-xs line-through">
              {formatPrice(game.originalPrice)}
            </span>
          )}
          <span className="text-accent font-semibold text-sm">
            {game.salePrice > 0 ? formatPrice(game.salePrice) : "Miễn phí"}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function DiscoverySection({ games }: Props) {
  if (games.length === 0) return null;

  // Split games into 3 columns
  const perCol = Math.ceil(games.length / 3);

  const cols: GameListItem[][] = [];
  for (let i = 0; i < 3; i++) {
    cols.push(games.slice(i * perCol, i * perCol + perCol));
  }

  return (
    <section className="py-8 md:py-12 bg-bg-base relative z-10">
      <div className="max-w-[1400px] mx-auto px-4">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-text-primary mb-8 flex items-center gap-3">
          Khám Phá Nội Dung Mới
          <span className="text-xs text-accent font-body font-bold bg-accent/10 border border-accent/20 px-2 py-0.5 uppercase tracking-wider">
            Nổi Bật
          </span>
        </h2>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* ── Left: Feature Card ── */}
          <Link
            to="/games"
            className="relative w-full lg:w-[320px] min-h-[300px] overflow-hidden group flex-shrink-0 cursor-pointer flex shadow-xl border border-white/5"
          >
            <img
              src={
                games[0]?.coverImageUrl ||
                "https://picsum.photos/seed/discovery/560/920"
              }
              alt="Khám Phá Nội Dung Mới"
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-all duration-700 ease-out"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 z-10">
              <span className="inline-block px-2 py-1 bg-white/10 backdrop-blur-md border border-white/20 text-white/90 text-[10px] font-bold uppercase tracking-wider mb-3">
                Tuyển Tập
              </span>
              <h3 className="font-display text-2xl font-bold text-white mb-2 drop-shadow-md group-hover:text-accent transition-colors">
                Khám Phá Nội Dung Mới
              </h3>
              <p className="text-white/70 text-sm font-medium">
                Game Xbox mới nhất với giá ưu đãi
              </p>
            </div>
          </Link>

          {/* ── Right: 3-Column Grid ── */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
            {cols.map((colGames, colIdx) => (
              <div key={colIdx} className="space-y-2">
                {colGames.map((g) => (
                  <HorizontalGameCard key={g.id} game={g} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
