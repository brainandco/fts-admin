"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type SimImportPreviewRow = {
  operator: string;
  service_type: string;
  sim_number: string;
  phone_number: string;
  notes: string;
  _payload: {
    operator: string;
    service_type: "Data" | "Voice" | "Data+Voice";
    sim_number: string;
    phone_number: string | null;
    notes: string | null;
  };
  _error?: string;
};

const PREVIEW_COLUMNS: { key: keyof Omit<SimImportPreviewRow, "_payload" | "_error">; label: string }[] = [
  { key: "operator", label: "Operator" },
  { key: "service_type", label: "Service type" },
  { key: "sim_number", label: "SIM number" },
  { key: "phone_number", label: "Phone number" },
  { key: "notes", label: "Notes" },
];

export function SimImport() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<SimImportPreviewRow[]>([]);
  const [parseError, setParseError] = useState("");
  const [message, setMessage] = useState("");
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ inserted: number; errors?: { row: number; message: string }[] } | null>(null);

  async function parseFile() {
    if (!file) return setParseError("Select a CSV or Excel file first.");
    setParseError("");
    setMessage("");
    setSaveResult(null);
    setParsing(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/sims/import/parse", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      setParsing(false);
      if (!res.ok) {
        setParseError(data.message || "Failed to parse file");
        setPreviewRows(data.previewRows || []);
        return;
      }
      setPreviewRows(data.previewRows || []);
      setMessage(data.message || "Preview ready");
    } catch {
      setParsing(false);
      setParseError("Failed to parse file");
    }
  }

  async function saveRows() {
    const rows = previewRows.filter((r) => !r._error).map((r) => r._payload);
    if (rows.length === 0) return setParseError("No valid rows to save.");
    setSaving(true);
    setParseError("");
    try {
      const res = await fetch("/api/sims/import/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json().catch(() => ({}));
      setSaving(false);
      if (!res.ok) return setParseError(data.message || "Failed to save");
      const rowErrors = data.errors as { row: number; message: string }[] | undefined;
      const hasRowErrors = Array.isArray(rowErrors) && rowErrors.length > 0;
      router.refresh();
      if (!hasRowErrors) {
        resetImportModal();
        return;
      }
      setSaveResult({ inserted: data.inserted ?? 0, errors: rowErrors });
      setMessage(`${data.inserted ?? 0} SIM(s) imported. ${rowErrors.length} row(s) failed.`);
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
          setFile(null);
          setPreviewRows([]);
          setParseError("");
          setMessage("");
          setSaveResult(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }}
        className="rounded border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
      >
        Import SIMs
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-zinc-900">Import SIM cards</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-zinc-500 hover:text-zinc-900">✕</button>
            </div>
            <div className="max-h-[calc(90vh-8rem)] space-y-4 overflow-y-auto px-6 py-4">
              <p className="text-sm text-zinc-600">
                Columns required (CSV or Excel): <strong>operator</strong>, <strong>service_type</strong>, <strong>sim_number</strong>.
                Optional: phone_number, notes.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
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
                  onClick={parseFile}
                  disabled={parsing || !file}
                  className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {parsing ? "Parsing..." : "Parse file"}
                </button>
                <a
                  href="/api/sims/import/template"
                  download
                  className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Download template
                </a>
              </div>

              {parseError && <p className="text-sm text-red-600">{parseError}</p>}
              {message && <p className="text-sm text-emerald-700">{message}</p>}

              {previewRows.length > 0 && (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-zinc-700">
                      Preview ({validCount} valid, {previewRows.length - validCount} with errors)
                    </span>
                    {validCount > 0 && (
                      <button
                        type="button"
                        onClick={saveRows}
                        disabled={saving}
                        className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        {saving ? "Saving..." : `Save ${validCount} to database`}
                      </button>
                    )}
                  </div>
                  <div className="overflow-x-auto rounded border border-zinc-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 bg-zinc-50">
                          {PREVIEW_COLUMNS.map((c) => (
                            <th key={c.key} className="px-3 py-2 text-left font-medium text-zinc-700">{c.label}</th>
                          ))}
                          <th className="px-3 py-2 text-left font-medium text-zinc-700">Validation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, idx) => (
                          <tr key={idx} className={`border-b border-zinc-100 ${row._error ? "bg-red-50" : ""}`}>
                            {PREVIEW_COLUMNS.map((c) => {
                              const val = row[c.key];
                              const text = val == null || val === "" ? "—" : String(val);
                              return (
                                <td key={c.key} className="max-w-[12rem] truncate px-3 py-2 text-zinc-800" title={text}>
                                  {text}
                                </td>
                              );
                            })}
                            <td className="px-3 py-2">
                              {row._error ? <span className="text-xs text-red-600">{row._error}</span> : <span className="text-green-600">OK</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {saveResult?.errors?.length ? (
                    <ul className="list-disc pl-4 text-sm text-red-600">
                      {saveResult.errors.map((e, i) => (
                        <li key={i}>Row {e.row}: {e.message}</li>
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
