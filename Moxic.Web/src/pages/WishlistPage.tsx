import { Link } from "react-router-dom";
import { BellRing, Heart, ShoppingCart, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { setPriceAlerts } from "../lib/api";
import toast from "react-hot-toast";
import Container from "../components/layout/Container";
import GameCard from "../components/games/GameCard";
import RecentlyViewed from "../components/games/RecentlyViewed";
import { SectionLoader } from "../components/shared/MoxicLoader";
import { useToggleWishlist, useWishlistGames, useWishlistIds } from "../hooks/useWishlist";
import { useCartStore } from "../lib/cartStore";
import { formatPrice } from "../lib/utils";

export default function WishlistPage() {
  const { games, isLoading, priceAlerts } = useWishlistGames();
  const { loggedIn } = useWishlistIds();
  const qc = useQueryClient();
  const toggleAlerts = useMutation({
    mutationFn: (enabled: boolean) => setPriceAlerts(enabled),
    onSuccess: (_d, enabled) => {
      toast.success(enabled ? "Sẽ báo qua email khi game yêu thích giảm giá" : "Đã tắt thông báo giảm giá");
      qc.invalidateQueries({ queryKey: ["wishlist"] });
    },
    onError: () => toast.error("Không cập nhật được"),
  });
  const toggle = useToggleWishlist();
  const addItem = useCartStore((s) => s.addItem);
  const cartItems = useCartStore((s) => s.items);

  const total = games.reduce((sum, g) => sum + g.salePrice, 0);
  const saved = games.reduce((sum, g) => sum + Math.max(0, g.originalPrice - g.salePrice), 0);
  const notInCart = games.filter((g) => !cartItems.some((c) => c.gameId === g.id));

  const addAll = () => {
    notInCart.forEach((g) =>
      addItem({
        gameId: g.id,
        name: g.name,
        price: g.salePrice,
        originalPrice: g.originalPrice,
        coverImageUrl: g.coverImageUrl ?? "",
        status: g.status,
        quantity: 1,
      }),
    );
    toast.success(`Đã thêm ${notInCart.length} game vào giỏ hàng`);
  };

  return (
    <Container className="mt-8 mb-20 space-y-14">
      <div>
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-2xl md:text-4xl font-bold flex items-center gap-3">
              <Heart className="w-7 h-7 text-negative fill-negative" /> Yêu thích
            </h1>
            <p className="text-sm text-text-muted mt-1">
              {games.length > 0 ? `${games.length} game đang chờ bạn` : "Lưu những game bạn muốn mua để không bỏ lỡ ưu đãi"}
              {!loggedIn && games.length > 0 && (
                <>
                  {" · "}
                  <Link to="/login?redirect=/wishlist" className="text-accent hover:underline">
                    Đăng nhập
                  </Link>{" "}
                  để lưu trên mọi thiết bị và nhận báo giảm giá
                </>
              )}
            </p>
            {loggedIn && (
              <label className="mt-3 inline-flex items-center gap-2 text-sm text-text-secondary cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={priceAlerts}
                  disabled={toggleAlerts.isPending}
                  onChange={(e) => toggleAlerts.mutate(e.target.checked)}
                />
                <span className="relative shrink-0 w-9 h-5 bg-white/10 transition-colors peer-checked:bg-negative after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:bg-white after:transition-transform peer-checked:after:translate-x-4" />
                <BellRing className="w-4 h-4 text-negative" /> Email cho tôi khi game yêu thích giảm giá
              </label>
            )}
          </div>
          {games.length > 0 && (
            <div className="flex items-center gap-4 bg-bg-surface border border-white/10 px-4 py-3">
              <div className="text-right">
                <p className="text-[11px] text-text-muted">Tổng</p>
                <p className="font-bold text-lg">{formatPrice(total)}</p>
                {saved > 0 && <p className="text-[11px] text-positive">Tiết kiệm {formatPrice(saved)}</p>}
              </div>
              <button
                type="button"
                onClick={addAll}
                disabled={notInCart.length === 0}
                className="h-11 px-4 inline-flex items-center gap-2 bg-accent text-bg-base text-sm font-bold disabled:opacity-40 cursor-pointer disabled:cursor-default"
              >
                <ShoppingCart className="w-4 h-4" /> {notInCart.length === 0 ? "Đã có trong giỏ" : "Thêm tất cả vào giỏ"}
              </button>
            </div>
          )}
        </div>

        {isLoading ? (
          <SectionLoader />
        ) : games.length === 0 ? (
          <div className="text-center py-20 px-6 bg-black/40 border border-white/5">
            <div className="relative w-20 h-20 mx-auto mb-5">
              <Heart className="absolute inset-0 w-20 h-20 text-negative/20" />
              <Heart className="absolute inset-4 w-12 h-12 text-negative animate-pulse motion-reduce:animate-none" />
            </div>
            <p className="font-semibold mb-1">Danh sách yêu thích đang trống</p>
            <p className="text-sm text-text-muted mb-6">Nhấn biểu tượng ♥ trên game bất kỳ để lưu lại.</p>
            <Link to="/games" className="inline-flex h-11 items-center px-6 bg-accent text-bg-base text-sm font-bold">
              Khám phá cửa hàng
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-5">
            {games.map((g) => (
              <div key={g.id} className="relative group/item">
                <GameCard game={g} variant="vertical" />
                <button
                  type="button"
                  onClick={() => toggle(g.id)}
                  className="mt-1 w-full h-8 inline-flex items-center justify-center gap-1.5 text-xs text-text-muted hover:text-negative border border-transparent hover:border-negative/30 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Bỏ khỏi yêu thích
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <RecentlyViewed />
    </Container>
  );
}
