import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Copy, Gamepad2, Gift, MessageCircle, TicketPercent } from "lucide-react";
import toast from "react-hot-toast";
import Container from "../components/layout/Container";
import { SectionLoader } from "../components/shared/MoxicLoader";
import { useChatUi } from "../lib/chatApi";
import { getMySpinRewards, type SpinReward } from "../lib/luckySpinApi";
import { t, locale } from "../lib/i18n";

const STATUS: Record<SpinReward["status"], { label: string; tone: string }> = {
  NoPrize: { label: t("Không trúng"), tone: "border-white/15 text-text-muted" },
  Processing: { label: t("Đang chờ Moxic xử lý"), tone: "border-caution/50 text-caution" },
  Delivered: { label: t("Đã trao"), tone: "border-positive/50 text-positive" },
  ClaimCoupon: { label: t("Chưa nhận vào ví"), tone: "border-caution/50 text-caution" },
  Usable: { label: t("Trong ví, dùng được"), tone: "border-positive/50 text-positive" },
  Upcoming: { label: t("Chưa đến ngày dùng"), tone: "border-info/50 text-info" },
  Used: { label: t("Đã dùng"), tone: "border-white/15 text-text-muted" },
  Expired: { label: t("Hết hạn"), tone: "border-white/15 text-text-muted" },
  Inactive: { label: t("Đã vô hiệu"), tone: "border-white/15 text-text-muted" },
};

