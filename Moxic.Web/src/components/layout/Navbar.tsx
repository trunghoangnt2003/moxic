import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Menu,
  X,
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
  Crown,
} from "lucide-react";
import { useCartStore } from "../../lib/cartStore";
import NavExplore from "./NavExplore";
import LanguageSwitcher, { LanguageSegmented } from "./LanguageSwitcher";
import { ThemeMenuButton, ThemeSegmented } from "./ThemeToggle";
import { Puzzle as PuzzleIcon, Trophy as TrophyIcon } from "lucide-react";
import { useLogout, useMe } from "../../hooks/useAccount";
import HeaderSearch from "./HeaderSearch";
import NotificationBell from "./NotificationBell";
import { useWishlistIds } from "../../hooks/useWishlist";

import { t, locale } from "../../lib/i18n";
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

  // While the phone menu is open the page behind it does not scroll; the menu scrolls on its own.
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const handleLogout = () => {
    setAccountOpen(false);
    setMenuOpen(false);
    logout.mutate(undefined, {
      onSettled: () => {
        toast.success(t("Đã đăng xuất"));
        navigate("/");
      },
    });
  };

  return (
    <nav className="sticky top-0 z-50 bg-bg-surface/95 backdrop-blur-sm border-b border-border pt-[var(--sat)]">
      <div className="max-w-[1200px] mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Left: Logo + Primary Nav */}
          <div className="flex items-center gap-6 lg:gap-8 min-w-0">
            <Link to="/" className="text-accent font-display text-xl shrink-0">
              MOXIC
            </Link>
            <div className="hidden md:flex items-center gap-5 lg:gap-6">
              <NavLink
                to="/games"
                className={({ isActive }) =>
                  `whitespace-nowrap text-sm font-semibold transition-colors ${isActive ? "text-text-primary" : "text-text-secondary hover:text-text-primary"}`
                }
              >
                Store
              </NavLink>
              <NavLink
                to="/rent"
                className={({ isActive }) =>
                  `inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold transition-colors ${isActive ? "text-positive" : "text-positive/90 hover:text-positive"}`
                }
              >
                <KeyRound className="w-4 h-4" />
                {t("Thuê game")}
              </NavLink>
              <NavLink
                to="/lucky-spin"
                className={({ isActive }) =>
                  `group relative inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold transition-colors ${
                    isActive ? "text-caution" : "text-caution/90 hover:text-caution"
                  }`
                }
              >
                <Gift className="w-4 h-4 transition-transform group-hover:-rotate-12 group-hover:scale-110" />
                {t("Mở hòm")}
                <span className="absolute -top-1.5 -right-3 flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-highlight opacity-75 motion-reduce:hidden" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-highlight" />
                </span>
              </NavLink>
              <NavExplore />
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="hidden sm:block">
              <HeaderSearch variant="desktop" />
            </div>

            {me && <NotificationBell />}

            {/* Wishlist */}
            <Link
              to="/wishlist"
              aria-label={t("Yêu thích")}
              title={t("Yêu thích")}
              className="relative text-text-secondary hover:text-negative transition-colors cursor-pointer"
            >
              <Heart className={`w-5 h-5 ${wishlistCount > 0 ? "text-negative" : ""}`} />
              {wishlistCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-negative text-on-solid text-[10px] font-bold w-4 h-4 flex items-center justify-center">
                  {wishlistCount > 9 ? "9+" : wishlistCount}
                </span>
              )}
            </Link>

            {/* Cart */}
            <Link
              id="nav-cart-button"
              to="/cart"
              aria-label={t("Giỏ hàng")}
              className="relative text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            >
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-accent text-on-accent text-[10px] font-bold w-4 h-4  flex items-center justify-center">
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              )}
            </Link>

            {/* Light / dark */}
            <div className="hidden sm:block">
              <ThemeMenuButton />
            </div>

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
                  <span className="hidden lg:inline-flex items-center gap-1 rounded-full border border-caution/30 bg-caution/10 px-1.5 py-0.5 text-[11px] font-semibold text-caution" title={t("Điểm thưởng")}>
                    <Coins className="w-3 h-3" />
                    {me.points.toLocaleString(locale)}
                  </span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${accountOpen ? "rotate-180" : ""}`} />
                </button>
                {accountOpen && (
                  <div role="menu" className="absolute right-0 mt-2 w-60 bg-bg-surface border border-border shadow-xl z-50">
                    <div className="px-4 py-3 border-b border-border">
                      <p className="text-sm font-semibold text-text-primary truncate">{me.displayName}</p>
                      <p className="text-xs text-text-muted truncate">{me.email}</p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-caution">
                        <Coins className="w-3 h-3" /> {t("Điểm thưởng:")} <span className="font-semibold">{me.points.toLocaleString(locale)}</span>
                      </p>
                    </div>
                    <Link
                      to="/account"
                      role="menuitem"
                      onClick={() => setAccountOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-surface-hover hover:text-text-primary transition-colors"
                    >
                      <User className="w-4 h-4" />
                      {t("Tài khoản & thư viện game")}
                    </Link>
                    <Link
                      to="/account/orders"
                      role="menuitem"
                      onClick={() => setAccountOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-surface-hover hover:text-text-primary transition-colors"
                    >
                      <Package className="w-4 h-4" />
                      {t("Lịch sử mua hàng")}
                    </Link>
                    <Link
                      to="/account/rentals"
                      role="menuitem"
                      onClick={() => setAccountOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-surface-hover hover:text-text-primary transition-colors"
                    >
                      <KeyRound className="w-4 h-4" />
                      {t("Game đang thuê")}
                    </Link>
                    <Link
                      to="/rewards"
                      role="menuitem"
                      onClick={() => setAccountOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-caution hover:bg-bg-surface-hover hover:text-caution transition-colors"
                    >
                      <Crown className="w-4 h-4" />
                      {t("Thành viên & điểm danh")}
                    </Link>
                    <Link
                      to="/account/points"
                      role="menuitem"
                      onClick={() => setAccountOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-surface-hover hover:text-text-primary transition-colors"
                    >
                      <Coins className="w-4 h-4" />
                      {t("Điểm thưởng")}
                    </Link>
                    <Link
                      to="/account/coupons"
                      role="menuitem"
                      onClick={() => setAccountOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-surface-hover hover:text-text-primary transition-colors"
                    >
                      <TicketPercent className="w-4 h-4" />
                      {t("Mã giảm giá của tôi")}
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      disabled={logout.isPending}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-surface-hover hover:text-text-primary transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <LogOut className="w-4 h-4" />
                      {t("Đăng xuất")}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                className="text-text-secondary hover:text-text-primary transition-colors text-sm cursor-pointer hidden sm:block"
              >
                {t("Đăng nhập")}
              </Link>
            )}

            {/* Language / country */}
            <div className="hidden md:block">
              <LanguageSwitcher />
            </div>

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
        <div className="md:hidden border-t border-border bg-bg-surface max-h-[calc(100dvh-3.5rem-var(--sat))] overflow-y-auto overscroll-contain">
          <div className="max-w-[1200px] mx-auto px-4 pt-4 pb-[calc(1.5rem+var(--sab))] space-y-3">
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
              className="flex items-center gap-2 text-positive py-2 text-sm font-semibold"
              onClick={() => setMenuOpen(false)}
            >
              <KeyRound className="w-4 h-4" /> {t("Thuê game")}
            </Link>
            <Link
              to="/lucky-spin"
              className="flex items-center gap-2 text-caution py-2 text-sm font-semibold"
              onClick={() => setMenuOpen(false)}
            >
              <Gift className="w-4 h-4" /> {t("Mở hòm may mắn")}
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-highlight/20 text-highlight border border-highlight/40">HOT</span>
            </Link>
            <Link to="/release-calendar" className="block text-text-secondary hover:text-text-primary py-2 text-sm font-semibold" onClick={() => setMenuOpen(false)}>
              {t("Lịch phát hành")}
            </Link>
            <Link to="/leaderboard" className="flex items-center gap-2 text-text-secondary hover:text-text-primary py-2 text-sm font-semibold" onClick={() => setMenuOpen(false)}>
              <TrophyIcon className="w-4 h-4" aria-hidden="true" /> {t("Bảng xếp hạng")}
            </Link>
            <Link to="/doan-game" className="flex items-center gap-2 text-text-secondary hover:text-text-primary py-2 text-sm font-semibold" onClick={() => setMenuOpen(false)}>
              <PuzzleIcon className="w-4 h-4" aria-hidden="true" /> {t("Đoán game mỗi ngày")}
            </Link>
            <div className="pt-2 border-t border-border space-y-1">
              {me ? (
                <>
                  <p className="py-1 text-sm text-text-primary truncate">
                    <User className="inline w-4 h-4 mr-1.5 -mt-0.5" />
                    {me.displayName} <span className="text-text-muted text-xs">({me.email})</span>
                  </p>
                  <p className="flex items-center gap-1.5 py-1 text-sm text-caution">
                    <Coins className="w-4 h-4" /> {t("Điểm thưởng:")} <span className="font-semibold">{me.points.toLocaleString(locale)}</span>
                  </p>
                  <Link
                    to="/account"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 py-2 text-sm text-text-secondary hover:text-text-primary"
                  >
                    <User className="w-4 h-4" />
                    {t("Tài khoản & thư viện game")}
                  </Link>
                  <Link
                    to="/account/orders"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 py-2 text-sm text-text-secondary hover:text-text-primary"
                  >
                    <Package className="w-4 h-4" />
                    {t("Lịch sử mua hàng")}
                  </Link>
                  <Link
                    to="/account/rentals"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 py-2 text-sm text-text-secondary hover:text-text-primary"
                  >
                    <KeyRound className="w-4 h-4" />
                    {t("Game đang thuê")}
                  </Link>
                  <Link
                    to="/rewards"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 py-2 text-sm text-caution"
                  >
                    <Crown className="w-4 h-4" />
                    {t("Thành viên & điểm danh")}
                  </Link>
                  <Link
                    to="/account/points"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 py-2 text-sm text-text-secondary hover:text-text-primary"
                  >
                    <Coins className="w-4 h-4" />
                    {t("Điểm thưởng")}
                  </Link>
                  <Link
                    to="/account/coupons"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 py-2 text-sm text-text-secondary hover:text-text-primary"
                  >
                    <TicketPercent className="w-4 h-4" />
                    {t("Mã giảm giá của tôi")}
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={logout.isPending}
                    className="w-full flex items-center gap-2 py-2 text-sm text-text-secondary hover:text-text-primary cursor-pointer disabled:opacity-50"
                  >
                    <LogOut className="w-4 h-4" />
                    {t("Đăng xuất")}
                  </button>
                </>
              ) : !meLoading ? (
                <>
                  <Link
                    to="/login"
                    onClick={() => setMenuOpen(false)}
                    className="block py-2 text-sm text-text-secondary hover:text-text-primary font-semibold"
                  >
                    {t("Đăng nhập")}
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMenuOpen(false)}
                    className="block py-2 text-sm text-text-secondary hover:text-text-primary"
                  >
                    {t("Đăng ký")}
                  </Link>
                </>
              ) : null}
            </div>
            <div className="pt-3 border-t border-border">
              <ThemeSegmented />
            </div>
            <LanguageSegmented />
          </div>
        </div>
      )}
    </nav>
  );
}
