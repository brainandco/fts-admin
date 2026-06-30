/** Sticky right Actions column — use on th/td in horizontally scrollable tables. */
export const stickyActionsThClass =
  "sticky right-0 z-20 bg-zinc-50 px-4 py-3 text-left font-medium text-zinc-700 shadow-[-6px_0_10px_-6px_rgba(0,0,0,0.12)]";

export const stickyActionsThClassGradient =
  "sticky right-0 z-20 bg-gradient-to-b from-zinc-50 to-zinc-50/80 px-4 py-3 text-left font-medium text-zinc-700 shadow-[-6px_0_10px_-6px_rgba(0,0,0,0.12)]";

export const stickyActionsThClassRight = `${stickyActionsThClass} text-right`;
export const stickyActionsThClassGradientRight = `${stickyActionsThClassGradient} text-right`;

export function stickyActionsTdClass(opts?: {
  selected?: boolean;
  bgClass?: string;
  align?: "left" | "right";
  compact?: boolean;
}): string {
  const pad = opts?.compact ? "px-3 py-2" : "px-4 py-3";
  const bg =
    opts?.bgClass ??
    (opts?.selected ? "bg-zinc-100 group-hover:bg-zinc-100" : "bg-white group-hover:bg-zinc-50");
  const align = opts?.align === "right" ? "text-right" : "";
  return `sticky right-0 z-10 ${bg} ${pad} text-zinc-900 shadow-[-6px_0_10px_-6px_rgba(0,0,0,0.08)] ${align}`.trim();
}
