import { redirect } from "next/navigation";
import { can } from "@/lib/rbac/permissions";

export default async function AssignSimsPage() {
  if (!(await can("assets.manage")) && !(await can("assets.assign"))) {
    redirect("/dashboard");
  }
  redirect("/sims");
}
