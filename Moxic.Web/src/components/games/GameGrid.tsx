import type { GameListItem } from "../../types/game";
import GameCard from "./GameCard";

interface Props {
  games: GameListItem[];
  variant?: "horizontal" | "vertical";
}

export default function GameGrid({ games, variant = "vertical" }: Props) {
  return (
    <div
      className={
        variant === "vertical"
          ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-3 sm:gap-x-5 gap-y-8"
          : "grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
      }
    >
      {games.map((game) => (
        <GameCard key={game.id} game={game} variant={variant} />
      ))}
    </div>
  );
}
