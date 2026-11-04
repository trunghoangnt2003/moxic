import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, EyeOff, Eye, Flag, Loader2, MessageSquare, Search, ShieldAlert, Star, XCircle } from "lucide-react";
import { apiFetch, apiUrl } from "../lib/api";
import { readApiError } from "../lib/luckySpinAdmin";

interface ReportGroup {
  targetType: "Review" | "Comment";
  targetId: string;
  count: number;
  reasons: { reason: string; count: number }[];
  notes: string[];
  lastAt: string;
  target: { id: string; author: string; content: string; rating: number; isHidden: boolean; gameId: string; gameName: string; createdAt: string } | null;
}

interface CommentRow {
  id: string;
  parentId: string | null;
  displayName: string;
  content: string;
  isHidden: boolean;
  createdAt: string;
  gameId: string;
  gameName: string;
}

const REASONS: Record<string, string> = { Spam: "Spam", Offensive: "Xúc phạm", Scam: "Lừa đảo", Spoiler: "Spoiler", Other: "Khác" };
const fmt = (iso: string) => new Date(iso).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });

async function act(type: string, id: string, op: "hide" | "unhide" | "dismiss") {
  const res = await apiFetch(apiUrl(`/api/admin/moderation/${type}/${id}/${op}`), { method: "POST" });
  if (!res.ok) throw new Error(await readApiError(res, "Thao tác thất bại"));
}

