import { useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertCircle, Gift, UserCheck, User } from "lucide-react";
import { createOrder } from "../../lib/api";
import { useCartStore } from "../../lib/cartStore";
import { useMe } from "../../hooks/useAccount";
import { formatPrice } from "../../lib/utils";
import { MoxicLoader } from "../shared/MoxicLoader";
import PrivacyNotice from "./PrivacyNotice";
import type { OrderCreateRequest } from "../../types/game";

interface Props {
  onSuccess: (orderCode: string) => void;
  /** Code of the applied (server-previewed) coupon. */
  couponCode?: string;
  /** Called when the server rejects the coupon at submit (it is removed from the summary). */
  onCouponRejected?: () => void;
  /** Amount to pay, shown on the phone's sticky submit bar. */
  total?: number;
}

const SAVED_KEY = "moxic.checkout";
type SavedCheckout = { phone: string; email: string; zalo: string };
function readSavedCheckout(): SavedCheckout | null {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    return raw ? (JSON.parse(raw) as SavedCheckout) : null;
  } catch {
    return null;
  }
}
function writeSavedCheckout(v: SavedCheckout | null) {
  try {
    if (v) localStorage.setItem(SAVED_KEY, JSON.stringify(v));
    else localStorage.removeItem(SAVED_KEY);
  } catch {
    /* storage unavailable */
  }
}

const inputClass =
  "w-full h-12 bg-bg-surface border border-white/15 px-4 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition-colors aria-[invalid=true]:border-negative";

