import { useState } from "react";
import { ChevronDown, ShieldCheck } from "lucide-react";

import { t } from "../../lib/i18n";
export default function PrivacyNotice() {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-l-2 border-positive/60 bg-positive/5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-start gap-3 px-4 py-3 text-left cursor-pointer"
      >
        <ShieldCheck className="w-5 h-5 text-positive shrink-0" />
        <span className="text-sm text-text-secondary flex-1">{t("Mật khẩu được mã hóa AES-256 và chỉ dùng để cài game.")}</span>
        <ChevronDown className={`w-4 h-4 mt-0.5 text-text-muted shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className="px-4 pb-4 pl-12 text-sm text-text-muted space-y-1.5 leading-relaxed list-disc">
          <li>{t("Mật khẩu được mã hóa ngay khi gửi, chỉ nhân viên có quyền mới xử lý được.")}</li>
          <li>{t("Cài game xong, dữ liệu tài khoản được xóa khỏi hệ thống.")}</li>
          <li>{t("Bạn nên đổi mật khẩu Xbox sau khi game được cài để an toàn hơn.")}</li>
        </ul>
      )}
    </div>
  );
}
