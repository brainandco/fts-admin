"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

const EMPLOYEE_ROLE_OPTIONS = [
  { value: "DT", label: "DT" },
  { value: "Driver/Rigger", label: "Driver/Rigger" },
  { value: "Self DT", label: "Self DT" },
  { value: "QC", label: "QC" },
  { value: "QA", label: "QA" },
  { value: "PP", label: "PP" },
  { value: "Project Manager", label: "Project Manager" },
] as const;

type Employee = {
  id: string;
  full_name: string;
  passport_number: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  iqama_number: string | null;
  region_id: string | null;
  project_id: string | null;
  project_name_other?: string | null;
  accommodations?: string | null;
  status: string;
  roles?: string[];
} | null;

/** Profile only — region and project are set on Employees → Region & project assignments. */
export function EmployeeForm({ existing }: { existing: Employee }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(existing?.full_name ?? "");
  const [passportNumber, setPassportNumber] = useState(existing?.passport_number ?? "");
  const [country, setCountry] = useState(existing?.country ?? "");
  const [email, setEmail] = useState(existing?.email ?? "");
  const [phone, setPhone] = useState(existing?.phone ?? "");
  const [iqamaNumber, setIqamaNumber] = useState(existing?.iqama_number ?? "");
  const [roles, setRoles] = useState<string[]>(existing?.roles ?? []);
  const [onboardingDate, setOnboardingDate] = useState(
    (existing as { onboarding_date?: string } | null)?.onboarding_date?.toString().slice(0, 10) ?? ""
  );
  const [status, setStatus] = useState(existing?.status ?? "ACTIVE");
  const [accommodations, setAccommodations] = useState(existing?.accommodations ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [teamsBlockingDelete, setTeamsBlockingDelete] = useState<{ id: string; name: string }[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setTeamsBlockingDelete([]);
    const required = [
      { val: fullName.trim(), name: "Full name" },
      { val: country.trim(), name: "Country" },
      { val: email.trim(), name: "Email" },
      { val: phone.trim(), name: "Phone number" },
      { val: iqamaNumber.trim(), name: "Iqama number" },
      { val: onboardingDate.trim(), name: "Onboarding date" },
    ];
    const missing = required.find((r) => !r.val);
    if (missing) {
      setError(`${missing.name} is required.`);
      return;
    }
    if (roles.length !== 1) {
      setError("Select exactly one role.");
      return;
    }
    setSaving(true);
    const res = await fetch(existing ? `/api/employees/${existing.id}` : "/api/employees", {
      method: existing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: fullName.trim(),
        passport_number: passportNumber.trim() || null,
        country: country.trim(),
        email: email.trim(),
        phone: phone.trim(),
        iqama_number: iqamaNumber.trim(),
        roles,
        onboarding_date: onboardingDate.trim() || null,
        status,
        accommodations: accommodations.trim() || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.message || "Failed to save");
      return;
    }
    setError("");
    router.push("/employees");
    router.refresh();
  }

  async function remove() {
    if (!existing) return;
    setShowDeleteConfirm(false);
    setDeleting(true);
    setError("");
    setTeamsBlockingDelete([]);
    const res = await fetch(`/api/employees/${existing.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setDeleting(false);
    if (!res.ok) {
      setError(data.message || "Failed to delete");
      if (data.code === "EMPLOYEE_IN_USE_IN_TEAMS" && Array.isArray(data.teams)) {
        setTeamsBlockingDelete(data.teams);
      }
      return;
    }
    router.push("/employees");
    router.refresh();
  }

  return (
    <>
      <form onSubmit={submit} className="max-w-2xl space-y-4 rounded-lg border border-zinc-200 bg-white p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Full name <span className="text-red-600">*</span>
            </label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required className="w-full rounded border border-zinc-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Passport number</label>
            <input value={passportNumber} onChange={(e) => setPassportNumber(e.target.value)} className="w-full rounded border border-zinc-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Country <span className="text-red-600">*</span>
            </label>
            <input value={country} onChange={(e) => setCountry(e.target.value)} required className="w-full rounded border border-zinc-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Email <span className="text-red-600">*</span>
            </label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full rounded border border-zinc-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Phone number <span className="text-red-600">*</span>
            </label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} required className="w-full rounded border border-zinc-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Iqama number <span className="text-red-600">*</span>
            </label>
            <input value={iqamaNumber} onChange={(e) => setIqamaNumber(e.target.value)} required className="w-full rounded border border-zinc-300 px-3 py-2 text-sm" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Role <span className="text-red-600">*</span>
            </label>
            <div className="flex flex-wrap gap-3">
              {EMPLOYEE_ROLE_OPTIONS.map((o) => (
                <label key={o.value} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name="employee_role"
                    checked={roles.includes(o.value)}
                    onChange={() => setRoles([o.value])}
                    className="rounded border-zinc-300"
                  />
                  {o.label}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-zinc-500">Select one role only. Self DT = one person as full team (DT + Driver/Rigger).</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Onboarding date <span className="text-red-600">*</span>
            </label>
            <input type="date" value={onboardingDate} onChange={(e) => setOnboardingDate(e.target.value)} required className="w-full rounded border border-zinc-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded border border-zinc-300 px-3 py-2 text-sm">
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-zinc-700">Accommodations</label>
            <textarea
              value={accommodations}
              onChange={(e) => setAccommodations(e.target.value)}
              rows={3}
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
              placeholder="Accommodation details (free text)"
            />
            <p className="mt-1 text-xs text-zinc-500">Optional.</p>
          </div>
        </div>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <p>{error}</p>
            {teamsBlockingDelete.length > 0 ? (
              <>
                <p className="mt-2 font-medium">Replace this employee in these teams first:</p>
                <ul className="mt-1 list-inside list-disc">
                  {teamsBlockingDelete.map((t) => (
                    <li key={t.id}>
                      <Link href={`/teams/${t.id}`} className="text-red-700 underline hover:no-underline">
                        {t.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        )}

        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
            {saving ? "Saving..." : existing ? "Update" : "Create"}
          </button>
          {existing && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleting}
              className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          )}
          <button type="button" onClick={() => router.back()} className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
            Cancel
          </button>
        </div>
      </form>
      {existing && (
        <ConfirmModal
          open={showDeleteConfirm}
          title="Delete employee"
          message="Are you sure you want to delete this employee? This cannot be undone."
          confirmLabel="Yes, delete"
          cancelLabel="Cancel"
          variant="danger"
          loading={deleting}
          onConfirm={remove}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </>
  );
}
