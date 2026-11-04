import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  BellRing,
  CheckCircle2,
  Clock,
  Coins,
  Gamepad2,
  Heart,
  KeyRound,
  Library as LibraryIcon,
  Loader2,
  Lock,
  MessageSquareText,
  Package,
  Save,
  ShieldCheck,
  TicketPercent,
  UserCog,
  Wrench,
} from "lucide-react";
import Container from "../components/layout/Container";
import { SectionLoader } from "../components/shared/MoxicLoader";
import { apiError, changePassword, getLibrary, getProfile, updateProfile } from "../lib/communityApi";
import { formatPrice } from "../lib/utils";
import PushToggle from "../components/shared/PushToggle";

const INSTALL = {
  Installed: { label: "Đã cài đặt", cls: "text-emerald-300 bg-emerald-500/15 border-emerald-500/40", icon: CheckCircle2 },
  Installing: { label: "Đang cài đặt", cls: "text-sky-300 bg-sky-500/15 border-sky-500/40", icon: Wrench },
  ActionRequired: { label: "Cần bạn xử lý", cls: "text-amber-300 bg-amber-500/15 border-amber-500/40", icon: Clock },
} as const;

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("vi-VN") : "—");

function LibraryTab() {
  const { data, isLoading } = useQuery({ queryKey: ["account", "library"], queryFn: getLibrary });
  if (isLoading) return <SectionLoader />;
  if (!data || (data.owned.length === 0 && data.rentals.length === 0)) {
    return (
      <div className="text-center py-16 bg-black/40 border border-white/5">
        <Gamepad2 className="w-12 h-12 mx-auto text-accent/40 mb-4" />
        <p className="font-semibold mb-1">Thư viện đang trống</p>
        <p className="text-sm text-text-muted mb-6">Game bạn mua hoặc thuê sẽ xuất hiện ở đây.</p>
        <div className="flex justify-center gap-2">
          <Link to="/games" className="h-11 px-5 inline-flex items-center bg-accent text-bg-base text-sm font-bold">
            Mua game
          </Link>
          <Link to="/rent" className="h-11 px-5 inline-flex items-center border border-emerald-500/50 text-emerald-300 text-sm font-bold">
            Thuê game
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-8">
      {data.rentals.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-widest text-emerald-300 font-semibold mb-3 flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5" /> Đang thuê
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {data.rentals.map((r) => (
              <Link key={r.code} to={`/account/rentals/${r.code}`} className="flex items-center gap-3 p-3 bg-bg-surface border border-emerald-500/30 hover:border-emerald-400/60">
                <div className="w-12 h-16 shrink-0 bg-bg-elevated overflow-hidden">{r.coverUrl && <img loading="lazy" decoding="async" src={r.coverUrl} alt="" className="w-full h-full object-cover" />}</div>
                <div className="min-w-0">
                  <p className="font-semibold truncate">{r.gameName}</p>
                  <p className={`text-xs ${r.status === "Expired" ? "text-rose-300" : "text-text-muted"}`}>{r.status === "Expired" ? "Đã hết hạn — gia hạn ngay" : `Hết hạn ${day(r.endsAt)}`}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
      {data.owned.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-widest text-text-muted font-semibold mb-3 flex items-center gap-1.5">
            <LibraryIcon className="w-3.5 h-3.5" /> Đã mua ({data.owned.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {data.owned.map((g) => {
              const st = INSTALL[g.installStatus];
              return (
                <div key={g.gameId} className="group bg-bg-surface border border-border overflow-hidden">
                  <Link to={`/games/${g.gameId}`} className="block relative aspect-[3/4] bg-bg-elevated overflow-hidden">
                    {g.coverUrl ? (
                      <img src={g.coverUrl} alt={g.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                    ) : (
                      <Gamepad2 className="w-8 h-8 m-auto mt-16 text-accent/40" />
                    )}
                    <span className={`absolute top-2 left-2 inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold border backdrop-blur-sm ${st.cls}`}>
                      <st.icon className="w-3 h-3" /> {st.label}
                    </span>
                  </Link>
                  <div className="p-3">
                    <p className="text-sm font-semibold truncate">{g.name}</p>
                    <p className="text-[11px] text-text-muted truncate">
                      {g.editionName ? `${g.editionName} · ` : ""}
                      {day(g.purchasedAt)}
                    </p>
                    <Link to={`/account/orders/${g.orderCode}`} className="text-[11px] text-accent hover:underline">
                      Đơn {g.orderCode}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsTab({ displayName, priceAlerts }: { displayName: string; priceAlerts: boolean }) {
  const qc = useQueryClient();
  const [name, setName] = useState(displayName);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const save = useMutation({
    mutationFn: (patch: { displayName?: string; priceAlerts?: boolean }) => updateProfile(patch),
    onSuccess: () => {
      toast.success("Đã lưu");
      qc.invalidateQueries({ queryKey: ["account"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e) => toast.error(apiError(e, "Không lưu được")),
  });
  const pw = useMutation({
    mutationFn: () => changePassword(current, next),
    onSuccess: () => {
      toast.success("Đã đổi mật khẩu. Các thiết bị khác đã được đăng xuất.");
      setCurrent("");
      setNext("");
      setConfirm("");
    },
    onError: (e) => toast.error(apiError(e, "Không đổi được mật khẩu")),
  });

  const input = "w-full h-11 bg-bg-base border border-border px-3 text-sm focus:outline-none focus:border-accent/60";
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <section className="bg-bg-surface border border-border p-5 space-y-4">
        <h3 className="font-display font-bold flex items-center gap-2">
          <UserCog className="w-4 h-4 text-accent" /> Hồ sơ
        </h3>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate({ displayName: name.trim() });
          }}
        >
          <label className="block text-xs text-text-muted">
            Tên hiển thị (dùng cho đánh giá, thảo luận)
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={50} minLength={2} required className={`${input} mt-1`} />
          </label>
          <button type="submit" disabled={save.isPending || name.trim() === displayName} className="h-10 px-4 inline-flex items-center gap-2 bg-accent text-bg-base text-sm font-bold disabled:opacity-40 cursor-pointer">
            {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Lưu tên
          </button>
        </form>
        <label className="flex items-center justify-between gap-3 pt-4 border-t border-white/5 cursor-pointer">
          <span className="flex items-center gap-2 text-sm">
            <BellRing className="w-4 h-4 text-rose-400" /> Email khi game yêu thích giảm giá
          </span>
          <input type="checkbox" className="sr-only peer" checked={priceAlerts} onChange={(e) => save.mutate({ priceAlerts: e.target.checked })} />
          <span className="relative shrink-0 w-9 h-5 bg-white/10 transition-colors peer-checked:bg-rose-500 after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:bg-white after:transition-transform peer-checked:after:translate-x-4" />
        </label>
        <div className="pt-4 border-t border-white/5">
          <PushToggle />
        </div>
      </section>

      <section className="bg-bg-surface border border-border p-5 space-y-4">
        <h3 className="font-display font-bold flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" /> Đổi mật khẩu
        </h3>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (next !== confirm) {
              toast.error("Mật khẩu nhập lại không khớp");
              return;
            }
            pw.mutate();
          }}
        >
          <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="Mật khẩu hiện tại" required className={input} />
          <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="Mật khẩu mới (≥ 8 ký tự, có chữ số)" minLength={8} required className={input} />
          <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Nhập lại mật khẩu mới" required className={input} />
          <button type="submit" disabled={pw.isPending} className="h-10 px-4 inline-flex items-center gap-2 border border-emerald-500/50 text-emerald-300 text-sm font-bold disabled:opacity-40 cursor-pointer">
            {pw.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />} Đổi mật khẩu
          </button>
        </form>
      </section>
    </div>
  );
}

export default function AccountPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "settings" ? "settings" : "library";
  const { data: p, isLoading } = useQuery({ queryKey: ["account", "profile"], queryFn: getProfile });

  if (isLoading || !p) return <SectionLoader />;
  const initials = p.displayName.trim().split(/\s+/).map((x) => x[0]).slice(0, 2).join("").toUpperCase() || "M";

  const stats = [
    { icon: Package, label: "Đơn hàng", value: p.stats.orders, to: "/account/orders" },
    { icon: KeyRound, label: "Đang thuê", value: p.stats.activeRentals, to: "/account/rentals" },
    { icon: Heart, label: "Yêu thích", value: p.stats.wishlist, to: "/wishlist" },
    { icon: Coins, label: "Điểm thưởng", value: p.points.toLocaleString("vi-VN"), to: "/rewards" },
    { icon: TicketPercent, label: "Mã giảm giá", value: "Ví", to: "/account/coupons" },
    { icon: MessageSquareText, label: "Đánh giá", value: p.stats.reviews, to: null },
  ];

  return (
    <Container className="mt-8 mb-20">
      <section className="relative overflow-hidden border border-white/10 bg-bg-surface p-5 sm:p-7 mb-6">
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
          <span className="w-16 h-16 shrink-0 rounded-full bg-gradient-to-br from-accent to-amber-600 flex items-center justify-center font-display text-2xl font-extrabold text-bg-base">{initials}</span>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl sm:text-3xl font-bold truncate">{p.displayName}</h1>
            <p className="text-sm text-text-muted truncate">
              {p.email} · thành viên từ {day(p.memberSince)}
            </p>
          </div>
          <div className="sm:text-right">
            <p className="text-[11px] uppercase tracking-wider text-text-muted">Đã chi tiêu</p>
            <p className="font-display text-xl font-bold text-accent">{formatPrice(p.stats.spent)}</p>
          </div>
        </div>
        <div className="relative grid grid-cols-3 sm:grid-cols-6 gap-2 mt-6">
          {stats.map((s) => {
            const body = (
              <>
                <s.icon className="w-4 h-4 text-text-muted mx-auto" />
                <p className="font-bold mt-1">{s.value}</p>
                <p className="text-[11px] text-text-muted">{s.label}</p>
              </>
            );
            return s.to ? (
              <Link key={s.label} to={s.to} className="text-center py-3 bg-black/30 border border-white/5 hover:border-white/20 transition-colors">
                {body}
              </Link>
            ) : (
              <div key={s.label} className="text-center py-3 bg-black/30 border border-white/5">
                {body}
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex border-b border-white/10 mb-6">
        {[
          { key: "library", label: "Thư viện game", icon: LibraryIcon },
          { key: "settings", label: "Hồ sơ & bảo mật", icon: UserCog },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setParams(t.key === "library" ? {} : { tab: t.key }, { replace: true })}
            className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 -mb-px cursor-pointer ${tab === t.key ? "border-accent text-white" : "border-transparent text-text-muted hover:text-white"}`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "library" ? <LibraryTab /> : <SettingsTab key={p.displayName + p.priceAlerts} displayName={p.displayName} priceAlerts={p.priceAlerts} />}
    </Container>
  );
}
