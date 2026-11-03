import { useSearchParams } from "react-router-dom";
import { Gift, KeyRound, History } from "lucide-react";
import LuckySpinPrizes from "./LuckySpinPrizes";
import LuckySpinCodes from "./LuckySpinCodes";
import LuckySpinHistory from "./LuckySpinHistory";

const tabs = [
  { key: "prizes", label: "Giải thưởng", icon: Gift },
  { key: "codes", label: "Mã quay", icon: KeyRound },
  { key: "history", label: "Lịch sử quay", icon: History },
] as const;

type TabKey = (typeof tabs)[number]["key"];

function isTabKey(value: string | null): value is TabKey {
  return tabs.some((t) => t.key === value);
}

export default function LuckySpin() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const tab: TabKey = isTabKey(raw) ? raw : "prizes";

  const selectTab = (key: TabKey) => {
    const next = new URLSearchParams(params);
    if (key === "prizes") next.delete("tab");
    else next.set("tab", key);
    setParams(next, { replace: true });
  };

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="min-w-0">
        <h1 className="text-lg font-bold text-white font-mono tracking-tight">Lucky Spin</h1>
        <p className="text-xs text-steam-muted mt-0.5">
          Giải thưởng &amp; tỉ lệ, mã quay và lịch sử quay của vòng quay may mắn
        </p>
      </div>

      <div className="-mx-3 px-3 md:mx-0 md:px-0 overflow-x-auto">
        <div className="flex gap-1 border-b border-steam-border min-w-max">
          {tabs.map((t) => {
            const active = t.key === tab;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => selectTab(t.key)}
                className={`flex items-center gap-1.5 px-3 md:px-4 py-2 text-xs md:text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                  active
                    ? "border-steam-blue text-steam-blue"
                    : "border-transparent text-steam-muted hover:text-steam-text"
                }`}
              >
                <t.icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "prizes" && <LuckySpinPrizes />}
      {tab === "codes" && <LuckySpinCodes />}
      {tab === "history" && <LuckySpinHistory />}
    </div>
  );
}
