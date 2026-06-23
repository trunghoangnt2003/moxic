import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import type { GameListItem } from "../../types/game";
import { formatPrice } from "../../lib/utils";

interface Props {
  games: GameListItem[];
}

export default function HeroCarousel({ games }: Props) {
  const [active, setActive] = useState(0);

  const next = useCallback(() => {
    setActive((prev) => (prev + 1) % games.length);
  }, [games.length]);

  useEffect(() => {
    if (games.length < 2) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [games.length, next]);

  if (games.length === 0) return null;

  const game = games[active];

  return (
    <div className="w-full bg-bg-surface">
      <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row">
        {/* Main Banner */}
        <div className="relative w-full md:w-[75%] h-[400px] md:h-[480px] overflow-hidden">
          <img
            src={game.coverImageUrl || "/placeholder.svg"}
            alt={game.name}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-8">
            <h1 className="font-display text-3xl md:text-4xl text-text-primary mb-2">{game.name}</h1>
            <p className="text-text-secondary text-sm mb-4 line-clamp-2">{game.genre} — {formatPrice(game.salePrice)}</p>
            <Link
              to={`/games/${game.id}`}
              className="inline-block bg-white hover:bg-gray-100 text-black px-8 py-3 rounded-md font-semibold text-sm transition-all duration-300"
            >
              Tiết kiệm ngay
            </Link>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-full md:w-[25%] bg-bg-surface p-2 space-y-1 max-h-[480px] overflow-y-auto">
          {games.map((g, i) => (
            <button
              key={g.id}
              onClick={() => setActive(i)}
              className={`w-full flex items-center gap-3 p-3 rounded-sm text-left transition-all duration-200 cursor-pointer ${
                i === active ? "bg-white/10" : "opacity-70 hover:opacity-100 hover:bg-white/5"
              }`}
            >
              <img
                src={g.coverImageUrl || "/placeholder.svg"}
                alt={g.name}
                className="w-12 h-12 object-cover rounded-sm flex-shrink-0"
              />
              <div className="min-w-0">
                <p className={`text-sm truncate ${i === active ? "text-text-primary font-semibold" : "text-text-secondary"}`}>
                  {g.name}
                </p>
                <p className="text-xs text-text-muted">{formatPrice(g.salePrice)}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
