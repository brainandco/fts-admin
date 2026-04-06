import Link from "next/link";
import { redirect } from "next/navigation";
import { can } from "@/lib/rbac/permissions";
import { getDataClient } from "@/lib/supabase/server";

export default async function ReceiptConfirmationsPage() {
  const allowed =
    (await can("assets.manage")) ||
    (await can("assets.assign")) ||
    (await can("vehicles.manage")) ||
    (await can("vehicles.assign"));
  if (!allowed) redirect("/dashboard");

  const supabase = await getDataClient();
  const { data: rows } = await supabase
    .from("resource_receipt_confirmations")
    .select(
      "id, employee_id, resource_type, resource_id, status, confirmation_message, assigned_at, confirmed_at, assigned_by_user_id, receipt_image_urls"
    )
    .order("assigned_at", { ascending: false })
    .limit(500);

  const list = rows ?? [];
  const empIds = [...new Set(list.map((r) => r.employee_id))];
  const userIds = [...new Set(list.map((r) => r.assigned_by_user_id).filter(Boolean) as string[])];

  const [{ data: employees }, { data: assigners }] = await Promise.all([
    empIds.length ? supabase.from("employees").select("id, full_name").in("id", empIds) : { data: [] },
    userIds.length ? supabase.from("users_profile").select("id, full_name, email").in("id", userIds) : { data: [] },
  ]);

  const empMap = new Map((employees ?? []).map((e) => [e.id, e.full_name ?? "—"]));
  const assignerMap = new Map(
    (assigners ?? []).map((u) => [u.id, (u.full_name ?? u.email ?? "").trim() || "—"])
  );

  const assetIds = list.filter((r) => r.resource_type === "asset").map((r) => r.resource_id);
  const simIds = list.filter((r) => r.resource_type === "sim_card").map((r) => r.resource_id);
  const vehicleIds = list.filter((r) => r.resource_type === "vehicle").map((r) => r.resource_id);

  const [assetsRes, simsRes, vehiclesRes] = await Promise.all([
    assetIds.length ? supabase.from("assets").select("id, name, serial").in("id", assetIds) : { data: [] },
    simIds.length ? supabase.from("sim_cards").select("id, sim_number").in("id", simIds) : { data: [] },
    vehicleIds.length ? supabase.from("vehicles").select("id, plate_number").in("id", vehicleIds) : { data: [] },
  ]);

  const assetMap = new Map((assetsRes.data ?? []).map((a) => [a.id as string, a]));
  const simMap = new Map((simsRes.data ?? []).map((s) => [s.id as string, s]));
  const vehicleMap = new Map((vehiclesRes.data ?? []).map((v) => [v.id as string, v]));

  function resourceLabel(r: (typeof list)[0]): string {
    if (r.resource_type === "asset") {
      const a = assetMap.get(r.resource_id);
      return a ? `${a.name}${a.serial ? ` · ${a.serial}` : ""}` : r.resource_id;
    }
    if (r.resource_type === "sim_card") {
      const s = simMap.get(r.resource_id);
      return s ? String(s.sim_number) : r.resource_id;
    }
    const v = vehicleMap.get(r.resource_id);
    return v ? String(v.plate_number) : r.resource_id;
  }

  function resourceHref(r: (typeof list)[0]): string {
    if (r.resource_type === "asset") return `/assets/${r.resource_id}`;
    if (r.resource_type === "sim_card") return `/sims/${r.resource_id}`;
    return `/vehicles/${r.resource_id}`;
  }

  function receiptPhotoUrls(r: { receipt_image_urls?: unknown }): string[] {
    const u = r.receipt_image_urls;
    if (!Array.isArray(u)) return [];
    return u.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Receipt confirmations</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600">
          Employees confirm in the{" "}
          <span className="font-medium text-zinc-800">employee portal</span> (Confirm receipt) when they physically
          receive assigned tools, SIMs, or vehicles. This list shows pending and confirmed records for your oversight.
          For <span className="font-medium text-zinc-800">assets</span>, condition photos taken at confirmation appear in
          the Receipt photos column once the employee has confirmed.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-700">
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Resource</th>
              <th className="px-4 py-3 font-medium">Receipt photos</th>
              <th className="px-4 py-3 font-medium">Employee</th>
              <th className="px-4 py-3 font-medium">Assigned</th>
              <th className="px-4 py-3 font-medium">Confirmed</th>
              <th className="px-4 py-3 font-medium">Note</th>
              <th className="px-4 py-3 font-medium">Assigned by</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-zinc-500">
                  No receipt records yet. Assignments will appear here after employees confirm (or while still pending).
                </td>
              </tr>
            ) : (
              list.map((r) => (
                <tr key={r.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3">
                    <span
                      className={
                        r.status === "confirmed"
                          ? "rounded bg-emerald-100 px-2 py-0.5 text-emerald-900"
                          : "rounded bg-amber-100 px-2 py-0.5 text-amber-900"
                      }
                    >
                      {r.status === "confirmed" ? "Confirmed" : "Pending"}
                    </span>
                  </td>
                  <td className="px-4 py-3 capitalize text-zinc-700">
                    {r.resource_type === "sim_card" ? "SIM" : r.resource_type}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={resourceHref(r)} className="font-medium text-teal-700 hover:underline">
                      {resourceLabel(r)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 align-top">
                    {r.resource_type === "asset" ? (
                      (() => {
                        const urls = receiptPhotoUrls(r);
                        if (urls.length === 0) {
                          return (
                            <span className="text-zinc-400">
                              {r.status === "confirmed" ? "—" : "After confirm"}
                            </span>
                          );
                        }
                        return (
                          <div className="flex max-w-[220px] flex-wrap gap-1.5">
                            {urls.map((url) => (
                              <a
                                key={url}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block h-14 w-14 shrink-0 overflow-hidden rounded border border-zinc-200 bg-zinc-50 hover:opacity-90"
                                title="Open full size"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={url} alt="" className="h-full w-full object-cover" />
                              </a>
                            ))}
                          </div>
                        );
                      })()
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-800">{empMap.get(r.employee_id) ?? r.employee_id}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                    {r.assigned_at ? new Date(r.assigned_at).toLocaleString() : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                    {r.confirmed_at ? new Date(r.confirmed_at).toLocaleString() : "—"}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-zinc-600" title={r.confirmation_message ?? ""}>
                    {r.confirmation_message ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {r.assigned_by_user_id ? assignerMap.get(r.assigned_by_user_id) ?? "—" : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
