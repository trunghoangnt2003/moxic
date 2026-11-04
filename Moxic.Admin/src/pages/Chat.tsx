import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Link2, Loader2, Search, Send, Trash2, X } from "lucide-react";
import { apiFetch, apiUrl } from "../lib/api";
import { readApiError } from "../lib/luckySpinAdmin";

interface ThreadRow {
  id: string;
  code: string;
  name: string | null;
  contact: string | null;
  orderCode: string | null;
  adminUnread: number;
  lastMessageAt: string;
  email: string | null;
  lastText: string | null;
  lastFromAdmin: boolean;
}

interface Msg {
  id: string;
  fromAdmin: boolean;
  text: string;
  orderCode: string | null;
  via: string | null;
  createdAt: string;
}

interface ThreadDetail {
  id: string;
  code: string;
  name: string | null;
  contact: string | null;
  orderCode: string | null;
  userId: string | null;
  messages: Msg[];
}

interface TelegramInfo {
  enabled: boolean;
  botUsername: string | null;
  chats: { chatId: number; name: string | null; linkedAt: string }[];
}

const fmt = (iso: string) => new Date(iso).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });

function TelegramPanel({ onClose }: { onClose: () => void }) {
  const [info, setInfo] = useState<TelegramInfo | null>(null);
  const [code, setCode] = useState<{ code: string; botUsername: string | null } | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const res = await apiFetch(apiUrl("/api/admin/chat/telegram"));
    if (res.ok) setInfo(await res.json());
  }, []);
  useEffect(() => {
    load();
    const t = window.setInterval(load, 5000); // picks up the link as soon as the bot confirms
    return () => window.clearInterval(t);
  }, [load]);

  const makeCode = async () => {
    setErr("");
    const res = await apiFetch(apiUrl("/api/admin/chat/telegram/link-code"), { method: "POST" });
    if (!res.ok) return setErr(await readApiError(res, "Không tạo được mã"));
    setCode(await res.json());
  };

  const unlink = async (chatId: number) => {
    if (!confirm("Gỡ liên kết Telegram này?")) return;
    await apiFetch(apiUrl(`/api/admin/chat/telegram/${chatId}`), { method: "DELETE" });
    load();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="w-full sm:max-w-md bg-steam-surface border border-steam-border rounded-t-lg sm:rounded-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Liên kết Telegram</h2>
          <button type="button" onClick={onClose} className="p-1 text-steam-muted hover:text-steam-text" aria-label="Đóng">
            <X size={16} />
          </button>
        </div>
        {!info ? (
          <Loader2 className="animate-spin text-steam-muted" />
        ) : !info.enabled ? (
          <p className="text-sm text-amber-300">Server chưa có Telegram__BotToken.</p>
        ) : (
          <>
            <p className="text-xs text-steam-muted">
              Nên dùng <b>nhóm Telegram có Chủ đề</b> để nhiều người cùng xử lý: bot tự tạo tab <b>🛒 Đơn hàng</b> và <b>💬 Tin nhắn khách</b>. Trong nhóm: Reply tin khách để trả lời, <code>/tab</code> tách khách ra tab riêng, <code>/exit</code> để đóng tab.
            </p>
            <div className="space-y-2">
              {info.chats.length === 0 && <p className="text-xs text-amber-300">Chưa liên kết Telegram nào — khách chưa thấy nút chat.</p>}
              {info.chats.map((c) => (
                <div key={c.chatId} className="flex items-center justify-between gap-2 px-3 py-2 bg-steam-surface-2 rounded-sm text-sm">
                  <span className="text-steam-text">
                    {c.name ?? c.chatId} <span className="text-[11px] text-steam-muted">· {fmt(c.linkedAt)}</span>
                  </span>
                  <button type="button" onClick={() => unlink(c.chatId)} className="p-1 text-red-300 hover:text-red-200" aria-label="Gỡ">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            {code ? (
              <div className="p-3 border border-steam-blue/40 bg-steam-blue/5 rounded-sm space-y-2 text-sm">
                <p className="text-[11px] text-steam-muted">
                  Dùng nhóm: tạo nhóm → Cài đặt → bật <b>Chủ đề (Topics)</b> → thêm{" "}
                  {code.botUsername ? "@" + code.botUsername : "bot"} và đặt làm <b>Quản trị viên</b> (quyền Quản lý chủ đề + Xóa tin nhắn) → gửi lệnh bên dưới <b>trong nhóm</b>.
                </p>
                <p className="text-steam-text">
                  1. Hoặc chat riêng: mở{" "}
                  {code.botUsername ? (
                    <a href={`https://t.me/${code.botUsername}`} target="_blank" rel="noreferrer" className="text-steam-blue underline">
                      @{code.botUsername}
                    </a>
                  ) : (
                    "bot"
                  )}{" "}
                  trên Telegram
                </p>
                <p className="text-steam-text">2. Gửi tin nhắn (trong nhóm hoặc chat riêng):</p>
                <p className="font-mono text-lg text-white bg-black/30 px-3 py-2 rounded-sm select-all">/link {code.code}</p>
                <p className="text-[11px] text-steam-muted">Mã hết hạn sau 10 phút. Danh sách bên trên sẽ tự cập nhật.</p>
              </div>
            ) : (
              <button type="button" onClick={makeCode} className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-sm bg-steam-blue text-white text-sm font-semibold">
                <Link2 size={14} /> Liên kết Telegram mới
              </button>
            )}
            {err && <p className="text-xs text-red-300">{err}</p>}
          </>
        )}
      </div>
    </div>
  );
}

export default function Chat() {
  const [threads, setThreads] = useState<ThreadRow[] | null>(null);
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [showTg, setShowTg] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const loadThreads = useCallback(async () => {
    const res = await apiFetch(apiUrl(`/api/admin/chat/threads${search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ""}`));
    if (res.ok) setThreads(await res.json());
  }, [search]);

  const loadDetail = useCallback(async () => {
    if (!activeId) return;
    const res = await apiFetch(apiUrl(`/api/admin/chat/threads/${activeId}`));
    if (res.ok) setDetail(await res.json());
  }, [activeId]);

  useEffect(() => {
    loadThreads();
    const t = window.setInterval(loadThreads, 8000);
    return () => window.clearInterval(t);
  }, [loadThreads]);

  useEffect(() => {
    setDetail(null);
    loadDetail();
    const t = window.setInterval(loadDetail, 4000);
    return () => window.clearInterval(t);
  }, [loadDetail]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [detail?.messages.length]);

  const send = async () => {
    if (!activeId || !reply.trim() || sending) return;
    setSending(true);
    try {
      const res = await apiFetch(apiUrl(`/api/admin/chat/threads/${activeId}/reply`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: reply }),
      });
      if (res.ok) {
        setReply("");
        loadDetail();
        loadThreads();
      } else alert(await readApiError(res, "Gửi thất bại"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-white font-mono tracking-tight">Chat khách hàng</h1>
          <p className="text-xs text-steam-muted">Trả lời ở đây hoặc Reply trực tiếp trong Telegram.</p>
        </div>
        <button type="button" onClick={() => setShowTg(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-sm border border-steam-border text-sm text-steam-text hover:border-steam-blue">
          <Link2 size={14} /> Telegram
        </button>
      </div>

      <div className="grid md:grid-cols-[320px_1fr] gap-3 h-[calc(100vh-11rem)] min-h-[420px]">
        {/* Thread list */}
        <div className={`bg-steam-surface border border-steam-border rounded-sm flex flex-col min-h-0 ${activeId ? "hidden md:flex" : "flex"}`}>
          <div className="p-2 border-b border-steam-border flex items-center gap-2">
            <Search size={14} className="text-steam-muted" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Mã #, đơn, tên, SĐT…" className="flex-1 bg-transparent text-sm text-steam-text focus:outline-none" />
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-steam-border/60">
            {threads == null ? (
              <div className="p-6 flex justify-center text-steam-muted">
                <Loader2 className="animate-spin" />
              </div>
            ) : threads.length === 0 ? (
              <p className="p-6 text-center text-sm text-steam-muted">Chưa có cuộc chat nào.</p>
            ) : (
              threads.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveId(t.id)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-steam-surface-2/60 ${activeId === t.id ? "bg-steam-surface-2" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-white truncate flex-1">{t.name || t.email || t.contact || "Khách"}</span>
                    {t.adminUnread > 0 && <span className="min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center">{t.adminUnread}</span>}
                  </div>
                  <p className="text-xs text-steam-muted truncate">
                    {t.lastFromAdmin ? "Bạn: " : ""}
                    {t.lastText}
                  </p>
                  <p className="text-[10px] text-steam-muted mt-0.5">
                    #{t.code} · {fmt(t.lastMessageAt)}
                    {t.orderCode ? ` · ${t.orderCode}` : ""}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Conversation */}
        <div className={`bg-steam-surface border border-steam-border rounded-sm flex-col min-h-0 ${activeId ? "flex" : "hidden md:flex"}`}>
          {!activeId ? (
            <p className="m-auto text-sm text-steam-muted">Chọn một cuộc chat</p>
          ) : !detail ? (
            <Loader2 className="m-auto animate-spin text-steam-muted" />
          ) : (
            <>
              <div className="px-3 py-2 border-b border-steam-border flex items-center gap-2">
                <button type="button" onClick={() => setActiveId(null)} className="md:hidden p-1 text-steam-muted" aria-label="Quay lại">
                  <ArrowLeft size={16} />
                </button>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {detail.name || "Khách"} <span className="text-steam-muted font-mono text-xs">#{detail.code}</span>
                  </p>
                  <p className="text-[11px] text-steam-muted truncate">
                    {detail.contact ?? ""}
                    {detail.orderCode ? ` · Đơn ${detail.orderCode}` : ""}
                    {detail.userId ? " · có tài khoản" : " · khách vãng lai"}
                  </p>
                </div>
              </div>
              <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-2">
                {detail.messages.map((m, i) => {
                  const showOrder = m.orderCode && m.orderCode !== detail.messages[i - 1]?.orderCode;
                  return (
                    <div key={m.id}>
                      {showOrder && <p className="text-center text-[10px] text-steam-muted my-2">— đơn {m.orderCode} —</p>}
                      <div className={`flex ${m.fromAdmin ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap break-words ${m.fromAdmin ? "bg-steam-blue/20 text-white" : "bg-steam-surface-2 text-steam-text"}`}>
                          {m.text}
                          <span className="block text-[10px] text-steam-muted mt-0.5">
                            {fmt(m.createdAt)}
                            {m.via === "telegram" ? " · Telegram" : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="p-2 border-t border-steam-border flex items-end gap-2">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={2}
                  placeholder="Trả lời khách…"
                  className="flex-1 resize-none bg-steam-surface-2 border border-steam-border rounded-sm px-3 py-2 text-sm text-steam-text focus:outline-none focus:border-steam-blue"
                />
                <button type="button" onClick={send} disabled={sending || !reply.trim()} className="h-10 w-10 inline-flex items-center justify-center rounded-sm bg-steam-blue text-white disabled:opacity-40" aria-label="Gửi">
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {showTg && <TelegramPanel onClose={() => setShowTg(false)} />}
    </div>
  );
}
