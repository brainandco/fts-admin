export default function DashboardLoading() {
  return (
    <div className="space-y-4 p-1" aria-busy="true" aria-label="Loading page">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-zinc-200/80" />
      <div className="h-4 w-full max-w-xl animate-pulse rounded bg-zinc-100" />
      <div className="mt-6 space-y-3">
        <div className="h-24 animate-pulse rounded-xl bg-zinc-100" />
        <div className="h-24 animate-pulse rounded-xl bg-zinc-100" />
        <div className="h-64 animate-pulse rounded-xl bg-zinc-100" />
      </div>
    </div>
  );
}
