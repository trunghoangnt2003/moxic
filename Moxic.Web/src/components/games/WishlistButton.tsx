import { Heart } from "lucide-react";
import { useToggleWishlist, useWishlistIds } from "../../hooks/useWishlist";

import { t } from "../../lib/i18n";
interface Props {
  gameId: string;
  gameName?: string;
  /** "overlay": round icon on a card image. "full": labelled button for the detail page. */
  variant?: "overlay" | "full";
  className?: string;
}

export default function WishlistButton({ gameId, gameName, variant = "overlay", className = "" }: Props) {
  const { ids } = useWishlistIds();
  const toggle = useToggleWishlist();
  const active = ids.includes(gameId);

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggle(gameId, gameName);
  };

  if (variant === "full") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={`inline-flex items-center justify-center gap-2 h-12 px-4 border text-sm font-semibold transition-colors cursor-pointer ${
          active ? "border-negative/60 bg-negative/10 text-negative" : "border-white/15 text-text-secondary hover:text-white hover:border-white/30"
        } ${className}`}
      >
        <Heart className={`w-4 h-4 transition-transform ${active ? "fill-negative text-negative scale-110" : ""}`} />
        {active ? t("Đã yêu thích") : t("Yêu thích")}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={active ? t("Bỏ khỏi Yêu thích") : t("Thêm vào Yêu thích")}
      title={active ? t("Bỏ khỏi Yêu thích") : t("Thêm vào Yêu thích")}
      className={`w-9 h-9 flex items-center justify-center rounded-full backdrop-blur-md border transition cursor-pointer ${
        active
          ? "bg-negative/90 border-negative text-on-solid opacity-100"
          : "bg-black/50 border-white/20 text-white hover:bg-black/75 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
      } ${className}`}
    >
      <Heart className={`w-4 h-4 ${active ? "fill-white animate-[heartPop_0.35s_ease-out]" : ""}`} />
    </button>
  );
}
