import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Package, Send, X } from "lucide-react";
import { useMe, useMyOrders } from "../../hooks/useAccount";
import { getChatMessages, sendChatMessage, useChatUi, type ChatMsg } from "../../lib/chatApi";

const QUICK = ["Đơn của mình đã nhận được tiền chưa?", "Bao lâu thì cài xong game?", "Tư vấn giúp mình nên mua game nào"];

function time(iso: string) {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return d.toLocaleString("vi-VN", today ? { hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** Live chat with the shop. Messages go to the admins' Telegram; replies come back here. */
export default function ChatPanel() {
  const { open, orderCode, openChat, close } = useChatUi();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data: orders } = useMyOrders(1, open && !!me);
  const { data, isLoading } = useQuery({
    queryKey: ["chat", "messages"],
    queryFn: getChatMessages,
    enabled: open,
    refetchInterval: open ? 4000 : false,
  });

  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [guestOrder, setGuestOrder] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<ChatMsg[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  const hasThread = !!data?.thread;
  const needContact = !me && !hasThread;
  const attached = orderCode ?? data?.thread?.orderCode ?? null;

  const send = useMutation({
    mutationFn: (t: string) =>
      sendChatMessage({
        text: t,
        orderCode: (orderCode ?? (guestOrder.trim() || undefined)) || undefined,
        name: name.trim() || undefined,
        contact: contact.trim() || undefined,
      }),
    onMutate: (t) => {
      setError("");
      setPending((p) => [...p, { id: `tmp-${Date.now()}`, fromAdmin: false, text: t, orderCode: attached, createdAt: new Date().toISOString() }]);
      setText("");
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["chat"] });
      setPending([]);
      setGuestOrder("");
    },
    onError: (e: any, t) => {
      setPending([]);
      setText(t);
      setError(e?.response?.data?.error || "Không gửi được, thử lại nhé");
    },
  });

  const messages = useMemo(() => [...(data?.messages ?? []), ...pending], [data, pending]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, open]);

  // Lock page scroll behind the full-screen sheet on phones.
  useEffect(() => {
    if (!open || window.innerWidth >= 640) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const submit = (t: string) => {
    const v = t.trim();
    if (!v || send.isPending) return;
    if (needContact && !contact.trim()) {
      setError("Để lại SĐT/Zalo để Moxic liên hệ lại nếu bạn rời trang");
      return;
    }
    send.mutate(v);
  };

  return (
    <div className="fixed z-[55] inset-0 sm:inset-auto sm:right-6 sm:bottom-6 sm:w-[380px] sm:h-[min(600px,calc(100vh-6rem))] flex flex-col bg-bg-surface sm:border sm:border-white/10 shadow-2xl shadow-black/70 pt-[var(--sat)] sm:pt-0 animate-[popIn_0.2s_ease-out]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-14 shrink-0 border-b border-white/10 bg-gradient-to-r from-accent/15 to-transparent">
        <div className="relative">
          <img loading="lazy" decoding="async" src="/icon-192.png" alt="" className="w-9 h-9 rounded-lg" />
          <span className="absolute -right-0.5 -bottom-0.5 w-3 h-3 rounded-full bg-positive ring-2 ring-bg-surface" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold leading-tight">Moxic hỗ trợ</p>
          <p className="text-[11px] text-text-muted">Thường trả lời trong vài phút</p>
        </div>
        <button type="button" onClick={close} aria-label="Đóng chat" className="p-2 -mr-2 text-text-muted hover:text-white cursor-pointer">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Order context */}
      <div className="flex items-center gap-2 px-4 py-2 shrink-0 border-b border-white/5 text-xs">
        <Package className="w-3.5 h-3.5 text-text-muted shrink-0" />
        {me ? (
          <select
            value={attached ?? ""}
            onChange={(e) => openChat(e.target.value || null)}
            className="flex-1 min-w-0 bg-transparent text-text-secondary focus:outline-none cursor-pointer"
            aria-label="Đơn hàng cần hỗ trợ"
          >
            <option value="">Không về đơn hàng cụ thể</option>
            {attached && !orders?.items.some((o) => o.orderCode === attached) && <option value={attached}>{attached}</option>}
            {orders?.items.map((o) => (
              <option key={o.orderCode} value={o.orderCode}>
                {o.orderCode} · {o.items[0]?.gameName ?? ""}
              </option>
            ))}
          </select>
        ) : attached ? (
          <span className="flex-1 text-text-secondary">Về đơn {attached}</span>
        ) : (
          <input
            value={guestOrder}
            onChange={(e) => setGuestOrder(e.target.value.toUpperCase())}
            placeholder="Mã đơn hàng (nếu có), VD MOXIC-2026…"
            className="flex-1 min-w-0 bg-transparent text-text-secondary placeholder:text-text-muted focus:outline-none font-mono"
          />
        )}
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-2">
        {isLoading ? (
          <div className="flex justify-center pt-10">
            <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
          </div>
        ) : messages.length === 0 ? (
          <div className="pt-4 space-y-4">
            <div className="max-w-[85%] bg-bg-elevated border border-white/5 px-3 py-2 text-sm rounded-2xl rounded-tl-sm">
              Chào bạn 👋 Moxic có thể giúp gì? Hỏi về đơn hàng, cách cài game hay tư vấn chọn game đều được nhé!
            </div>
            <div className="flex flex-wrap gap-2">
              {QUICK.map((q) => (
                <button key={q} type="button" onClick={() => setText(q)} className="px-3 py-1.5 text-xs border border-accent/30 text-accent rounded-full hover:bg-accent/10 cursor-pointer">
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => {
            const prev = messages[i - 1];
            const showOrder = m.orderCode && m.orderCode !== prev?.orderCode;
            return (
              <div key={m.id}>
                {showOrder && (
                  <p className="text-center text-[10px] text-text-muted my-2">
                    Về đơn{" "}
                    {me ? (
                      <Link to={`/account/orders/${m.orderCode}`} onClick={() => window.innerWidth < 640 && close()} className="font-mono hover:text-accent">
                        {m.orderCode}
                      </Link>
                    ) : (
                      <span className="font-mono">{m.orderCode}</span>
                    )}
                  </p>
                )}
                <div className={`flex ${m.fromAdmin ? "justify-start" : "justify-end"}`}>
                  <div
                    className={`max-w-[85%] px-3 py-2 text-sm whitespace-pre-wrap break-words rounded-2xl ${
                      m.fromAdmin ? "bg-bg-elevated border border-white/5 rounded-tl-sm" : "bg-accent text-bg-base rounded-tr-sm"
                    } ${m.id.startsWith("tmp-") ? "opacity-60" : ""}`}
                  >
                    {m.text}
                    <span className={`block text-[10px] mt-0.5 ${m.fromAdmin ? "text-text-muted" : "text-bg-base/60"}`}>{time(m.createdAt)}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(text);
        }}
        className="shrink-0 border-t border-white/10 p-3 pb-[calc(0.75rem+var(--sab))] sm:pb-3 space-y-2"
      >
        {needContact && (
          <div className="grid grid-cols-2 gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Tên của bạn" className="h-9 px-3 bg-bg-base border border-border text-sm focus:outline-none focus:border-accent" />
            <input value={contact} onChange={(e) => setContact(e.target.value)} maxLength={100} placeholder="SĐT / Zalo *" className="h-9 px-3 bg-bg-base border border-border text-sm focus:outline-none focus:border-accent" />
          </div>
        )}
        {error && <p className="text-xs text-negative">{error}</p>}
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit(text);
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder="Nhập tin nhắn…"
            className="flex-1 min-h-[40px] max-h-32 resize-none px-3 py-2 bg-bg-base border border-border text-[16px] sm:text-sm focus:outline-none focus:border-accent"
          />
          <button type="submit" disabled={!text.trim() || send.isPending} aria-label="Gửi" className="h-10 w-10 shrink-0 inline-flex items-center justify-center bg-accent text-bg-base disabled:opacity-40 cursor-pointer">
            {send.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}
