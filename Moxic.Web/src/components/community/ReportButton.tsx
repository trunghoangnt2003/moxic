import { useState } from "react";
import { Flag, Loader2, X } from "lucide-react";
import toast from "react-hot-toast";
import { apiError, reportContent, type ReportReason } from "../../lib/communityApi";

import { t } from "../../lib/i18n";
const REASONS: { value: ReportReason; label: string }[] = [
  { value: "Spam", label: t("Spam / quảng cáo") },
  { value: "Offensive", label: t("Xúc phạm, thô tục") },
  { value: "Scam", label: t("Lừa đảo, giả mạo") },
  { value: "Spoiler", label: t("Tiết lộ nội dung (spoiler)") },
  { value: "Other", label: t("Lý do khác") },
];

/** Small flag icon that opens a reason picker and files a report. */
export default function ReportButton({ targetType, targetId }: { targetType: "Review" | "Comment"; targetId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("Spam");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await reportContent(targetType, targetId, reason, note.trim() || undefined);
      toast.success(t("Đã gửi báo cáo. Cảm ơn bạn!"));
      setDone(true);
      setOpen(false);
    } catch (e) {
      toast.error(apiError(e, t("Không gửi được báo cáo")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={done}
        title={done ? t("Đã báo cáo") : t("Báo cáo vi phạm")}
        aria-label={t("Báo cáo vi phạm")}
        className="p-1 text-text-muted/60 hover:text-negative disabled:text-negative/60 cursor-pointer disabled:cursor-default"
      >
        <Flag className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/70" onClick={() => setOpen(false)}>
          <div role="dialog" aria-label={t("Báo cáo vi phạm")} onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-sm bg-bg-surface border border-white/10 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-display font-bold flex items-center gap-2">
                <Flag className="w-4 h-4 text-negative" /> {t("Báo cáo vi phạm")}
              </p>
              <button type="button" onClick={() => setOpen(false)} aria-label={t("Đóng")} className="p-1 text-text-muted hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1.5">
              {REASONS.map((r) => (
                <label key={r.value} className={`flex items-center gap-2.5 px-3 py-2 border cursor-pointer text-sm ${reason === r.value ? "border-negative/60 bg-negative/10 text-white" : "border-border text-text-secondary"}`}>
                  <input type="radio" name="reason" className="accent-negative" checked={reason === r.value} onChange={() => setReason(r.value)} />
                  {r.label}
                </label>
              ))}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 300))}
              rows={2}
              placeholder={t("Mô tả thêm (không bắt buộc)")}
              className="w-full bg-bg-base border border-border px-3 py-2 text-sm focus:outline-none focus:border-negative/60 resize-none"
            />
            <button type="button" onClick={submit} disabled={busy} className="w-full h-11 bg-negative hover:bg-negative text-on-solid text-sm font-bold disabled:opacity-50 cursor-pointer">
              {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t("Gửi báo cáo")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
