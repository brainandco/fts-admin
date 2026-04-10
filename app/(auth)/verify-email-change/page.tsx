"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, Suspense } from "react";

function VerifyEmailChangeInner() {
  const params = useSearchParams();
  const token = params.get("token")?.trim() ?? "";
  const [state, setState] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [message, setMessage] = useState("");
  const [newEmail, setNewEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState("err");
      setMessage("Missing verification link. Open the link from your email, or request a new email change from My profile.");
      return;
    }
    let cancelled = false;
    setState("loading");
    fetch("/api/profile/email-change/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setState("err");
          setMessage(typeof data.error === "string" ? data.error : "Verification failed.");
          return;
        }
        setState("ok");
        setMessage(typeof data.message === "string" ? data.message : "Your email was updated.");
        if (typeof data.email === "string") setNewEmail(data.email);
      })
      .catch(() => {
        if (!cancelled) {
          setState("err");
          setMessage("Something went wrong. Try again or request a new link from My profile.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-xl font-semibold text-slate-900">Confirm email change</h1>
      {state === "loading" && <p className="mt-4 text-sm text-slate-600">Verifying…</p>}
      {state === "ok" && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p>{message}</p>
          {newEmail && (
            <p className="mt-2">
              Sign in with: <strong>{newEmail}</strong>
            </p>
          )}
          <Link href="/login" className="mt-4 inline-block font-medium text-emerald-800 underline">
            Go to sign in
          </Link>
        </div>
      )}
      {state === "err" && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <p>{message}</p>
          <Link href="/settings/profile" className="mt-4 inline-block font-medium text-rose-800 underline">
            Back to My profile
          </Link>
        </div>
      )}
    </div>
  );
}

export default function VerifyEmailChangePage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-600">Loading…</p>}>
      <VerifyEmailChangeInner />
    </Suspense>
  );
}
