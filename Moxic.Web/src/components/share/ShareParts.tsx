import { Link } from "react-router-dom";
import { Check, Clock, Gamepad2, ShieldCheck, Users } from "lucide-react";
import toast from "react-hot-toast";
import { t } from "../../lib/i18n";
import { formatPrice } from "../../lib/utils";
import { formatCountdown } from "../../hooks/useCountdown";
import type { ShareDisplayStatus, ShareRoomCard, ShareSeat, ShareAccountType } from "../../lib/shareApi";

export function copyText(text: string, done = t("Đã sao chép")) {
  navigator.clipboard?.writeText(text).then(
    () => toast.success(done),
    () => toast.error(t("Không sao chép được")),
  );
}

export const accountTypeLabel = (a: ShareAccountType) => (a === "Owner" ? t("Tài khoản của chủ phòng") : t("Tài khoản Moxic cấp"));

const STATUS: Record<ShareDisplayStatus, { label: () => string; cls: string }> = {
  waiting: { label: () => t("Chờ người"), cls: "border-info/40 bg-info/10 text-info" },
  paying: { label: () => t("Chờ thanh toán"), cls: "border-caution/40 bg-caution/10 text-caution" },
  full: { label: () => t("Đã đủ"), cls: "border-positive/40 bg-positive/10 text-positive" },
  installing: { label: () => t("Đang cài"), cls: "border-accent/40 bg-accent/10 text-accent" },
  done: { label: () => t("Hoàn tất"), cls: "border-positive/40 bg-positive/15 text-positive" },
  cancelled: { label: () => t("Đã hủy"), cls: "border-white/15 bg-white/5 text-text-muted" },
};

export function ShareStatusBadge({ status, paid, total = 2 }: { status: ShareDisplayStatus; paid?: number; total?: number }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>
      {s.label()}
      {status === "paying" && paid !== undefined ? ` · ${paid}/${total}` : ""}
    </span>
  );
}

export function Chip({ children, gold }: { children: React.ReactNode; gold?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs ${
        gold ? "border-accent/30 bg-accent/10 text-accent" : "border-border bg-bg-elevated text-text-secondary"
      }`}
    >
      {children}
    </span>
  );
}

/** Tạo phòng → Đủ 2 người → Thanh toán x/2 → Đang cài game → Hoàn tất. */
export function ShareSteps({ status, paid }: { status: ShareDisplayStatus; paid: number }) {
  const at = { waiting: 1, paying: 2, full: 3, installing: 3, done: 5, cancelled: -1 }[status];
  const steps = [t("Tạo phòng"), t("Đủ 2 người"), t("Thanh toán {0}/2", [paid]), t("Đang cài game"), t("Hoàn tất")];
  if (status === "cancelled") return null;
  return (
    <ol className="flex overflow-x-auto border-y border-border bg-bg-surface px-4 py-4 sm:px-7 [scrollbar-width:none]">
      {steps.map((label, i) => {
        const done = i < at || status === "done";
        const now = i === at && status !== "done";
        return (
          <li key={label} className={`relative flex min-w-[96px] flex-1 flex-col items-center text-xs ${done ? "text-text-secondary" : now ? "font-semibold text-accent" : "text-text-muted"}`}>
            {i > 0 && (
              <span aria-hidden className={`absolute left-[-50%] top-[11px] h-0.5 w-full ${done ? "bg-positive" : now ? "bg-gradient-to-r from-positive to-accent" : "bg-border"}`} />
            )}
            <span
              className={`z-[1] mb-1.5 grid h-6 w-6 place-items-center rounded-full border-2 text-[11px] ${
                done ? "border-positive bg-positive text-on-accent" : now ? "border-accent bg-bg-base ring-4 ring-accent/15" : "border-border bg-bg-base"
              }`}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className="text-center">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function SplitBar({ ownerPercent, ownerName, partnerName }: { ownerPercent: number; ownerName: string; partnerName?: string }) {
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-bg-elevated" role="img" aria-label={t("Chia {0}/{1}", [ownerPercent, 100 - ownerPercent])}>
        <i className="block bg-accent transition-[width] duration-300" style={{ width: `${ownerPercent}%` }} />
        <i className="block bg-info transition-[width] duration-300" style={{ width: `${100 - ownerPercent}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-text-muted">
        <span>{ownerName} {ownerPercent}%</span>
        <span>{partnerName ?? t("Người share")} {100 - ownerPercent}%</span>
      </div>
    </div>
  );
}

