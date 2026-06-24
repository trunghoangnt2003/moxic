import { BrowserRouter, Routes, Route, Navigate, NavLink } from "react-router-dom";
import { lazy, Suspense, useState } from "react";
import {
  Gamepad2,
  CreditCard,
  LogOut,
  User,
  ChevronLeft,
  ChevronRight,
  Package,
} from "lucide-react";
import GameList from "./pages/GameList";
import GameForm from "./pages/GameForm";
import PaymentConfig from "./pages/PaymentConfig";
import Login from "./pages/Login";
import "./App.css";

const OrderList = lazy(() => import("./pages/OrderList"));

const navItems = [
  { to: "/games", label: "Games", icon: Gamepad2 },
  { to: "/orders", label: "Orders", icon: Package },
  { to: "/payment-config", label: "Payment", icon: CreditCard },
];

function App() {
  const [user, setUser] = useState<string | null>(
    () => localStorage.getItem("admin_user")
  );
  const [collapsed, setCollapsed] = useState(false);

  const handleLogin = (email: string) => {
    localStorage.setItem("admin_user", email);
    setUser(email);
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_user");
    setUser(null);
  };

  if (!user) return <Login onLogin={handleLogin} />;

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-steam-bg text-steam-text flex font-sans">
        {/* Sidebar */}
        <aside
          className={`${
            collapsed ? "w-14" : "w-52"
          } flex-shrink-0 bg-steam-surface border-r border-steam-border flex flex-col transition-all duration-200 select-none`}
        >
          {/* Logo */}
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

          {/* Nav */}
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
              >
                <item.icon size={16} className="flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
          </nav>

          {/* User */}
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

          {/* Collapse */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="h-7 flex items-center justify-center border-t border-steam-border text-steam-muted hover:text-steam-text hover:bg-steam-surface-2 transition-colors"
          >
            {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
          </button>
        </aside>

        {/* Right side */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <header className="h-13 bg-steam-surface border-b border-steam-border flex items-center justify-between px-5 flex-shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-white tracking-wide">ADMIN PANEL</span>
              <span className="text-steam-border">|</span>
              <span className="text-xs text-steam-muted">GameStore Management</span>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 overflow-auto">
            <div className="p-5 max-w-7xl mx-auto">
              <Suspense fallback={<div className="text-steam-muted p-8">Loading...</div>}>
                <Routes>
                  <Route path="/" element={<Navigate to="/games" />} />
                  <Route path="/games" element={<GameList />} />
                  <Route path="/games/new" element={<GameForm />} />
                  <Route path="/games/:id/edit" element={<GameForm />} />
                  <Route path="/orders" element={<OrderList />} />
                  <Route path="/payment-config" element={<PaymentConfig />} />
                </Routes>
              </Suspense>
            </div>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
