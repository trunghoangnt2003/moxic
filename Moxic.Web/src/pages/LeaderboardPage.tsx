import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Crown, Flag, Gamepad2, PenLine, Timer, Trophy, UserPlus } from "lucide-react";
import Container from "../components/layout/Container";
import { SectionLoader } from "../components/shared/MoxicLoader";
import { useMe } from "../hooks/useAccount";
import { usePageMeta } from "../hooks/usePageMeta";

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "/api", withCredentials: true });

interface Row {
  rank: number;
  displayName: string;
  score: number;
  isMe: boolean;
  badges: string[];
}
interface Board {
  key: "referrers" | "reviewers" | "gamers";
  title: string;
  top: Row[];
  me: { rank: number; score: number } | null;
  participants: number;
}
interface LeaderboardData {
  month: string;
  endsAt: string;
  prizes: number[];
  boards: Board[];
  lastMonth: { month: string; winners: { board: string; rank: number; displayName: string; score: number; points: number }[] };
}

const META: Record<Board["key"], { icon: typeof Trophy; unit: string; how: string; cta: { to: string; label: string } }> = {
  gamers: { icon: Gamepad2, unit: "game", how: "Mỗi game bạn mua trong tháng = 1 điểm.", cta: { to: "/games", label: "Săn game" } },
  reviewers: { icon: PenLine, unit: "điểm", how: "Mỗi đánh giá từ 30 ký tự = 1 điểm, đánh giá game đã mua = 2 điểm.", cta: { to: "/games", label: "Viết đánh giá" } },
  referrers: { icon: UserPlus, unit: "bạn", how: "Mỗi bạn bè đăng ký bằng mã của bạn và hoàn tất đơn đầu tiên = 1 điểm.", cta: { to: "/rewards", label: "Lấy link mời" } },
};

// Podium tints for ranks 1 to 3 (gold, silver, bronze), all role tokens.
const MEDAL = ["bg-caution text-on-accent", "bg-text-secondary text-on-accent", "bg-accent-deep text-text-primary"];
const ORDER: Board["key"][] = ["gamers", "reviewers", "referrers"];

