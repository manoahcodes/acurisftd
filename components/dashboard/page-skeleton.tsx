/** Placeholder shown while per-request data streams in. */
export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse">
      <div className="h-4 w-40 rounded bg-line" />
      <div className="mt-4 h-10 w-80 rounded bg-line" />
      <div className="mt-3 h-5 w-64 rounded bg-line" />
      <div className="mt-2 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-36 rounded-2xl border border-line bg-surface" />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-72 rounded-2xl border border-line bg-surface" />
        ))}
      </div>
    </div>
  );
}