import { redirect } from "next/navigation";

export default function LegacyEhsAssignRedirect() {
  redirect("/assets/assign?tab=ehs");
}
