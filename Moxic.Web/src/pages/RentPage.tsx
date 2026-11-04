import { Link } from "react-router-dom";
import { BellRing, CreditCard, Gamepad2, KeyRound, RefreshCw } from "lucide-react";
import Container from "../components/layout/Container";
import GameCard from "../components/games/GameCard";
import { SectionLoader } from "../components/shared/MoxicLoader";
import { useGames } from "../hooks/useGames";
import { formatPrice } from "../lib/utils";

const STEPS = [
  { icon: Gamepad2, title: "Chọn game & gói", desc: "7, 30 ngày… tùy game" },
  { icon: CreditCard, title: "Thanh toán QR", desc: "Giữ slot 30 phút" },
  { icon: KeyRound, title: "Nhận tài khoản", desc: "Hiện ngay trong tài khoản bạn" },
  { icon: BellRing, title: "Nhắc & gia hạn", desc: "Báo trước 24h, gia hạn 1 chạm" },
];

/** "Thuê game" landing: how it works + every rentable game. */
export default function RentPage() {
  const { data, isLoading } = useGames({ rentable: true, pageSize: 60, sort: "bestseller" });
  const games = data?.items ?? [];
  const cheapest = games.reduce<number | null>((m, g) => (g.rentFrom != null && (m == null || g.rentFrom < m) ? g.rentFrom : m), null);

  return (
    <div>
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.18),transparent_60%)]" />
        <Container className="relative py-12 md:py-16">
          <p className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <KeyRound className="w-3.5 h-3.5" /> Dịch vụ thuê game
          </p>
          <h1 className="font-display text-3xl md:text-5xl font-extrabold mt-4 max-w-2xl leading-tight">
            Chơi game bom tấn Xbox <span className="bg-gradient-to-r from-emerald-300 to-accent bg-clip-text text-transparent">không cần mua đứt</span>
          </h1>
          <p className="text-text-secondary mt-3 max-w-xl">
            Thuê theo ngày{cheapest != null ? <>, chỉ từ <b className="text-white">{formatPrice(cheapest)}</b></> : null}. Hết hứng thú thì thôi, muốn chơi tiếp thì gia hạn.
          </p>
          <ol className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-8">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex items-start gap-3 p-3 bg-black/30 border border-white/10">
                <span className="w-9 h-9 shrink-0 flex items-center justify-center bg-emerald-500/15 text-emerald-300">
                  <s.icon className="w-4 h-4" />
                </span>
                <span>
                  <span className="block text-[11px] text-text-muted">Bước {i + 1}</span>
                  <span className="block text-sm font-semibold">{s.title}</span>
                  <span className="block text-[11px] text-text-muted">{s.desc}</span>
                </span>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <Container className="mt-10 mb-20">
        <div className="flex items-end justify-between gap-3 mb-5">
          <h2 className="font-display text-xl md:text-2xl">Game cho thuê {data && <span className="text-text-muted text-base">({data.total})</span>}</h2>
          <Link to="/account/rentals" className="text-sm text-accent hover:underline inline-flex items-center gap-1">
            <RefreshCw className="w-4 h-4" /> Đơn thuê của tôi
          </Link>
        </div>
        {isLoading ? (
          <SectionLoader />
        ) : games.length === 0 ? (
          <p className="text-center text-text-muted py-16 bg-black/40 border border-white/5">Chưa có game nào mở cho thuê — quay lại sau nhé!</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-5">
            {games.map((g) => (
              <GameCard key={g.id} game={g} variant="vertical" />
            ))}
          </div>
        )}
      </Container>
    </div>
  );
}
