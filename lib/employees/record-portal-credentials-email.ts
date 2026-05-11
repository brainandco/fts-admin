import { getDataClient } from "@/lib/supabase/server";

export type PortalCredentialsEmailSource = "employee_resend" | "team_bulk" | "employee_create";

/** Persist tracking after a credentials email was delivered (SMTP path succeeded). */
export async function recordPortalCredentialsEmailSent(
  employeeId: string,
  source: PortalCredentialsEmailSource
): Promise<void> {
  const supabase = await getDataClient();
  await supabase
    .from("employees")
    .update({
      last_portal_credentials_email_sent_at: new Date().toISOString(),
      last_portal_credentials_email_source: source,
    })
    .eq("id", employeeId);
}

export async function recordTeamBulkCredentialsEmailSent(teamId: string, actorUserId: string | null): Promise<void> {
  const supabase = await getDataClient();
  await supabase
    .from("teams")
    .update({
      last_team_credentials_email_sent_at: new Date().toISOString(),
      last_team_credentials_email_sent_by: actorUserId,
    })
    .eq("id", teamId);
}
