import { useState, type FormEvent } from "react";
import OtpInput from "../components/account/OtpInput";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { AlertCircle, MailCheck } from "lucide-react";
import AuthShell from "../components/account/AuthShell";
import AuthField from "../components/account/AuthField";
import { MoxicLoader } from "../components/shared/MoxicLoader";
import { getAccountErrorMessage, useResendVerification, useVerifyEmail } from "../hooks/useAccount";
import { useCountdown } from "../hooks/useCountdown";
import { safeRedirect } from "../lib/accountApi";

const RESEND_COOLDOWN = 60;

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const initialEmail = params.get("email") ?? "";
  const redirect = safeRedirect(params.get("redirect"));

  const verify = useVerifyEmail();
  const resend = useResendVerification();
  // A code was just sent by register/login, so start with the cooldown running.
  const cooldown = useCountdown(initialEmail ? RESEND_COOLDOWN : 0);

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setError("Vui lòng nhập email hợp lệ.");
      return;
    }
    if (code.length !== 6) {
      setError("Vui lòng nhập đủ 6 chữ số.");
      return;
    }
    setError("");
    verify.mutate(
      { email: email.trim(), code },
      {
        onSuccess: () => {
          toast.success("Xác minh email thành công!");
          navigate(redirect, { replace: true });
        },
        onError: (err) => setError(getAccountErrorMessage(err, "Xác minh thất bại. Vui lòng thử lại.")),
      },
    );
  };

  const handleResend = () => {
    if (!email.trim() || !email.includes("@")) {
      setError("Vui lòng nhập email hợp lệ.");
      return;
    }
    setError("");
    resend.mutate(email.trim(), {
      onSuccess: (data) => {
        toast.success(data.message);
        cooldown.start(RESEND_COOLDOWN);
      },
      onError: (err) => setError(getAccountErrorMessage(err, "Không thể gửi lại mã. Vui lòng thử lại.")),
    });
  };

  return (
    <AuthShell
      title="Xác minh email"
      subtitle={
        initialEmail ? (
          <span className="flex items-start gap-2">
            <MailCheck className="w-4 h-4 mt-0.5 text-accent flex-shrink-0" />
            <span>
              Chúng tôi đã gửi mã 6 chữ số tới <strong className="text-text-primary break-all">{initialEmail}</strong>.
            </span>
          </span>
        ) : (
          "Nhập email đã đăng ký và mã 6 chữ số đã gửi tới email đó."
        )
      }
      footer={
        <p>
          Đã xác minh?{" "}
          <Link to={`/login?email=${encodeURIComponent(email.trim())}`} className="text-accent hover:underline font-semibold">
            Đăng nhập
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {!initialEmail && (
          <AuthField
            id="verify-email"
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="ban@example.com"
            autoComplete="email"
          />
        )}
        <OtpInput
          id="verify-code"
          label="Mã xác minh"
          value={code}
          onChange={setCode}
          hint="Mã có hiệu lực trong 15 phút. Kiểm tra cả thư mục Spam."
        />

        {error && (
          <div role="alert" className="flex items-center gap-2 bg-negative/10 border border-negative/30 px-4 py-3">
            <AlertCircle className="w-4 h-4 text-negative flex-shrink-0" />
            <p className="text-negative text-xs">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={verify.isPending}
          className="w-full bg-accent hover:bg-accent-hover text-bg-base font-bold h-12 text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
        >
          {verify.isPending ? (
            <>
              <MoxicLoader size="sm" /> Đang xác minh…
            </>
          ) : (
            "Xác minh"
          )}
        </button>

        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown.active || resend.isPending}
          className="w-full border border-white/10 hover:bg-bg-elevated text-text-secondary hover:text-text-primary py-3 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
        >
          {resend.isPending && <MoxicLoader size="sm" />}
          {cooldown.active ? `Gửi lại mã (${cooldown.remaining}s)` : "Gửi lại mã"}
        </button>
      </form>
    </AuthShell>
  );
}
