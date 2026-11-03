import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Coins, Sparkles } from "lucide-react";
import Container from "../components/layout/Container";
import { SectionLoader } from "../components/shared/MoxicLoader";
import { useMyPoints } from "../hooks/useAccount";
import { POINTS_REASON_LABELS, type PointsTransaction } from "../lib/accountApi";
import { formatPoints } from "../lib/luckySpinApi";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function LedgerRow({ tx }: { tx: PointsTransaction }) {
  const positive = tx.delta >= 0;
  return (
    <li className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#ede6db]">{POINTS_REASON_LABELS[tx.reason] ?? tx.reason}</p>
        {tx.note && <p className="mt-0.5 break-words text-xs text-[#b5a898]">{tx.note}</p>}
        <p className="mt-0.5 text-[11px] text-[#7a6f63]">{formatDateTime(tx.createdAt)}</p>
      </div>
      <div className="flex-shrink-0 text-right">
        <p className={`font-mono text-sm font-bold ${positive ? "text-green-400" : "text-red-400"}`}>
          {positive ? "+" : ""}
          {formatPoints(tx.delta)}
        </p>
        <p className="mt-0.5 text-[11px] text-[#7a6f63]">Số dư {formatPoints(tx.balanceAfter)}</p>
      </div>
    </li>
  );
}

export default function PointsHistoryPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch, isFetching } = useMyPoints(page);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="min-h-screen bg-[#1a1714] py-8 md:py-12">
      <Container>
        <div className="mx-auto max-w-3xl">
          <div className="mb-2 flex items-center gap-3">
            <Coins className="h-6 w-6 text-[#c9a96e]" />
            <h1 className="font-display text-2xl uppercase tracking-wider text-[#ede6db] md:text-3xl">Điểm thưởng</h1>
          </div>

          <section className="mt-4 border border-[#3d352a] bg-[#252019] p-5 sm:p-6">
            <p className="text-xs uppercase tracking-widest text-[#7a6f63]">Số dư hiện tại</p>
            <p className="mt-1 font-display text-4xl font-bold text-[#c9a96e] md:text-5xl">
              {data ? formatPoints(data.balance) : "—"} <span className="text-base font-semibold text-[#b5a898]">điểm</span>
            </p>
            <p className="mt-3 text-sm text-[#b5a898]">
              Nhận điểm khi đơn hàng hoàn tất (mỗi game có số điểm riêng). Dùng điểm để mở hòm tại{" "}
              <Link to="/lucky-spin" className="font-semibold text-[#c9a96e] hover:text-[#d4b87a]">
                Vòng Quay May Mắn
              </Link>
              .
            </p>
            <Link
              to="/lucky-spin"
              className="mt-4 inline-flex items-center gap-2 bg-[#c9a96e] px-5 py-2.5 text-sm font-semibold text-[#1a1714] transition-colors hover:bg-[#d4b87a]"
            >
              <Sparkles className="h-4 w-4" /> Mở hòm ngay
            </Link>
          </section>

          <h2 className="mb-3 mt-8 font-display text-lg uppercase tracking-wider text-[#ede6db]">Lịch sử điểm</h2>

          {isLoading ? (
            <SectionLoader label="Đang tải lịch sử điểm..." />
          ) : isError ? (
            <div className="border border-[#3d352a] bg-[#252019] p-8 text-center">
              <p className="mb-4 text-sm text-red-400">Không thể tải lịch sử điểm. Vui lòng thử lại.</p>
              <button
                onClick={() => void refetch()}
                className="cursor-pointer bg-[#c9a96e] px-6 py-2.5 text-sm font-semibold text-[#1a1714] transition-colors hover:bg-[#d4b87a]"
              >
                Thử lại
              </button>
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="border border-[#3d352a] bg-[#252019] p-10 text-center">
              <Coins className="mx-auto mb-3 h-12 w-12 text-[#3d352a]" />
              <p className="text-sm text-[#b5a898]">Chưa có giao dịch điểm nào.</p>
            </div>
          ) : (
            <>
              <ul
                className={`divide-y divide-[#3d352a] border border-[#3d352a] bg-[#252019] transition-opacity ${
                  isFetching ? "opacity-70" : ""
                }`}
              >
                {data.items.map((tx) => (
                  <LedgerRow key={tx.id} tx={tx} />
                ))}
              </ul>

              {data.total > data.pageSize && (
                <nav className="mt-6 flex items-center justify-center gap-4" aria-label="Phân trang">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    aria-label="Trang trước"
                    className="cursor-pointer border border-[#3d352a] p-2 text-[#b5a898] hover:bg-[#2d261e] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-sm text-[#b5a898]">
                    Trang {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    aria-label="Trang sau"
                    className="cursor-pointer border border-[#3d352a] p-2 text-[#b5a898] hover:bg-[#2d261e] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
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
