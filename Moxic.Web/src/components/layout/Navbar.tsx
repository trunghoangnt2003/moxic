import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Menu,
  X,
  Globe,
  Download,
  ChevronDown,
  ShoppingCart,
} from "lucide-react";
import { useCartStore } from "../../lib/cartStore";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const cartCount = useCartStore((s) => s.items.length);

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
              <Link
                to="/games"
                className="text-text-secondary hover:text-text-primary transition-colors text-sm font-semibold"
              >
                Store
              </Link>
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
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                placeholder="Tìm kiếm game..."
                className="bg-bg-elevated border border-border  pl-10 pr-3 py-2 text-sm w-48 focus:outline-none focus:border-accent/50 text-text-primary placeholder:text-text-placeholder transition-colors"
              />
            </div>

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
            <button className="text-text-secondary hover:text-text-primary transition-colors text-sm cursor-pointer hidden sm:block">
              Đăng nhập
            </button>

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
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                placeholder="Tìm kiếm game..."
                className="w-full bg-bg-elevated border border-border  pl-10 pr-3 py-2 text-sm focus:outline-none focus:border-accent/50 text-text-primary placeholder:text-text-placeholder"
              />
            </div>
            <Link
              to="/games"
              className="block text-text-secondary hover:text-text-primary py-2 text-sm font-semibold"
              onClick={() => setMenuOpen(false)}
            >
              Store
            </Link>
            <a href="#" className="block text-text-secondary hover:text-text-primary py-2 text-sm">
              Hỗ trợ
            </a>
            <a href="#" className="block text-text-secondary hover:text-text-primary py-2 text-sm">
              Phân phối
            </a>
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
