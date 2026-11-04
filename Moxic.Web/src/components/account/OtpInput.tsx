import { useRef, useState } from "react";

interface OtpInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  length?: number;
  error?: string;
  hint?: string;
}

/**
 * Six digit boxes drawn over one real input, so paste, SMS/email autofill (one-time-code)
 * and screen readers all see a single field.
 */
export default function OtpInput({ id, label, value, onChange, length = 6, error, hint }: OtpInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const digits = value.padEnd(length, " ").slice(0, length).split("");
  const active = Math.min(value.length, length - 1);
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div>
      <label htmlFor={id} className="block text-sm text-text-primary font-medium mb-2">
        {label}
      </label>
      <div className="relative" onClick={() => ref.current?.focus()}>
        <input
          ref={ref}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, length))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={length}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="absolute inset-0 w-full h-full opacity-0 cursor-text caret-transparent"
        />
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }} aria-hidden="true">
          {digits.map((d, i) => {
            const isActive = focused && i === active;
            return (
              <span
                key={i}
                className={`h-14 flex items-center justify-center bg-bg-surface border text-2xl font-display font-semibold tabular-nums text-text-primary transition-colors ${
                  error ? "border-negative" : isActive ? "border-accent ring-2 ring-accent/25" : d.trim() ? "border-white/30" : "border-white/15"
                }`}
              >
                {d.trim()}
                {isActive && !d.trim() && <span className="w-px h-6 bg-accent motion-safe:animate-pulse" />}
              </span>
            );
          })}
        </div>
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
