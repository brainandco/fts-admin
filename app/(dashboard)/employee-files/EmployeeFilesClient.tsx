"use client";

import { useCallback, useEffect, useState } from "react";

type Region = { id: string; name: string; code: string | null };
type Folder = {
  id: string;
  regionId: string;
  pathSegment: string;
  createdAt: string;
  regionName: string;
  regionCode: string | null;
};
type FileRow = {
  id: string;
  fileName: string;
  mimeType: string | null;
  byteSize: number | null;
  uploadStatus: string;
  createdAt: string;
  employeeName: string;
  employeeEmail: string | null;
};

type Assignee = { id: string; fullName: string; email: string | null };

function formatBytes(n: number | null): string {
  if (n == null || n < 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function EmployeeFilesClient({
  regions,
  initialFolders,
}: {
  regions: Region[];
  initialFolders: Folder[];
}) {
  const [folders, setFolders] = useState<Folder[]>(initialFolders);
  const [regionId, setRegionId] = useState<string>(initialFolders[0]?.regionId ?? "");
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [createRegionId, setCreateRegionId] = useState("");
  const [createPath, setCreatePath] = useState("");
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [uploadEmployeeId, setUploadEmployeeId] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);

  const loadFolders = useCallback(async () => {
    const res = await fetch("/api/employee-file-folders");
    const data = await res.json();
    if (!res.ok) throw new Error((data as { message?: string }).message || "Failed to load folders");
    const list = (data as { folders: Folder[] }).folders ?? [];
    setFolders(list);
    setRegionId((prev) => {
      if (list.length === 0) return "";
      if (list.some((f) => f.regionId === prev)) return prev;
      return list[0].regionId;
    });
  }, []);

  const loadFiles = useCallback(async (rid: string) => {
    if (!rid) {
      setFiles([]);
      return;
    }
    setFileLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/employee-files?regionId=${encodeURIComponent(rid)}`);
      const data = await res.json();
      if (!res.ok) throw new Error((data as { message?: string }).message || "Failed to list files");
      setFiles((data as { files: FileRow[] }).files ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setFileLoading(false);
    }
  }, []);

  useEffect(() => {
    if (regionId) void loadFiles(regionId);
  }, [regionId, loadFiles]);

  useEffect(() => {
    if (!regionId) {
      setAssignees([]);
      setUploadEmployeeId("");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/employee-files/region-employees?regionId=${encodeURIComponent(regionId)}`);
        const data = await res.json();
        if (!res.ok) throw new Error((data as { message?: string }).message || "Failed to load employees");
        const list = (data as { employees?: Assignee[] }).employees ?? [];
        if (!cancelled) {
          setAssignees(list);
          setUploadEmployeeId((prev) => (list.some((e) => e.id === prev) ? prev : list[0]?.id ?? ""));
        }
      } catch {
        if (!cancelled) setAssignees([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [regionId]);

  const regionsWithoutFolder = regions.filter((r) => !folders.some((f) => f.regionId === r.id));

  async function createFolder() {
    if (!createRegionId) {
      setError("Select a region");
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/employee-file-folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          regionId: createRegionId,
          pathSegment: createPath.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { message?: string }).message || "Create failed");
      setMessage("Region folder created.");
      setCreateRegionId("");
      setCreatePath("");
      await loadFolders();
      setRegionId((data as { folder?: { regionId: string } }).folder?.regionId ?? createRegionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function download(id: string) {
    setError("");
    const res = await fetch(`/api/employee-files/${id}/download`);
    const data = await res.json();
    if (!res.ok) {
      setError((data as { message?: string }).message || "Download failed");
      return;
    }
    const u = (data as { downloadUrl?: string }).downloadUrl;
    if (u) globalThis.open(u, "_blank", "noopener,noreferrer");
  }

  const selectedFolder = folders.find((f) => f.regionId === regionId);

  async function adminUpload(f: File) {
    if (!regionId || !uploadEmployeeId) {
      setError("Select a region and employee.");
      return;
    }
    if (!f.size) {
      setError("Empty file");
      return;
    }
    setUploadBusy(true);
    setError("");
    setMessage("");
    try {
      const pres = await fetch("/api/employee-files/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          regionId,
          employeeId: uploadEmployeeId,
          fileName: f.name,
          contentType: f.type || "application/octet-stream",
          byteSize: f.size,
        }),
      });
      const pr = await pres.json();
      if (!pres.ok) throw new Error((pr as { message?: string }).message || "Presign failed");
      const h = (pr as { headers?: { "Content-Type"?: string } }).headers;
      const put = await fetch((pr as { uploadUrl: string }).uploadUrl, {
        method: "PUT",
        body: f,
        headers: { "Content-Type": h?.["Content-Type"] || f.type || "application/octet-stream" },
      });
      if (!put.ok) throw new Error("Upload to storage failed");
      const comp = await fetch(`/api/employee-files/${(pr as { id: string }).id}/complete`, { method: "POST" });
      const cj = await comp.json();
      if (!comp.ok) throw new Error((cj as { message?: string }).message || "Complete failed");
      setMessage("File uploaded.");
      await loadFiles(regionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadBusy(false);
    }
  }

  async function deleteFile(fileId: string, label: string) {
    if (!confirm(`Delete "${label}"? This cannot be undone.`)) return;
    setUploadBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/employee-files/${fileId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { message?: string }).message || "Delete failed");
      setMessage("File deleted.");
      if (regionId) await loadFiles(regionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setUploadBusy(false);
    }
  }

  async function deleteRegionFolder() {
    if (!selectedFolder) return;
    if (
      !confirm(
        `Delete the entire folder for ${selectedFolder.regionName} (${selectedFolder.pathSegment})?\n\n` +
          "This permanently removes all files in that region for every employee, deletes the storage prefix, and " +
          "removes the region slot so you can create it again later. This cannot be undone."
      )
    ) {
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/employee-file-folders/${selectedFolder.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { message?: string }).message || "Delete failed");
      setMessage("Region folder deleted.");
      setFiles([]);
      await loadFolders();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Create region folder</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Each region can have one folder (S3 prefix under <code className="rounded bg-zinc-100 px-1">employee-files/…</code>).
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">Region</label>
            <select
              className="rounded border border-zinc-300 bg-white px-2 py-2 text-sm"
              value={createRegionId}
              onChange={(e) => setCreateRegionId(e.target.value)}
            >
              <option value="">Select…</option>
              {regionsWithoutFolder.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.code ? ` · ${r.code}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">Path segment (optional)</label>
            <input
              className="w-56 rounded border border-zinc-300 bg-white px-2 py-2 text-sm"
              value={createPath}
              onChange={(e) => setCreatePath(e.target.value)}
              placeholder="e.g. east-est"
            />
          </div>
          <button
            type="button"
            onClick={createFolder}
            disabled={loading || regionsWithoutFolder.length === 0}
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create folder"}
          </button>
        </div>
        {regionsWithoutFolder.length === 0 && (
          <p className="mt-2 text-sm text-amber-700">Every region already has a folder, or there are no regions in the system.</p>
        )}
        {message && <p className="mt-2 text-sm text-emerald-600">{message}</p>}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-900">Browse by region</h2>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-zinc-500">Region folder</label>
            <select
              className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm"
              value={regionId}
              onChange={(e) => setRegionId(e.target.value)}
            >
              {folders.length === 0 ? <option value="">No folders</option> : null}
              {folders.map((f) => (
                <option key={f.id} value={f.regionId}>
                  {f.regionName} ({f.pathSegment})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={deleteRegionFolder}
              disabled={loading || !selectedFolder}
              className="rounded border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-900 hover:bg-rose-100 disabled:opacity-50"
            >
              {loading ? "Working…" : "Delete this region folder"}
            </button>
          </div>
        </div>
        {selectedFolder ? (
          <p className="mt-2 text-xs text-zinc-500">
            Deleting the folder removes every file under <code className="rounded bg-zinc-100 px-1">employee-files/{selectedFolder.pathSegment}/</code> for all
            employees in {selectedFolder.regionName}. Employees in this region can upload again only after a new folder is created.
          </p>
        ) : null}

        {regionId && selectedFolder ? (
          <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
            <h3 className="text-sm font-semibold text-zinc-900">Upload for an employee</h3>
            <p className="mt-1 text-xs text-zinc-600">Files are stored under that employee&apos;s path in this region (same as self-service uploads).</p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Employee</label>
                <select
                  className="min-w-[220px] rounded border border-zinc-300 bg-white px-2 py-2 text-sm"
                  value={uploadEmployeeId}
                  onChange={(e) => setUploadEmployeeId(e.target.value)}
                  disabled={uploadBusy || assignees.length === 0}
                >
                  {assignees.length === 0 ? <option value="">No active employees in region</option> : null}
                  {assignees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.fullName}
                      {e.email ? ` (${e.email})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">File</label>
                <input
                  type="file"
                  disabled={uploadBusy || !uploadEmployeeId}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void adminUpload(file);
                  }}
                  className="block text-sm text-zinc-800 file:mr-2 file:rounded file:border-0 file:bg-zinc-900 file:px-2 file:py-1.5 file:text-xs file:font-medium file:text-white"
                />
              </div>
            </div>
          </div>
        ) : null}

        {fileLoading ? (
          <p className="mt-4 text-sm text-zinc-500">Loading files…</p>
        ) : !regionId ? (
          <p className="mt-4 text-sm text-zinc-500">Create a region folder first.</p>
        ) : files.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No files in this region yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs font-medium uppercase text-zinc-500">
                  <th className="py-2 pr-2">File</th>
                  <th className="py-2 pr-2">Employee</th>
                  <th className="py-2 pr-2">Status</th>
                  <th className="py-2 pr-2">Size</th>
                  <th className="py-2 pr-2">Uploaded</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.id} className="border-b border-zinc-100">
                    <td className="py-2.5 pr-2 font-medium text-zinc-900">{f.fileName}</td>
                    <td className="py-2.5 pr-2 text-zinc-700">
                      {f.employeeName}
                      {f.employeeEmail ? <span className="mt-0.5 block text-xs text-zinc-500">{f.employeeEmail}</span> : null}
                    </td>
                    <td className="py-2.5 pr-2 text-zinc-600 capitalize">
                      {(f.uploadStatus ?? "").replace(/_/g, " ") || "—"}
                    </td>
                    <td className="py-2.5 pr-2 text-zinc-600">{formatBytes(f.byteSize)}</td>
                    <td className="py-2.5 pr-2 text-zinc-600">{new Date(f.createdAt).toLocaleString()}</td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      {f.uploadStatus === "active" ? (
                        <button
                          type="button"
                          onClick={() => download(f.id)}
                          className="font-medium text-indigo-600 hover:underline"
                        >
                          Download
                        </button>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                      {" · "}
                      <button
                        type="button"
                        onClick={() => deleteFile(f.id, f.fileName)}
                        disabled={uploadBusy}
                        className="font-medium text-rose-600 hover:underline disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
