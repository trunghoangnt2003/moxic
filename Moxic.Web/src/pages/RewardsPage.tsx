import { useState } from "react";
import { confetti, haptic } from "../lib/fx";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { CalendarCheck, Check, Copy, Crown, Flame, Gift, Loader2, Share2, Target, Trophy, UserPlus } from "lucide-react";
import Container from "../components/layout/Container";
import { SectionLoader } from "../components/shared/MoxicLoader";
import { useMe } from "../hooks/useAccount";
import { apiError } from "../lib/communityApi";
import { checkIn, claimMission, enterReferral, getLoyalty, getLoyaltyProgram, TIER_STYLES } from "../lib/loyaltyApi";
import { formatPrice } from "../lib/utils";
import PointsShop from "../components/rewards/PointsShop";

function Guest() {
  const { data } = useQuery({ queryKey: ["loyalty", "program"], queryFn: getLoyaltyProgram, staleTime: 60 * 60_000 });
  return (
    <Container className="mt-10 mb-20 max-w-4xl text-center">
      <Crown className="w-12 h-12 mx-auto text-caution mb-4" />
      <h1 className="font-display text-3xl md:text-5xl font-extrabold">Moxic Rewards</h1>
      <p className="text-text-secondary mt-3 max-w-xl mx-auto">Điểm danh mỗi ngày, làm nhiệm vụ, mời bạn bè, đổi điểm mở hòm may mắn và lên hạng để nhận thêm điểm mỗi đơn.</p>
      <div className="flex justify-center gap-2 mt-6">
        <Link to="/register" className="h-12 px-6 inline-flex items-center bg-accent text-on-accent font-bold">
          Tạo tài khoản miễn phí
        </Link>
        <Link to="/login?redirect=/rewards" className="h-12 px-6 inline-flex items-center border border-white/15 font-semibold">
          Đăng nhập
        </Link>
      </div>
      <div className="mt-12">
        <PointsShop signedIn={false} />
      </div>
      {data && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6 text-left">
          {data.tiers.map((t) => {
            const st = TIER_STYLES[t.key] ?? TIER_STYLES.member;
            return (
              <div key={t.key} className={`p-4 border border-white/10 ${st.bg}`}>
                <p className={`font-display text-lg font-bold ${st.text}`}>{t.name}</p>
                <p className="text-xs text-text-muted">{t.minSpent > 0 ? `Chi tiêu từ ${formatPrice(t.minSpent)}` : "Khi đăng ký"}</p>
                <p className="text-sm text-text-secondary mt-2">{t.perk}</p>
              </div>
            );
          })}
        </div>
      )}
    </Container>
  );
}

