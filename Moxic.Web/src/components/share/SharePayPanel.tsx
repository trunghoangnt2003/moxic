import { useState } from "react";
import { Check, Copy, Loader2, Lock, TicketPercent, X } from "lucide-react";
import { t } from "../../lib/i18n";
import { formatPrice } from "../../lib/utils";
import { setShareCoupon, setShareXbox, startSharePayment, type ShareRoom } from "../../lib/shareApi";
import { useShareAction } from "../../hooks/useShare";
import { copyText } from "./ShareParts";

const input = "h-11 w-full rounded-md border border-border bg-bg-base px-3 text-sm text-text-primary placeholder:text-text-placeholder focus:border-accent focus:outline-none";

/** The owner's Xbox account (an "Owner" room installs the game on it). Encrypted on the server; only Moxic sees the password. */
function XboxForm({ room }: { room: ShareRoom }) {
  const [email, setEmail] = useState(room.myXboxEmail ?? "");
  const [password, setPassword] = useState("");
  const [open, setOpen] = useState(!room.myXboxEmail);
  const save = useShareAction(room.code, () => setShareXbox(room.code, email, password), t("Đã lưu tài khoản Xbox"));
  if (!open)
    return (
      <p className="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
        <Check className="h-4 w-4 text-positive" /> {t("Tài khoản Xbox: {0}", [room.myXboxEmail ?? ""])}
        {room.status !== "Funded" && (
          <button type="button" onClick={() => setOpen(true)} className="text-accent hover:underline">{t("Đổi")}</button>
        )}
      </p>
    );
  return (
    <form
      className="space-y-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(undefined, { onSuccess: () => { setOpen(false); setPassword(""); } });
      }}
    >
      <p className="text-sm text-text-secondary">{t("Game sẽ được cài vào tài khoản Xbox của bạn. Mật khẩu được mã hoá, chỉ Moxic xem khi cài.")}</p>
      <input className={input} type="email" required autoComplete="off" placeholder={t("Email tài khoản Xbox")} value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className={input} type="password" required autoComplete="new-password" placeholder={t("Mật khẩu Xbox")} value={password} onChange={(e) => setPassword(e.target.value)} />
      <button type="submit" disabled={save.isPending} className="inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-60">
        {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {t("Lưu tài khoản Xbox")}
      </button>
    </form>
  );
}

function CouponRow({ room }: { room: ShareRoom }) {
  const me = room.seats.find((s) => s.isMe)!;
  const [code, setCode] = useState("");
  const apply = useShareAction(room.code, (c: string | null) => setShareCoupon(room.code, c));
  if (me.paid) return null;
  if (me.couponCode)
    return (
      <p className="flex items-center gap-2 text-sm text-positive">
        <TicketPercent className="h-4 w-4" /> {t("Voucher {0}: −{1}", [me.couponCode, formatPrice(me.discountAmount)])}
        <button type="button" aria-label={t("Bỏ voucher")} onClick={() => apply.mutate(null)} className="text-text-muted hover:text-text-primary"><X className="h-4 w-4" /></button>
      </p>
    );
  return (
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (code.trim()) apply.mutate(code.trim(), { onSuccess: () => setCode("") }); }}>
      <input className={`${input} h-10 uppercase`} placeholder={t("Mã voucher của bạn")} value={code} onChange={(e) => setCode(e.target.value)} />
      <button type="submit" disabled={apply.isPending || !code.trim()} className="h-10 shrink-0 rounded-md border border-border px-4 text-sm font-semibold text-text-primary hover:border-border-hover disabled:opacity-50">
        {t("Áp dụng")}
      </button>
    </form>
  );
}

