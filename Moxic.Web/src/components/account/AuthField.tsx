import { useState, type HTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

import { t } from "../../lib/i18n";
interface AuthFieldProps {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  autoComplete?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  hint?: string;
  className?: string;
}

const inputClass =
  "w-full h-12 bg-bg-surface border border-white/15 px-4 text-base text-text-primary placeholder:text-text-placeholder transition-colors hover:border-white/25 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 aria-[invalid=true]:border-negative";

/** Labelled 48px input; password fields get a show/hide toggle. */
export default function AuthField({
  id,
  label,
  type,
  value,
  onChange,
  placeholder,
  error,
  autoComplete,
  inputMode,
  maxLength,
  hint,
  className = "",
}: AuthFieldProps) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword && visible ? "text" : type;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div>
      <label htmlFor={id} className="block text-sm text-text-primary font-medium mb-2">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode={inputMode}
          maxLength={maxLength}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${inputClass} ${isPassword ? "pr-11" : ""} ${className}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? t("Ẩn mật khẩu") : t("Hiện mật khẩu")}
            className="absolute right-0 top-0 h-full px-3 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          >
            {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-negative text-sm mt-1.5">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-text-muted text-sm mt-1.5">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
