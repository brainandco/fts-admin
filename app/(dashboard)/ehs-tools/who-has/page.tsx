import { redirect } from "next/navigation";

export default function LegacyEhsWhoHasRedirect() {
  redirect("/assets/who-has?tab=ehs");
}
