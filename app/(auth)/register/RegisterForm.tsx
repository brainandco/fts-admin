"use client";

import { useState } from "react";
import Link from "next/link";

export function RegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, full_name: fullName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Registration failed");
        setLoading(false);
        return;
      }
      if (data.signInRequired) {
        setError("");
        setLoading(false);
        window.location.href = "/login?message=" + encodeURIComponent("Account created. Sign in with your email and password.");
        return;
      }
      window.location.href = "/api/auth/callback?next=" + encodeURIComponent("/dashboard");
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="relative z-10 w-full max-w-md fts-auth-card">
      <div className="fts-auth-panel px-8 py-9">
          <h1 className="mb-2 text-xl font-bold text-slate-900">Register</h1>
          <p className="mb-6 text-sm text-slate-600">Create an account, then sign in anytime with your email and password.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="fullName" className="mb-1 block text-sm font-medium text-slate-700">Full name</label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="fts-input w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="fts-input w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="fts-input w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              />
            </div>
            {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="fts-btn-primary w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Registering…" : "Register"}
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-slate-600">
            Already have an account? <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-800">Sign in</Link>
          </p>
          <p className="mt-2 text-center text-sm text-slate-600">
            <Link href="/dashboard" className="font-medium text-indigo-600 hover:text-indigo-800">Back to dashboard</Link>
          </p>
      </div>
    </div>
  );
}
