import { useState } from "react";
import { useGames } from "../hooks/useGames";
import GameGrid from "../components/games/GameGrid";
import Container from "../components/layout/Container";
import { GridSkeleton } from "../components/shared/Skeleton";

import { Search, X, Filter, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

export default function GamesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [genreFilter, setGenreFilter] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<string>("name-asc");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useGames({ 
    search, 
    status: statusFilter, 
    genre: genreFilter,
    sort: sortOrder,
    page,
    pageSize: 12
  });

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  const genres = ["Hành động", "RPG", "Thể thao", "Đua xe", "Bắn súng", "Chiến thuật"];

  if (error) {
    return (
      <Container className="mt-12 text-center py-16">
        <p className="text-danger mb-4">Không thể tải dữ liệu</p>
        <button onClick={() => window.location.reload()} className="bg-accent hover:bg-accent-hover text-white px-6 py-3 rounded-none text-sm cursor-pointer">
          Thử lại
        </button>
      </Container>
    );
  }

  return (
    <Container className="mt-8 mb-20 relative z-10">
      <div className="flex flex-col md:flex-row gap-8 items-start">
        
        {/* Sidebar Filters */}
        <div className="w-full md:w-[280px] shrink-0 space-y-6 bg-black/40 border border-white/5 p-5 backdrop-blur-md">
          <div className="flex items-center justify-between mb-4 cursor-pointer md:cursor-default" onClick={() => setShowFilters(!showFilters)}>
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-accent" />
              <h2 className="font-display text-lg font-bold">Lọc Nâng Cao</h2>
            </div>
            <ChevronDown className={`w-4 h-4 text-text-muted transition-transform md:hidden ${showFilters ? "rotate-180" : ""}`} />
          </div>

          <div className={`space-y-6 ${showFilters ? "block" : "hidden"} md:block`}>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text" placeholder="Tìm tên game..."
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full bg-bg-surface border border-white/10 pl-10 pr-10 py-3 text-sm focus:outline-none focus:border-accent text-text-primary transition-colors"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer hover:text-white text-text-muted">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Sort */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-widest">Sắp xếp theo</h3>
            <select 
              value={sortOrder}
              onChange={(e) => { setSortOrder(e.target.value); setPage(1); }}
              className="w-full bg-bg-surface border border-white/10 px-4 py-3 text-sm focus:outline-none focus:border-accent text-text-primary cursor-pointer appearance-none"
            >
              <option value="name-asc">Tên: A-Z</option>
              <option value="name-desc">Tên: Z-A</option>
              <option value="price-asc">Giá: Thấp đến Cao</option>
              <option value="price-desc">Giá: Cao đến Thấp</option>
            </select>
          </div>

          {/* Status */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-widest">Trạng thái</h3>
            <div className="flex flex-col gap-2">
              {[{label: "Tất cả", value: ""}, {label: "Sẵn có", value: "Available"}, {label: "Đặt trước", value: "Preorder"}].map((s) => (
                <button
                  key={s.value}
                  onClick={() => { setStatusFilter(s.value); setPage(1); }}
                  className={`text-left px-4 py-2.5 text-sm transition-all border ${
                    statusFilter === s.value
                      ? "bg-accent/10 text-accent border-accent"
                      : "bg-transparent text-text-muted border-transparent hover:text-white hover:border-white/10"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Genres */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-widest">Thể loại</h3>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => { setGenreFilter(""); setPage(1); }}
                className={`text-left px-4 py-2.5 text-sm transition-all border ${
                  genreFilter === ""
                    ? "bg-accent/10 text-accent border-accent"
                    : "bg-transparent text-text-muted border-transparent hover:text-white hover:border-white/10"
                }`}
              >
                Tất cả thể loại
              </button>
              {genres.map((g) => (
                <button
                  key={g}
                  onClick={() => { setGenreFilter(g); setPage(1); }}
                  className={`text-left px-4 py-2.5 text-sm transition-all border ${
                    genreFilter === g
                      ? "bg-accent/10 text-accent border-accent"
                      : "bg-transparent text-text-muted border-transparent hover:text-white hover:border-white/10"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
          </div>
</div>

        {/* Main Content */}
        <div className="flex-1 w-full min-w-0">
          <div className="flex justify-between items-end mb-6">
            <h1 className="font-display text-2xl md:text-4xl font-bold">Cửa hàng Game</h1>
            <span className="text-text-muted text-sm hidden sm:inline-block">
              Hiển thị {data?.items.length || 0} trên tổng {data?.total || 0} kết quả
            </span>
          </div>

          {/* Grid */}
          {isLoading ? (
            <GridSkeleton count={12} />
          ) : data?.items.length === 0 ? (
            <div className="text-center py-24 bg-black/40 border border-white/5 backdrop-blur-md">
              <p className="text-text-muted mb-4">Không tìm thấy game phù hợp</p>
              <button
                onClick={() => { setSearch(""); setStatusFilter(""); setGenreFilter(""); setPage(1); }}
                className="text-accent hover:text-accent-hover text-sm cursor-pointer underline underline-offset-4"
              >
                Đặt lại bộ lọc
              </button>
            </div>
          ) : (
            <>
              <GameGrid games={data?.items || []} variant="vertical" />
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-12">
                  <button
                    disabled={page === 1}
                    onClick={() => handlePageChange(page - 1)}
                    className="p-2 border border-white/10 hover:border-accent disabled:opacity-50 disabled:hover:border-white/10 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => handlePageChange(i + 1)}
                      className={`w-10 h-10 border transition-colors font-semibold ${
                        page === i + 1 
                          ? "bg-accent text-bg-base border-accent" 
                          : "border-white/10 hover:border-accent text-white"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  
                  <button
                    disabled={page === totalPages}
                    onClick={() => handlePageChange(page + 1)}
                    className="p-2 border border-white/10 hover:border-accent disabled:opacity-50 disabled:hover:border-white/10 transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Container>
  );
}




