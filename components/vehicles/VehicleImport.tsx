"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type VehicleImportPreviewRow = {
  plate_number: string;
  vehicle_type: string;
  rent_company: string;
  make: string;
  model: string;
  assignment_type: string;
  _payload: {
    plate_number: string;
    vehicle_type: string | null;
    rent_company: string | null;
    make: string | null;
    model: string | null;
    assignment_type: "Temporary" | "Permanent";
  };
  _error?: string;
};

type VehiclePreviewColumnKey = Exclude<keyof VehicleImportPreviewRow, "_payload" | "_error">;

const PREVIEW_COLUMNS: { key: VehiclePreviewColumnKey; label: string }[] = [
  { key: "plate_number", label: "Vehicle plate no." },
  { key: "vehicle_type", label: "Vehicle type" },
  { key: "rent_company", label: "Rent company" },
  { key: "make", label: "Make" },
  { key: "model", label: "Model" },
  { key: "assignment_type", label: "Assignment type" },
];

export function VehicleImport() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [previewRows, setPreviewRows] = useState<VehicleImportPreviewRow[]>([]);
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
      const res = await fetch("/api/vehicles/import/parse", { method: "POST", body: formData });
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
      const res = await fetch("/api/vehicles/import/save", {
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
      setSaveResult({ inserted: data.inserted ?? 0, errors: data.errors });
      setMessage(`${data.inserted ?? 0} vehicle(s) imported successfully.`);
      if (data.errors?.length) setMessage((m) => m + ` ${data.errors.length} row(s) failed.`);
      router.refresh();
    } catch {
      setSaving(false);
      setParseError("Failed to save");
    }
  }

  const validCount = previewRows.filter((r) => !r._error).length;

  return (
    <div className="inline-block">
      <button
        type="button"
        onClick={() => { setOpen(true); setPreviewRows([]); setMessage(""); setParseError(""); setSaveResult(null); setFile(null); }}
        className="rounded border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
      >
        Import
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-zinc-900">Import vehicles</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-zinc-500 hover:text-zinc-900">✕</button>
            </div>
            <div className="max-h-[calc(90vh-8rem)] overflow-y-auto px-6 py-4 space-y-4">
              <p className="text-sm text-zinc-600">
                Add vehicles only (no assignee). Required: plate_number. Optional: vehicle_type, rent_company, make, model, assignment_type (Temporary/Permanent). Employee assignment is handled by Project Managers.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="file"
                  accept=".csv"
                  className="text-sm"
                  onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreviewRows([]); setSaveResult(null); }}
                />
                <button type="button" onClick={handleParse} disabled={parsing || !file} className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
                  {parsing ? "Parsing…" : "Parse file"}
                </button>
                <a href="/api/vehicles/import/template" download className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">Download template</a>
              </div>
              {parseError && <p className="text-sm text-red-600">{parseError}</p>}
              {message && <p className="text-sm text-green-700">{message}</p>}

              {previewRows.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-700">
                      Preview ({validCount} valid, {previewRows.length - validCount} with errors)
                    </span>
                    {validCount > 0 && (
                      <button type="button" onClick={handleSave} disabled={saving} className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
                        {saving ? "Saving…" : `Save ${validCount} to database`}
                      </button>
                    )}
                  </div>
                  <div className="overflow-x-auto rounded border border-zinc-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 bg-zinc-50">
                          {PREVIEW_COLUMNS.map((col) => <th key={col.key} className="px-3 py-2 text-left font-medium text-zinc-700">{col.label}</th>)}
                          <th className="px-3 py-2 text-left font-medium text-zinc-700">Validation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, idx) => (
                          <tr key={idx} className={`border-b border-zinc-100 ${row._error ? "bg-red-50" : ""}`}>
                            {PREVIEW_COLUMNS.map((col) => {
                              const val = row[col.key];
                              const display = val === null || val === undefined ? "—" : String(val);
                              return <td key={col.key} className="px-3 py-2 text-zinc-800">{display}</td>;
                            })}
                            <td className="px-3 py-2">{row._error ? <span className="text-xs text-red-600">{row._error}</span> : <span className="text-green-600">OK</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {saveResult?.errors?.length ? (
                    <ul className="list-disc pl-4 text-sm text-red-600">
                      {saveResult.errors.map((e, i) => <li key={i}>Row {e.row}: {e.message}</li>)}
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
