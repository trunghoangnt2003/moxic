import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertCircle, Gift, UserCheck } from "lucide-react";
import { createOrder } from "../../lib/api";
import { useCartStore } from "../../lib/cartStore";
import { useMe } from "../../hooks/useAccount";
import { MoxicLoader } from "../shared/MoxicLoader";
import PrivacyNotice from "./PrivacyNotice";
import type { OrderCreateRequest } from "../../types/game";

interface Props {
  onSuccess: (orderCode: string) => void;
  /** Code of the applied (server-previewed) coupon. */
  couponCode?: string;
  /** Called when the server rejects the coupon at submit (it is removed from the summary). */
  onCouponRejected?: () => void;
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

export default function CheckoutForm({ onSuccess, couponCode, onCouponRejected }: Props) {
  const clearCart = useCartStore((s) => s.clearCart);

  // Remembered contact details (never the password) — per-device convenience.
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
  // (state adjustment during render — runs once when `me` first arrives)
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
    if (!phone.trim()) errors.phone = "Số điện thoại không được để trống";
    else if (!/^\d+$/.test(phone.trim())) errors.phone = "Số điện thoại chỉ gồm chữ số";
    if (isGift) {
      if (!giftTo.trim()) errors.giftTo = "Nhập tên người nhận";
    } else {
      if (!email.trim()) errors.email = "Email Xbox không được để trống";
      else if (!email.includes("@")) errors.email = "Email không hợp lệ";
      if (!password.trim()) errors.password = "Mật khẩu tài khoản Xbox không được để trống";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
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
        setError(`${msg} Mã giảm giá đã được gỡ — bạn có thể đặt hàng lại.`);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full bg-[#2d261e] border border-[#3d352a] px-4 py-3 text-sm focus:outline-none focus:border-[#c9a96e]/60 text-[#ede6db] placeholder:text-[#7a6f63] transition-colors";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Account status */}
      {me ? (
        <div className="flex items-start gap-2 bg-[#c9a96e]/10 border border-[#c9a96e]/30 px-4 py-3">
          <UserCheck className="w-4 h-4 text-[#c9a96e] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[#ede6db]">
            Đang đăng nhập với <strong>{me.displayName}</strong> <span className="text-[#b5a898] break-all">({me.email})</span>.
            Đơn hàng sẽ được lưu vào{" "}
            <Link to="/account/orders" className="text-[#c9a96e] hover:underline">
              Lịch sử mua hàng
            </Link>
            .
          </p>
        </div>
      ) : (
        <p className="text-xs text-[#7a6f63]">
          Đã có tài khoản?{" "}
          <Link to="/login?redirect=/checkout" className="text-[#c9a96e] hover:underline font-semibold">
            Đăng nhập để theo dõi đơn hàng
          </Link>
        </p>
      )}

      {/* Gift toggle */}
      <button
        type="button"
        onClick={() => setIsGift((v) => !v)}
        aria-pressed={isGift}
        className={`w-full flex items-center gap-3 px-4 py-3 border text-left transition-colors cursor-pointer ${
          isGift ? "border-[#c9a96e] bg-[#c9a96e]/10" : "border-[#3d352a] hover:border-[#c9a96e]/50"
        }`}
      >
        <Gift className={`w-5 h-5 shrink-0 ${isGift ? "text-[#c9a96e]" : "text-[#b5a898]"}`} />
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-[#ede6db]">Mua làm quà tặng</span>
          <span className="block text-xs text-[#7a6f63]">Bạn thanh toán, nhận link quà gửi cho bạn bè. Người nhận tự nhập tài khoản Xbox của họ.</span>
        </span>
        <span className={`w-10 h-6 rounded-full p-0.5 transition-colors shrink-0 ${isGift ? "bg-[#c9a96e]" : "bg-[#3d352a]"}`}>
          <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${isGift ? "translate-x-4" : ""}`} />
        </span>
      </button>

      {isGift && (
        <div className="space-y-4 border-l-2 border-[#c9a96e]/50 pl-4">
          <div>
            <label htmlFor="gift-to" className="block text-xs text-[#b5a898] font-semibold mb-1.5">
              Tên người nhận <span className="text-red-400">*</span>
            </label>
            <input id="gift-to" maxLength={60} value={giftTo} onChange={(e) => setGiftTo(e.target.value)} placeholder="VD: Minh" className={inputClass} />
            {fieldErrors.giftTo && <p className="text-red-400 text-xs mt-1">{fieldErrors.giftTo}</p>}
          </div>
          <div>
            <label htmlFor="gift-from" className="block text-xs text-[#b5a898] font-semibold mb-1.5">Tên người tặng</label>
            <input id="gift-from" maxLength={60} value={giftFrom} onChange={(e) => setGiftFrom(e.target.value)} placeholder={me?.displayName || "Tên của bạn"} className={inputClass} />
          </div>
          <div>
            <label htmlFor="gift-msg" className="block text-xs text-[#b5a898] font-semibold mb-1.5">Lời nhắn <span className="text-[#7a6f63]">({giftMessage.length}/300)</span></label>
            <textarea id="gift-msg" rows={3} maxLength={300} value={giftMessage} onChange={(e) => setGiftMessage(e.target.value)} placeholder="Chúc mừng sinh nhật! Chơi vui nhé 🎮" className={`${inputClass} resize-none`} />
          </div>
        </div>
      )}

      {/* Phone */}
      <div>
        <label htmlFor="checkout-phone" className="block text-xs text-[#b5a898] font-semibold mb-1.5">
          {isGift ? "Số điện thoại của bạn (người tặng)" : "Số điện thoại"} <span className="text-red-400">*</span>
        </label>
        <input id="checkout-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
          placeholder="0901234567" className={inputClass} />
        {fieldErrors.phone && <p className="text-red-400 text-xs mt-1">{fieldErrors.phone}</p>}
      </div>

      {/* Xbox Email */}
      {!isGift && <>
      <div>
        <label htmlFor="checkout-email" className="block text-xs text-[#b5a898] font-semibold mb-1.5">
          Email tài khoản Xbox <span className="text-red-400">*</span>
        </label>
        <input id="checkout-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="example@outlook.com" className={inputClass} />
        {fieldErrors.email ? (
          <p className="text-red-400 text-xs mt-1">{fieldErrors.email}</p>
        ) : emailPrefilled && me && email === me.email ? (
          <p className="text-[#7a6f63] text-xs mt-1">Đã điền sẵn email tài khoản — hãy đổi nếu email Xbox của bạn khác.</p>
        ) : null}
      </div>

      {/* Xbox Password */}
      <div>
        <label htmlFor="checkout-password" className="block text-xs text-[#b5a898] font-semibold mb-1.5">
          Mật khẩu tài khoản Xbox <span className="text-red-400">*</span>
        </label>
        <input id="checkout-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="Mật khẩu đăng nhập Xbox" className={inputClass} />
        {fieldErrors.password && <p className="text-red-400 text-xs mt-1">{fieldErrors.password}</p>}
      </div>
      </>}

      {/* Zalo/FB (optional) */}
      <div>
        <label htmlFor="checkout-zalo" className="block text-xs text-[#b5a898] font-semibold mb-1.5">
          Zalo / Facebook <span className="text-[#7a6f63]">(không bắt buộc)</span>
        </label>
        <input id="checkout-zalo" type="text" value={zalo} onChange={(e) => setZalo(e.target.value)}
          placeholder="Zalo hoặc Facebook để liên hệ" className={inputClass} />
      </div>

      <label className="flex items-center gap-2 text-xs text-[#b5a898] cursor-pointer select-none">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="accent-[#c9a96e]" />
        Ghi nhớ SĐT, email Xbox và Zalo trên thiết bị này cho lần mua sau (không lưu mật khẩu)
      </label>

      {/* Privacy notice */}
      <PrivacyNotice />

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-red-400 text-xs">{error}</p>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#c9a96e] hover:bg-[#d4b87a] text-[#1a1714] font-bold py-4 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
      >
        {loading ? (
          <><MoxicLoader size="sm" /> Đang xử lý...</>
        ) : (
          isGift ? "Đặt quà tặng" : "Đặt hàng"
        )}
      </button>
    </form>
  );
}
