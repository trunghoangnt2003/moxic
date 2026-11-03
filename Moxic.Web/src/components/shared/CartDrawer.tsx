import { useNavigate } from "react-router-dom";
import { useCartStore } from "../../lib/cartStore";
import { formatPrice } from "../../lib/utils";
import { Link } from "react-router-dom";
import { ShoppingCart, Trash2, Plus, Minus, X } from "lucide-react";

export default function CartDrawer() {
  const navigate = useNavigate();
  const { items, close, removeItem, updateQuantity, clearCart, totalPrice } =
    useCartStore();

  const handleCheckout = () => {
    close();
    navigate("/checkout");
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/60 transition-opacity duration-300"
        onClick={close}
      />

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 z-50 h-full w-full max-w-[420px] bg-bg-surface border-l border-border shadow-2xl transform transition-transform duration-300"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-accent" />
            <h2 className="font-display text-lg text-text-primary">Gi\u1ecf h\u00e0ng</h2>
            <span className="text-xs text-text-muted bg-bg-elevated px-2 py-0.5 ">
              {items.length} s\u1ea3n ph\u1ea9m
            </span>
          </div>
          <button onClick={close} className="text-text-muted hover:text-text-primary cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto h-[calc(100%-140px)] px-5 py-4 space-y-3">
          {items.length === 0 ? (
            <div className="text-center py-16">
              <ShoppingCart className="w-12 h-12 text-text-muted mx-auto mb-3 opacity-30" />
              <p className="text-text-muted text-sm">Gi\u1ecf h\u00e0ng tr\u1ed1ng</p>
              <button
                onClick={close}
                className="text-accent text-xs mt-2 hover:text-accent-hover cursor-pointer"
              >
                Ti\u1ebfp t\u1ee5c mua s\u1eafm
              </button>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.gameId}
                className="flex gap-3 p-3  bg-bg-elevated border border-border/50"
              >
                <img
                  src={item.coverImageUrl}
                  alt={item.name}
                  className="w-16 h-16 object-cover  flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/games/${item.gameId}`}
                    onClick={close}
                    className="font-body text-sm text-text-primary font-semibold truncate block hover:text-accent transition-colors"
                  >
                    {item.name}
                  </Link>
                  <p className="text-accent font-semibold text-sm mt-0.5">
                    {item.price > 0 ? formatPrice(item.price) : "Mi\u1ec5n ph\u00ed"}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateQuantity(item.gameId, item.quantity - 1)}
                        className="w-6 h-6  bg-bg-surface hover:bg-bg-surface-hover flex items-center justify-center text-text-secondary cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs text-text-primary w-5 text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.gameId, item.quantity + 1)}
                        className="w-6 h-6  bg-bg-surface hover:bg-bg-surface-hover flex items-center justify-center text-text-secondary cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <button
                      onClick={() => removeItem(item.gameId)}
                      className="text-text-muted hover:text-danger transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-border p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-text-muted text-sm">T\u1ea1m t\u00ednh</span>
              <span className="font-display text-xl text-accent">{formatPrice(totalPrice())}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={clearCart}
                className="flex-1 py-2.5  border border-border text-text-secondary text-sm hover:bg-bg-surface-hover transition-colors cursor-pointer"
              >
                X\u00f3a t\u1ea5t c\u1ea3
              </button>
              <button
                onClick={handleCheckout}
                className="flex-1 py-2.5  bg-accent hover:bg-accent-hover text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                Thanh to\u00e1n
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
