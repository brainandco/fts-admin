"use client";

import Image from "next/image";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function IconShield() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function IconClipboard() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  );
}

function LoginFormInner() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const message = searchParams.get("message");
  const redirectTo = searchParams.get("redirect") ?? "/dashboard";
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const email = (fd.get("email") as string)?.trim();
    const password = fd.get("password") as string;
    if (!email || !password) {
      setSubmitError("Email and password required");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        body: fd,
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        const target = data.redirectTo ?? redirectTo;
        window.location.href = "/api/auth/callback?next=" + encodeURIComponent(target);
        return;
      }
      setSubmitError(data?.error || (res.ok ? "Something went wrong" : `Login failed (${res.status})`));
      setLoading(false);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-white lg:flex-row">
      <aside className="relative order-2 flex min-h-[260px] flex-1 flex-col justify-center overflow-hidden border-t border-teal-100 bg-teal-50/80 px-8 py-10 sm:min-h-[300px] lg:order-1 lg:min-h-screen lg:w-[48%] lg:max-w-none lg:border-r lg:border-t-0 lg:px-12 xl:px-16">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="fts-login-blob absolute -right-10 top-6 h-52 w-52 rounded-full bg-teal-200/80" />
          <div className="fts-login-blob fts-login-blob--2 absolute bottom-12 -left-8 h-44 w-44 rounded-full bg-emerald-200/70" />
          <div className="fts-login-blob fts-login-blob--3 absolute left-[35%] top-[38%] h-28 w-28 rounded-full bg-cyan-200/55" />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-md space-y-6 fts-login-stagger lg:max-w-lg">
          <div className="relative h-12 w-44 sm:h-14 sm:w-52">
            <Image
              src="/New%20Folder/black.png"
              alt="Fast Technology Solutions"
              fill
              sizes="(max-width: 1024px) 176px, 208px"
              className="object-contain object-left"
              priority
            />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-800">Administration</p>
          <h2 className="text-3xl font-bold leading-tight tracking-tight text-slate-900 xl:text-4xl">Welcome back</h2>
          <p className="text-base leading-relaxed text-slate-600">
            Run regions, teams, assets, and approvals from one secure workspace built for your operations.
          </p>
          <ul className="space-y-4 pt-2">
            <li className="flex gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-200/90 text-teal-900 shadow-sm">
                <IconShield />
              </span>
              <span className="text-sm leading-snug text-slate-700">
                <span className="font-semibold text-slate-800">Enterprise-grade access</span>
                <span className="mt-0.5 block text-slate-600">Role-based permissions and audited sign-in.</span>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-200/90 text-teal-900 shadow-sm">
                <IconUsers />
              </span>
              <span className="text-sm leading-snug text-slate-700">
                <span className="font-semibold text-slate-800">People & organization</span>
                <span className="mt-0.5 block text-slate-600">Employees, delegates, and teams in sync.</span>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-200/90 text-teal-900 shadow-sm">
                <IconClipboard />
              </span>
              <span className="text-sm leading-snug text-slate-700">
                <span className="font-semibold text-slate-800">Tasks & workflows</span>
                <span className="mt-0.5 block text-slate-600">Approvals and asset lifecycle in one place.</span>
              </span>
            </li>
          </ul>
        </div>
      </aside>

      <div className="order-1 flex flex-1 flex-col justify-center bg-slate-50 px-4 py-10 sm:px-8 lg:order-2 lg:min-h-screen lg:flex-[1.05] lg:px-12 xl:px-16">
        <div className="mx-auto w-full max-w-md fts-auth-card">
          <div className="fts-auth-panel border-slate-200/90 px-8 py-9 shadow-lg shadow-slate-200/50">
            <div className="mb-6 text-center lg:text-left">
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">Fast Technology Solutions</p>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Admin Portal</h1>
              <p className="mt-2 text-sm text-slate-600">Sign in with your work email and password.</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <div className="fts-animate-in-delayed">
                <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="fts-input w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                />
              </div>
              <div className="fts-animate-in-delayed">
                <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  className="fts-input w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                />
              </div>
              <div className="text-right">
                <Link
                  href="/forgot-password"
                  className="text-sm font-medium text-teal-700 transition-colors hover:text-teal-900"
                >
                  Forgot password?
                </Link>
              </div>
              {message && <p className="text-sm font-medium text-emerald-600">{decodeURIComponent(message)}</p>}
              {(error || submitError) && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
                  {submitError ?? (error ? decodeURIComponent(error) : "")}
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="fts-btn-primary w-full rounded-xl py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LoginForm() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 text-sm font-medium text-slate-500">
          Loading…
        </div>
      }
    >
      <LoginFormInner />
    </Suspense>
  );
}
