import { useState } from "react";
import { Star, Send, User, Loader } from "lucide-react";
import { createReview } from "../../lib/api";

interface ReviewFormProps {
  gameId: string;
  onReviewAdded: (review: GameReview) => void;
}

interface GameReview {
  id: string;
  userName: string;
  avatarUrl: string | null;
  rating: number;
  content: string;
  createdAt: string;
}

export default function ReviewForm({ gameId, onReviewAdded }: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [nameMode, setNameMode] = useState<"anonymous" | "custom">("anonymous");
  const [customName, setCustomName] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = rating > 0 && content.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const review = await createReview(gameId, {
        displayName: nameMode === "custom" ? customName.trim() : undefined,
        rating,
        content: content.trim(),
      });
      onReviewAdded(review);
      setRating(0);
      setCustomName("");
      setContent("");
      setNameMode("anonymous");
    } catch {
      setError("Không thể gửi đánh giá. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border-t border-border pt-5 mt-5">
      <h3 className="font-display text-base text-text-primary mb-4">Viết đánh giá của bạn</h3>

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
                      ? "text-yellow-400 fill-yellow-400"
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

        {/* Name mode toggle */}
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

        {/* Custom name input */}
        {nameMode === "custom" && (
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
            placeholder="Chia sẻ trải nghiệm của bạn..."
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
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-accent text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            {submitting ? (
              <><Loader size={14} className="animate-spin" /> Đang gửi...</>
            ) : (
              <><Send size={14} /> Gửi đánh giá</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
