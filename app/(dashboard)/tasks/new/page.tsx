import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { can } from "@/lib/rbac/permissions";
import { TaskForm } from "@/components/tasks/TaskForm";

export default async function NewTaskPage() {
  if (!(await can("tasks.create"))) redirect("/dashboard");
  const supabase = await createServerSupabaseClient();
  const { data: regions } = await supabase.from("regions").select("id, name");
  const { data: pms } = await supabase.from("users_profile").select("id, full_name, email").eq("status", "ACTIVE");
  const { data: projects } = await supabase.from("projects").select("id, name, region_id");
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900">New task</h1>
      <TaskForm existing={null} regions={regions ?? []} pms={pms ?? []} projects={projects ?? []} currentUserId={user?.id} />
    </div>
  );
}
