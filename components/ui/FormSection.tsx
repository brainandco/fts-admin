"use client";

import type { ReactNode } from "react";

/** Section heading + optional description + fields (use inside FormCardSection or standalone). */
export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className ?? ""}>
      <header className="mb-4">
        <h3 className="text-base font-semibold tracking-tight text-slate-900">{title}</h3>
        {description ? (
          <div className="mt-1.5 text-sm leading-relaxed text-slate-600">{description}</div>
        ) : null}
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

type CalloutVariant = "info" | "warning" | "neutral";

export function FormCallout({
  variant = "info",
  title,
  children,
  className,
}: {
  variant?: CalloutVariant;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const styles: Record<CalloutVariant, string> = {
    info: "border-indigo-200 bg-indigo-50/95 text-indigo-950",
    warning: "border-amber-200 bg-amber-50 text-amber-950",
    neutral: "border-slate-200 bg-slate-50 text-slate-800",
  };
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${styles[variant]} ${className ?? ""}`}>
      {title ? <p className="font-medium">{title}</p> : null}
      <div
        className={
          title
            ? "mt-1.5 leading-relaxed [&_a]:font-medium [&_a]:text-indigo-700 [&_a]:underline hover:[&_a]:text-indigo-900"
            : "leading-relaxed [&_a]:font-medium [&_a]:text-indigo-700 [&_a]:underline hover:[&_a]:text-indigo-900"
        }
      >
        {children}
      </div>
    </div>
  );
}

/** Card shell for multi-section forms */
export function FormCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${className ?? ""}`}>
      {children}
    </div>
  );
}

/** Padded row inside FormCard; bottom border between sections */
export function FormCardSection({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`border-b border-slate-100 px-6 py-6 last:border-b-0 sm:px-8 ${className ?? ""}`}>{children}</div>
  );
}

/** Footer strip for primary/secondary actions */
export function FormActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/80 px-6 py-4 sm:px-8 ${className ?? ""}`}
    >
      {children}
    </div>
  );
}
