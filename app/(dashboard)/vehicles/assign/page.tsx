import { redirect } from "next/navigation";
import { can } from "@/lib/rbac/permissions";

export default async function AssignVehiclePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  if (!(await can("vehicles.manage"))) redirect("/dashboard");
  await searchParams;
  redirect("/vehicles");
}
