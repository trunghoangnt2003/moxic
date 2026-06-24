import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, AlertCircle } from "lucide-react";
import { createOrder } from "../../lib/api";
import { useCartStore } from "../../lib/cartStore";
import PrivacyNotice from "./PrivacyNotice";
import type { OrderCreateRequest } from "../../types/game";

interface Props {
  onSuccess: (orderCode: string) => void;
}

export default function CheckoutForm({ onSuccess }: Props) {
  const navigate = useNavigate();
  const clearCart = useCartStore((s) => s.clearCart);
  const paymentMethod = useCartStore((s) => "Bank");

  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [zalo, setZalo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!phone.trim()) errors.phone = "S\u1ed1 \u0111i\u1ec7n tho\u1ea1i kh\u00f4ng \u0111\u01b0\u1ee3c \u0111\u1ec3 tr\u1ed1ng";
    else if (!/^\d+$/.test(phone.trim())) errors.phone = "S\u1ed1 \u0111i\u1ec7n tho\u1ea1i ch\u1ec9 g\u1ed3m ch\u1eef s\u1ed1";
    if (!email.trim()) errors.email = "Email Xbox kh\u00f4ng \u0111\u01b0\u1ee3c \u0111\u1ec3 tr\u1ed1ng";
    else if (!email.includes("@")) errors.email = "Email kh\u00f4ng h\u1ee3p l\u1ec7";
    if (!password.trim()) errors.password = "M\u1eadt kh\u1ea9u Xbox kh\u00f4ng \u0111\u01b0\u1ee3c \u0111\u1ec3 tr\u1ed1ng";
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
      const msg = err?.response?.data?.error || err?.message || "\u0110\u1eb7t h\u00e0ng th\u1ea5t b\u1ea1i. Vui l\u00f2ng th\u1eed l\u1ea1i.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-bg-surface border border-border px-4 py-3 text-sm focus:outline-none focus:border-accent text-text-primary placeholder:text-text-placeholder transition-colors";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Phone */}
      <div>
        <label className="block text-xs text-text-secondary font-semibold mb-1.5">
          S\u1ed1 \u0111i\u1ec7n tho\u1ea1i <span className="text-danger">*</span>
        </label>
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
          placeholder="0901234567" className={inputClass} />
        {fieldErrors.phone && <p className="text-danger text-xs mt-1">{fieldErrors.phone}</p>}
      </div>

      {/* Xbox Email */}
      <div>
        <label className="block text-xs text-text-secondary font-semibold mb-1.5">
          Gmail Xbox <span className="text-danger">*</span>
        </label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="example@outlook.com" className={inputClass} />
        {fieldErrors.email && <p className="text-danger text-xs mt-1">{fieldErrors.email}</p>}
      </div>

      {/* Xbox Password */}
      <div>
        <label className="block text-xs text-text-secondary font-semibold mb-1.5">
          M\u1eadt kh\u1ea9u Xbox <span className="text-danger">*</span>
        </label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="M\u1eadt kh\u1ea9u \u0111\u0103ng nh\u1eadp Xbox" className={inputClass} />
        {fieldErrors.password && <p className="text-danger text-xs mt-1">{fieldErrors.password}</p>}
      </div>

      {/* Zalo/FB (optional) */}
      <div>
        <label className="block text-xs text-text-secondary font-semibold mb-1.5">
          Zalo / Facebook <span className="text-text-muted">(kh\u00f4ng b\u1eaft bu\u1ed9c)</span>
        </label>
        <input type="text" value={zalo} onChange={(e) => setZalo(e.target.value)}
          placeholder="Zalo ho\u1eb7c Facebook \u0111\u1ec3 li\u00ean h\u1ec7" className={inputClass} />
      </div>

      {/* Privacy notice */}
      <PrivacyNotice />

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-danger/10 border border-danger/30 px-4 py-3">
          <AlertCircle className="w-4 h-4 text-danger flex-shrink-0" />
          <p className="text-danger text-xs">{error}</p>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-accent hover:bg-accent-hover text-bg-base font-bold py-4 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> \u0110ang x\u1eed l\u00fd...</>
        ) : (
          "\u0110\u1eb7t h\u00e0ng"
        )}
      </button>
    </form>
  );
}
