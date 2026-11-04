import { useGames, useFeaturedGames } from "../hooks/useGames";
import GuessTeaser from "../components/home/GuessTeaser";
import { HomeSkeleton } from "../components/shared/Skeleton";
import HeroSplash from "../components/home/HeroSplash";
import DiscoverySection from "../components/home/DiscoverySection";
import LuckySpinBanner from "../components/home/LuckySpinBanner";
import GameGrid from "../components/games/GameGrid";
import Container from "../components/layout/Container";
import { Link } from "react-router-dom";
import { ArrowRight, Flame } from "lucide-react";
import GameRail from "../components/games/GameRail";
import RecentlyViewed from "../components/games/RecentlyViewed";
import { ForYouRail } from "../components/games/DiscoveryRails";
import { FlashSaleRail } from "../components/games/FlashSale";

export default function HomePage() {
  const { data, isLoading } = useGames({ pageSize: 50 });
  const { data: featured, isLoading: featuredLoading } = useFeaturedGames(5);
  const { data: bestData } = useGames({ sort: "bestseller", pageSize: 10 });
  const bestsellers = (bestData?.items ?? []).filter((g) => (g.soldCount ?? 0) > 0);

  if (isLoading || featuredLoading) {
    return <HomeSkeleton />;
  }

  const games = data?.items || [];
  const preorderGames = games.filter((g) => g.status === "Preorder");
  const availableGames = games.filter(
    (g) => g.status === "Available" && !featured?.some((f) => f.id === g.id),
  );

  return (
    <div>
      {/* hero splash */}
      <HeroSplash featured={featured || []} available={availableGames} />

      {/* daily guess */}
      <Container className="mt-8">
        <GuessTeaser />
      </Container>

      {/* flash sale */}
      <Container className="mt-14 empty:hidden">
        <FlashSaleRail />
      </Container>

      {/* vong quay may man */}
      <Container className="mt-14 empty:hidden">
        <LuckySpinBanner />
      </Container>

      {/* ban chay nhat */}
      {bestsellers.length > 0 && (
        <Container className="mt-14">
          <GameRail
            ranked
            title={
              <>
                <Flame className="w-6 h-6 text-caution" /> Bán chạy nhất
              </>
            }
            games={bestsellers}
            action={
              <Link to="/games?sort=bestseller" className="text-accent hover:text-accent-hover text-sm flex items-center gap-1 transition-colors">
                Xem tất cả <ArrowRight className="w-4 h-4" />
              </Link>
            }
          />
        </Container>
      )}

      {/* danh cho ban */}
      <Container className="mt-14 empty:hidden">
        <ForYouRail />
      </Container>

      {/* da xem gan day */}
      <Container className="mt-14 empty:hidden">
        <RecentlyViewed />
      </Container>

      {/* kham pha noi dung moi */}
      <Container className="mt-14">
        <DiscoverySection games={availableGames.slice(0, 12)} />
      </Container>

      {/* game noi bat */}
      <Container className="mt-14">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl md:text-2xl font-bold text-text-primary">Game nổi bật</h2>
          <Link
            to="/games"
            className="text-accent hover:text-accent-hover text-sm flex items-center gap-1 transition-colors"
          >
            Xem tất cả <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <GameGrid games={availableGames.slice(0, 10)} variant="vertical" />
      </Container>

      {/* preorder section */}
      {preorderGames.length > 0 && (
        <Container className="mt-14 mb-14">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-xl md:text-2xl font-bold text-text-primary">Sắp ra mắt</h2>
            <Link
              to="/preorder"
              className="text-accent hover:text-accent-hover text-sm flex items-center gap-1 transition-colors"
            >
              Xem tất cả <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <GameGrid games={preorderGames.slice(0, 5)} variant="vertical" />
        </Container>
      )}

      {/* empty state */}
      {games.length === 0 && (
        <Container className="mt-12 text-center py-16">
          <p className="text-text-muted">Chưa có game nào</p>
        </Container>
      )}
    </div>
  );
}
