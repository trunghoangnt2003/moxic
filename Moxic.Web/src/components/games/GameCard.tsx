import { Link } from "react-router-dom";
import type { GameListItem } from "../../types/game";
import Badge from "../shared/Badge";
import { formatPrice } from "../../lib/utils";
import { useState } from "react";
import { Flame, Gamepad2, KeyRound } from "lucide-react";
import WishlistButton from "./WishlistButton";
import { PRODUCT_TYPE_LABELS, PRODUCT_TYPE_STYLES } from "../../lib/productTypes";
import { SaleCountdownBadge } from "./FlashSale";

/** Cover image with a branded placeholder when the URL is missing or fails to load. */
function Cover({ src, name, className }: { src?: string; name: string; className: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-3 text-center bg-gradient-to-br from-bg-elevated via-bg-surface to-black">
        <Gamepad2 className="w-8 h-8 text-accent/40" />
        <span className="font-display text-xs sm:text-sm font-bold text-text-secondary line-clamp-3">{name}</span>
      </div>
    );
  }
  return <img src={src} alt={name} className={className} loading="lazy" onError={() => setFailed(true)} />;
}

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
    : (game.editionCount ?? 0) > 1
      ? `Từ ${formatPrice(game.salePrice)}`
      : formatPrice(game.salePrice);
  const type = game.productType ?? "Game";

  const priceClass = isFree
    ? "text-success font-semibold text-sm"
    : "text-accent font-semibold text-sm";

  if (variant === "vertical") {
    return (
      <Link
        to={"/games/" + game.id}
        className="group bg-bg-surface border border-border overflow-hidden cursor-pointer hover:bg-bg-surface-hover transition-all duration-300"
      >
        <div className="relative aspect-[3/4] overflow-hidden bg-bg-elevated">
          <Cover src={game.coverImageUrl} name={game.name} className="w-full h-full object-cover group-hover:scale-105 group-hover:brightness-110 transition-all duration-300" />
          <WishlistButton gameId={game.id} gameName={game.name} className="absolute top-2 right-2" />
          {(game.soldCount ?? 0) >= 5 && (
            <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-orange-500/90 text-white">
              <Flame className="w-3 h-3" /> Bán chạy
            </span>
          )}
          {game.saleEndsAt && <SaleCountdownBadge endsAt={game.saleEndsAt} className="absolute bottom-2 right-2" />}
          {(type !== "Game" || game.region) && (
            <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
              {type !== "Game" && (
                <span className={`px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${PRODUCT_TYPE_STYLES[type]}`}>
                  {PRODUCT_TYPE_LABELS[type]}
                </span>
              )}
              {game.region && game.region !== "Global" && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-black/70 text-white border border-white/20 backdrop-blur-sm">
                  {game.region}
                </span>
              )}
            </div>
          )}
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
          {game.rentFrom != null && (
            <p className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
              <KeyRound className="w-3 h-3" /> Thuê từ {formatPrice(game.rentFrom)}
            </p>
          )}
          {(game.soldCount ?? 0) > 0 && (
            <p className="text-[11px] text-text-muted">Đã bán {game.soldCount!.toLocaleString("vi-VN")}</p>
          )}
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={"/games/" + game.id}
      className="flex items-center gap-3 p-2 hover:bg-bg-surface-hover transition-all duration-300 cursor-pointer"
    >
      <div className="w-20 h-20 flex-shrink-0 overflow-hidden bg-bg-elevated">
        <Cover src={game.coverImageUrl} name={game.name} className="w-full h-full object-cover" />
      </div>
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
