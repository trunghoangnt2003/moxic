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
  /** Position in a ranked rail (1, 2, 3…), drawn on the cover. */
  rank?: number;
}

export default function GameCard({ game, variant = "horizontal", rank }: Props) {
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
    const hot = (game.soldCount ?? 0) >= 5;
    return (
      <Link to={"/games/" + game.id} className="group block cursor-pointer">
        <div className="relative aspect-[3/4] overflow-hidden rounded-md bg-bg-elevated">
          <Cover
            src={game.coverImageUrl}
            name={game.name}
            className="w-full h-full object-cover transition duration-500 ease-out group-hover:scale-[1.04] group-hover:brightness-110"
          />
          {/* Hover sheen, the way a store shelf catches light */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <WishlistButton gameId={game.id} gameName={game.name} className="absolute top-2 right-2" />
          {rank != null ? (
            <span className="absolute top-2 left-2 min-w-8 h-8 px-2 flex items-center justify-center rounded-sm bg-accent text-on-accent font-display font-extrabold text-base num shadow-lg shadow-black/40">
              {rank}
            </span>
          ) : (
            hot && (
              <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-1 rounded-sm text-xs font-bold bg-bg-base/85 text-caution">
                <Flame className="w-3.5 h-3.5" /> Bán chạy
              </span>
            )
          )}
          {game.saleEndsAt && <SaleCountdownBadge endsAt={game.saleEndsAt} className="absolute bottom-2 right-2" />}
          {(type !== "Game" || (game.region && game.region !== "Global") || isPreorder) && (
            <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
              {isPreorder && <span className="px-2 py-0.5 rounded-sm text-xs font-bold bg-preorder text-on-solid">Sắp ra mắt</span>}
              {type !== "Game" && (
                <span className={`px-2 py-0.5 rounded-sm text-xs font-bold ${PRODUCT_TYPE_STYLES[type]}`}>{PRODUCT_TYPE_LABELS[type]}</span>
              )}
              {game.region && game.region !== "Global" && (
                <span className="px-2 py-0.5 rounded-sm text-xs font-bold bg-bg-base/85 text-white">{game.region}</span>
              )}
            </div>
          )}
        </div>

        <div className="pt-3">
          <h3 className="font-semibold text-[15px] leading-snug text-text-primary line-clamp-2 min-h-[2.6em] group-hover:text-accent transition-colors">
            {game.name}
          </h3>
          <div className="mt-2 flex items-center gap-x-2 gap-y-1 flex-wrap">
            {discount > 0 && <span className="px-1.5 py-0.5 rounded-sm text-xs font-bold bg-discount text-on-solid num">-{discount}%</span>}
            <span className={`${isFree ? "text-success" : "text-text-primary"} font-bold text-[15px] num whitespace-nowrap`}>{priceDisplay}</span>
            {game.originalPrice > 0 && game.salePrice > 0 && discount > 0 && (
              <span className="text-text-muted text-xs line-through num whitespace-nowrap">{formatPrice(game.originalPrice)}</span>
            )}
          </div>
          {(game.rentFrom != null || (game.soldCount ?? 0) > 0) && (
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-text-muted">
              {game.rentFrom != null && (
                <span className="inline-flex items-center gap-1 font-semibold text-positive">
                  <KeyRound className="w-3 h-3" /> Thuê từ {formatPrice(game.rentFrom)}
                </span>
              )}
              {(game.soldCount ?? 0) > 0 && <span>Đã bán {game.soldCount!.toLocaleString("vi-VN")}</span>}
            </p>
          )}
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={"/games/" + game.id}
      className="flex items-center gap-3 p-2 hover:bg-bg-surface-hover transition duration-300 cursor-pointer"
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
