import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { Coins, KeyRound, LogIn, Search, Sparkles } from "lucide-react";
import Container from "../components/layout/Container";
import { MoxicLoader, SectionLoader } from "../components/shared/MoxicLoader";
import CaseCard from "../components/lucky-spin/CaseCard";
import LiveDropsBar from "../components/lucky-spin/LiveDropsBar";
import { getSpinErrorMessage, useLuckySpinCases } from "../hooks/useLuckySpin";
import { useMe } from "../hooks/useAccount";
import { formatPoints, lookupSpinCode, type OpenMethod } from "../lib/luckySpinApi";
import { useServerNow } from "../hooks/useCountdown";

import { t } from "../lib/i18n";
const FILTERS: { key: OpenMethod | null; label: string }[] = [
  { key: null, label: t("Tất cả") },
  { key: "Code", label: t("Nhập mã") },
  { key: "FreeInterval", label: t("Miễn phí") },
  { key: "Points", label: t("Dùng điểm") },
];

const normalizeCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32);

export default function LuckySpinGalleryPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { data: me } = useMe();

  const [method, setMethod] = useState<OpenMethod | null>(null);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [code, setCode] = useState("");
  const [lookingUp, setLookingUp] = useState(false);

  useEffect(() => {
    const h = window.setTimeout(() => setQ(search.trim().slice(0, 100)), 300);
    return () => window.clearTimeout(h);
  }, [search]);

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage, dataUpdatedAt } =
    useLuckySpinCases({ method, q });

  const cases = data?.pages.flatMap((p) => p.items) ?? [];
  const firstPage = data?.pages[0];
  const now = useServerNow(firstPage?.serverNow, dataUpdatedAt);
  const loggedIn = !!me;

  const resolveCode = async (raw: string, replace: boolean) => {
    const value = normalizeCode(raw);
    if (!value) {
      toast.error(t("Vui lòng nhập mã quay."));
      return;
    }
    setLookingUp(true);
    try {
      const { slug } = await lookupSpinCode(value);
      navigate(`/lucky-spin/${encodeURIComponent(slug)}?code=${encodeURIComponent(value)}`, { replace });
    } catch (err) {
      toast.error(getSpinErrorMessage(err));
    } finally {
      setLookingUp(false);
    }
  };

  // Old v1 links (/lucky-spin?code=XXXX) keep working: resolve the code's case once.
  const resolvedRef = useRef(false);
  useEffect(() => {
    const initial = params.get("code");
    if (resolvedRef.current || !initial) return;
    resolvedRef.current = true;
    void resolveCode(initial, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitCode = (e: FormEvent) => {
    e.preventDefault();
    if (lookingUp) return;
    void resolveCode(code, false);
  };

  return (
    <Container className="mt-8 mb-16">
      {/* Heading */}
      <div className="mb-6 text-center md:mb-8">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-highlight/30 bg-highlight/10 px-3 py-1 text-[11px] font-semibold text-highlight">
          <Sparkles className="h-3 w-3" /> {t("Mở hòm")}
        </div>
        <h1 className="mt-3 font-display text-3xl font-bold text-text-primary md:text-4xl">{t("Vòng Quay May Mắn")}</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-text-muted">
          {t("Chọn hòm để mở bằng mã quay, lượt miễn phí theo chu kỳ hoặc điểm thưởng, cơ hội nhận game Xbox miễn phí và mã giảm giá.")}
        </p>
        <div className="mt-4 flex justify-center">
          {loggedIn ? (
            <Link
              to="/account/points"
              className="inline-flex items-center gap-1.5 rounded-full border border-caution/30 bg-caution/10 px-3 py-1.5 text-xs font-semibold text-caution transition-colors hover:bg-caution/20"
            >
              <Coins className="h-3.5 w-3.5" /> {t("Điểm của bạn: {0}", [formatPoints(me.points)])}
            </Link>
          ) : (
            <Link
              to="/login?redirect=/lucky-spin"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 transition-colors hover:bg-white/10"
            >
              <LogIn className="h-3.5 w-3.5" /> {t("Đăng nhập để mở hòm miễn phí và dùng điểm")}
            </Link>
          )}
        </div>
      </div>

      <LiveDropsBar />

      {/* Have a code? */}
      <form
        onSubmit={submitCode}
        className="mx-auto mt-6 flex max-w-xl flex-col gap-2 sm:flex-row sm:items-center"
        aria-label={t("Nhập mã quay")}
      >
        <label htmlFor="gallery-code" className="flex items-center gap-1.5 text-sm font-semibold text-highlight sm:whitespace-nowrap">
          <KeyRound className="h-4 w-4" /> {t("Có mã quay?")}
        </label>
        <input
          id="gallery-code"
          value={code}
          onChange={(e) => setCode(normalizeCode(e.target.value))}
          placeholder={t("NHẬP MÃ QUAY")}
          maxLength={32}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="h-11 flex-1 rounded-sm border border-highlight/30 bg-spin-deep px-3 font-mono text-sm text-white placeholder: placeholder:text-white/30 outline-none transition-colors focus:border-highlight focus:ring-2 focus:ring-highlight/30"
        />
        <button
          type="submit"
          disabled={lookingUp || !code}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-sm px-5 text-sm font-bold text-on-solid transition-[filter,opacity] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, var(--color-spin-glow) 0%, var(--color-spin-pink) 100%)" }}
        >
          {lookingUp ? <MoxicLoader size="sm" /> : null} {t("Tìm hòm")}
        </button>
      </form>

      {/* Filters */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden" role="group" aria-label={t("Lọc theo cách mở")}>
          {FILTERS.map((f) => {
            const active = method === f.key;
            return (
              <button
                key={f.label}
                type="button"
                onClick={() => setMethod(f.key)}
                aria-pressed={active}
                className={`flex-none rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? "border-highlight bg-highlight/20 text-white"
                    : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Tìm hòm…")}
            maxLength={100}
            aria-label={t("Tìm hòm")}
            className="h-10 w-full rounded-sm border border-white/10 bg-spin-deep pl-9 pr-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-highlight"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="mt-5">
        {isLoading ? (
          <SectionLoader label={t("Đang tải hòm…")} />
        ) : isError ? (
          <div className="rounded-sm border border-white/10 bg-white/5 p-8 text-center">
            <p className="mb-4 text-sm text-negative">{t("Không thể tải danh sách hòm. Vui lòng thử lại.")}</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="rounded-sm bg-highlight px-5 py-2 text-sm font-semibold text-on-solid hover:bg-highlight"
            >
              {t("Thử lại")}
            </button>
          </div>
        ) : cases.length === 0 ? (
          <p className="rounded-sm border border-white/10 bg-white/5 px-4 py-10 text-center text-sm text-text-muted">
            {method || q ? t("Không tìm thấy hòm phù hợp.") : t("Chưa có hòm nào.")}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {cases.map((c) => (
                <CaseCard key={c.id} c={c} now={now} loggedIn={loggedIn} points={me?.points ?? null} />
              ))}
            </div>
            {hasNextPage && (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={() => void fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="inline-flex items-center gap-2 rounded-sm border border-highlight/40 bg-highlight/10 px-6 py-2.5 text-sm font-semibold text-highlight transition-colors hover:bg-highlight/20 disabled:opacity-60"
                >
                  {isFetchingNextPage ? <MoxicLoader size="sm" /> : null}
                  {t("Xem thêm hòm")}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Container>
  );
}
