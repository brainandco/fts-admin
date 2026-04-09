import Link from "next/link";

export type AssetPoolQuantityBreakdown = {
  total: number;
  unassigned: number;
  assigned: number;
  pending_return: number;
  under_maintenance: number;
  damaged: number;
};

/**
 * Same visual pattern as "Quantity by type" on the main Assets page — used for per-company breakdown on Laptop/Mobile.
 */
export function AssetPoolQuantityCard({
  title,
  titleHref,
  counts,
  footerHref,
  footerLabel,
}: {
  title: string;
  /** When set, title is a link (e.g. type page). */
  titleHref?: string;
  counts: AssetPoolQuantityBreakdown;
  footerHref?: string;
  footerLabel?: string;
}) {
  const { total, unassigned, assigned, pending_return, under_maintenance, damaged } = counts;

  const titleNode = titleHref ? (
    <Link
      href={titleHref}
      className="font-semibold text-zinc-900 underline-offset-2 hover:text-indigo-700 hover:underline"
    >
      {title}
    </Link>
  ) : (
    <span className="font-semibold text-zinc-900">{title}</span>
  );

  return (
    <div className="rounded-xl border border-zinc-200 bg-gradient-to-b from-white to-zinc-50 p-4">
      <div className="flex items-start justify-between gap-3">
        {titleNode}
        <span className="rounded-md bg-zinc-900 px-2 py-0.5 text-xs font-semibold text-white">{total}</span>
      </div>

      <div className="mt-3 space-y-2">
        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium text-emerald-700">Available</span>
            <span className="text-zinc-600">{unassigned}</span>
          </div>
          <div className="h-1.5 rounded bg-zinc-100">
            <div
              className="h-1.5 rounded bg-emerald-500"
              style={{ width: `${total ? (unassigned / total) * 100 : 0}%` }}
            />
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium text-amber-700">Assigned</span>
            <span className="text-zinc-600">{assigned}</span>
          </div>
          <div className="h-1.5 rounded bg-zinc-100">
            <div
              className="h-1.5 rounded bg-amber-500"
              style={{ width: `${total ? (assigned / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {pending_return > 0 ? (
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
            Pending return: {pending_return}
          </span>
        ) : null}
        {under_maintenance > 0 ? (
          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
            Maintenance: {under_maintenance}
          </span>
        ) : null}
        {damaged > 0 ? (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
            Damaged: {damaged}
          </span>
        ) : null}
        {pending_return === 0 && under_maintenance === 0 && damaged === 0 ? (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">No return flags</span>
        ) : null}
      </div>

      {footerHref && footerLabel ? (
        <div className="mt-3">
          <Link
            href={footerHref}
            className="inline-flex items-center rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            {footerLabel}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
