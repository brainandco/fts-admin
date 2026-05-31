export const ACTION_CATEGORY_LABELS: Record<string, string> = {
  auth: "Authentication",
  file: "Files",
  data: "Data",
  assignment: "Assignments",
  approval: "Approvals",
  export: "Exports",
  import: "Imports",
  system: "System",
  api: "API",
};

export const ACTION_CATEGORY_STYLES: Record<string, string> = {
  auth: "bg-violet-100 text-violet-800 ring-violet-200/80",
  file: "bg-sky-100 text-sky-800 ring-sky-200/80",
  data: "bg-emerald-100 text-emerald-800 ring-emerald-200/80",
  assignment: "bg-amber-100 text-amber-900 ring-amber-200/80",
  approval: "bg-rose-100 text-rose-800 ring-rose-200/80",
  export: "bg-indigo-100 text-indigo-800 ring-indigo-200/80",
  import: "bg-teal-100 text-teal-800 ring-teal-200/80",
  system: "bg-zinc-200 text-zinc-800 ring-zinc-300/80",
  api: "bg-slate-100 text-slate-700 ring-slate-200/80",
};

export const PORTAL_STYLES: Record<string, string> = {
  admin: "bg-zinc-900 text-white",
  employee: "bg-emerald-700 text-white",
};

export function actionBadgeClass(actionType: string): string {
  const a = actionType.toLowerCase();
  if (a.includes("reject")) return "bg-red-50 text-red-800 ring-red-200/60";
  if (a.includes("approve")) return "bg-emerald-50 text-emerald-800 ring-emerald-200/60";
  if (a.includes("create") || a.includes("insert") || a.includes("upload")) return "bg-sky-50 text-sky-800 ring-sky-200/60";
  if (a.includes("update") || a.includes("edit")) return "bg-amber-50 text-amber-900 ring-amber-200/60";
  if (a.includes("delete")) return "bg-zinc-200 text-zinc-800 ring-zinc-300/80";
  if (a.includes("download")) return "bg-indigo-50 text-indigo-800 ring-indigo-200/60";
  if (a.includes("login") || a.includes("logout")) return "bg-violet-50 text-violet-800 ring-violet-200/60";
  return "bg-zinc-100 text-zinc-700 ring-zinc-200/60";
}

export function formatActionLabel(actionType: string): string {
  return actionType.replace(/_/g, " ");
}
