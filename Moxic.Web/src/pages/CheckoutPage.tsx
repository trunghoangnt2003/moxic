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

import { t } from "../lib/i18n";
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
      <Container className="py-16 md:py-24">
        <div className="max-w-md mx-auto text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-bg-surface border border-white/10 flex items-center justify-center">
            <ShoppingCart className="w-9 h-9 text-text-muted" />
          </div>
          <h1 className="mt-6 font-display text-3xl font-bold text-text-primary">{t("Giỏ hàng đang trống")}</h1>
          <p className="mt-2 text-text-secondary">{t("Bạn chưa thêm game nào vào giỏ hàng.")}</p>
          <button
            onClick={() => navigate("/games")}
            className="mt-8 h-12 px-8 bg-accent hover:bg-accent-hover text-on-accent font-semibold transition-colors cursor-pointer"
          >
            {t("Tiếp tục mua sắm")}
          </button>
        </div>
      </Container>
    );
  }

  return (
    <div className="py-8 md:py-12 pb-32 lg:pb-12">
      <Container>
        <div className="max-w-6xl mx-auto">
          <CheckoutSteps current={1} />
          <div className="flex items-end justify-between gap-3 mb-8">
            <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-text-primary">{t("Thông tin đặt hàng")}</h1>
            <button
              onClick={() => navigate("/cart")}
              className="inline-flex items-center gap-1.5 whitespace-nowrap text-text-secondary hover:text-accent text-sm transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> {t("Giỏ hàng")}
            </button>
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-10 lg:gap-14 items-start">
            <div className="max-w-xl">
              <CheckoutForm
                onSuccess={handleSuccess}
                couponCode={coupon?.code}
                onCouponRejected={() => setCoupon(null)}
                total={coupon ? coupon.total : total}
              />
            </div>

            <div className="order-first lg:order-none">
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
