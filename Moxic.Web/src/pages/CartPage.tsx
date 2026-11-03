import { Link, useNavigate } from "react-router-dom";
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
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-[#7a6f63] mb-6">
            <Link to="/games" className="hover:text-[#c9a96e] transition-colors">Cửa hàng</Link>
            <span>/</span>
            <span className="text-[#b5a898]">Giỏ hàng ({items.length})</span>
          </div>

          <h1 className="font-display text-2xl md:text-3xl text-[#ede6db] uppercase tracking-wider mb-8">
            Giỏ hàng của bạn
          </h1>

          {items.length === 0 ? (
            <div className="bg-[#252019] border border-[#3d352a] p-16 text-center">
              <ShoppingCart className="w-16 h-16 text-[#3d352a] mx-auto mb-4" />
              <p className="text-[#b5a898] text-lg mb-2">Giỏ hàng trống</p>
              <p className="text-[#7a6f63] text-sm mb-6">Bạn chưa thêm game nào vào giỏ hàng.</p>
              <Link
                to="/games"
                className="inline-block bg-[#c9a96e] hover:bg-[#d4b87a] text-[#1a1714] px-8 py-3 font-semibold text-sm transition-colors cursor-pointer"
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
                    className="grid grid-cols-[auto_1fr] lg:flex lg:items-center gap-x-3 gap-y-2 lg:gap-4 bg-[#252019] border border-[#3d352a] p-3 lg:p-4 hover:border-[#c9a96e]/30 transition-colors"
                  >
                    {/* Cover - spans 2 rows on mobile */}
                    <Link to={`/games/${item.gameId}`} className="flex-shrink-0 row-span-2 lg:row-span-1 self-start lg:self-auto">
                      <img
                        src={item.coverImageUrl}
                        alt={item.name}
                        className="w-[120px] h-[45px] lg:w-[184px] lg:h-[69px] object-cover"
                      />
                    </Link>

                    {/* Name + status */}
                    <div className="min-w-0 self-center">
                      <Link
                        to={`/games/${item.gameId}`}
                        className="text-[#ede6db] hover:text-[#c9a96e] font-semibold block truncate transition-colors text-sm lg:text-base"
                      >
                        {item.name}
                      </Link>
                      <p className="text-xs text-[#7a6f63] mt-0.5">
                        {item.status === "Preorder" ? "Đặt trước" : "Game kỹ thuật số"}
                      </p>
                    </div>

                    {/* Price + quantity + delete - full width row on mobile */}
                    <div className="col-span-2 lg:col-span-1 flex items-center justify-between lg:justify-end lg:gap-4">
                      <div className="lg:text-right">
                        {item.originalPrice > item.price && (
                          <p className="text-xs text-[#7a6f63] line-through leading-tight">
                            {formatPrice(item.originalPrice)}
                          </p>
                        )}
                        <p className="text-[#ede6db] font-bold text-sm lg:text-base">{formatPrice(item.price)}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center rounded bg-[#1a1714]">
                          <button
                            onClick={() => updateQuantity(item.gameId, item.quantity - 1)}
                            className="min-w-[44px] min-h-[44px] lg:min-w-0 lg:min-h-0 lg:w-7 lg:h-7 flex items-center justify-center text-[#b5a898] hover:text-[#ede6db] hover:bg-[#3d352a] transition-colors cursor-pointer rounded-l"
                            aria-label="Giảm số lượng"
                          >
                            <Minus className="w-4 h-4 lg:w-3.5 lg:h-3.5" />
                          </button>
                          <span className="text-sm text-[#ede6db] font-semibold min-w-[28px] lg:min-w-0 lg:w-6 text-center select-none">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.gameId, item.quantity + 1)}
                            className="min-w-[44px] min-h-[44px] lg:min-w-0 lg:min-h-0 lg:w-7 lg:h-7 flex items-center justify-center text-[#b5a898] hover:text-[#ede6db] hover:bg-[#3d352a] transition-colors cursor-pointer rounded-r"
                            aria-label="Tăng số lượng"
                          >
                            <Plus className="w-4 h-4 lg:w-3.5 lg:h-3.5" />
                          </button>
                        </div>

                        <button
                          onClick={() => removeItem(item.gameId)}
                          className="text-[#7a6f63] hover:text-red-400 transition-colors cursor-pointer min-w-[44px] min-h-[44px] lg:min-w-0 lg:min-h-0 flex items-center justify-center rounded hover:bg-[#3d352a]/50 lg:hover:bg-transparent"
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
                    className="text-sm text-[#7a6f63] hover:text-red-400 transition-colors cursor-pointer flex items-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Xóa tất cả
                  </button>
                  <Link
                    to="/games"
                    className="text-sm text-[#c9a96e] hover:text-[#d4b87a] transition-colors flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Tiếp tục mua sắm
                  </Link>
                </div>
              </div>

              {/* Right: Summary */}
              <div className="w-full lg:w-[340px] flex-shrink-0">
                <div className="bg-[#252019] border border-[#3d352a] p-6 sticky top-20">
                  <h3 className="text-xs text-[#7a6f63] uppercase tracking-widest font-semibold mb-4 pb-3 border-b border-[#3d352a]">
                    Tóm tắt đơn hàng
                  </h3>

                  <div className="space-y-2 mb-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#b5a898]">Tạm tính ({items.length} game)</span>
                      <span className="text-[#ede6db]">{formatPrice(originalTotal)}</span>
                    </div>
                    {saved > 0 && (
                      <div className="flex justify-between">
                        <span className="text-[#b5a898]">Giảm giá</span>
                        <span className="text-green-400">-{formatPrice(saved)}</span>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-[#3d352a] pt-4 mb-6">
                    <div className="flex justify-between items-baseline">
                      <span className="text-[#b5a898] text-sm font-semibold uppercase tracking-wider">Tổng cộng</span>
                      <span className="font-display text-2xl text-[#c9a96e] font-bold">{formatPrice(total)}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate("/checkout")}
                    className="w-full bg-[#c9a96e] hover:bg-[#d4b87a] text-[#1a1714] py-3.5 font-bold text-sm transition-colors cursor-pointer"
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

