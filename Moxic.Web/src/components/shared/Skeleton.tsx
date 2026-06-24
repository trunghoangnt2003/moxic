export function CardSkeleton() {
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
