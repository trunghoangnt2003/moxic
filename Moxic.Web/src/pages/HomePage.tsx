import { useGames, useFeaturedGames } from "../hooks/useGames";
import HeroSplash from "../components/home/HeroSplash";
import DiscoverySection from "../components/home/DiscoverySection";
import LuckySpinBanner from "../components/home/LuckySpinBanner";
import GameGrid from "../components/games/GameGrid";
import Container from "../components/layout/Container";
import GameCard from "../components/games/GameCard";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { PageLoader } from "../components/shared/MoxicLoader";

export default function HomePage() {
  const { data, isLoading } = useGames({ pageSize: 50 });
  const { data: featured, isLoading: featuredLoading } = useFeaturedGames(5);

  if (isLoading || featuredLoading) {
    return <PageLoader />;
  }

  const games = data?.items || [];
  const preorderGames = games.filter((g) => g.status === "Preorder");
  const availableGames = games.filter(
    (g) => g.status === "Available" && !featured?.some((f) => f.id === g.id),
  );

  return (
    <div>
      {/* ═══ HERO SPLASH ═══ */}
      <HeroSplash featured={featured || []} available={availableGames} />

      {/* ═══ VONG QUAY MAY MAN ═══ */}
      <Container className="mt-14 empty:hidden">
        <LuckySpinBanner />
      </Container>

      {/* ═══ KHAM PHA NOI DUNG MOI ═══ */}
      <Container className="mt-14">
        <DiscoverySection games={availableGames.slice(0, 12)} />
      </Container>

      {/* ═══ GAME NOI BAT ═══ */}
      <Container className="mt-14">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl md:text-2xl text-text-primary">
            Game Nổi Bật
          </h2>
          <Link
            to="/games"
            className="text-accent hover:text-accent-hover text-sm flex items-center gap-1 transition-colors"
          >
            Xem tất cả <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <GameGrid games={availableGames.slice(0, 8)} variant="vertical" />
      </Container>

      {/* ═══ PREORDER SECTION ═══ */}
      {preorderGames.length > 0 && (
        <Container className="mt-14 mb-14">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-xl md:text-2xl text-text-primary">
              Game Sắp Ra Mắt
            </h2>
            <Link
              to="/preorder"
              className="text-accent hover:text-accent-hover text-sm flex items-center gap-1 transition-colors"
            >
              Xem tất cả <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {preorderGames.slice(0, 4).map((g) => (
              <GameCard key={g.id} game={g} variant="vertical" />
            ))}
          </div>
        </Container>
      )}

      {/* ═══ EMPTY STATE ═══ */}
      {games.length === 0 && (
        <Container className="mt-12 text-center py-16">
          <p className="text-text-muted">Chưa có game nào</p>
        </Container>
      )}
    </div>
  );
}
