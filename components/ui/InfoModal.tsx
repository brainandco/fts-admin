"use client";

/** Single-action dialog for success / info (replaces window.alert for bulk operations). */
export function InfoModal({
  open,
  title,
  message,
  buttonLabel = "OK",
  variant = "default",
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  buttonLabel?: string;
  variant?: "default" | "success" | "danger";
  onClose: () => void;
}) {
  if (!open) return null;

  const btnClass =
    variant === "success"
      ? "rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
      : variant === "danger"
        ? "rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        : "rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="info-modal-title"
        aria-describedby="info-modal-desc"
      >
        <h3 id="info-modal-title" className="text-lg font-semibold text-zinc-900">
          {title}
        </h3>
        <p id="info-modal-desc" className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-600">
          {message}
        </p>
        <div className="mt-6 flex justify-end">
          <button type="button" onClick={onClose} className={btnClass}>
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