const when = (iso: string) => new Date(iso).toLocaleString(locale, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

function copy(text: string) {
  navigator.clipboard?.writeText(text).then(
    () => toast.success(t("Đã sao chép")),
    () => toast.error(t("Không sao chép được")),
  );
}

function RewardRow({ r }: { r: SpinReward }) {
  const openChat = useChatUi((s) => s.openChat);
  const st = STATUS[r.status];
  const Icon = r.prizeType === "Discount" ? TicketPercent : r.prizeType === "Game" ? Gamepad2 : Gift;

  return (
    <li className="grid grid-cols-[56px_minmax(0,1fr)] sm:grid-cols-[56px_minmax(0,1fr)_auto] gap-x-4 gap-y-3 p-4">
      <div className="w-14 h-[74px] overflow-hidden bg-bg-elevated flex items-center justify-center">
        {r.imageUrl ? <img src={r.imageUrl} alt="" loading="lazy" className="w-full h-full object-cover" /> : <Icon className="w-6 h-6 text-text-muted" />}
      </div>
      <div className="min-w-0">
        {r.gameId ? (
          <Link to={`/games/${r.gameId}`} className="font-semibold text-text-primary hover:text-accent transition-colors line-clamp-2">
            {r.prizeName}
          </Link>
        ) : (
          <p className="font-semibold text-text-primary line-clamp-2">{r.prizeName}</p>
        )}
        <p className="mt-1 text-sm text-text-muted">
          {r.caseName}, {when(r.createdAt)}
        </p>
        {r.rewardCode && (
          <button type="button" onClick={() => copy(r.rewardCode!)} aria-label={t("Sao chép mã")} className="mt-1 inline-flex items-center gap-1.5 font-mono text-sm text-text-secondary hover:text-accent transition-colors cursor-pointer">
            {r.rewardCode} <Copy className="w-3.5 h-3.5" />
          </button>
        )}
        {r.status === "Delivered" && r.claimedAt && <p className="mt-1 text-sm text-text-muted">{t("Moxic đã trao lúc {0}", [when(r.claimedAt)])}</p>}
      </div>
      <div className="col-span-2 sm:col-span-1 flex flex-wrap sm:flex-col items-center sm:items-end gap-2">
        <span className={`px-2 py-0.5 border text-xs font-semibold whitespace-nowrap ${st.tone}`}>{st.label}</span>
        {r.status === "Processing" && (
          <button type="button" onClick={() => openChat()} className="h-10 px-3 inline-flex items-center gap-1.5 border border-white/15 text-sm font-semibold text-text-primary hover:border-white/30 transition-colors cursor-pointer">
            <MessageCircle className="w-4 h-4" /> {t("Nhắn Moxic để nhận")}
          </button>
        )}
        {r.status === "ClaimCoupon" && r.rewardCode && (
          <Link to={`/account/coupons?claim=${encodeURIComponent(r.rewardCode)}`} className="h-10 px-3 inline-flex items-center text-sm font-semibold text-accent hover:underline">
            {t("Nhận mã vào ví")}
          </Link>
        )}
        {r.status === "Usable" && (
          <Link to="/account/coupons" className="h-10 px-3 inline-flex items-center text-sm font-semibold text-accent hover:underline">
            {t("Xem ví mã giảm giá")}
          </Link>
        )}
      </div>
    </li>
  );
}

/** Everything the customer has won from cases, and whether each prize has reached them yet. */
export default function SpinRewardsPage() {
  const [page, setPage] = useState(1);
  const [all, setAll] = useState(false);
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["account", "spin-rewards", page, all],
    queryFn: () => getMySpinRewards(page, all),
  });
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const tab = (value: boolean, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={all === value}
      onClick={() => {
        setAll(value);
        setPage(1);
      }}
      className={`h-11 px-4 text-sm font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${all === value ? "border-accent text-text-primary" : "border-transparent text-text-muted hover:text-text-primary"}`}
    >
      {label}
    </button>
  );

  return (
    <Container>
      <div className="max-w-4xl">
        <h1 className="font-display text-3xl font-bold text-text-primary mb-2">{t("Phần quà đã mở")}</h1>
        <p className="text-sm text-text-muted">{t("Quà bạn trúng khi mở hòm trong lúc đã đăng nhập, và trạng thái của từng món.")}</p>

        {(data?.pending ?? 0) > 0 && (
          <p className="mt-4 border-l-2 border-caution bg-caution/10 px-4 py-3 text-sm text-text-primary">
            {t("{0} phần quà đang chờ Moxic xử lý. Nhắn Moxic kèm mã thưởng để nhận; khi xong, trạng thái đổi thành Đã trao và bạn nhận được thông báo.", [data!.pending])}
          </p>
        )}

        <div role="tablist" className="flex border-b border-white/10 mt-6 mb-4">
          {tab(false, t("Đã trúng"))}
          {tab(true, t("Tất cả lượt mở"))}
        </div>

        {isLoading ? (
          <SectionLoader />
        ) : isError ? (
          <div className="border border-dashed border-white/15 p-8 text-center">
            <p className="mb-4 text-sm text-negative">{t("Không tải được phần quà. Vui lòng thử lại.")}</p>
            <button type="button" onClick={() => void refetch()} className="h-11 px-6 bg-accent hover:bg-accent-hover text-on-accent text-sm font-semibold transition-colors cursor-pointer">
              {t("Thử lại")}
            </button>
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="border border-dashed border-white/15 p-10 text-center">
            <Gift className="mx-auto mb-3 h-10 w-10 text-text-muted" />
            <p className="text-sm text-text-secondary mb-5">{t("Bạn chưa có phần quà nào.")}</p>
            <Link to="/lucky-spin" className="inline-flex h-11 items-center bg-accent hover:bg-accent-hover text-on-accent px-6 text-sm font-semibold transition-colors">
              {t("Mở hòm ngay")}
            </Link>
          </div>
        ) : (
          <>
            <ul className={`divide-y divide-white/10 border border-white/10 bg-bg-surface transition-opacity ${isFetching ? "opacity-70" : ""}`}>
              {data.items.map((r) => (
                <RewardRow key={r.id} r={r} />
              ))}
            </ul>
            {data.total > data.pageSize && (
              <nav className="mt-6 flex items-center justify-center gap-4" aria-label={t("Phân trang")}>
                <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} aria-label={t("Trang trước")} className="p-2 border border-white/10 text-text-secondary hover:bg-bg-elevated disabled:opacity-40 cursor-pointer">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-text-secondary num">{page} / {totalPages}</span>
                <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} aria-label={t("Trang sau")} className="p-2 border border-white/10 text-text-secondary hover:bg-bg-elevated disabled:opacity-40 cursor-pointer">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </Container>
  );
}
