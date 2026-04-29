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

type Assignee = { id: string; fullName: string; email: string | null; folderSlug: string };

type BrowseFolder = { type: "folder"; name: string; path: string };
type BrowseFile = {
  type: "file";
  name: string;
  key: string;
  size: number | null;
  lastModified: string | null;
  db: {
    id: string;
    file_name: string;
    mime_type: string | null;
    byte_size: number | null;
    upload_status: string;
    created_at: string;
  } | null;
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
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [uploadEmployeeId, setUploadEmployeeId] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);

  const [browseAtRegionRoot, setBrowseAtRegionRoot] = useState(true);
  const [browseEmployeeId, setBrowseEmployeeId] = useState<string | null>(null);
  const [browsePath, setBrowsePath] = useState("");
  const [browseFolders, setBrowseFolders] = useState<BrowseFolder[]>([]);
  const [browseFiles, setBrowseFiles] = useState<BrowseFile[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);

  const [adminFolderPath, setAdminFolderPath] = useState("");
  const [adminUploadPathOverride, setAdminUploadPathOverride] = useState("");

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

  const loadBrowse = useCallback(async () => {
    if (!regionId) return;
    setBrowseLoading(true);
    try {
      if (browseAtRegionRoot) {
        const res = await fetch(
          `/api/employee-files/browse?regionId=${encodeURIComponent(regionId)}&path=${encodeURIComponent(browsePath)}`
        );
        const data = await res.json();
        if (!res.ok) throw new Error((data as { message?: string }).message || "Browse failed");
        setBrowseFolders((data as { folders?: BrowseFolder[] }).folders ?? []);
        setBrowseFiles((data as { files?: BrowseFile[] }).files ?? []);
      } else if (browseEmployeeId) {
        const res = await fetch(
          `/api/employee-files/browse?regionId=${encodeURIComponent(regionId)}&employeeId=${encodeURIComponent(browseEmployeeId)}&path=${encodeURIComponent(browsePath)}`
        );
        const data = await res.json();
        if (!res.ok) throw new Error((data as { message?: string }).message || "Browse failed");
        setBrowseFolders((data as { folders?: BrowseFolder[] }).folders ?? []);
        setBrowseFiles((data as { files?: BrowseFile[] }).files ?? []);
      } else {
        setBrowseFolders([]);
        setBrowseFiles([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Browse failed");
      setBrowseFolders([]);
      setBrowseFiles([]);
    } finally {
      setBrowseLoading(false);
    }
  }, [regionId, browseAtRegionRoot, browseEmployeeId, browsePath]);

  const regionsWithoutFolder = regions.filter((r) => !folders.some((f) => f.regionId === r.id));
  const selectedFolder = folders.find((f) => f.regionId === regionId);

  useEffect(() => {
    if (regionId) void loadFiles(regionId);
  }, [regionId, loadFiles]);

  useEffect(() => {
    setBrowseAtRegionRoot(true);
    setBrowseEmployeeId(null);
    setBrowsePath("");
  }, [regionId]);

  useEffect(() => {
    if (!regionId || !selectedFolder) return;
    void loadBrowse();
  }, [regionId, selectedFolder, browseAtRegionRoot, browseEmployeeId, browsePath, loadBrowse]);

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

  async function adminUpload(f: File, relativePath?: string) {
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
          ...(relativePath?.trim() ? { relativePath: relativePath.trim() } : {}),
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
      await loadBrowse();
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
      await loadBrowse();
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

  async function createEmployeeFolderMarker() {
    if (!regionId || !uploadEmployeeId || !adminFolderPath.trim()) {
      setError("Select region, employee, and enter a folder path.");
      return;
    }
    setUploadBusy(true);
    setError("");
    try {
      const res = await fetch("/api/employee-files/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          regionId,
          employeeId: uploadEmployeeId,
          relativePath: adminFolderPath.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { message?: string }).message || "Create folder failed");
      setMessage("Folder marker created.");
      setAdminFolderPath("");
      await loadBrowse();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create folder failed");
    } finally {
      setUploadBusy(false);
    }
  }

  const breadcrumbParts = browsePath ? browsePath.split("/").filter(Boolean) : [];

  function enterEmployeeFromSlug(folderName: string) {
    const emp = assignees.find((a) => a.folderSlug === folderName);
    if (!emp) {
      setError("Could not match folder to an employee in this region.");
      return;
    }
    setBrowseAtRegionRoot(false);
    setBrowseEmployeeId(emp.id);
    setUploadEmployeeId(emp.id);
    setBrowsePath("");
  }

  const uploadRelativeBase =
    !browseAtRegionRoot && browseEmployeeId && uploadEmployeeId === browseEmployeeId ? browsePath : "";
  const effectiveAdminUploadPath = adminUploadPathOverride.trim() || uploadRelativeBase;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Create region folder</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Each region can have one folder (S3 prefix under <code className="rounded bg-zinc-100 px-1">employee-files/…</code>).
          Files then follow Region → Employee name → Month-Year → Day-Month-Year → files.
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
          <h2 className="text-sm font-semibold text-zinc-900">Browse & manage</h2>
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
            Deleting the folder removes every file under{" "}
            <code className="rounded bg-zinc-100 px-1">employee-files/{selectedFolder.pathSegment}/</code> for all employees in{" "}
            {selectedFolder.regionName}.
          </p>
        ) : null}

        {regionId && selectedFolder ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
              <h3 className="text-sm font-semibold text-zinc-900">Wasabi browser</h3>
              <p className="mt-1 text-xs text-zinc-600">
                Start at <strong>region</strong> to open each employee folder, then Month-Year → Day → files. Choosing an
                employee in the dropdown moves upload/browsing to that employee.
              </p>
              <nav className="mt-3 flex flex-wrap items-center gap-1 text-xs text-zinc-600">
                <button
                  type="button"
                  className="font-medium text-indigo-600 hover:underline"
                  onClick={() => {
                    setBrowseAtRegionRoot(true);
                    setBrowseEmployeeId(null);
                    setBrowsePath("");
                  }}
                >
                  Region
                </button>
                {!browseAtRegionRoot && browseEmployeeId ? (
                  <>
                    <span className="text-zinc-400">/</span>
                    <button
                      type="button"
                      className="font-medium text-indigo-600 hover:underline"
                      onClick={() => {
                        setBrowsePath("");
                      }}
                    >
                      {assignees.find((a) => a.id === browseEmployeeId)?.fullName ?? "Employee"}
                    </button>
                  </>
                ) : null}
                {breadcrumbParts.map((part, i) => {
                  const prefix = breadcrumbParts.slice(0, i + 1).join("/");
                  return (
                    <span key={prefix} className="flex items-center gap-1">
                      <span className="text-zinc-400">/</span>
                      <button
                        type="button"
                        className="hover:text-indigo-600 hover:underline"
                        onClick={() => setBrowsePath(prefix)}
                      >
                        {part}
                      </button>
                    </span>
                  );
                })}
              </nav>

              {browseLoading ? (
                <p className="mt-3 text-sm text-zinc-500">Loading…</p>
              ) : (
                <div className="mt-3 overflow-x-auto rounded-lg border border-white bg-white">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 bg-zinc-50">
                        <th className="px-3 py-2 text-left font-medium text-zinc-800">Name</th>
                        <th className="px-3 py-2 text-left font-medium text-zinc-800">Size</th>
                        <th className="px-3 py-2 text-right font-medium text-zinc-800">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {browseFolders.map((f) => (
                        <tr key={`folder-${f.path}`} className="border-b border-zinc-100">
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              className="font-medium text-indigo-600 hover:underline"
                              onClick={() =>
                                browseAtRegionRoot ? enterEmployeeFromSlug(f.name) : setBrowsePath(f.path)
                              }
                            >
                              {f.name}/
                            </button>
                          </td>
                          <td className="px-3 py-2 text-zinc-500">—</td>
                          <td className="px-3 py-2 text-right text-zinc-400">—</td>
                        </tr>
                      ))}
                      {browseFiles.map((f) => (
                        <tr key={f.key} className="border-b border-zinc-100">
                          <td className="px-3 py-2 font-medium text-zinc-900">{f.name}</td>
                          <td className="px-3 py-2 text-zinc-600">{formatBytes(f.size)}</td>
                          <td className="px-3 py-2 text-right">
                            {f.db?.id && f.db.upload_status === "active" ? (
                              <button
                                type="button"
                                onClick={() => download(f.db!.id)}
                                className="text-indigo-600 hover:underline"
                              >
                                Download
                              </button>
                            ) : (
                              <span className="text-xs text-zinc-400">—</span>
                            )}
                            {f.db?.id ? (
                              <>
                                {" · "}
                                <button
                                  type="button"
                                  onClick={() => deleteFile(f.db!.id, f.db!.file_name)}
                                  disabled={uploadBusy}
                                  className="text-rose-600 hover:underline disabled:opacity-50"
                                >
                                  Delete
                                </button>
                              </>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                      {browseFolders.length === 0 && browseFiles.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-3 py-6 text-center text-zinc-500">
                            {browseAtRegionRoot
                              ? "No employee folders yet (uploads create employee paths)."
                              : "Nothing in this folder."}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
              <h3 className="text-sm font-semibold text-zinc-900">Upload for an employee</h3>
              <p className="mt-1 text-xs text-zinc-600">
                Files use Region → Employee → Month-Year/Day unless you set an optional path. Current browse path is applied
                when it matches the selected employee.
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Employee</label>
                  <select
                    className="min-w-[220px] rounded border border-zinc-300 bg-white px-2 py-2 text-sm"
                    value={uploadEmployeeId}
                    onChange={(e) => {
                      const v = e.target.value;
                      setUploadEmployeeId(v);
                      setBrowseEmployeeId(v);
                      setBrowseAtRegionRoot(false);
                      setBrowsePath("");
                    }}
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
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Path under employee (optional)</label>
                  <input
                    type="text"
                    className="min-w-[220px] rounded border border-zinc-300 bg-white px-2 py-2 text-sm"
                    placeholder={uploadRelativeBase || "Apr-2026/28-Apr-2026"}
                    disabled={uploadBusy}
                    value={adminUploadPathOverride}
                    onChange={(e) => setAdminUploadPathOverride(e.target.value)}
                  />
                  <p className="mt-0.5 text-[11px] text-zinc-500">
                    Defaults to current browse path when empty.
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">File</label>
                  <input
                    type="file"
                    disabled={uploadBusy || !uploadEmployeeId}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void adminUpload(file, effectiveAdminUploadPath || undefined);
                    }}
                    className="block text-sm text-zinc-800 file:mr-2 file:rounded file:border-0 file:bg-zinc-900 file:px-2 file:py-1.5 file:text-xs file:font-medium file:text-white"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-zinc-900">Create folder (employee)</h3>
              <p className="mt-1 text-xs text-zinc-500">Adds a <code className="rounded bg-zinc-100 px-1">.keep</code> marker under the selected employee.</p>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <input
                  type="text"
                  value={adminFolderPath}
                  onChange={(e) => setAdminFolderPath(e.target.value)}
                  placeholder="Apr-2026/28-Apr-2026/Custom"
                  disabled={uploadBusy || !uploadEmployeeId}
                  className="min-w-[260px] flex-1 rounded border border-zinc-300 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => void createEmployeeFolderMarker()}
                  disabled={uploadBusy || !uploadEmployeeId}
                  className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  Create folder
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {fileLoading ? (
          <p className="mt-4 text-sm text-zinc-500">Loading files…</p>
        ) : !regionId ? (
          <p className="mt-4 text-sm text-zinc-500">Create a region folder first.</p>
        ) : files.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No file metadata rows for this region yet.</p>
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
