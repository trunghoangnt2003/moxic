import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Gamepad2, Rocket } from "lucide-react";
import Container from "../components/layout/Container";
import { SectionLoader } from "../components/shared/MoxicLoader";
import WishlistButton from "../components/games/WishlistButton";
import { getReleaseCalendar } from "../lib/discoveryApi";
import { formatPrice } from "../lib/utils";

const MONTHS = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];

/** "Lịch phát hành": upcoming (and last-30-day) releases grouped by month. */
export default function ReleaseCalendarPage() {
  const { data, isLoading } = useQuery({ queryKey: ["release-calendar"], queryFn: getReleaseCalendar, staleTime: 10 * 60_000 });
  const [tab, setTab] = useState<"upcoming" | "recent">("upcoming");
  const now = Date.now();

  const groups = useMemo(() => {
    const list = (data ?? []).filter((g) => g.releaseDate && (tab === "upcoming" ? new Date(g.releaseDate).getTime() >= now - 86_400_000 : new Date(g.releaseDate).getTime() < now));
    if (tab === "recent") list.reverse();
    const map = new Map<string, typeof list>();
    for (const g of list) {
      const d = new Date(g.releaseDate!);
      const key = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
      map.set(key, [...(map.get(key) ?? []), g]);
    }
    return [...map.entries()];
  }, [data, tab, now]);

  return (
    <Container className="mt-8 mb-20 max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl md:text-4xl font-bold flex items-center gap-3">
            <CalendarDays className="w-7 h-7 text-accent" /> Lịch phát hành
          </h1>
          <p className="text-sm text-text-muted mt-1">Game Xbox sắp ra mắt, đặt trước để chơi ngay ngày đầu tiên.</p>
        </div>
        <div className="flex border border-white/10">
          {[
            ["upcoming", "Sắp ra mắt"],
            ["recent", "Vừa ra mắt"],
          ].map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k as "upcoming" | "recent")}
              className={`px-4 h-10 text-sm font-semibold cursor-pointer ${tab === k ? "bg-accent text-on-accent" : "text-text-secondary hover:text-white"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <SectionLoader />
      ) : groups.length === 0 ? (
        <p className="text-center text-text-muted py-16 bg-black/40 border border-white/5">
          {tab === "upcoming" ? "Chưa có game sắp ra mắt trong danh mục." : "Không có game ra mắt trong 30 ngày qua."}
        </p>
      ) : (
        <div className="space-y-10">
          {groups.map(([month, games]) => (
            <section key={month}>
              <h2 className="sticky top-[calc(3.5rem+var(--sat))] z-10 py-2 bg-bg-base/90 backdrop-blur-md font-display text-lg font-bold text-accent border-b border-white/5 mb-3">{month}</h2>
              <ul className="space-y-2">
                {games.map((g) => {
                  const d = new Date(g.releaseDate!);
                  const days = Math.ceil((d.getTime() - now) / 86_400_000);
                  return (
                    <li key={g.id}>
                      <Link to={`/games/${g.id}`} className="group flex items-center gap-3 sm:gap-4 p-2.5 bg-bg-surface border border-white/5 hover:border-white/20 transition-colors">
                        <div className="w-14 shrink-0 text-center border border-white/10 py-1.5">
                          <p className="font-display text-2xl font-extrabold leading-none">{String(d.getDate()).padStart(2, "0")}</p>
                          <p className="text-[10px] text-text-muted mt-0.5">Th{d.getMonth() + 1}</p>
                        </div>
                        <div className="w-12 h-16 sm:w-14 sm:h-[72px] shrink-0 bg-bg-elevated overflow-hidden">
                          {g.coverImageUrl ? <img src={g.coverImageUrl} alt="" className="w-full h-full object-cover" loading="lazy" /> : <Gamepad2 className="w-6 h-6 m-auto mt-5 text-accent/40" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate group-hover:text-accent">{g.name}</p>
                          <p className="text-xs text-text-muted truncate">{g.genres.map((x) => x.name).slice(0, 3).join(", ")}</p>
                          {days > 0 ? (
                            <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-caution">
                              <Rocket className="w-3 h-3" /> còn {days} ngày
                            </p>
                          ) : days === 0 ? (
                            <p className="mt-1 text-[11px] font-semibold text-positive">Ra mắt hôm nay!</p>
                          ) : (
                            <p className="mt-1 text-[11px] text-text-muted">Đã ra mắt</p>
                          )}
                        </div>
                        <div className="text-right shrink-0 hidden sm:block">
                          <p className="text-sm font-bold">{g.salePrice > 0 ? formatPrice(g.salePrice) : "—"}</p>
                          <p className="text-[11px] text-accent">{g.status === "Preorder" ? "Đặt trước" : "Mua ngay"}</p>
                        </div>
                        <WishlistButton gameId={g.id} gameName={g.name} className="!opacity-100 shrink-0" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Container>
  );
}
