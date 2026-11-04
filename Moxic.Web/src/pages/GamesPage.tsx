import { useEffect, useMemo, useState, type ReactNode } from "react";
import { GridSkeleton } from "../components/shared/Skeleton";
import { useSearchParams } from "react-router-dom";
import { Search, X, SlidersHorizontal, ChevronDown, ChevronLeft, ChevronRight, Check, Tag as TagIcon, Percent, Star } from "lucide-react";
import { useGameFacets, useGames } from "../hooks/useGames";
import GameCard from "../components/games/GameCard";
import Container from "../components/layout/Container";
import { MoxicLoader } from "../components/shared/MoxicLoader";
import { formatPrice } from "../lib/utils";
import type { FacetOption, ProductType } from "../types/game";
import { PRODUCT_TYPE_LABELS } from "../lib/productTypes";

import { t, lang } from "../lib/i18n";
const PAGE_SIZE = 24;

const SORTS = [
  { value: "", label: t("Nổi bật & mới nhất") },
  { value: "bestseller", label: t("Bán chạy nhất") },
  { value: "discount", label: t("Giảm giá nhiều nhất") },
  { value: "ending", label: t("Sắp hết khuyến mãi") },
  { value: "price-asc", label: t("Giá: thấp đến cao") },
  { value: "price-desc", label: t("Giá: cao đến thấp") },
  { value: "release", label: t("Ngày phát hành") },
  { value: "name-asc", label: t("Tên: A đến Z") },
  { value: "name-desc", label: t("Tên: Z đến A") },
];

const PRICE_PRESETS: { label: string; min?: number; max?: number }[] = [
  { label: t("Dưới 200K"), max: 200_000 },
  { label: "200K – 500K", min: 200_000, max: 500_000 },
  { label: t("500K – 1 triệu"), min: 500_000, max: 1_000_000 },
  { label: t("Trên 1 triệu"), min: 1_000_000 },
];

const STATUSES = [
  { value: "", label: t("Tất cả") },
  { value: "Available", label: t("Sẵn có") },
  { value: "Preorder", label: t("Đặt trước") },
];

interface Filters {
  q: string;
  status: string;
  genres: string[];
  tags: string[];
  types: string[];
  regions: string[];
  publishers: string[];
  min?: number;
  max?: number;
  yearFrom?: number;
  yearTo?: number;
  rating?: number;
  sale: boolean;
  sort: string;
  page: number;
}

function readFilters(sp: URLSearchParams): Filters {
  const num = (key: string) => {
    const v = sp.get(key);
    if (v == null || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };
  const list = (key: string) => (sp.get(key) ?? "").split(",").filter(Boolean);
  return {
    q: sp.get("q") ?? "",
    status: sp.get("status") ?? "",
    genres: list("genres"),
    tags: list("tags"),
    types: list("type"),
    regions: list("region"),
    publishers: list("publisher"),
    min: num("min"),
    max: num("max"),
    yearFrom: num("yfrom"),
    yearTo: num("yto"),
    rating: num("rating"),
    sale: sp.get("sale") === "1",
    sort: sp.get("sort") ?? "",
    page: Math.max(1, num("page") ?? 1),
  };
}

function writeFilters(f: Filters): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.q) sp.set("q", f.q);
  if (f.status) sp.set("status", f.status);
  if (f.genres.length) sp.set("genres", f.genres.join(","));
  if (f.tags.length) sp.set("tags", f.tags.join(","));
  if (f.types.length) sp.set("type", f.types.join(","));
  if (f.regions.length) sp.set("region", f.regions.join(","));
  if (f.publishers.length) sp.set("publisher", f.publishers.join(","));
  if (f.min != null) sp.set("min", String(f.min));
  if (f.max != null) sp.set("max", String(f.max));
  if (f.yearFrom != null) sp.set("yfrom", String(f.yearFrom));
  if (f.yearTo != null) sp.set("yto", String(f.yearTo));
  if (f.rating != null) sp.set("rating", String(f.rating));
  if (f.sale) sp.set("sale", "1");
  if (f.sort) sp.set("sort", f.sort);
  if (f.page > 1) sp.set("page", String(f.page));
  return sp;
}

function shortPrice(v: number) {
  if (v >= 1_000_000) return t("{0} triệu", [+(v / 1_000_000).toFixed(1)]);
  if (v >= 1_000) return `${Math.round(v / 1_000)}K`;
  return t("{0}đ", [v]);
}

