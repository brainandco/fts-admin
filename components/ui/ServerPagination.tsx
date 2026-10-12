import Link from "next/link";
import { PAGE_SIZE_OPTIONS, totalPages } from "@/lib/ui/list-pagination";

function buildHref(
  pathname: string,
  current: Record<string, string>,
  patch: Record<string, string | null>
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...current, ...patch })) {
    if (v == null || v === "") continue;
    params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function ServerPagination({
  pathname,
  page,
  pageSize,
  total,
  query = {},
}: {
  pathname: string;
  page: number;
  pageSize: number;
  total: number;
  /** Extra query keys to preserve (e.g. q, status). */
  query?: Record<string, string>;
}) {
  const pages = totalPages(total, pageSize);
  const safePage = Math.min(Math.max(1, page), pages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);
  const base = { ...query, pageSize: String(pageSize) };

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4 text-sm text-zinc-600">
      <p>
        Showing <span className="font-medium text-zinc-900">{start}</span>–
        <span className="font-medium text-zinc-900">{end}</span> of{" "}
        <span className="font-medium text-zinc-900">{total}</span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-zinc-500">Per page</span>
        {PAGE_SIZE_OPTIONS.map((size) => (
          <Link
            key={size}
            href={buildHref(pathname, base, { page: "1", pageSize: String(size) })}
            className={`rounded-md px-2 py-1 text-xs font-medium ${
              size === pageSize ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
            }`}
          >
            {size}
          </Link>
        ))}
        <Link
          href={buildHref(pathname, base, { page: String(Math.max(1, safePage - 1)) })}
          aria-disabled={safePage <= 1}
          className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
            safePage <= 1
              ? "pointer-events-none border-zinc-100 text-zinc-300"
              : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
          }`}
        >
          Previous
        </Link>
        <span className="tabular-nums text-xs text-zinc-500">
          {safePage} / {pages}
        </span>
        <Link
          href={buildHref(pathname, base, { page: String(Math.min(pages, safePage + 1)) })}
          aria-disabled={safePage >= pages}
          className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
            safePage >= pages
              ? "pointer-events-none border-zinc-100 text-zinc-300"
              : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
          }`}
        >
          Next
        </Link>
      </div>
    </div>
  );
}

/** GET search box that keeps other query params. */
export function ServerSearchForm({
  pathname,
  q,
  placeholder = "Search…",
  preserve = {},
}: {
  pathname: string;
  q: string;
  placeholder?: string;
  preserve?: Record<string, string>;
}) {
  return (
    <form action={pathname} method="get" className="flex flex-wrap gap-2">
      {Object.entries(preserve).map(([k, v]) =>
        v ? <input key={k} type="hidden" name={k} value={v} /> : null
      )}
      <input type="hidden" name="page" value="1" />
      <input
        type="search"
        name="q"
        defaultValue={q}
        placeholder={placeholder}
        className="min-w-[200px] flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
      <button
        type="submit"
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
      >
        Search
      </button>
    </form>
  );
}
