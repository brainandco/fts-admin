import { can, getCurrentUserProfile } from "@/lib/rbac/permissions";
import { getDataClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SoftwareLibraryClient } from "./SoftwareLibraryClient";

export default async function SoftwareLibraryPage() {
  const { profile } = await getCurrentUserProfile();
  const isSuper = profile?.is_super_user === true;
  const okAdmin = await can("approvals.approve");
  if (!isSuper && !okAdmin) redirect("/dashboard");

  const supabase = await getDataClient();
  const { data: items } = await supabase
    .from("portal_software")
    .select("id, title, description, file_name, mime_type, byte_size, upload_status, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 to-cyan-50 p-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Software library</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Upload installers and tools to Wasabi storage (direct browser upload; large files supported). Active entries appear in
          the employee portal under <span className="font-medium">Software library</span> for anyone who can sign in there.
          Configure Wasabi bucket CORS for PUT from this admin origin if uploads fail.
        </p>
        <Link href="/dashboard" className="mt-3 inline-block text-sm text-teal-800 hover:underline">
          ← Dashboard
        </Link>
      </div>
      <SoftwareLibraryClient initialItems={items ?? []} />
    </div>
  );
}
