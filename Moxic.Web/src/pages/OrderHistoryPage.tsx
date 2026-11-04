import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Gamepad2, Package } from "lucide-react";
import Container from "../components/layout/Container";
import OrderStatusBadge from "../components/account/OrderStatusBadge";
import { SectionLoader } from "../components/shared/MoxicLoader";
import { useMe, useMyOrders } from "../hooks/useAccount";
import type { AccountOrderSummary } from "../lib/accountApi";
import { formatDate, formatPrice } from "../lib/utils";

const MAX_COVERS = 3;

function OrderCard({ order }: { order: AccountOrderSummary }) {
  const covers = order.items.slice(0, MAX_COVERS);
  const extra = order.items.length - 1;

  return (
    <Link
      to={`/account/orders/${encodeURIComponent(order.orderCode)}`}
      className="group grid grid-cols-[auto_minmax(0,1fr)] sm:grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 bg-bg-surface border border-white/10 p-4 hover:border-white/25 transition-colors"
    >
      <div className="flex -space-x-6">
        {covers.map((item, i) =>
          item.coverUrl ? (
            <img
              key={item.gameId + i}
              src={item.coverUrl}
              alt=""
              loading="lazy"
              className="w-14 h-[74px] object-cover bg-bg-elevated ring-2 ring-bg-surface"
            />
          ) : (
            <div key={item.gameId + i} className="w-14 h-[74px] bg-bg-elevated ring-2 ring-bg-surface flex items-center justify-center">
              <Gamepad2 className="w-5 h-5 text-text-muted" />
            </div>
          ),
        )}
      </div>

      <div className="min-w-0">
        <p className="font-semibold text-text-primary truncate group-hover:text-accent transition-colors">
          {order.items[0]?.gameName ?? "Đơn hàng"}
          {extra > 0 && <span className="text-text-muted font-normal"> và {extra} game khác</span>}
        </p>
        <p className="mt-1 text-sm text-text-muted">
          <span className="font-mono">{order.orderCode}</span>, {formatDate(order.createdAt)}
        </p>
        <div className="mt-2 sm:hidden">
          <OrderStatusBadge status={order.status} />
        </div>
      </div>

      <div className="col-span-2 sm:col-span-1 flex sm:flex-col items-center sm:items-end justify-between gap-2 pt-3 sm:pt-0 border-t sm:border-0 border-white/10">
        <div className="hidden sm:block">
          <OrderStatusBadge status={order.status} />
        </div>
        <p className="font-display text-lg font-bold text-text-primary num">{formatPrice(order.totalAmount)}</p>
        <span className="sm:hidden inline-flex items-center gap-1 text-sm text-accent">
          Chi tiết <ChevronRight className="w-4 h-4" />
        </span>
      </div>
    </Link>
  );
}

export default function OrderHistoryPage() {
  const [page, setPage] = useState(1);
  const { data: me } = useMe();
  const { data, isLoading, isError, refetch, isFetching } = useMyOrders(page);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      <Container>
        <div className="max-w-4xl">
          <h1 className="font-display text-3xl font-bold text-text-primary mb-2">Đơn hàng</h1>
          {me && (
            <p className="text-sm text-text-muted mb-6">
              Các đơn hàng dùng email <strong className="text-text-secondary break-all">{me.email}</strong> (email tài
              khoản Xbox khi đặt hàng) hoặc đặt khi đã đăng nhập.
            </p>
          )}

          {isLoading ? (
            <SectionLoader label="Đang tải đơn hàng…" />
          ) : isError ? (
            <div className="bg-bg-surface border border-white/10 p-8 text-center">
              <p className="text-sm text-negative mb-4">Không thể tải lịch sử mua hàng. Vui lòng thử lại.</p>
              <button
                onClick={() => void refetch()}
                className="bg-accent hover:bg-accent-hover text-bg-base px-6 py-2.5 text-sm font-semibold transition-colors cursor-pointer"
              >
                Thử lại
              </button>
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="bg-bg-surface border border-white/10 p-10 text-center">
              <Package className="w-12 h-12 text-white/10 mx-auto mb-3" />
              <p className="text-text-secondary text-sm mb-5">Bạn chưa có đơn hàng nào.</p>
              <Link
                to="/games"
                className="inline-flex h-11 items-center bg-accent hover:bg-accent-hover text-on-accent px-6 text-sm font-semibold transition-colors"
              >
                Khám phá game
              </Link>
            </div>
          ) : (
            <>
              <div className={`space-y-3 transition-opacity ${isFetching ? "opacity-70" : ""}`}>
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
                    className="p-2 border border-white/10 text-text-secondary hover:bg-bg-elevated disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-text-secondary">
                    Trang {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    aria-label="Trang sau"
                    className="p-2 border border-white/10 text-text-secondary hover:bg-bg-elevated disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
