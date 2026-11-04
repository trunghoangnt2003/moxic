import type { ReactNode } from "react";

interface AuthShellProps {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

/** Centered card layout shared by the login / register / verify / forgot-password pages. */
export default function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="min-h-[70vh] bg-bg-base px-4 py-12 flex flex-col items-center justify-center">
      <div className="w-full max-w-md bg-bg-surface border border-white/10 p-6 sm:p-8">
        <p className="font-display text-sm tracking-[0.4em] text-accent mb-3">MOXIC</p>
        <h1 className="font-display text-2xl uppercase tracking-wider text-text-primary">{title}</h1>
        {subtitle && <div className="mt-2 text-sm text-text-muted">{subtitle}</div>}
        <div className="mt-6">{children}</div>
        {footer && <div className="mt-6 pt-5 border-t border-white/10 text-sm text-text-muted space-y-2">{footer}</div>}
      </div>
    </div>
  );
}
