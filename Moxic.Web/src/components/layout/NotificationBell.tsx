import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Bell, CheckCheck, Coins, KeyRound, Package, Tag, Info } from "lucide-react";
import { timeAgo } from "../../lib/utils";
import PushToggle from "../shared/PushToggle";

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "/api", withCredentials: true });

interface Note {
  id: string;
  type: "order" | "rental" | "price" | "points" | "system";
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
}

const ICONS = { order: Package, rental: KeyRound, price: Tag, points: Coins, system: Info } as const;
const TINT = {
  order: "text-sky-300 bg-sky-500/15",
  rental: "text-emerald-300 bg-emerald-500/15",
  price: "text-rose-300 bg-rose-500/15",
  points: "text-amber-300 bg-amber-500/15",
  system: "text-text-secondary bg-white/10",
} as const;

/** Navbar bell for signed-in customers: unread badge, dropdown, mark read. Polls every 60s. */
export default function NotificationBell() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await api.get<{ unread: number; items: Note[] }>("/notifications")).data,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const readOne = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSettled: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const readAll = useMutation({
    mutationFn: () => api.post("/notifications/read-all"),
    onSettled: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unread = data?.unread ?? 0;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Thông báo${unread ? ` (${unread} chưa đọc)` : ""}`}
        aria-expanded={open}
        className="relative text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
      >
        <Bell className={`w-5 h-5 ${unread > 0 ? "text-amber-300 origin-top animate-[bellRing_1.2s_ease-in-out_2]" : ""}`} />
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-0.5 bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed sm:absolute inset-x-2 sm:inset-x-auto top-14 sm:top-auto sm:right-0 sm:mt-3 sm:w-[360px] z-[60] bg-bg-surface border border-white/10 shadow-2xl shadow-black/60">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <p className="font-display font-bold">Thông báo</p>
            {unread > 0 && (
              <button type="button" onClick={() => readAll.mutate()} className="inline-flex items-center gap-1 text-xs text-accent hover:underline cursor-pointer">
                <CheckCheck className="w-3.5 h-3.5" /> Đánh dấu đã đọc
              </button>
            )}
          </div>
          <ul className="max-h-[60vh] overflow-y-auto divide-y divide-white/5">
            {(data?.items ?? []).length === 0 && <li className="px-4 py-10 text-center text-sm text-text-muted">Chưa có thông báo nào.</li>}
            {data?.items.map((n) => {
              const Icon = ICONS[n.type] ?? Info;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!n.read) readOne.mutate(n.id);
                      setOpen(false);
                      if (n.link) navigate(n.link);
                    }}
                    className={`w-full flex gap-3 px-4 py-3 text-left hover:bg-white/[0.04] cursor-pointer ${n.read ? "" : "bg-accent/[0.04]"}`}
                  >
                    <span className={`w-9 h-9 shrink-0 flex items-center justify-center ${TINT[n.type] ?? TINT.system}`}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className={`block text-sm leading-snug ${n.read ? "text-text-secondary" : "text-white font-semibold"}`}>{n.title}</span>
                      {n.body && <span className="block text-xs text-text-muted mt-0.5 line-clamp-2">{n.body}</span>}
                      <span className="block text-[11px] text-text-muted mt-1">{timeAgo(n.createdAt)}</span>
                    </span>
                    {!n.read && <span className="w-2 h-2 mt-1.5 shrink-0 rounded-full bg-accent" aria-label="Chưa đọc" />}
                  </button>
                </li>
              );
            })}
          </ul>
          <PushToggle compact />
        </div>
      )}
    </div>
  );
}
