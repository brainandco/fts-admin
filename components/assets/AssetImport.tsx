"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
export type AssetImportPreviewRow = {
  category: string;
  serial: string;
  model: string;
  asset_id: string;
  condition: string;
  software_connectivity: string;
  imei_1: string;
  imei_2: string;
  company: string;
  ram: string;
  _payload: {
    category: string;
    serial: string | null;
    model: string | null;
    imei_1: string | null;
    imei_2: string | null;
    asset_id: string | null;
    condition: string | null;
    software_connectivity: string | null;
    specs: Record<string, unknown>;
  };
  _error?: string;
};

type PreviewColumnKey = Exclude<keyof AssetImportPreviewRow, "_payload" | "_error">;

const PREVIEW_COLUMNS: { key: PreviewColumnKey; label: string }[] = [
  { key: "company", label: "Company" },
  { key: "category", label: "Type" },
  { key: "serial", label: "Serial" },
  { key: "model", label: "Model" },
  { key: "imei_1", label: "IMEI 1" },
  { key: "imei_2", label: "IMEI 2" },
  { key: "asset_id", label: "Asset ID" },
  { key: "condition", label: "Condition" },
  { key: "software_connectivity", label: "Software" },
  { key: "ram", label: "RAM" },
];

export function AssetImport() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [previewRows, setPreviewRows] = useState<AssetImportPreviewRow[]>([]);
  const [parseError, setParseError] = useState("");
  const [saveResult, setSaveResult] = useState<{ inserted: number; errors?: { row: number; message: string }[] } | null>(null);

  async function handleParse() {
    if (!file) {
      setParseError("Select a CSV file first.");
      return;
    }
    setParseError("");
    setMessage("");
    setSaveResult(null);
    setParsing(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const res = await fetch("/api/assets/import/parse", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      setParsing(false);
      if (!res.ok) {
        setParseError(data.message || "Failed to parse file");
        setPreviewRows(data.previewRows || []);
        return;
      }
      setPreviewRows(data.previewRows || []);
      setMessage(data.message || "Preview ready.");
    } catch {
      setParsing(false);
      setParseError("Failed to parse file");
    }
  }

  async function handleSave() {
    const validRows = previewRows.filter((r) => !r._error).map((r) => r._payload);
    if (validRows.length === 0) {
      setParseError("No valid rows to save. Fix errors in the CSV and parse again.");
      return;
    }
    setSaving(true);
    setParseError("");
    try {
      const res = await fetch("/api/assets/import/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: validRows }),
      });
      const data = await res.json().catch(() => ({}));
      setSaving(false);
      if (!res.ok) {
        setParseError(data.message || "Failed to save");
        return;
      }
      const rowErrors = data.errors as { row: number; message: string }[] | undefined;
      const hasRowErrors = Array.isArray(rowErrors) && rowErrors.length > 0;
      router.refresh();
      if (!hasRowErrors) {
        resetImportModal();
        return;
      }
      setSaveResult({ inserted: data.inserted ?? 0, errors: rowErrors });
      setMessage(`${data.inserted ?? 0} asset(s) imported as Available. ${rowErrors.length} row(s) failed.`);
    } catch {
      setSaving(false);
      setParseError("Failed to save");
    }
  }

  const validCount = previewRows.filter((r) => !r._error).length;

  function resetImportModal() {
    setOpen(false);
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setPreviewRows([]);
    setMessage("");
    setParseError("");
    setSaveResult(null);
  }

  return (
    <div className="inline-block">
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setPreviewRows([]);
          setMessage("");
          setParseError("");
          setSaveResult(null);
          setFile(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }}
        className="rounded border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
      >
        Import
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div
            className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-lg bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-zinc-900">Import assets</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-zinc-500 hover:text-zinc-900">
                ✕
              </button>
            </div>
            <div className="max-h-[calc(90vh-8rem)] space-y-4 overflow-y-auto px-6 py-4">
              <p className="text-sm text-zinc-600">
                CSV columns: <strong>company</strong>, <strong>category</strong> (required — category is any type label).
                Optional model, serial, imei_1, imei_2, asset_id, condition, software_connectivity, ram. Large imports are
                saved in batches on the server (hundreds of rows in a few seconds).
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null);
                    setPreviewRows([]);
                    setSaveResult(null);
                    setParseError("");
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50"
                >
                  Upload file
                </button>
                {file ? (
                  <span className="max-w-[min(280px,40vw)] truncate text-sm text-zinc-600" title={file.name}>
                    {file.name}
                  </span>
                ) : (
                  <span className="text-sm text-zinc-500">No file selected</span>
                )}
                <button
                  type="button"
                  onClick={handleParse}
                  disabled={parsing || !file}
                  className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {parsing ? "Parsing…" : "Parse file"}
                </button>
                <a
                  href="/api/assets/import/template"
                  download
                  className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Download template
                </a>
              </div>
              {parseError && <p className="text-sm text-red-600">{parseError}</p>}
              {message && <p className="text-sm text-green-700">{message}</p>}

              {previewRows.length > 0 && (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-zinc-700">
                      Preview ({validCount} valid, {previewRows.length - validCount} with errors)
                    </span>
                    {validCount > 0 && (
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        {saving
                          ? validCount > 80
                            ? "Saving (batched)…"
                            : "Saving…"
                          : `Save ${validCount} to database`}
                      </button>
                    )}
                  </div>
                  <div className="overflow-x-auto rounded border border-zinc-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 bg-zinc-50">
                          {PREVIEW_COLUMNS.map((col) => (
                            <th key={col.key} className="px-3 py-2 text-left font-medium text-zinc-700">
                              {col.label}
                            </th>
                          ))}
                          <th className="px-3 py-2 text-left font-medium text-zinc-700">Validation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, idx) => (
                          <tr key={idx} className={`border-b border-zinc-100 ${row._error ? "bg-red-50" : ""}`}>
                            {PREVIEW_COLUMNS.map((col) => {
                              const val = row[col.key];
                              const display = val === null || val === undefined ? "—" : String(val);
                              return (
                                <td key={col.key} className="max-w-[10rem] truncate px-3 py-2 text-zinc-800" title={display}>
                                  {display}
                                </td>
                              );
                            })}
                            <td className="px-3 py-2">
                              {row._error ? (
                                <span className="text-xs text-red-600">{row._error}</span>
                              ) : (
                                <span className="text-green-600">OK</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {saveResult && saveResult.errors?.length ? (
                    <ul className="list-disc pl-4 text-sm text-red-600">
                      {saveResult.errors.map((e, i) => (
                        <li key={i}>
                          Row {e.row}: {e.message}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
