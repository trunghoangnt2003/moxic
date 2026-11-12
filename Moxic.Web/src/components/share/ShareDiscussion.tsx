import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Flag, Loader2, Send } from "lucide-react";
import toast from "react-hot-toast";
import { t } from "../../lib/i18n";
import { apiError } from "../../lib/communityApi";
import { postShareMessage, reportShareMessage } from "../../lib/shareApi";
import { useShareMessages } from "../../hooks/useShare";

/** Room discussion: only the 2 members see it. System lines mark joins, payments and the order. */
export default function ShareDiscussion({ code, partnerName }: { code: string; partnerName?: string }) {
  const { data: messages } = useShareMessages(code, true);
  const [text, setText] = useState("");
  const qc = useQueryClient();
  const listRef = useRef<HTMLDivElement>(null);

  const send = useMutation({
    mutationFn: () => postShareMessage(code, text),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["share", "messages", code.toUpperCase()] });
    },
    onError: (e) => toast.error(apiError(e, t("Không gửi được tin nhắn"))),
  });
  const report = useMutation({
    mutationFn: (id: string) => reportShareMessage(code, id),
    onSuccess: () => toast.success(t("Đã báo cáo, Moxic sẽ xem xét.")),
    onError: (e) => toast.error(apiError(e, t("Không báo cáo được"))),
  });

  const count = messages?.length ?? 0;
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count]);

  return (
    <section id="thao-luan" className="flex min-h-[440px] flex-col rounded-lg border border-border bg-bg-surface p-4 sm:p-5 lg:h-full">
      <h2 className="mb-3 flex flex-wrap items-center gap-2 font-display text-base font-semibold text-text-primary">
        {t("Thảo luận trong phòng")}
        <span className="rounded-full border border-border bg-bg-elevated px-2 py-0.5 font-body text-[11px] font-normal text-text-muted">{t("chỉ 2 thành viên thấy")}</span>
      </h2>
      <div ref={listRef} className="flex max-h-[520px] flex-1 flex-col gap-2.5 overflow-y-auto pr-1" aria-live="polite">
        {(messages ?? []).map((m) =>
          m.system ? (
            <p key={m.id} className="self-center px-2 text-center text-xs text-text-muted">
              {m.text} · {new Date(m.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
            </p>
          ) : (
            <div key={m.id} className={`group max-w-[85%] rounded-xl px-3 py-2 text-sm ${m.mine ? "self-end border border-accent/25 bg-accent/[0.14]" : "self-start bg-bg-elevated"}`}>
              <p className="mb-0.5 flex items-center gap-2 text-[11px] text-text-muted">
                {m.mine ? t("Bạn") : m.authorName}
                {!m.mine && !m.reported && (
                  <button type="button" onClick={() => report.mutate(m.id)} aria-label={t("Báo cáo tin nhắn")} className="opacity-0 transition-opacity hover:text-negative focus:opacity-100 group-hover:opacity-100">
                    <Flag className="h-3 w-3" />
                  </button>
                )}
              </p>
              <p className="whitespace-pre-wrap break-words text-text-primary">{m.text}</p>
            </div>
          ),
        )}
        {messages && messages.length === 0 && <p className="m-auto text-sm text-text-muted">{t("Chưa có tin nhắn.")}</p>}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) send.mutate();
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          placeholder={partnerName ? t("Nhắn cho {0}…", [partnerName]) : t("Nhắn trong phòng…")}
          className="h-11 min-w-0 flex-1 rounded-md border border-border bg-bg-base px-3 text-sm text-text-primary placeholder:text-text-placeholder focus:border-accent focus:outline-none"
        />
        <button type="submit" disabled={send.isPending || !text.trim()} aria-label={t("Gửi")} className="inline-flex h-11 items-center gap-1.5 rounded-md bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-50">
          {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          <span className="hidden sm:inline">{t("Gửi")}</span>
        </button>
      </form>
    </section>
  );
}
