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
    <div className="min-h-[70vh] bg-[#1a1714] px-4 py-12 flex flex-col items-center justify-center">
      <div className="w-full max-w-md bg-[#252019] border border-[#3d352a] p-6 sm:p-8">
        <p className="font-display text-sm tracking-[0.4em] text-[#c9a96e] mb-3">MOXIC</p>
        <h1 className="font-display text-2xl uppercase tracking-wider text-[#ede6db]">{title}</h1>
        {subtitle && <div className="mt-2 text-sm text-[#7a6f63]">{subtitle}</div>}
        <div className="mt-6">{children}</div>
        {footer && <div className="mt-6 pt-5 border-t border-[#3d352a] text-sm text-[#7a6f63] space-y-2">{footer}</div>}
      </div>
    </div>
  );
}
