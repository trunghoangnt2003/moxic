import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { Check, Copy, Gift, Sparkles, X } from "lucide-react";
import Container from "../components/layout/Container";
import { MoxicLoader } from "../components/shared/MoxicLoader";
import CaseReel, { type CaseReelHandle } from "../components/lucky-spin/CaseReel";
import PrizeCard, { RARITY_COLORS, RARITY_LABELS } from "../components/lucky-spin/PrizeCard";
import { getSpinErrorMessage, useContactSettings, useLuckySpinPrizes, useSpin } from "../hooks/useLuckySpin";
import type { SpinResult } from "../lib/luckySpinApi";

const normalizeInput = (value: string) => value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32);

export default function LuckySpinPage() {
  const [params] = useSearchParams();
  const [code, setCode] = useState(() => normalizeInput(params.get("code") ?? ""));
  const [animating, setAnimating] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const reelRef = useRef<CaseReelHandle>(null);

  const { data, isLoading, isError } = useLuckySpinPrizes();
  const spin = useSpin();

  const prizes = data?.prizes ?? [];
  const available = !!data?.available;
  const busy = spin.isPending || animating;
  const closeResult = useCallback(() => setResult(null), []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !available) return;
    const value = code.trim();
    if (!value) {
      toast.error("Vui lòng nhập mã quay.");
      return;
    }

    setAnimating(true);
    try {
      const res = await spin.mutateAsync(value);
      await reelRef.current?.spin(res);
      setResult(res);
      if (res.remainingUses <= 0) setCode("");
    } catch (err) {
      toast.error(getSpinErrorMessage(err));
    } finally {
      setAnimating(false);
    }
  };

  return (
    <Container className="mt-8 mb-16">
      {/* Heading */}
      <div className="text-center mb-6 md:mb-8">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-fuchsia-300">
          <Sparkles className="h-3 w-3" /> Mở hòm
        </div>
        <h1 className="mt-3 font-display text-3xl md:text-4xl font-bold text-text-primary">Vòng Quay May Mắn</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-text-muted">
          Nhập mã quay do Moxic cung cấp để mở hòm — cơ hội nhận game Xbox miễn phí và mã giảm giá.
          Mỗi mã có số lượt quay giới hạn.
        </p>
      </div>

      {/* Reel */}
      <div className="-mx-4 sm:mx-0">
        {isLoading ? (
          <div className="flex h-[190px] md:h-[258px] items-center justify-center bg-[#1a0d33]/60">
            <MoxicLoader size="md" />
          </div>
        ) : (
          <CaseReel ref={reelRef} idleItems={prizes} />
        )}
      </div>

      {/* Code form */}
      <form onSubmit={handleSubmit} className="mx-auto mt-6 md:mt-8 flex max-w-xl flex-col gap-3 sm:flex-row">
        <input
          value={code}
          onChange={(e) => setCode(normalizeInput(e.target.value))}
          placeholder="NHẬP MÃ QUAY"
          maxLength={32}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          disabled={!available || busy}
          aria-label="Mã quay"
          className="h-12 flex-1 rounded-sm border border-fuchsia-500/30 bg-[#140b26] px-4 text-center font-mono text-base tracking-[0.25em] text-white placeholder:tracking-[0.15em] placeholder:text-white/30 outline-none transition-colors focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/30 disabled:opacity-60 sm:text-left"
        />
        <button
          type="submit"
          disabled={!available || busy || !code.trim()}
          className="h-12 w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-sm px-8 font-display font-bold uppercase tracking-wider text-white transition-[filter,opacity] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            background: "linear-gradient(135deg, #a855f7 0%, #ec4899 100%)",
            boxShadow: "0 0 24px rgba(236, 72, 153, 0.35)",
          }}
        >
          {busy ? <MoxicLoader size="sm" /> : <Gift className="h-4 w-4" />}
          {animating && !spin.isPending ? "Đang mở..." : "Mở hòm"}
        </button>
      </form>

      {!isLoading && (!available || isError) && (
        <p className="mx-auto mt-4 max-w-xl rounded-sm border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-300">
          Vòng quay đang được cập nhật, vui lòng quay lại sau.
        </p>
      )}

      {/* Items in the case */}
      {prizes.length > 0 && (
        <section className="mt-12 md:mt-16">
          <h2 className="mb-4 font-display text-lg md:text-xl text-text-primary">Vật phẩm trong hòm</h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-6">
            {prizes.map((p) => (
              <PrizeCard key={p.id} prize={p} size="tile" />
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-text-muted">
            {(Object.keys(RARITY_COLORS) as (keyof typeof RARITY_COLORS)[]).map((r) => (
              <span key={r} className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: RARITY_COLORS[r] }} />
                {RARITY_LABELS[r]}
              </span>
            ))}
          </div>
        </section>
      )}

      {result && <ResultModal result={result} onClose={closeResult} />}
    </Container>
  );
}

function ResultModal({ result, onClose }: { result: SpinResult; onClose: () => void }) {
  const { data: contact } = useContactSettings();
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
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

        {result.remainingUses > 0 && (
          <p className="mt-5 text-xs text-fuchsia-300">Mã của bạn còn {result.remainingUses} lượt quay</p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-sm border border-white/15 bg-white/5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
        >
          {result.remainingUses > 0 ? "Quay tiếp" : "Đóng"}
        </button>
      </div>
    </div>
  );
}
