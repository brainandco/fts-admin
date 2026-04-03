import { getDataClient } from "@/lib/supabase/server";
import { can, getCurrentUserProfile } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import { DataTable } from "@/components/ui/DataTable";

export default async function ApprovalsPage() {
  if (!(await can("approvals.view"))) redirect("/dashboard");
  const { profile } = await getCurrentUserProfile();
  const isSuper = profile?.is_super_user === true;
  const supabase = await getDataClient();
  const { data: approvals } = await supabase
    .from("approvals")
    .select("id, approval_type, status, requester_id, created_at")
    .order("created_at", { ascending: false });

  const userIds = [...new Set((approvals ?? []).map((a) => a.requester_id))];
  const { data: profiles } = await supabase.from("users_profile").select("id, full_name, email").in("id", userIds);
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name || p.email]));

  const rowsRaw = (approvals ?? []).map((a) => ({
    ...a,
    requester_name: profileMap.get(a.requester_id) ?? a.requester_id,
  }));
  const rows = isSuper
    ? rowsRaw.filter((a) => !(a.approval_type === "leave_request" && a.status === "Submitted"))
    : rowsRaw;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900">Approvals</h1>
      <DataTable
        keyField="id"
        data={rows}
        hrefPrefix="/approvals/"
        filterKeys={["approval_type", "status"]}
        searchPlaceholder="Search approvals…"
        columns={[
          { key: "approval_type", label: "Type" },
          { key: "status", label: "Status" },
          { key: "requester_name", label: "Requester" },
          { key: "created_at", label: "Created", format: "datetime" },
        ]}
      />
    </div>
  );
}
