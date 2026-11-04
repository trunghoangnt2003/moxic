import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, X } from "lucide-react";
import { getRecentPurchases } from "../../lib/api";

const FIRST_DELAY_MS = 8_000;
const SHOW_MS = 6_000;
const GAP_MS = 22_000;
const HIDE_KEY = "moxic.purchaseToast.off";
// Never distract during payment / account flows.
const QUIET_PATHS = ["/checkout", "/confirmation", "/cart", "/login", "/register", "/verify-email", "/forgot-password", "/lucky-spin/"];

function ago(iso: string, serverOffset: number) {
  const s = Math.max(0, (Date.now() + serverOffset - new Date(iso).getTime()) / 1000);
  if (s < 60) return "vừa xong";
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  return `${Math.floor(s / 86400)} ngày trước`;
}

/** Bottom-left social proof: real recent purchases (masked names), one at a time. */
export default function PurchaseToast() {
  const { pathname } = useLocation();
  const [off, setOff] = useState(() => {
    try {
      return sessionStorage.getItem(HIDE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const quiet = QUIET_PATHS.some((p) => pathname.startsWith(p));
  const { data } = useQuery({
    queryKey: ["activity", "recent-purchases"],
    queryFn: getRecentPurchases,
    staleTime: 60_000,
    refetchInterval: 120_000,
    enabled: !off,
  });
  const items = useMemo(() => data?.items ?? [], [data]);
  const offset = useMemo(() => (data ? new Date(data.serverNow).getTime() - Date.now() : 0), [data]);
  const [index, setIndex] = useState(-1);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (off || quiet || items.length === 0) {
      setVisible(false);
      return;
    }
    let showTimer: number;
    let hideTimer: number;
    const cycle = (delay: number) => {
      showTimer = window.setTimeout(() => {
        setIndex((i) => (i + 1) % items.length);
        setVisible(true);
        hideTimer = window.setTimeout(() => {
          setVisible(false);
          cycle(GAP_MS);
        }, SHOW_MS);
      }, delay);
    };
    cycle(FIRST_DELAY_MS);
    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, [off, quiet, items.length]);

  if (off || quiet || index < 0 || items.length === 0) return null;
  const p = items[index % items.length];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed left-3 bottom-3 sm:left-5 sm:bottom-5 z-40 w-[calc(100vw-6rem)] max-w-[340px] transition-all duration-500 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      }`}
    >
      <div className="relative flex items-center gap-3 p-2.5 pr-8 bg-bg-surface/95 backdrop-blur-md border border-white/10 shadow-2xl shadow-black/60">
        <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-emerald-400 to-accent" />
        <Link to={`/games/${p.gameId}`} className="w-11 h-14 shrink-0 bg-bg-elevated overflow-hidden">
          {p.coverUrl && <img src={p.coverUrl} alt="" className="w-full h-full object-cover" />}
        </Link>
        <div className="min-w-0 text-xs leading-snug">
          <p className="text-text-secondary">
            <span className="font-semibold text-white">{p.buyer}</span> vừa mua
          </p>
          <Link to={`/games/${p.gameId}`} className="block font-semibold text-accent truncate hover:underline">
            {p.gameName}
          </Link>
          <p className="flex items-center gap-1 text-[11px] text-text-muted mt-0.5">
            <BadgeCheck className="w-3 h-3 text-emerald-400" /> Đã xác thực · {ago(p.at, offset)}
          </p>
        </div>
        <button
          type="button"
          aria-label="Tắt thông báo mua hàng"
          onClick={() => {
            try {
              sessionStorage.setItem(HIDE_KEY, "1");
            } catch {
              /* ignore */
            }
            setOff(true);
          }}
          className="absolute top-1.5 right-1.5 p-1 text-text-muted hover:text-white cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
