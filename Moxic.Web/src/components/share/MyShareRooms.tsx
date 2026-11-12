import { Link } from "react-router-dom";
import { Check, ChevronRight, MessageCircle, Users } from "lucide-react";
import { SectionLoader } from "../shared/MoxicLoader";
import { GameCover, ShareStatusBadge, accountTypeLabel } from "./ShareParts";
import { useMyShareRooms } from "../../hooks/useShare";
import { t } from "../../lib/i18n";
import { formatPrice } from "../../lib/utils";

const ORDER = ["paying", "waiting", "full", "installing", "done", "cancelled"];

/** Rooms I created or joined (current first): status, who paid, links to the room, its chat and the order. */
export default function MyShareRooms() {
  const { data, isLoading } = useMyShareRooms();
  const rooms = [...(data ?? [])].sort((a, b) => {
    const left = Number(!!a.myLeftReason) - Number(!!b.myLeftReason);
    return left !== 0 ? left : ORDER.indexOf(a.displayStatus) - ORDER.indexOf(b.displayStatus);
  });

  return (
    <>
      {isLoading ? (
        <SectionLoader />
      ) : rooms.length === 0 ? (
        <div className="rounded-lg border border-border bg-bg-surface py-16 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-accent/60" />
          <p className="font-semibold text-text-primary">{t("Bạn chưa tham gia phòng share nào")}</p>
          <p className="mb-5 mt-1 text-sm text-text-muted">{t("Share mua game cùng người khác để trả ít hơn.")}</p>
          <Link to="/share" className="inline-flex h-11 items-center rounded-md bg-accent px-6 text-sm font-bold text-on-accent">{t("Xem phòng đang tìm người")}</Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {rooms.map((r) => {
            const me = r.seats.find((s) => s.isMe);
            return (
              <li key={r.code}>
                <div className={`flex flex-wrap items-center gap-4 rounded-lg border border-border bg-bg-surface p-3 ${r.myLeftReason ? "opacity-70" : ""}`}>
                  <GameCover url={r.coverUrl} className="h-20 w-16 shrink-0 rounded-md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <ShareStatusBadge status={r.myLeftReason && r.displayStatus !== "cancelled" ? "cancelled" : r.displayStatus} paid={r.seats.filter((s) => s.paid).length} />
                      <span className="font-mono text-xs text-text-muted">{r.code}</span>
                      {r.myNeedsRefund && !r.myRefundedAt && <span className="text-xs text-caution">{t("Chờ hoàn tiền")}</span>}
                      {r.myRefundedAt && <span className="text-xs text-positive">{t("Đã hoàn tiền")}</span>}
                    </div>
                    <p className="mt-1 truncate font-semibold text-text-primary">{r.gameName}</p>
                    <p className="text-xs text-text-muted">
                      {accountTypeLabel(r.accountType)}
                      {me ? ` · ${t("phần của bạn {0}", [formatPrice(me.amountDue)])}` : ""}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-3">
                      {r.seats.map((s) => (
                        <span key={s.id} className="inline-flex items-center gap-1 text-xs text-text-secondary">
                          <span className="grid h-5 w-5 place-items-center rounded-full bg-bg-elevated text-[10px] font-semibold">{s.displayName.charAt(0).toUpperCase()}</span>
                          {s.isMe ? t("Bạn") : s.displayName}
                          {s.paid ? <Check className="h-3.5 w-3.5 text-positive" aria-label={t("Đã thanh toán")} /> : <span className="text-caution">· {t("chưa trả")}</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex w-full gap-2 sm:w-auto sm:flex-col">
                    <Link to={`/share/${r.code}`} className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-md bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover">
                      {t("Vào phòng")} <ChevronRight className="h-4 w-4" />
                    </Link>
                    {r.isMember && (
                      <Link to={`/share/${r.code}#thao-luan`} className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-md border border-border px-4 text-sm text-text-primary hover:border-border-hover">
                        <MessageCircle className="h-4 w-4" /> {t("Thảo luận")}
                      </Link>
                    )}
                    {r.orderCode && (
                      <Link to={`/account/orders/${r.orderCode}`} className="inline-flex h-9 flex-1 items-center justify-center rounded-md border border-border px-4 text-sm text-text-primary hover:border-border-hover">
                        {t("Xem đơn")}
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
