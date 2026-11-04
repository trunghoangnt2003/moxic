import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Flame } from "lucide-react";
import { getGuessToday, imageUrl } from "../../lib/guessApi";

/** Home banner for the daily "Đoán game", shows today's pixelated picture as a teaser. */
export default function GuessTeaser() {
  const { data: s } = useQuery({ queryKey: ["guess", "today"], queryFn: getGuessToday, staleTime: 60_000, retry: false });
  if (!s) return null;
  return (
    <Link
      to="/doan-game"
      className="group relative flex items-center gap-4 overflow-hidden border border-white/10 bg-gradient-to-r from-accent/10 via-bg-surface to-bg-surface p-3 sm:p-4 hover:border-accent/50 transition-colors"
    >
      <img src={imageUrl(s.imagePath)} alt="" className="w-28 sm:w-40 aspect-video object-cover shrink-0 border border-white/10" loading="lazy" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-info">Đoán game #{s.number}</p>
        <p className="font-display text-lg sm:text-xl font-bold leading-tight">
          {s.finished ? (s.solved ? "Bạn đã đoán đúng hôm nay 🎉" : "Hôm nay khó quá 😅") : "Đây là game gì?"}
        </p>
        <p className="text-xs text-text-muted mt-0.5">
          {s.finished ? "Câu mới lúc 0h, giữ chuỗi nhé!" : `Đoán đúng ngay lần đầu: +100 điểm · ${s.stats.players} người đã chơi`}
        </p>
      </div>
      {s.streak > 0 && (
        <span className="hidden sm:inline-flex items-center gap-1 text-caution font-bold text-sm">
          <Flame className="w-4 h-4" /> {s.streak}
        </span>
      )}
      <ArrowRight className="w-5 h-5 text-text-muted group-hover:text-accent group-hover:translate-x-1 transition shrink-0" />
    </Link>
  );
}
