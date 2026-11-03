import { useState, type HTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

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
  "w-full bg-[#2d261e] border border-[#3d352a] px-4 py-3 text-sm focus:outline-none focus:border-[#c9a96e]/60 text-[#ede6db] placeholder:text-[#7a6f63] transition-colors";

/** Labelled input in the checkout's warm dark style; password fields get a show/hide toggle. */
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
      <label htmlFor={id} className="block text-xs text-[#b5a898] font-semibold mb-1.5">
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
            aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            className="absolute right-0 top-0 h-full px-3 text-[#7a6f63] hover:text-[#ede6db] transition-colors cursor-pointer"
          >
            {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-red-400 text-xs mt-1">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[#7a6f63] text-xs mt-1">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
