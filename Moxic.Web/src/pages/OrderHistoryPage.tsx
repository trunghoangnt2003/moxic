import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Gamepad2, Package } from "lucide-react";
import Container from "../components/layout/Container";
import OrderStatusBadge from "../components/account/OrderStatusBadge";
import { SectionLoader } from "../components/shared/MoxicLoader";
import { useMe, useMyOrders } from "../hooks/useAccount";
import type { AccountOrderItem, AccountOrderSummary } from "../lib/accountApi";
import { formatDate, formatPrice } from "../lib/utils";

const MAX_ITEMS_PREVIEW = 3;

function ItemRow({ item }: { item: AccountOrderItem }) {
  return (
    <div className="flex items-center gap-3">
      {item.coverUrl ? (
        <img
          src={item.coverUrl}
          alt=""
          loading="lazy"
          className="w-10 h-[54px] object-cover flex-shrink-0 bg-[#2d261e]"
        />
      ) : (
        <div className="w-10 h-[54px] flex-shrink-0 bg-[#2d261e] border border-[#3d352a] flex items-center justify-center">
          <Gamepad2 className="w-4 h-4 text-[#7a6f63]" />
        </div>
      )}
      <p className="flex-1 min-w-0 truncate text-sm text-[#ede6db]">{item.gameName}</p>
      <p className="text-sm text-[#b5a898] flex-shrink-0">{formatPrice(item.price)}</p>
    </div>
  );
}

function OrderCard({ order }: { order: AccountOrderSummary }) {
  const preview = order.items.slice(0, MAX_ITEMS_PREVIEW);
  const extra = order.items.length - preview.length;

  return (
    <article className="bg-[#252019] border border-[#3d352a] p-4 sm:p-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-sm text-[#ede6db] break-all">{order.orderCode}</p>
          <p className="text-xs text-[#7a6f63] mt-0.5">{formatDate(order.createdAt)}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </header>

      <div className="mt-4 space-y-2.5">
        {preview.map((item) => (
          <ItemRow key={item.gameId} item={item} />
        ))}
        {extra > 0 && <p className="text-xs text-[#7a6f63]">+{extra} game khác</p>}
      </div>

      <footer className="mt-4 pt-4 border-t border-[#3d352a] flex items-center justify-between gap-3">
        <p className="text-sm text-[#b5a898]">
          Tổng: <span className="font-bold text-[#c9a96e]">{formatPrice(order.totalAmount)}</span>
        </p>
        <Link
          to={`/account/orders/${encodeURIComponent(order.orderCode)}`}
          className="text-sm font-semibold text-[#c9a96e] hover:text-[#d4b87a] transition-colors"
        >
          Xem chi tiết →
        </Link>
      </footer>
    </article>
  );
}

export default function OrderHistoryPage() {
  const [page, setPage] = useState(1);
  const { data: me } = useMe();
  const { data, isLoading, isError, refetch, isFetching } = useMyOrders(page);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="min-h-screen bg-[#1a1714] py-8 md:py-12">
      <Container>
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Package className="w-6 h-6 text-[#c9a96e]" />
            <h1 className="font-display text-2xl md:text-3xl uppercase tracking-wider text-[#ede6db]">
              Lịch sử mua hàng
            </h1>
          </div>
          {me && (
            <p className="text-sm text-[#7a6f63] mb-6">
              Các đơn hàng dùng email <strong className="text-[#b5a898] break-all">{me.email}</strong> (email tài
              khoản Xbox khi đặt hàng) hoặc đặt khi đã đăng nhập.
            </p>
          )}

          {isLoading ? (
            <SectionLoader label="Đang tải đơn hàng..." />
          ) : isError ? (
            <div className="bg-[#252019] border border-[#3d352a] p-8 text-center">
              <p className="text-sm text-red-400 mb-4">Không thể tải lịch sử mua hàng. Vui lòng thử lại.</p>
              <button
                onClick={() => void refetch()}
                className="bg-[#c9a96e] hover:bg-[#d4b87a] text-[#1a1714] px-6 py-2.5 text-sm font-semibold transition-colors cursor-pointer"
              >
                Thử lại
              </button>
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="bg-[#252019] border border-[#3d352a] p-10 text-center">
              <Package className="w-12 h-12 text-[#3d352a] mx-auto mb-3" />
              <p className="text-[#b5a898] text-sm mb-5">Bạn chưa có đơn hàng nào.</p>
              <Link
                to="/games"
                className="inline-block bg-[#c9a96e] hover:bg-[#d4b87a] text-[#1a1714] px-6 py-2.5 text-sm font-semibold transition-colors"
              >
                Khám phá game
              </Link>
            </div>
          ) : (
            <>
              <div className={`space-y-4 transition-opacity ${isFetching ? "opacity-70" : ""}`}>
                {data.items.map((order) => (
                  <OrderCard key={order.orderCode} order={order} />
                ))}
              </div>

              {data.total > data.pageSize && (
                <nav className="mt-6 flex items-center justify-center gap-4" aria-label="Phân trang">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    aria-label="Trang trước"
                    className="p-2 border border-[#3d352a] text-[#b5a898] hover:bg-[#2d261e] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-[#b5a898]">
                    Trang {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    aria-label="Trang sau"
                    className="p-2 border border-[#3d352a] text-[#b5a898] hover:bg-[#2d261e] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </nav>
              )}
            </>
          )}
        </div>
      </Container>
    </div>
  );
}
