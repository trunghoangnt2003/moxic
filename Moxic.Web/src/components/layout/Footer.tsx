import { Link } from "react-router-dom";
import { Gamepad2 } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-bg-surface border-t border-border mt-16">
      <div className="max-w-[1200px] mx-auto px-4 py-10">
        {/* Top */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-3">
            <Gamepad2 className="w-6 h-6 text-accent" />
            <span className="text-accent font-display text-xl tracking-wide">
              MOXIC
            </span>
          </div>
          <div className="flex items-center gap-6 text-xs text-text-secondary">
            <Link to="/bang-gia-xbox" className="hover:text-text-primary transition-colors">
              Bảng giá Xbox
            </Link>
            <Link to="/hoi-dap" className="hover:text-text-primary transition-colors">
              Hỏi đáp
            </Link>
            <Link to="/leaderboard" className="hover:text-text-primary transition-colors">
              Bảng xếp hạng
            </Link>
            <Link to="/games" className="hover:text-text-primary transition-colors">
              Store
            </Link>
            <a href="#" className="hover:text-text-primary transition-colors">
              Điều khoản
            </a>
            <a href="#" className="hover:text-text-primary transition-colors">
              Bảo mật
            </a>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border/50" />

        {/* Bottom */}
        <div className="pt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <p className="text-text-muted text-xs">
            Moxic GameStore — Game Xbox chính hãng giá rẻ hơn 30% so với Store
          </p>
          <p className="text-text-muted text-xs">
            &copy; 2026 Moxic. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
