import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import type { GameListItem } from "../../types/game";
import { formatPrice } from "../../lib/utils";

interface Props {
  games: GameListItem[];
}

interface HeroMeta {
  title: string;
  subtitle: string;
}

const heroMeta: Record<string, HeroMeta> = {
  "elden-ring": {
    title: "Khuyến mãi từ Epic",
    subtitle: "Phiêu lưu trong thế giới Vòng Địa Ngục với đồ họa tuyệt đỉnh.",
  },
  "cyberpunk-2077": {
    title: "Tương lai trong tầm tay",
    subtitle: "Khám phá Night City rực rỡ. Giá chỉ còn 599.000đ!",
  },
  "ea-fc-26": {
    title: "Bóng đá đỉnh cao",
    subtitle: "EA SPORTS FC 26 đã có mặt! Cải tiến mới nhất cho game thủ.",
  },
  "cod-black-ops-6": {
    title: "Chiến tranh hiện đại",
    subtitle: "Black Ops 6 — Bùng nổ hành động với chiến dịch bom tấn nhất.",
  },
  "assassins-creed-shadows": {
    title: "Hành trình Samurai",
    subtitle: "Đến Nhật Bản thời phong kiến. Đặt hàng ngay!",
  },
};

export default function HeroCarousel({ games }: Props) {
  const [active, setActive] = useState(0);

  const next = useCallback(() => {
    setActive((prev) => (prev + 1) % games.length);
  }, [games.length]);

  useEffect(() => {
    if (games.length < 2) return;
    const timer = setInterval(next, 6000);
    return () => clearInterval(timer);
  }, [games.length, next]);

  if (games.length === 0) return null;

  const game = games[active];
  const meta = heroMeta[game.id] || {
    title: game.name,
    subtitle: `${game.genre} — ${formatPrice(game.salePrice)}`,
  };

  return (
    <div className="w-full bg-bg-surface">
      <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row">
        {/* ── Main Banner 75% ── */}
        <div className="relative w-full md:w-[75%] h-[360px] md:h-[500px] overflow-hidden">
          {/* Background image */}
          <img
            src={game.coverImageUrl || "/placeholder.svg"}
            alt={game.name}
            className="absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-in-out"
          />
          {/* Gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#121212] via-[#121212]/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-transparent to-transparent" />

          {/* Content */}
          <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12 max-w-[85%]">
            <p className="text-accent font-semibold text-xs md:text-sm uppercase tracking-widest mb-2">
              {meta.title}
            </p>
            <h1 className="font-display text-2xl md:text-4xl lg:text-5xl text-text-primary mb-3 leading-tight">
              {game.name}
            </h1>
            <p className="text-text-secondary text-xs md:text-sm mb-5 line-clamp-2 max-w-xl">
              {meta.subtitle}
            </p>
            <Link
              to={`/games/${game.id}`}
              className="inline-block bg-white hover:bg-gray-100 text-black font-bold px-8 py-3 text-sm transition-all duration-300 cursor-pointer"
            >
              Tiết kiệm ngay
            </Link>
          </div>
        </div>

        {/* ── Sidebar 25% ── */}
        <div className="w-full md:w-[25%] bg-bg-surface p-3 space-y-1 max-h-[500px] overflow-y-auto border-l border-border/30">
          {games.map((g, i) => (
            <button
              key={g.id}
              onClick={() => setActive(i)}
              className={`w-full flex items-center gap-3 p-3 text-left transition-all duration-200 cursor-pointer ${
                i === active
                  ? "bg-white/10"
                  : "opacity-60 hover:opacity-100 hover:bg-white/5"
              }`}
            >
              <img
                src={g.coverImageUrl || "/placeholder.svg"}
                alt={g.name}
                className="w-14 h-14 object-cover flex-shrink-0"
              />
              <div className="min-w-0">
                <p
                  className={`text-sm truncate leading-tight ${
                    i === active
                      ? "text-text-primary font-semibold"
                      : "text-text-secondary"
                  }`}
                >
                  {g.name}
                </p>
                <p className="text-xs text-text-muted mt-0.5">
                  {g.salePrice > 0 ? formatPrice(g.salePrice) : "Miễn phí"}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
