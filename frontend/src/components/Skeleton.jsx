export default function Skeleton({ className = '' }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function SkeletonCards({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-4 h-7 w-28" />
          <Skeleton className="mt-3 h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonRows({ rows = 5 }) {
  return (
    <div className="space-y-3" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
