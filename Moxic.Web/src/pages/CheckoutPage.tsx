import { useState } from "react";
import CheckoutSteps from "../components/checkout/CheckoutSteps";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ShoppingCart, ArrowLeft } from "lucide-react";
import { useCartStore } from "../lib/cartStore";
import Container from "../components/layout/Container";
import CartSummary from "../components/checkout/CartSummary";
import CheckoutForm from "../components/checkout/CheckoutForm";
import CouponBox from "../components/checkout/CouponBox";
import { cartLineToken, type CouponQuote } from "../lib/couponApi";

export default function CheckoutPage() {
  const navigate = useNavigate();
  const items = useCartStore((s) => s.items);
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const [searchParams] = useSearchParams();
  const initialCoupon = searchParams.get("coupon") ?? undefined;
  const [coupon, setCoupon] = useState<CouponQuote | null>(null);

  const handleSuccess = (orderCode: string) => {
    navigate(`/confirmation/${orderCode}`);
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-bg-base py-12">
        <Container>
          <div className="text-center py-24 bg-bg-surface border border-white/10 max-w-4xl mx-auto">
            <ShoppingCart className="w-16 h-16 text-white/10 mx-auto mb-4" />
            <h2 className="font-display text-xl text-text-primary mb-2">Giỏ hàng trống</h2>
            <p className="text-text-muted text-sm mb-6">Bạn chưa thêm game nào vào giỏ hàng.</p>
            <button
              onClick={() => navigate("/games")}
              className="bg-accent hover:bg-accent-hover text-bg-base px-8 py-3 text-sm font-semibold transition-colors cursor-pointer"
            >
              Tiếp tục mua sắm
            </button>
          </div>
        </Container>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-base py-8 md:py-12">
      <Container>
        <div className="max-w-5xl mx-auto">
          <CheckoutSteps current={1} />
          <div className="flex items-center justify-between gap-3 mb-6">
            <h1 className="font-display text-2xl md:text-3xl font-bold text-text-primary">Thông tin đặt hàng</h1>
            <button
              onClick={() => navigate("/cart")}
              className="flex items-center gap-1 text-text-muted hover:text-accent text-sm transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Giỏ hàng
            </button>
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Left: Form */}
            <div className="flex-1">
              <div className="bg-bg-surface border border-white/10 p-6">
                <h3 className="font-display text-base text-text-primary mb-6 pb-4 border-b border-white/10">
                  Thông tin tài khoản Xbox
                </h3>
                <CheckoutForm
                  onSuccess={handleSuccess}
                  couponCode={coupon?.code}
                  onCouponRejected={() => setCoupon(null)}
                />
              </div>
            </div>

            {/* Right: Summary */}
            <div className="w-full lg:w-[360px] flex-shrink-0 order-first lg:order-none">
              <CartSummary
                items={items}
                total={total}
                quote={coupon}
                couponSlot={
                  <CouponBox
                    gameIds={items.map((i) => cartLineToken(i.gameId, i.editionId))}
                    applied={coupon}
                    onApplied={setCoupon}
                    initialCode={initialCoupon}
                  />
                }
              />
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
