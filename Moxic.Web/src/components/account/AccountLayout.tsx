import { createContext, useContext } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Coins, Heart, KeyRound, LayoutGrid, LogOut, Package, TicketPercent, Trophy } from "lucide-react";
import { useLogout, useMe } from "../../hooks/useAccount";

/** True inside the account frame: Container renders flat so pages sit in the content column. */
export const AccountFrameContext = createContext(false);
export const useInAccountFrame = () => useContext(AccountFrameContext);

const LINKS = [
  { to: "/account", label: "Tổng quan", icon: LayoutGrid, end: true },
  { to: "/account/orders", label: "Đơn hàng", icon: Package },
  { to: "/account/rentals", label: "Game đang thuê", icon: KeyRound },
  { to: "/wishlist", label: "Yêu thích", icon: Heart },
  { to: "/rewards", label: "Thành tựu", icon: Trophy },
  { to: "/account/points", label: "Điểm thưởng", icon: Coins },
  { to: "/account/coupons", label: "Mã giảm giá", icon: TicketPercent },
];

/**
 * Frame shared by every account screen: a sidebar on desktop, a scrolling tab strip on phones.
 * Guests (public /wishlist and /rewards) get the page alone.
 */
export default function AccountLayout() {
  const { data: me, isLoading } = useMe();
  const logout = useLogout();
  const navigate = useNavigate();

  if (isLoading || !me) return <Outlet />;

  const initials = me.displayName.trim().split(/\s+/).map((x) => x[0]).slice(0, 2).join("").toUpperCase() || "M";
  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 h-11 px-3 text-sm font-medium transition-colors ${
      isActive ? "bg-accent/10 text-accent" : "text-text-secondary hover:text-text-primary hover:bg-white/5"
    }`;
  const tabCls = ({ isActive }: { isActive: boolean }) =>
    `shrink-0 inline-flex items-center gap-2 h-11 px-3 text-sm font-medium border-b-2 transition-colors ${
      isActive ? "border-accent text-accent" : "border-transparent text-text-secondary hover:text-text-primary"
    }`;

  return (
    <div className="max-w-[1200px] mx-auto px-4 pt-4 lg:pt-10 pb-20 lg:grid lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-10">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block">
        <div className="sticky top-20">
          <div className="flex items-center gap-3 pb-5 mb-3 border-b border-white/10">
            <span className="w-11 h-11 shrink-0 rounded-full bg-accent flex items-center justify-center font-display font-bold text-on-accent">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-text-primary truncate">{me.displayName}</p>
              <p className="text-sm text-text-muted truncate">{me.email}</p>
            </div>
          </div>
          <nav aria-label="Tài khoản" className="space-y-0.5">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={linkCls}>
                <l.icon className="w-4 h-4 shrink-0" />
                {l.label}
              </NavLink>
            ))}
          </nav>
          <button
            type="button"
            disabled={logout.isPending}
            onClick={() =>
              logout.mutate(undefined, {
                onSettled: () => {
                  toast.success("Đã đăng xuất");
                  navigate("/");
                },
              })
            }
            className="mt-3 pt-3 w-full border-t border-white/10 flex items-center gap-3 h-11 px-3 text-sm text-text-muted hover:text-negative transition-colors cursor-pointer disabled:opacity-50"
          >
            <LogOut className="w-4 h-4" />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Phone tab strip */}
      <nav aria-label="Tài khoản" className="lg:hidden -mx-4 px-4 mb-6 flex overflow-x-auto border-b border-white/10 [scrollbar-width:none]">
        {LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={tabCls}>
            <l.icon className="w-4 h-4" />
            {l.label}
          </NavLink>
        ))}
      </nav>

      <main className="min-w-0">
        <AccountFrameContext.Provider value={true}>
          <Outlet />
        </AccountFrameContext.Provider>
      </main>
    </div>
  );
}
