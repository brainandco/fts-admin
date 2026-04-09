import { can, getCurrentUserProfile } from "@/lib/rbac/permissions";
import { getDataClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CompanyDocumentsClient } from "./CompanyDocumentsClient";

export default async function CompanyDocumentsPage() {
  const { profile } = await getCurrentUserProfile();
  const isSuper = profile?.is_super_user === true;
  const okAdmin = await can("approvals.approve");
  if (!isSuper && !okAdmin) redirect("/dashboard");

  const supabase = await getDataClient();
  const { data: docs } = await supabase
    .from("company_documents")
    .select("id, title, description, file_url, file_name, mime_type, is_leave_performa_template, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 p-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Company documents</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Store internal reference files and the leave performa PDF template. Only Super Users and Admins with approval
          access can view this page.
        </p>
        <Link href="/dashboard" className="mt-3 inline-block text-sm text-indigo-700 hover:underline">
          ← Dashboard
        </Link>
      </div>
      <CompanyDocumentsClient initialDocs={docs ?? []} />
    </div>
  );
}
