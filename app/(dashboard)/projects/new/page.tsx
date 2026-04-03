import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { can } from "@/lib/rbac/permissions";
import { ProjectForm } from "@/components/projects/ProjectForm";

export default async function NewProjectPage() {
  if (!(await can("projects.manage"))) redirect("/dashboard");
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900">New project</h1>
      <ProjectForm existing={null} />
    </div>
  );
}
