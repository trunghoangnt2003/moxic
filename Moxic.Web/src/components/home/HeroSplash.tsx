import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import type { GameListItem, GameDetail } from "../../types/game";
import { formatPrice } from "../../lib/utils";
import { ShoppingCart } from "lucide-react";

interface Props {
  featured: any[]; // Changed to any[] to accept GameDetail
  available: GameListItem[];
}

function Countdown({ date }: { date: string }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    if (!date) return;
    const tick = () => {
      const diff = new Date(date).getTime() - new Date().getTime();
      if (diff <= 0) {
        setTimeLeft("ÄÃƒ RA Máº®T");
        return;
      }
      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(`${d}N ${h}G ${m}P ${s}S`);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [date]);

  return <span>{timeLeft}</span>;
}

export default function HeroSplash({ featured, available }: Props) {
  // Get GTA 6
  const hero: GameDetail = featured.find(g => g.id === "gta-vi") || featured[0];

  if (!hero) return null;

  // IMPORTANT: Split available into two halves FIRST, then duplicate each half 
  // to ensure a perfectly seamless infinite CSS loop without stutter.
  const half1 = available.filter((_, i) => i % 2 === 0);
  const half2 = available.filter((_, i) => i % 2 !== 0);

  const col1Items = [...half1, ...half1];
  const col2Items = [...half2, ...half2];

  const mainImage = hero.media?.[0]?.presignedUrl || (hero as any).coverImageUrl;

  return (
    <section className="w-full bg-bg-base pt-8 pb-12 overflow-hidden relative">
      <div className="max-w-[1400px] mx-auto px-4 relative z-10">

        {/* Unified Container */}
        <div className="relative flex flex-col md:flex-row h-auto md:h-[70vh] min-h-[500px] overflow-hidden shadow-2xl border border-white/5 group">

          {/* Global Background Media (Behind both panels) */}
          <div className="absolute inset-0 z-0 bg-black">
            {mainImage?.endsWith('.mp4') ? (
              <video
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

          {/* â•â•â• LEFT: GTA 6 Hero (65%) â•â•â• */}
          <div className="relative w-full md:w-[65%] h-[45vh] md:h-full flex flex-col justify-between p-6 md:p-12 z-10">
            {/* Gradient overlays for left side readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f11] md:from-[#0f0f11]/90 via-[#0f0f11]/60 to-transparent pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0f0f11]/90 via-[#0f0f11]/40 to-transparent pointer-events-none hidden md:block" />

            {/* Content overlay */}
            <div className="relative z-20 flex flex-col h-full justify-between">
              <div>
                <span className="inline-block px-3 py-1 bg-preorder text-white text-xs font-bold uppercase tracking-wider mb-4 shadow-lg shadow-preorder/30">
                  Bom tấn sắp ra mắt
                </span>
                <h1 className="font-display text-3xl md:text-6xl text-white leading-tight drop-shadow-2xl max-w-2xl">
                  {hero.name}
                </h1>
                <p className="text-white/80 mt-2 md:mt-4 max-w-lg line-clamp-2 md:line-clamp-3 text-xs md:text-base drop-shadow-md">
                  {hero.description}
                </p>
              </div>

              {/* Price, Button and Countdown in one unified box */}
              <div className="mt-4 md:mt-auto">
                <div className="bg-black/80 md:bg-black/60 backdrop-blur-xl p-4 md:p-5 border border-white/10 flex flex-col items-start gap-2 md:gap-3 w-full md:w-max shadow-2xl">
                  <div className="text-white/60 text-xs uppercase tracking-widest font-semibold">Giá Đặt Trước</div>

                  <div className="flex flex-wrap md:flex-nowrap items-center gap-3 md:gap-5 w-full">
                    <div className="flex items-baseline gap-2 md:gap-3 flex-wrap">
                      {hero.originalPrice > 0 && hero.salePrice > 0 ? (
                        <>
                          <span className="text-white/40 line-through text-xs md:text-sm font-medium">
                            {formatPrice(hero.originalPrice)}
                          </span>
                          <span className="text-accent font-display text-2xl sm:text-3xl md:text-4xl drop-shadow-md">
                            {formatPrice(hero.salePrice)}
                          </span>
                        </>
                      ) : (
                        <span className="text-accent font-display text-2xl sm:text-3xl md:text-4xl drop-shadow-md">
                          {formatPrice(hero.originalPrice)}
                        </span>
                      )}
                    </div>

                    <Link
                      to={`/games/${hero.id}`}
                      className="bg-accent hover:bg-accent-hover text-white w-10 h-10 md:w-12 md:h-12 transition-all flex items-center justify-center cursor-pointer shadow-lg shadow-accent/20 hover:shadow-accent/40 hover:-translate-y-1 shrink-0 ml-auto md:ml-0"
                    >
                      <ShoppingCart className="w-4 h-4 md:w-5 md:h-5" />
                    </Link>
                  </div>

                  {hero.releaseDate && (
                    <div className="text-[10px] md:text-[11px] text-accent/80 font-mono tracking-widest mt-1 bg-accent/10 px-2 md:px-3 py-1 md:py-1.5 border border-accent/20 w-full md:w-auto text-center md:text-left">
                      RA MẮT SAU: <Countdown date={hero.releaseDate} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* â•â•â• RIGHT: 2-Column Scrolling List (35%) â•â•â• */}
          <div className="relative w-full md:w-[35%] h-[30vh] md:h-full z-10 border-t md:border-t-0 md:border-l border-white/10 bg-black/40 backdrop-blur-xl">
            {/* Fade overlay top/bottom to make scroll smooth */}
            <div className="absolute inset-0 z-20 pointer-events-none bg-gradient-to-b from-[#0f0f11] via-transparent to-[#0f0f11] opacity-90" />

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
