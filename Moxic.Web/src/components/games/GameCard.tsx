import { Link } from "react-router-dom";
import type { GameListItem } from "../../types/game";
import Badge from "../shared/Badge";
import { formatPrice } from "../../lib/utils";

interface Props {
  game: GameListItem;
  variant?: "horizontal" | "vertical";
}

export default function GameCard({ game, variant = "horizontal" }: Props) {
  const discount = game.originalPrice > 0
    ? Math.round((1 - game.salePrice / game.originalPrice) * 100)
    : 0;

  if (variant === "vertical") {
    return (
      <Link to={"/games/" + game.id} className="group bg-bg-surface rounded-sm border border-border overflow-hidden cursor-pointer hover:bg-bg-surface-hover transition-all duration-300">
        <div className="aspect-[3/4] overflow-hidden">
          <img
            src={game.coverImageUrl || ""}
            alt={game.name}
            className="w-full h-full object-cover group-hover:scale-105 group-hover:brightness-110 transition-all duration-300"
            loading="lazy"
          />
        </div>
        <div className="p-3 space-y-1">
          <h3 className="font-body font-semibold text-sm text-text-primary truncate">{game.name}</h3>
          <div className="flex items-center gap-2">
            {discount > 0 && <Badge variant="discount">-{discount}%</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text-muted text-xs line-through">{formatPrice(game.originalPrice)}</span>
            <span className="text-accent font-semibold text-sm">{formatPrice(game.salePrice)}</span>
          </div>
          {game.status === "Preorder" && <Badge variant="preorder">Sắp ra mắt</Badge>}
        </div>
      </Link>
    );
  }

  return (
    <Link to={"/games/" + game.id} className="flex items-center gap-3 p-2 rounded-sm hover:bg-bg-surface-hover transition-all duration-300 cursor-pointer">
      <img
        src={game.coverImageUrl || ""}
        alt={game.name}
        className="w-20 h-20 object-cover rounded-sm flex-shrink-0"
        loading="lazy"
      />
      <div className="min-w-0">
        <h3 className="font-body font-semibold text-sm text-text-primary truncate">{game.name}</h3>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-text-muted text-xs line-through">{formatPrice(game.originalPrice)}</span>
          <span className="text-accent font-semibold text-sm">{formatPrice(game.salePrice)}</span>
        </div>
        {discount > 0 && <Badge variant="discount">-{discount}%</Badge>}
      </div>
    </Link>
  );
}
