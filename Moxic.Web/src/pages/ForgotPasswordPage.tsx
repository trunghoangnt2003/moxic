import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { AlertCircle } from "lucide-react";
import AuthShell from "../components/account/AuthShell";
import AuthField from "../components/account/AuthField";
import { MoxicLoader } from "../components/shared/MoxicLoader";
import { getAccountErrorMessage, useForgotPassword, useResetPassword } from "../hooks/useAccount";
import { useCountdown } from "../hooks/useCountdown";

const RESEND_COOLDOWN = 60;

type Step = "request" | "reset";

interface FieldErrors {
  email?: string;
  code?: string;
  password?: string;
  confirm?: string;
}

const primaryButton =
  "w-full bg-[#c9a96e] hover:bg-[#d4b87a] text-[#1a1714] font-bold py-3.5 text-sm uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer";

export default function ForgotPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const forgot = useForgotPassword();
  const reset = useResetPassword();
  const cooldown = useCountdown();

  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const requestCode = (onDone?: () => void) => {
    if (!email.trim() || !email.includes("@")) {
      setFieldErrors({ email: "Vui lòng nhập email hợp lệ." });
      return;
    }
    setFieldErrors({});
    setError("");
    forgot.mutate(email.trim(), {
      onSuccess: (data) => {
        toast.success(data.message);
        cooldown.start(RESEND_COOLDOWN);
        onDone?.();
      },
      onError: (err) => setError(getAccountErrorMessage(err, "Không thể gửi mã. Vui lòng thử lại.")),
    });
  };

  const handleRequest = (e: FormEvent) => {
    e.preventDefault();
    requestCode(() => setStep("reset"));
  };

  const handleReset = (e: FormEvent) => {
    e.preventDefault();
    const errors: FieldErrors = {};
    if (code.length !== 6) errors.code = "Vui lòng nhập đủ 6 chữ số.";
    if (password.length < 8) errors.password = "Mật khẩu phải có ít nhất 8 ký tự.";
    else if (!/\d/.test(password)) errors.password = "Mật khẩu phải chứa ít nhất 1 chữ số.";
    if (confirm !== password) errors.confirm = "Mật khẩu nhập lại không khớp.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setError("");
    reset.mutate(
      { email: email.trim(), code, newPassword: password },
      {
        onSuccess: (data) => {
          toast.success(data.message);
          navigate(`/login?email=${encodeURIComponent(email.trim())}`, { replace: true });
        },
        onError: (err) => setError(getAccountErrorMessage(err, "Không thể đặt lại mật khẩu. Vui lòng thử lại.")),
      },
    );
  };

  const errorBox = error && (
    <div role="alert" className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 px-4 py-3">
      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
      <p className="text-red-400 text-xs">{error}</p>
    </div>
  );

  return (
    <AuthShell
      title="Quên mật khẩu"
      subtitle={
        step === "request" ? (
          "Nhập email tài khoản, chúng tôi sẽ gửi mã 6 chữ số để đặt lại mật khẩu."
        ) : (
          <>
            Nhập mã đã gửi tới <strong className="text-[#ede6db] break-all">{email.trim()}</strong> và mật khẩu mới.
          </>
        )
      }
      footer={
        <p>
          Nhớ mật khẩu rồi?{" "}
          <Link to="/login" className="text-[#c9a96e] hover:underline font-semibold">
            Đăng nhập
          </Link>
        </p>
      }
    >
      {step === "request" ? (
        <form onSubmit={handleRequest} className="space-y-4" noValidate>
          <AuthField
            id="forgot-email"
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="ban@example.com"
            autoComplete="email"
            error={fieldErrors.email}
          />
          {errorBox}
          <button type="submit" disabled={forgot.isPending} className={primaryButton}>
            {forgot.isPending ? (
              <>
                <MoxicLoader size="sm" /> Đang gửi...
              </>
            ) : (
              "Gửi mã"
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handleReset} className="space-y-4" noValidate>
          <AuthField
            id="reset-code"
            label="Mã xác nhận"
            type="text"
            value={code}
            onChange={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
            placeholder="••••••"
            autoComplete="one-time-code"
            inputMode="numeric"
            maxLength={6}
            className="text-center font-mono text-xl tracking-[0.6em]"
            hint="Mã có hiệu lực trong 15 phút. Kiểm tra cả thư mục Spam."
            error={fieldErrors.code}
          />
          <AuthField
            id="reset-password"
            label="Mật khẩu mới"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="Mật khẩu mới"
            autoComplete="new-password"
            hint="Tối thiểu 8 ký tự, gồm ít nhất 1 chữ số."
            error={fieldErrors.password}
          />
          <AuthField
            id="reset-confirm"
            label="Nhập lại mật khẩu mới"
            type="password"
            value={confirm}
            onChange={setConfirm}
            placeholder="Nhập lại mật khẩu mới"
            autoComplete="new-password"
            error={fieldErrors.confirm}
          />
          {errorBox}
          <button type="submit" disabled={reset.isPending} className={primaryButton}>
            {reset.isPending ? (
              <>
                <MoxicLoader size="sm" /> Đang cập nhật...
              </>
            ) : (
              "Đặt lại mật khẩu"
            )}
          </button>
          <button
            type="button"
            onClick={() => requestCode()}
            disabled={cooldown.active || forgot.isPending}
            className="w-full border border-[#3d352a] hover:bg-[#2d261e] text-[#b5a898] hover:text-[#ede6db] py-3 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
          >
            {forgot.isPending && <MoxicLoader size="sm" />}
            {cooldown.active ? `Gửi lại mã (${cooldown.remaining}s)` : "Gửi lại mã"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("request");
              setError("");
              setFieldErrors({});
            }}
            className="w-full text-xs text-[#7a6f63] hover:text-[#ede6db] transition-colors cursor-pointer"
          >
            Đổi email
          </button>
        </form>
      )}
    </AuthShell>
  );
}
