import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { BadgeCheck, CornerDownRight, Loader2, MessagesSquare, Send, Trash2 } from "lucide-react";
import { apiError, deleteComment, getComments, postComment, type CommentItem } from "../../lib/communityApi";
import { useMe } from "../../hooks/useAccount";
import { timeAgo } from "../../lib/utils";
import ReportButton from "./ReportButton";

function Avatar({ name }: { name: string }) {
  const initials = name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";
  let hue = 0;
  for (const ch of name) hue = (hue * 31 + ch.charCodeAt(0)) % 360;
  return (
    <span className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: `hsl(${hue} 45% 35%)` }} aria-hidden>
      {initials}
    </span>
  );
}

function Composer({ gameId, parentId, onDone, autoFocus, placeholder }: { gameId: string; parentId?: string; onDone?: () => void; autoFocus?: boolean; placeholder: string }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const send = useMutation({
    mutationFn: () => postComment(gameId, text.trim(), parentId),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["comments", gameId] });
      onDone?.();
    },
    onError: (e) => toast.error(apiError(e, "Không gửi được bình luận")),
  });
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim().length >= 2) send.mutate();
      }}
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 1000))}
        rows={parentId ? 1 : 2}
        autoFocus={autoFocus}
        placeholder={placeholder}
        className="flex-1 min-w-0 bg-bg-base border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent/60 resize-none"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && text.trim().length >= 2) send.mutate();
        }}
      />
      <button type="submit" disabled={send.isPending || text.trim().length < 2} aria-label="Gửi" className="self-end h-10 w-10 shrink-0 flex items-center justify-center bg-accent text-bg-base disabled:opacity-40 cursor-pointer">
        {send.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
      </button>
    </form>
  );
}

function CommentRow({ c, gameId, onReply }: { c: CommentItem; gameId: string; onReply?: () => void }) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: () => deleteComment(c.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comments", gameId] }),
    onError: (e) => toast.error(apiError(e, "Không xóa được")),
  });
  return (
    <div className="flex gap-3">
      <Avatar name={c.displayName} />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold text-text-primary">{c.displayName}</span>
          {c.isBuyer && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold bg-positive/15 text-positive border border-positive/40">
              <BadgeCheck className="w-3 h-3" /> Đã mua
            </span>
          )}
          <span className="text-[11px] text-text-muted">{timeAgo(c.createdAt)}</span>
        </div>
        <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line break-words mt-0.5">{c.content}</p>
        <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
          {onReply && (
            <button type="button" onClick={onReply} className="hover:text-white cursor-pointer">
              Trả lời
            </button>
          )}
          {c.isMine ? (
            <button type="button" onClick={() => del.mutate()} disabled={del.isPending} className="inline-flex items-center gap-1 hover:text-negative cursor-pointer">
              <Trash2 className="w-3 h-3" /> Xóa
            </button>
          ) : (
            <ReportButton targetType="Comment" targetId={c.id} />
          )}
        </div>
      </div>
    </div>
  );
}

/** "Thảo luận": comments with one reply level, signed-in customers only. */
export default function GameDiscussion({ gameId }: { gameId: string }) {
  const { data: me } = useMe();
  const [page, setPage] = useState(1);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["comments", gameId, page], queryFn: () => getComments(gameId, page) });
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <section className="mt-12">
      <h2 className="font-display text-xl text-text-primary flex items-center gap-2 mb-5">
        <MessagesSquare className="w-5 h-5 text-accent" /> Thảo luận {data && data.total > 0 && <span className="text-text-muted text-base">({data.total})</span>}
      </h2>

      <div className="bg-bg-surface border border-border p-4 mb-4">
        {me ? (
          <div className="flex gap-3">
            <Avatar name={me.displayName} />
            <div className="flex-1 min-w-0">
              <Composer gameId={gameId} placeholder="Hỏi đáp, chia sẻ kinh nghiệm chơi… (Ctrl+Enter để gửi)" />
            </div>
          </div>
        ) : (
          <p className="text-sm text-text-muted">
            <Link to={`/login?redirect=${encodeURIComponent(`/games/${gameId}`)}`} className="text-accent hover:underline">
              Đăng nhập
            </Link>{" "}
            để tham gia thảo luận.
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="py-8 flex justify-center text-text-muted">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : !data || data.items.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-8 border border-dashed border-white/10">Chưa có thảo luận nào, hãy là người đầu tiên!</p>
      ) : (
        <ul className="space-y-3">
          {data.items.map((t) => (
            <li key={t.comment.id} className="bg-bg-surface border border-border p-4 space-y-3">
              <CommentRow c={t.comment} gameId={gameId} onReply={me ? () => setReplyTo(replyTo === t.comment.id ? null : t.comment.id) : undefined} />
              {(t.replies.length > 0 || replyTo === t.comment.id) && (
                <div className="ml-6 sm:ml-12 pl-3 border-l border-white/10 space-y-3">
                  {t.replies.map((r) => (
                    <CommentRow key={r.id} c={r} gameId={gameId} />
                  ))}
                  {replyTo === t.comment.id && (
                    <div className="flex gap-2 items-start">
                      <CornerDownRight className="w-4 h-4 text-text-muted mt-3 shrink-0" />
                      <div className="flex-1">
                        <Composer gameId={gameId} parentId={t.comment.id} autoFocus placeholder={`Trả lời ${t.comment.displayName}…`} onDone={() => setReplyTo(null)} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="h-9 px-3 border border-border text-sm disabled:opacity-40 cursor-pointer">
            Mới hơn
          </button>
          <span className="h-9 px-3 flex items-center text-sm text-text-muted">
            {page}/{totalPages}
          </span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="h-9 px-3 border border-border text-sm disabled:opacity-40 cursor-pointer">
            Cũ hơn
          </button>
        </div>
      )}
    </section>
  );
}