function Avatar({ name, owner }: { name: string; owner?: boolean }) {
  return (
    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full font-display text-base font-semibold text-on-solid ${owner ? "bg-accent-deep" : "bg-[#2c5d7c]"}`}>
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

export function SeatCard({ seat, now, accountType }: { seat: ShareSeat; now: number; accountType: ShareAccountType }) {
  const left = seat.payDeadline ? new Date(seat.payDeadline).getTime() - now : null;
  return (
    <div
      className={`relative rounded-md border p-4 ${seat.paid ? "border-positive/45 bg-gradient-to-b from-positive/[0.07] to-transparent" : "border-border bg-bg-base"} ${
        seat.isMe ? "outline outline-2 outline-offset-2 outline-accent/35" : ""
      }`}
    >
      <div className="mb-3 flex items-center gap-2.5">
        <Avatar name={seat.displayName} owner={seat.isOwner} />
        <div className="min-w-0">
          <p className="truncate font-semibold text-text-primary">
            {seat.displayName}
            {seat.isMe ? ` (${t("bạn")})` : ""}
          </p>
          <p className="text-xs text-text-muted">
            {seat.isOwner ? (accountType === "Owner" ? t("Chủ phòng · cấp tài khoản Xbox") : t("Chủ phòng")) : t("Người share")}
            {seat.shareCount > 0 && (
              <span className="ml-1 inline-flex items-center gap-0.5 text-positive">
                <ShieldCheck className="h-3 w-3" /> {t("{0} lần share", [seat.shareCount])}
              </span>
            )}
          </p>
        </div>
      </div>
      <dl className="space-y-1 text-sm text-text-secondary">
        <div className="flex justify-between"><dt>{t("Tỷ lệ")}</dt><dd className="font-semibold text-text-primary num">{seat.percent}%</dd></div>
        <div className="flex justify-between"><dt>{t("Phần tiền")}</dt><dd className="font-semibold text-text-primary num">{formatPrice(seat.shareAmount)}</dd></div>
        <div className="flex justify-between">
          <dt>{seat.couponCode ? t("Voucher {0}", [seat.couponCode]) : t("Voucher")}</dt>
          <dd className={seat.discountAmount > 0 ? "text-positive num" : "text-text-muted"}>{seat.discountAmount > 0 ? `−${formatPrice(seat.discountAmount)}` : "—"}</dd>
        </div>
      </dl>
      <p className="mt-1.5 font-display text-2xl font-bold text-text-primary num">{formatPrice(seat.amountDue)}</p>
      <div className="mt-2.5">
        {seat.paid ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-positive/30 bg-positive/10 px-2.5 py-0.5 text-xs font-semibold text-positive">
            <Check className="h-3 w-3" /> {t("Đã thanh toán")}
            {seat.paidAt ? ` · ${new Date(seat.paidAt).toLocaleString(undefined, { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}` : ""}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-caution/30 bg-caution/10 px-2.5 py-0.5 text-xs font-semibold text-caution">
            <Clock className="h-3 w-3" /> {t("Chưa thanh toán")}
            {left !== null ? ` · ${t("còn {0}", [formatCountdown(left)])}` : ""}
          </span>
        )}
      </div>
    </div>
  );
}

export function EmptySeat({ amount }: { amount: number }) {
  return (
    <div className="grid place-items-center rounded-md border-2 border-dashed border-accent-muted/60 p-4 text-center">
      <div>
        <Users className="mx-auto h-6 w-6 text-accent" />
        <p className="mt-2 font-semibold text-text-primary">{t("Đang chờ người share")}</p>
        <p className="text-sm text-text-muted">{t("Phần còn trống: {0}", [formatPrice(amount)])}</p>
      </div>
    </div>
  );
}

export function GameCover({ url, className = "" }: { url: string | null; className?: string }) {
  return url ? (
    <img src={url} alt="" loading="lazy" decoding="async" className={`object-cover ${className}`} />
  ) : (
    <div className={`grid place-items-center bg-bg-elevated ${className}`}>
      <Gamepad2 className="h-8 w-8 text-accent/40" />
    </div>
  );
}

export function RoomCard({ room }: { room: ShareRoomCard }) {
  const daysLeft = Math.max(0, Math.ceil((new Date(room.expiresAt).getTime() - Date.now()) / 86_400_000));
  const body = (
    <>
      <div className="relative h-32">
        <GameCover url={room.coverUrl} className={`h-full w-full ${room.joinable ? "" : "grayscale-[60%]"}`} />
        <div className="absolute inset-0 bg-gradient-to-t from-bg-surface via-transparent to-transparent" />
        <div className="absolute inset-x-2.5 top-2.5 flex justify-between gap-2">
          <Chip gold>{t("Chia {0}/{1}", [room.ownerPercent, room.openPercent])}</Chip>
          {room.joinable ? <Chip>{t("còn {0} ngày", [daysLeft])}</Chip> : <ShareStatusBadge status={room.displayStatus} paid={room.paidCount} />}
        </div>
      </div>
      <div className="flex-1 px-3.5 pb-3">
        <h3 className="line-clamp-1 font-display text-[15px] font-semibold text-text-primary">{room.gameName}</h3>
        <p className="text-xs text-text-muted">{accountTypeLabel(room.accountType)}</p>
        <div className="mt-2.5 flex items-center gap-1.5">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-accent-deep font-display text-[11px] font-semibold text-on-solid">
            {room.ownerName.charAt(0).toUpperCase()}
          </span>
          {room.partnerName ? (
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[#2c5d7c] font-display text-[11px] font-semibold text-on-solid">
              {room.partnerName.charAt(0).toUpperCase()}
            </span>
          ) : (
            <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-dashed border-accent-muted text-[11px] text-accent">+</span>
          )}
          <span className="truncate text-xs text-text-muted">
            {room.joinable ? t("Thiếu 1 người") : `${room.ownerName} & ${room.partnerName ?? ""}`}
            {room.joinable && room.ownerShareCount > 0 ? ` · ${room.ownerName}: ${t("{0} lần share", [room.ownerShareCount])}` : ""}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-border px-3.5 py-3">
        {room.joinable ? (
          <div>
            <p className="font-display text-lg font-bold text-text-primary num">{formatPrice(room.openAmount)}</p>
            <p className="text-[11px] text-text-muted">{t("phần của bạn / tổng {0}", [formatPrice(room.totalPrice)])}</p>
          </div>
        ) : (
          <div>
            <p className="font-display text-lg font-bold text-text-muted num">{formatPrice(room.totalPrice)}</p>
            <p className="text-[11px] text-text-muted">{t("đã đủ 2 người")}</p>
          </div>
        )}
        {room.joinable ? (
          <span className="rounded-md bg-accent px-3.5 py-2 text-sm font-semibold text-on-accent transition-colors group-hover:bg-accent-hover">{t("Vào phòng")}</span>
        ) : (
          <span className="rounded-md bg-bg-elevated px-3.5 py-2 text-sm font-semibold text-text-muted">
            {room.status === "Full" ? t("Đã đủ người") : t("Đã thanh toán")}
          </span>
        )}
      </div>
    </>
  );
  return room.joinable ? (
    <Link
      to={`/share/${room.code}`}
      className="group flex flex-col overflow-hidden rounded-md border border-border bg-bg-surface transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-accent-muted motion-reduce:hover:translate-y-0"
    >
      {body}
    </Link>
  ) : (
    <div aria-disabled="true" className="flex cursor-not-allowed flex-col overflow-hidden rounded-md border border-border bg-bg-surface opacity-70">
      {body}
    </div>
  );
}
