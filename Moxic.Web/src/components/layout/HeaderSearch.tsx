import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Search, X, ArrowRight, Loader2 } from "lucide-react";
import { getGames } from "../../lib/api";
import { formatPrice } from "../../lib/utils";

interface Props {
  /** "desktop": compact field in the top bar that widens on focus. "mobile": full-width field in the menu. */
  variant: "desktop" | "mobile";
  onNavigate?: () => void;
}

export default function HeaderSearch({ variant, onNavigate }: Props) {
  const navigate = useNavigate();
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  // Debounce what we send to the API.
  useEffect(() => {
    const t = setTimeout(() => setTerm(text.trim()), 250);
    return () => clearTimeout(t);
  }, [text]);

  const { data, isFetching } = useQuery({
    queryKey: ["games", "suggest", term],
    queryFn: () => getGames({ q: term, pageSize: 6 }),
    enabled: term.length >= 1,
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });
  const items = term ? (data?.items ?? []) : [];

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  const finish = (to: string) => {
    setOpen(false);
    setActive(-1);
    inputRef.current?.blur();
    navigate(to);
    onNavigate?.();
  };

  const submitAll = () => {
    const q = text.trim();
    setText("");
    finish(q ? `/games?q=${encodeURIComponent(q)}` : "/games");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Rows: suggestions..., then "see all".
    const rows = items.length + (term ? 1 : 0);
    if (e.key === "ArrowDown" && rows > 0) {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % rows);
    } else if (e.key === "ArrowUp" && rows > 0) {
      e.preventDefault();
      setActive((a) => (a <= 0 ? rows - 1 : a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && active < items.length) {
        setText("");
        finish(`/games/${items[active].id}`);
      } else {
        submitAll();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
      inputRef.current?.blur();
    }
  };

  const showPanel = open && text.trim().length > 0;
  const desktop = variant === "desktop";

  return (
    <div ref={wrapRef} className={desktop ? "relative" : "relative w-full"}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submitAll();
        }}
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
        <input
          ref={inputRef}
          type="search"
          name="q"
          enterKeyHint="search"
          autoComplete="off"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          placeholder="Tìm kiếm game…"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className={
            desktop
              ? "bg-bg-elevated border border-border pl-10 pr-8 py-2 text-sm w-48 lg:w-56 focus:w-72 focus:outline-none focus:border-accent/50 text-text-primary placeholder:text-text-placeholder transition [&::-webkit-search-cancel-button]:hidden"
              : "w-full bg-bg-elevated border border-border pl-10 pr-10 py-2.5 text-base focus:outline-none focus:border-accent/50 text-text-primary placeholder:text-text-placeholder [&::-webkit-search-cancel-button]:hidden"
          }
        />
        {text && (
          <button
            type="button"
            aria-label="Xóa"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setText("");
              setActive(-1);
              inputRef.current?.focus();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-white cursor-pointer"
          >
            {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
          </button>
        )}
      </form>

      {showPanel && (
        <div
          id={listId}
          role="listbox"
          className={`absolute z-[70] mt-1 bg-bg-surface border border-white/10 shadow-2xl shadow-black/60 ${
            desktop ? "right-0 w-[340px]" : "left-0 right-0"
          }`}
        >
          {term && items.length === 0 && !isFetching && (
            <p className="px-4 py-4 text-sm text-text-muted">Không tìm thấy game cho “{term}”.</p>
          )}
          {items.map((g, i) => {
            const discount = g.originalPrice > g.salePrice && g.originalPrice > 0 ? Math.round((1 - g.salePrice / g.originalPrice) * 100) : 0;
            return (
              <button
                key={g.id}
                type="button"
                role="option"
                aria-selected={active === i}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setText("");
                  finish(`/games/${g.id}`);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left cursor-pointer ${active === i ? "bg-white/[0.07]" : ""}`}
              >
                <div className="w-10 h-12 shrink-0 bg-bg-elevated overflow-hidden">
                  {g.coverImageUrl && <img src={g.coverImageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{g.name}</p>
                  <p className="text-[11px] text-text-muted truncate">
                    {g.status === "Preorder" ? "Đặt trước" : g.genres.map((x) => x.name).slice(0, 2).join(" · ")}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {discount > 0 && <span className="block text-[10px] font-bold text-discount">-{discount}%</span>}
                  <span className="text-sm font-semibold">{g.salePrice === 0 ? "Miễn phí" : formatPrice(g.salePrice)}</span>
                </div>
              </button>
            );
          })}
          {term && (
            <button
              type="button"
              role="option"
              aria-selected={active === items.length}
              onMouseEnter={() => setActive(items.length)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={submitAll}
              className={`w-full flex items-center justify-between px-4 py-3 text-sm text-accent border-t border-white/5 cursor-pointer ${
                active === items.length ? "bg-white/[0.07]" : ""
              }`}
            >
              <span className="truncate">
                Xem tất cả kết quả cho “{term}”{data && data.total > 0 ? ` (${data.total})` : ""}
              </span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
