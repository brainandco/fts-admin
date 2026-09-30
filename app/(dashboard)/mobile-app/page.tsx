import { MobileAppDownloadCard } from "@/components/mobile/MobileAppDownloadCard";
import { FTS_EMPLOYEE_APP_STORE } from "@/lib/mobile-app-links";

export default function MobileAppPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Mobile app</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Official <strong className="font-medium text-slate-800">FTS Employee</strong> apps for iOS and Android.
          Field staff and project managers sign in with the same employee portal account used on{" "}
          <span className="font-mono text-xs text-slate-700">employee.fts-ksa.com</span>.
        </p>
      </div>

      <MobileAppDownloadCard audience="admin" />

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-sm font-semibold text-slate-800">Store links</h2>
        <p className="mt-1 text-sm text-slate-600">Copy or open these when onboarding staff.</p>
        <ul className="mt-4 space-y-3 text-sm">
          <li className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Apple App Store</p>
            <a
              href={FTS_EMPLOYEE_APP_STORE.ios.href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 break-all font-medium text-teal-700 hover:text-teal-900 hover:underline"
            >
              {FTS_EMPLOYEE_APP_STORE.ios.href}
            </a>
          </li>
          <li className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Google Play</p>
            <a
              href={FTS_EMPLOYEE_APP_STORE.android.href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 break-all font-medium text-teal-700 hover:text-teal-900 hover:underline"
            >
              {FTS_EMPLOYEE_APP_STORE.android.href}
            </a>
          </li>
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-slate-800">What the app covers</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-600">
          <li>Assigned assets, vehicles, SIMs, and EHS safety tools</li>
          <li>Receipt confirmations and returns with condition photos</li>
          <li>Leave, transfers, tasks, and push notifications</li>
          <li>Project Manager workflows: assign and track by team</li>
        </ul>
      </section>
    </div>
  );
}
