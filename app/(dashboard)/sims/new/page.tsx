import { redirect } from "next/navigation";
import { can } from "@/lib/rbac/permissions";
import { SimForm } from "@/components/sims/SimForm";

export default async function NewSimPage() {
  if (!(await can("assets.manage"))) redirect("/dashboard");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-zinc-900">Add SIM card</h1>
      <p className="text-sm text-zinc-600">Capture operator, SIM number, and service type. Assign it afterward from the SIM assign page.</p>
      <SimForm existing={null} />
    </div>
  );
}
