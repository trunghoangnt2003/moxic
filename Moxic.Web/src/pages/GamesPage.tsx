import { useState } from "react";
import { useGames } from "../hooks/useGames";
import GameGrid from "../components/games/GameGrid";
import Container from "../components/layout/Container";

import { GridSkeleton } from "../components/shared/Skeleton";
import { Search, X } from "lucide-react";

export default function GamesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useGames({ search, status: statusFilter, page });

  if (error) {
    return (
      <Container className="mt-12 text-center py-16">
        <p className="text-danger mb-4">Không thể tải dữ liệu</p>
        <button onClick={() => window.location.reload()} className="bg-accent hover:bg-accent-hover text-white px-6 py-3 rounded-md text-sm cursor-pointer">
          Thử lại
        </button>
      </Container>
    );
  }

  return (
    <Container className="mt-8">
      {/* Search */}
      <div className="relative max-w-md mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input
          type="text" placeholder="Tìm kiếm game..."
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full bg-bg-elevated border border-border rounded-md pl-10 pr-10 py-3 text-sm focus:outline-none focus:border-accent text-text-primary placeholder:text-text-placeholder"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer">
            <X className="w-4 h-4 text-text-muted" />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {["", "Available", "Preorder"].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-4 py-2 rounded-md text-sm transition-all duration-200 cursor-pointer ${
              statusFilter === s
                ? "bg-accent/20 text-accent border border-accent"
                : "bg-bg-surface text-text-secondary border border-border hover:bg-bg-surface-hover"
            }`}
          >
            {s === "" ? "Tất cả" : s === "Available" ? "Sẵn có" : "Đặt trước"}
          </button>
        ))}
      </div>

      {/* Grid */}
      {isLoading ? (
        <GridSkeleton count={8} />
      ) : data?.items.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-text-muted mb-4">Không tìm thấy game phù hợp</p>
          <button
            onClick={() => { setSearch(""); setStatusFilter(""); }}
            className="text-accent hover:text-accent-hover text-sm cursor-pointer"
          >
            Đặt lại bộ lọc
          </button>
        </div>
      ) : (
        <>
          <GameGrid games={data?.items || []} variant="vertical" />
          {data && data.total > data.page * data.pageSize && (
            <div className="text-center mt-8">
              <button
                onClick={() => setPage((p) => p + 1)}
                className="bg-bg-surface hover:bg-bg-surface-hover text-text-secondary px-8 py-3 rounded-md text-sm border border-border transition-colors cursor-pointer"
              >
                Xem thêm
              </button>
            </div>
          )}
        </>
      )}
    </Container>
  );
}




