"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function AcceptInvitationInner() {
  const searchParams = useSearchParams();
  const tokenFromUrl = (searchParams.get("token") ?? "").trim();
  const [token, setToken] = useState(tokenFromUrl);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [boot, setBoot] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const autoAcceptTried = useRef(false);

  useEffect(() => {
    if (tokenFromUrl) setToken(tokenFromUrl);
  }, [tokenFromUrl]);

  const tryAccept = useCallback(
    async (t: string) => {
      setWorking(true);
      setMessage(null);
      try {
        const res = await fetch("/api/invite/accept", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(t ? { token: t } : {}),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          window.location.replace("/dashboard");
          return true;
        }
        setMessage(typeof data.message === "string" ? data.message : "Could not accept invitation");
        return false;
      } finally {
        setWorking(false);
      }
    },
    []
  );

  const refresh = useCallback(async () => {
    const res = await fetch("/api/invite/status", { credentials: "include" });
    const data = await res.json().catch(() => ({}));
    setBoot(false);

    if (!data.authenticated) return;

    if (data.gateOk) {
      window.location.replace("/dashboard");
      return;
    }
    if (data.reason === "invitation_expired") {
      window.location.replace("/invite/expired");
      return;
    }
    if (data.reason === "invitation_pending" && !autoAcceptTried.current) {
      autoAcceptTried.current = true;
      const ok = await tryAccept(tokenFromUrl);
      if (!ok) autoAcceptTried.current = false;
    }
  }, [tokenFromUrl, tryAccept]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    setMessage(null);
    const redirectPath =
      tokenFromUrl || token
        ? `/invite/accept?token=${encodeURIComponent((tokenFromUrl || token).trim())}`
        : "/invite/accept";
    try {
      const fd = new FormData();
      fd.set("email", email.trim());
      fd.set("password", password);
      fd.set("redirectTo", redirectPath);
      const res = await fetch("/api/auth/login", {
        method: "POST",
        body: fd,
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        const target = (data.redirectTo as string) ?? redirectPath;
        window.location.href = "/api/auth/callback?next=" + encodeURIComponent(target);
        return;
      }
      setMessage(data.error || "Login failed");
    } finally {
      setWorking(false);
    }
  }

  if (boot) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-zinc-600">Checking your session…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-zinc-900">Accept admin invitation</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          Sign in with the email and password from your invitation email, then your access is confirmed. Invitations expire 24 hours after they are sent.
        </p>

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Invitation token (optional)</label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value.trim())}
              placeholder="Filled automatically if you used the email link"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-xs"
            />
            <p className="mt-1 text-xs text-zinc-500">
              If you opened this page without the email link, paste the token from the invitation email or ask for a new invitation after 24 hours.
            </p>
          </div>
          <button
            type="submit"
            disabled={working}
            className="w-full rounded-lg bg-teal-800 py-2.5 text-sm font-semibold text-white hover:bg-teal-900 disabled:opacity-50"
          >
            {working ? "Working…" : "Sign in & continue"}
          </button>
        </form>

        <div className="mt-6 border-t border-zinc-100 pt-6">
          <p className="text-xs text-zinc-500">Already signed in?</p>
          <button
            type="button"
            disabled={working}
            onClick={() => void tryAccept(token.trim())}
            className="mt-2 w-full rounded-lg border border-zinc-300 bg-zinc-50 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100 disabled:opacity-50"
          >
            {working ? "Working…" : "Accept invitation now"}
          </button>
        </div>

        {message && (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{message}</p>
        )}
      </div>
      <p className="text-center text-sm text-zinc-500">
        <Link href="/login" className="font-medium text-teal-800 underline">
          Back to login
        </Link>
      </p>
    </div>
  );
}

export function AcceptInvitationClient() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-zinc-600">Loading…</p>
        </div>
      }
    >
      <AcceptInvitationInner />
    </Suspense>
  );
}
