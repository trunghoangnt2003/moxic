import { useState } from "react";
import { ChevronDown, ChevronRight, ShieldCheck } from "lucide-react";

export default function PrivacyNotice() {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-bg-elevated/50 border border-white/5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left cursor-pointer hover:bg-bg-elevated transition-colors"
      >
        <ShieldCheck className="w-4 h-4 text-accent flex-shrink-0" />
        <span className="text-xs text-text-secondary flex-1">
          Thông tin tài khoản Xbox của bạn được mã hóa AES-256 và chỉ dùng để cài game.
        </span>
        {open ? <ChevronDown className="w-3 h-3 text-text-muted" /> : <ChevronRight className="w-3 h-3 text-text-muted" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 text-xs text-text-muted space-y-2 leading-relaxed border-t border-white/5">
          <p>&bull; Mật khẩu của bạn được mã hóa AES-256 ngay khi gửi và chỉ nhân viên có quyền mới xử lý được.</p>
          <p>&bull; Sau khi cài game xong, dữ liệu tài khoản sẽ được xóa khỏi hệ thống.</p>
          <p>&bull; Bạn nên đổi mật khẩu Xbox sau khi game được cài đặt để đảm bảo an toàn.</p>
        </div>
      )}
    </div>
  );
}
