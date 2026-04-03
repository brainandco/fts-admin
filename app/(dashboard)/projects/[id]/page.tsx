import { createServerSupabaseClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ProjectForm } from "@/components/projects/ProjectForm";
import { EntityHistory } from "@/components/audit/EntityHistory";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: project } = await supabase.from("projects").select("*").eq("id", id).single();
  if (!project) notFound();
  const { data: teams } = await supabase.from("teams").select("id, name").eq("project_id", id);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/projects" className="text-sm text-zinc-500 hover:text-zinc-900">← Projects</Link>
        <h1 className="text-2xl font-semibold text-zinc-900">{project.name}</h1>
      </div>
      <section>
        <h2 className="mb-3 text-lg font-medium text-zinc-900">Edit project</h2>
        <ProjectForm existing={project} />
      </section>
      {teams && teams.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-medium text-zinc-900">Teams</h2>
          <ul className="space-y-1">
            {teams.map((t) => (
              <li key={t.id}>
                <Link href={`/teams/${t.id}`} className="text-blue-600 hover:underline">{t.name}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <EntityHistory entityType="project" entityId={id} />
    </div>
  );
}
