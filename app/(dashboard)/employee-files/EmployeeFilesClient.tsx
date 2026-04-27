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
  createdAt: string;
  employeeName: string;
  employeeEmail: string | null;
};

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
          <div className="flex items-center gap-2">
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
          </div>
        </div>
        {fileLoading ? (
          <p className="mt-4 text-sm text-zinc-500">Loading files…</p>
        ) : !regionId ? (
          <p className="mt-4 text-sm text-zinc-500">Create a region folder first.</p>
        ) : files.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No uploaded files in this region yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs font-medium uppercase text-zinc-500">
                  <th className="py-2 pr-2">File</th>
                  <th className="py-2 pr-2">Employee</th>
                  <th className="py-2 pr-2">Size</th>
                  <th className="py-2 pr-2">Uploaded</th>
                  <th className="py-2" />
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
                    <td className="py-2.5 pr-2 text-zinc-600">{formatBytes(f.byteSize)}</td>
                    <td className="py-2.5 pr-2 text-zinc-600">{new Date(f.createdAt).toLocaleString()}</td>
                    <td className="py-2.5 text-right">
                      <button type="button" onClick={() => download(f.id)} className="text-sm font-medium text-indigo-600 hover:underline">
                        Download
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
