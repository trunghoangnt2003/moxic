import { useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { createOrder } from "../../lib/api";
import { useCartStore } from "../../lib/cartStore";
import PrivacyNotice from "./PrivacyNotice";
import type { OrderCreateRequest } from "../../types/game";

interface Props {
  onSuccess: (orderCode: string) => void;
}

export default function CheckoutForm({ onSuccess }: Props) {
  const clearCart = useCartStore((s) => s.clearCart);

  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [zalo, setZalo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!phone.trim()) errors.phone = "Số điện thoại không được để trống";
    else if (!/^\d+$/.test(phone.trim())) errors.phone = "Số điện thoại chỉ gồm chữ số";
    if (!email.trim()) errors.email = "Email Xbox không được để trống";
    else if (!email.includes("@")) errors.email = "Email không hợp lệ";
    if (!password.trim()) errors.password = "Mật khẩu tài khoản Xbox không được để trống";
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
        items: items.map((i) => ({ gameId: i.gameId, price: i.price })),
        customerPhone: phone.trim(),
        customerXboxEmail: email.trim(),
        customerXboxPassword: password,
        customerZalo: zalo.trim() || undefined,
        paymentMethod: "Bank",
      };
      const result = await createOrder(request);
      clearCart();
      onSuccess(result.orderCode);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Đặt hàng thất bại. Vui lòng thử lại.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full bg-[#2d261e] border border-[#3d352a] px-4 py-3 text-sm focus:outline-none focus:border-[#c9a96e]/60 text-[#ede6db] placeholder:text-[#7a6f63] transition-colors";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Phone */}
      <div>
        <label htmlFor="checkout-phone" className="block text-xs text-[#b5a898] font-semibold mb-1.5">
          Số điện thoại <span className="text-red-400">*</span>
        </label>
        <input id="checkout-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
          placeholder="0901234567" className={inputClass} />
        {fieldErrors.phone && <p className="text-red-400 text-xs mt-1">{fieldErrors.phone}</p>}
      </div>

      {/* Xbox Email */}
      <div>
        <label htmlFor="checkout-email" className="block text-xs text-[#b5a898] font-semibold mb-1.5">
          Email tài khoản Xbox <span className="text-red-400">*</span>
        </label>
        <input id="checkout-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="example@outlook.com" className={inputClass} />
        {fieldErrors.email && <p className="text-red-400 text-xs mt-1">{fieldErrors.email}</p>}
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

      {/* Zalo/FB (optional) */}
      <div>
        <label htmlFor="checkout-zalo" className="block text-xs text-[#b5a898] font-semibold mb-1.5">
          Zalo / Facebook <span className="text-[#7a6f63]">(không bắt buộc)</span>
        </label>
        <input id="checkout-zalo" type="text" value={zalo} onChange={(e) => setZalo(e.target.value)}
          placeholder="Zalo hoặc Facebook để liên hệ" className={inputClass} />
      </div>

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
          <><Loader2 className="w-4 h-4 animate-spin" /> Đang xử lý...</>
        ) : (
          "Đặt hàng"
        )}
      </button>
    </form>
  );
}