function Countdown({ to }: { to: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const ms = Math.max(0, new Date(to).getTime() - now);
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const cell = (v: number, l: string) => (
    <span className="flex flex-col items-center min-w-[3rem] px-2 py-1.5 bg-black/40 border border-white/10">
      <span className="font-display text-xl font-bold tabular-nums">{String(v).padStart(2, "0")}</span>
      <span className="text-[10px] text-text-muted">{l}</span>
    </span>
  );
  return (
    <div className="flex items-center gap-1.5">
      {cell(d, "ngày")}
      {cell(h, "giờ")}
      {cell(m, "phút")}
      {cell(s, "giây")}
    </div>
  );
}

function Avatar({ name, size = "w-10 h-10 text-base" }: { name: string; size?: string }) {
  return (
    <span className={`${size} shrink-0 rounded-full bg-gradient-to-br from-accent to-caution flex items-center justify-center font-display font-extrabold text-on-accent`}>
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

function Podium({ rows, unit, prizes }: { rows: Row[]; unit: string; prizes: number[] }) {
  // Visual order: 2nd, 1st, 3rd
  const slots = [rows[1], rows[0], rows[2]];
  const heights = ["h-20", "h-28", "h-14"];
  const ranks = [2, 1, 3];
  return (
    <div className="grid grid-cols-3 items-end gap-2 sm:gap-4 max-w-xl mx-auto pt-6">
      {slots.map((r, i) => (
        <div key={ranks[i]} className="flex flex-col items-center text-center min-w-0" style={{ animation: `popIn .5s ${[0.15, 0, 0.3][i]}s both ease-out` }}>
          {r ? (
            <>
              <span className={`w-7 h-7 mb-1 rounded-full flex items-center justify-center text-xs font-bold tabular-nums ${MEDAL[ranks[i] - 1]}`}>{ranks[i]}</span>
              <div className={`relative ${ranks[i] === 1 ? "ring-2 ring-caution shadow-lg shadow-caution/30" : ""} rounded-full`}>
                <Avatar name={r.displayName} size={ranks[i] === 1 ? "w-16 h-16 text-2xl" : "w-12 h-12 text-lg"} />
                {ranks[i] === 1 && <Crown className="absolute -top-4 left-1/2 -translate-x-1/2 w-6 h-6 text-caution" />}
              </div>
              <p className={`mt-2 text-sm font-semibold truncate max-w-full ${r.isMe ? "text-accent" : ""}`}>
                {r.displayName}
                {r.isMe && " (bạn)"}
              </p>
              <p className="text-xs text-text-muted">
                {r.score} {unit}
              </p>
            </>
          ) : (
            <p className="text-xs text-text-muted mb-2">Còn trống</p>
          )}
          <div
            className={`mt-2 w-full ${heights[i]} border-t-2 ${ranks[i] === 1 ? "border-caution bg-gradient-to-b from-caution/25" : ranks[i] === 2 ? "border-text-muted bg-gradient-to-b from-text-muted/15" : "border-caution bg-gradient-to-b from-caution/15"} to-transparent flex items-start justify-center pt-2`}
          >
            <span className="text-[11px] font-bold text-caution">+{prizes[ranks[i] - 1]} điểm</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Monthly community leaderboards with prizes and badges. */
export default function LeaderboardPage() {
  usePageMeta("Bảng xếp hạng", "Top game thủ, cây bút đánh giá và đại sứ giới thiệu của Moxic tháng này.");
  const { data: me } = useMe();
  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard", !!me],
    queryFn: async () => (await api.get<LeaderboardData>("/leaderboard")).data,
    refetchInterval: 120_000,
  });
  const [tab, setTab] = useState<Board["key"]>("gamers");

  if (isLoading || !data) return <SectionLoader />;
  const board = data.boards.find((b) => b.key === tab)!;
  const meta = META[tab];
  const [mm, yyyy] = [data.month.slice(5), data.month.slice(0, 4)];

  return (
    <Container className="mt-8 mb-24 max-w-4xl">
      {/* Hero */}
      <section className="relative overflow-hidden border border-white/10 bg-gradient-to-br from-caution/15 via-bg-surface to-highlight/10 p-5 sm:p-7 text-center">
        <Trophy className="absolute -left-6 -bottom-8 w-40 h-40 text-caution/10 -rotate-12" />
        <p className="text-xs text-caution">Tháng {mm}/{yyyy}</p>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold mt-1">Bảng xếp hạng</h1>
        <p className="text-sm text-text-secondary mt-2">Top 3 mỗi bảng nhận điểm thưởng + huy hiệu hiển thị cạnh tên bạn.</p>
        <div className="flex justify-center mt-4">
          <Countdown to={data.endsAt} />
        </div>
        <p className="mt-2 text-[11px] text-text-muted inline-flex items-center gap-1">
          <Timer className="w-3 h-3" /> Chốt bảng & trao giải tự động khi hết tháng
        </p>
      </section>

      {/* Tabs */}
      <div className="grid grid-cols-3 gap-2 mt-5">
        {ORDER.map((k) => {
          const b = data.boards.find((x) => x.key === k)!;
          const Icon = META[k].icon;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`flex flex-col items-center gap-1 py-3 px-2 border transition-colors cursor-pointer ${tab === k ? "border-accent bg-accent/10 text-white" : "border-white/10 text-text-muted hover:text-white"}`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs sm:text-sm font-semibold text-center leading-tight">{b.title}</span>
            </button>
          );
        })}
      </div>

      <section className="border border-white/10 border-t-0 bg-bg-surface p-4 sm:p-6">
        <p className="text-xs text-text-muted text-center">{meta.how}</p>

        {board.top.length === 0 ? (
          <div className="text-center py-12">
            <Flag className="w-10 h-10 mx-auto mb-2 text-text-muted" aria-hidden="true" />
            <p className="font-semibold">Chưa ai ghi điểm tháng này</p>
            <p className="text-sm text-text-muted mb-4">Ghi điểm đầu tiên để lên ngay hạng 1!</p>
            <Link to={meta.cta.to} className="inline-flex h-10 px-5 items-center bg-accent text-on-accent text-sm font-bold">
              {meta.cta.label}
            </Link>
          </div>
        ) : (
          <>
            <Podium rows={board.top} unit={meta.unit} prizes={data.prizes} />
            <ol className="mt-6 divide-y divide-white/5">
              {board.top.slice(3).map((r) => (
                <li key={r.rank} className={`flex items-center gap-3 py-2.5 px-2 ${r.isMe ? "bg-accent/10" : ""}`}>
                  <span className="w-7 text-center font-display font-bold text-text-muted">{r.rank}</span>
                  <Avatar name={r.displayName} size="w-8 h-8 text-sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {r.displayName}
                      {r.isMe && <span className="text-accent"> (bạn)</span>}
                    </p>
                    {r.badges.length > 0 && <p className="text-[10px] text-caution/80 truncate">{r.badges[0]}</p>}
                  </div>
                  <span className="text-sm font-bold tabular-nums">
                    {r.score} <span className="text-xs text-text-muted font-normal">{meta.unit}</span>
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>

      {/* My rank */}
      <div className="sticky bottom-[calc(1rem+var(--sab))] mt-4 z-20">
        {me ? (
          <div className="flex items-center gap-3 border border-accent/40 bg-bg-elevated/95 backdrop-blur-md p-3 shadow-2xl shadow-black/60">
            <Avatar name={me.displayName} size="w-9 h-9 text-sm" />
            <p className="flex-1 text-sm">
              {board.me ? (
                <>
                  Bạn đang hạng <b className="text-accent">#{board.me.rank}</b> với <b>{board.me.score}</b> {meta.unit}
                  {board.me.rank > 3 && board.top[2] && <span className="text-text-muted">, cần {board.top[2].score - board.me.score + 1} nữa để vào top 3</span>}
                </>
              ) : (
                <span className="text-text-secondary">Bạn chưa có điểm ở bảng này tháng này.</span>
              )}
            </p>
            <Link to={meta.cta.to} className="shrink-0 h-9 px-3 inline-flex items-center bg-accent text-on-accent text-xs font-bold">
              {meta.cta.label}
            </Link>
          </div>
        ) : (
          <Link to="/login?redirect=/leaderboard" className="block text-center border border-accent/40 bg-bg-elevated/95 p-3 text-sm font-semibold text-accent">
            Đăng nhập để tham gia đua top & nhận thưởng
          </Link>
        )}
      </div>

      {/* Last month */}
      {data.lastMonth.winners.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-lg font-bold mb-3">
            <Trophy className="inline w-5 h-5 mr-1.5 -mt-0.5 text-caution" aria-hidden="true" />Vinh danh tháng {data.lastMonth.month.slice(5)}/{data.lastMonth.month.slice(0, 4)}
          </h2>
          <div className="grid sm:grid-cols-3 gap-3">
            {ORDER.map((k) => {
              const ws = data.lastMonth.winners.filter((w) => w.board === k);
              if (ws.length === 0) return null;
              return (
                <div key={k} className="border border-white/10 bg-bg-surface p-4">
                  <p className="text-xs text-text-muted mb-2">{data.boards.find((b) => b.key === k)?.title}</p>
                  {ws.map((w) => (
                    <p key={w.rank} className="text-sm flex justify-between gap-2">
                      <span className="truncate">
                        <span className={`inline-flex w-5 h-5 mr-1.5 rounded-full items-center justify-center text-[10px] font-bold ${MEDAL[w.rank - 1]}`}>{w.rank}</span>{w.displayName}
                      </span>
                      <span className="text-caution text-xs shrink-0">+{w.points} điểm</span>
                    </p>
                  ))}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </Container>
  );
}