function ReportsTab() {
  const [status, setStatus] = useState("Open");
  const [items, setItems] = useState<ReportGroup[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setItems(null);
    try {
      const res = await apiFetch(apiUrl(`/api/admin/moderation/reports?status=${status}`));
      if (!res.ok) throw new Error(await readApiError(res, "Không tải được"));
      setItems(await res.json());
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Không tải được" });
      setItems([]);
    }
  }, [status]);
  useEffect(() => {
    load();
  }, [load]);

  const run = async (g: ReportGroup, op: "hide" | "unhide" | "dismiss") => {
    setBusy(g.targetId);
    try {
      await act(g.targetType, g.targetId, op);
      setMsg({ ok: true, text: op === "hide" ? "Đã ẩn nội dung." : op === "unhide" ? "Đã hiện lại nội dung." : "Đã bỏ qua báo cáo." });
      load();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Thao tác thất bại" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex rounded-sm border border-steam-border overflow-hidden w-fit">
        {[
          ["Open", "Chờ xử lý"],
          ["Hidden", "Đã ẩn"],
          ["Dismissed", "Đã bỏ qua"],
        ].map(([k, l]) => (
          <button key={k} onClick={() => setStatus(k)} className={`px-3 py-1.5 text-xs font-semibold border-l border-steam-border first:border-l-0 ${status === k ? "bg-steam-blue/15 text-steam-blue" : "text-steam-muted hover:text-steam-text"}`}>
            {l}
          </button>
        ))}
      </div>
      {msg && (
        <div className={`flex items-center gap-1.5 px-3 py-2 rounded text-xs border ${msg.ok ? "bg-steam-green/10 border-steam-green/30 text-steam-green" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
          {msg.ok ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />} {msg.text}
        </div>
      )}
      {!items ? (
        <div className="py-10 flex justify-center text-steam-muted">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center text-steam-muted bg-steam-surface border border-steam-border rounded-sm">
          <ShieldAlert size={28} className="mx-auto mb-2 text-steam-border" />
          <p className="text-sm">Không có báo cáo nào.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((g) => (
            <div key={g.targetType + g.targetId} className="bg-steam-surface border border-steam-border rounded-sm p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm font-semibold border border-red-500/30 bg-red-500/10 text-red-400">
                  <Flag size={10} /> {g.count} báo cáo
                </span>
                <span className="px-1.5 py-0.5 rounded-sm border border-steam-border text-steam-muted">{g.targetType === "Review" ? "Đánh giá" : "Bình luận"}</span>
                {g.reasons.map((r) => (
                  <span key={r.reason} className="text-steam-gold">
                    {REASONS[r.reason] ?? r.reason} ×{r.count}
                  </span>
                ))}
                <span className="text-steam-muted ml-auto">{fmt(g.lastAt)}</span>
              </div>
              {g.target ? (
                <div className={`rounded-sm bg-steam-bg/50 border border-steam-border p-2.5 ${g.target.isHidden ? "opacity-60" : ""}`}>
                  <p className="text-xs text-steam-muted">
                    <b className="text-white">{g.target.author}</b> · {g.target.gameName}
                    {g.targetType === "Review" && (
                      <span className="ml-1 text-steam-gold">
                        {g.target.rating}
                        <Star size={9} className="inline -mt-0.5 ml-0.5" fill="currentColor" />
                      </span>
                    )}
                    {g.target.isHidden && <span className="ml-2 text-red-400">(đang ẩn)</span>}
                  </p>
                  <p className="text-sm text-steam-text mt-1 whitespace-pre-line break-words">{g.target.content}</p>
                </div>
              ) : (
                <p className="text-xs text-steam-muted">Nội dung đã bị xóa.</p>
              )}
              {g.notes.length > 0 && <p className="text-[11px] text-steam-muted">Ghi chú: {g.notes.join(" · ")}</p>}
              {g.target && (
                <div className="flex flex-wrap gap-1.5">
                  {g.target.isHidden ? (
                    <button disabled={busy === g.targetId} onClick={() => run(g, "unhide")} className="steam-btn text-xs bg-steam-surface-3 text-steam-text border border-steam-border">
                      <Eye size={12} /> Hiện lại
                    </button>
                  ) : (
                    <button disabled={busy === g.targetId} onClick={() => run(g, "hide")} className="steam-btn text-xs bg-red-500/15 text-red-400 border border-red-500/30">
                      {busy === g.targetId ? <Loader2 size={12} className="animate-spin" /> : <EyeOff size={12} />} Ẩn nội dung
                    </button>
                  )}
                  {status === "Open" && (
                    <button disabled={busy === g.targetId} onClick={() => run(g, "dismiss")} className="steam-btn text-xs bg-steam-surface-3 text-steam-muted border border-steam-border">
                      <XCircle size={12} /> Không vi phạm
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CommentsTab() {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [data, setData] = useState<{ total: number; items: CommentRow[] } | null>(null);
  useEffect(() => {
    const t = window.setTimeout(() => setQ(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);
  const load = useCallback(async () => {
    const res = await apiFetch(apiUrl(`/api/admin/moderation/comments${q ? `?search=${encodeURIComponent(q)}` : ""}`));
    if (res.ok) setData(await res.json());
  }, [q]);
  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (c: CommentRow) => {
    await act("Comment", c.id, c.isHidden ? "unhide" : "hide");
    load();
  };

  return (
    <div className="space-y-3">
      <div className="relative sm:w-80">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-steam-muted" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nội dung, người viết, game" className="w-full steam-input pl-8" />
      </div>
      {!data ? (
        <div className="py-10 flex justify-center text-steam-muted">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : (
        <div className="bg-steam-surface border border-steam-border rounded-sm divide-y divide-steam-border">
          {data.items.length === 0 && <p className="p-6 text-center text-sm text-steam-muted">Chưa có bình luận.</p>}
          {data.items.map((c) => (
            <div key={c.id} className={`p-3 flex gap-3 ${c.isHidden ? "opacity-50" : ""}`}>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-steam-muted">
                  <b className="text-white">{c.displayName}</b> · {c.gameName} · {fmt(c.createdAt)} {c.parentId && "· trả lời"}
                </p>
                <p className="text-sm text-steam-text whitespace-pre-line break-words">{c.content}</p>
              </div>
              <button onClick={() => toggle(c)} className="self-start inline-flex items-center gap-1 px-2 py-1 rounded-sm text-[11px] border border-steam-border text-steam-muted hover:text-steam-text">
                {c.isHidden ? <Eye size={11} /> : <EyeOff size={11} />} {c.isHidden ? "Hiện" : "Ẩn"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Moderation() {
  const [tab, setTab] = useState<"reports" | "comments">("reports");
  return (
    <div className="space-y-4 md:space-y-5">
      <div>
        <h1 className="text-lg font-bold text-white font-mono tracking-tight">Kiểm duyệt</h1>
        <p className="text-xs text-steam-muted mt-0.5">Báo cáo vi phạm từ khách và bình luận thảo luận</p>
      </div>
      <div className="flex border-b border-steam-border">
        {[
          { key: "reports" as const, label: "Báo cáo vi phạm", icon: Flag },
          { key: "comments" as const, label: "Bình luận", icon: MessageSquare },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm border-b-2 -mb-px ${tab === t.key ? "border-steam-blue text-steam-blue" : "border-transparent text-steam-muted hover:text-steam-text"}`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>
      {tab === "reports" ? <ReportsTab /> : <CommentsTab />}
    </div>
  );
}
