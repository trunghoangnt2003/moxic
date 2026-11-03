import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  MessageCircle,
  Plus,
  Trash2,
  AlertCircle,
  Star,
  ArrowLeft,
  User,
} from "lucide-react";
import { apiFetch, apiUrl } from "../lib/api";

interface Review {
  id: string;
  userName: string;
  avatarUrl: string | null;
  rating: number;
  content: string;
  createdAt: string;
}

export default function GameReviews() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formRating, setFormRating] = useState(5);
  const [formContent, setFormContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiFetch(apiUrl(`/api/admin/games/${id}/reviews`))
      .then((r) => r.json())
      .then(setReviews)
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async (reviewId: string) => {
    if (!window.confirm("Xoá bình luận này?")) return;
    setDeleting(reviewId);
    try {
      await apiFetch(apiUrl(`/api/admin/games/${id}/reviews/${reviewId}`), { method: "DELETE" });
      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
    } finally {
      setDeleting(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formContent.trim()) return;
    setSubmitting(true);
    try {
      const res = await apiFetch(apiUrl(`/api/admin/games/${id}/reviews`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userName: formName, rating: formRating, content: formContent }),
      });
      const newReview = await res.json();
      setReviews((prev) => [newReview, ...prev]);
      setShowForm(false);
      setFormName("");
      setFormRating(5);
      setFormContent("");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("vi-VN");

  const avgRating =
    reviews.length > 0
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : "—";

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate("/games")}
            className="p-1.5 rounded text-steam-muted hover:text-steam-text hover:bg-steam-surface-3 transition-colors"
            title="Back"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-white font-mono tracking-tight">Nhận xét</h1>
            <p className="text-xs text-steam-muted mt-0.5 truncate">
              {reviews.length} nhận xét · Điểm TB: {avgRating}/5
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="steam-btn bg-steam-blue text-black hover:bg-steam-blue-hover glow-blue flex-shrink-0 text-xs md:text-sm px-3 md:px-5"
        >
          <Plus size={14} />
          <span>Thêm nhận xét</span>
        </button>
      </div>

      {/* Add review form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-steam-surface border border-steam-border rounded-sm p-4 space-y-3"
        >
          <h3 className="text-sm font-semibold text-white">Thêm nhận xét mới</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-steam-muted mb-1">Tên người dùng</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full bg-steam-surface-3 border border-steam-border rounded px-3 py-1.5 text-sm text-steam-text placeholder-steam-muted/50 focus:outline-none focus:border-steam-blue/50"
                placeholder="VD: Minh Anh"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] text-steam-muted mb-1">Đánh giá</label>
              <select
                value={formRating}
                onChange={(e) => setFormRating(Number(e.target.value))}
                className="w-full bg-steam-surface-3 border border-steam-border rounded px-3 py-1.5 text-sm text-steam-text focus:outline-none focus:border-steam-blue/50"
              >
                <option value={5}>5 sao</option>
                <option value={4}>4 sao</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-steam-muted mb-1">Nội dung</label>
            <textarea
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              className="w-full bg-steam-surface-3 border border-steam-border rounded px-3 py-1.5 text-sm text-steam-text placeholder-steam-muted/50 focus:outline-none focus:border-steam-blue/50 resize-none"
              rows={3}
              placeholder="Nội dung nhận xét..."
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-sm text-steam-muted hover:text-steam-text transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="steam-btn bg-steam-blue text-black hover:bg-steam-blue-hover glow-blue text-sm"
            >
              {submitting ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        </form>
      )}

      {/* Reviews list */}
      {loading ? (
        <div className="text-center py-8 text-steam-muted text-sm">Đang tải...</div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-12">
          <MessageCircle size={28} className="mx-auto mb-3 text-steam-border" />
          <p className="text-sm text-steam-muted">Chưa có nhận xét nào</p>
          <p className="text-xs text-steam-muted/60 mt-1">Thêm nhận xét đầu tiên để tạo niềm tin cho khách hàng.</p>
        </div>
      ) : (
        <div className="bg-steam-surface border border-steam-border rounded-sm overflow-hidden">
          <div className="divide-y divide-steam-border">
            {reviews.map((review) => (
              <div key={review.id} className="px-4 py-3 flex items-start gap-3 hover:bg-steam-surface-2/50 transition-colors">
                <div className="w-8 h-8 rounded-full bg-steam-surface-3 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {review.avatarUrl ? (
                    <img src={review.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User size={14} className="text-steam-muted" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-white">{review.userName}</span>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={10}
                          className={s <= review.rating ? "text-steam-gold fill-steam-gold" : "text-steam-border"}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] text-steam-muted ml-auto">{formatDate(review.createdAt)}</span>
                  </div>
                  <p className="text-sm text-steam-muted leading-relaxed">{review.content}</p>
                </div>
                <button
                  onClick={() => handleDelete(review.id)}
                  disabled={deleting === review.id}
                  className="p-1.5 rounded text-steam-muted hover:text-steam-accent hover:bg-steam-accent/10 transition-colors flex-shrink-0 disabled:opacity-30"
                  title="Xóa"
                >
                  {deleting === review.id ? <AlertCircle size={13} className="animate-pulse" /> : <Trash2 size={13} />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
