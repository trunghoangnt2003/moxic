import { Link } from "react-router-dom";
import type { GameListItem } from "../../types/game";
import Badge from "../shared/Badge";
import { formatPrice } from "../../lib/utils";

interface Props {
  game: GameListItem;
  variant?: "horizontal" | "vertical";
}

export default function GameCard({ game, variant = "horizontal" }: Props) {
  const isPreorder = game.status === "Preorder";
  const isFree = game.salePrice === 0 && !isPreorder;
  const discount =
    game.originalPrice > 0 && game.salePrice > 0
      ? Math.round((1 - game.salePrice / game.originalPrice) * 100)
      : 0;

  const priceDisplay = isFree
    ? "Miễn phí"
    : formatPrice(game.salePrice);

  const priceClass = isFree
    ? "text-success font-semibold text-sm"
    : "text-accent font-semibold text-sm";

  if (variant === "vertical") {
    return (
      <Link
        to={"/games/" + game.id}
        className="group bg-bg-surface border border-border overflow-hidden cursor-pointer hover:bg-bg-surface-hover transition-all duration-300"
      >
        <div className="aspect-[3/4] overflow-hidden">
          <img
            src={game.coverImageUrl || ""}
            alt={game.name}
            className="w-full h-full object-cover group-hover:scale-105 group-hover:brightness-110 transition-all duration-300"
            loading="lazy"
          />
        </div>
        <div className="p-3 space-y-1">
          <h3 className="font-body font-semibold text-sm text-text-primary truncate">
            {game.name}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            {discount > 0 && <Badge variant="discount">-{discount}%</Badge>}
            {isPreorder && <Badge variant="preorder">Sắp ra mắt</Badge>}
            {isFree && <Badge variant="available">Miễn phí</Badge>}
          </div>
          <div className="flex items-center gap-2">
            {game.originalPrice > 0 && game.salePrice > 0 && (
              <span className="text-text-muted text-xs line-through">
                {formatPrice(game.originalPrice)}
              </span>
            )}
            <span className={priceClass}>{priceDisplay}</span>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={"/games/" + game.id}
      className="flex items-center gap-3 p-2 hover:bg-bg-surface-hover transition-all duration-300 cursor-pointer"
    >
      <img
        src={game.coverImageUrl || ""}
        alt={game.name}
        className="w-20 h-20 object-cover flex-shrink-0"
        loading="lazy"
      />
      <div className="min-w-0">
        <h3 className="font-body font-semibold text-sm text-text-primary truncate">
          {game.name}
        </h3>
        <div className="flex items-center gap-2 mt-1">
          {game.originalPrice > 0 && game.salePrice > 0 && (
            <span className="text-text-muted text-xs line-through">
              {formatPrice(game.originalPrice)}
            </span>
          )}
          <span className={priceClass}>{priceDisplay}</span>
        </div>
        {discount > 0 && <Badge variant="discount">-{discount}%</Badge>}
        {isPreorder && <Badge variant="preorder">Sắp ra mắt</Badge>}
      </div>
    </Link>
  );
}
