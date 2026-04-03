import { createServerSupabaseClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { TaskForm } from "@/components/tasks/TaskForm";
import { EntityHistory } from "@/components/audit/EntityHistory";
import { TaskComments } from "@/components/tasks/TaskComments";

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: task } = await supabase.from("tasks").select("*").eq("id", id).single();
  if (!task) notFound();

  const { data: regions } = await supabase.from("regions").select("id, name");
  const { data: pms } = await supabase.from("users_profile").select("id, full_name, email").eq("status", "ACTIVE");
  const { data: projects } = await supabase.from("projects").select("id, name, region_id");
  const { data: comments } = await supabase.from("task_comments").select("id, user_id, body, created_at").eq("task_id", id).order("created_at", { ascending: false });
  const { data: { user } } = await supabase.auth.getUser();
  const userIds = [...new Set((comments ?? []).map((c) => c.user_id))];
  const { data: commenters } = await supabase.from("users_profile").select("id, full_name, email").in("id", userIds);
  const userMap = new Map((commenters ?? []).map((u) => [u.id, u.full_name || u.email]));

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/tasks" className="text-sm text-zinc-500 hover:text-zinc-900">← Tasks</Link>
        <h1 className="text-2xl font-semibold text-zinc-900">{task.title}</h1>
        <span className="rounded bg-zinc-200 px-2 py-0.5 text-sm text-zinc-700">{task.status}</span>
      </div>
      <section>
        <h2 className="mb-3 text-lg font-medium text-zinc-900">Edit task</h2>
        <TaskForm existing={task} regions={regions ?? []} pms={pms ?? []} projects={projects ?? []} currentUserId={user?.id} />
      </section>
      <TaskComments taskId={id} comments={comments ?? []} userMap={Object.fromEntries(userMap)} currentUserId={user?.id} />
      <EntityHistory entityType="task" entityId={id} />
    </div>
  );
}
