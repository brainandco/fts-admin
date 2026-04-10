import { DelegationsContent } from "@/components/delegate/DelegationsContent";

export default function DelegatePage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900">Delegate</h1>
      <p className="mb-4 text-sm text-zinc-600">
        Delegation is only between admin accounts (not employee accounts). When you are unavailable, you can delegate your permissions to another admin for a date range; they will have your permissions in addition to their own during that period. Regular admins cannot delegate to a Super User; Super Users may delegate to other Super Users or to admins.
      </p>
      <DelegationsContent />
    </div>
  );
}
