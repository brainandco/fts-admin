import { redirect } from "next/navigation";
import { can } from "@/lib/rbac/permissions";
import { EhsToolForm } from "@/components/ehs/EhsToolForm";
import Link from "next/link";

export default async function NewEhsToolPage() {
  if (!(await can("assets.manage"))) redirect("/dashboard");

  return (
    <div>
      <nav className="mb-4 flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/ehs-tools" className="hover:text-zinc-900">
          EHS Tools
        </Link>
        <span aria-hidden>/</span>
        <span className="text-zinc-900">Add tool</span>
      </nav>
      <h1 className="mb-4 text-2xl font-semibold text-zinc-900">Add EHS tool</h1>
      <p className="mb-6 text-sm text-zinc-500">
        No serial, IMEI, or model — each unit gets a unique ASTEHS ID with a unified EN code per tool type. Intake photos are optional here; the assigned employee uploads condition photos when confirming receipt.
      </p>
      <EhsToolForm existing={null} />
    </div>
  );
}
