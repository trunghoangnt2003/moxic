import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Archive, Gift, KeyRound, History, AlertCircle, Loader2 } from "lucide-react";
import LuckySpinCases from "./LuckySpinCases";
import LuckySpinPrizes from "./LuckySpinPrizes";
import LuckySpinCodes from "./LuckySpinCodes";
import LuckySpinHistory from "./LuckySpinHistory";
import { describeOpenMethod, fetchAdminCases } from "../lib/luckySpinAdmin";
import type { AdminCase } from "../lib/luckySpinAdmin";

const tabs = [
  { key: "cases", label: "Hòm", icon: Archive },
  { key: "prizes", label: "Giải thưởng", icon: Gift },
  { key: "codes", label: "Mã quay", icon: KeyRound },
  { key: "history", label: "Lịch sử quay", icon: History },
] as const;

type TabKey = (typeof tabs)[number]["key"];

function isTabKey(value: string | null): value is TabKey {
  return tabs.some((t) => t.key === value);
}

function ValidityChip({ c }: { c: AdminCase }) {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] font-semibold border whitespace-nowrap ${
        c.isPoolValid
          ? "bg-steam-green/10 text-steam-green border-steam-green/30"
          : "bg-steam-gold/10 text-steam-gold border-steam-gold/30"
      }`}
    >
      {c.isPoolValid ? "100%" : `${c.activeTotalPercent.toFixed(2)}%`}
    </span>
  );
}

export default function LuckySpin() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const tab: TabKey = isTabKey(raw) ? raw : "cases";

  const [cases, setCases] = useState<AdminCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reloadCases = useCallback(async () => {
    try {
      setCases(await fetchAdminCases());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được danh sách hòm");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadCases();
  }, [reloadCases]);

  const requestedCase = params.get("case");
  const selectedCase = cases.find((c) => c.id === requestedCase) ?? cases[0] ?? null;

  const update = (mutate: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(params);
    mutate(next);
    setParams(next, { replace: true });
  };

  const selectTab = (key: TabKey) =>
    update((next) => {
      if (key === "cases") next.delete("tab");
      else next.set("tab", key);
    });

  const selectCase = (id: string) => update((next) => next.set("case", id));

  const managePrizes = (id: string) =>
    update((next) => {
      next.set("case", id);
      next.set("tab", "prizes");
    });

  const needsCase = tab === "prizes" || tab === "codes";

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="min-w-0">
        <h1 className="text-lg font-bold text-white font-mono tracking-tight">Lucky Spin</h1>
        <p className="text-xs text-steam-muted mt-0.5">
          Các hòm, giải thưởng &amp; tỉ lệ theo từng hòm, mã quay và lịch sử mở hòm
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

      {error && (
        <div className="flex items-center gap-1.5 px-3 py-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          <AlertCircle size={12} /> {error}
        </div>
      )}

      {loading ? (
        <div className="py-10 flex justify-center text-steam-muted">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : (
        <>
          {needsCase && selectedCase && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <label htmlFor="lucky-spin-case" className="text-xs text-steam-muted whitespace-nowrap">
                Hòm đang quản lý
              </label>
              <select
                id="lucky-spin-case"
                value={selectedCase.id}
                onChange={(e) => selectCase(e.target.value)}
                className="steam-input sm:w-80"
              >
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {describeOpenMethod(c)}
                    {c.isActive ? "" : " (đang tắt)"}
                  </option>
                ))}
              </select>
              <ValidityChip c={selectedCase} />
            </div>
          )}

          {needsCase && !selectedCase && (
            <div className="py-10 text-center text-steam-muted bg-steam-surface border border-steam-border rounded-sm">
              <Archive size={28} className="mx-auto mb-2 text-steam-border" />
              <p className="text-sm">Chưa có hòm nào.</p>
              <button
                type="button"
                onClick={() => selectTab("cases")}
                className="mt-3 steam-btn bg-steam-blue text-black hover:bg-steam-blue-hover text-xs px-4 mx-auto"
              >
                Tạo hòm đầu tiên
              </button>
            </div>
          )}

          {tab === "cases" && (
            <LuckySpinCases cases={cases} reload={reloadCases} onManagePrizes={managePrizes} />
          )}
          {tab === "prizes" && selectedCase && (
            <LuckySpinPrizes key={selectedCase.id} caseId={selectedCase.id} onChanged={reloadCases} />
          )}
          {tab === "codes" && selectedCase && (
            <LuckySpinCodes key={selectedCase.id} caseId={selectedCase.id} openMethod={selectedCase.openMethod} />
          )}
          {tab === "history" && <LuckySpinHistory cases={cases} />}
        </>
      )}
    </div>
  );
}
