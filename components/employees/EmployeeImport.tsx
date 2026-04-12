"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

export type ImportPreviewRow = {
  full_name: string;
  passport_number: string;
  country: string;
  email: string;
  phone: string;
  iqama_number: string;
  roles_display: string;
  onboarding_date: string | null;
  status: string;
  _payload: {
    full_name: string;
    passport_number: string;
    country: string;
    email: string;
    phone: string;
    iqama_number: string;
    roles: string[];
    role_custom: string | null;
    region_id: null;
    project_id: null;
    project_name_other: null;
    onboarding_date: string | null;
    status: string;
  };
  _error?: string;
};

type PreviewColumnKey = Exclude<keyof ImportPreviewRow, "_payload" | "_error">;

const PREVIEW_COLUMNS: { key: PreviewColumnKey; label: string }[] = [
  { key: "full_name", label: "Full name" },
  { key: "passport_number", label: "Passport" },
  { key: "country", label: "Country" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "iqama_number", label: "Iqama" },
  { key: "roles_display", label: "Roles" },
  { key: "onboarding_date", label: "Onboarding" },
  { key: "status", label: "Status" },
];

export function EmployeeImport() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [parseError, setParseError] = useState("");
  const [saveResult, setSaveResult] = useState<{ inserted: number; errors?: { row: number; message: string }[] } | null>(null);

  async function handleParse() {
    if (!file) {
      setParseError("Select a CSV or Excel file first.");
      return;
    }
    setParseError("");
    setMessage("");
    setSaveResult(null);
    setParsing(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const res = await fetch("/api/employees/import/parse", { method: "POST", body: formData });
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
      setParseError("No valid rows to save. Fix errors in the file and parse again.");
      return;
    }
    setSaving(true);
    setParseError("");
    try {
      const res = await fetch("/api/employees/import/save", {
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
      setMessage(
        `${data.inserted ?? 0} employee(s) imported. ${rowErrors.length} row(s) failed — fix the file and try again.`
      );
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
          <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-zinc-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900">Import employees</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-zinc-500 hover:text-zinc-900">✕</button>
            </div>
            <div className="overflow-y-auto max-h-[calc(90vh-8rem)] px-6 py-4 space-y-4">
              <p className="text-sm text-zinc-600">
                Upload a CSV or Excel file with columns: full_name, passport_number, country, email, phone, iqama_number, roles, and optionally onboarding_date, status. Assign region and project after import on{" "}
                <span className="font-medium text-zinc-800">Employees → Region &amp; project assignments</span>. In the roles column use one value per row, for example{" "}
                <code className="rounded bg-zinc-100 px-1">QA</code>, a fixed role like <code className="rounded bg-zinc-100 px-1">DT</code>,{" "}
                <code className="rounded bg-zinc-100 px-1">Other:Mechanic</code>, or any custom label (stored as a custom role). One role per row.{" "}
                <span className="text-zinc-500">
                  Onboarding date: ISO <code className="rounded bg-zinc-100 px-1">YYYY-MM-DD</code> (unchanged), or day-first{" "}
                  <code className="rounded bg-zinc-100 px-1">DD-MM-YYYY</code>/<code className="rounded bg-zinc-100 px-1">DD/MM/YYYY</code>, year-first with slashes/dots, 2-digit years, and ISO datetimes — all normalized to YYYY-MM-DD.
                </span>
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
                  onClick={handleParse}
                  disabled={parsing || !file}
                  className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {parsing ? "Parsing…" : "Parse file"}
                </button>
                <a href="/api/employees/import/template" download className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                  Download template
                </a>
              </div>
              {parseError && <p className="text-sm text-red-600">{parseError}</p>}
              {message && <p className="text-sm text-green-700">{message}</p>}

              {previewRows.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-700">
                      Preview — how data will appear and be saved ({validCount} valid, {previewRows.length - validCount} with errors)
                    </span>
                    {validCount > 0 && (
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        {saving ? "Saving…" : `Save ${validCount} to database`}
                      </button>
                    )}
                  </div>
                  <div className="overflow-x-auto rounded border border-zinc-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 bg-zinc-50">
                          {PREVIEW_COLUMNS.map((col) => (
                            <th key={col.key} className="px-3 py-2 text-left font-medium text-zinc-700">{col.label}</th>
                          ))}
                          <th className="px-3 py-2 text-left font-medium text-zinc-700">Validation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, idx) => (
                          <tr
                            key={idx}
                            className={`border-b border-zinc-100 ${row._error ? "bg-red-50" : ""}`}
                          >
                            {PREVIEW_COLUMNS.map((col) => {
                              const val = row[col.key];
                              const display = val === null || val === undefined ? "—" : String(val);
                              return (
                                <td key={col.key} className="px-3 py-2 text-zinc-800">
                                  {display}
                                </td>
                              );
                            })}
                            <td className="px-3 py-2">
                              {row._error ? <span className="text-red-600 text-xs">{row._error}</span> : <span className="text-green-600">OK</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {saveResult && saveResult.errors?.length ? (
                    <ul className="text-sm text-red-600 list-disc pl-4">
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
