import { getDataClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/rbac/permissions";
import Link from "next/link";

async function safeCount(
  fn: () => PromiseLike<{ count: number | null }> | Promise<{ count: number | null }>
): Promise<number> {
  try {
    const { count } = await fn();
    return count ?? 0;
  } catch {
    return 0;
  }
}

export default async function DashboardPage() {
  const supabase = await getDataClient();
  const { profile } = await getCurrentUserProfile();
  const regionId = profile?.region_id ?? null;
  const isSuper = profile?.is_super_user ?? false;

  const employeesCount = await safeCount(async () => {
    const q = supabase.from("employees").select("id", { count: "exact", head: true }).eq("status", "ACTIVE");
    return q.then((r) => ({ count: r.count }));
  });

  const assetsCount = await safeCount(async () => {
    let q = supabase.from("assets").select("id", { count: "exact", head: true });
    if (regionId && !isSuper) q = q.eq("assigned_region_id", regionId);
    return q.then((r) => ({ count: r.count }));
  });

  const vehiclesCount = await safeCount(async () => {
    const q = supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("status", "Assigned");
    return q.then((r) => ({ count: r.count }));
  });

  const adminUsersCount = await safeCount(async () => {
    const q = supabase.from("users_profile").select("id", { count: "exact", head: true }).eq("status", "ACTIVE");
    return q.then((r) => ({ count: r.count }));
  });

  const tasksInProgress = await safeCount(async () => {
    let q = supabase.from("tasks").select("id", { count: "exact", head: true }).in("status", ["In_Progress", "Assigned_to_PM", "Assigned_to_User"]);
    if (regionId && !isSuper) q = q.eq("region_id", regionId);
    return q.then((r) => ({ count: r.count }));
  });

  const overdueTasks = await safeCount(async () => {
    let q = supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .lt("due_date", new Date().toISOString().slice(0, 10))
      .in("status", ["Draft", "Assigned_to_PM", "Assigned_to_User", "In_Progress", "Blocked"]);
    if (regionId && !isSuper) q = q.eq("region_id", regionId);
    return q.then((r) => ({ count: r.count }));
  });

  const upcomingMaintenance = await safeCount(() =>
    supabase
      .from("vehicles")
      .select("id", { count: "exact", head: true })
      .not("next_service_due_date", "is", null)
      .lte("next_service_due_date", new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
      .then((r) => ({ count: r.count }))
  );

  const groups: {
    label: string;
    cards: { title: string; value: number; href: string; accent: "indigo" | "violet" | "cyan" | "amber" | "rose" }[];
  }[] = [
    {
      label: "People & access",
      cards: [
        { title: "Active employees", value: employeesCount, href: "/employees", accent: "indigo" },
        { title: "Admin users", value: adminUsersCount, href: "/users", accent: "violet" },
      ],
    },
    {
      label: "Fleet & assets",
      cards: [
        { title: "Active assets", value: assetsCount, href: "/assets", accent: "cyan" },
        { title: "Assigned vehicles", value: vehiclesCount, href: "/vehicles", accent: "indigo" },
        { title: "Upcoming maintenance (30d)", value: upcomingMaintenance, href: "/vehicles", accent: "amber" },
      ],
    },
    {
      label: "Operations",
      cards: [
        { title: "Tasks in progress", value: tasksInProgress, href: "/tasks", accent: "indigo" },
        { title: "Overdue tasks", value: overdueTasks, href: "/tasks", accent: "rose" },
      ],
    },
  ];

  const accentBar: Record<string, string> = {
    indigo: "bg-indigo-500",
    violet: "bg-violet-500",
    cyan: "bg-cyan-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
  };

  return (
    <div className="space-y-10">
      <h1 className="sr-only">Dashboard</h1>
      <div className="max-w-3xl">
        <p className="text-base leading-relaxed text-slate-600">
          Snapshot of your workspace. Open any card to jump to the full list.
        </p>
      </div>

      <div className="space-y-10">
        {groups.map((group) => (
          <section key={group.label} className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">{group.label}</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {group.cards.map((card) => (
                <Link
                  key={card.title}
                  href={card.href}
                  className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-100/80"
                >
                  <span
                    className={`absolute left-0 top-0 h-full w-1 ${accentBar[card.accent]}`}
                    aria-hidden
                  />
                  <p className="pl-2 text-sm font-medium text-slate-500">{card.title}</p>
                  <p className="mt-2 pl-2 text-3xl font-semibold tabular-nums tracking-tight text-slate-900">
                    {card.value}
                  </p>
                  <span className="mt-4 pl-2 text-xs font-medium text-indigo-600 opacity-0 transition group-hover:opacity-100">
                    View →
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
