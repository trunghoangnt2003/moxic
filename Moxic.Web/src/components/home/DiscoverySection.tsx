import { useState } from "react";
import { Link } from "react-router-dom";
import { Gamepad2 } from "lucide-react";
import type { GameListItem } from "../../types/game";
import { formatPrice } from "../../lib/utils";
import Badge from "../shared/Badge";

interface Props {
  games: GameListItem[];
}

function HorizontalGameCard({ game }: { game: GameListItem }) {
  const [broken, setBroken] = useState(false);
  const discount =
    game.originalPrice > 0 && game.salePrice > 0
      ? Math.round((1 - game.salePrice / game.originalPrice) * 100)
      : 0;

  return (
    <Link
      to={`/games/${game.id}`}
      className="flex items-center gap-3 p-2 rounded-md hover:bg-white/5 transition-colors cursor-pointer group"
    >
      <div className="w-[60px] aspect-[3/4] shrink-0 overflow-hidden rounded-sm bg-bg-elevated flex items-center justify-center">
        {game.coverImageUrl && !broken ? (
          <img
            src={game.coverImageUrl}
            alt=""
            onError={() => setBroken(true)}
            className="w-full h-full object-cover group-hover:brightness-110 transition duration-300"
            loading="lazy"
          />
        ) : (
          <Gamepad2 className="w-5 h-5 text-text-muted" />
        )}
      </div>
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
          <span className="text-text-primary font-bold text-sm num">
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
    <section>
      <div>
        <h2 className="font-display text-xl md:text-2xl font-bold text-text-primary mb-5">Mới lên kệ</h2>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* ── Left: Feature Card ── */}
          <Link
            to="/games"
            className="relative w-full lg:w-[300px] min-h-[280px] overflow-hidden rounded-md group shrink-0 cursor-pointer flex"
          >
            <img loading="lazy" decoding="async"
              src={games[0]?.coverImageUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-700 ease-out"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 z-10">
              <h3 className="font-display text-2xl font-bold text-white mb-2 drop-shadow-md group-hover:text-accent transition-colors">
                Xem cả cửa hàng
              </h3>
              <p className="text-white/70 text-sm font-medium">
                Game Xbox mới nhất với giá ưu đãi
              </p>
            </div>
          </Link>

          {/* ── Right: 3-Column Grid ── */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1">
            {cols.map((colGames, colIdx) => (
              <div key={colIdx} className="space-y-1">
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
