import { NextResponse } from "next/server";
import { can, getCurrentUserProfile } from "@/lib/rbac/permissions";

export async function requirePettyAdmin(write: boolean) {
  const { user, profile } = await getCurrentUserProfile();
  if (!user || !profile || profile.status !== "ACTIVE") {
    return { error: NextResponse.json({ message: "Unauthorized" }, { status: 401 }) };
  }
  const ok = write ? await can("employees.manage") : (await can("employees.manage")) || (await can("users.view"));
  if (!ok) return { error: NextResponse.json({ message: "Forbidden" }, { status: 403 }) };
  const name = profile.full_name?.trim() || user.email || "Admin";
  return { userId: user.id, name };
}
