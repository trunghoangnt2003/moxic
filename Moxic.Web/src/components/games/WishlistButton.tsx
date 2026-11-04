import { Heart } from "lucide-react";
import { useToggleWishlist, useWishlistIds } from "../../hooks/useWishlist";

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
          active ? "border-rose-500/60 bg-rose-500/10 text-rose-300" : "border-white/15 text-text-secondary hover:text-white hover:border-white/30"
        } ${className}`}
      >
        <Heart className={`w-4 h-4 transition-transform ${active ? "fill-rose-500 text-rose-500 scale-110" : ""}`} />
        {active ? "Đã yêu thích" : "Yêu thích"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={active ? "Bỏ khỏi Yêu thích" : "Thêm vào Yêu thích"}
      title={active ? "Bỏ khỏi Yêu thích" : "Thêm vào Yêu thích"}
      className={`w-9 h-9 flex items-center justify-center rounded-full backdrop-blur-md border transition-all cursor-pointer ${
        active
          ? "bg-rose-500/90 border-rose-400 text-white opacity-100"
          : "bg-black/50 border-white/20 text-white hover:bg-black/75 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
      } ${className}`}
    >
      <Heart className={`w-4 h-4 ${active ? "fill-white animate-[heartPop_0.35s_ease-out]" : ""}`} />
    </button>
  );
}
