import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Box, Check, Copy, Loader2, ShoppingBag, Ticket, X } from "lucide-react";
import { apiError } from "../../lib/communityApi";
import { getRedemptions, getRewardShop, redeemReward, type RewardShopItem } from "../../lib/rewardShopApi";
import { formatDate, formatPrice } from "../../lib/utils";

function headline(i: RewardShopItem) {
  if (i.kind === "CaseCode") return i.caseName ? `Hòm ${i.caseName}` : "Lượt mở hòm";
  if (i.discountType === "Percent") return `-${i.discountValue}%`;
  return `-${formatPrice(i.discountValue ?? 0)}`;
}

function terms(i: RewardShopItem) {
  const t: string[] = [];
  if (i.kind === "Coupon") {
    if (i.discountType === "Percent" && i.discountMaxAmount) t.push(`tối đa ${formatPrice(i.discountMaxAmount)}`);
    t.push(i.discountMinOrderAmount ? `đơn từ ${formatPrice(i.discountMinOrderAmount)}` : "mọi đơn");
  } else {
    t.push("1 lượt mở");
  }
  t.push(`HSD ${i.validDays} ngày`);
  return t.join(" · ");
}

const pts = (n: number) => n.toLocaleString("vi-VN");

type Won = { name: string; code: string; kind: string; caseSlug: string | null; expiresAt: string };

