import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, Clock, Copy, Eye, EyeOff, Gamepad2, KeyRound, Loader2, RefreshCw, XCircle } from "lucide-react";
import Container from "../components/layout/Container";
import QRDisplay from "../components/checkout/QRDisplay";
import { SectionLoader } from "../components/shared/MoxicLoader";
import { getActivePaymentConfig } from "../lib/api";
import { cancelRental, extendRental, getRental, markRentalPaid, RENTAL_STATUS, rentalError, type RentalDetail } from "../lib/rentalApi";
import { formatPrice } from "../lib/utils";

import { t, locale } from "../lib/i18n";
function useTick(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}

function remaining(target: string | null, now: number) {
  if (!target) return null;
  const ms = new Date(target).getTime() - now;
  if (ms <= 0) return { ms: 0, d: 0, h: 0, m: 0, s: 0 };
  return { ms, d: Math.floor(ms / 86_400_000), h: Math.floor((ms % 86_400_000) / 3_600_000), m: Math.floor((ms % 3_600_000) / 60_000), s: Math.floor((ms % 60_000) / 1000) };
}

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString(locale, { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }) : "—");

function CopyField({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const [show, setShow] = useState(!secret);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t("Không sao chép được"));
    }
  };
  return (
    <div>
      <p className="text-xs text-text-muted mb-1">{label}</p>
      <div className="flex items-center gap-2 bg-black/40 border border-white/10 px-3 h-11">
        <span className="flex-1 font-mono text-sm truncate select-all">{show ? value : "•".repeat(Math.min(12, value.length))}</span>
        {secret && (
          <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? t("Ẩn") : t("Hiện")} className="p-1.5 text-text-muted hover:text-white cursor-pointer">
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
        <button type="button" onClick={copy} aria-label={t("Sao chép {0}", [label])} className="p-1.5 text-text-muted hover:text-white cursor-pointer">
          {copied ? <Check className="w-4 h-4 text-positive" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function Timeline({ r }: { r: RentalDetail }) {
  const steps = [
    { key: "order", label: t("Giữ chỗ"), done: true },
    { key: "pay", label: t("Thanh toán"), done: ["AwaitingConfirmation", "Active", "Expired", "Returned"].includes(r.status) },
    { key: "deliver", label: t("Bàn giao"), done: ["Active", "Expired", "Returned"].includes(r.status) },
    { key: "end", label: t("Kết thúc"), done: ["Expired", "Returned"].includes(r.status) },
  ];
  if (r.status === "Cancelled") return null;
  return (
    <ol className="flex items-center gap-2">
      {steps.map((s, i) => (
        <li key={s.key} className="flex items-center gap-2 flex-1 last:flex-none">
          <span className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${s.done ? "bg-positive text-on-accent" : "border border-white/20 text-text-muted"}`}>
            {s.done ? <Check className="w-3.5 h-3.5" /> : i + 1}
          </span>
          <span className={`text-xs whitespace-nowrap ${s.done ? "text-white" : "text-text-muted"}`}>{s.label}</span>
          {i < steps.length - 1 && <span className={`hidden sm:block flex-1 h-px ${steps[i + 1].done ? "bg-positive" : "bg-white/10"}`} />}
        </li>
      ))}
    </ol>
  );
}

function PayBox({ code, amount, payBefore, onPaid, onCancel, busy }: { code: string; amount: number; payBefore?: string | null; onPaid: () => void; onCancel?: () => void; busy: boolean }) {
  const { data: config } = useQuery({ queryKey: ["payment-config"], queryFn: getActivePaymentConfig, staleTime: 5 * 60_000 });
  const now = useTick();
  const left = remaining(payBefore ?? null, now);
  return (
    <div className="space-y-4">
      {left && (
        <p className={`flex items-center gap-2 text-sm ${left.ms < 5 * 60_000 ? "text-negative" : "text-caution"}`}>
          <Clock className="w-4 h-4" /> {t("Giữ chỗ còn")}{" "}
          <b className="font-mono tabular-nums">
            {String(left.m).padStart(2, "0")}:{String(left.s).padStart(2, "0")}
          </b>
          {t(". Quá hạn, đơn sẽ tự hủy để nhường slot.")}
        </p>
      )}
      <QRDisplay bankQrUrl={config?.bankQrUrl} cryptoQrUrl={config?.cryptoQrUrl} transferContent={code} amount={amount} />
      <div className="flex flex-col sm:flex-row gap-2">
        <button type="button" onClick={onPaid} disabled={busy} className="h-12 flex-[2] inline-flex items-center justify-center gap-2 bg-accent text-on-accent text-sm font-bold disabled:opacity-50 cursor-pointer">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} {t("Tôi đã chuyển khoản")}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={busy} className="h-12 flex-1 border border-white/15 text-sm text-text-secondary hover:text-white cursor-pointer">
            {t("Hủy đơn")}
          </button>
        )}
      </div>
    </div>
  );
}

export default function RentalDetailPage() {
  const { code = "" } = useParams();
  const qc = useQueryClient();
  const now = useTick();
  const { data: r, isLoading, error } = useQuery({
    queryKey: ["rental", code],
    queryFn: () => getRental(code),
    refetchInterval: (q) => (q.state.data && ["PendingPayment", "AwaitingConfirmation"].includes(q.state.data.status) ? 15_000 : false),
  });
  const [extPlan, setExtPlan] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["rental", code] });
  const paid = useMutation({
    mutationFn: (c: string) => markRentalPaid(c),
    onSuccess: () => {
      toast.success(t("Đã ghi nhận! Moxic sẽ xác nhận và bàn giao sớm nhất."));
      refresh();
    },
    onError: (e) => toast.error(rentalError(e, t("Không cập nhật được"))),
  });
  const cancel = useMutation({
    mutationFn: (c: string) => cancelRental(c),
    onSuccess: () => {
      toast.success(t("Đã hủy"));
      refresh();
    },
    onError: (e) => toast.error(rentalError(e, t("Không hủy được"))),
  });
  const extend = useMutation({
    mutationFn: (planId: string) => extendRental(code, planId),
    onSuccess: () => {
      toast.success(t("Đã tạo yêu cầu gia hạn, vui lòng thanh toán"));
      refresh();
    },
    onError: (e) => toast.error(rentalError(e, t("Không gia hạn được"))),
  });

  if (isLoading) return <SectionLoader />;
  if (error || !r) {
    return (
      <Container className="mt-12 text-center py-16">
        <p className="text-text-muted mb-4">{t("Không tìm thấy đơn thuê.")}</p>
        <Link to="/account/rentals" className="text-accent hover:underline text-sm">
          {t("Về danh sách đơn thuê")}
        </Link>
      </Container>
    );
  }

  const st = RENTAL_STATUS[r.status];
  const left = r.status === "Active" ? remaining(r.endsAt, now) : null;
  const pendingExt = r.extensions.find((e) => e.status === "PendingPayment" || e.status === "AwaitingConfirmation");
  const busy = paid.isPending || cancel.isPending;

  return (
    <Container className="mt-8 mb-20 max-w-4xl">
      <Link to="/account/rentals" className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-white mb-5">
        <ArrowLeft className="w-4 h-4" /> {t("Game đang thuê")}
      </Link>

      {/* Header */}
      <div className="flex gap-4 items-start mb-6">
        <div className="w-20 h-24 sm:w-24 sm:h-32 shrink-0 bg-bg-elevated overflow-hidden">
          {r.coverUrl ? <img loading="lazy" decoding="async" src={r.coverUrl} alt="" className="w-full h-full object-cover" /> : <Gamepad2 className="w-8 h-8 m-auto mt-8 text-accent/40" />}
        </div>
        <div className="min-w-0 flex-1">
          <span className={`inline-block px-2 py-0.5 text-xs font-bold border ${st.cls}`}>{st.label}</span>
          <h1 className="font-display text-2xl sm:text-3xl font-bold mt-2 truncate">{r.gameName}</h1>
          <p className="text-sm text-text-muted mt-1">
            {t("Mã đơn")} <span className="font-mono text-text-secondary">{r.code}</span>{t(", {0} ngày, {1}", [r.days, formatPrice(r.price)])}
          </p>
        </div>
      </div>

      <div className="mb-6">
        <Timeline r={r} />
      </div>

      <div className="space-y-5">
        {r.status === "PendingPayment" && (
          <section className="bg-bg-surface border border-white/10 p-5">
            <h2 className="font-display text-lg font-bold mb-4">{t("Thanh toán để nhận game")}</h2>
            <PayBox code={r.code} amount={r.price} payBefore={r.payBefore} busy={busy} onPaid={() => paid.mutate(r.code)} onCancel={() => cancel.mutate(r.code)} />
          </section>
        )}

        {r.status === "AwaitingConfirmation" && (
          <section className="bg-info/5 border border-info/30 p-5 flex gap-3">
            <Loader2 className="w-5 h-5 text-info animate-spin shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{t("Moxic đang xác nhận thanh toán")}</p>
              <p className="text-sm text-text-muted mt-1">{t("Ngay khi xác nhận, thông tin tài khoản sẽ hiện tại đây và bạn nhận email thông báo. Trang tự cập nhật.")}</p>
            </div>
          </section>
        )}

        {r.status === "Active" && r.credentials && (
          <section className="relative bg-bg-surface border border-positive/30 p-5 overflow-hidden">
            <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-positive/10 blur-3xl pointer-events-none" />
            <div className="relative flex flex-wrap items-end justify-between gap-4 mb-5">
              <div>
                <p className="flex items-center gap-1.5 text-xs text-positive font-semibold">
                  <KeyRound className="w-3.5 h-3.5" /> {t("Tài khoản chơi game")}
                </p>
                <p className="text-sm text-text-muted mt-1">{t("Đăng nhập tài khoản này trên Xbox để chơi {0}.", [r.gameName])}</p>
              </div>
              {left && (
                <div className="text-right">
                  <p className="text-xs text-text-muted">{t("Còn lại")}</p>
                  <p className="font-display text-2xl font-bold tabular-nums">
                    {left.d > 0 && <>{left.d}<span className="text-sm text-text-muted mx-0.5">{t("ngày")}</span></>}
                    {left.h}<span className="text-sm text-text-muted mx-0.5">{t("giờ")}</span>
                    {String(left.m).padStart(2, "0")}<span className="text-sm text-text-muted ml-0.5">{t("phút")}</span>
                  </p>
                  <p className="text-xs text-text-muted">{t("Hết hạn {0}", [fmt(r.endsAt)])}</p>
                </div>
              )}
            </div>
            <div className="relative grid sm:grid-cols-2 gap-3">
              <CopyField label={t("Email đăng nhập")} value={r.credentials.email} />
              <CopyField label={t("Mật khẩu")} value={r.credentials.password ?? t("Liên hệ Moxic")} secret />
            </div>
            <ul className="relative mt-4 space-y-1 text-xs text-text-muted list-disc pl-4">
              <li>{t("Không đổi mật khẩu, email hay bật bảo mật 2 lớp trên tài khoản này.")}</li>
              <li>{t("Không mua thêm nội dung bằng tài khoản thuê. Hết hạn Moxic sẽ thu hồi tài khoản.")}</li>
            </ul>
          </section>
        )}

        {r.status === "Expired" && (
          <section className="bg-negative/5 border border-negative/30 p-5 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-negative shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{t("Đơn thuê đã hết hạn lúc {0}", [fmt(r.endsAt)])}</p>
              <p className="text-sm text-text-muted mt-1">{t("Gia hạn ngay bên dưới để tiếp tục chơi trước khi tài khoản được thu hồi.")}</p>
            </div>
          </section>
        )}

        {(r.status === "Returned" || r.status === "Cancelled") && (
          <section className="bg-bg-surface border border-white/10 p-5 flex gap-3">
            <XCircle className="w-5 h-5 text-text-muted shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{r.status === "Returned" ? t("Đơn thuê đã kết thúc") : t("Đơn thuê đã hủy")}</p>
              <p className="text-sm text-text-muted mt-1">
                {r.cancelReason ? t("Lý do: {0}. ", [r.cancelReason]) : ""}
                <Link to={`/games/${r.gameId}`} className="text-accent hover:underline">
                  {t("Thuê lại {0}", [r.gameName])}
                </Link>
              </p>
            </div>
          </section>
        )}

        {/* Extension */}
        {(r.status === "Active" || r.status === "Expired") && (
          <section className="bg-bg-surface border border-white/10 p-5">
            <h2 className="font-display text-lg font-bold flex items-center gap-2 mb-4">
              <RefreshCw className="w-5 h-5 text-accent" /> {t("Gia hạn")}
            </h2>
            {pendingExt ? (
              pendingExt.status === "PendingPayment" ? (
                <>
                  <p className="text-sm text-text-muted mb-3">
                    {t("Yêu cầu gia hạn")} <b className="text-white">{t("{0} ngày", [pendingExt.days])}</b>{t(", chuyển khoản với nội dung")} <span className="font-mono text-white">{pendingExt.code}</span>.
                  </p>
                  <PayBox code={pendingExt.code} amount={pendingExt.price} busy={busy} onPaid={() => paid.mutate(pendingExt.code)} onCancel={() => cancel.mutate(pendingExt.code)} />
                </>
              ) : (
                <p className="flex items-center gap-2 text-sm text-info">
                  <Loader2 className="w-4 h-4 animate-spin" /> {t("Đang xác nhận thanh toán gia hạn {0} ngày…", [pendingExt.days])}
                </p>
              )
            ) : r.plans.length === 0 ? (
              <p className="text-sm text-text-muted">{t("Game này hiện chưa mở gói gia hạn. Liên hệ Moxic để được hỗ trợ.")}</p>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1">
                  {r.plans.map((p) => {
                    const active = (extPlan ?? r.plans[0].id) === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setExtPlan(p.id)}
                        className={`px-3 py-2 border text-left cursor-pointer ${active ? "border-accent bg-accent/10" : "border-border hover:border-white/30"}`}
                      >
                        <span className="block text-xs text-text-muted">{t("+{0} ngày", [p.days])}</span>
                        <span className="block font-bold">{formatPrice(p.price)}</span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => extend.mutate(extPlan ?? r.plans[0].id)}
                  disabled={extend.isPending || !r.canExtend}
                  className="h-12 sm:h-auto px-6 bg-accent text-on-accent text-sm font-bold disabled:opacity-40 cursor-pointer"
                >
                  {extend.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t("Gia hạn")}
                </button>
              </div>
            )}
          </section>
        )}

        {/* Details */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/5 border border-white/10 text-sm">
          {[
            [t("Đặt lúc"), fmt(r.createdAt)],
            [t("Bắt đầu"), fmt(r.startsAt)],
            [t("Hết hạn"), fmt(r.endsAt)],
            [t("Gói"), t("{0} ngày, {1}", [r.days, formatPrice(r.price)])],
          ].map(([k, v]) => (
            <div key={k} className="bg-bg-base p-3">
              <p className="text-xs text-text-muted">{k}</p>
              <p className="mt-0.5 text-text-primary">{v}</p>
            </div>
          ))}
        </section>

        {r.extensions.length > 0 && (
          <section>
            <h3 className="text-xs text-text-muted mb-2">{t("Lịch sử gia hạn")}</h3>
            <ul className="divide-y divide-white/5 border border-white/10">
              {r.extensions.map((e) => (
                <li key={e.code} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="font-mono text-text-secondary">{e.code}</span>
                  <span>{t("+{0} ngày, {1}", [e.days, formatPrice(e.price)])}</span>
                  <span className={`px-1.5 py-0.5 text-xs font-bold border ${RENTAL_STATUS[e.status].cls}`}>{RENTAL_STATUS[e.status].label}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Container>
  );
}
