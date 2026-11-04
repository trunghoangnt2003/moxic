import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useMatch, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MessageCircleMore, Phone, Plus } from "lucide-react";
import { useContactSettings } from "../../hooks/useLuckySpin";
import { getChatConfig, getChatUnread, useChatUi } from "../../lib/chatApi";
import ChatPanel from "../chat/ChatPanel";

function MessengerGlyph({ className = "" }: { className?: string }) {
  // lucide 1.x has no brand icons — inline Messenger glyph.
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#fff"
        d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.44 3.14 7.17.16.14.26.35.27.57l.05 1.78c.02.57.6.94 1.12.71l1.99-.88c.17-.07.36-.09.53-.04.91.25 1.88.39 2.9.39 5.64 0 10-4.13 10-9.7S17.64 2 12 2z"
      />
      <path
        fill="#A033FF"
        d="M5.99 14.54l2.94-4.66c.47-.74 1.47-.93 2.17-.4l2.34 1.75c.21.16.51.16.72 0l3.16-2.4c.42-.32.97.18.69.63l-2.94 4.66c-.47.74-1.47.93-2.17.4l-2.34-1.75a.6.6 0 00-.72 0l-3.16 2.4c-.42.32-.97-.18-.69-.63z"
      />
    </svg>
  );
}

function HoverLabel({ children }: { children: ReactNode }) {
  return (
    <span className="pointer-events-none absolute right-full top-1/2 mr-3 hidden -translate-y-1/2 whitespace-nowrap rounded-full border border-border bg-bg-surface/95 px-3 py-1 text-xs font-medium text-text-primary opacity-0 shadow-lg backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 md:block">
      {children}
    </span>
  );
}

interface SecondaryItem {
  key: string;
  href: string;
  label: string;
  external: boolean;
  className: string;
  content: ReactNode;
}