export default function GamesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const [sheetOpen, setSheetOpen] = useState(false);

  const update = (patch: Partial<Filters>, keepPage = false) => {
    const next = { ...filters, ...patch, page: keepPage ? (patch.page ?? filters.page) : (patch.page ?? 1) };
    setSearchParams(writeFilters(next), { replace: !("page" in patch) });
  };

  // Debounced search box synced with the URL (navbar search also writes ?q=).
  const [searchText, setSearchText] = useState(filters.q);
  const [lastQ, setLastQ] = useState(filters.q);
  if (filters.q !== lastQ) {
    setLastQ(filters.q);
    setSearchText(filters.q);
  }
  useEffect(() => {
    const term = searchText.trim();
    if (term === filters.q) return;
    const t = setTimeout(() => update({ q: term }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  const { data: facets } = useGameFacets();
  const { data, isLoading, isFetching, error, refetch } = useGames(
    {
      q: filters.q || undefined,
      status: filters.status || undefined,
      genres: filters.genres,
      tags: filters.tags,
      types: filters.types,
      regions: filters.regions,
      publishers: filters.publishers,
      minPrice: filters.min,
      maxPrice: filters.max,
      onSale: filters.sale,
      yearFrom: filters.yearFrom,
      yearTo: filters.yearTo,
      minRating: filters.rating,
      sort: filters.sort || undefined,
      page: filters.page,
      pageSize: PAGE_SIZE,
    },
    { keepPrevious: true },
  );

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const nameOf = (list: FacetOption[] | undefined, id: string) => list?.find((x) => x.id === id)?.name ?? "…";

  const chips: { key: string; label: ReactNode; onRemove: () => void }[] = [];
  if (filters.q) chips.push({ key: "q", label: <>“{filters.q}”</>, onRemove: () => update({ q: "" }) });
  if (filters.status)
    chips.push({ key: "st", label: STATUSES.find((s) => s.value === filters.status)?.label, onRemove: () => update({ status: "" }) });
  if (filters.yearFrom != null || filters.yearTo != null)
    chips.push({
      key: "year",
      label: filters.yearFrom != null && filters.yearTo != null
        ? filters.yearFrom === filters.yearTo ? t("Năm {0}", [filters.yearFrom]) : `${filters.yearFrom}–${filters.yearTo}`
        : filters.yearFrom != null ? t("Từ {0}", [filters.yearFrom]) : t("Trước {0}", [filters.yearTo! + 1]),
      onRemove: () => update({ yearFrom: undefined, yearTo: undefined }),
    });
  if (filters.rating != null) chips.push({ key: "rating", label: t("{0}★ trở lên", [filters.rating]), onRemove: () => update({ rating: undefined }) });
  if (filters.sale) chips.push({ key: "sale", label: t("Đang giảm giá"), onRemove: () => update({ sale: false }) });
  for (const id of filters.genres)
    chips.push({ key: `g${id}`, label: nameOf(facets?.genres, id), onRemove: () => update({ genres: filters.genres.filter((x) => x !== id) }) });
  for (const t of filters.types)
    chips.push({ key: "ty" + t, label: PRODUCT_TYPE_LABELS[t as ProductType] ?? t, onRemove: () => update({ types: filters.types.filter((x) => x !== t) }) });
  for (const pb of filters.publishers)
    chips.push({ key: "pb" + pb, label: pb, onRemove: () => update({ publishers: filters.publishers.filter((x) => x !== pb) }) });
  for (const r of filters.regions)
    chips.push({ key: "rg" + r, label: "Region " + r, onRemove: () => update({ regions: filters.regions.filter((x) => x !== r) }) });
  for (const id of filters.tags)
    chips.push({ key: `t${id}`, label: <>#{nameOf(facets?.tags, id)}</>, onRemove: () => update({ tags: filters.tags.filter((x) => x !== id) }) });
  if (filters.min != null || filters.max != null)
    chips.push({
      key: "price",
      label:
        filters.min != null && filters.max != null
          ? `${shortPrice(filters.min)} – ${shortPrice(filters.max)}`
          : filters.min != null
            ? t("Từ {0}", [shortPrice(filters.min)])
            : t("Đến {0}", [shortPrice(filters.max!)]),
      onRemove: () => update({ min: undefined, max: undefined }),
    });

  const filterCount = chips.filter((c) => c.key !== "q").length;
  const clearAll = () => {
    setSearchText("");
    setSearchParams(filters.sort ? new URLSearchParams({ sort: filters.sort }) : new URLSearchParams());
  };

  // Lock body scroll while the mobile filter sheet is open.
  useEffect(() => {
    if (!sheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sheetOpen]);

  const panel = <FilterPanel filters={filters} facets={facets} update={update} />;

  return (
    <Container className="mt-6 md:mt-8 mb-20 relative z-10">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-2 mb-5">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-text-primary">{t("Cửa hàng game")}</h1>
          <p className="text-text-muted text-sm mt-1">
            {data ? (
              <>
                <span className="text-text-primary font-semibold">{data.total}</span> {lang === "en" && data.total !== 1 ? "games" : "game"}
                {chips.length > 0 ? t(" phù hợp") : t(" đang bán")}
              </>
            ) : (
              t("Đang tải…")
            )}
          </p>
        </div>
      </div>

      {/* Toolbar: search + (mobile filter button) + sort */}
      <div className="sticky top-[calc(3.5rem+var(--sat))] z-30 -mx-4 px-4 py-3 mb-4 bg-bg-base/90 backdrop-blur-md border-b border-white/5 md:static md:mx-0 md:px-0 md:py-0 md:bg-transparent md:backdrop-blur-none md:border-0">
        <div className="flex flex-wrap md:flex-nowrap gap-2 md:gap-3">
          <div className="relative basis-full md:basis-auto md:flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
            <input
              type="search"
              inputMode="search"
              enterKeyHint="search"
              placeholder={t("Tìm theo tên game, thể loại, tag…")}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") update({ q: searchText.trim() });
              }}
              className="w-full h-11 bg-bg-surface border border-white/10 pl-10 pr-10 text-base md:text-sm focus:outline-none focus:border-accent text-text-primary placeholder:text-text-placeholder transition-colors [&::-webkit-search-cancel-button]:hidden"
            />
            {searchText && (
              <button
                type="button"
                aria-label={t("Xóa tìm kiếm")}
                onClick={() => {
                  setSearchText("");
                  update({ q: "" });
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-text-muted hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="md:hidden relative flex-1 h-11 px-3 flex items-center justify-center gap-2 border border-white/10 bg-bg-surface text-sm font-semibold cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4 text-accent" />
            {t("Lọc")}
            {filterCount > 0 && (
              <span className="min-w-5 h-5 px-1 flex items-center justify-center bg-accent text-on-accent text-[11px] font-bold">
                {filterCount}
              </span>
            )}
          </button>

          <SortSelect value={filters.sort} onChange={(v) => update({ sort: v })} />
        </div>

        {/* Active filter chips */}
        {chips.length > 0 && (
          <div className="flex gap-2 mt-3 overflow-x-auto md:flex-wrap md:overflow-visible pb-1 -mb-1 [scrollbar-width:none]">
            {chips.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={c.onRemove}
                className="shrink-0 inline-flex items-center gap-1.5 h-8 pl-3 pr-2 text-xs border border-accent/40 bg-accent/10 text-accent hover:bg-accent/20 cursor-pointer"
              >
                <span className="max-w-[160px] truncate">{c.label}</span>
                <X className="w-3.5 h-3.5" />
              </button>
            ))}
            <button
              type="button"
              onClick={clearAll}
              className="shrink-0 h-8 px-2 text-xs text-text-muted hover:text-white underline underline-offset-4 cursor-pointer"
            >
              {t("Xóa tất cả")}
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-8 items-start">
        {/* Desktop sidebar */}
        <aside className="hidden md:block w-[272px] lg:w-[288px] shrink-0">
          <div className="md:sticky md:top-20">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-accent" />
                <span className="font-display font-bold">{t("Bộ lọc")}</span>
              </div>
              {filterCount > 0 && (
                <button type="button" onClick={clearAll} className="text-xs text-text-muted hover:text-accent cursor-pointer">
                  {t("Đặt lại")}
                </button>
              )}
            </div>
            {panel}
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1 min-w-0">
          {error ? (
            <div className="text-center py-20 border border-dashed border-white/15">
              <p className="text-danger mb-4">{t("Không thể tải danh sách game")}</p>
              <button onClick={() => refetch()} className="bg-accent hover:bg-accent-hover text-on-accent px-6 py-3 text-sm font-semibold cursor-pointer">
                {t("Thử lại")}
              </button>
            </div>
          ) : isLoading ? (
            <GridSkeleton count={8} />
          ) : data && data.items.length === 0 ? (
            <div className="text-center py-20 px-6 border border-dashed border-white/15">
              <Search className="w-10 h-10 mx-auto text-text-muted mb-4" />
              <p className="font-semibold mb-1">{t("Không tìm thấy game phù hợp")}</p>
              <p className="text-text-muted text-sm mb-5">{t("Thử bỏ bớt bộ lọc hoặc tìm với từ khóa khác.")}</p>
              <button onClick={clearAll} className="border border-accent text-accent hover:bg-accent/10 px-5 py-2.5 text-sm font-semibold cursor-pointer">
                {t("Xóa bộ lọc")}
              </button>
            </div>
          ) : (
            <div className="relative">
              {isFetching && (
                <div className="absolute inset-x-0 top-0 z-10 flex justify-center pt-16 pointer-events-none">
                  <MoxicLoader size="sm" />
                </div>
              )}
              <div className={`grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-x-3 sm:gap-x-5 gap-y-8 transition-opacity ${isFetching ? "opacity-50" : ""}`}>
                {data?.items.map((game) => <GameCard key={game.id} game={game} variant="vertical" />)}
              </div>
              {totalPages > 1 && (
                <Pagination
                  page={filters.page}
                  totalPages={totalPages}
                  onChange={(p) => {
                    update({ page: p }, true);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile bottom sheet */}
      <div
        className={`md:hidden fixed inset-0 z-[60] transition-opacity ${sheetOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        aria-hidden={!sheetOpen}
      >
        <div className="absolute inset-0 bg-black/70" onClick={() => setSheetOpen(false)} />
        <div
          role="dialog"
          aria-label={t("Bộ lọc")}
          className={`absolute inset-x-0 bottom-0 max-h-[85vh] flex flex-col bg-bg-surface border-t border-white/10 transition-transform duration-300 ${sheetOpen ? "translate-y-0" : "translate-y-full"}`}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <span className="font-display font-bold text-lg">{t("Bộ lọc")}</span>
            <button type="button" aria-label={t("Đóng")} onClick={() => setSheetOpen(false)} className="p-2 -mr-2 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain">{panel}</div>
          <div className="flex gap-3 p-4 border-t border-white/5 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button type="button" onClick={clearAll} className="flex-1 h-12 border border-white/15 text-sm font-semibold cursor-pointer">
              {t("Xóa lọc")}
            </button>
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              className="flex-[2] h-12 bg-accent text-on-accent text-sm font-bold cursor-pointer"
            >
              {isFetching ? t("Đang lọc…") : t("Xem {0} kết quả", [data?.total ?? 0])}
            </button>
          </div>
        </div>
      </div>
    </Container>
  );
}

function SortSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative shrink-0">
      <select
        aria-label={t("Sắp xếp")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-[132px] sm:w-[200px] appearance-none bg-bg-surface border border-white/10 pl-3 pr-8 text-sm text-text-primary focus:outline-none focus:border-accent cursor-pointer truncate"
      >
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
    </div>
  );
}

function Section({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-white/5 last:border-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-text-primary cursor-pointer hover:text-accent transition-colors"
      >
        {title}
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function FilterPanel({
  filters,
  facets,
  update,
}: {
  filters: Filters;
  facets: ReturnType<typeof useGameFacets>["data"];
  update: (patch: Partial<Filters>) => void;
}) {
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const statusCount = (v: string) =>
    !facets ? undefined : v === "Available" ? facets.status.available : v === "Preorder" ? facets.status.preorder : undefined;

  return (
    <div>
      <Section title={t("Trạng thái")}>
        <div className="grid grid-cols-3 border border-white/10">
          {STATUSES.map((s) => {
            const active = filters.status === s.value;
            const count = statusCount(s.value);
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => update({ status: s.value })}
                className={`py-2 text-xs font-semibold transition-colors cursor-pointer border-r border-white/10 last:border-r-0 ${
                  active ? "bg-accent text-on-accent" : "text-text-muted hover:text-white hover:bg-white/5"
                }`}
              >
                {s.label}
                {count != null && <span className={`block text-[10px] font-normal ${active ? "text-on-accent/70" : "text-text-muted"}`}>{count}</span>}
              </button>
            );
          })}
        </div>
        <label className="mt-3 flex items-center justify-between gap-3 px-3 py-2.5 border border-white/10 cursor-pointer hover:border-white/20">
          <span className="flex items-center gap-2 text-sm whitespace-nowrap min-w-0">
            <Percent className="w-4 h-4 text-discount" />
            {t("Đang giảm giá")}
            {facets && <span className="text-text-muted text-xs">({facets.onSale})</span>}
          </span>
          <input type="checkbox" className="sr-only peer" checked={filters.sale} onChange={(e) => update({ sale: e.target.checked })} />
          <span className="shrink-0 w-9 h-5 bg-white/20 relative transition-colors peer-checked:bg-accent after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:bg-on-solid after:transition-transform peer-checked:after:translate-x-4" />
        </label>
      </Section>

      {facets && facets.types.length > 1 && (
        <Section title={t("Loại sản phẩm")}>
          <CheckList
            options={facets.types.map((t) => ({ ...t, name: PRODUCT_TYPE_LABELS[t.id as ProductType] ?? t.name }))}
            selected={filters.types}
            onToggle={(id) => update({ types: toggle(filters.types, id) })}
            searchPlaceholder={t("Tìm loại…")}
          />
        </Section>
      )}

      <Section title={t("Thể loại")}>
        <CheckList
          options={facets?.genres}
          selected={filters.genres}
          onToggle={(id) => update({ genres: toggle(filters.genres, id) })}
          searchPlaceholder={t("Tìm thể loại…")}
        />
      </Section>

      <Section title={t("Đánh giá")} defaultOpen={filters.rating != null}>
        <div className="grid grid-cols-2 gap-1.5">
          {[4.5, 4, 3.5, 3].map((r) => {
            const active = filters.rating === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => update({ rating: active ? undefined : r })}
                className={`h-9 inline-flex items-center justify-center gap-1 text-xs border transition-colors cursor-pointer ${
                  active ? "bg-caution/15 border-caution text-caution" : "border-white/10 text-text-secondary hover:border-white/30 hover:text-white"
                }`}
              >
                <Star className="w-3.5 h-3.5 text-caution fill-current" aria-hidden="true" /> {r}+
              </button>
            );
          })}
        </div>
      </Section>

      {facets && facets.years.length > 0 && (
        <Section title={t("Năm phát hành")} defaultOpen={filters.yearFrom != null || filters.yearTo != null}>
          <YearFilter years={facets.years} from={filters.yearFrom} to={filters.yearTo} onChange={(yearFrom, yearTo) => update({ yearFrom, yearTo })} />
        </Section>
      )}

      <Section title={t("Khoảng giá")}>
        <PriceFilter min={filters.min} max={filters.max} bounds={facets?.price} onChange={(min, max) => update({ min, max })} />
      </Section>

      {facets && facets.publishers.length > 0 && (
        <Section title={t("Nhà phát hành")} defaultOpen={filters.publishers.length > 0}>
          <CheckList
            options={facets.publishers}
            selected={filters.publishers}
            onToggle={(id) => update({ publishers: toggle(filters.publishers, id) })}
            searchPlaceholder={t("Tìm nhà phát hành…")}
          />
        </Section>
      )}

      {facets && facets.regions.length > 0 && (
        <Section title="Region" defaultOpen={filters.regions.length > 0}>
          <TagCloud options={facets.regions} selected={filters.regions} onToggle={(id) => update({ regions: toggle(filters.regions, id) })} />
        </Section>
      )}

      {facets && facets.tags.length > 0 && (
        <Section title="Tag" defaultOpen={filters.tags.length > 0}>
          <TagCloud options={facets.tags} selected={filters.tags} onToggle={(id) => update({ tags: toggle(filters.tags, id) })} />
        </Section>
      )}
    </div>
  );
}

function CheckList({
  options,
  selected,
  onToggle,
  searchPlaceholder,
}: {
  options?: FacetOption[];
  selected: string[];
  onToggle: (id: string) => void;
  searchPlaceholder: string;
}) {
  const [term, setTerm] = useState("");
  const [expanded, setExpanded] = useState(false);
  if (!options) return <div className="h-24 animate-pulse bg-white/5" />;
  if (options.length === 0) return <p className="text-xs text-text-muted">{t("Chưa có thể loại nào.")}</p>;

  const filtered = term ? options.filter((o) => o.name.toLowerCase().includes(term.toLowerCase())) : options;
  // Selected items stay visible even when collapsed.
  const visible = expanded || term ? filtered : [...filtered.slice(0, 8), ...filtered.slice(8).filter((o) => selected.includes(o.id))];

  return (
    <div>
      {options.length > 8 && (
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full h-9 mb-2 bg-bg-base border border-white/10 px-3 text-xs focus:outline-none focus:border-accent text-text-primary placeholder:text-text-placeholder"
        />
      )}
      <div className="space-y-0.5">
        {visible.map((o) => {
          const checked = selected.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              role="checkbox"
              aria-checked={checked}
              onClick={() => onToggle(o.id)}
              className="w-full flex items-center gap-3 px-2 py-2 text-sm text-left hover:bg-white/5 cursor-pointer"
            >
              <span
                className={`w-4 h-4 shrink-0 flex items-center justify-center border transition-colors ${
                  checked ? "bg-accent border-accent" : "border-white/25"
                }`}
              >
                {checked && <Check className="w-3 h-3 text-on-accent" strokeWidth={3} />}
              </span>
              <span className={`flex-1 truncate ${checked ? "text-white" : "text-text-secondary"}`}>{o.name}</span>
              <span className="text-xs text-text-muted tabular-nums">{o.count}</span>
            </button>
          );
        })}
        {filtered.length === 0 && <p className="text-xs text-text-muted px-2 py-2">{t("Không có kết quả.")}</p>}
      </div>
      {!term && filtered.length > 8 && (
        <button type="button" onClick={() => setExpanded(!expanded)} className="mt-2 px-2 text-xs text-accent hover:underline cursor-pointer">
          {expanded ? t("Thu gọn") : t("Xem thêm {0}", [filtered.length - 8])}
        </button>
      )}
    </div>
  );
}

function TagCloud({ options, selected, onToggle }: { options: FacetOption[]; selected: string[]; onToggle: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? options : [...options.slice(0, 12), ...options.slice(12).filter((o) => selected.includes(o.id))];
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((o) => {
          const active = selected.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(o.id)}
              className={`inline-flex items-center gap-1 h-7 px-2.5 text-xs border transition-colors cursor-pointer ${
                active ? "bg-accent/15 border-accent text-accent" : "border-white/10 text-text-secondary hover:border-white/30 hover:text-white"
              }`}
            >
              <TagIcon className="w-3 h-3" />
              {o.name}
            </button>
          );
        })}
      </div>
      {options.length > 12 && (
        <button type="button" onClick={() => setExpanded(!expanded)} className="mt-2 text-xs text-accent hover:underline cursor-pointer">
          {expanded ? t("Thu gọn") : t("Xem thêm {0} tag", [options.length - 12])}
        </button>
      )}
    </div>
  );
}

function PriceFilter({
  min,
  max,
  bounds,
  onChange,
}: {
  min?: number;
  max?: number;
  bounds?: { min: number; max: number };
  onChange: (min?: number, max?: number) => void;
}) {
  const [minText, setMinText] = useState(min != null ? String(min) : "");
  const [maxText, setMaxText] = useState(max != null ? String(max) : "");
  const [synced, setSynced] = useState({ min, max });
  if (synced.min !== min || synced.max !== max) {
    setSynced({ min, max });
    setMinText(min != null ? String(min) : "");
    setMaxText(max != null ? String(max) : "");
  }

  const parse = (s: string) => {
    const n = Number(s.replace(/\D/g, ""));
    return s.trim() === "" || !Number.isFinite(n) ? undefined : n;
  };
  const apply = () => {
    let lo = parse(minText);
    let hi = parse(maxText);
    if (lo != null && hi != null && lo > hi) [lo, hi] = [hi, lo];
    if (lo !== min || hi !== max) onChange(lo, hi);
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-1.5 mb-3">
        {PRICE_PRESETS.map((p) => {
          const active = p.min === min && p.max === max;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => (active ? onChange(undefined, undefined) : onChange(p.min, p.max))}
              className={`h-9 text-xs border transition-colors cursor-pointer ${
                active ? "bg-accent/15 border-accent text-accent" : "border-white/10 text-text-secondary hover:border-white/30 hover:text-white"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
      >
        <input
          inputMode="numeric"
          value={minText}
          onChange={(e) => setMinText(e.target.value.replace(/\D/g, ""))}
          onBlur={apply}
          placeholder={bounds ? t("Từ {0}", [shortPrice(bounds.min)]) : t("Từ")}
          aria-label={t("Giá thấp nhất")}
          className="w-full min-w-0 h-9 bg-bg-base border border-white/10 px-2 text-xs focus:outline-none focus:border-accent text-text-primary placeholder:text-text-placeholder"
        />
        <span className="text-text-muted text-xs">{t("đến")}</span>
        <input
          inputMode="numeric"
          value={maxText}
          onChange={(e) => setMaxText(e.target.value.replace(/\D/g, ""))}
          onBlur={apply}
          placeholder={bounds ? t("Đến {0}", [shortPrice(bounds.max)]) : t("Đến")}
          aria-label={t("Giá cao nhất")}
          className="w-full min-w-0 h-9 bg-bg-base border border-white/10 px-2 text-xs focus:outline-none focus:border-accent text-text-primary placeholder:text-text-placeholder"
        />
        <button type="submit" className="h-9 px-3 border border-white/10 text-xs hover:border-accent hover:text-accent cursor-pointer">
          OK
        </button>
      </form>
      {(min != null || max != null) && (
        <p className="mt-2 text-[11px] text-text-muted">
          {t("{0} đến {1}", [min != null ? formatPrice(min) : "0", max != null ? formatPrice(max) : "∞"])}
        </p>
      )}
    </div>
  );
}

function YearFilter({ years, from, to, onChange }: { years: number[]; from?: number; to?: number; onChange: (from?: number, to?: number) => void }) {
  const newest = years[0];
  const presets: { label: string; from?: number; to?: number }[] = [
    { label: t("Mới nhất ({0})", [newest]), from: newest, to: newest },
    { label: `${newest - 2}–${newest}`, from: newest - 2, to: newest },
    { label: `${newest - 6}–${newest - 3}`, from: newest - 6, to: newest - 3 },
    { label: t("Trước {0}", [newest - 6]), to: newest - 7 },
  ];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1.5">
        {presets.map((p) => {
          const active = p.from === from && p.to === to;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => (active ? onChange(undefined, undefined) : onChange(p.from, p.to))}
              className={`h-9 text-xs border transition-colors cursor-pointer ${
                active ? "bg-accent/15 border-accent text-accent" : "border-white/10 text-text-secondary hover:border-white/30 hover:text-white"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <select
        aria-label={t("Chọn năm")}
        value={from != null && from === to ? String(from) : ""}
        onChange={(e) => (e.target.value ? onChange(Number(e.target.value), Number(e.target.value)) : onChange(undefined, undefined))}
        className="w-full h-9 bg-bg-base border border-white/10 px-2 text-xs text-text-primary focus:outline-none focus:border-accent cursor-pointer"
      >
        <option value="">{t("Chọn một năm…")}</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  const pages: (number | "…")[] = [];
  const add = (p: number) => {
    if (!pages.includes(p)) pages.push(p);
  };
  add(1);
  if (page - 1 > 2) pages.push("…");
  for (let p = Math.max(2, page - 1); p <= Math.min(totalPages - 1, page + 1); p++) add(p);
  if (page + 1 < totalPages - 1) pages.push("…");
  if (totalPages > 1) add(totalPages);

  const btn = "h-10 min-w-10 px-2 border text-sm font-semibold transition-colors";
  return (
    <nav className="flex justify-center items-center gap-1.5 mt-10" aria-label={t("Phân trang")}>
      <button
        type="button"
        aria-label={t("Trang trước")}
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className={`${btn} border-white/10 hover:border-accent disabled:opacity-40 disabled:hover:border-white/10 cursor-pointer disabled:cursor-default`}
      >
        <ChevronLeft className="w-4 h-4 mx-auto" />
      </button>
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`} className="px-1 text-text-muted">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            aria-current={p === page ? "page" : undefined}
            onClick={() => onChange(p)}
            className={`${btn} cursor-pointer ${p === page ? "bg-accent text-on-accent border-accent" : "border-white/10 hover:border-accent text-white"}`}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        aria-label="Trang sau"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className={`${btn} border-white/10 hover:border-accent disabled:opacity-40 disabled:hover:border-white/10 cursor-pointer disabled:cursor-default`}
      >
        <ChevronRight className="w-4 h-4 mx-auto" />
      </button>
    </nav>
  );
}
