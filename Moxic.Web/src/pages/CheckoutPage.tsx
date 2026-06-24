import { useNavigate } from "react-router-dom";
import { ShoppingCart, ArrowLeft } from "lucide-react";
import { useCartStore } from "../lib/cartStore";
import Container from "../components/layout/Container";
import CartSummary from "../components/checkout/CartSummary";
import CheckoutForm from "../components/checkout/CheckoutForm";

export default function CheckoutPage() {
  const navigate = useNavigate();
  const items = useCartStore((s) => s.items);
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const handleSuccess = (orderCode: string) => {
    navigate(`/confirmation/${orderCode}`);
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-[#1a1714] py-12">
        <Container>
          <div className="text-center py-24 bg-[#252019] border border-[#3d352a] max-w-4xl mx-auto">
            <ShoppingCart className="w-16 h-16 text-[#3d352a] mx-auto mb-4" />
            <h2 className="font-display text-xl text-[#ede6db] mb-2 uppercase tracking-wider">Giỏ hàng trống</h2>
            <p className="text-[#7a6f63] text-sm mb-6">Bạn chưa thêm game nào vào giỏ hàng.</p>
            <button
              onClick={() => navigate("/games")}
              className="bg-[#c9a96e] hover:bg-[#d4b87a] text-[#1a1714] px-8 py-3 text-sm font-semibold transition-colors cursor-pointer"
            >
              Tiếp tục mua sắm
            </button>
          </div>
        </Container>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1714] py-8 md:py-12">
      <Container>
        <div className="max-w-5xl mx-auto">
          {/* Back */}
          <button
            onClick={() => navigate("/cart")}
            className="flex items-center gap-1 text-[#7a6f63] hover:text-[#c9a96e] text-sm mb-6 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Quay lại giỏ hàng
          </button>

          <h1 className="font-display text-2xl md:text-3xl text-[#ede6db] uppercase tracking-wider mb-8">
            Thanh toán
          </h1>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Left: Form */}
            <div className="flex-1">
              <div className="bg-[#252019] border border-[#3d352a] p-6">
                <h3 className="font-display text-base text-[#ede6db] uppercase tracking-wider mb-6 pb-4 border-b border-[#3d352a]">
                  Thông tin tài khoản Xbox
                </h3>
                <CheckoutForm onSuccess={handleSuccess} />
              </div>
            </div>

            {/* Right: Summary */}
            <div className="w-full lg:w-[360px] flex-shrink-0">
              <CartSummary items={items} total={total} />
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
