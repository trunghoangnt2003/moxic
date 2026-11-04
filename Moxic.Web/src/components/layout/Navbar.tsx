import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Menu,
  X,
  Globe,
  Download,
  ChevronDown,
  ShoppingCart,
  User,
  Package,
  LogOut,
  Coins,
  TicketPercent,
  Gift,
  Heart,
  KeyRound,
} from "lucide-react";
import { useCartStore } from "../../lib/cartStore";
import { useLogout, useMe } from "../../hooks/useAccount";
import HeaderSearch from "./HeaderSearch";
import { useWishlistIds } from "../../hooks/useWishlist";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const cartCount = useCartStore((s) => s.items.length);
  const wishlistCount = useWishlistIds().ids.length;
  const { data: me, isLoading: meLoading } = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  const location = useLocation();
  const accountRef = useRef<HTMLDivElement>(null);

  // Close menus on route change (state adjustment during render, no effect needed).
  const [lastPath, setLastPath] = useState(location.pathname);
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    setAccountOpen(false);
    setMenuOpen(false);
  }

  // Close the account dropdown on outside click / Escape.
  useEffect(() => {
    if (!accountOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAccountOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [accountOpen]);

  const handleLogout = () => {
    setAccountOpen(false);
    setMenuOpen(false);
    logout.mutate(undefined, {
      onSettled: () => {
        toast.success("Đã đăng xuất");
        navigate("/");
      },
    });
  };

  return (
    <nav className="sticky top-0 z-50 bg-bg-surface/95 backdrop-blur-sm border-b border-border">
      <div className="max-w-[1200px] mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Left: Logo + Primary Nav */}
          <div className="flex items-center gap-8">
            <Link
              to="/"
              className="text-accent font-display text-xl tracking-wide flex-shrink-0"
            >
              MOXIC
            </Link>
            <div className="hidden md:flex items-center gap-6">
              <NavLink
                to="/games"
                className={({ isActive }) =>
                  `text-sm font-semibold transition-colors ${isActive ? "text-text-primary" : "text-text-secondary hover:text-text-primary"}`
                }
              >
                Store
              </NavLink>
              <NavLink
                to="/rent"
                className={({ isActive }) =>
                  `inline-flex items-center gap-1.5 text-sm font-semibold transition-colors ${isActive ? "text-emerald-300" : "text-emerald-200/90 hover:text-emerald-300"}`
                }
              >
                <KeyRound className="w-4 h-4" />
                Thuê game
              </NavLink>
              <NavLink
                to="/lucky-spin"
                className={({ isActive }) =>
                  `group relative inline-flex items-center gap-1.5 text-sm font-semibold transition-colors ${
                    isActive ? "text-amber-300" : "text-amber-200/90 hover:text-amber-300"
                  }`
                }
              >
                <Gift className="w-4 h-4 transition-transform group-hover:-rotate-12 group-hover:scale-110" />
                Mở hòm
                <span className="absolute -top-1.5 -right-3 flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-fuchsia-400 opacity-75 motion-reduce:hidden" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-fuchsia-500" />
                </span>
              </NavLink>
              <a
                href="#"
                className="text-text-secondary hover:text-text-primary transition-colors text-sm"
              >
                Hỗ trợ
              </a>
              <a
                href="#"
                className="text-text-secondary hover:text-text-primary transition-colors text-sm"
              >
                Phân phối
              </a>
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="hidden sm:block">
              <HeaderSearch variant="desktop" />
            </div>

            {/* Wishlist */}
            <Link
              to="/wishlist"
              aria-label="Yêu thích"
              title="Yêu thích"
              className="relative text-text-secondary hover:text-rose-400 transition-colors cursor-pointer"
            >
              <Heart className={`w-5 h-5 ${wishlistCount > 0 ? "text-rose-400" : ""}`} />
              {wishlistCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center">
                  {wishlistCount > 9 ? "9+" : wishlistCount}
                </span>
              )}
            </Link>

            {/* Cart */}
            <Link
              to="/cart"
              className="relative text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            >
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-accent text-white text-[10px] font-bold w-4 h-4  flex items-center justify-center">
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              )}
            </Link>

            {/* Language */}
            <button className="hidden sm:flex items-center gap-1 text-text-secondary hover:text-text-primary transition-colors text-sm cursor-pointer">
              <Globe className="w-4 h-4" />
              <span className="text-xs">VI</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {/* Auth */}
            {meLoading ? (
              <span className="hidden sm:block w-20 h-5" aria-hidden="true" />
            ) : me ? (
              <div ref={accountRef} className="relative hidden sm:block">
                <button
                  type="button"
                  onClick={() => setAccountOpen((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={accountOpen}
                  className="flex items-center gap-1.5 text-text-secondary hover:text-text-primary transition-colors text-sm cursor-pointer"
                >
                  <User className="w-4 h-4" />
                  <span className="max-w-[120px] truncate">{me.displayName}</span>
                  <span className="hidden lg:inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[11px] font-semibold text-amber-300" title="Điểm thưởng">
                    <Coins className="w-3 h-3" />
                    {me.points.toLocaleString("vi-VN")}
                  </span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${accountOpen ? "rotate-180" : ""}`} />
                </button>
                {accountOpen && (
                  <div role="menu" className="absolute right-0 mt-2 w-60 bg-bg-surface border border-border shadow-xl z-50">
                    <div className="px-4 py-3 border-b border-border">
                      <p className="text-sm font-semibold text-text-primary truncate">{me.displayName}</p>
                      <p className="text-xs text-text-muted truncate">{me.email}</p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-amber-300">
                        <Coins className="w-3 h-3" /> Điểm thưởng: <span className="font-semibold">{me.points.toLocaleString("vi-VN")}</span>
                      </p>
                    </div>
                    <Link
                      to="/account/orders"
                      role="menuitem"
                      onClick={() => setAccountOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-surface-hover hover:text-text-primary transition-colors"
                    >
                      <Package className="w-4 h-4" />
                      Lịch sử mua hàng
                    </Link>
                    <Link
                      to="/account/rentals"
                      role="menuitem"
                      onClick={() => setAccountOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-surface-hover hover:text-text-primary transition-colors"
                    >
                      <KeyRound className="w-4 h-4" />
                      Game đang thuê
                    </Link>
                    <Link
                      to="/account/points"
                      role="menuitem"
                      onClick={() => setAccountOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-surface-hover hover:text-text-primary transition-colors"
                    >
                      <Coins className="w-4 h-4" />
                      Điểm thưởng
                    </Link>
                    <Link
                      to="/account/coupons"
                      role="menuitem"
                      onClick={() => setAccountOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-surface-hover hover:text-text-primary transition-colors"
                    >
                      <TicketPercent className="w-4 h-4" />
                      Mã giảm giá của tôi
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      disabled={logout.isPending}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-surface-hover hover:text-text-primary transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <LogOut className="w-4 h-4" />
                      Đăng xuất
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                className="text-text-secondary hover:text-text-primary transition-colors text-sm cursor-pointer hidden sm:block"
              >
                Đăng nhập
              </Link>
            )}

            {/* Download */}
            <button className="bg-accent hover:bg-accent-hover text-white px-5 py-2  text-sm font-bold transition-colors flex items-center gap-2 cursor-pointer hidden sm:flex">
              <Download className="w-4 h-4" />
              Tải về
            </button>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden text-text-secondary cursor-pointer"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-border bg-bg-surface">
          <div className="max-w-[1200px] mx-auto px-4 py-4 space-y-3">
            <HeaderSearch variant="mobile" onNavigate={() => setMenuOpen(false)} />
            <Link
              to="/games"
              className="block text-text-secondary hover:text-text-primary py-2 text-sm font-semibold"
              onClick={() => setMenuOpen(false)}
            >
              Store
            </Link>
            <Link
              to="/rent"
              className="flex items-center gap-2 text-emerald-300 py-2 text-sm font-semibold"
              onClick={() => setMenuOpen(false)}
            >
              <KeyRound className="w-4 h-4" /> Thuê game
            </Link>
            <Link
              to="/lucky-spin"
              className="flex items-center gap-2 text-amber-300 py-2 text-sm font-semibold"
              onClick={() => setMenuOpen(false)}
            >
              <Gift className="w-4 h-4" /> Mở hòm may mắn
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40">HOT</span>
            </Link>
            <a href="#" className="block text-text-secondary hover:text-text-primary py-2 text-sm">
              Hỗ trợ
            </a>
            <a href="#" className="block text-text-secondary hover:text-text-primary py-2 text-sm">
              Phân phối
            </a>
            <div className="pt-2 border-t border-border space-y-1">
              {me ? (
                <>
                  <p className="py-1 text-sm text-text-primary truncate">
                    <User className="inline w-4 h-4 mr-1.5 -mt-0.5" />
                    {me.displayName} <span className="text-text-muted text-xs">({me.email})</span>
                  </p>
                  <p className="flex items-center gap-1.5 py-1 text-sm text-amber-300">
                    <Coins className="w-4 h-4" /> Điểm thưởng: <span className="font-semibold">{me.points.toLocaleString("vi-VN")}</span>
                  </p>
                  <Link
                    to="/account/orders"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 py-2 text-sm text-text-secondary hover:text-text-primary"
                  >
                    <Package className="w-4 h-4" />
                    Lịch sử mua hàng
                  </Link>
                  <Link
                    to="/account/rentals"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 py-2 text-sm text-text-secondary hover:text-text-primary"
                  >
                    <KeyRound className="w-4 h-4" />
                    Game đang thuê
                  </Link>
                  <Link
                    to="/account/points"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 py-2 text-sm text-text-secondary hover:text-text-primary"
                  >
                    <Coins className="w-4 h-4" />
                    Điểm thưởng
                  </Link>
                  <Link
                    to="/account/coupons"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 py-2 text-sm text-text-secondary hover:text-text-primary"
                  >
                    <TicketPercent className="w-4 h-4" />
                    Mã giảm giá của tôi
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={logout.isPending}
                    className="w-full flex items-center gap-2 py-2 text-sm text-text-secondary hover:text-text-primary cursor-pointer disabled:opacity-50"
                  >
                    <LogOut className="w-4 h-4" />
                    Đăng xuất
                  </button>
                </>
              ) : !meLoading ? (
                <>
                  <Link
                    to="/login"
                    onClick={() => setMenuOpen(false)}
                    className="block py-2 text-sm text-text-secondary hover:text-text-primary font-semibold"
                  >
                    Đăng nhập
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMenuOpen(false)}
                    className="block py-2 text-sm text-text-secondary hover:text-text-primary"
                  >
                    Đăng ký
                  </Link>
                </>
              ) : null}
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <Globe className="w-4 h-4 text-text-secondary" />
              <span className="text-text-secondary text-sm">Tiếng Việt</span>
            </div>
            <button className="w-full bg-accent hover:bg-accent-hover text-white py-3  text-sm font-bold flex items-center justify-center gap-2 cursor-pointer">
              <Download className="w-4 h-4" />
              Tải về
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
