"use client";

import { useState, useMemo, useRef, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { InfoModal } from "@/components/ui/InfoModal";

type ColumnFormat = "text" | "date" | "datetime" | "boolean";

interface Column<T> {
  key: keyof T | string;
  label: string;
  /** Serializable format so Server Components can pass columns safely. */
  format?: ColumnFormat;
}

export type RowActionIcon = "view" | "edit" | "link" | "unassign" | "delete";
export type RowAction<T> = { label: string; href?: string; onClick?: () => void; icon?: RowActionIcon };

function actionIconFromLabel(label: string): RowActionIcon | null {
  const l = label.toLowerCase();
  if (l.includes("view")) return "view";
  if (l.includes("delete")) return "delete";
  if (l.includes("unassign")) return "unassign";
  if (l.includes("assign") || l.includes("replace") || l.includes("edit")) return "link";
  return "view";
}

const IconEllipsis = () => (
  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 16 16" aria-hidden>
    <circle cx="4" cy="8" r="1.5" />
    <circle cx="8" cy="8" r="1.5" />
    <circle cx="12" cy="8" r="1.5" />
  </svg>
);
const IconView = () => (
  <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
);
const IconLink = () => (
  <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.172-1.172a4 4 0 105.656-5.656l-1.172-1.172a4 4 0 00-5.656 0" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.172 1.172a4 4 0 01-5.656 5.656l-1.172-1.172z" /></svg>
);
const IconUnassign = () => (
  <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
);
const IconDelete = () => (
  <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
);

function ActionIcon({ action }: { action: RowAction<Record<string, unknown>> }) {
  const icon = action.icon ?? actionIconFromLabel(action.label);
  switch (icon) {
    case "view": return <IconView />;
    case "link": return <IconLink />;
    case "unassign": return <IconUnassign />;
    case "delete": return <IconDelete />;
    case "edit": return <IconLink />;
    default: return <IconView />;
  }
}

function formatCellValue(value: unknown, format: ColumnFormat = "text"): string {
  if (value == null || value === "") return "—";
  switch (format) {
    case "date":
      return new Date(value as string | number).toLocaleDateString();
    case "datetime":
      return new Date(value as string | number).toLocaleString();
    case "boolean":
      return value ? "Yes" : "—";
    default:
      return String(value);
  }
}

function statusPillClass(status: string): string {
  const s = String(status).toLowerCase();
  if (s === "available") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (s === "assigned") return "bg-amber-100 text-amber-800 border-amber-200";
  if (s === "completed") return "bg-emerald-50 text-emerald-800 border-emerald-200";
  if (s.includes("rejected")) return "bg-red-50 text-red-800 border-red-200";
  if (s === "submitted") return "bg-indigo-50 text-indigo-800 border-indigo-200";
  if (s.includes("awaiting_signed_performa")) return "bg-amber-50 text-amber-900 border-amber-200";
  if (s.includes("performa_submitted")) return "bg-violet-50 text-violet-800 border-violet-200";
  if (s.includes("admin_approved")) return "bg-sky-50 text-sky-800 border-sky-200";
  if (s.includes("pm_approved")) return "bg-cyan-50 text-cyan-800 border-cyan-200";
  return "bg-zinc-100 text-zinc-700 border-zinc-200";
}

function rowMatchesSearch<T extends Record<string, unknown>>(
  row: T,
  columns: Column<T>[],
  searchTerm: string
): boolean {
  if (!searchTerm.trim()) return true;
  const q = searchTerm.trim().toLowerCase();
  return columns.some((col) => {
    const v = row[col.key as keyof T];
    const s = v != null && v !== "" ? String(v).toLowerCase() : "";
    return s.includes(q);
  });
}

interface DataTableProps<T extends Record<string, unknown>> {
  columns: Column<T>[];
  data: T[];
  keyField: keyof T;
  /** Base path for row links, e.g. "/vehicles/". Link becomes {hrefPrefix}{row[keyField]}. */
  hrefPrefix?: string;
  /** Row actions (View, Edit, Delete, etc.). When provided, an Actions dropdown is shown instead of a plain View link. */
  rowActions?: (row: T) => RowAction<T>[];
  /** When true, user can select one row; same actions are shown in a bar above the table. */
  selectable?: boolean;
  /** Label for the primary column used in "Selected: X" when selectable. Default: first column key. */
  selectionLabelKey?: keyof T | string;
  emptyMessage?: string;
  /** Show search bar. Default true. */
  searchable?: boolean;
  /** Placeholder for search input. */
  searchPlaceholder?: string;
  /** Column keys to show as filter dropdowns (unique values from data). */
  filterKeys?: (keyof T | string)[];
  /** Optional content rendered in the toolbar row (same line as search/filters), e.g. Import + Add buttons. */
  toolbarTrailing?: ReactNode;
  /** Page size options. Default [10, 25, 50, 100]. */
  pageSizeOptions?: number[];
  /** Default page size. Default 10. */
  defaultPageSize?: number;
  /** Multi-select checkboxes + optional bulk delete (POST JSON `{ ids: string[] }` to apiPath). */
  multiSelect?: boolean;
  bulkDelete?: {
    apiPath: string;
    /** e.g. "vehicles" for confirm copy */
    entityLabel: string;
    confirmTitle?: string;
  };
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyField,
  hrefPrefix,
  rowActions: rowActionsProp,
  selectable = false,
  selectionLabelKey,
  emptyMessage = "No records",
  searchable = true,
  searchPlaceholder = "Search table…",
  filterKeys = [],
  toolbarTrailing,
  pageSizeOptions = [10, 25, 50, 100],
  defaultPageSize = 10,
  multiSelect = false,
  bulkDelete,
}: DataTableProps<T>) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [openActionsKey, setOpenActionsKey] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<T | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ title: string; message: string; variant: "success" | "danger" } | null>(
    null
  );
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectableEffective = selectable && !multiSelect;

  const effectiveRowActions = useMemo((): ((row: T) => RowAction<T>[]) => {
    if (rowActionsProp) return rowActionsProp;
    if (hrefPrefix)
      return (row: T): RowAction<T>[] => [{ label: "View", href: `${hrefPrefix.endsWith("/") ? hrefPrefix : hrefPrefix + "/"}${row[keyField]}` }];
    return () => [];
  }, [rowActionsProp, hrefPrefix, keyField]);

  useEffect(() => {
    if (!openActionsKey) return;
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpenActionsKey(null);
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [openActionsKey]);

  const dataIdSet = useMemo(() => new Set(data.map((r) => String(r[keyField]))), [data, keyField]);
  useEffect(() => {
    setSelectedIds((prev) => new Set([...prev].filter((id) => dataIdSet.has(id))));
  }, [dataIdSet]);

  const filteredData = useMemo(() => {
    let result = data;
    if (searchTerm.trim()) {
      result = result.filter((row) => rowMatchesSearch(row, columns, searchTerm));
    }
    filterKeys.forEach((key) => {
      const v = filterValues[key as string];
      if (v && v !== "__all__") {
        result = result.filter((row) => String(row[key as keyof T] ?? "") === v);
      }
    });
    return result;
  }, [data, searchTerm, filterValues, columns, filterKeys]);

  const filterOptions = useMemo(() => {
    const opts: Record<string, { value: string; label: string }[]> = {};
    filterKeys.forEach((key) => {
      const uniq = new Set<string>();
      data.forEach((row) => {
        const val = row[key as keyof T];
        const s = val != null && val !== "" ? String(val) : "—";
        uniq.add(s);
      });
      opts[key as string] = [{ value: "__all__", label: "All" }, ...Array.from(uniq).sort().map((v) => ({ value: v, label: v }))];
    });
    return opts;
  }, [data, filterKeys]);

  const totalFiltered = filteredData.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const startItem = totalFiltered === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalFiltered);
  const showActionsColumn = hrefPrefix != null || rowActionsProp != null;
  const labelKey = selectionLabelKey ?? columns[0]?.key;
  const colSpan =
    columns.length + (showActionsColumn ? 1 : 0) + (multiSelect ? 1 : 0);

  const paginatedIds = paginatedData.map((r) => String(r[keyField]));
  const allPageSelected =
    paginatedIds.length > 0 && paginatedIds.every((id) => selectedIds.has(id));
  const togglePageSelection = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) paginatedIds.forEach((id) => next.delete(id));
      else paginatedIds.forEach((id) => next.add(id));
      return next;
    });
  };
  const toggleOneId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  async function runBulkDelete() {
    if (!bulkDelete || selectedIds.size === 0) return;
    setBulkDeleting(true);
    const ids = [...selectedIds];
    try {
      const res = await fetch(bulkDelete.apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const dataJson = await res.json().catch(() => ({}));
      setBulkDeleting(false);
      setBulkConfirmOpen(false);
      if (!res.ok) {
        setBulkResult({
          title: "Could not delete",
          message: typeof dataJson.message === "string" ? dataJson.message : "Bulk delete failed.",
          variant: "danger",
        });
        return;
      }
      const failed = (dataJson.failed ?? []) as { id: string; message: string }[];
      const deletedCount = typeof dataJson.deletedCount === "number" ? dataJson.deletedCount : ids.length;
      const failMsg =
        failed.length > 0
          ? `Removed ${deletedCount} of ${ids.length}.\n\nSome rows failed:\n${failed
              .slice(0, 8)
              .map((f) => `• ${f.message}`)
              .join("\n")}${failed.length > 8 ? `\n… and ${failed.length - 8} more` : ""}`
          : `Successfully removed ${deletedCount} ${bulkDelete.entityLabel}.`;
      setBulkResult({
        title: failed.length > 0 ? "Deletion finished with errors" : "Deletion complete",
        message: failMsg,
        variant: "success",
      });
      setSelectedIds(new Set());
      router.refresh();
    } catch {
      setBulkDeleting(false);
      setBulkResult({ title: "Could not delete", message: "Network or server error. Try again.", variant: "danger" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {searchable && (
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            placeholder={searchPlaceholder}
            className="w-full min-w-[12rem] max-w-sm rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:w-72"
            aria-label="Search table"
          />
        )}
        {filterKeys.length > 0 && filterKeys.map((key) => (
          <div key={key as string} className="flex items-center gap-2">
            <label className="text-sm text-zinc-600">
              {columns.find((c) => c.key === key)?.label ?? String(key)}:
            </label>
            <select
              value={filterValues[key as string] ?? "__all__"}
              onChange={(e) => { setFilterValues((prev) => ({ ...prev, [key as string]: e.target.value })); setPage(1); }}
              className="rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              {(filterOptions[key as string] ?? []).map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        ))}
        {toolbarTrailing != null ? <div className="ml-auto flex flex-wrap items-center gap-2">{toolbarTrailing}</div> : null}
        {multiSelect && selectedIds.size > 0 && bulkDelete && (
          <div className="flex w-full flex-wrap items-center gap-2 border-t border-zinc-200 pt-3 sm:w-auto sm:border-0 sm:pt-0">
            <span className="text-sm font-medium text-zinc-700">{selectedIds.size} selected</span>
            <button
              type="button"
              onClick={() => setBulkConfirmOpen(true)}
              className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
            >
              Delete selected
            </button>
            <button type="button" onClick={() => setSelectedIds(new Set())} className="text-sm text-zinc-500 hover:text-zinc-800">
              Clear selection
            </button>
          </div>
        )}
        {selectableEffective && selectedRow && effectiveRowActions(selectedRow).length > 0 && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-zinc-700">
              Selected: {String(selectedRow[labelKey as keyof T] ?? selectedRow[keyField])}
            </span>
            {effectiveRowActions(selectedRow).map((action, i) => (
              action.href ? (
                <Link key={i} href={action.href} className="flex items-center gap-2 rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                  <ActionIcon action={action as RowAction<Record<string, unknown>>} />
                  {action.label}
                </Link>
              ) : action.onClick ? (
                <button key={i} type="button" onClick={action.onClick} className="flex items-center gap-2 rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 hover:border-red-200 hover:text-red-700">
                  <ActionIcon action={action as RowAction<Record<string, unknown>>} />
                  {action.label}
                </button>
              ) : null
            ))}
            <button type="button" onClick={() => setSelectedRow(null)} className="text-sm text-zinc-500 hover:text-zinc-700">Clear</button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200/90 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-gradient-to-b from-zinc-50 to-zinc-50/80">
              {multiSelect && (
                <th className="w-10 px-2 py-3">
                  <input
                    type="checkbox"
                    className="rounded border-zinc-300"
                    checked={allPageSelected}
                    onChange={togglePageSelection}
                    aria-label="Select all on this page"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th key={col.key as string} className="px-4 py-3 text-left font-medium text-zinc-700">
                  {col.label}
                </th>
              ))}
              {showActionsColumn && <th className="px-4 py-3 text-left font-medium text-zinc-700">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-8 text-center text-zinc-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row) => {
                const key = String(row[keyField]);
                const actions = effectiveRowActions(row);
                const isSelected = selectableEffective && selectedRow && String(selectedRow[keyField]) === key;
                const checked = selectedIds.has(key);
                return (
                  <tr
                    key={key}
                    className={`border-b border-zinc-100 hover:bg-zinc-50 ${isSelected ? "bg-zinc-100" : ""} ${selectableEffective ? "cursor-pointer" : ""}`}
                    onClick={selectableEffective ? () => setSelectedRow(isSelected ? null : row) : undefined}
                  >
                    {multiSelect && (
                      <td className="w-10 px-2 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="rounded border-zinc-300"
                          checked={checked}
                          onChange={() => toggleOneId(key)}
                          aria-label="Select row"
                        />
                      </td>
                    )}
                    {columns.map((col) => {
                      const val = row[col.key as keyof T];
                      const formatted = formatCellValue(val, col.format);
                      const isStatus = (col.key as string) === "status";
                      return (
                        <td key={col.key as string} className="px-4 py-3 text-zinc-900">
                          {isStatus && formatted !== "—" ? (
                            <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusPillClass(String(val))}`}>
                              {formatted}
                            </span>
                          ) : (
                            formatted
                          )}
                        </td>
                      );
                    })}
                    {showActionsColumn && (
                      <td className="px-4 py-3 text-zinc-900" onClick={(e) => e.stopPropagation()}>
                        <div className="relative inline-block" ref={openActionsKey === key ? dropdownRef : undefined}>
                          <button
                            type="button"
                            onClick={() => setOpenActionsKey(openActionsKey === key ? null : key)}
                            className="flex items-center justify-center rounded text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 p-1.5"
                            aria-label="Actions"
                          >
                            <IconEllipsis />
                          </button>
                          {openActionsKey === key && (
                            <div className="absolute right-0 top-full z-10 mt-1 min-w-[160px] rounded border border-zinc-200 bg-white py-1 shadow-lg">
                              {actions.map((action, i) => (
                                action.href ? (
                                  <Link key={i} href={action.href} className="flex items-center gap-2 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50" onClick={() => setOpenActionsKey(null)}>
                                    <ActionIcon action={action as RowAction<Record<string, unknown>>} />
                                    {action.label}
                                  </Link>
                                ) : action.onClick ? (
                                  <button key={i} type="button" className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50" onClick={() => { action.onClick?.(); setOpenActionsKey(null); }}>
                                    <ActionIcon action={action as RowAction<Record<string, unknown>>} />
                                    {action.label}
                                  </button>
                                ) : null
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-600">
        <span>
          Showing {startItem}–{endItem} of {totalFiltered}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="rounded border border-zinc-300 px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-50"
          >
            Previous
          </button>
          <span className="px-2">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="rounded border border-zinc-300 px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-50"
          >
            Next
          </button>
        </div>
      </div>

      {bulkDelete && (
        <ConfirmModal
          open={bulkConfirmOpen}
          title={bulkDelete.confirmTitle ?? `Delete ${bulkDelete.entityLabel}`}
          message={`Delete ${selectedIds.size} selected ${bulkDelete.entityLabel}? This cannot be undone.`}
          confirmLabel="Yes, delete"
          cancelLabel="Cancel"
          variant="danger"
          loading={bulkDeleting}
          onConfirm={() => void runBulkDelete()}
          onCancel={() => !bulkDeleting && setBulkConfirmOpen(false)}
        />
      )}

      <InfoModal
        open={bulkResult !== null}
        title={bulkResult?.title ?? ""}
        message={bulkResult?.message ?? ""}
        variant={bulkResult?.variant === "danger" ? "danger" : "success"}
        buttonLabel="OK"
        onClose={() => setBulkResult(null)}
      />
    </div>
  );
}
