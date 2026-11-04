import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useGames } from "../../hooks/useGames";

import { t } from "../../lib/i18n";
interface AuthShellProps {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Shared frame for login / register / verify / forgot-password.
 * Desktop: the catalogue's real covers on the left, the form on the right. Phone: a strip of covers above the form.
 */
export default function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  const { data } = useGames({ pageSize: 9 });
  const covers = (data?.items ?? []).map((g) => g.coverImageUrl).filter(Boolean).slice(0, 9) as string[];

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* Covers: the store itself, not a stock picture */}
      <div className="relative hidden lg:block overflow-hidden bg-bg-surface border-r border-white/10" aria-hidden="true">
        <div className="absolute inset-0 grid grid-cols-3 gap-3 p-6 -rotate-6 scale-125 origin-center">
          {covers.map((src, i) => (
            <div key={i} className="aspect-[3/4] overflow-hidden bg-bg-elevated">
              <img src={src} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-bg-base via-bg-base/70 to-bg-base/20" />
        <div className="absolute inset-x-0 bottom-0 p-10">
          <Link to="/" className="font-display text-2xl text-accent">
            Moxic
          </Link>
          <p className="mt-3 font-display text-3xl font-bold text-text-primary max-w-sm leading-tight">{t("Game Xbox chính hãng, rẻ hơn Store")}</p>
        </div>
      </div>

      {/* Form */}
      <div className="flex flex-col">
        {covers.length > 0 && (
          <div className="lg:hidden flex gap-2 overflow-hidden px-4 pt-6" aria-hidden="true">
            {covers.slice(0, 5).map((src, i) => (
              <img key={i} src={src} alt="" className="w-[calc((100%-2rem)/5)] aspect-[3/4] object-cover opacity-80" />
            ))}
          </div>
        )}
        <div className="flex-1 flex items-start lg:items-center justify-center px-4 py-8 sm:py-12">
          <div className="w-full max-w-[420px]">
            <h1 className="font-display text-3xl font-bold text-text-primary">{title}</h1>
            {subtitle && <div className="mt-2 text-text-secondary">{subtitle}</div>}
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-8 pt-6 border-t border-white/10 text-sm text-text-secondary space-y-2">{footer}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
