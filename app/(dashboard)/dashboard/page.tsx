import { getDataClient } from "@/lib/supabase/server";
import { countActiveAdminPortalUsers, getTotalFtsPeopleCount } from "@/lib/admin-portal-user-counts";
import { can, getCurrentUserProfile } from "@/lib/rbac/permissions";
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
  const showCompanyDocuments = isSuper || (await can("approvals.approve"));

  const employeesCount = await safeCount(async () => {
    const q = supabase.from("employees").select("id", { count: "exact", head: true }).eq("status", "ACTIVE");
    return q.then((r) => ({ count: r.count }));
  });

  const assetsCount = await safeCount(async () => {
    let q = supabase.from("assets").select("id", { count: "exact", head: true });
    if (regionId && !isSuper) q = q.eq("assigned_region_id", regionId);
    return q.then((r) => ({ count: r.count }));
  });

  const simsCount = await safeCount(async () => {
    const q = supabase.from("sim_cards").select("id", { count: "exact", head: true });
    return q.then((r) => ({ count: r.count }));
  });

  const totalVehiclesCount = await safeCount(async () => {
    let q = supabase.from("vehicles").select("id", { count: "exact", head: true });
    if (regionId && !isSuper) q = q.eq("assigned_region_id", regionId);
    return q.then((r) => ({ count: r.count }));
  });

  const assignedVehiclesCount = await safeCount(async () => {
    let q = supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("status", "Assigned");
    if (regionId && !isSuper) q = q.eq("assigned_region_id", regionId);
    return q.then((r) => ({ count: r.count }));
  });

  const adminUsersCount = await countActiveAdminPortalUsers(supabase);
  const totalFtsPeople = await getTotalFtsPeopleCount(supabase);

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

  const showLeaveRequestStats =
    (await can("approvals.view")) || (await can("approvals.approve")) || (await can("approvals.reject"));
  const leavePendingCount = showLeaveRequestStats
    ? await safeCount(async () => {
        const q = supabase
          .from("approvals")
          .select("id", { count: "exact", head: true })
          .eq("approval_type", "leave_request")
          .in("status", ["Submitted", "Awaiting_Signed_Performa", "Performa_Submitted"]);
        return q.then((r) => ({ count: r.count }));
      })
    : 0;
  const leaveApprovedCount = showLeaveRequestStats
    ? await safeCount(async () => {
        const q = supabase
          .from("approvals")
          .select("id", { count: "exact", head: true })
          .eq("approval_type", "leave_request")
          .eq("status", "Completed");
        return q.then((r) => ({ count: r.count }));
      })
    : 0;

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
    cards: {
      title: string;
      value: number;
      href: string;
      accent: "teal" | "indigo" | "violet" | "cyan" | "amber" | "rose" | "emerald";
    }[];
  }[] = [
    {
      label: "People & access",
      cards: [
        {
          title: "Total FTS people",
          value: totalFtsPeople,
          href: "/people",
          accent: "teal",
        },
        { title: "Active employees", value: employeesCount, href: "/employees", accent: "indigo" },
        { title: "Admin users", value: adminUsersCount, href: "/users", accent: "violet" },
      ],
    },
    {
      label: "Fleet & assets",
      cards: [
        { title: "Active assets", value: assetsCount, href: "/assets", accent: "cyan" },
        { title: "Total vehicles", value: totalVehiclesCount, href: "/vehicles", accent: "indigo" },
        { title: "Assigned vehicles", value: assignedVehiclesCount, href: "/vehicles", accent: "violet" },
        { title: "Total SIMs", value: simsCount, href: "/sims", accent: "emerald" },
        { title: "Upcoming maintenance (30d)", value: upcomingMaintenance, href: "/vehicles", accent: "amber" },
      ],
    },
    {
      label: "Operations",
      cards: [
        ...(showLeaveRequestStats
          ? [
              {
                title: "Leave requests (pending)",
                value: leavePendingCount,
                href: "/approvals",
                accent: "amber" as const,
              },
              {
                title: "Leave requests (approved)",
                value: leaveApprovedCount,
                href: "/approvals",
                accent: "emerald" as const,
              },
            ]
          : []),
        { title: "Tasks in progress", value: tasksInProgress, href: "/tasks", accent: "indigo" },
        { title: "Overdue tasks", value: overdueTasks, href: "/tasks", accent: "rose" },
      ],
    },
  ];

  const accentBar: Record<string, string> = {
    teal: "bg-teal-500",
    indigo: "bg-indigo-500",
    violet: "bg-violet-500",
    cyan: "bg-cyan-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
    emerald: "bg-emerald-500",
  };

  return (
    <div className="space-y-10">
      <h1 className="sr-only">Dashboard</h1>
      <div className="max-w-3xl">
        <p className="text-base leading-relaxed text-slate-600">
          Snapshot of your workspace. Open any card to jump to the full list.
        </p>
      </div>

      {showCompanyDocuments ? (
        <section className="max-w-3xl rounded-xl border border-indigo-200/90 bg-indigo-50/40 p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-slate-800">Company documents</h2>
          <p className="mt-1 text-sm text-slate-600">
            Upload internal files and the leave performa PDF template (Super Users and admins with approval access).
          </p>
          <Link
            href="/company-documents"
            className="mt-3 inline-flex text-sm font-medium text-indigo-700 hover:text-indigo-900 hover:underline"
          >
            Open company documents →
          </Link>
        </section>
      ) : null}

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