function Field({ id, label, required, hint, error, children }: { id: string; label: ReactNode; required?: boolean; hint?: ReactNode; error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-text-primary mb-2">
        {label}
        {required && <span className="text-negative"> *</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-negative text-sm mt-1.5">
          {error}
        </p>
      ) : hint ? (
        <p className="text-text-muted text-sm mt-1.5">{hint}</p>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-5">
      <legend className="font-display text-lg font-semibold text-text-primary mb-4">{title}</legend>
      {children}
    </fieldset>
  );
}

export default function CheckoutForm({ onSuccess, couponCode, onCouponRejected, total }: Props) {
  const clearCart = useCartStore((s) => s.clearCart);

  // Remembered contact details (never the password), per-device convenience.
  const [saved] = useState(readSavedCheckout);
  const [phone, setPhone] = useState(saved?.phone ?? "");
  const [email, setEmail] = useState(saved?.email ?? "");
  const [password, setPassword] = useState("");
  const [zalo, setZalo] = useState(saved?.zalo ?? "");
  const [remember, setRemember] = useState(saved != null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [params] = useSearchParams();
  const [isGift, setIsGift] = useState(params.get("gift") === "1");
  const [giftTo, setGiftTo] = useState("");
  const [giftFrom, setGiftFrom] = useState("");
  const [giftMessage, setGiftMessage] = useState("");

  // Logged-in customers: pre-fill the Xbox email with the account email once.
  // (state adjustment during render, runs once when `me` first arrives)
  const { data: me } = useMe();
  const [prefillChecked, setPrefillChecked] = useState(false);
  const [emailPrefilled, setEmailPrefilled] = useState(false);
  if (me && !prefillChecked) {
    setPrefillChecked(true);
    if (!email.trim()) {
      setEmail(me.email);
      setEmailPrefilled(true);
    }
  }

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (isGift) {
      if (!giftTo.trim()) errors.giftTo = "Nhập tên người nhận";
    }
    if (!phone.trim()) errors.phone = "Số điện thoại không được để trống";
    else if (!/^\d+$/.test(phone.trim())) errors.phone = "Số điện thoại chỉ gồm chữ số";
    if (!isGift) {
      if (!email.trim()) errors.email = "Email Xbox không được để trống";
      else if (!email.includes("@")) errors.email = "Email không hợp lệ";
      if (!password.trim()) errors.password = "Mật khẩu tài khoản Xbox không được để trống";
    }
    setFieldErrors(errors);
    // Take the customer to the first field that needs attention (the phone submit bar can be far below it).
    const first = Object.keys(errors)[0];
    if (first) {
      const ids: Record<string, string> = { giftTo: "gift-to", phone: "checkout-phone", email: "checkout-email", password: "checkout-password" };
      const el = document.getElementById(ids[first]);
      el?.focus({ preventScroll: true });
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    return !first;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setError("");

    try {
      const items = useCartStore.getState().items;
      const request: OrderCreateRequest = {
        items: items.map((i) => ({ gameId: i.gameId, editionId: i.editionId ?? undefined, price: i.price })),
        customerPhone: phone.trim(),
        customerXboxEmail: isGift ? "" : email.trim(),
        customerXboxPassword: isGift ? "" : password,
        isGift,
        giftRecipientName: isGift ? giftTo.trim() : undefined,
        giftFromName: isGift ? giftFrom.trim() || me?.displayName || undefined : undefined,
        giftMessage: isGift ? giftMessage.trim() || undefined : undefined,
        customerZalo: zalo.trim() || undefined,
        paymentMethod: "Bank",
        couponCode: couponCode || undefined,
      };
      const result = await createOrder(request);
      if (!isGift) writeSavedCheckout(remember ? { phone: phone.trim(), email: email.trim(), zalo: zalo.trim() } : null);
      clearCart();
      onSuccess(result.orderCode);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Đặt hàng thất bại. Vui lòng thử lại.";
      const code = err?.response?.data?.code;
      if (typeof code === "string" && code.startsWith("COUPON_")) {
        onCouponRejected?.();
        setError(`${msg} Mã giảm giá đã được gỡ, bạn có thể đặt hàng lại.`);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const invalid = (k: string) => (fieldErrors[k] ? true : undefined);
  const submitLabel = loading ? (
    <>
      <MoxicLoader size="sm" /> Đang xử lý…
    </>
  ) : isGift ? (
    "Đặt quà tặng"
  ) : (
    "Đặt hàng"
  );

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-10">
      {/* Who is it for */}
      <div>
        {me ? (
          <p className="flex items-start gap-2 text-sm text-text-secondary mb-4">
            <UserCheck className="w-4 h-4 text-positive shrink-0 mt-0.5" />
            <span>
              Đang đăng nhập với <strong className="text-text-primary">{me.displayName}</strong>. Đơn hàng sẽ được lưu vào{" "}
              <Link to="/account/orders" className="text-accent hover:underline">
                Lịch sử mua hàng
              </Link>
              .
            </span>
          </p>
        ) : (
          <p className="text-sm text-text-secondary mb-4">
            Đã có tài khoản?{" "}
            <Link to="/login?redirect=/checkout" className="text-accent hover:underline font-semibold">
              Đăng nhập để theo dõi đơn hàng
            </Link>
          </p>
        )}

        <div role="radiogroup" aria-label="Mua cho ai" className="grid grid-cols-2 gap-2">
          {(
            [
              [false, "Cho tôi", User],
              [true, "Tặng bạn bè", Gift],
            ] as const
          ).map(([gift, label, Icon]) => {
            const on = isGift === gift;
            return (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setIsGift(gift)}
                className={`h-14 px-3 flex items-center justify-center gap-2 border text-sm font-semibold transition-colors cursor-pointer ${
                  on ? "border-accent bg-accent/10 text-accent" : "border-white/15 text-text-secondary hover:border-white/30 hover:text-text-primary"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </button>
            );
          })}
        </div>
        {isGift && (
          <p className="mt-3 text-sm text-text-muted">Bạn thanh toán và nhận link quà gửi cho bạn bè. Người nhận tự nhập tài khoản Xbox của họ.</p>
        )}
      </div>

      {isGift && (
        <Section title="Món quà">
          <Field id="gift-to" label="Tên người nhận" required error={fieldErrors.giftTo}>
            <input id="gift-to" maxLength={60} value={giftTo} onChange={(e) => setGiftTo(e.target.value)} placeholder="VD: Minh" aria-invalid={invalid("giftTo")} className={inputClass} />
          </Field>
          <Field id="gift-from" label="Tên người tặng">
            <input id="gift-from" maxLength={60} value={giftFrom} onChange={(e) => setGiftFrom(e.target.value)} placeholder={me?.displayName || "Tên của bạn"} className={inputClass} />
          </Field>
          <Field id="gift-msg" label={<>Lời nhắn <span className="text-text-muted font-normal num">({giftMessage.length}/300)</span></>}>
            <textarea
              id="gift-msg"
              rows={3}
              maxLength={300}
              value={giftMessage}
              onChange={(e) => setGiftMessage(e.target.value)}
              placeholder="Chúc mừng sinh nhật! Chơi vui nhé"
              className={`${inputClass} h-auto py-3 resize-none`}
            />
          </Field>
        </Section>
      )}

      <Section title="Liên hệ">
        <Field id="checkout-phone" label={isGift ? "Số điện thoại của bạn (người tặng)" : "Số điện thoại"} required error={fieldErrors.phone}>
          <input
            id="checkout-phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0901234567"
            aria-invalid={invalid("phone")}
            className={inputClass}
          />
        </Field>
        <Field id="checkout-zalo" label={<>Zalo / Facebook <span className="text-text-muted font-normal">(không bắt buộc)</span></>}>
          <input id="checkout-zalo" type="text" value={zalo} onChange={(e) => setZalo(e.target.value)} placeholder="Zalo hoặc Facebook để liên hệ" className={inputClass} />
        </Field>
      </Section>

      {!isGift && (
        <Section title="Tài khoản Xbox để cài game">
          <Field
            id="checkout-email"
            label="Email tài khoản Xbox"
            required
            error={fieldErrors.email}
            hint={emailPrefilled && me && email === me.email ? "Đã điền sẵn email tài khoản, hãy đổi nếu email Xbox của bạn khác." : undefined}
          >
            <input
              id="checkout-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@outlook.com"
              aria-invalid={invalid("email")}
              className={inputClass}
            />
          </Field>
          <Field id="checkout-password" label="Mật khẩu tài khoản Xbox" required error={fieldErrors.password}>
            <input
              id="checkout-password"
              type="password"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mật khẩu đăng nhập Xbox"
              aria-invalid={invalid("password")}
              className={inputClass}
            />
          </Field>
          <PrivacyNotice />
        </Section>
      )}

      <div className="space-y-5">
        {!isGift && (
          <label className="flex items-start gap-3 text-sm text-text-secondary cursor-pointer select-none">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="mt-0.5 w-4 h-4 accent-accent shrink-0" />
            Ghi nhớ SĐT, email Xbox và Zalo trên thiết bị này cho lần mua sau (không lưu mật khẩu)
          </label>
        )}

        {error && (
          <div role="alert" className="flex items-start gap-2 bg-negative/10 border border-negative/30 px-4 py-3">
            <AlertCircle className="w-4 h-4 text-negative shrink-0 mt-0.5" />
            <p className="text-negative text-sm">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="hidden lg:flex w-full h-14 items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-on-accent font-bold text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {submitLabel}
        </button>
      </div>

      {/* Phone: the submit lives in a bar at the bottom of the screen with the amount */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-bg-base/95 backdrop-blur pb-[var(--sab)]">
        <div className="px-4 py-3 flex items-center gap-4">
          {total != null && (
            <div className="min-w-0">
              <p className="text-xs text-text-muted">Thanh toán</p>
              <p className="font-display text-xl font-bold text-accent num leading-tight">{formatPrice(total)}</p>
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="ml-auto h-12 px-6 inline-flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-on-accent font-bold transition-colors disabled:opacity-50 cursor-pointer"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
