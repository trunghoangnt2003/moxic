import { Check } from "lucide-react";

import { t } from "../../lib/i18n";
const STEPS = [t("Giỏ hàng"), t("Thông tin"), t("Thanh toán"), t("Hoàn tất")];

/** Cart Info Payment Done progress header shared by the purchase flow pages. */
export default function CheckoutSteps({ current }: { current: 0 | 1 | 2 | 3 }) {
  return (
    <ol className="flex items-center gap-2 sm:gap-3 mb-6 sm:mb-8 text-xs sm:text-sm" aria-label={t("Các bước mua hàng")}>
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 last:flex-none">
            <span className="flex items-center gap-2 min-w-0">
              <span
                className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  done ? "bg-positive text-on-accent" : active ? "bg-accent text-on-accent ring-4 ring-accent/20" : "bg-white/5 text-text-muted border border-white/10"
                }`}
              >
                {done ? <Check className="w-4 h-4" strokeWidth={3} /> : i + 1}
              </span>
              <span className={`truncate ${active ? "text-text-primary font-semibold" : done ? "text-text-secondary" : "text-text-muted"} ${active ? "" : "hidden sm:inline"}`}>
                {label}
              </span>
            </span>
            {i < STEPS.length - 1 && <span className={`flex-1 h-px min-w-3 ${done ? "bg-positive/60" : "bg-white/10"}`} />}
          </li>
        );
      })}
    </ol>
  );
}