export default function FloatingContact() {
  const { data } = useContactSettings();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const onGameDetail = useMatch("/games/:id");
  const chatOpen = useChatUi((s) => s.open);
  const openChat = useChatUi((s) => s.openChat);
  const { data: chatCfg } = useQuery({ queryKey: ["chat", "config"], queryFn: getChatConfig, staleTime: 5 * 60_000 });
  const chatEnabled = !!chatCfg?.enabled;
  const { data: unread = 0 } = useQuery({
    queryKey: ["chat", "unread"],
    queryFn: getChatUnread,
    enabled: chatEnabled && !chatOpen,
    refetchInterval: 30_000,
  });
  const [params, setParams] = useSearchParams();

  // ?chat=1 (e.g. from a "Moxic đã trả lời" notification) opens the chat.
  useEffect(() => {
    if (params.get("chat") !== "1" || !chatEnabled) return;
    openChat();
    params.delete("chat");
    setParams(params, { replace: true });
  }, [params, setParams, chatEnabled, openChat]);

  // Close on route change.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const messengerUrl = data?.messengerUrl ?? null;
  const zaloUrl = data?.zaloUrl ?? null;
  const phoneHref = data?.phoneHref ?? null;
  if (!chatEnabled && !messengerUrl && !zaloUrl && !phoneHref) return null;
  if (chatOpen) return <ChatPanel />;

  // Top to bottom: Phone, Zalo (secondary, only when expanded), then Messenger, then the toggle.
  const secondary: SecondaryItem[] = [];
  if (phoneHref) {
    secondary.push({
      key: "phone",
      href: phoneHref,
      label: `Gọi ${data?.phoneNumber ?? ""}`.trim(),
      external: false,
      className: "bg-emerald-500 hover:bg-emerald-400",
      content: <Phone className="h-5 w-5 text-white" strokeWidth={2.4} />,
    });
  }
  if (zaloUrl) {
    secondary.push({
      key: "zalo",
      href: zaloUrl,
      label: "Chat Zalo",
      external: true,
      className: "bg-[#0068FF] hover:brightness-110",
      content: <span className="font-display text-[13px] font-black tracking-tight text-white">Zalo</span>,
    });
  }
  if (chatEnabled && messengerUrl) {
    secondary.push({
      key: "messenger",
      href: messengerUrl,
      label: "Chat Messenger",
      external: true,
      className: "bg-gradient-to-br from-[#0099FF] via-[#A033FF] to-[#FF5280] hover:brightness-110",
      content: <MessengerGlyph className="h-6 w-6" />,
    });
  }
  const hasSecondary = secondary.length > 0;

  const position = onGameDetail
    ? "right-4 bottom-[calc(6rem+var(--sab))] lg:bottom-6 md:right-6"
    : "right-4 bottom-[calc(1rem+var(--sab))] md:right-6 md:bottom-6";

  return (
    <div className={`pointer-events-none fixed z-40 flex flex-col items-end gap-3 ${position}`}>
      {hasSecondary &&
        secondary.map((item, i) => {
          // Stagger: the item closest to the toggle animates first when opening.
          const delay = open ? (secondary.length - 1 - i) * 60 : i * 40;
          return (
            <a
              key={item.key}
              href={item.href}
              {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              aria-label={item.label}
              aria-hidden={!open}
              tabIndex={open ? 0 : -1}
              style={{ transitionDelay: `${delay}ms` }}
              className={`group relative mr-1 flex h-11 w-11 items-center justify-center rounded-full shadow-lg ring-1 ring-white/10 transition-[opacity,transform,filter,background-color] duration-300 ease-out ${item.className} ${
                open ? "pointer-events-auto translate-y-0 scale-100 opacity-100" : "pointer-events-none translate-y-3 scale-75 opacity-0"
              }`}
            >
              {item.content}
              <HoverLabel>{item.label}</HoverLabel>
            </a>
          );
        })}

      {chatEnabled && (
        <button
          type="button"
          onClick={() => openChat()}
          aria-label="Chat với Moxic"
          className="group pointer-events-auto relative flex h-[52px] w-[52px] items-center justify-center rounded-full bg-accent text-bg-base shadow-[0_6px_20px_rgba(201,169,110,0.45)] transition-transform duration-200 hover:scale-105 cursor-pointer"
        >
          <span className="pointer-events-none absolute inset-0 rounded-full bg-accent/40 animate-ping [animation-duration:2.4s]" />
          <MessageCircleMore className="relative h-7 w-7" strokeWidth={2.2} />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center ring-2 ring-bg-base">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
          <HoverLabel>Chat với Moxic</HoverLabel>
        </button>
      )}

      {!chatEnabled && messengerUrl && (
        <a
          href={messengerUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat Messenger"
          className="group pointer-events-auto relative flex h-[52px] w-[52px] items-center justify-center rounded-full shadow-[0_6px_20px_rgba(160,51,255,0.45)] transition-transform duration-200 hover:scale-105"
          style={{ background: "linear-gradient(135deg, #0099FF 0%, #A033FF 60%, #FF5280 100%)" }}
        >
          <span className="pointer-events-none absolute inset-0 rounded-full bg-[#A033FF]/40 animate-ping [animation-duration:2.4s]" />
          <MessengerGlyph className="relative h-7 w-7" />
          <HoverLabel>Chat Messenger</HoverLabel>
        </a>
      )}

      {hasSecondary && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Thu gọn" : "Mở thêm liên hệ"}
          className={`pointer-events-auto mr-1 flex h-11 w-11 items-center justify-center rounded-full border shadow-lg transition-colors duration-200 ${
            open
              ? "border-white/20 bg-bg-elevated text-white"
              : "border-border bg-bg-surface/95 text-text-primary backdrop-blur-sm hover:bg-bg-elevated"
          }`}
        >
          <Plus
            className={`h-5 w-5 transition-transform duration-300 ease-out ${open ? "rotate-45" : "rotate-0"}`}
            strokeWidth={2.4}
          />
        </button>
      )}
    </div>
  );
}