export default function RewardsPage() {
  const { data: me, isLoading: meLoading } = useMe();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["loyalty"], queryFn: getLoyalty, enabled: !!me });
  const [refCode, setRefCode] = useState("");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["loyalty"] });
    qc.invalidateQueries({ queryKey: ["account"] });
  };
  const doCheckIn = useMutation({
    mutationFn: checkIn,
    onSuccess: (r) => {
      haptic([15, 40, 15]);
      if (r.weekly) confetti({ particles: 90 });
      toast.success(r.weekly ? `Chuỗi ${r.streak} ngày! +${r.reward} điểm thưởng tuần` : `Điểm danh thành công +${r.reward} điểm`);
      refresh();
    },
    onError: (e) => toast.error(apiError(e, "Không điểm danh được")),
  });
  const claim = useMutation({
    mutationFn: claimMission,
    onSuccess: (r) => {
      toast.success(`+${r.reward} điểm`);
      refresh();
    },
    onError: (e) => toast.error(apiError(e, "Không nhận được thưởng")),
  });
  const refer = useMutation({
    mutationFn: enterReferral,
    onSuccess: (r) => {
      toast.success(r.message);
      refresh();
    },
    onError: (e) => toast.error(apiError(e, "Không áp dụng được mã")),
  });

  if (meLoading) return <SectionLoader />;
  if (!me) return <Guest />;
  if (isLoading || !data) return <SectionLoader />;

  const st = TIER_STYLES[data.tier.key] ?? TIER_STYLES.member;
  const progress = data.next ? Math.min(100, Math.round((data.spent / data.next.minSpent) * 100)) : 100;
  const link = data.referral.code ? `${window.location.origin}/?ref=${data.referral.code}` : "";
  const unclaimed = data.missions.filter((m) => m.done && !m.claimed).length;

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Đã sao chép ${label}`);
    } catch {
      toast.error("Không sao chép được");
    }
  };
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Moxic GameStore", text: `Mua game Xbox rẻ hơn Store, dùng mã ${data.referral.code} để nhận ${data.referral.refereeReward} điểm!`, url: link });
      } catch {
        /* cancelled */
      }
    } else copy(link, "link giới thiệu");
  };

  return (
    <Container className="mt-8 mb-20 max-w-5xl space-y-8">
      {/* Tier */}
      <section className="relative overflow-hidden border border-white/10 bg-bg-surface p-5 sm:p-7">
        <div className={`absolute -top-24 -right-24 w-72 h-72 rounded-full bg-gradient-to-br ${st.ring} opacity-20 blur-3xl pointer-events-none`} />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
          <div className={`w-20 h-20 shrink-0 rounded-full p-[3px] bg-gradient-to-br ${st.ring}`}>
            <div className="w-full h-full rounded-full bg-bg-surface flex items-center justify-center">
              <Crown className={`w-9 h-9 ${st.text}`} />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-text-muted">Hạng thành viên</p>
            <h1 className={`font-display text-3xl font-extrabold ${st.text}`}>{data.tier.name}</h1>
            <p className="text-sm text-text-secondary mt-0.5">{data.tier.perk}</p>
            <div className="mt-3">
              <div className="h-2 bg-white/10 overflow-hidden">
                <div className={`h-full origin-left bg-gradient-to-r ${st.ring} transition-transform duration-700`} style={{ transform: `scaleX(${progress / 100})` }} />
              </div>
              <p className="text-xs text-text-muted mt-1.5">
                {data.next ? (
                  <>
                    Chi tiêu {formatPrice(data.spent)}, còn <b className="text-white">{formatPrice(data.next.remaining)}</b> để lên hạng <b className="text-white">{data.next.name}</b>
                  </>
                ) : (
                  "Bạn đã đạt hạng cao nhất. Cảm ơn bạn đã đồng hành cùng Moxic!"
                )}
              </p>
            </div>
          </div>
          <div className="sm:text-right">
            <p className="text-xs text-text-muted">Điểm hiện có</p>
            <p className="font-display text-4xl font-extrabold text-caution tabular-nums">{data.points.toLocaleString("vi-VN")}</p>
            <a href="#doi-diem" className="text-xs text-accent hover:underline">
              Đổi điểm lấy quà
            </a>
            <Link to="/leaderboard" className="block text-xs text-caution hover:underline mt-1">
              <Trophy className="inline w-3.5 h-3.5 mr-1 -mt-0.5" aria-hidden="true" />Đua top tháng
            </Link>
          </div>
        </div>
      </section>

      {/* Check-in */}
      <section className="border border-white/10 bg-bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="font-display text-lg font-bold flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-positive" /> Điểm danh hằng ngày
          </h2>
          <span className="inline-flex items-center gap-1 text-sm text-caution">
            <Flame className="w-4 h-4" /> Chuỗi {data.checkIn.streak} ngày
          </span>
        </div>
        <ol className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-4">
          {data.checkIn.week.map((d) => {
            const bonus = d.day % 7 === 0;
            return (
              <li
                key={d.day}
                className={`relative flex flex-col items-center justify-center py-2.5 sm:py-3 border text-center ${
                  d.done ? "border-positive/50 bg-positive/10" : d.today ? "border-accent bg-accent/10 animate-pulse motion-reduce:animate-none" : "border-white/10"
                }`}
              >
                <span className="text-xs text-text-muted">Ngày {d.day}</span>
                {d.done ? <Check className="w-5 h-5 text-positive my-0.5" /> : bonus ? <Gift className="w-5 h-5 text-caution my-0.5" /> : <span className="font-bold my-0.5">+{d.reward}</span>}
                <span className={`text-xs ${bonus ? "text-caution font-bold" : "text-text-muted"}`}>{bonus ? `+${d.reward}` : "điểm"}</span>
              </li>
            );
          })}
        </ol>
        <button
          type="button"
          onClick={() => doCheckIn.mutate()}
          disabled={data.checkIn.checkedToday || doCheckIn.isPending}
          className="w-full h-12 inline-flex items-center justify-center gap-2 bg-positive hover:bg-positive text-on-accent font-bold disabled:bg-white/10 disabled:text-text-muted cursor-pointer disabled:cursor-default"
        >
          {doCheckIn.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarCheck className="w-4 h-4" />}
          {data.checkIn.checkedToday ? "Đã điểm danh hôm nay, hẹn gặp lại ngày mai!" : `Điểm danh nhận +${data.checkIn.todayReward} điểm`}
        </button>
      </section>

      <div id="doi-diem" className="scroll-mt-[calc(4rem+var(--sat))]">
        <PointsShop signedIn />
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Missions */}
        <section className="lg:col-span-3 border border-white/10 bg-bg-surface p-5">
          <h2 className="font-display text-lg font-bold flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-accent" /> Nhiệm vụ
            {unclaimed > 0 && <span className="px-1.5 py-0.5 text-xs font-bold bg-accent text-on-accent">{unclaimed} chờ nhận</span>}
          </h2>
          <ul className="space-y-2">
            {data.missions.map((m) => (
              <li key={m.key} className={`flex items-center gap-3 p-3 border ${m.claimed ? "border-white/5 opacity-60" : m.done ? "border-accent/50 bg-accent/5" : "border-white/10"}`}>
                <span className={`w-9 h-9 shrink-0 flex items-center justify-center ${m.claimed || m.done ? "bg-positive/15 text-positive" : "bg-white/5 text-text-muted"}`}>
                  {m.claimed || m.done ? <Check className="w-4 h-4" /> : <Target className="w-4 h-4" />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{m.title}</p>
                  <p className="text-sm text-text-muted line-clamp-2">{m.description}</p>
                </div>
                {m.claimed ? (
                  <span className="text-xs text-text-muted">Đã nhận</span>
                ) : m.done ? (
                  <button type="button" onClick={() => claim.mutate(m.key)} disabled={claim.isPending} className="h-10 px-4 bg-accent hover:bg-accent-hover text-on-accent text-sm font-bold transition-colors cursor-pointer">
                    Nhận +{m.points}
                  </button>
                ) : m.link ? (
                  <Link to={m.link} className="h-10 px-4 inline-flex items-center whitespace-nowrap border border-white/15 text-sm font-semibold hover:border-white/30 transition-colors">
                    Làm ngay +{m.points}
                  </Link>
                ) : (
                  <span className="text-xs font-semibold text-text-muted">+{m.points}</span>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* Referral */}
        <section className="lg:col-span-2 border border-white/10 bg-gradient-to-b from-highlight/10 to-transparent p-5 space-y-4">
          <h2 className="font-display text-lg font-bold flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-highlight" /> Mời bạn bè
          </h2>
          <p className="text-sm text-text-secondary">
            Bạn nhận <b className="text-white">{data.referral.referrerReward} điểm</b>, bạn bè nhận <b className="text-white">{data.referral.refereeReward} điểm</b> khi họ hoàn tất đơn đầu tiên.
          </p>
          {data.referral.code && (
            <>
              <div className="flex items-center gap-2 bg-bg-base border border-white/15 pl-4 pr-1 h-12">
                <span className="flex-1 font-mono text-lg font-bold">{data.referral.code}</span>
                <button type="button" onClick={() => copy(data.referral.code!, "mã")} aria-label="Sao chép mã" className="p-2 text-text-muted hover:text-white cursor-pointer">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <button type="button" onClick={share} className="w-full h-11 inline-flex items-center justify-center gap-2 bg-highlight hover:bg-highlight text-white text-sm font-bold cursor-pointer">
                <Share2 className="w-4 h-4" /> Chia sẻ link mời
              </button>
            </>
          )}
          <dl className="grid grid-cols-2 divide-x divide-white/10 border-y border-white/10 py-3 text-center">
            <div>
              <dd className="font-display font-bold text-2xl num">{data.referral.invited}</dd>
              <dt className="text-sm text-text-muted">Đã mời</dt>
            </div>
            <div>
              <dd className="font-display font-bold text-2xl num">{data.referral.rewarded}</dd>
              <dt className="text-sm text-text-muted">Đã nhận thưởng</dt>
            </div>
          </dl>
          {data.referral.canEnterCode && (
            <form
              className="flex gap-2 pt-2 border-t border-white/10"
              onSubmit={(e) => {
                e.preventDefault();
                if (refCode.trim()) refer.mutate(refCode.trim());
              }}
            >
              <input value={refCode} onChange={(e) => setRefCode(e.target.value.toUpperCase())} placeholder="Nhập mã người giới thiệu" maxLength={16} className="flex-1 min-w-0 h-11 bg-bg-base border border-white/15 px-3 text-base font-mono focus:outline-none focus:border-highlight" />
              <button type="submit" disabled={refer.isPending} className="h-11 px-4 border border-highlight/60 text-highlight text-sm font-semibold hover:bg-highlight/10 transition-colors cursor-pointer">
                Áp dụng
              </button>
            </form>
          )}
        </section>
      </div>
    </Container>
  );
}
