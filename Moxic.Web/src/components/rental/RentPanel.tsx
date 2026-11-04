import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { CalendarClock, KeyRound, Loader2, ShieldCheck, Users } from "lucide-react";
import { createRental, getGameRental, rentalError } from "../../lib/rentalApi";
import { useMe } from "../../hooks/useAccount";
import { formatPrice } from "../../lib/utils";

import { t } from "../../lib/i18n";
/** "Thuê game" box on the game page: pick a plan, see live slot availability, rent. */
export default function RentPanel({ gameId, gameName, buyPrice }: { gameId: string; gameName: string; buyPrice: number }) {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const { data } = useQuery({ queryKey: ["rental", "game", gameId], queryFn: () => getGameRental(gameId), staleTime: 30_000 });
  const [planId, setPlanId] = useState<string | null>(null);

  const rent = useMutation({
    mutationFn: (pid: string) => createRental(gameId, pid),
    onSuccess: ({ code }) => {
      toast.success(t("Đã giữ chỗ! Vui lòng thanh toán trong 30 phút."));
      navigate(`/account/rentals/${code}`);
    },
    onError: (e) => toast.error(rentalError(e, t("Không tạo được đơn thuê"))),
  });

  if (!data || data.plans.length === 0 || data.totalSlots === 0) return null;
  const plan = data.plans.find((p) => p.id === planId) ?? data.plans[0];
  const soldOut = data.freeSlots === 0;
  const perDay = Math.round(plan.price / plan.days);

  const onRent = () => {
    if (!me) {
      navigate(`/login?redirect=${encodeURIComponent(`/games/${gameId}`)}`);
      return;
    }
    rent.mutate(plan.id);
  };

  return (
    <div className="relative bg-bg-surface border border-positive/30 p-5 overflow-hidden">
      <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-positive/10 blur-2xl pointer-events-none" />
      <div className="relative flex items-center justify-between mb-3">
        <span className="flex items-center gap-1.5 text-xs text-positive font-semibold">
          <KeyRound className="w-3.5 h-3.5" /> {t("Thuê game")}
        </span>
        <span className={`flex items-center gap-1 text-[11px] font-semibold ${soldOut ? "text-negative" : "text-positive"}`}>
          <Users className="w-3.5 h-3.5" /> {soldOut ? t("Tạm hết slot") : t("Còn {0} slot", [data.freeSlots])}
        </span>
      </div>

      <div className="relative grid grid-cols-2 gap-2 mb-3" role="radiogroup" aria-label={t("Chọn gói thuê")}>
        {data.plans.map((p) => {
          const active = p.id === plan.id;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setPlanId(p.id)}
              className={`px-3 py-2.5 border text-left transition-colors cursor-pointer ${active ? "border-positive bg-positive/10" : "border-border hover:border-white/30"}`}
            >
              <span className={`block text-xs ${active ? "text-positive" : "text-text-muted"}`}>{t("{0} ngày", [p.days])}</span>
              <span className={`block text-base font-bold ${active ? "text-white" : "text-text-primary"}`}>{formatPrice(p.price)}</span>
            </button>
          );
        })}
      </div>

      <p className="relative text-[11px] text-text-muted mb-3">
        {t("≈ {0}/ngày", [formatPrice(perDay)])}
        {buyPrice > 0 && plan.price < buyPrice && <>{t(", tiết kiệm {0}% so với mua", [Math.round((1 - plan.price / buyPrice) * 100)])}</>}
      </p>

      <button
        type="button"
        onClick={onRent}
        disabled={soldOut || rent.isPending}
        className="relative w-full h-11 inline-flex items-center justify-center gap-2 bg-positive hover:bg-positive text-on-accent text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
      >
        {rent.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />}
        {soldOut ? t("Hết slot, quay lại sau") : me ? t("Thuê {0} ngày", [plan.days]) : t("Đăng nhập để thuê")}
      </button>

      <ul className="relative mt-3 space-y-1 text-[11px] text-text-muted">
        <li className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-positive" /> {t("Nhận tài khoản chơi {0} ngay sau khi xác nhận thanh toán", [gameName])}
        </li>
        <li className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-positive" /> {t("Nhắc trước khi hết hạn, gia hạn 1 chạm")}
        </li>
      </ul>
    </div>
  );
}
