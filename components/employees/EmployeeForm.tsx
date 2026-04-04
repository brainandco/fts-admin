"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import {
  EMPLOYEE_ROLE_GROUPS,
  EMPLOYEE_ROLE_OTHER,
} from "@/lib/employees/employee-role-options";

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
  role_custom?: string | null;
} | null;

/** Profile only — region and project are set on Employees → Region & project assignments. */
export function EmployeeForm({
  existing,
  canDeleteEmployee = false,
}: {
  existing: Employee;
  /** Super User only; API also requires Super for DELETE. */
  canDeleteEmployee?: boolean;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(existing?.full_name ?? "");
  const [passportNumber, setPassportNumber] = useState(existing?.passport_number ?? "");
  const [country, setCountry] = useState(existing?.country ?? "");
  const [email, setEmail] = useState(existing?.email ?? "");
  const [phone, setPhone] = useState(existing?.phone ?? "");
  const [iqamaNumber, setIqamaNumber] = useState(existing?.iqama_number ?? "");
  const [roles, setRoles] = useState<string[]>(existing?.roles ?? []);
  const [otherRoleText, setOtherRoleText] = useState(() => {
    const r0 = existing?.roles?.[0];
    if (r0 === EMPLOYEE_ROLE_OTHER && existing?.role_custom?.trim()) {
      return existing.role_custom.trim();
    }
    return "";
  });
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
        role_custom: roles[0] === EMPLOYEE_ROLE_OTHER ? otherRoleText.trim() : undefined,
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
            <label className="mb-1 block text-sm font-medium text-zinc-700" htmlFor="employee_role_select">
              Role <span className="text-red-600">*</span>
            </label>
            <select
              id="employee_role_select"
              value={roles[0] ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setRoles(v ? [v] : []);
                if (v !== EMPLOYEE_ROLE_OTHER) setOtherRoleText("");
              }}
              required
              className="w-full max-w-xl rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">— Select a role —</option>
              {EMPLOYEE_ROLE_GROUPS.map((group) => (
                <optgroup key={group.heading} label={group.heading}>
                  {group.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              ))}
              <option value={EMPLOYEE_ROLE_OTHER}>Other (describe below)</option>
            </select>
            {roles[0] === EMPLOYEE_ROLE_OTHER ? (
              <div className="mt-3 max-w-xl">
                <label className="mb-1 block text-sm font-medium text-zinc-700" htmlFor="employee_role_custom">
                  Custom role <span className="text-red-600">*</span>
                </label>
                <input
                  id="employee_role_custom"
                  value={otherRoleText}
                  onChange={(e) => setOtherRoleText(e.target.value)}
                  maxLength={120}
                  required
                  placeholder="e.g. Senior rigger, HSE officer, warehouse lead"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <p className="mt-1 text-xs text-zinc-500">1–120 characters. Shown everywhere the role appears.</p>
              </div>
            ) : null}
            <div className="mt-2 space-y-1 text-xs text-zinc-500">
              {EMPLOYEE_ROLE_GROUPS.map((g) => (
                <p key={g.heading}>
                  <span className="font-medium text-zinc-600">{g.heading}:</span> {g.description ?? ""}
                </p>
              ))}
              <p>
                <span className="font-medium text-zinc-600">Other:</span> any title not listed above — not assigned to DT/Driver
                team rows.
              </p>
              <p className="text-zinc-600">One role per employee. Self DT covers both DT and Driver/Rigger on a team.</p>
            </div>
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
          {existing && canDeleteEmployee && (
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
      {existing && canDeleteEmployee && (
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