/** "Phần thanh toán của bạn": voucher, (owner) Xbox account, then the QR with this member's own MXR code. */
export default function SharePayPanel({ room }: { room: ShareRoom }) {
  const me = room.seats.find((s) => s.isMe);
  const pay = useShareAction(room.code, () => startSharePayment(room.code));
  if (!me) return null;
  const p = room.myPayment;
  const needsOwnerXbox = room.accountType === "Owner" && !room.ownerXboxSet;

  return (
    <section className="rounded-lg border border-border bg-bg-surface p-4 sm:p-5">
      <h2 className="mb-3 font-display text-base font-semibold text-text-primary">{t("Phần thanh toán của bạn")}</h2>

      {me.paid ? (
        <div className="flex items-center gap-3 rounded-md border border-positive/30 bg-positive/10 p-3 text-sm text-positive">
          <Check className="h-5 w-5 shrink-0" />
          <span>
            {t("Moxic đã nhận {0}.", [formatPrice(p?.paidAmount ?? me.amountDue)])}{" "}
            {room.status === "Full" ? t("Chúng tôi sẽ email cho bạn khi người kia thanh toán xong.") : ""}
          </span>
        </div>
      ) : (
        <div className="space-y-4">
          <CouponRow room={room} />
          {room.accountType === "Owner" && me.isOwner && <XboxForm room={room} />}

          {room.status !== "Full" ? (
            <div>
              <button type="button" disabled className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-bg-elevated text-sm font-semibold text-text-muted sm:w-auto sm:px-6">
                <Lock className="h-4 w-4" /> {t("Thanh toán phần của tôi")}
              </button>
              <p className="mt-2 text-xs text-text-muted">{t("Nút thanh toán sẽ mở khi phòng đủ 2 người, chúng tôi sẽ email báo bạn.")}</p>
            </div>
          ) : needsOwnerXbox && !me.isOwner ? (
            <p className="text-sm text-caution">{t("Chủ phòng chưa nhập tài khoản Xbox, hãy chờ chủ phòng nhập trước khi thanh toán.")}</p>
          ) : !p ? (
            <button
              type="button"
              disabled={pay.isPending || needsOwnerXbox}
              onClick={() => pay.mutate(undefined)}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-accent px-6 text-sm font-bold text-on-accent hover:bg-accent-hover disabled:opacity-50 sm:w-auto"
            >
              {pay.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("Thanh toán phần của tôi · {0}", [formatPrice(me.amountDue)])}
            </button>
          ) : (
            <div className="grid gap-4 sm:grid-cols-[150px_minmax(0,1fr)] sm:items-center">
              {p.qrUrl ? (
                <img src={p.qrUrl} alt={t("Mã QR thanh toán")} className="mx-auto w-[150px] rounded-md bg-white p-2" />
              ) : (
                <p className="text-sm text-caution">{t("Chưa có mã QR ngân hàng")}</p>
              )}
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-text-muted">{t("Số tiền")}</dt>
                  <dd className="flex items-center gap-2 font-display text-2xl font-bold text-text-primary num">
                    {formatPrice(Math.max(0, p.amountDue - p.paidAmount))}
                    <button type="button" onClick={() => copyText(String(Math.max(0, p.amountDue - p.paidAmount)))} aria-label={t("Sao chép số tiền cần chuyển")} className="text-text-muted hover:text-text-primary"><Copy className="h-4 w-4" /></button>
                  </dd>
                  {p.paidAmount > 0 && <p className="text-xs text-caution">{t("Đã nhận {0}, còn thiếu phần trên.", [formatPrice(p.paidAmount)])}</p>}
                </div>
                <div>
                  <dt className="text-text-muted">{t("Nội dung chuyển khoản của riêng bạn")}</dt>
                  <dd className="mt-1 flex items-center justify-between rounded-md border border-dashed border-border bg-bg-base px-3 py-2 font-display text-base font-semibold tracking-wider text-text-primary">
                    {p.paymentCode}
                    <button type="button" onClick={() => copyText(p.paymentCode ?? "")} className="text-xs font-medium tracking-normal text-accent hover:underline">{t("Sao chép")}</button>
                  </dd>
                </div>
                {p.bankAccountNumber && (
                  <p className="text-text-secondary">{p.bankName}, {p.bankAccountNumber}{p.bankAccountHolder ? `, ${p.bankAccountHolder}` : ""}</p>
                )}
                <p className="flex items-center gap-2 text-xs text-text-muted">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-accent motion-reduce:animate-none" />
                  {p.autoConfirm ? t("Đang chờ tiền về, trang sẽ tự cập nhật.") : t("Moxic sẽ xác nhận khi nhận được tiền.")}
                </p>
              </dl>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
