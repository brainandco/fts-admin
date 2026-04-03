"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });

      if (resetError) {
        setError(resetError.message);
      } else {
        setMessage("If this email exists, a reset link has been sent.");
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
          <h1 className="mb-2 text-xl font-bold text-slate-900">Forgot password</h1>
          <p className="mb-6 text-sm text-slate-600">Enter your email and we will send a password reset link.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="fts-input w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              />
            </div>

            {message && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-200">{message}</p>}
            {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="fts-btn-primary w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send reset link"}
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
