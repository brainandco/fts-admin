/** Human-readable label for `employees.last_portal_credentials_email_source`. */
export function portalCredentialsSourceLabel(source: string | null | undefined): string {
  if (!source) return "";
  switch (source) {
    case "employee_resend":
      return "Employee page (Resend)";
    case "team_bulk":
      return "Team bulk email";
    case "employee_create":
      return "New employee (admin)";
    default:
      return source;
  }
}
