"use client";

import { useState } from "react";

type ResultRow = {
  employeeId: string;
  role: "dt" | "driver_rigger";
  email?: string;
  fullName?: string;
  credentialsSent?: boolean;
  credentialsError?: string;
  temporaryPassword?: string;
  error?: string;
};

type ApiResponse = {
  message?: string;
  results?: ResultRow[];
  summary?: {
    credentialsEmailedOk: number;
    emailDeliveryFailed: number;
    otherErrors: number;
  };
};

export function SendTeamMemberCredentialsButton({
  teamId,
  memberCount,
}: {
  teamId: string;
  memberCount: number;
}) {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);

  async function handleClick() {
    if (
      memberCount === 0 ||
      !confirm(
        `Send Employee Portal credentials by email to each team member (${memberCount})? Each person gets a new temporary password, same as “Resend credentials” on their employee record.`
      )
    ) {
      return;
    }
    setResponse(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/send-member-credentials`, {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as ApiResponse;
      if (!res.ok) {
        setResponse({ message: data.message ?? "Request failed" });
        return;
      }
      setResponse(data);
    } finally {
      setLoading(false);
    }
  }

  const roleLabel = (r: ResultRow["role"]) => (r === "dt" ? "DT" : "Driver/Rigger");

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={loading || memberCount === 0}
        className="rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-900 hover:bg-indigo-100 disabled:opacity-50"
      >
        {loading ? "Sending…" : "Send portal credentials to all members"}
      </button>
      {response?.message && !response.results && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{response.message}</p>
      )}
      {response?.results && response.results.length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 text-sm">
          {response.summary && (
            <p className="mb-3 font-medium text-zinc-800">
              Emailed OK: {response.summary.credentialsEmailedOk} · Email failed: {response.summary.emailDeliveryFailed} ·
              Other errors: {response.summary.otherErrors}
            </p>
          )}
          <ul className="space-y-3">
            {response.results.map((r) => (
              <li key={r.employeeId} className="border-b border-zinc-100 pb-3 last:border-0 last:pb-0">
                <div className="font-medium text-zinc-900">
                  {roleLabel(r.role)}
                  {r.fullName ? `: ${r.fullName}` : ""}
                  {r.email ? <span className="ml-1 font-normal text-zinc-600">({r.email})</span> : null}
                </div>
                {r.error && <p className="mt-1 text-rose-700">{r.error}</p>}
                {!r.error && r.credentialsSent && (
                  <p className="mt-1 text-emerald-800">Credentials email sent.</p>
                )}
                {!r.error && r.credentialsSent === false && (
                  <div className="mt-1 text-amber-900">
                    <p>Email not delivered{r.credentialsError ? `: ${r.credentialsError}` : ""}.</p>
                    {r.temporaryPassword && (
                      <p className="mt-1 flex flex-wrap items-center gap-2">
                        <span>Temporary password:</span>
                        <code className="rounded bg-white px-2 py-0.5 font-mono text-xs">{r.temporaryPassword}</code>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(r.temporaryPassword!)}
                          className="rounded border border-amber-300 px-2 py-0.5 text-xs"
                        >
                          Copy
                        </button>
                      </p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
