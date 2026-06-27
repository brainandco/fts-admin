import { NextResponse } from "next/server";
import { resolveApiAuthContext } from "@/lib/mobile/api-auth-context";

/** GET — admin mobile session (Bearer token). */
export async function GET(req: Request) {
  const ctx = await resolveApiAuthContext(req);
  if (!ctx) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    access: {
      kind: "admin_view" as const,
      email: ctx.profile.email,
      profileId: ctx.profile.id,
      fullName: ctx.profile.full_name,
      isSuperUser: ctx.isSuper,
      canViewApprovals: ctx.canViewApprovals,
      canApprove: ctx.canApprove,
      canReject: ctx.canReject,
    },
  });
}
