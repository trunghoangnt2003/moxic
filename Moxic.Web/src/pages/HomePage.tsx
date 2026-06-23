import { useGames } from "../hooks/useGames";
import HeroCarousel from "../components/home/HeroCarousel";
import GameGrid from "../components/games/GameGrid";
import Container from "../components/layout/Container";
import { HeroSkeleton, GridSkeleton } from "../components/shared/Skeleton";

export default function HomePage() {
  const { data, isLoading } = useGames({ pageSize: 20 });

  if (isLoading) {
    return (
      <div>
        <HeroSkeleton />
        <Container className="mt-12">
          <GridSkeleton count={8} />
        </Container>
      </div>
    );
  }

  const games = data?.items || [];
  const featured = games.slice(0, 5);
  const preorderGames = games.filter((g) => g.status === "Preorder");
  const newGames = games.slice(0, 12);

  return (
    <div>
      {/* Hero Carousel */}
      <HeroCarousel games={featured} />

      {/* Khám Phá Nội Dung Mới */}
      <Container className="mt-12">
        <h2 className="text-2xl font-display text-text-primary mb-6">Khám Phá Nội Dung Mới</h2>
        <GameGrid games={newGames} variant="vertical" />
      </Container>

      {/* Preorder Section */}
      {preorderGames.length > 0 && (
        <Container className="mt-12">
          <h2 className="text-2xl font-display text-text-primary mb-6">Game Sắp Ra Mắt</h2>
          <GameGrid games={preorderGames} variant="vertical" />
        </Container>
      )}

      {games.length === 0 && (
        <Container className="mt-12 text-center py-16">
          <p className="text-text-muted">Chưa có game nào</p>
        </Container>
      )}
    </div>
  );
}
