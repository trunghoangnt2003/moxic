import { useState } from "react";
import { ChevronDown, ChevronRight, ShieldCheck } from "lucide-react";

export default function PrivacyNotice() {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-bg-elevated/50 border border-border/50">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left cursor-pointer hover:bg-bg-elevated transition-colors"
      >
        <ShieldCheck className="w-4 h-4 text-accent flex-shrink-0" />
        <span className="text-xs text-text-secondary flex-1">
          Th\u00f4ng tin t\u00e0i kho\u1ea3n Xbox c\u1ee7a b\u1ea1n \u0111\u01b0\u1ee3c m\u00e3 h\u00f3a AES-256 v\u00e0 ch\u1ec9 d\u00f9ng \u0111\u1ec3 c\u00e0i game.
        </span>
        {open ? <ChevronDown className="w-3 h-3 text-text-muted" /> : <ChevronRight className="w-3 h-3 text-text-muted" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 text-xs text-text-muted space-y-2 leading-relaxed border-t border-border/30">
          <p>&bull; M\u1eadt kh\u1ea9u c\u1ee7a b\u1ea1n \u0111\u01b0\u1ee3c m\u00e3 h\u00f3a AES-256 ngay khi g\u1eedi v\u00e0 ch\u1ec9 nh\u00e2n vi\u00ean c\u00f3 quy\u1ec1n m\u1edbi x\u1eed l\u00fd \u0111\u01b0\u1ee3c.</p>
          <p>&bull; Sau khi c\u00e0i game xong, d\u1eef li\u1ec7u t\u00e0i kho\u1ea3n s\u1ebd \u0111\u01b0\u1ee3c x\u00f3a kh\u1ecfi h\u1ec7 th\u1ed1ng.</p>
          <p>&bull; B\u1ea1n n\u00ean \u0111\u1ed5i m\u1eadt kh\u1ea9u Xbox sau khi game \u0111\u01b0\u1ee3c c\u00e0i \u0111\u1eb7t \u0111\u1ec3 \u0111\u1ea3m b\u1ea3o an to\u00e0n.</p>
        </div>
      )}
    </div>
  );
}
