import { requireActive } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import { AdminProfileSettings } from "@/components/profile/AdminProfileSettings";

export default async function AdminProfilePage() {
  const access = await requireActive();
  if (!access.allowed || !access.profile || !access.user?.email) {
    redirect("/login");
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold text-slate-900">My profile</h1>
      <p className="mb-8 text-sm text-slate-600">
        Update how you appear in the admin portal, your profile photo, and your password.
      </p>
      <AdminProfileSettings
        initialFullName={access.profile.full_name}
        email={access.user.email}
        initialAvatarUrl={access.profile.avatar_url ?? null}
      />
    </div>
  );
}
