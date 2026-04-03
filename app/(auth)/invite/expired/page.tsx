import Link from "next/link";

export default function InviteExpiredPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white px-4 py-12">
      <div className="mx-auto max-w-lg rounded-2xl border border-amber-200 bg-amber-50/80 p-8 shadow-sm">
        <h1 className="text-xl font-bold text-amber-950">Invitation expired</h1>
        <p className="mt-3 text-sm leading-relaxed text-amber-900/90">
          This admin invitation was only valid for 24 hours after it was sent. Ask a Super User to send a new invitation email; you will receive fresh login details and a new link.
        </p>
        <p className="mt-6">
          <Link
            href="/login"
            className="inline-flex rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-900"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
