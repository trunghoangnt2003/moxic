import { useGames } from "../hooks/useGames";
import GameGrid from "../components/games/GameGrid";
import Container from "../components/layout/Container";
import { SectionLoader } from "../components/shared/MoxicLoader";

import { t } from "../lib/i18n";
export default function PreorderPage() {
  const { data, isLoading } = useGames({ status: "Preorder", pageSize: 50 });

  return (
    <Container className="mt-8">
      <h1 className="font-display text-2xl text-text-primary mb-6">{t("Game Sắp Ra Mắt")}</h1>
      {isLoading ? (
        <SectionLoader />
      ) : data?.items.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-text-muted">{t("Chưa có game đặt trước nào")}</p>
        </div>
      ) : (
        <GameGrid games={data?.items || []} variant="vertical" />
      )}
    </Container>
  );
}
