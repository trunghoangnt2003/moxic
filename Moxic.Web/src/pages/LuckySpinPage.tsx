import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { isAxiosError } from "axios";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Clock, Coins, Gift, KeyRound, LogIn, Volume2, VolumeX } from "lucide-react";
import Container from "../components/layout/Container";
import { MoxicLoader } from "../components/shared/MoxicLoader";
import MoxicWave from "../components/shared/MoxicWave";
import CaseReel, { type CaseReelHandle } from "../components/lucky-spin/CaseReel";
import PrizeCard, { RARITY_COLORS, RARITY_LABELS } from "../components/lucky-spin/PrizeCard";
import LiveDropsBar from "../components/lucky-spin/LiveDropsBar";
import ResultModal from "../components/lucky-spin/ResultModal";
import {
  getSpinErrorCode,
  getSpinErrorMessage,
  useLuckySpinCase,
  useOpenCase,
  useSpinMusic,
} from "../hooks/useLuckySpin";
import { ME_QUERY_KEY, useMe } from "../hooks/useAccount";
import { useCaseMusic } from "../hooks/useCaseMusic";
import { formatCountdown, useServerNow } from "../hooks/useCountdown";
import { formatPoints, openMethodLabel, type OpenCaseResult } from "../lib/luckySpinApi";

import { t } from "../lib/i18n";
const normalizeInput = (value: string) => value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32);
const RESULT_DELAY_MS = 350;
const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

const METHOD_ICON = { Code: KeyRound, FreeInterval: Clock, Points: Coins } as const;

const primaryButtonStyle = {
  background: "linear-gradient(135deg, #a855f7 0%, #ec4899 100%)",
  boxShadow: "0 0 24px rgba(236, 72, 153, 0.35)",
};
const primaryButtonClass =
  "h-12 w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-sm px-8 font-display font-bold  text-on-solid transition-[filter,opacity] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50";
const loginButtonClass =
  "h-12 w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-sm px-8 font-display font-bold  text-on-accent bg-caution hover:bg-caution transition-colors";

