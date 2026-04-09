"use client";

import { useState } from "react";
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
          Any file type. For leave performas, upload a PDF with AcroForm text fields. Mark it as the template below; field
          names are listed in the help box.
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
            <label className="mb-1 block text-sm font-medium text-zinc-700">File</label>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
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
          Create matching field names in your PDF. The app tries each alias. Requestor:{" "}
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
