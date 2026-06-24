import { useNavigate } from "react-router-dom";
import { ShoppingCart, ArrowLeft } from "lucide-react";
import { useCartStore } from "../../lib/cartStore";
import Container from "../components/layout/Container";
import CartSummary from "../components/checkout/CartSummary";
import CheckoutForm from "../components/checkout/CheckoutForm";
import { formatPrice } from "../lib/utils";

export default function CheckoutPage() {
  const navigate = useNavigate();
  const items = useCartStore((s) => s.items);
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const handleSuccess = (orderCode: string) => {
    navigate(/confirmation/);
  };

  if (items.length === 0) {
    return (
      <Container className="mt-20">
        <div className="text-center py-24 bg-bg-surface border border-border">
          <ShoppingCart className="w-16 h-16 text-text-muted mx-auto mb-4 opacity-30" />
          <h2 className="font-display text-xl text-text-primary mb-2">Gi\u1ecf h\u00e0ng tr\u1ed1ng</h2>
          <p className="text-text-muted text-sm mb-6">B\u1ea1n ch\u01b0a th\u00eam game n\u00e0o v\u00e0o gi\u1ecf h\u00e0ng.</p>
          <button
            onClick={() => navigate("/games")}
            className="bg-accent hover:bg-accent-hover text-bg-base px-8 py-3 text-sm font-semibold transition-colors cursor-pointer"
          >
            Ti\u1ebfp t\u1ee5c mua s\u1eafm
          </button>
        </div>
      </Container>
    );
  }

  return (
    <Container className="mt-8 mb-20">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-text-muted hover:text-text-primary text-sm mb-6 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" /> Quay l\u1ea1i
      </button>

      <div className="max-w-[600px] mx-auto">
        <h1 className="font-display text-2xl md:text-3xl text-text-primary mb-8">Thanh to\u00e1n</h1>

        {/* Cart Summary */}
        <div className="mb-6">
          <CartSummary items={items} total={total} />
        </div>

        {/* Checkout Form */}
        <div className="bg-bg-surface border border-border p-5">
          <h3 className="font-display text-sm text-text-primary uppercase tracking-wider mb-5">
            Th\u00f4ng tin t\u00e0i kho\u1ea3n Xbox
          </h3>
          <CheckoutForm onSuccess={handleSuccess} />
        </div>
      </div>
    </Container>
  );
}
