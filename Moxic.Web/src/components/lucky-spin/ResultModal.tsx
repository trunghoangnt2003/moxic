import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Check, Copy, X } from "lucide-react";
import PrizeCard, { RARITY_COLORS, RARITY_LABELS } from "./PrizeCard";
import { useContactSettings } from "../../hooks/useLuckySpin";
import { formatPoints, type CaseSummary, type OpenCaseResult } from "../../lib/luckySpinApi";

interface ResultModalProps {
  result: OpenCaseResult;
  caseInfo: CaseSummary;
  onClose: () => void;
  canOpenAgain: boolean;
}

export default function ResultModal({ result, caseInfo, onClose, canOpenAgain }: ResultModalProps) {
  const { data: contact } = useContactSettings();
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const prize = result.prize;
  const color = RARITY_COLORS[prize.rarity];
  const isLuck = prize.type === "Luck";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  // Entrance animation (WAAPI so it still runs briefly under reduced motion).
  useEffect(() => {
    dialogRef.current?.animate(
      [
        { opacity: 0, transform: "scale(0.92) translateY(12px)" },
        { opacity: 1, transform: "scale(1) translateY(0)" },
      ],
      { duration: 280, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
    );
  }, []);

  const copyReward = async () => {
    if (!result.rewardCode) return;
    try {
      await navigator.clipboard.writeText(result.rewardCode);
      setCopied(true);
      toast.success("Đã sao chép");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Không thể sao chép, vui lòng chép thủ công.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="spin-result-title">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

      <div
        ref={dialogRef}
        className="relative w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto rounded-sm border border-fuchsia-500/30 px-5 pb-6 pt-8 text-center sm:px-8"
        style={{
          background: "radial-gradient(ellipse at top, #3b1d6e 0%, #1a0d33 55%, #0d0718 100%)",
          boxShadow: `0 0 60px ${color}40`,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="absolute right-3 top-3 rounded-full p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <p className="text-[11px] font-semibold uppercase tracking-[0.25em]" style={{ color }}>
          {RARITY_LABELS[prize.rarity]}
        </p>
        <p className="mt-1 text-xs text-white/50">{caseInfo.name}</p>

        <div className="relative mx-auto mt-4 flex w-fit justify-center">
          <div
            className="pointer-events-none absolute -inset-8 rounded-full blur-2xl"
            style={{ background: `radial-gradient(circle, ${color}55 0%, transparent 70%)` }}
          />
          <PrizeCard prize={prize} size="large" highlighted />
        </div>

        {isLuck ? (
          <h2 id="spin-result-title" className="mt-6 font-display text-xl font-bold text-white">
            Chúc bạn may mắn lần sau!
          </h2>
        ) : (
          <>
            <h2 id="spin-result-title" className="mt-6 font-display text-xl font-bold text-white">
              Chúc mừng! Bạn đã trúng {prize.name}
            </h2>

            {result.rewardCode && (
              <div className="mt-4">
                <p className="mb-1.5 text-xs text-white/60">Mã thưởng của bạn</p>
                <div className="flex items-stretch overflow-hidden rounded-sm border border-white/15 bg-black/40">
                  <span className="flex-1 select-all px-3 py-2.5 font-mono text-lg font-bold tracking-[0.2em] text-amber-300">
                    {result.rewardCode}
                  </span>
                  <button
                    type="button"
                    onClick={copyReward}
                    className="inline-flex items-center gap-1 border-l border-white/15 px-3 text-xs font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    <span className="hidden sm:inline">{copied ? "Đã chép" : "Sao chép"}</span>
                  </button>
                </div>
              </div>
            )}

            <p className="mt-4 text-sm text-white/70">
              Lưu lại mã thưởng và liên hệ Moxic qua Zalo hoặc Messenger để nhận quà.
            </p>

            {(contact?.messengerUrl || contact?.zaloUrl) && (
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                {contact?.messengerUrl && (
                  <a
                    href={contact.messengerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 rounded-sm px-4 py-2.5 text-sm font-semibold text-white transition-[filter] hover:brightness-110"
                    style={{ background: "linear-gradient(135deg, #0099FF 0%, #A033FF 60%, #FF5280 100%)" }}
                  >
                    Nhắn Messenger
                  </a>
                )}
                {contact?.zaloUrl && (
                  <a
                    href={contact.zaloUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 rounded-sm bg-[#0068FF] px-4 py-2.5 text-sm font-semibold text-white transition-[filter] hover:brightness-110"
                  >
                    Nhắn Zalo
                  </a>
                )}
              </div>
            )}
          </>
        )}

        {caseInfo.openMethod === "Code" && result.remainingUses != null && result.remainingUses > 0 && (
          <p className="mt-5 text-xs text-fuchsia-300">Mã của bạn còn {result.remainingUses} lượt quay</p>
        )}
        {caseInfo.openMethod === "Points" && result.pointsBalance != null && (
          <p className="mt-5 text-xs text-amber-300">
            Đã dùng {formatPoints(result.pointsSpent)} điểm · Số dư còn {formatPoints(result.pointsBalance)} điểm
          </p>
        )}
        {caseInfo.openMethod === "FreeInterval" && result.nextFreeOpenAt && (
          <p className="mt-5 text-xs text-emerald-300">
            Lượt miễn phí tiếp theo: {new Date(result.nextFreeOpenAt).toLocaleString("vi-VN")}
          </p>
        )}

        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-sm border border-white/15 bg-white/5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
        >
          {canOpenAgain ? "Mở tiếp" : "Đóng"}
        </button>
      </div>
    </div>
  );
}
