import type { GameListItem } from "../../types/game";
import GameCard from "./GameCard";

interface Props {
  games: GameListItem[];
  variant?: "horizontal" | "vertical";
}

export default function GameGrid({ games, variant = "vertical" }: Props) {
  return (
    <div
      className="grid gap-6"
      style={{
        gridTemplateColumns: `repeat(auto-fill, minmax(${variant === "vertical" ? "240px" : "280px"}, 1fr))`,
      }}
    >
      {games.map((game) => (
        <GameCard key={game.id} game={game} variant={variant} />
      ))}
    </div>
  );
}
