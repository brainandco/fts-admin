"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type DocRow = {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_name: string | null;
  mime_type: string | null;
  is_leave_performa_template: boolean;
  created_at: string;
};

export function CompanyDocumentsClient({ initialDocs }: { initialDocs: DocRow[] }) {
  const router = useRouter();
  const [docs, setDocs] = useState(initialDocs);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [leaveTemplate, setLeaveTemplate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const res = await fetch("/api/company-documents");
    const data = (await res.json().catch(() => ({}))) as { documents?: DocRow[] };
    if (data.documents) setDocs(data.documents);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!title.trim() || !file) {
      setError("Title and file are required.");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("title", title.trim());
      if (description.trim()) fd.set("description", description.trim());
      fd.set("file", file);
      if (leaveTemplate) fd.set("is_leave_performa_template", "true");
      const res = await fetch("/api/company-documents", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.message === "string" ? data.message : "Upload failed");
        return;
      }
      setTitle("");
      setDescription("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setLeaveTemplate(false);
      await refresh();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removeDoc(id: string) {
    if (!confirm("Delete this document?")) return;
    setDeletingId(id);
    setError("");
    try {
      const res = await fetch(`/api/company-documents/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.message === "string" ? data.message : "Delete failed");
        return;
      }
      await refresh();
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-10">
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Upload document</h2>
        <p className="mt-1 text-sm text-zinc-600">
          PDFs and other files upload to the same storage bucket as resource photos. For leave performas, use a PDF with
          real AcroForm fields (not only visible labels). Mark the template below; exact field names are in the help box.
        </p>
        <form onSubmit={onSubmit} className="mt-4 max-w-xl space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <span className="mb-1 block text-sm font-medium text-zinc-700">File</span>
            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-medium text-indigo-900 shadow-sm transition hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
              >
                <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                Choose file
              </button>
              <span className="min-w-0 flex-1 truncate text-sm text-zinc-600" title={file?.name ?? undefined}>
                {file ? file.name : "No file chosen"}
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">Any type (PDF, Word, etc.), up to 50MB.</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-800">
            <input type="checkbox" checked={leaveTemplate} onChange={(e) => setLeaveTemplate(e.target.checked)} />
            Use this PDF as the <span className="font-medium">leave request performa</span> template (only one active)
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {busy ? "Uploading…" : "Upload"}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-6">
        <h3 className="text-sm font-semibold text-amber-950">PDF AcroForm field names (text fields)</h3>
        <p className="mt-2 text-xs text-amber-950/90">
          <strong>Labels on the page (English/Arabic) are not enough.</strong> Auto-fill uses each field&apos;s internal{" "}
          <strong>name</strong> in the PDF you upload here. In Adobe Acrobat: Tools → Prepare Form → double-click a field →
          set <strong>Name</strong> to one of the values below (or use the{" "}
          <code className="rounded bg-white/80 px-1">fts_*</code> names).{" "}
          <strong>Jotform &quot;Unique Name&quot;</strong> only applies inside Jotform; it is not used by this portal unless
          those same names exist as AcroForm field names in the uploaded PDF (export/download the PDF and check in Acrobat).
          Date pickers in Jotform often become several PDF fields (month/day/year) — for one filled date use a single{" "}
          <strong>text</strong> field named <code className="rounded bg-white/80 px-1">fts_requestor_date</code> in the
          template. If a name does not match, that box stays empty; the employee can still complete it by hand. Checkboxes
          and signature lines are never filled by the app.
        </p>
        <p className="mt-2 text-xs text-amber-950/90">
          The app tries each alias. Requestor:{" "}
          <code className="rounded bg-white/80 px-1">fts_requestor_full_name</code>,{" "}
          <code className="rounded bg-white/80 px-1">fts_requestor_date</code>,{" "}
          <code className="rounded bg-white/80 px-1">fts_requestor_iqama</code>,{" "}
          <code className="rounded bg-white/80 px-1">fts_requestor_job_title</code>,{" "}
          <code className="rounded bg-white/80 px-1">fts_requestor_project</code>,{" "}
          <code className="rounded bg-white/80 px-1">fts_requestor_region</code>,{" "}
          <code className="rounded bg-white/80 px-1">fts_leave_type</code>. Guarantor:{" "}
          <code className="rounded bg-white/80 px-1">fts_guarantor_name</code>,{" "}
          <code className="rounded bg-white/80 px-1">fts_guarantor_iqama</code>,{" "}
          <code className="rounded bg-white/80 px-1">fts_guarantor_phone</code>,{" "}
          <code className="rounded bg-white/80 px-1">fts_guarantor_email</code>,{" "}
          <code className="rounded bg-white/80 px-1">fts_guarantor_designation</code>,{" "}
          <code className="rounded bg-white/80 px-1">fts_guarantor_project</code>,{" "}
          <code className="rounded bg-white/80 px-1">fts_guarantor_region</code>. Leave:{" "}
          <code className="rounded bg-white/80 px-1">fts_leave_start_date</code>,{" "}
          <code className="rounded bg-white/80 px-1">fts_leave_end_date</code>,{" "}
          <code className="rounded bg-white/80 px-1">fts_leave_total_days</code>. Home country & signatures stay blank (
          <code className="rounded bg-white/80 px-1">fts_home_*</code>, <code className="rounded bg-white/80 px-1">fts_requestor_sig_*</code>,{" "}
          <code className="rounded bg-white/80 px-1">fts_guarantor_sig_*</code>).
        </p>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Library</h2>
        {!docs.length ? (
          <p className="mt-3 text-sm text-zinc-500">No documents yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-100">
            {docs.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-medium text-zinc-900">
                    {d.title}
                    {d.is_leave_performa_template ? (
                      <span className="ml-2 rounded bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800">
                        Leave template
                      </span>
                    ) : null}
                  </p>
                  {d.description ? <p className="text-sm text-zinc-600">{d.description}</p> : null}
                  <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline">
                    Open file
                  </a>
                  <p className="text-xs text-zinc-400">{new Date(d.created_at).toLocaleString()}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeDoc(d.id)}
                  disabled={deletingId === d.id}
                  className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  {deletingId === d.id ? "Deleting…" : "Delete"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
