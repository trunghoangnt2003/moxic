import { BrowserRouter, Routes, Route, Navigate, NavLink } from "react-router-dom";
import { lazy, Suspense, useState, useEffect } from "react";
import {
  Gamepad2,
  CreditCard,
  LogOut,
  User,
  ChevronLeft,
  ChevronRight,
  Package,
  Tags,
  BookMarked,
  Menu,
  X,
  Gift,
  MessageCircle,
  Users,
  Music,
  Megaphone,
  LayoutDashboard,
  KeyRound,
  ShieldAlert,
  TicketPercent,
  ShoppingBag,
  MessagesSquare,
  CircleHelp,
  Languages,
} from "lucide-react";
import GameList from "./pages/GameList";
import GameForm from "./pages/GameForm";
import PaymentConfig from "./pages/PaymentConfig";
import GenreList from "./pages/GenreList";
import TagList from "./pages/TagList";
import GameReviews from "./pages/GameReviews";
import Login from "./pages/Login";
import "./App.css";

const OrderList = lazy(() => import("./pages/OrderList"));
const LuckySpin = lazy(() => import("./pages/LuckySpin"));
const ContactSettings = lazy(() => import("./pages/ContactSettings"));
const Customers = lazy(() => import("./pages/Customers"));
const SpinMusic = lazy(() => import("./pages/SpinMusic"));
const Coupons = lazy(() => import("./pages/Coupons"));
const Announcements = lazy(() => import("./pages/Announcements"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Rentals = lazy(() => import("./pages/Rentals"));
const Moderation = lazy(() => import("./pages/Moderation"));
const RewardShop = lazy(() => import("./pages/RewardShop"));
const Chat = lazy(() => import("./pages/Chat"));
const Faq = lazy(() => import("./pages/Faq"));
const Translations = lazy(() => import("./pages/Translations"));

const navItems = [
  { to: "/dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { to: "/games", label: "Games", icon: Gamepad2 },
  { to: "/genres", label: "Genres", icon: BookMarked },
  { to: "/tags", label: "Tags", icon: Tags },
  { to: "/orders", label: "Orders", icon: Package },
  { to: "/chat", label: "Chat", icon: MessagesSquare },
  { to: "/rentals", label: "Thuê game", icon: KeyRound },
  { to: "/payment-config", label: "Payment", icon: CreditCard },
  { to: "/lucky-spin", label: "Lucky Spin", icon: Gift },
  { to: "/coupons", label: "Mã giảm giá", icon: TicketPercent },
  { to: "/reward-shop", label: "Đổi điểm", icon: ShoppingBag },
  { to: "/customers", label: "Khách hàng", icon: Users },
  { to: "/spin-music", label: "Kho nhạc", icon: Music },
  { to: "/announcements", label: "Thông báo", icon: Megaphone },
  { to: "/moderation", label: "Kiểm duyệt", icon: ShieldAlert },
  { to: "/contact-settings", label: "Contact", icon: MessageCircle },
  { to: "/faq", label: "Hỏi đáp (SEO)", icon: CircleHelp },
  { to: "/translations", label: "Bản dịch tiếng Anh", icon: Languages },
];

function App() {
  const [user, setUser] = useState<string | null>(
    () => localStorage.getItem("admin_user")
  );
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogin = (email: string) => {
    localStorage.setItem("admin_user", email);
    setUser(email);
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_user");
    setUser(null);
  };

  // Close mobile menu on navigation
  useEffect(() => {
    const unlisten = () => setMobileMenuOpen(false);
    window.addEventListener("popstate", unlisten);
    return () => window.removeEventListener("popstate", unlisten);
  }, []);

  if (!user) return <Login onLogin={handleLogin} />;

  return (
    <BrowserRouter>
      <div className="min-h-screen min-w-0 bg-steam-bg text-steam-text flex font-sans relative">
        {/* Sidebar — Desktop */}
        <aside
          className={`hidden md:flex flex-col ${
            collapsed ? "w-14" : "w-52"
          } flex-shrink-0 bg-steam-surface border-r border-steam-border transition-all duration-200 select-none`}
        >
          <div className="h-13 flex items-center px-3 border-b border-steam-border">
            <div className="flex items-center gap-2 min-w-0">
              <Gamepad2 size={20} className="text-steam-blue flex-shrink-0" />
              {!collapsed && (
                <span className="font-mono font-bold text-sm tracking-wider text-white">
                  MOXIC
                </span>
              )}
            </div>
          </div>

          <nav className="flex-1 py-2 px-1.5 space-y-0.5">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-2.5 py-2 rounded text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? "bg-steam-blue/10 text-steam-blue"
                      : "text-steam-muted hover:text-steam-text hover:bg-steam-surface-2"
                  }`
                }
                onClick={() => setMobileMenuOpen(false)}
              >
                <item.icon size={16} className="flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
          </nav>

          <div className="px-1.5 py-2 border-t border-steam-border">
            <div className="flex items-center gap-2 px-2.5 py-1.5">
              <div className="w-6 h-6 rounded-full bg-steam-surface-3 flex items-center justify-center flex-shrink-0">
                <User size={12} className="text-steam-muted" />
              </div>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-steam-muted truncate leading-tight">{user}</p>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="p-1 rounded text-steam-muted hover:text-steam-accent hover:bg-steam-surface-3 transition-colors flex-shrink-0"
                title="Logout"
              >
                <LogOut size={12} />
              </button>
            </div>
          </div>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="h-7 flex items-center justify-center border-t border-steam-border text-steam-muted hover:text-steam-text hover:bg-steam-surface-2 transition-colors"
          >
            {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
          </button>
        </aside>

        {/* Mobile overlay backdrop */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Mobile sidebar drawer */}
        <aside
          className={`fixed top-0 left-0 z-50 h-full w-64 bg-steam-surface border-r border-steam-border flex flex-col transition-transform duration-200 ease-out md:hidden ${
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="h-13 flex items-center justify-between px-3 border-b border-steam-border">
            <div className="flex items-center gap-2">
              <Gamepad2 size={20} className="text-steam-blue flex-shrink-0" />
              <span className="font-mono font-bold text-sm tracking-wider text-white">
                MOXIC
              </span>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-1.5 rounded text-steam-muted hover:text-steam-text hover:bg-steam-surface-3 transition-colors"
              aria-label="Close menu"
            >
              <X size={16} />
            </button>
          </div>

          <nav className="flex-1 py-2 px-1.5 space-y-0.5">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-2.5 py-2 rounded text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? "bg-steam-blue/10 text-steam-blue"
                      : "text-steam-muted hover:text-steam-text hover:bg-steam-surface-2"
                  }`
                }
                onClick={() => setMobileMenuOpen(false)}
              >
                <item.icon size={16} className="flex-shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="px-1.5 py-2 border-t border-steam-border">
            <div className="flex items-center gap-2 px-2.5 py-1.5">
              <div className="w-6 h-6 rounded-full bg-steam-surface-3 flex items-center justify-center flex-shrink-0">
                <User size={12} className="text-steam-muted" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-steam-muted truncate leading-tight">{user}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-1 rounded text-steam-muted hover:text-steam-accent hover:bg-steam-surface-3 transition-colors flex-shrink-0"
                title="Logout"
              >
                <LogOut size={12} />
              </button>
            </div>
          </div>
        </aside>

        {/* Right side */}
        <div className="flex-1 flex flex-col min-w-0 pb-14 md:pb-0">
          {/* Top bar */}
          <header className="h-13 bg-steam-surface border-b border-steam-border flex items-center justify-between px-3 md:px-5 flex-shrink-0">
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-1.5 rounded text-steam-muted hover:text-steam-text hover:bg-steam-surface-3 transition-colors"
                aria-label="Open menu"
              >
                <Menu size={18} />
              </button>
              <span className="text-xs font-semibold text-white tracking-wide whitespace-nowrap">ADMIN PANEL</span>
              <span className="text-steam-border hidden sm:inline">|</span>
              <span className="text-xs text-steam-muted hidden sm:inline">GameStore Management</span>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 overflow-auto">
            <div className="p-3 md:p-5 max-w-7xl mx-auto">
              <Suspense fallback={<div className="text-steam-muted p-6 md:p-8 text-sm">Loading...</div>}>
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/rentals" element={<Rentals />} />
                  <Route path="/moderation" element={<Moderation />} />
                  <Route path="/games" element={<GameList />} />
                  <Route path="/games/new" element={<GameForm />} />
                  <Route path="/games/:id/edit" element={<GameForm />} />
                  <Route path="/games/:id/reviews" element={<GameReviews />} />
                  <Route path="/genres" element={<GenreList />} />
                  <Route path="/tags" element={<TagList />} />
                  <Route path="/orders" element={<OrderList />} />
                  <Route path="/payment-config" element={<PaymentConfig />} />
                  <Route path="/lucky-spin" element={<LuckySpin />} />
                  <Route path="/contact-settings" element={<ContactSettings />} />
                  <Route path="/customers" element={<Customers />} />
                  <Route path="/spin-music" element={<SpinMusic />} />
                  <Route path="/coupons" element={<Coupons />} />
                  <Route path="/reward-shop" element={<RewardShop />} />
                  <Route path="/chat" element={<Chat />} />
                  <Route path="/faq" element={<Faq />} />
                  <Route path="/translations" element={<Translations />} />
                  <Route path="/announcements" element={<Announcements />} />
                </Routes>
              </Suspense>
            </div>
          </main>
        </div>

        {/* Bottom Nav — Mobile */}
        <nav className="fixed bottom-0 left-0 right-0 z-30 bg-steam-surface border-t border-steam-border flex items-center h-14 md:hidden overflow-x-auto overscroll-x-contain">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 py-1 px-1 flex-none min-w-[64px] h-full transition-colors duration-150 ${
                  isActive
                    ? "text-steam-blue"
                    : "text-steam-muted hover:text-steam-text"
                }`
              }
              onClick={() => setMobileMenuOpen(false)}
            >
              <item.icon size={18} className="flex-shrink-0" />
              <span className="text-[10px] font-medium leading-tight truncate max-w-full">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </BrowserRouter>
  );
}

export default App;

