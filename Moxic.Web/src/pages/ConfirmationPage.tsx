import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { CheckCircle, AlertCircle, ArrowLeft, ShoppingCart } from "lucide-react";
import Container from "../components/layout/Container";
import { HeroSkeleton } from "../components/shared/Skeleton";
import ConfirmationContent from "../components/checkout/ConfirmationContent";
import QRDisplay from "../components/checkout/QRDisplay";
import { getOrder } from "../lib/api";

export default function ConfirmationPage() {
  const { orderCode } = useParams<{ orderCode: string }>();

  const { data: order, isLoading, error } = useQuery({
    queryKey: ["order", orderCode],
    queryFn: () => getOrder(orderCode!),
    enabled: !!orderCode,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1a1714] py-12">
        <Container className="mt-12">
          <HeroSkeleton />
          <p className="text-[#7a6f63] text-sm text-center mt-4">Đang tải thông tin đơn hàng...</p>
        </Container>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-[#1a1714] py-12">
        <Container className="mt-20">
          <div className="text-center py-24 bg-[#252019] border border-[#3d352a] max-w-[500px] mx-auto">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4 opacity-60" />
            <h2 className="font-display text-xl text-[#ede6db] mb-2">Không tìm thấy đơn hàng</h2>
            <p className="text-[#7a6f63] text-sm mb-6">
              Mã đơn hàng không tồn tại hoặc đã bị xóa.
            </p>
            <Link
              to="/games"
              className="inline-flex items-center gap-1 text-[#c9a96e] hover:text-[#d4b87a] text-sm transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Quay lại cửa hàng
            </Link>
          </div>
        </Container>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1714] py-8 md:py-12">
      <Container className="mt-8 mb-20">
        <div className="max-w-[600px] mx-auto">
          {/* Success header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h1 className="font-display text-2xl md:text-3xl text-[#ede6db] mb-2">
              Đặt hàng thành công!
            </h1>
            <p className="text-[#7a6f63] text-sm">
              Cảm ơn bạn đã đặt hàng tại Moxic.
            </p>
          </div>

          {/* Order content */}
          <div className="space-y-5">
            <ConfirmationContent
              orderCode={order.orderCode}
              items={order.items}
              totalAmount={order.totalAmount}
              createdAt={order.createdAt}
            />

            {order.paymentConfig && (
              <QRDisplay
                bankQrUrl={order.paymentConfig.bankQrUrl}
                cryptoQrUrl={order.paymentConfig.cryptoQrUrl}
                transferContent={order.orderCode}
              />
            )}

            {/* Note */}
            <div className="bg-[#2d261e]/50 border border-[#3d352a]/50 px-5 py-4">
              <p className="text-xs text-[#7a6f63] leading-relaxed">
                Sau khi chuyển khoản, vui lòng đợi nhân viên xác nhận. Thời gian cài game: 15-30 phút từ khi xác nhận.
              </p>
            </div>

            {/* Continue shopping */}
            <div className="text-center pt-4">
              <Link
                to="/games"
                className="inline-flex items-center gap-2 bg-[#c9a96e] hover:bg-[#d4b87a] text-[#1a1714] px-8 py-3 text-sm font-semibold transition-colors"
              >
                <ShoppingCart className="w-4 h-4" /> Tiếp tục mua sắm
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
