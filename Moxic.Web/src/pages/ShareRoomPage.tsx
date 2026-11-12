import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Copy, Info, Loader2, LogOut, Lock, Trash2, UserMinus } from "lucide-react";
import Container from "../components/layout/Container";
import { SectionLoader } from "../components/shared/MoxicLoader";
import SharePayPanel from "../components/share/SharePayPanel";
import ShareDiscussion from "../components/share/ShareDiscussion";
import { Chip, EmptySeat, GameCover, SeatCard, ShareStatusBadge, ShareSteps, SplitBar, accountTypeLabel, copyText } from "../components/share/ShareParts";
import { useShareAction, useShareRoom } from "../hooks/useShare";
import { useMe } from "../hooks/useAccount";
import { usePageMeta } from "../hooks/usePageMeta";
import { basename, t } from "../lib/i18n";
import { formatPrice } from "../lib/utils";
import { cancelShareRoom, joinShareRoom, kickSharePartner, leaveShareRoom, setSharePercent, shareRoomUrl, splitAmounts } from "../lib/shareApi";

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** /share/:code — the room: members, split, who paid, my payment, and the members-only discussion. */
export default function ShareRoomPage() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const { data: me } = useMe();
  const { data: room, isLoading, error } = useShareRoom(code);
  const now = useNow();
  usePageMeta(room ? t("Share {0} · mã {1}", [room.gameName, room.code]) : t("Phòng share"), t("Cùng mua game Xbox, mỗi người tự trả phần của mình."));

  const join = useShareAction(code, () => joinShareRoom(code), t("Bạn đã vào phòng"));
  const leave = useShareAction(code, () => leaveShareRoom(code), t("Bạn đã rời phòng"));
  const kick = useShareAction(code, () => kickSharePartner(code), t("Đã mời người share ra khỏi phòng"));
  const cancel = useShareAction(code, () => cancelShareRoom(code), t("Đã hủy phòng"));
  const percent = useShareAction(code, (p: number) => setSharePercent(code, p));

  if (isLoading) return <SectionLoader />;
  if (error || !room)
    return (
      <Container className="mb-20 mt-16 max-w-xl text-center">
        <p className="font-display text-2xl font-bold text-text-primary">{t("Không tìm thấy phòng share")}</p>
        <p className="mt-2 text-sm text-text-muted">{t("Kiểm tra lại mã phòng hoặc tìm phòng khác.")}</p>
        <Link to="/share" className="mt-6 inline-flex h-11 items-center rounded-md bg-accent px-6 text-sm font-bold text-on-accent">{t("Tìm người share")}</Link>
      </Container>
    );

  const url = shareRoomUrl(room.code, basename ?? "");
  const paidCount = room.seats.filter((s) => s.paid).length;
  const owner = room.seats.find((s) => s.isOwner);
  const partner = room.seats.find((s) => !s.isOwner);
  const mine = room.seats.find((s) => s.isMe);
  const openAmount = room.totalPrice - (owner?.shareAmount ?? 0);
  const canEditSplit = room.isOwner && !room.locked && (room.status === "Open" || room.status === "Full");
  const fb = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;

  const onJoin = () => {
    if (!me) {
      navigate(`/login?redirect=${encodeURIComponent(`/share/${room.code}`)}`);
      return;
    }
    join.mutate(undefined);
  };

  return (
    <Container className="mb-20 mt-6">
      <div className="overflow-hidden rounded-xl border border-border bg-bg-base">
        {/* Hero */}
        <div className="relative isolate flex flex-wrap items-center gap-5 p-5 sm:p-7">
          {room.coverUrl && <img src={room.coverUrl} alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full object-cover opacity-25 blur-sm" />}
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-bg-base via-bg-base/90 to-bg-base/50" />
          <GameCover url={room.coverUrl} className="h-32 w-24 shrink-0 rounded-lg shadow-2xl shadow-black/50" />
          <div className="min-w-0 flex-1">
            <Chip gold>{t("Phòng share · tối đa 2 người")}</Chip>
            <h1 className="mt-2 font-display text-2xl font-bold text-text-primary sm:text-3xl">{room.gameName}</h1>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <Chip>{accountTypeLabel(room.accountType)}</Chip>
              <Chip>{t("Tổng {0}", [formatPrice(room.totalPrice)])}</Chip>
              <Chip>{t("Chia {0}/{1}", [room.ownerPercent, 100 - room.ownerPercent])}</Chip>
              {!room.isPublic && <Chip><Lock className="h-3 w-3" /> {t("Riêng tư")}</Chip>}
              <ShareStatusBadge status={room.displayStatus} paid={paidCount} />
            </div>
          </div>
          <div className="w-full sm:w-auto sm:text-right">
            <p className="text-xs text-text-muted">{t("Mã phòng")}</p>
            <button type="button" onClick={() => copyText(room.code, t("Đã sao chép mã phòng"))} className="font-display text-2xl font-semibold tracking-[0.15em] text-accent">
              {room.code}
            </button>
            <div className="mt-2.5 flex flex-wrap gap-2 sm:justify-end">
              <button type="button" onClick={() => copyText(url, t("Đã sao chép link phòng"))} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-bg-surface px-3 text-sm text-text-primary hover:border-border-hover">
                <Copy className="h-4 w-4" /> {t("Sao chép link")}
              </button>
              <a href={fb} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center rounded-md bg-[#1877f2] px-3 text-sm font-medium text-on-solid hover:brightness-110">
                {t("Đăng Facebook")}
              </a>
            </div>
          </div>
        </div>

        <ShareSteps status={room.displayStatus} paid={paidCount} />

        {room.status === "Cancelled" && (
          <p className="flex items-center gap-2 border-b border-border bg-bg-surface px-5 py-3 text-sm text-text-secondary sm:px-7">
            <Info className="h-4 w-4 text-caution" />
            {room.cancelReason === "expired" ? t("Phòng đã đóng vì quá 7 ngày chưa đủ tiền.") : t("Phòng đã đóng.")}
            {room.myNeedsRefund && !room.myRefundedAt && ` ${t("Moxic sẽ hoàn tiền cho bạn, hãy nhắn hỗ trợ số tài khoản nhận tiền.")}`}
            {room.myRefundedAt && ` ${t("Moxic đã hoàn tiền cho bạn.")}`}
          </p>
        )}
        {room.myLeftReason && room.status !== "Cancelled" && (
          <p className="border-b border-border bg-bg-surface px-5 py-3 text-sm text-text-secondary sm:px-7">
            {room.myLeftReason === "timeout" ? t("Bạn đã rời phòng vì quá 48 giờ chưa thanh toán.") : room.myLeftReason === "kicked" ? t("Chủ phòng đã mời bạn ra khỏi phòng.") : t("Bạn đã rời phòng này.")}
            {room.myNeedsRefund && ` ${t("Moxic sẽ hoàn lại tiền bạn đã chuyển.")}`}
          </p>
        )}

        <div className="grid gap-5 p-4 sm:p-7 lg:grid-cols-[1.35fr_1fr]">
          <div className="flex flex-col gap-5">
            <section className="rounded-lg border border-border bg-bg-surface p-4 sm:p-5">
              <h2 className="mb-3 font-display text-base font-semibold text-text-primary">{t("Thành viên và phần tiền")}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {room.seats.map((s) => <SeatCard key={s.id} seat={s} now={now} accountType={room.accountType} />)}
                {room.seats.length < 2 && room.status === "Open" && <EmptySeat amount={openAmount} />}
              </div>

              <div className="mb-1 mt-4">
                <SplitBar ownerPercent={room.ownerPercent} ownerName={owner?.displayName ?? ""} partnerName={partner?.displayName} />
              </div>

              {canEditSplit && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-text-muted">{t("Đổi tỷ lệ:")}</span>
                  {[50, 60, 70, 40, 30].map((p) => (
                    <button
                      key={p}
                      type="button"
                      disabled={percent.isPending}
                      onClick={() => percent.mutate(p)}
                      className={`rounded-full border px-2.5 py-0.5 text-xs ${room.ownerPercent === p ? "border-accent bg-accent text-on-accent" : "border-border text-text-secondary hover:border-border-hover"}`}
                    >
                      {p}/{100 - p}
                    </button>
                  ))}
                  <span className="text-xs text-text-muted">{t("Bạn trả {0}", [formatPrice(splitAmounts(room.totalPrice, room.ownerPercent).owner)])}</span>
                </div>
              )}

              <p className="mt-3 flex gap-1.5 text-xs text-text-muted">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {room.locked
                  ? t("Tỷ lệ và kiểu tài khoản đã khoá vì có người thanh toán.")
                  : t("Tỷ lệ chỉ đổi được khi chưa ai thanh toán.")}{" "}
                {t("Đơn chỉ được tạo khi cả hai đã trả. Quá 48 giờ không trả sẽ bị mời ra khỏi phòng, quá 7 ngày phòng đóng và Moxic hoàn tiền.")}
              </p>

              {/* Member actions */}
              {room.isMember && (room.status === "Open" || room.status === "Full") && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                  {room.isOwner && partner && !partner.paid && (
                    <button type="button" onClick={() => confirm(t("Mời {0} ra khỏi phòng?", [partner.displayName])) && kick.mutate(undefined)} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm text-text-secondary hover:border-negative/60 hover:text-negative">
                      <UserMinus className="h-4 w-4" /> {t("Mời ra khỏi phòng")}
                    </button>
                  )}
                  {room.isOwner && paidCount === 0 && (
                    <button type="button" onClick={() => confirm(t("Hủy phòng share này?")) && cancel.mutate(undefined)} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm text-text-secondary hover:border-negative/60 hover:text-negative">
                      <Trash2 className="h-4 w-4" /> {t("Hủy phòng")}
                    </button>
                  )}
                  {mine && !mine.paid && !room.isOwner && (
                    <button type="button" onClick={() => confirm(t("Rời phòng share này?")) && leave.mutate(undefined)} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm text-text-secondary hover:border-negative/60 hover:text-negative">
                      <LogOut className="h-4 w-4" /> {t("Rời phòng")}
                    </button>
                  )}
                </div>
              )}
            </section>

            {room.isMember ? (
              <SharePayPanel room={room} />
            ) : room.status === "Open" ? (
              <section className="rounded-lg border border-accent/30 bg-accent/[0.06] p-5 text-center">
                <p className="font-display text-lg font-semibold text-text-primary">{t("Phần còn trống: {0}", [formatPrice(openAmount)])}</p>
                <p className="mt-1 text-sm text-text-muted">{t("Vào phòng để thảo luận với {0} và thanh toán phần của bạn.", [owner?.displayName ?? ""])}</p>
                <button type="button" onClick={onJoin} disabled={join.isPending} className="mt-4 inline-flex h-11 items-center gap-2 rounded-md bg-accent px-8 font-bold text-on-accent hover:bg-accent-hover disabled:opacity-60">
                  {join.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {me ? t("Vào phòng") : t("Đăng nhập để vào phòng")}
                </button>
              </section>
            ) : null}

            {room.orderCode && (
              <Link to={`/account/orders/${room.orderCode}`} className="rounded-lg border border-positive/30 bg-positive/10 p-4 text-sm text-positive hover:bg-positive/15">
                {t("Đơn {0} đã được tạo. Theo dõi tiến trình cài game →", [room.orderCode])}
              </Link>
            )}
          </div>

          {room.isMember ? (
            <ShareDiscussion code={room.code} partnerName={room.seats.find((s) => !s.isMe)?.displayName} />
          ) : (
            <section className="grid min-h-[200px] place-items-center rounded-lg border border-dashed border-border p-6 text-center text-sm text-text-muted">
              <div>
                <Lock className="mx-auto mb-2 h-5 w-5" />
                {t("Khu thảo luận chỉ dành cho 2 thành viên trong phòng.")}
              </div>
            </section>
          )}
        </div>
      </div>
    </Container>
  );
}
