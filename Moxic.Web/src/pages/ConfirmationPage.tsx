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
      <Container className="mt-12">
        <HeroSkeleton />
        <p className="text-text-muted text-sm text-center mt-4">\u0110ang t\u1ea3i th\u00f4ng tin \u0111\u01a1n h\u00e0ng...</p>
      </Container>
    );
  }

  if (error || !order) {
    return (
      <Container className="mt-20">
        <div className="text-center py-24 bg-bg-surface border border-border max-w-[500px] mx-auto">
          <AlertCircle className="w-16 h-16 text-danger mx-auto mb-4 opacity-60" />
          <h2 className="font-display text-xl text-text-primary mb-2">Kh\u00f4ng t\u00ecm th\u1ea5y \u0111\u01a1n h\u00e0ng</h2>
          <p className="text-text-muted text-sm mb-6">
            M\u00e3 \u0111\u01a1n h\u00e0ng kh\u00f4ng t\u1ed3n t\u1ea1i ho\u1eb7c \u0111\u00e3 b\u1ecb x\u00f3a.
          </p>
          <Link
            to="/games"
            className="inline-flex items-center gap-1 text-accent hover:text-accent-hover text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Quay l\u1ea1i c\u1eeda h\u00e0ng
          </Link>
        </div>
      </Container>
    );
  }

  return (
    <Container className="mt-8 mb-20">
      <div className="max-w-[600px] mx-auto">
        {/* Success header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-success/20 rounded-none flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-success" />
          </div>
          <h1 className="font-display text-2xl md:text-3xl text-text-primary mb-2">
            \u0110\u1eb7t h\u00e0ng th\u00e0nh c\u00f4ng!
          </h1>
          <p className="text-text-muted text-sm">
            C\u1ea3m \u01a1n b\u1ea1n \u0111\u00e3 \u0111\u1eb7t h\u00e0ng t\u1ea1i Moxic.
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
          <div className="bg-bg-elevated/50 border border-border/50 px-5 py-4">
            <p className="text-xs text-text-muted leading-relaxed">
              Sau khi chuy\u1ec3n kho\u1ea3n, vui l\u00f2ng \u0111\u1ee3i nh\u00e2n vi\u00ean x\u00e1c nh\u1eadn. Th\u1eddi gian c\u00e0i game: 15-30 ph\u00fat t\u1eeb khi x\u00e1c nh\u1eadn.
            </p>
          </div>

          {/* Continue shopping */}
          <div className="text-center pt-4">
            <Link
              to="/games"
              className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-bg-base px-8 py-3 text-sm font-semibold transition-colors"
            >
              <ShoppingCart className="w-4 h-4" /> Ti\u1ebfp t\u1ee5c mua s\u1eafm
            </Link>
          </div>
        </div>
      </div>
    </Container>
  );
}
