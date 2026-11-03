import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, X, SlidersHorizontal, ChevronDown, ChevronLeft, ChevronRight, Check, Tag as TagIcon, Percent } from "lucide-react";
import { useGameFacets, useGames } from "../hooks/useGames";
import GameCard from "../components/games/GameCard";
import Container from "../components/layout/Container";
import { MoxicLoader, SectionLoader } from "../components/shared/MoxicLoader";
import { formatPrice } from "../lib/utils";
import type { FacetOption } from "../types/game";

const PAGE_SIZE = 24;

const SORTS = [
  { value: "", label: "Nổi bật & mới nhất" },
  { value: "discount", label: "Giảm giá nhiều nhất" },
  { value: "price-asc", label: "Giá: thấp → cao" },
  { value: "price-desc", label: "Giá: cao → thấp" },
  { value: "release", label: "Ngày phát hành" },
  { value: "name-asc", label: "Tên: A → Z" },
  { value: "name-desc", label: "Tên: Z → A" },
];

const PRICE_PRESETS: { label: string; min?: number; max?: number }[] = [
  { label: "Dưới 200K", max: 200_000 },
  { label: "200K – 500K", min: 200_000, max: 500_000 },
  { label: "500K – 1 triệu", min: 500_000, max: 1_000_000 },
  { label: "Trên 1 triệu", min: 1_000_000 },
];

const STATUSES = [
  { value: "", label: "Tất cả" },
  { value: "Available", label: "Sẵn có" },
  { value: "Preorder", label: "Đặt trước" },
];

interface Filters {
  q: string;
  status: string;
  genres: string[];
  tags: string[];
  min?: number;
  max?: number;
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
    min: num("min"),
    max: num("max"),
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
  if (f.min != null) sp.set("min", String(f.min));
  if (f.max != null) sp.set("max", String(f.max));
  if (f.sale) sp.set("sale", "1");
  if (f.sort) sp.set("sort", f.sort);
  if (f.page > 1) sp.set("page", String(f.page));
  return sp;
}

