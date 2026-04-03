import { DelegationsContent } from "@/components/delegate/DelegationsContent";

export default function DelegatePage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900">Delegate</h1>
      <p className="mb-4 text-sm text-zinc-600">
        When you are unavailable, you can delegate your permissions to another admin user for a date range. They will have your permissions in addition to their own during that period.
      </p>
      <DelegationsContent />
    </div>
  );
}
