"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type SoftwareRow = {
  id: string;
  title: string;
  description: string | null;
  file_name: string | null;
  mime_type: string | null;
  byte_size: number | null;
  upload_status: string;
  created_at: string;
};

function formatBytes(n: number | null): string {
  if (n == null || n < 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function SoftwareLibraryClient({ initialItems }: { initialItems: SoftwareRow[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const res = await fetch("/api/software-library");
    const data = (await res.json().catch(() => ({}))) as { items?: SoftwareRow[] };
    if (data.items) setItems(data.items);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setProgress(null);
    if (!title.trim() || !file) {
      setError("Title and file are required.");
      return;
    }
    setBusy(true);
    try {
      const presignRes = await fetch("/api/software-library/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          byteSize: file.size,
        }),
      });
      const presignData = (await presignRes.json().catch(() => ({}))) as {
        message?: string;
        id?: string;
        uploadUrl?: string;
        headers?: { "Content-Type"?: string };
      };
      if (!presignRes.ok) {
        setError(typeof presignData.message === "string" ? presignData.message : "Could not start upload");
        return;
      }
      if (!presignData.uploadUrl || !presignData.id) {
        setError("Invalid presign response");
        return;
      }

      const putHeaders: HeadersInit = {
        "Content-Type": presignData.headers?.["Content-Type"] || file.type || "application/octet-stream",
      };

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", presignData.uploadUrl!);
        for (const [k, v] of Object.entries(putHeaders)) {
          if (v) xhr.setRequestHeader(k, v);
        }
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed (${xhr.status})`));
        };
        xhr.onerror = () => reject(new Error("Network error during upload — check Wasabi bucket CORS for this origin."));
        xhr.send(file);
      });

      const completeRes = await fetch(`/api/software-library/${presignData.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ byteSize: file.size }),
      });
      const completeData = (await completeRes.json().catch(() => ({}))) as { message?: string };
      if (!completeRes.ok) {
        setError(typeof completeData.message === "string" ? completeData.message : "Upload finished but verification failed");
        await refresh();
        return;
      }

      setTitle("");
      setDescription("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setProgress(null);
      await refresh();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function removeItem(id: string) {
    if (!confirm("Delete this entry and remove the file from storage?")) return;
    setDeletingId(id);
    setError("");
    try {
      const res = await fetch(`/api/software-library/${id}`, { method: "DELETE" });
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
        <h2 className="text-lg font-semibold text-zinc-900">Upload software</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Metadata is saved in Supabase; the file is uploaded directly to your Wasabi bucket using a presigned URL.
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
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              >
                Choose file
              </button>
              <span className="text-sm text-zinc-600">{file ? `${file.name} (${formatBytes(file.size)})` : "No file selected"}</span>
            </div>
          </div>
          {progress != null && (
            <div className="text-sm text-teal-800">
              Uploading… {progress}%
              <div className="mt-1 h-2 w-full max-w-md overflow-hidden rounded bg-zinc-200">
                <div className="h-full bg-teal-600 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="fts-btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {busy ? "Uploading…" : "Upload to library"}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Library</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-600">
                <th className="py-2 pr-4 font-medium">Title</th>
                <th className="py-2 pr-4 font-medium">File</th>
                <th className="py-2 pr-4 font-medium">Size</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Added</th>
                <th className="py-2 font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-500">
                    No entries yet.
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.id} className="border-b border-zinc-100">
                    <td className="py-3 pr-4 font-medium text-zinc-900">{row.title}</td>
                    <td className="py-3 pr-4 text-zinc-700">{row.file_name ?? "—"}</td>
                    <td className="py-3 pr-4 text-zinc-600">{formatBytes(row.byte_size)}</td>
                    <td className="py-3 pr-4">
                      <span
                        className={
                          row.upload_status === "active"
                            ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800"
                            : row.upload_status === "pending"
                              ? "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900"
                              : "rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-800"
                        }
                      >
                        {row.upload_status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-zinc-600">{new Date(row.created_at).toLocaleString()}</td>
                    <td className="py-3">
                      <button
                        type="button"
                        onClick={() => removeItem(row.id)}
                        disabled={deletingId === row.id}
                        className="text-sm text-rose-700 hover:underline disabled:opacity-50"
                      >
                        {deletingId === row.id ? "…" : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
