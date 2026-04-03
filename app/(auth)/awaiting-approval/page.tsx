import { SignOutButton } from "./SignOutButton";

export default function AwaitingApprovalPage() {
  return (
    <div className="fts-auth-shell">
    <div className="relative z-10 w-full max-w-md fts-auth-card">
      <div className="fts-auth-panel px-8 py-9 text-center">
        <h1 className="text-xl font-bold text-slate-900">Awaiting approval</h1>
        <p className="mb-6 mt-2 text-sm text-slate-600">
          Your account has been created. An administrator must assign your region, role, and permissions before you can access the dashboard.
        </p>
        <SignOutButton />
      </div>
    </div>
    </div>
  );
}
