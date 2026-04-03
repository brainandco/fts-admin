"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
      } else {
        setMessage("Password updated successfully. You can now sign in.");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fts-auth-shell">
    <div className="relative z-10 w-full max-w-md fts-auth-card">
      <div className="fts-auth-panel px-8 py-9">
          <h1 className="mb-2 text-xl font-bold text-slate-900">Reset password</h1>
          <p className="mb-6 text-sm text-slate-600">Set your new password.</p>

          {!ready && !message && (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Open this page from the password reset link sent to your email.
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">New password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="fts-input w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-slate-700">Confirm password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="fts-input w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              />
            </div>

            {message && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-200">{message}</p>}
            {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p>}

            <button
              type="submit"
              disabled={loading || !ready}
              className="fts-btn-primary w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Updating…" : "Update password"}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-600">
            Back to <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-800">Sign in</Link>
          </p>
      </div>
    </div>
    </div>
  );
}
