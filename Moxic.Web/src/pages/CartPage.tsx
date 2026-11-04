import { Link, useNavigate } from "react-router-dom";
import CheckoutSteps from "../components/checkout/CheckoutSteps";
import SavedCallout from "../components/shared/SavedCallout";
import Container from "../components/layout/Container";
import { useCartStore } from "../lib/cartStore";
import { formatPrice } from "../lib/utils";
import { Trash2, ShoppingCart, ArrowLeft, Plus, Minus } from "lucide-react";

export default function CartPage() {
  const items = useCartStore((s) => s.items)
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const navigate = useNavigate();

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const originalTotal = items.reduce(
    (sum, item) => sum + (item.originalPrice || item.price) * item.quantity,
    0
  );
  const saved = originalTotal - total;

  return (
    <div className="min-h-screen bg-bg-base py-8 md:py-12">
      <Container>
        <div className="max-w-5xl mx-auto">
          {items.length > 0 && <CheckoutSteps current={0} />}

          <h1 className="font-display text-2xl md:text-3xl font-bold text-text-primary mb-6">
            Giỏ hàng <span className="text-text-muted font-normal text-xl">({items.length})</span>
          </h1>

          {items.length === 0 ? (
            <div className="bg-bg-surface border border-white/10 p-16 text-center">
              <ShoppingCart className="w-16 h-16 text-white/10 mx-auto mb-4" />
              <p className="text-text-secondary text-lg mb-2">Giỏ hàng trống</p>
              <p className="text-text-muted text-sm mb-6">Bạn chưa thêm game nào vào giỏ hàng.</p>
              <Link
                to="/games"
                className="inline-block bg-accent hover:bg-accent-hover text-bg-base px-8 py-3 font-semibold text-sm transition-colors cursor-pointer"
              >
                Khám phá cửa hàng
              </Link>
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Left: Items */}
              <div className="flex-1 space-y-3">
                {items.map((item) => (
                  <div
                    key={item.gameId}
                    className="grid grid-cols-[auto_1fr] lg:flex lg:items-center gap-x-3 gap-y-2 lg:gap-4 bg-bg-surface border border-white/10 p-3 lg:p-4 hover:border-accent/30 transition-colors"
                  >
                    {/* Cover - spans 2 rows on mobile */}
                    <Link to={`/games/${item.gameId}`} className="flex-shrink-0 row-span-2 lg:row-span-1 self-start lg:self-auto">
                      <img loading="lazy" decoding="async"
                        src={item.coverImageUrl}
                        alt={item.name}
                        className="w-[120px] h-[45px] lg:w-[184px] lg:h-[69px] object-cover"
                      />
                    </Link>

                    {/* Name + status */}
                    <div className="min-w-0 self-center">
                      <Link
                        to={`/games/${item.gameId}`}
                        className="text-text-primary hover:text-accent font-semibold block truncate transition-colors text-sm lg:text-base"
                      >
                        {item.name}
                      </Link>
                      <p className="text-xs text-text-muted mt-0.5">
                        {item.status === "Preorder" ? "Đặt trước" : "Game kỹ thuật số"}
                      </p>
                    </div>

                    {/* Price + quantity + delete - full width row on mobile */}
                    <div className="col-span-2 lg:col-span-1 flex items-center justify-between lg:justify-end lg:gap-4">
                      <div className="lg:text-right">
                        {item.originalPrice > item.price && (
                          <p className="text-xs text-text-muted line-through leading-tight">
                            {formatPrice(item.originalPrice)}
                          </p>
                        )}
                        <p className="text-text-primary font-bold text-sm lg:text-base">{formatPrice(item.price)}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center rounded bg-bg-base">
                          <button
                            onClick={() => updateQuantity(item.gameId, item.quantity - 1)}
                            className="min-w-[44px] min-h-[44px] lg:min-w-0 lg:min-h-0 lg:w-7 lg:h-7 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/10 transition-colors cursor-pointer rounded-l"
                            aria-label="Giảm số lượng"
                          >
                            <Minus className="w-4 h-4 lg:w-3.5 lg:h-3.5" />
                          </button>
                          <span className="text-sm text-text-primary font-semibold min-w-[28px] lg:min-w-0 lg:w-6 text-center select-none">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.gameId, item.quantity + 1)}
                            className="min-w-[44px] min-h-[44px] lg:min-w-0 lg:min-h-0 lg:w-7 lg:h-7 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/10 transition-colors cursor-pointer rounded-r"
                            aria-label="Tăng số lượng"
                          >
                            <Plus className="w-4 h-4 lg:w-3.5 lg:h-3.5" />
                          </button>
                        </div>

                        <button
                          onClick={() => removeItem(item.gameId)}
                          className="text-text-muted hover:text-negative transition-colors cursor-pointer min-w-[44px] min-h-[44px] lg:min-w-0 lg:min-h-0 flex items-center justify-center rounded hover:bg-white/5 lg:hover:bg-transparent"
                          aria-label={`Xóa ${item.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Actions */}
                <div className="flex justify-between items-center pt-2">
                  <button
                    onClick={clearCart}
                    className="text-sm text-text-muted hover:text-negative transition-colors cursor-pointer flex items-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Xóa tất cả
                  </button>
                  <Link
                    to="/games"
                    className="text-sm text-accent hover:text-accent-hover transition-colors flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Tiếp tục mua sắm
                  </Link>
                </div>
              </div>

              {/* Right: Summary */}
              <div className="w-full lg:w-[340px] flex-shrink-0">
                <div className="bg-bg-surface border border-white/10 p-6 sticky top-20">
                  <h3 className="text-xs text-text-muted font-semibold mb-4 pb-3 border-b border-white/10">
                    Tóm tắt đơn hàng
                  </h3>

                  <div className="space-y-2 mb-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Tạm tính ({items.length} game)</span>
                      <span className="text-text-primary">{formatPrice(originalTotal)}</span>
                    </div>
                    {saved > 0 && (
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Giảm giá</span>
                        <span className="text-positive">-{formatPrice(saved)}</span>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-white/10 pt-4 mb-6">
                    <div className="flex justify-between items-baseline">
                      <span className="text-text-secondary text-sm font-semibold">Tổng cộng</span>
                      <span className="font-display text-2xl text-accent font-bold">{formatPrice(total)}</span>
                    </div>
                    {saved > 0 && (
                      <div className="mt-3">
                        <SavedCallout amount={saved} compact />
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => navigate("/checkout")}
                    className="w-full bg-accent hover:bg-accent-hover text-bg-base py-3.5 font-bold text-sm transition-colors cursor-pointer"
                  >
                    Tiến hành thanh toán
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}

