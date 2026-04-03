import { can } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";

export default async function AssignToEmployeePage() {
  if (!(await can("assets.manage")) && !(await can("assets.assign"))) {
    redirect("/dashboard");
  }
  redirect("/assets");
}
