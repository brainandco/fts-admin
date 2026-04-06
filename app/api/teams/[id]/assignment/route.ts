import { getDataClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { requireSuper } from "@/lib/rbac/permissions";
import { auditLog } from "@/lib/audit/log";

/**
 * PATCH — Super User only. Assign region and formal project to a team (after creation).
 * Region is where the team operates; the project catalog is not region-specific.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const superResult = await requireSuper();
  if (!superResult.allowed) {
    return NextResponse.json({ message: "Only Super User can assign region and project to teams." }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const regionRaw = body.region_id;
  const projectRaw = body.project_id;

  const region_id =
    regionRaw === null || regionRaw === ""
      ? null
      : typeof regionRaw === "string"
        ? regionRaw.trim() || null
        : null;
  const project_id =
    projectRaw === null || projectRaw === ""
      ? null
      : typeof projectRaw === "string"
        ? projectRaw.trim() || null
        : null;

  const supabase = await getDataClient();
  const { data: old, error: fetchErr } = await supabase.from("teams").select("*").eq("id", id).single();
  if (fetchErr || !old) return NextResponse.json({ message: "Not found" }, { status: 404 });

  if (region_id && project_id) {
    const { data: proj, error: pErr } = await supabase.from("projects").select("id").eq("id", project_id).single();
    if (pErr || !proj) return NextResponse.json({ message: "Invalid project" }, { status: 400 });
  }
  if (project_id && !region_id) {
    return NextResponse.json({ message: "Select a region before assigning a project to this team." }, { status: 400 });
  }

  const updates = { region_id, project_id };

  const { error } = await supabase.from("teams").update(updates).eq("id", id);
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });

  await auditLog({
    actionType: "update",
    entityType: "team",
    entityId: id,
    oldValue: old,
    newValue: { ...old, ...updates },
    description: "Team region and project assignment updated",
  });

  return NextResponse.json({ ok: true });
}
