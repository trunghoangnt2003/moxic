import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { AlertCircle } from "lucide-react";
import AuthShell from "../components/account/AuthShell";
import AuthField from "../components/account/AuthField";
import { MoxicLoader, PageLoader } from "../components/shared/MoxicLoader";
import { getAccountErrorMessage, isEmailNotVerifiedError, useLogin, useMe } from "../hooks/useAccount";
import { safeRedirect } from "../lib/accountApi";

import { t } from "../lib/i18n";
export default function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const redirectParam = params.get("redirect");
  const redirect = safeRedirect(redirectParam);

  const { data: me, isLoading: meLoading } = useMe();
  const login = useLogin();

  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  if (meLoading) return <PageLoader />;
  if (me) return <Navigate to={redirect} replace />;

  const carry = redirectParam ? `redirect=${encodeURIComponent(redirect)}` : "";

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const errors: typeof fieldErrors = {};
    if (!email.trim()) errors.email = t("Vui lòng nhập email");
    else if (!email.includes("@")) errors.email = t("Email không hợp lệ");
    if (!password) errors.password = t("Vui lòng nhập mật khẩu");
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setError("");
    login.mutate(
      { email: email.trim(), password },
      {
        onSuccess: (data) => {
          toast.success(t("Chào mừng {0}!", [data.displayName]));
          navigate(redirect, { replace: true });
        },
        onError: (err) => {
          if (isEmailNotVerifiedError(err)) {
            toast(getAccountErrorMessage(err, t("Email chưa được xác minh.")));
            const qs = new URLSearchParams({ email: email.trim() });
            if (redirectParam) qs.set("redirect", redirect);
            navigate(`/verify-email?${qs.toString()}`);
            return;
          }
          setError(getAccountErrorMessage(err, t("Đăng nhập thất bại. Vui lòng thử lại.")));
        },
      },
    );
  };

  return (
    <AuthShell
      title={t("Đăng nhập")}
      subtitle={t("Đăng nhập để theo dõi đơn hàng và lịch sử mua hàng.")}
      footer={
        <p>
          {t("Chưa có tài khoản?")}{" "}
          <Link to={`/register${carry ? `?${carry}` : ""}`} className="text-accent hover:underline font-semibold">
            {t("Đăng ký")}
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <AuthField
          id="login-email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="ban@example.com"
          autoComplete="email"
          error={fieldErrors.email}
        />
        <AuthField
          id="login-password"
          label={t("Mật khẩu")}
          type="password"
          value={password}
          onChange={setPassword}
          placeholder={t("Mật khẩu")}
          autoComplete="current-password"
          error={fieldErrors.password}
        />

        <div className="flex justify-end">
          <Link
            to={`/forgot-password${email.trim() ? `?email=${encodeURIComponent(email.trim())}` : ""}`}
            className="text-xs text-text-secondary hover:text-accent transition-colors"
          >
            {t("Quên mật khẩu?")}
          </Link>
        </div>

        {error && (
          <div role="alert" className="flex items-center gap-2 bg-negative/10 border border-negative/30 px-4 py-3">
            <AlertCircle className="w-4 h-4 text-negative flex-shrink-0" />
            <p className="text-negative text-xs">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={login.isPending}
          className="w-full bg-accent hover:bg-accent-hover text-on-accent font-bold h-12 text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
        >
          {login.isPending ? (
            <>
              <MoxicLoader size="sm" /> {t("Đang đăng nhập…")}
            </>
          ) : (
            t("Đăng nhập")
          )}
        </button>
      </form>
    </AuthShell>
  );
}
