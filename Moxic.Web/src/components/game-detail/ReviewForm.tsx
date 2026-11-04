import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Star, Send, User, BadgeCheck } from "lucide-react";
import { MoxicLoader } from "../shared/MoxicLoader";
import { createReview } from "../../lib/api";
import { getMyReview } from "../../lib/communityApi";
import type { GameReview } from "../../types/game";

interface ReviewFormProps {
  gameId: string;
  onReviewAdded: (review: GameReview) => void;
}

export default function ReviewForm({ gameId, onReviewAdded }: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [nameMode, setNameMode] = useState<"anonymous" | "custom">("anonymous");
  const [customName, setCustomName] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const qc = useQueryClient();
  const { data: mine } = useQuery({ queryKey: ["my-review", gameId], queryFn: () => getMyReview(gameId), staleTime: 60_000 });
  const signedIn = !!mine?.signedIn;
  const existing = mine?.review ?? null;
  // Prefill once with the customer's existing review.
  const [prefilled, setPrefilled] = useState<string | null>(null);
  if (existing && prefilled !== existing.id) {
    setPrefilled(existing.id);
    setRating(existing.rating);
    setContent(existing.content);
  }

  const canSubmit = rating > 0 && content.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const review = await createReview(gameId, {
        displayName: !signedIn && nameMode === "custom" ? customName.trim() : undefined,
        rating,
        content: content.trim(),
      });
      onReviewAdded(review);
      if (signedIn) {
        void qc.invalidateQueries({ queryKey: ["my-review", gameId] });
      } else {
        setRating(0);
        setCustomName("");
        setContent("");
        setNameMode("anonymous");
      }
    } catch {
      setError("Không thể gửi đánh giá. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border-t border-border pt-5 mt-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h3 className="font-display text-base text-text-primary">{existing ? "Đánh giá của bạn" : "Viết đánh giá của bạn"}</h3>
        {signedIn ? (
          <span className="flex items-center gap-1.5 text-xs text-text-muted">
            Đăng với tên <b className="text-text-primary">{mine?.displayName}</b>
            {mine?.purchased && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold bg-positive/15 text-positive border border-positive/40">
                <BadgeCheck className="w-3 h-3" /> Đã mua
              </span>
            )}
          </span>
        ) : (
          <Link to={`/login?redirect=${encodeURIComponent(`/games/${gameId}`)}`} className="text-xs text-accent hover:underline">
            Đăng nhập để có nhãn “Đã mua”
          </Link>
        )}
      </div>
      {existing?.isHidden && <p className="mb-3 text-xs text-caution">Đánh giá của bạn đang bị ẩn do vi phạm tiêu chuẩn cộng đồng.</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Rating stars */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-text-muted mr-2 flex-shrink-0">Chất lượng:</span>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setRating(s)}
                onMouseEnter={() => setHoverRating(s)}
                onMouseLeave={() => setHoverRating(0)}
                className="p-1.5 cursor-pointer transition-colors"
                aria-label={`${s} sao`}
              >
                <Star
                  size={22}
                  className={`transition-colors ${
                    s <= (hoverRating || rating)
                      ? "text-caution fill-caution"
                      : "text-white/10"
                  }`}
                />
              </button>
            ))}
          </div>
          {rating > 0 && (
            <span className="text-xs text-text-muted ml-2">
              {rating === 1 ? "Rất tệ" : rating === 2 ? "Tệ" : rating === 3 ? "Tạm ổn" : rating === 4 ? "Tốt" : "Xuất sắc"}
            </span>
          )}
        </div>

        {/* Name mode toggle (guests only) */}
        {!signedIn && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted flex-shrink-0">Hiển thị:</span>
          <button
            type="button"
            onClick={() => setNameMode("anonymous")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm cursor-pointer transition-colors ${
              nameMode === "anonymous"
                ? "bg-accent/10 text-accent border border-accent/30"
                : "bg-bg-surface text-text-muted border border-border hover:text-text-primary"
            }`}
          >
            <User size={14} />
            Ẩn danh
          </button>
          <button
            type="button"
            onClick={() => setNameMode("custom")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm cursor-pointer transition-colors ${
              nameMode === "custom"
                ? "bg-accent/10 text-accent border border-accent/30"
                : "bg-bg-surface text-text-muted border border-border hover:text-text-primary"
            }`}
          >
            <User size={14} />
            Nhập tên
          </button>
        </div>
        )}

        {/* Custom name input */}
        {!signedIn && nameMode === "custom" && (
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value.slice(0, 50))}
            placeholder="Tên của bạn"
            className="w-full bg-bg-surface border border-border px-3 py-2.5 text-sm text-text-primary placeholder-text-muted/50 focus:outline-none focus:border-accent/50 transition-colors"
            maxLength={50}
          />
        )}

        {/* Content textarea */}
        <div className="relative">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, 500))}
            placeholder="Chia sẻ trải nghiệm của bạn…"
            rows={3}
            className="w-full bg-bg-surface border border-border px-3 py-2.5 text-sm text-text-primary placeholder-text-muted/50 focus:outline-none focus:border-accent/50 transition-colors resize-none"
            required
          />
          <span className="absolute bottom-2 right-3 text-[10px] text-text-muted/50">
            {content.length}/500
          </span>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-danger">{error}</p>
        )}

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-accent text-on-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            {submitting ? (
              <><MoxicLoader size="sm" /> Đang gửi…</>
            ) : (
              <><Send size={14} /> {existing ? "Cập nhật đánh giá" : "Gửi đánh giá"}</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
