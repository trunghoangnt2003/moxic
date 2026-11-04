import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { AlertCircle } from "lucide-react";
import AuthShell from "../components/account/AuthShell";
import AuthField from "../components/account/AuthField";
import { MoxicLoader, PageLoader } from "../components/shared/MoxicLoader";
import { getAccountErrorMessage, useMe, useRegister } from "../hooks/useAccount";
import { safeRedirect } from "../lib/accountApi";

import { t } from "../lib/i18n";
interface FieldErrors {
  displayName?: string;
  email?: string;
  password?: string;
  confirm?: string;
}

export default function RegisterPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const redirectParam = params.get("redirect");
  const redirect = safeRedirect(redirectParam);

  const { data: me, isLoading: meLoading } = useMe();
  const register = useRegister();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  if (meLoading) return <PageLoader />;
  if (me) return <Navigate to={redirect} replace />;

  const validate = (): boolean => {
    const errors: FieldErrors = {};
    const name = displayName.trim();
    if (name.length < 2 || name.length > 50) errors.displayName = t("Tên hiển thị phải từ 2 đến 50 ký tự.");
    if (!email.trim()) errors.email = t("Vui lòng nhập email");
    else if (!email.includes("@")) errors.email = t("Email không hợp lệ");
    if (password.length < 8) errors.password = t("Mật khẩu phải có ít nhất 8 ký tự.");
    else if (!/\d/.test(password)) errors.password = t("Mật khẩu phải chứa ít nhất 1 chữ số.");
    if (confirm !== password) errors.confirm = t("Mật khẩu nhập lại không khớp.");
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setError("");
    register.mutate(
      { displayName: displayName.trim(), email: email.trim(), password },
      {
        onSuccess: (data) => {
          toast.success(t("Đã gửi mã xác minh tới email của bạn."));
          const qs = new URLSearchParams({ email: data.email });
          if (redirectParam) qs.set("redirect", redirect);
          navigate(`/verify-email?${qs.toString()}`);
        },
        onError: (err) => setError(getAccountErrorMessage(err, t("Đăng ký thất bại. Vui lòng thử lại."))),
      },
    );
  };

  const loginHref = `/login${redirectParam ? `?redirect=${encodeURIComponent(redirect)}` : ""}`;

  return (
    <AuthShell
      title={t("Đăng ký")}
      subtitle={t("Tạo tài khoản để lưu và theo dõi lịch sử mua hàng.")}
      footer={
        <p>
          {t("Đã có tài khoản?")}{" "}
          <Link to={loginHref} className="text-accent hover:underline font-semibold">
            {t("Đăng nhập")}
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <AuthField
          id="register-name"
          label={t("Tên hiển thị")}
          type="text"
          value={displayName}
          onChange={setDisplayName}
          placeholder={t("Tên của bạn")}
          autoComplete="nickname"
          maxLength={50}
          error={fieldErrors.displayName}
        />
        <AuthField
          id="register-email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="ban@example.com"
          autoComplete="email"
          error={fieldErrors.email}
        />
        <AuthField
          id="register-password"
          label={t("Mật khẩu")}
          type="password"
          value={password}
          onChange={setPassword}
          placeholder={t("Mật khẩu")}
          autoComplete="new-password"
          hint={t("Tối thiểu 8 ký tự, gồm ít nhất 1 chữ số.")}
          error={fieldErrors.password}
        />
        <AuthField
          id="register-confirm"
          label={t("Nhập lại mật khẩu")}
          type="password"
          value={confirm}
          onChange={setConfirm}
          placeholder={t("Nhập lại mật khẩu")}
          autoComplete="new-password"
          error={fieldErrors.confirm}
        />

        {error && (
          <div role="alert" className="flex items-center gap-2 bg-negative/10 border border-negative/30 px-4 py-3">
            <AlertCircle className="w-4 h-4 text-negative flex-shrink-0" />
            <p className="text-negative text-xs">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={register.isPending}
          className="w-full bg-accent hover:bg-accent-hover text-on-accent font-bold h-12 text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
        >
          {register.isPending ? (
            <>
              <MoxicLoader size="sm" /> {t("Đang đăng ký…")}
            </>
          ) : (
            t("Tạo tài khoản")
          )}
        </button>
      </form>
    </AuthShell>
  );
}
