import { redirect } from "next/navigation";
import { requireActive } from "@/lib/rbac/permissions";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const access = await requireActive();
  if (access.allowed) {
    redirect("/dashboard");
  }
  return <LoginForm />;
}
