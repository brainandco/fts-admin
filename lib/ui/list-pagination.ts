export const DEFAULT_PAGE_SIZE = 25;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export type ListPagination = {
  page: number;
  pageSize: number;
  from: number;
  to: number;
};

export function parseListPagination(
  searchParams: Record<string, string | string[] | undefined> | URLSearchParams,
  defaults?: { pageSize?: number }
): ListPagination {
  const get = (key: string): string => {
    if (searchParams instanceof URLSearchParams) return searchParams.get(key) ?? "";
    const v = searchParams[key];
    return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
  };

  const rawPage = Number.parseInt(get("page"), 10);
  const rawSize = Number.parseInt(get("pageSize"), 10);
  const defaultSize = defaults?.pageSize ?? DEFAULT_PAGE_SIZE;
  const pageSize = PAGE_SIZE_OPTIONS.includes(rawSize as (typeof PAGE_SIZE_OPTIONS)[number])
    ? rawSize
    : defaultSize;
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const from = (page - 1) * pageSize;
  return { page, pageSize, from, to: from + pageSize - 1 };
}

export function totalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / pageSize));
}

export function clampPage(page: number, total: number, pageSize: number): number {
  const max = totalPages(total, pageSize);
  return Math.min(Math.max(1, page), max);
}

export function parseSearchQuery(
  searchParams: Record<string, string | string[] | undefined> | URLSearchParams,
  key = "q"
): string {
  if (searchParams instanceof URLSearchParams) return (searchParams.get(key) ?? "").trim();
  const v = searchParams[key];
  return (Array.isArray(v) ? (v[0] ?? "") : (v ?? "")).trim();
}
