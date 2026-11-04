import { Link, useNavigate } from "react-router-dom";
import CheckoutSteps from "../components/checkout/CheckoutSteps";
import SavedCallout from "../components/shared/SavedCallout";
import Container from "../components/layout/Container";
import { useCartStore } from "../lib/cartStore";
import { formatPrice } from "../lib/utils";
import { Trash2, ShoppingCart, ArrowLeft, Plus, Minus, ShieldCheck, Zap } from "lucide-react";

export default function CartPage() {
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const navigate = useNavigate();

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const originalTotal = items.reduce((sum, item) => sum + (item.originalPrice || item.price) * item.quantity, 0);
  const saved = originalTotal - total;
  const count = items.reduce((n, i) => n + i.quantity, 0);

  if (items.length === 0) {
    return (
      <Container className="py-16 md:py-24">
        <div className="max-w-md mx-auto text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-bg-surface border border-white/10 flex items-center justify-center">
            <ShoppingCart className="w-9 h-9 text-text-muted" />
          </div>
          <h1 className="mt-6 font-display text-3xl font-bold text-text-primary">Giỏ hàng đang trống</h1>
          <p className="mt-2 text-text-secondary">Chọn một game bạn thích, giá luôn rẻ hơn Xbox Store.</p>
          <Link
            to="/games"
            className="mt-8 inline-flex h-12 items-center justify-center px-8 bg-accent hover:bg-accent-hover text-on-accent font-semibold transition-colors"
          >
            Khám phá cửa hàng
          </Link>
        </div>
      </Container>
    );
  }

  return (
    <div className="py-8 md:py-12 pb-32 lg:pb-12">
      <Container>
        <div className="max-w-6xl mx-auto">
          <CheckoutSteps current={0} />

          <div className="flex items-end justify-between gap-4 mb-6">
            <h1 className="font-display text-3xl md:text-4xl font-bold text-text-primary">
              Giỏ hàng <span className="text-text-muted font-normal text-xl num">{count}</span>
            </h1>
            <Link to="/games" className="hidden sm:inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Tiếp tục mua sắm
            </Link>
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-8 lg:gap-10 items-start">
            {/* Items */}
            <div>
              <ul className="border-y border-white/10 divide-y divide-white/10">
                {items.map((item) => (
                  <li key={`${item.gameId}-${item.editionId ?? ""}`} className="py-4 sm:py-5 grid grid-cols-[96px_minmax(0,1fr)] sm:grid-cols-[160px_minmax(0,1fr)_auto] gap-x-4 gap-y-3">
                    <Link to={`/games/${item.gameId}`} className="block self-start overflow-hidden bg-bg-surface">
                      <img
                        loading="lazy"
                        decoding="async"
                        src={item.coverImageUrl}
                        alt={item.name}
                        className="w-full aspect-video object-cover transition-transform duration-300 hover:scale-105"
                      />
                    </Link>

                    <div className="min-w-0">
                      <Link
                        to={`/games/${item.gameId}`}
                        className="font-semibold text-text-primary hover:text-accent transition-colors line-clamp-2 leading-snug"
                      >
                        {item.name}
                      </Link>
                      <p className="mt-1 text-sm text-text-muted">
                        {item.editionName ? `${item.editionName}, ` : ""}
                        {item.status === "Preorder" ? "Đặt trước" : "Game kỹ thuật số"}
                      </p>
                      <div className="mt-2 flex items-baseline gap-2 sm:hidden">
                        <span className="font-bold text-text-primary num">{formatPrice(item.price)}</span>
                        {item.originalPrice > item.price && (
                          <span className="text-sm text-text-muted line-through num">{formatPrice(item.originalPrice)}</span>
                        )}
                      </div>
                    </div>

                    {/* Price (desktop) + controls */}
                    <div className="col-span-2 sm:col-span-1 flex sm:flex-col items-center sm:items-end justify-between gap-3">
                      <div className="hidden sm:block text-right">
                        <p className="font-bold text-lg text-text-primary num">{formatPrice(item.price)}</p>
                        {item.originalPrice > item.price && (
                          <p className="text-sm text-text-muted line-through num">{formatPrice(item.originalPrice)}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="flex items-center border border-white/15">
                          <button
                            onClick={() => updateQuantity(item.gameId, item.quantity - 1)}
                            className="w-10 h-10 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors cursor-pointer"
                            aria-label="Giảm số lượng"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-8 text-center font-semibold text-text-primary num select-none" aria-live="polite">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.gameId, item.quantity + 1)}
                            className="w-10 h-10 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors cursor-pointer"
                            aria-label="Tăng số lượng"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <button
                          onClick={() => removeItem(item.gameId)}
                          className="w-10 h-10 flex items-center justify-center text-text-muted hover:text-negative hover:bg-negative/10 transition-colors cursor-pointer"
                          aria-label={`Xóa ${item.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="flex justify-between items-center pt-4">
                <button
                  onClick={clearCart}
                  className="text-sm text-text-muted hover:text-negative transition-colors cursor-pointer inline-flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Xóa tất cả
                </button>
                <Link to="/games" className="sm:hidden text-sm text-text-secondary hover:text-accent transition-colors inline-flex items-center gap-1.5">
                  <ArrowLeft className="w-4 h-4" />
                  Mua thêm
                </Link>
              </div>
            </div>

            {/* Summary */}
            <aside className="lg:sticky lg:top-20 bg-bg-surface border border-white/10 p-6">
              <h2 className="font-display text-lg font-semibold text-text-primary">Tóm tắt đơn hàng</h2>

              <dl className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-text-secondary">Giá Xbox Store ({count} game)</dt>
                  <dd className="text-text-primary num">{formatPrice(originalTotal)}</dd>
                </div>
                {saved > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-text-secondary">Moxic giảm</dt>
                    <dd className="text-positive num">-{formatPrice(saved)}</dd>
                  </div>
                )}
              </dl>

              <div className="mt-5 pt-5 border-t border-white/10 flex justify-between items-baseline">
                <span className="text-text-secondary">Tổng cộng</span>
                <span className="font-display text-3xl text-accent font-bold num">{formatPrice(total)}</span>
              </div>
              {saved > 0 && (
                <div className="mt-3">
                  <SavedCallout amount={saved} compact />
                </div>
              )}

              <button
                onClick={() => navigate("/checkout")}
                className="hidden lg:flex mt-6 w-full h-12 items-center justify-center bg-accent hover:bg-accent-hover text-on-accent font-bold transition-colors cursor-pointer"
              >
                Tiến hành thanh toán
              </button>

              <ul className="mt-6 space-y-2.5 text-sm text-text-secondary">
                <li className="flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-accent" />
                  Game chính hãng, cài thẳng vào tài khoản Xbox của bạn
                </li>
                <li className="flex items-start gap-2.5">
                  <Zap className="w-4 h-4 mt-0.5 shrink-0 text-accent" />
                  Thanh toán QR, xác nhận tự động trong vài giây
                </li>
              </ul>
            </aside>
          </div>
        </div>
      </Container>

      {/* Phone: total + action always within thumb reach */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-bg-base/95 backdrop-blur pb-[var(--sab)]">
        <div className="px-4 py-3 flex items-center gap-4">
          <div className="min-w-0">
            <p className="text-xs text-text-muted">Tổng cộng</p>
            <p className="font-display text-xl font-bold text-accent num leading-tight">{formatPrice(total)}</p>
          </div>
          <button
            onClick={() => navigate("/checkout")}
            className="ml-auto h-12 px-6 bg-accent hover:bg-accent-hover text-on-accent font-bold transition-colors cursor-pointer"
          >
            Thanh toán
          </button>
        </div>
      </div>
    </div>
  );
}
