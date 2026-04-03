import Link from "next/link";

export default function AccountDisabledPage() {
  return (
    <div className="fts-auth-shell">
    <div className="relative z-10 w-full max-w-md px-4 fts-auth-card">
      <div className="fts-auth-panel px-8 py-9">
          <h1 className="text-lg font-bold text-slate-900">Account deactivated</h1>
          <p className="mt-2 text-sm text-slate-600">
            Your account has been deactivated or disabled. Please contact your administrator to restore access.
          </p>
          <Link
            href="/login"
            className="fts-btn-primary mt-6 block w-full rounded-xl py-3 text-center text-sm font-semibold text-white"
          >
            Back to login
          </Link>
      </div>
    </div>
    </div>
  );
}
