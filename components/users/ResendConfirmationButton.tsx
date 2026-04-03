"use client";

import { useState } from "react";

export function ResendConfirmationButton({ userId, label = "Resend confirmation email" }: { userId: string; label?: string }) {
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleClick() {
    setLoading(true);
    setError("");
    setLink(null);
    try {
      const res = await fetch("/api/auth/resend-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "Failed to generate link");
        return;
      }
      setLink(data.confirmation_url ?? null);
      if (!data.confirmation_url) setError("No link returned");
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  }

  function copyLink() {
    if (!link) return;
    navigator.clipboard.writeText(link);
  }

  const open = link !== null || error !== "";

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="rounded border border-amber-200 bg-white px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50"
      >
        {loading ? "Generating…" : label}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => { setLink(null); setError(""); }}
        >
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-medium text-zinc-900">Confirmation link</h3>
            {error ? (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            ) : link ? (
              <>
                <p className="mt-2 text-sm text-zinc-600">Send this link to the user so they can confirm their email. The link may expire after some time.</p>
                <textarea readOnly value={link} className="mt-3 w-full rounded border border-zinc-300 px-3 py-2 font-mono text-xs" rows={4} />
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={copyLink} className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
                    Copy link
                  </button>
                  <a href={link} target="_blank" rel="noreferrer" className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                    Open link
                  </a>
                </div>
              </>
            ) : null}
            <button type="button" onClick={() => { setLink(null); setError(""); }} className="mt-4 text-sm text-zinc-500 hover:text-zinc-900">
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
