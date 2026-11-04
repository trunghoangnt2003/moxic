import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Clock, Gamepad2, KeyRound } from "lucide-react";
import Container from "../components/layout/Container";
import { SectionLoader } from "../components/shared/MoxicLoader";
import { getMyRentals, RENTAL_STATUS } from "../lib/rentalApi";
import { formatPrice } from "../lib/utils";

function daysLeft(iso: string | null) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Đã hết hạn";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  return d > 0 ? `Còn ${d} ngày ${h} giờ` : `Còn ${h} giờ`;
}

/** "Game đang thuê": the customer's rentals, active first. */
export default function RentalsPage() {
  const { data, isLoading } = useQuery({ queryKey: ["rentals", "mine"], queryFn: getMyRentals });
  const order = ["Active", "AwaitingConfirmation", "PendingPayment", "Expired", "Returned", "Cancelled"];
  const items = [...(data ?? [])].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));

  return (
    <Container className="mt-8 mb-20 max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl md:text-4xl font-bold flex items-center gap-3">
            <KeyRound className="w-7 h-7 text-emerald-400" /> Game đang thuê
          </h1>
          <p className="text-sm text-text-muted mt-1">Thông tin tài khoản, hạn thuê và gia hạn.</p>
        </div>
        <Link to="/rent" className="h-10 px-4 inline-flex items-center bg-emerald-500 text-bg-base text-sm font-bold">
          Thuê thêm game
        </Link>
      </div>

      {isLoading ? (
        <SectionLoader />
      ) : items.length === 0 ? (
        <div className="text-center py-20 bg-black/40 border border-white/5">
          <Gamepad2 className="w-12 h-12 mx-auto text-emerald-400/50 mb-4" />
          <p className="font-semibold mb-1">Bạn chưa thuê game nào</p>
          <p className="text-sm text-text-muted mb-6">Chơi game bom tấn chỉ với một phần nhỏ giá mua.</p>
          <Link to="/rent" className="inline-flex h-11 items-center px-6 bg-emerald-500 text-bg-base text-sm font-bold">
            Xem game cho thuê
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((r) => {
            const st = RENTAL_STATUS[r.status];
            return (
              <li key={r.code}>
                <Link to={`/account/rentals/${r.code}`} className="group flex items-center gap-4 p-3 bg-bg-surface border border-white/10 hover:border-white/25 transition-colors">
                  <div className="w-14 h-18 sm:w-16 sm:h-20 shrink-0 bg-bg-elevated overflow-hidden">
                    {r.coverUrl ? <img loading="lazy" decoding="async" src={r.coverUrl} alt="" className="w-full h-full object-cover" /> : <Gamepad2 className="w-6 h-6 m-auto mt-6 text-accent/40" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-1.5 py-0.5 text-[10px] font-bold uppercase border ${st.cls}`}>{st.label}</span>
                      <span className="text-[11px] font-mono text-text-muted">{r.code}</span>
                    </div>
                    <p className="font-semibold truncate mt-1">{r.gameName}</p>
                    <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1">
                      {r.status === "Active" ? (
                        <>
                          <Clock className="w-3 h-3" /> {daysLeft(r.endsAt)}
                        </>
                      ) : (
                        <>
                          {r.days} ngày · {formatPrice(r.price)}
                        </>
                      )}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-text-muted group-hover:text-white shrink-0" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Container>
  );
}
