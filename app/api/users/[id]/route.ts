import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServerSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { requireSuper } from "@/lib/rbac/permissions";
import { auditLog } from "@/lib/audit/log";
import { getUserDependencies } from "@/lib/user-dependencies";

const SUPER_ROLE_ID = "a0000000-0000-0000-0000-000000000000";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const superAccess = await requireSuper();
  if (!superAccess.allowed) {
    return NextResponse.json({ message: "Only Super User can delete users." }, { status: 403 });
  }

  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { data: old } = await supabase.from("users_profile").select("*").eq("id", id).single();
  if (!old) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const { data: currentRoles } = await supabase.from("user_roles").select("role_id, assigned_by").eq("user_id", id);
  const superRoleRow = (currentRoles ?? []).find((r) => r.role_id === SUPER_ROLE_ID);
  const hasSuperRole = !!superRoleRow;
  const targetIsSuper = old.is_super_user || hasSuperRole;
  if (targetIsSuper) {
    if (old.is_super_user && !hasSuperRole) {
      return NextResponse.json({ message: "This super user cannot be deleted or demoted." }, { status: 400 });
    }
    const superAssignedBy = superRoleRow && "assigned_by" in superRoleRow ? (superRoleRow as { assigned_by: string | null }).assigned_by : null;
    if (superAssignedBy !== currentUser.id) {
      return NextResponse.json(
        { message: "Only the super user who assigned this user's super role can delete or demote them." },
        { status: 403 }
      );
    }
  }

  const dependencies = await getUserDependencies(supabase, id);
  if (!dependencies.canDeleteOrDisable) {
    return NextResponse.json(
      { message: dependencies.message, code: "USER_HAS_ASSIGNMENTS", blocks: dependencies.blocks },
      { status: 400 }
    );
  }

  await auditLog({
    actionType: "delete",
    entityType: "user",
    entityId: id,
    oldValue: old,
    description: "User deleted",
  });

  const admin = createServerSupabaseAdmin();
  const { error: authDelErr } = await admin.auth.admin.deleteUser(id);
  if (authDelErr) {
    return NextResponse.json(
      {
        message:
          authDelErr.message ||
          "Could not delete auth user. If this says a database error, run migration 00034 (FK cleanup) or remove rows referencing this user.",
      },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const superAccess = await requireSuper();
  if (!superAccess.allowed) return NextResponse.json({ message: "Only Super User can manage users and assign roles." }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const supabase = await createServerSupabaseClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { data: old } = await supabase.from("users_profile").select("*").eq("id", id).single();
  if (!old) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const { data: currentRoles } = await supabase.from("user_roles").select("role_id, assigned_by").eq("user_id", id);
  const superRoleRow = (currentRoles ?? []).find((r) => r.role_id === SUPER_ROLE_ID);
  const hasSuperRole = !!superRoleRow;
  const targetIsSuper = old.is_super_user || hasSuperRole;
  const superAssignedBy = superRoleRow && "assigned_by" in superRoleRow ? (superRoleRow as { assigned_by: string | null }).assigned_by : null;
  const currentUserCanDemoteThisSuper = hasSuperRole && superAssignedBy === currentUser.id;

  if (targetIsSuper && body.status !== undefined && !["ACTIVE", "DISABLED"].includes(String(body.status))) {
    return NextResponse.json({ message: "Super users can only be Active or Disabled." }, { status: 400 });
  }

  /** Invited users must accept before profile is Active; cannot be activated manually while invitation is pending. */
  if (body.status === "ACTIVE" && old.invitation_token && !old.invitation_accepted_at) {
    return NextResponse.json(
      { message: "This user must accept their invitation before they can be Active. Status updates automatically when they accept." },
      { status: 400 }
    );
  }

  if (Array.isArray(body.role_ids) && old.status === "PENDING_ACCESS") {
    return NextResponse.json(
      { message: "Assign roles after the user has accepted their invitation (status will be Active)." },
      { status: 400 }
    );
  }

  if (targetIsSuper && Array.isArray(body.role_ids) && !currentUserCanDemoteThisSuper) {
    return NextResponse.json(
      { message: "Only the super user who assigned this user's super role can demote them or change their roles." },
      { status: 403 }
    );
  }

  if (Array.isArray(body.role_ids)) {
    if (body.role_ids.length === 0) {
      return NextResponse.json({ message: "At least one role is required." }, { status: 400 });
    }
    if (body.role_ids.includes(SUPER_ROLE_ID)) {
      return NextResponse.json({ message: "Super User role cannot be assigned. There is only one super user (seeded)." }, { status: 400 });
    }
  }

  if (body.status === "DISABLED") {
    const dependencies = await getUserDependencies(supabase, id);
    if (!dependencies.canDeleteOrDisable) {
      return NextResponse.json(
        { message: dependencies.message, code: "USER_HAS_ASSIGNMENTS", blocks: dependencies.blocks },
        { status: 400 }
      );
    }
  }

  const profileUpdates: Record<string, unknown> = {};
  if (body.full_name !== undefined) profileUpdates.full_name = body.full_name || null;
  if (body.status !== undefined) profileUpdates.status = body.status;

  if (Object.keys(profileUpdates).length > 0) {
    const { error } = await supabase.from("users_profile").update(profileUpdates).eq("id", id);
    if (error) return NextResponse.json({ message: error.message }, { status: 400 });
    await auditLog({
      actionType: "update",
      entityType: "user",
      entityId: id,
      oldValue: old,
      newValue: { ...old, ...profileUpdates },
      description: "User updated",
    });
  }

  if (Array.isArray(body.role_ids)) {
    await supabase.from("user_roles").delete().eq("user_id", id);
    if (body.role_ids.length > 0) {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      await supabase.from("user_roles").insert(
        body.role_ids.map((role_id: string) => ({ user_id: id, role_id, assigned_by: currentUser?.id ?? null }))
      );
    }
    await auditLog({
      actionType: "roles_updated",
      entityType: "user",
      entityId: id,
      newValue: { role_ids: body.role_ids },
      description: "User roles updated",
    });
  }

  return NextResponse.json({ ok: true });
}