function shortPrice(v: number) {
  if (v >= 1_000_000) return `${+(v / 1_000_000).toFixed(1)} triệu`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}K`;
  return `${v}đ`;
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
      minPrice: filters.min,
      maxPrice: filters.max,
      onSale: filters.sale,
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
  if (filters.sale) chips.push({ key: "sale", label: "Đang giảm giá", onRemove: () => update({ sale: false }) });
  for (const id of filters.genres)
    chips.push({ key: `g${id}`, label: nameOf(facets?.genres, id), onRemove: () => update({ genres: filters.genres.filter((x) => x !== id) }) });
  for (const id of filters.tags)
    chips.push({ key: `t${id}`, label: <>#{nameOf(facets?.tags, id)}</>, onRemove: () => update({ tags: filters.tags.filter((x) => x !== id) }) });
  if (filters.min != null || filters.max != null)
    chips.push({
      key: "price",
      label:
        filters.min != null && filters.max != null
          ? `${shortPrice(filters.min)} – ${shortPrice(filters.max)}`
          : filters.min != null
            ? `Từ ${shortPrice(filters.min)}`
            : `Đến ${shortPrice(filters.max!)}`,
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
          <h1 className="font-display text-2xl md:text-4xl font-bold">Cửa hàng Game</h1>
          <p className="text-text-muted text-sm mt-1">
            {data ? (
              <>
                <span className="text-text-primary font-semibold">{data.total}</span> game
                {chips.length > 0 ? " phù hợp" : " đang bán"}
              </>
            ) : (
              "Đang tải…"
            )}
          </p>
        </div>
      </div>

      {/* Toolbar: search + (mobile filter button) + sort */}
      <div className="sticky top-14 z-30 -mx-4 px-4 py-3 mb-4 bg-bg-base/90 backdrop-blur-md border-b border-white/5 md:static md:mx-0 md:px-0 md:py-0 md:bg-transparent md:backdrop-blur-none md:border-0">
        <div className="flex gap-2 md:gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
            <input
              type="search"
              inputMode="search"
              enterKeyHint="search"
              placeholder="Tìm theo tên game, thể loại, tag…"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") update({ q: searchText.trim() });
              }}
              className="w-full h-11 bg-bg-surface border border-white/10 pl-10 pr-10 text-sm focus:outline-none focus:border-accent text-text-primary placeholder:text-text-placeholder transition-colors [&::-webkit-search-cancel-button]:hidden"
            />
            {searchText && (
              <button
                type="button"
                aria-label="Xóa tìm kiếm"
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
            className="md:hidden relative h-11 px-3 flex items-center gap-2 border border-white/10 bg-bg-surface text-sm font-semibold cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4 text-accent" />
            Lọc
            {filterCount > 0 && (
              <span className="min-w-5 h-5 px-1 flex items-center justify-center bg-accent text-bg-base text-[11px] font-bold">
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
              Xóa tất cả
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-8 items-start">
        {/* Desktop sidebar */}
        <aside className="hidden md:block w-[260px] shrink-0 sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1 [scrollbar-width:thin]">
          <div className="bg-black/40 border border-white/5 backdrop-blur-md">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-accent" />
                <span className="font-display font-bold">Bộ lọc</span>
              </div>
              {filterCount > 0 && (
                <button type="button" onClick={clearAll} className="text-xs text-text-muted hover:text-accent cursor-pointer">
                  Đặt lại
                </button>
              )}
            </div>
            {panel}
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1 min-w-0">
          {error ? (
            <div className="text-center py-20 bg-black/40 border border-white/5">
              <p className="text-danger mb-4">Không thể tải danh sách game</p>
              <button onClick={() => refetch()} className="bg-accent hover:bg-accent-hover text-bg-base px-6 py-3 text-sm font-semibold cursor-pointer">
                Thử lại
              </button>
            </div>
          ) : isLoading ? (
            <SectionLoader />
          ) : data && data.items.length === 0 ? (
            <div className="text-center py-20 px-6 bg-black/40 border border-white/5">
              <Search className="w-10 h-10 mx-auto text-text-muted mb-4" />
              <p className="font-semibold mb-1">Không tìm thấy game phù hợp</p>
              <p className="text-text-muted text-sm mb-5">Thử bỏ bớt bộ lọc hoặc tìm với từ khóa khác.</p>
              <button onClick={clearAll} className="border border-accent text-accent hover:bg-accent/10 px-5 py-2.5 text-sm font-semibold cursor-pointer">
                Xóa bộ lọc
              </button>
            </div>
          ) : (
            <div className="relative">
              {isFetching && (
                <div className="absolute inset-x-0 top-0 z-10 flex justify-center pt-16 pointer-events-none">
                  <MoxicLoader size="sm" />
                </div>
              )}
              <div className={`grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5 transition-opacity ${isFetching ? "opacity-50" : ""}`}>
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
          aria-label="Bộ lọc"
          className={`absolute inset-x-0 bottom-0 max-h-[85vh] flex flex-col bg-bg-surface border-t border-white/10 transition-transform duration-300 ${sheetOpen ? "translate-y-0" : "translate-y-full"}`}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <span className="font-display font-bold text-lg">Bộ lọc</span>
            <button type="button" aria-label="Đóng" onClick={() => setSheetOpen(false)} className="p-2 -mr-2 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain">{panel}</div>
          <div className="flex gap-3 p-4 border-t border-white/5 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button type="button" onClick={clearAll} className="flex-1 h-12 border border-white/15 text-sm font-semibold cursor-pointer">
              Xóa lọc
            </button>
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              className="flex-[2] h-12 bg-accent text-bg-base text-sm font-bold cursor-pointer"
            >
              {isFetching ? "Đang lọc…" : `Xem ${data?.total ?? 0} kết quả`}
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
        aria-label="Sắp xếp"
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
        className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-widest cursor-pointer hover:text-white"
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
      <Section title="Trạng thái">
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
                  active ? "bg-accent text-bg-base" : "text-text-muted hover:text-white hover:bg-white/5"
                }`}
              >
                {s.label}
                {count != null && <span className={`block text-[10px] font-normal ${active ? "text-bg-base/70" : "text-text-muted"}`}>{count}</span>}
              </button>
            );
          })}
        </div>
        <label className="mt-3 flex items-center justify-between gap-3 px-3 py-2.5 border border-white/10 cursor-pointer hover:border-white/20">
          <span className="flex items-center gap-2 text-sm">
            <Percent className="w-4 h-4 text-discount" />
            Đang giảm giá
            {facets && <span className="text-text-muted text-xs">({facets.onSale})</span>}
          </span>
          <input type="checkbox" className="sr-only peer" checked={filters.sale} onChange={(e) => update({ sale: e.target.checked })} />
          <span className="w-9 h-5 bg-white/10 relative transition-colors peer-checked:bg-accent after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:bg-white after:transition-transform peer-checked:after:translate-x-4" />
        </label>
      </Section>

      <Section title="Thể loại">
        <CheckList
          options={facets?.genres}
          selected={filters.genres}
          onToggle={(id) => update({ genres: toggle(filters.genres, id) })}
          searchPlaceholder="Tìm thể loại…"
        />
      </Section>

      <Section title="Khoảng giá">
        <PriceFilter min={filters.min} max={filters.max} bounds={facets?.price} onChange={(min, max) => update({ min, max })} />
      </Section>

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
  if (options.length === 0) return <p className="text-xs text-text-muted">Chưa có thể loại nào.</p>;

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
                {checked && <Check className="w-3 h-3 text-bg-base" strokeWidth={3} />}
              </span>
              <span className={`flex-1 truncate ${checked ? "text-white" : "text-text-secondary"}`}>{o.name}</span>
              <span className="text-xs text-text-muted tabular-nums">{o.count}</span>
            </button>
          );
        })}
        {filtered.length === 0 && <p className="text-xs text-text-muted px-2 py-2">Không có kết quả.</p>}
      </div>
      {!term && filtered.length > 8 && (
        <button type="button" onClick={() => setExpanded(!expanded)} className="mt-2 px-2 text-xs text-accent hover:underline cursor-pointer">
          {expanded ? "Thu gọn" : `Xem thêm ${filtered.length - 8}`}
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
          {expanded ? "Thu gọn" : `Xem thêm ${options.length - 12} tag`}
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
          placeholder={bounds ? `Từ ${shortPrice(bounds.min)}` : "Từ"}
          aria-label="Giá thấp nhất"
          className="w-full min-w-0 h-9 bg-bg-base border border-white/10 px-2 text-xs focus:outline-none focus:border-accent text-text-primary placeholder:text-text-placeholder"
        />
        <span className="text-text-muted">–</span>
        <input
          inputMode="numeric"
          value={maxText}
          onChange={(e) => setMaxText(e.target.value.replace(/\D/g, ""))}
          onBlur={apply}
          placeholder={bounds ? `Đến ${shortPrice(bounds.max)}` : "Đến"}
          aria-label="Giá cao nhất"
          className="w-full min-w-0 h-9 bg-bg-base border border-white/10 px-2 text-xs focus:outline-none focus:border-accent text-text-primary placeholder:text-text-placeholder"
        />
        <button type="submit" className="h-9 px-3 border border-white/10 text-xs hover:border-accent hover:text-accent cursor-pointer">
          OK
        </button>
      </form>
      {(min != null || max != null) && (
        <p className="mt-2 text-[11px] text-text-muted">
          {min != null ? formatPrice(min) : "0"} – {max != null ? formatPrice(max) : "∞"}
        </p>
      )}
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
    <nav className="flex justify-center items-center gap-1.5 mt-10" aria-label="Phân trang">
      <button
        type="button"
        aria-label="Trang trước"
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
            className={`${btn} cursor-pointer ${p === page ? "bg-accent text-bg-base border-accent" : "border-white/10 hover:border-accent text-white"}`}
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
