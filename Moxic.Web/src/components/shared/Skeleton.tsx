
import { t } from "../../lib/i18n";export function CardSkeleton() {
  return (
    <div className="bg-bg-surface  border border-border overflow-hidden animate-pulse">
      <div className="aspect-[3/4] bg-bg-elevated" />
      <div className="p-3 space-y-2">
        <div className="h-4 bg-bg-elevated  w-3/4" />
        <div className="h-3 bg-bg-elevated  w-1/2" />
      </div>
    </div>
  );
}

export function HeroSkeleton() {
  return (
    <div className="w-full h-[480px] bg-bg-surface animate-pulse" />
  );
}

export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, i) => <CardSkeleton key={i} />)}
    </div>
  );
}

/** Game detail placeholder: hero, media, title/price column. */
export function GameDetailSkeleton() {
  return (
    <div aria-busy="true" aria-label={t("Đang tải")}>
      <div className="skeleton w-full h-[220px] md:h-[340px]" />
      <div className="max-w-7xl mx-auto px-4 -mt-16 relative grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="skeleton h-9 w-2/3" />
          <div className="skeleton h-4 w-1/3" />
          <div className="skeleton aspect-video w-full" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-14 w-24" />
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <div className="skeleton aspect-[3/4] w-full" />
          <div className="skeleton h-8 w-1/2" />
          <div className="skeleton h-12 w-full" />
          <div className="skeleton h-12 w-full" />
        </div>
      </div>
    </div>
  );
}

/** Home placeholder: hero banner + a row of cards. */
export function HomeSkeleton() {
  return (
    <div aria-busy="true" aria-label={t("Đang tải")}>
      <div className="skeleton w-full h-[360px] md:h-[480px]" />
      <div className="max-w-7xl mx-auto px-4 mt-8 space-y-4">
        <div className="skeleton h-6 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={i > 1 ? "hidden md:block" : ""}>
              <div className="skeleton aspect-[3/4]" />
              <div className="skeleton h-4 w-3/4 mt-2" />
              <div className="skeleton h-3 w-1/2 mt-1.5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Order detail placeholder. */
export function OrderSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-4" aria-busy="true" aria-label={t("Đang tải")}>
      <div className="skeleton h-5 w-40" />
      <div className="skeleton h-40 w-full" />
      <div className="skeleton h-24 w-full" />
      <div className="skeleton h-32 w-full" />
    </div>
  );
}
