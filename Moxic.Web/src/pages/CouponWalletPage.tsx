import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { AlertCircle, Check, Copy, Gift, TicketPercent } from "lucide-react";
import Container from "../components/layout/Container";
import { MoxicLoader, SectionLoader } from "../components/shared/MoxicLoader";
import { useClaimCoupon, useMyCoupons } from "../hooks/useCoupons";
import {
  describeCouponConditions,
  describeCouponDiscount,
  getCouponErrorMessage,
  type WalletCoupon,
} from "../lib/couponApi";
import { formatDate } from "../lib/utils";

type Tab = "usable" | "used" | "expired";

const TABS: { key: Tab; label: string }[] = [
  { key: "usable", label: "Có thể dùng" },
  { key: "used", label: "Đã dùng" },
  { key: "expired", label: "Hết hạn" },
];

const EMPTY_TEXT: Record<Tab, string> = {
  usable: "Bạn chưa có mã giảm giá nào có thể dùng.",
  used: "Chưa có mã nào đã dùng.",
  expired: "Không có mã hết hạn.",
};

function tabOf(c: WalletCoupon): Tab {
  if (c.status === "Usable" || c.status === "Upcoming") return "usable";
  if (c.status === "Used") return "used";
  return "expired";
}

function CouponTicket({ coupon }: { coupon: WalletCoupon }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const conditions = describeCouponConditions(coupon);
  const usable = coupon.status === "Usable";
  const dimmed = coupon.status === "Used" || coupon.status === "Expired" || coupon.status === "Inactive";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(coupon.code);
      setCopied(true);
      toast.success("Đã sao chép mã");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Không thể sao chép, vui lòng chép thủ công.");
    }
  };

  return (
    <li className={`flex overflow-hidden border border-white/10 bg-bg-surface ${dimmed ? "opacity-60" : ""}`}>
      {/* Stub */}
      <div className="relative flex w-14 flex-shrink-0 items-center justify-center bg-accent sm:w-20">
        <TicketPercent className="h-6 w-6 text-bg-base sm:h-8 sm:w-8" />
        <span className="absolute -right-2 -top-2 h-4 w-4 rounded-full bg-bg-base" />
        <span className="absolute -bottom-2 -right-2 h-4 w-4 rounded-full bg-bg-base" />
      </div>

      <div className="min-w-0 flex-1 border-l border-dashed border-white/10 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 truncate text-sm font-semibold text-text-primary">{coupon.name}</p>
          <span className="border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
            {coupon.source === "SpinReward" ? "Thưởng vòng quay" : coupon.source === "PointsReward" ? "Đổi điểm" : "Sự kiện"}
          </span>
          {coupon.status === "Inactive" && (
            <span className="border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">Đã vô hiệu</span>
          )}
        </div>

        <p className="mt-1 font-display text-lg font-bold text-accent sm:text-xl">{describeCouponDiscount(coupon)}</p>

        {conditions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {conditions.map((c) => (
              <span key={c} className="bg-bg-elevated px-2 py-0.5 text-[11px] text-text-secondary">
                {c}
              </span>
            ))}
          </div>
        )}

        <p className="mt-2 text-xs text-text-muted">
          {coupon.status === "Upcoming" && coupon.startsAt
            ? `Bắt đầu từ ${formatDate(coupon.startsAt)}`
            : coupon.expiresAt
              ? `HSD: ${formatDate(coupon.expiresAt)}`
              : "Không thời hạn"}
        </p>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-stretch border border-white/10 bg-bg-base">
            <span className="min-w-0 flex-1 select-all truncate px-3 py-2 font-mono text-sm font-bold tracking-widest text-text-primary">
              {coupon.code}
            </span>
            <button
              type="button"
              onClick={copy}
              aria-label="Sao chép mã"
              className="flex cursor-pointer items-center border-l border-white/10 px-3 text-text-secondary hover:text-accent"
            >
              {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          {coupon.status === "Usable" || coupon.status === "Upcoming" ? (
            <button
              type="button"
              disabled={!usable}
              onClick={() => navigate(`/checkout?coupon=${encodeURIComponent(coupon.code)}`)}
              className="cursor-pointer bg-accent px-5 py-2 text-sm font-semibold text-bg-base transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 sm:ml-auto"
            >
              Dùng ngay
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export default function CouponWalletPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [claimCode, setClaimCode] = useState(() => (searchParams.get("claim") ?? "").toUpperCase());
  const [claimError, setClaimError] = useState("");
  const [tab, setTab] = useState<Tab>("usable");
  const { data, isLoading, isError, refetch } = useMyCoupons();
  const claim = useClaimCoupon();

  const coupons = data ?? [];
  const counts: Record<Tab, number> = { usable: 0, used: 0, expired: 0 };
  for (const c of coupons) counts[tabOf(c)] += 1;
  const visible = coupons.filter((c) => tabOf(c) === tab);

  const handleClaim = (e: React.FormEvent) => {
    e.preventDefault();
    const code = claimCode.trim();
    if (!code) {
      setClaimError("Vui lòng nhập mã thưởng.");
      return;
    }
    setClaimError("");
    claim.mutate(code, {
      onSuccess: (res) => {
        toast.success(res.alreadyOwned ? "Mã đã có trong ví của bạn" : "Đã thêm mã vào ví");
        setClaimCode("");
        setTab("usable");
        if (searchParams.has("claim")) {
          const next = new URLSearchParams(searchParams);
          next.delete("claim");
          setSearchParams(next, { replace: true });
        }
      },
      onError: (err) => setClaimError(getCouponErrorMessage(err, "Không nhận được mã thưởng.")),
    });
  };

  return (
    <div className="min-h-screen bg-bg-base py-8 md:py-12">
      <Container>
        <div className="mx-auto max-w-3xl">
          <div className="mb-2 flex items-center gap-3">
            <TicketPercent className="h-6 w-6 text-accent" />
            <h1 className="font-display text-2xl uppercase tracking-wider text-text-primary md:text-3xl">Mã giảm giá của tôi</h1>
          </div>

          {/* Claim */}
          <section className="mt-4 border border-white/10 bg-bg-surface p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-text-primary">
              <Gift className="h-4 w-4 text-accent" /> Nhập mã thưởng
            </h2>
            <form onSubmit={handleClaim} className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={claimCode}
                onChange={(e) => setClaimCode(e.target.value.toUpperCase())}
                maxLength={40}
                placeholder="VD: MXABCD2345"
                aria-label="Mã thưởng"
                className="min-w-0 flex-1 border border-white/10 bg-bg-elevated px-4 py-2.5 font-mono text-sm uppercase tracking-widest text-text-primary placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-text-muted focus:border-accent/60 focus:outline-none"
              />
              <button
                type="submit"
                disabled={claim.isPending}
                className="flex min-w-[120px] cursor-pointer items-center justify-center gap-2 bg-accent px-5 py-2.5 text-sm font-semibold text-bg-base transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {claim.isPending ? <MoxicLoader size="sm" /> : "Nhận vào ví"}
              </button>
            </form>
            {claimError && (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-red-400">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" /> {claimError}
              </p>
            )}
            <p className="mt-3 text-xs text-text-muted">
              Mã thưởng giảm giá từ vòng quay sẽ tự vào ví nếu bạn đã đăng nhập khi mở hòm.
            </p>
          </section>

          {/* Tabs */}
          <div className="mt-8 flex border-b border-white/10" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`-mb-px flex-1 cursor-pointer border-b-2 px-2 py-2.5 text-xs font-semibold transition-colors sm:flex-none sm:px-5 sm:text-sm ${
                  tab === t.key
                    ? "border-accent text-accent"
                    : "border-transparent text-text-muted hover:text-text-secondary"
                }`}
              >
                {t.label} <span className="text-text-muted">({counts[t.key]})</span>
              </button>
            ))}
          </div>

          <div className="mt-4">
            {isLoading ? (
              <SectionLoader label="Đang tải mã giảm giá..." />
            ) : isError ? (
              <div className="border border-white/10 bg-bg-surface p-8 text-center">
                <p className="mb-4 text-sm text-red-400">Không thể tải mã giảm giá. Vui lòng thử lại.</p>
                <button
                  onClick={() => void refetch()}
                  className="cursor-pointer bg-accent px-6 py-2.5 text-sm font-semibold text-bg-base transition-colors hover:bg-accent-hover"
                >
                  Thử lại
                </button>
              </div>
            ) : visible.length === 0 ? (
              <div className="border border-white/10 bg-bg-surface p-10 text-center">
                <TicketPercent className="mx-auto mb-3 h-12 w-12 text-white/10" />
                <p className="text-sm text-text-secondary">{EMPTY_TEXT[tab]}</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {visible.map((c) => (
                  <CouponTicket key={c.id} coupon={c} />
                ))}
              </ul>
            )}
          </div>
        </div>
      </Container>
    </div>
  );
}
