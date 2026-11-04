import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import type { GameListItem, GameDetail } from "../../types/game";
import { formatPrice } from "../../lib/utils";
import { ShoppingCart } from "lucide-react";

import { t } from "../../lib/i18n";
interface Props {
  featured: any[]; // Changed to any[] to accept GameDetail
  available: GameListItem[];
}

function Countdown({ date }: { date: string }) {
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!date) return;
    const tick = () => setLeft(Math.max(0, new Date(date).getTime() - Date.now()));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [date]);

  if (left == null) return null;
  if (left === 0) return <p className="text-sm font-semibold text-positive">{t("Đã ra mắt")}</p>;
  const parts: [number, string][] = [
    [Math.floor(left / 86_400_000), t("ngày")],
    [Math.floor((left % 86_400_000) / 3_600_000), t("giờ")],
    [Math.floor((left % 3_600_000) / 60_000), t("phút")],
    [Math.floor((left % 60_000) / 1000), t("giây")],
  ];
  return (
    <div>
      <p className="text-sm text-white/70 mb-2">{t("Ra mắt sau")}</p>
      <div className="flex gap-2" role="timer" aria-live="off">
        {parts.map(([n, unit]) => (
          <div key={unit} className="w-14 py-2 text-center bg-black/50 border border-white/10">
            <p className="font-display text-xl font-bold text-white num leading-none">{String(n).padStart(2, "0")}</p>
            <p className="mt-1 text-xs text-white/60">{unit}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HeroSplash({ featured, available }: Props) {
  const hero: GameDetail = featured.find(g => g.id === "gta-vi") || featured[0];

  if (!hero) return null;

  // IMPORTANT: Split available into two halves FIRST, then duplicate each half 
  // to ensure a perfectly seamless infinite CSS loop without stutter.
  const half1 = available.filter((_, i) => i % 2 === 0);
  const half2 = available.filter((_, i) => i % 2 !== 0);

  const col1Items = [...half1, ...half1];
  const col2Items = [...half2, ...half2];

  const mainImage = hero.media?.[0]?.presignedUrl || (hero as any).coverImageUrl;
  const isPreorder = hero.status === "Preorder";
  const price = hero.salePrice > 0 ? hero.salePrice : hero.originalPrice;
  const discount = hero.originalPrice > 0 && hero.salePrice > 0 ? Math.round((1 - hero.salePrice / hero.originalPrice) * 100) : 0;

  return (
    <section className="w-full bg-bg-base pt-6 pb-4 overflow-hidden relative">
      <div className="max-w-[1200px] mx-auto px-4 relative z-10">

        {/* Unified Container */}
        <div className="relative flex flex-col md:flex-row h-auto md:h-[70vh] min-h-[500px] overflow-hidden rounded-lg shadow-2xl border border-white/5 group">

          {/* Global Background Media (Behind both panels) */}
          <div className="absolute inset-0 z-0 bg-black">
            {mainImage?.endsWith('.mp4') ? (
              <video
                poster={(hero as any).coverImageUrl}
                src={mainImage}
                autoPlay
                muted
                loop
                playsInline
                className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-[2000ms] ease-out"
              />
            ) : (
              <img
                src={mainImage}
                alt={hero.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[2000ms] ease-out"
              />
            )}
          </div>

          {/* Left: the featured game (65%) */}
          <div className="relative w-full md:w-[65%] min-h-[45vh] md:h-full flex flex-col justify-between p-6 md:p-12 z-10">
            {/* Gradient overlays for left side readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-bg-base md:from-bg-base/90 via-bg-base/60 to-transparent pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-r from-bg-base/90 via-bg-base/40 to-transparent pointer-events-none hidden md:block" />

            {/* Content overlay */}
            <div className="relative z-20 flex flex-col h-full justify-between gap-6">
              <div>
                {isPreorder && (
                  <span className="inline-block px-2.5 py-1 rounded-sm bg-preorder text-on-solid text-xs font-bold mb-4">{t("Bom tấn sắp ra mắt")}</span>
                )}
                <h1 className="font-display text-4xl md:text-6xl font-extrabold text-white leading-[1.05] drop-shadow-2xl max-w-2xl">{hero.name}</h1>
                {hero.description && (
                  <p className="text-white/80 mt-3 md:mt-4 max-w-lg line-clamp-2 md:line-clamp-3 text-sm md:text-base drop-shadow-md">{hero.description}</p>
                )}
              </div>

              <div className="space-y-5">
                <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
                  <div>
                    <p className="text-sm text-white/70">{isPreorder ? t("Giá đặt trước") : t("Giá tại Moxic")}</p>
                    <div className="mt-1 flex items-baseline gap-3 flex-wrap">
                      {discount > 0 && <span className="px-1.5 py-0.5 rounded-sm text-sm font-bold bg-discount text-on-solid num">-{discount}%</span>}
                      {discount > 0 && <span className="text-white/50 line-through text-sm num">{formatPrice(hero.originalPrice)}</span>}
                      <span className="text-accent font-display text-3xl md:text-4xl font-bold num drop-shadow-md">{formatPrice(price)}</span>
                    </div>
                  </div>
                  <Link
                    to={`/games/${hero.id}`}
                    className="h-12 px-6 inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-on-accent font-bold transition-colors shadow-lg shadow-black/40"
                  >
                    <ShoppingCart className="w-5 h-5" />
                    {isPreorder ? t("Đặt trước ngay") : t("Mua ngay")}
                  </Link>
                </div>
                {isPreorder && hero.releaseDate && <Countdown date={hero.releaseDate} />}
              </div>
            </div>
          </div>

          {/* Right: two columns of covers drifting in opposite directions (35%) */}
          <div className="relative w-full md:w-[35%] h-[30vh] md:h-full z-10 border-t md:border-t-0 md:border-l border-white/10 bg-black/40 backdrop-blur-xl">
            {/* Fade overlay top/bottom to make scroll smooth */}
            <div className="absolute inset-0 z-20 pointer-events-none bg-gradient-to-b from-bg-base via-transparent to-bg-base opacity-90" />

            <div className="flex gap-4 h-full p-4">
              {/* Column 1 - Scrolling UP */}
              <div className="flex-1 overflow-hidden relative group/col1">
                <div className="animate-scroll-up space-y-4 group-hover/col1:[animation-play-state:paused] pt-8">
                  {col1Items.map((g, i) => (
                    <Link
                      key={`col1-${g.id}-${i}`}
                      to={`/games/${g.id}`}
                      className="block group cursor-pointer"
                    >
                      <div className="aspect-[3/4] overflow-hidden shadow-lg relative border border-white/5">
                        <img
                          src={g.coverImageUrl}
                          alt={g.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                          <span className="text-white font-bold text-sm line-clamp-2 drop-shadow-md">{g.name}</span>
                          <span className="text-accent text-xs font-semibold drop-shadow-md mt-1">{formatPrice(g.salePrice || g.originalPrice)}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Column 2 - Scrolling DOWN */}
              <div className="flex-1 overflow-hidden relative group/col2">
                <div className="animate-scroll-down space-y-4 group-hover/col2:[animation-play-state:paused] pb-8">
                  {col2Items.map((g, i) => (
                    <Link
                      key={`col2-${g.id}-${i}`}
                      to={`/games/${g.id}`}
                      className="block group cursor-pointer"
                    >
                      <div className="aspect-[3/4] overflow-hidden shadow-lg relative border border-white/5">
                        <img
                          src={g.coverImageUrl}
                          alt={g.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                          <span className="text-white font-bold text-sm line-clamp-2 drop-shadow-md">{g.name}</span>
                          <span className="text-accent text-xs font-semibold drop-shadow-md mt-1">{formatPrice(g.salePrice || g.originalPrice)}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
