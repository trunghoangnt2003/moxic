import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, Menu, X } from "lucide-react";
import Container from "./Container";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-bg-surface border-b border-border">
      <Container>
        <div className="flex items-center justify-between h-14">
          {/* Left: Logo + Nav */}
          <div className="flex items-center gap-6">
            <Link to="/" className="text-accent font-display text-xl tracking-wide">
              MOXIC
            </Link>
            <div className="hidden md:flex items-center gap-6">
              <Link to="/games" className="text-text-secondary hover:text-text-primary transition-colors text-sm font-body">Store</Link>
              <a href="#" className="text-text-secondary hover:text-text-primary transition-colors text-sm">Hỗ trợ</a>
              <a href="#" className="text-text-secondary hover:text-text-primary transition-colors text-sm">Phân phối</a>
            </div>
          </div>

          {/* Right: Search + Auth */}
          <div className="flex items-center gap-4">
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                placeholder="Tìm kiếm game..."
                className="bg-bg-elevated border border-border rounded-md pl-10 pr-3 py-2 text-sm w-48 focus:outline-none focus:border-accent text-text-primary placeholder:text-text-placeholder"
              />
            </div>
            <button className="text-text-secondary hover:text-text-primary transition-colors text-sm hidden sm:block">Đăng nhập</button>
            <button className="bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-md text-sm font-semibold transition-colors hidden sm:block">
              Tải về
            </button>
            <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden text-text-secondary">
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden pb-4 space-y-2">
            <Link to="/games" className="block text-text-secondary py-2 text-sm">Store</Link>
            <a href="#" className="block text-text-secondary py-2 text-sm">Hỗ trợ</a>
            <a href="#" className="block text-text-secondary py-2 text-sm">Phân phối</a>
            <button className="w-full bg-accent hover:bg-accent-hover text-white py-2 rounded-md text-sm mt-2">Tải về</button>
          </div>
        )}
      </Container>
    </nav>
  );
}