export default function LuckySpinPage() {
  const { slug = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [code, setCode] = useState(() => normalizeInput(params.get("code") ?? ""));
  const [animating, setAnimating] = useState(false);
  const [result, setResult] = useState<OpenCaseResult | null>(null);
  const reelRef = useRef<CaseReelHandle>(null);
  const busyRef = useRef(false);

  const { data, isLoading, isError, error, refetch, dataUpdatedAt } = useLuckySpinCase(slug);
  const openCase = useOpenCase(slug);
  const { data: me } = useMe();
  const { data: tracks } = useSpinMusic();
  const music = useCaseMusic(tracks);
  const now = useServerNow(data?.serverNow, dataUpdatedAt);

  const spinCase = data?.case;
  const viewer = data?.viewer;
  const prizes = data?.prizes ?? [];
  const available = !!spinCase?.available;
  const busy = openCase.isPending || animating;
  const closeResult = useCallback(() => setResult(null), []);

  const nextFreeMs = viewer?.nextFreeOpenAt ? Date.parse(viewer.nextFreeOpenAt) : NaN;
  const cooldownLeft = Number.isFinite(nextFreeMs) ? nextFreeMs - now : 0;
  const inCooldown = cooldownLeft > 0;

  // When the free-open countdown reaches 0, refresh the case (once per deadline).
  const refetchedForRef = useRef<string | null>(null);
  useEffect(() => {
    const deadline = viewer?.nextFreeOpenAt;
    if (!deadline || refetchedForRef.current === deadline) return;
    if (now >= Date.parse(deadline)) {
      refetchedForRef.current = deadline;
      void refetch();
    }
  }, [now, viewer?.nextFreeOpenAt, refetch]);

  const refreshAfterRefusal = () => {
    void refetch();
    void qc.invalidateQueries({ queryKey: ME_QUERY_KEY });
  };

  const handleOpen = async () => {
    if (busyRef.current || busy || !spinCase || !available) return;

    let codeValue: string | undefined;
    if (spinCase.openMethod === "Code") {
      codeValue = code.trim();
      if (!codeValue) {
        toast.error(t("Vui lòng nhập mã quay."));
        return;
      }
    }

    // User gesture: start the music synchronously, before any await.
    music.start();
    busyRef.current = true;
    setAnimating(true);
    try {
      const res = await openCase.mutateAsync(codeValue);
      await reelRef.current?.spin(res);
      music.fadeOut();
      await wait(RESULT_DELAY_MS);
      setResult(res);
      if (spinCase.openMethod === "Code" && (res.remainingUses ?? 0) <= 0) setCode("");
    } catch (err) {
      music.stop();
      const errCode = getSpinErrorCode(err);
      if (errCode === "LOGIN_REQUIRED") {
        toast.error(getSpinErrorMessage(err));
        navigate(`/login?redirect=${encodeURIComponent(`/lucky-spin/${slug}`)}`);
      } else if (errCode === "EMAIL_NOT_VERIFIED") {
        toast.error(getSpinErrorMessage(err));
        navigate(`/verify-email${me?.email ? `?email=${encodeURIComponent(me.email)}` : ""}`);
      } else if (errCode === "COOLDOWN" || errCode === "INSUFFICIENT_POINTS") {
        toast.error(getSpinErrorMessage(err));
        refreshAfterRefusal();
      } else {
        toast.error(getSpinErrorMessage(err));
      }
    } finally {
      busyRef.current = false;
      setAnimating(false);
    }
  };

  const submitCode = (e: FormEvent) => {
    e.preventDefault();
    void handleOpen();
  };

  if (isError && isAxiosError(error) && error.response?.status === 404) {
    return (
      <Container className="mt-12 mb-16 text-center">
        <Gift className="mx-auto h-12 w-12 text-highlight/60" />
        <h1 className="mt-4 font-display text-2xl font-bold text-text-primary">{t("Không tìm thấy hòm")}</h1>
        <p className="mt-2 text-sm text-text-muted">{t("Hòm này không tồn tại hoặc đã tạm ngừng.")}</p>
        <Link
          to="/lucky-spin"
          className="mt-6 inline-flex items-center gap-2 rounded-sm px-6 py-2.5 text-sm font-semibold text-white"
          style={primaryButtonStyle}
        >
          <ArrowLeft className="h-4 w-4" /> {t("Tất cả hòm")}
        </Link>
      </Container>
    );
  }

  const MethodIcon = spinCase ? METHOD_ICON[spinCase.openMethod] : Gift;
  const loginHref = `/login?redirect=${encodeURIComponent(`/lucky-spin/${slug}`)}`;
  const points = viewer?.points ?? 0;
  const pointsShort = spinCase ? Math.max(0, spinCase.pointsCost - points) : 0;
  const busyLabel = animating && !openCase.isPending ? t("Đang mở…") : null;

  const muteToggle = music.hasTrack ? (
    <button
      type="button"
      onClick={music.toggleMute}
      aria-pressed={music.muted}
      title={music.muted ? t("Bật nhạc") : t("Tắt nhạc")}
      aria-label={music.muted ? t("Bật nhạc") : t("Tắt nhạc")}
      className="inline-flex h-12 w-12 flex-none items-center justify-center rounded-sm border border-highlight/30 bg-spin-deep text-highlight transition-colors hover:bg-highlight/15"
    >
      {music.muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
    </button>
  ) : null;

  let actionPanel: React.ReactNode = null;
  if (spinCase && viewer) {
    if (spinCase.openMethod === "Code") {
      actionPanel = (
        <form onSubmit={submitCode} className="flex w-full flex-col gap-3 sm:flex-row">
          <input
            value={code}
            onChange={(e) => setCode(normalizeInput(e.target.value))}
            placeholder={t("NHẬP MÃ QUAY")}
            maxLength={32}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            disabled={!available || busy}
            aria-label={t("Mã quay")}
            className="h-12 flex-1 rounded-sm border border-highlight/30 bg-spin-deep px-4 text-center font-mono text-base text-white placeholder: placeholder:text-white/30 outline-none transition-colors focus:border-highlight focus:ring-2 focus:ring-highlight/30 disabled:opacity-60 sm:text-left"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!available || busy || !code.trim()}
              className={primaryButtonClass}
              style={primaryButtonStyle}
            >
              {busy ? <MoxicLoader size="sm" /> : <Gift className="h-4 w-4" />}
              {busyLabel ?? t("Mở hòm")}
            </button>
            {muteToggle}
          </div>
        </form>
      );
    } else if (!viewer.loggedIn) {
      actionPanel = (
        <div className="flex w-full flex-col items-center gap-2">
          <div className="flex w-full justify-center gap-2">
            <Link to={loginHref} className={loginButtonClass}>
              <LogIn className="h-4 w-4" />
              {spinCase.openMethod === "FreeInterval" ? t("Đăng nhập để mở miễn phí") : t("Đăng nhập để mở hòm")}
            </Link>
          </div>
          <p className="text-xs text-text-muted">
            {t("Chưa có tài khoản?")}{" "}
            <Link to="/register" className="text-highlight hover:text-highlight">
              {t("Đăng ký ngay")}
            </Link>
          </p>
        </div>
      );
    } else if (!viewer.emailVerified) {
      actionPanel = (
        <Link
          to={`/verify-email${me?.email ? `?email=${encodeURIComponent(me.email)}` : ""}`}
          className={loginButtonClass}
        >
          {t("Xác minh email để mở hòm")}
        </Link>
      );
    } else if (spinCase.openMethod === "FreeInterval") {
      actionPanel = (
        <div className="flex w-full flex-col items-center gap-2">
          <div className="flex w-full justify-center gap-2">
            <button
              type="button"
              onClick={() => void handleOpen()}
              disabled={!available || busy || inCooldown}
              className={primaryButtonClass}
              style={primaryButtonStyle}
            >
              {busy ? <MoxicLoader size="sm" /> : <Clock className="h-4 w-4" />}
              {busyLabel ?? (inCooldown ? t("Đã dùng lượt miễn phí") : t("Mở miễn phí"))}
            </button>
            {muteToggle}
          </div>
          {inCooldown && (
            <p className="text-sm text-white/70" aria-live="polite">
              {t("Lượt miễn phí tiếp theo sau")}{" "}
              <span className="font-mono font-semibold text-highlight">{formatCountdown(cooldownLeft)}</span>
            </p>
          )}
        </div>
      );
    } else {
      const short = pointsShort > 0;
      actionPanel = (
        <div className="flex w-full flex-col items-center gap-2">
          <div className="flex w-full justify-center gap-2">
            <button
              type="button"
              onClick={() => void handleOpen()}
              disabled={!available || busy || short}
              className={primaryButtonClass}
              style={primaryButtonStyle}
            >
              {busy ? <MoxicLoader size="sm" /> : <Coins className="h-4 w-4" />}
              {busyLabel ?? t("Mở hòm ({0} điểm)", [formatPoints(spinCase.pointsCost)])}
            </button>
            {muteToggle}
          </div>
          <p className="text-sm text-white/70">
            {t("Số dư:")} <span className="font-semibold text-caution">{t("{0} điểm", [formatPoints(points)])}</span>
          </p>
          {short && (
            <p className="text-xs text-caution">
              {t("Bạn cần thêm {0} điểm,", [formatPoints(pointsShort)])}{" "}
              <Link to="/account/points" className="underline hover:text-caution">
                {t("Cách nhận điểm")}
              </Link>
            </p>
          )}
        </div>
      );
    }
  }

  const canOpenAgain = (() => {
    if (!result || !spinCase) return false;
    if (spinCase.openMethod === "Code") return (result.remainingUses ?? 0) > 0;
    if (spinCase.openMethod === "Points") return (result.pointsBalance ?? 0) >= spinCase.pointsCost;
    return false;
  })();

  return (
    <Container className="mt-6 mb-16 md:mt-8">
      <Link
        to="/lucky-spin"
        className="inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> {t("Tất cả hòm")}
      </Link>

      {/* Heading */}
      <div className="mb-5 mt-3 text-center md:mb-6">
        {spinCase ? (
          <>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-highlight/30 bg-highlight/10 px-3 py-1 text-[11px] font-semibold text-highlight">
              <MethodIcon className="h-3 w-3" /> {openMethodLabel(spinCase)}
            </div>
            <h1 className="mt-3 font-display text-3xl font-bold text-text-primary md:text-4xl">{spinCase.name}</h1>
            {spinCase.description && (
              <p className="mx-auto mt-2 max-w-xl text-sm text-text-muted">{spinCase.description}</p>
            )}
          </>
        ) : (
          <div className="h-[92px]" aria-hidden="true" />
        )}
      </div>

      <LiveDropsBar />

      {/* Reel */}
      <div className="-mx-4 mt-5 sm:mx-0">
        {isLoading ? (
          <div className="flex h-[190px] items-center justify-center bg-spin-ink/60 md:h-[258px]">
            <MoxicWave width={170} />
          </div>
        ) : (
          <CaseReel ref={reelRef} idleItems={prizes} />
        )}
      </div>

      {/* Actions */}
      <div className="mx-auto mt-6 flex max-w-xl justify-center md:mt-8">{actionPanel}</div>

      {!isLoading && (isError || (spinCase && !available)) && (
        <p className="mx-auto mt-4 max-w-xl rounded-sm border border-caution/30 bg-caution/10 px-4 py-3 text-center text-sm text-caution">
          {t("Hòm đang được cập nhật, vui lòng quay lại sau.")}
        </p>
      )}

      {/* Items in the case */}
      {prizes.length > 0 && (
        <section className="mt-12 md:mt-16">
          <h2 className="mb-4 font-display text-lg text-text-primary md:text-xl">{t("Vật phẩm trong hòm")}</h2>
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

      {result && spinCase && (
        <ResultModal result={result} caseInfo={spinCase} onClose={closeResult} canOpenAgain={canOpenAgain} />
      )}
    </Container>
  );
}
