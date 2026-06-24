import { useState } from "react";
import { ChevronDown, ChevronRight, ShieldCheck } from "lucide-react";

export default function PrivacyNotice() {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-[#2d261e]/50 border border-[#3d352a]/50">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left cursor-pointer hover:bg-[#2d261e] transition-colors"
      >
        <ShieldCheck className="w-4 h-4 text-[#c9a96e] flex-shrink-0" />
        <span className="text-xs text-[#b5a898] flex-1">
          Thông tin tài khoản Xbox của bạn được mã hóa AES-256 và chỉ dùng để cài game.
        </span>
        {open ? <ChevronDown className="w-3 h-3 text-[#7a6f63]" /> : <ChevronRight className="w-3 h-3 text-[#7a6f63]" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 text-xs text-[#7a6f63] space-y-2 leading-relaxed border-t border-[#3d352a]/30">
          <p>&bull; Mật khẩu của bạn được mã hóa AES-256 ngay khi gửi và chỉ nhân viên có quyền mới xử lý được.</p>
          <p>&bull; Sau khi cài game xong, dữ liệu tài khoản sẽ được xóa khỏi hệ thống.</p>
          <p>&bull; Bạn nên đổi mật khẩu Xbox sau khi game được cài đặt để đảm bảo an toàn.</p>
        </div>
      )}
    </div>
  );
}
