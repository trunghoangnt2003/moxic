import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, CheckCircle2, TicketPercent, X } from "lucide-react";
import { useMe } from "../../hooks/useAccount";
import { useMyCoupons, useValidateCoupon } from "../../hooks/useCoupons";
import { getCouponErrorMessage, shortCouponDiscount, type CouponQuote } from "../../lib/couponApi";
import { formatPrice } from "../../lib/utils";
import { MoxicLoader } from "../shared/MoxicLoader";

interface Props {
  gameIds: string[];
  applied: CouponQuote | null;
  onApplied: (q: CouponQuote | null) => void;
  initialCode?: string;
}

const normalize = (raw: string) => raw.trim().toUpperCase().replace(/[\s-]/g, "");

/**
 * Checkout coupon input + wallet picker. Every number shown comes from the server
 * (POST /api/coupons/validate); order creation re-validates and recomputes anyway.
 */
export default function CouponBox({ gameIds, applied, onApplied, initialCode }: Props) {
  const { data: me, isLoading: meLoading } = useMe();
  const loggedIn = !!me;
  const { data: wallet } = useMyCoupons(loggedIn);
  const { mutate, isPending } = useValidateCoupon();

  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const key = gameIds.join(",");
  // Cart key the applied quote was computed for.
  const appliedKeyRef = useRef<string | null>(null);
  const autoAppliedRef = useRef(false);

  const apply = (raw: string) => {
    const normalized = normalize(raw);
    if (!normalized) {
      setError("Vui lòng nhập mã giảm giá.");
      return;
    }
    if (gameIds.length === 0) return;
    setError("");
    const forKey = key;
    mutate(
      { code: normalized, gameIds },
      {
        onSuccess: (q) => {
          appliedKeyRef.current = forKey;
          setCode("");
          onApplied(q);
        },
        onError: (err) => setError(getCouponErrorMessage(err, "Không áp dụng được mã giảm giá.")),
      }
    );
  };

  // Auto-apply ?coupon=CODE exactly once, when the customer is known and the cart is loaded.
  useEffect(() => {
    if (autoAppliedRef.current || !me || !initialCode || !key) return;
    autoAppliedRef.current = true;
    const ids = key.split(",").filter(Boolean);
    mutate(
      { code: normalize(initialCode), gameIds: ids },
      {
        onSuccess: (q) => {
          appliedKeyRef.current = key;
          onApplied(q);
        },
        onError: (err) => setError(getCouponErrorMessage(err, "Không áp dụng được mã giảm giá.")),
      }
    );
  }, [me, initialCode, key, mutate, onApplied]);

  // Cart changed while a coupon is applied → re-validate on the server.
  useEffect(() => {
    if (!applied || !me || !key) return;
    if (appliedKeyRef.current === key) return;
    appliedKeyRef.current = key;
    const ids = key.split(",").filter(Boolean);
    mutate(
      { code: applied.code, gameIds: ids },
      {
        onSuccess: (q) => onApplied(q),
        onError: (err) => {
          onApplied(null);
          setError(getCouponErrorMessage(err, "Mã giảm giá không còn áp dụng được cho giỏ hàng."));
        },
      }
    );
  }, [key, applied, me, mutate, onApplied]);

  if (meLoading) return null;

  if (!loggedIn) {
    return (
      <div className="flex items-center gap-2 border border-dashed border-white/10 px-3 py-2.5 text-xs">
        <TicketPercent className="h-4 w-4 flex-shrink-0 text-accent" />
        <span className="text-text-secondary">Có mã giảm giá?</span>
        <Link
          to={`/login?redirect=${encodeURIComponent("/checkout")}`}
          className="ml-auto text-right font-semibold text-accent hover:underline"
        >
          Đăng nhập để dùng mã giảm giá
        </Link>
      </div>
    );
  }

  const usable = (wallet ?? []).filter((c) => c.status === "Usable" && c.code !== applied?.code).slice(0, 6);

  return (
    <div className="space-y-2.5">
      {applied ? (
        <div className="flex items-start gap-2 border border-green-500/30 bg-green-500/10 px-3 py-2.5">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-400" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-text-primary">
              Đã áp dụng <span className="font-mono font-semibold">{applied.code}</span>
              <span className="text-text-secondary"> — {applied.name}</span>
            </p>
            <p className="mt-0.5 text-sm font-bold text-green-400">−{formatPrice(applied.discountAmount)}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              appliedKeyRef.current = null;
              setError("");
              onApplied(null);
            }}
            className="flex flex-shrink-0 cursor-pointer items-center gap-1 px-1.5 py-1 text-xs text-text-secondary hover:text-red-400"
          >
            <X className="h-3.5 w-3.5" /> Bỏ mã
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            apply(code);
          }}
          className="flex gap-2"
        >
          <div className="relative min-w-0 flex-1">
            <TicketPercent className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={40}
              placeholder="Nhập mã giảm giá"
              aria-label="Mã giảm giá"
              className="w-full border border-white/10 bg-bg-elevated py-2.5 pl-9 pr-3 font-mono text-sm uppercase text-text-primary placeholder:font-sans placeholder:normal-case placeholder:text-text-muted focus:border-accent/60 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="flex min-w-[84px] flex-shrink-0 cursor-pointer items-center justify-center bg-accent px-4 text-sm font-semibold text-bg-base transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? <MoxicLoader size="sm" /> : "Áp dụng"}
          </button>
        </form>
      )}

      {error && (
        <p className="flex items-start gap-1.5 text-xs text-red-400">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" /> {error}
        </p>
      )}

      {usable.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] uppercase tracking-wider text-text-muted">Mã trong ví của bạn</p>
          <div className="flex flex-wrap gap-1.5">
            {usable.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={isPending}
                onClick={() => apply(c.code)}
                className="cursor-pointer border border-accent/30 bg-accent/10 px-2 py-1 text-[11px] text-accent transition-colors hover:bg-accent/20 disabled:opacity-60"
              >
                <span className="font-mono font-semibold">{c.code}</span> · {shortCouponDiscount(c)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
