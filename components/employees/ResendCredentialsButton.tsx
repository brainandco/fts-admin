"use client";

import { useState } from "react";

export function ResendCredentialsButton({ employeeId }: { employeeId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    credentialsSent: boolean;
    credentialsError?: string;
    temporaryPassword?: string;
  } | null>(null);

  async function handleClick() {
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/employees/${employeeId}/resend-credentials`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult({ credentialsSent: false, credentialsError: data.message ?? "Request failed" });
        return;
      }
      setResult({
        credentialsSent: data.credentialsSent === true,
        credentialsError: data.credentialsError,
        temporaryPassword: data.temporaryPassword,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
      >
        {loading ? "Sending…" : "Resend credentials email"}
      </button>
      {result && (
        <div
          className={`rounded border p-3 text-sm ${
            result.credentialsSent
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {result.credentialsSent ? (
            <p>Credentials email sent. The employee can use the new password in the email to log in.</p>
          ) : (
            <>
              <p>Email could not be sent{result.credentialsError ? `: ${result.credentialsError}` : ""}. Share the password below with the employee.</p>
              {result.temporaryPassword && (
                <p className="mt-2 flex items-center gap-2">
                  <strong>New password:</strong>
                  <code className="rounded bg-white/80 px-2 py-0.5 font-mono text-xs">{result.temporaryPassword}</code>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(result!.temporaryPassword!)}
                    className="rounded border border-amber-300 px-2 py-0.5 text-xs hover:bg-white/50"
                  >
                    Copy
                  </button>
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
