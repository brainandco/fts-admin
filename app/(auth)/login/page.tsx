import { redirect } from "next/navigation";
import { requireActive } from "@/lib/rbac/permissions";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const access = await requireActive();
  if (access.allowed) {
    redirect("/dashboard");
  }
  if (access.reason === "invitation_pending") {
    redirect("/invite/accept");
  }
  if (access.reason === "invitation_expired") {
    redirect("/invite/expired");
  }
  return <LoginForm />;
}
