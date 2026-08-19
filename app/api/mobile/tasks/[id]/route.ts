import { NextResponse } from "next/server";
import { resolveApiAuthContext } from "@/lib/mobile/api-auth-context";
import { getDataClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

async function displayNameForUser(
  supabase: Awaited<ReturnType<typeof getDataClient>>,
  userId: string,
  currentUserId: string
): Promise<string> {
  if (userId === currentUserId) return "You";

  const { data: profile } = await supabase
    .from("users_profile")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();
  const fromProfile = profile?.full_name?.trim() || profile?.email?.trim();
  if (fromProfile) return fromProfile;

  if (profile?.email) {
    const { data: emp } = await supabase
      .from("employees")
      .select("full_name")
      .eq("email", profile.email.trim().toLowerCase())
      .maybeSingle();
    if (emp?.full_name?.trim()) return emp.full_name.trim();
  }

  return "Team";
}

/** GET — admin mobile task detail + comments (read-only). */
export async function GET(req: Request, { params }: Params) {
  const ctx = await resolveApiAuthContext(req);
  if (!ctx) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const canViewTasks = ctx.isSuper || ctx.permissions.has("tasks.view_all") || ctx.permissions.has("tasks.edit");
  if (!canViewTasks) {
    return NextResponse.json({ message: "You do not have access to tasks." }, { status: 403 });
  }

  const { id } = await params;
  const supabase = await getDataClient();
  const { data: task } = await supabase
    .from("tasks")
    .select("id, title, description, status, priority, due_date, region_id, created_at, closed_at")
    .eq("id", id)
    .maybeSingle();

  if (!task) return NextResponse.json({ message: "Not found" }, { status: 404 });
  if (ctx.profile.region_id && !ctx.isSuper && task.region_id !== ctx.profile.region_id) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const { data: commentRows } = await supabase
    .from("task_comments")
    .select("id, body, created_at, user_id")
    .eq("task_id", id)
    .order("created_at", { ascending: true });

  const comments = await Promise.all(
    (commentRows ?? []).map(async (c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.created_at,
      authorName: await displayNameForUser(supabase, c.user_id, ctx.userId),
      isMine: c.user_id === ctx.userId,
    }))
  );

  return NextResponse.json({
    task: {
      id: task.id,
      title: task.title,
      description: task.description ?? null,
      status: task.status,
      priority: task.priority ?? null,
      dueDate: task.due_date ?? null,
      createdAt: task.created_at,
      closedAt: task.closed_at ?? null,
      regionId: task.region_id ?? null,
    },
    comments,
  });
}
