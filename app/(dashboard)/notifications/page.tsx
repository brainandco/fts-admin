import { createServerSupabaseClient } from "@/lib/supabase/server";
import { can } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";

export default async function NotificationsPage() {
  if (!(await can("users.view"))) redirect("/dashboard");
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) redirect("/login");

  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, title, body, category, is_read, created_at, link")
    .eq("recipient_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900">Notifications</h1>
      {!(notifications ?? []).length ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-500">No notifications.</div>
      ) : (
        <ul className="space-y-3">
          {(notifications ?? []).map((n) => (
            <li key={n.id} className={`rounded-lg border p-4 ${n.is_read ? "border-zinc-200 bg-white" : "border-indigo-200 bg-indigo-50/40"}`}>
              <p className="font-medium text-zinc-900">{n.title}</p>
              <p className="mt-1 text-sm text-zinc-600">{n.body}</p>
              <p className="mt-1 text-xs text-zinc-500">{new Date(n.created_at).toLocaleString()}</p>
              {n.link ? <a href={n.link} className="mt-2 inline-block text-xs text-indigo-700 hover:text-indigo-900">Open</a> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
