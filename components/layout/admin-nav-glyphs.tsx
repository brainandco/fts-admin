import type { SVGProps } from "react";

type GlyphProps = SVGProps<SVGSVGElement>;

const stroke = { stroke: "currentColor", fill: "none" as const, strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

/** Compact outline icons for collapsed admin sidebar (Heroicons-style, currentColor). */
export function AdminNavGlyph({ href, className }: { href: string; className?: string }) {
  const p = { ...stroke, className: `h-5 w-5 shrink-0 ${className ?? ""}` } satisfies GlyphProps;
  switch (href) {
    case "/dashboard":
      return (
        <svg viewBox="0 0 24 24" aria-hidden {...p}>
          <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z" />
        </svg>
      );
    case "/leave":
      return (
        <svg viewBox="0 0 24 24" aria-hidden {...p}>
          <path d="M8 7V3m8 4V3M5 11h14M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z" />
        </svg>
      );
    case "/settings/profile":
      return (
        <svg viewBox="0 0 24 24" aria-hidden {...p}>
          <path d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.118a7.5 7.5 0 0 1 15 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.5-1.632Z" />
        </svg>
      );
    case "/regions":
      return (
        <svg viewBox="0 0 24 24" aria-hidden {...p}>
          <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );
    case "/projects":
      return (
        <svg viewBox="0 0 24 24" aria-hidden {...p}>
          <path d="M3 7.5V6a3 3 0 0 1 3-3h9l5 5v13a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7.5Z" />
          <path d="M14 3v5h5" />
        </svg>
      );
    case "/teams":
      return (
        <svg viewBox="0 0 24 24" aria-hidden {...p}>
          <path d="M18 18.72a9 9 0 1 0-12 0" />
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      );
    case "/users":
      return (
        <svg viewBox="0 0 24 24" aria-hidden {...p}>
          <path d="M15 19.128a9 9 0 1 0-6 0M12 6v6l3 3" />
        </svg>
      );
    case "/people":
      return (
        <svg viewBox="0 0 24 24" aria-hidden {...p}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm11-4v6m-3-3h6" />
        </svg>
      );
    case "/employees":
      return (
        <svg viewBox="0 0 24 24" aria-hidden {...p}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M12 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
        </svg>
      );
    case "/employees/region-project-assignments":
      return (
        <svg viewBox="0 0 24 24" aria-hidden {...p}>
          <path d="M4 6h16M4 12h10M4 18h16" />
          <circle cx="18" cy="12" r="2" />
        </svg>
      );
    case "/delegate":
      return (
        <svg viewBox="0 0 24 24" aria-hidden {...p}>
          <path d="M16 3h5v5M4 20 21 13l-7-7 5-5L16 8l-5 5-7-7" />
        </svg>
      );
    case "/tasks":
      return (
        <svg viewBox="0 0 24 24" aria-hidden {...p}>
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9h6m-6 4h6" />
        </svg>
      );
    case "/approvals":
      return (
        <svg viewBox="0 0 24 24" aria-hidden {...p}>
          <path d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      );
    case "/employee-requests":
      return (
        <svg viewBox="0 0 24 24" aria-hidden {...p}>
          <path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 18H9a2.25 2.25 0 0 1-2.25-2.25v-9.75A2.25 2.25 0 0 1 9 3h6.75A2.25 2.25 0 0 1 18 5.25v9.75A2.25 2.25 0 0 1 15.75 18h-1.5m-9-12h9.75" />
        </svg>
      );
    case "/notifications":
      return (
        <svg viewBox="0 0 24 24" aria-hidden {...p}>
          <path d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
      );
    case "/assets":
      return (
        <svg viewBox="0 0 24 24" aria-hidden {...p}>
          <path d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
        </svg>
      );
    case "/sims":
      return (
        <svg viewBox="0 0 24 24" aria-hidden {...p}>
          <rect x="7" y="2" width="10" height="20" rx="2" />
          <path d="M11 18h2" />
        </svg>
      );
    case "/assets/returns":
      return (
        <svg viewBox="0 0 24 24" aria-hidden {...p}>
          <path d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 6 6v6" />
        </svg>
      );
    case "/receipt-confirmations":
      return (
        <svg viewBox="0 0 24 24" aria-hidden {...p}>
          <path d="M9 14l2 2 4-4m-7 9h10a2 2 0 0 0 2-2V7l-4-4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z" />
        </svg>
      );
    case "/vehicles":
      return (
        <svg viewBox="0 0 24 24" aria-hidden {...p}>
          <path d="M8 17h8m-8-4h8m-4-9v4m-5 9h10l1-5H4l1 5Z" />
        </svg>
      );
    case "/exports":
      return (
        <svg viewBox="0 0 24 24" aria-hidden {...p}>
          <path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5 7.5 12m4.5-9H12" />
        </svg>
      );
    case "/company-documents":
      return (
        <svg viewBox="0 0 24 24" aria-hidden {...p}>
          <path d="M19.5 14.25V11.25A2.25 2.25 0 0 0 17.25 9h-4.5A2.25 2.25 0 0 0 10.5 11.25v3m9-.75-3-3m0 0-3 3m3-3v12.75A2.25 2.25 0 0 1 15 21H5.25a2.25 2.25 0 0 1-2.25-2.25V4.5A2.25 2.25 0 0 1 5.25 2.25h6.75L19.5 9.75Z" />
        </svg>
      );
    case "/audit":
      return (
        <svg viewBox="0 0 24 24" aria-hidden {...p}>
          <path d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      );
    case "/settings/roles":
      return (
        <svg viewBox="0 0 24 24" aria-hidden {...p}>
          <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.37.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z" />
          <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden {...p}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41" />
        </svg>
      );
  }
}

export function SidebarSignOutGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`h-5 w-5 shrink-0 ${className ?? ""}`} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M18 12H9m0 0 3-3m-3 3 3 3" />
    </svg>
  );
}

export function SidebarCollapseGlyph({ collapsed, className }: { collapsed: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`h-5 w-5 shrink-0 ${className ?? ""}`} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      {collapsed ? <path d="M9 5l7 7-7 7" /> : <path d="M15 5l-7 7 7 7" />}
    </svg>
  );
}