/** "Đổi điểm" — spend loyalty points on wallet coupons or lucky-spin case codes. */
export default function PointsShop({ signedIn }: { signedIn: boolean }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["rewards", "shop", signedIn], queryFn: getRewardShop, staleTime: 30_000 });
  const { data: history } = useQuery({ queryKey: ["rewards", "history"], queryFn: getRedemptions, enabled: signedIn });
  const [confirm, setConfirm] = useState<RewardShopItem | null>(null);
  const [won, setWon] = useState<Won | null>(null);
  const [copied, setCopied] = useState(false);

  const redeem = useMutation({
    mutationFn: (item: RewardShopItem) => redeemReward(item.id),
    onSuccess: (r, item) => {
      setConfirm(null);
      setWon({ name: item.name, code: r.code, kind: r.kind, caseSlug: r.caseSlug, expiresAt: r.expiresAt });
      qc.invalidateQueries({ queryKey: ["rewards"] });
      qc.invalidateQueries({ queryKey: ["loyalty"] });
      qc.invalidateQueries({ queryKey: ["account"] });
      qc.invalidateQueries({ queryKey: ["coupons"] });
    },
    onError: (e) => {
      setConfirm(null);
      toast.error(apiError(e, "Không đổi được, thử lại sau"));
    },
  });

  if (isLoading) return null;
  const items = data?.items ?? [];
  if (items.length === 0) return null;
  const balance = data?.balance ?? null;

  return (
    <section className="border border-white/10 bg-bg-surface p-5 space-y-4 text-left">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="font-display text-lg font-bold flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-amber-300" /> Đổi điểm
        </h2>
        {balance != null && (
          <p className="text-sm text-text-secondary">
            Bạn có <b className="text-amber-300 text-base">{pts(balance)}</b> điểm
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map((i) => {
          const soldOut = i.remaining === 0;
          const limitHit = i.perUserLimit != null && i.myRedeemed >= i.perUserLimit;
          const short = balance != null && balance < i.pointsCost;
          const disabled = soldOut || limitHit || short;
          const pct = balance != null ? Math.min(100, Math.round((balance / i.pointsCost) * 100)) : 0;
          return (
            <div key={i.id} className="relative flex flex-col border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent overflow-hidden">
              {/* ticket notches */}
              <span className="absolute left-0 top-[58px] -translate-x-1/2 w-3 h-3 rounded-full bg-bg-surface border border-white/10" />
              <span className="absolute right-0 top-[58px] translate-x-1/2 w-3 h-3 rounded-full bg-bg-surface border border-white/10" />
              <div className="h-16 flex items-center justify-center gap-2 px-3 border-b border-dashed border-white/10">
                {i.kind === "CaseCode" ? <Box className="w-5 h-5 text-fuchsia-300 shrink-0" /> : <Ticket className="w-5 h-5 text-amber-300 shrink-0" />}
                <span className={`font-display font-extrabold truncate ${i.kind === "CaseCode" ? "text-base text-fuchsia-200" : "text-xl sm:text-2xl text-amber-200"}`}>
                  {headline(i)}
                </span>
              </div>
              <div className="flex-1 p-3 space-y-1">
                <p className="text-sm font-semibold leading-tight line-clamp-2">{i.name}</p>
                {i.description && <p className="text-[11px] text-text-secondary leading-snug">{i.description}</p>}
                <p className="text-[11px] text-text-muted leading-snug">{terms(i)}</p>
                {i.remaining != null && <p className="text-[11px] text-orange-300">Còn {i.remaining} phần</p>}
              </div>
              <div className="p-3 pt-0 space-y-2">
                {short && !soldOut && (
                  <div className="h-1 bg-white/5 overflow-hidden" title={`Còn thiếu ${pts(i.pointsCost - (balance ?? 0))} điểm`}>
                    <div className="h-full bg-amber-400/70" style={{ width: `${pct}%` }} />
                  </div>
                )}
                {signedIn ? (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setConfirm(i)}
                    className="w-full h-10 inline-flex items-center justify-center gap-1.5 text-sm font-bold bg-amber-400 text-bg-base hover:bg-amber-300 disabled:bg-white/5 disabled:text-text-muted disabled:cursor-not-allowed cursor-pointer"
                  >
                    {soldOut ? "Hết quà" : limitHit ? "Đã đổi tối đa" : `${pts(i.pointsCost)} điểm`}
                  </button>
                ) : (
                  <Link to="/login?redirect=/rewards" className="w-full h-10 inline-flex items-center justify-center text-sm font-bold border border-amber-400/50 text-amber-200">
                    {pts(i.pointsCost)} điểm
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {history && history.length > 0 && (
        <details className="border-t border-white/10 pt-3">
          <summary className="cursor-pointer text-sm text-text-secondary hover:text-white select-none">Quà đã đổi ({history.length})</summary>
          <ul className="mt-2 divide-y divide-white/5">
            {history.map((h) => (
              <li key={h.id} className="flex items-center gap-3 py-2 text-sm">
                {h.kind === "CaseCode" ? <Box className="w-4 h-4 text-fuchsia-300 shrink-0" /> : <Ticket className="w-4 h-4 text-amber-300 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="truncate">{h.itemName}</p>
                  <p className="text-[11px] text-text-muted">
                    {formatDate(h.createdAt)} · -{pts(h.pointsSpent)} điểm
                  </p>
                </div>
                <span className={`font-mono text-xs ${h.used ? "line-through text-text-muted" : "text-white"}`}>{h.code}</span>
                {!h.used && h.kind === "CaseCode" && h.caseSlug && (
                  <Link to={`/lucky-spin/${h.caseSlug}?code=${h.code}`} className="text-xs text-fuchsia-300 hover:underline shrink-0">
                    Mở
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      {confirm && (
        <div
          className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 pb-[calc(0.75rem+var(--sab))]"
          onClick={() => !redeem.isPending && setConfirm(null)}
        >
          <div className="w-full max-w-sm bg-bg-elevated border border-white/10 p-5 space-y-4 animate-[popIn_0.2s_ease-out]" onClick={(e) => e.stopPropagation()}>
            <p className="font-display text-lg font-bold">Đổi {pts(confirm.pointsCost)} điểm?</p>
            <p className="text-sm text-text-secondary">
              Nhận <b className="text-white">{confirm.name}</b> ({terms(confirm)}).
              {balance != null && <> Còn lại {pts(balance - confirm.pointsCost)} điểm.</>}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={redeem.isPending} onClick={() => setConfirm(null)} className="h-11 border border-white/15 text-sm font-semibold cursor-pointer">
                Hủy
              </button>
              <button
                type="button"
                disabled={redeem.isPending}
                onClick={() => redeem.mutate(confirm)}
                className="h-11 inline-flex items-center justify-center gap-2 bg-amber-400 text-bg-base text-sm font-bold cursor-pointer"
              >
                {redeem.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Đổi ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {won && (
        <div
          className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 pb-[calc(0.75rem+var(--sab))]"
          onClick={() => setWon(null)}
        >
          <div className="relative w-full max-w-sm bg-bg-elevated border border-amber-400/40 p-6 text-center space-y-4 animate-[popIn_0.3s_ease-out]" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setWon(null)} aria-label="Đóng" className="absolute top-2 right-2 p-1 text-text-muted hover:text-white cursor-pointer">
              <X className="w-4 h-4" />
            </button>
            <div className="w-14 h-14 mx-auto rounded-full bg-amber-400/15 flex items-center justify-center">
              {won.kind === "CaseCode" ? <Box className="w-7 h-7 text-fuchsia-300" /> : <Ticket className="w-7 h-7 text-amber-300" />}
            </div>
            <div>
              <p className="font-display text-xl font-bold">Đổi thành công!</p>
              <p className="text-sm text-text-secondary">{won.name}</p>
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(won.code);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1500);
                } catch {
                  /* ignore */
                }
              }}
              className="w-full h-12 flex items-center justify-center gap-2 bg-black/40 border border-dashed border-amber-400/50 font-mono text-lg tracking-widest cursor-pointer"
            >
              {won.code} {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4 text-text-muted" />}
            </button>
            <p className="text-xs text-text-muted">Hạn dùng đến {formatDate(won.expiresAt)}</p>
            {won.kind === "CaseCode" && won.caseSlug ? (
              <Link to={`/lucky-spin/${won.caseSlug}?code=${won.code}`} className="w-full h-11 inline-flex items-center justify-center bg-fuchsia-500 text-white text-sm font-bold">
                Mở hòm ngay
              </Link>
            ) : (
              <Link to="/account/coupons" className="w-full h-11 inline-flex items-center justify-center bg-amber-400 text-bg-base text-sm font-bold">
                Xem ví mã giảm giá — dùng khi thanh toán
              </Link>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
