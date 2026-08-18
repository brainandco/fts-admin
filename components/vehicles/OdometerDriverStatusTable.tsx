type DriverOdoStatusRow = {
  employeeId: string;
  name: string;
  region: string;
  plate: string | null;
  vehicleId: string | null;
  morning: {
    submitted: boolean;
    at: string | null;
    byName: string | null;
    km: number | null;
  };
  evening: {
    submitted: boolean;
    at: string | null;
    byName: string | null;
    km: number | null;
  };
};

function SlotCell({
  slot,
}: {
  slot: DriverOdoStatusRow["morning"];
}) {
  if (!slot.submitted) {
    return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">Pending</span>;
  }
  return (
    <div>
      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Submitted</span>
      <p className="mt-1 text-xs text-zinc-600">
        {slot.byName || "—"}
        {slot.at ? ` · ${new Date(slot.at).toLocaleString()}` : ""}
        {slot.km != null ? ` · ${slot.km.toLocaleString()} km` : ""}
      </p>
    </div>
  );
}

export function OdometerDriverStatusTable({
  date,
  rows,
}: {
  date: string;
  rows: DriverOdoStatusRow[];
}) {
  const pending = rows.filter((r) => r.vehicleId && (!r.morning.submitted || !r.evening.submitted)).length;
  const complete = rows.filter((r) => r.morning.submitted && r.evening.submitted).length;
  const noVehicle = rows.filter((r) => !r.vehicleId).length;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Driver/Rigger status — {date}</h2>
        <p className="text-sm text-zinc-600">
          Who is on duty (start photos saved) and who has ended (end photos saved). Night shifts that started yesterday
          still show here until they end.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-emerald-100 px-2 py-1 font-medium text-emerald-800">{complete} complete</span>
        <span className="rounded-full bg-amber-100 px-2 py-1 font-medium text-amber-900">{pending} pending</span>
        {noVehicle > 0 ? (
          <span className="rounded-full bg-zinc-100 px-2 py-1 font-medium text-zinc-700">{noVehicle} no vehicle</span>
        ) : null}
      </div>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2">Driver/Rigger</th>
              <th className="px-3 py-2">Region</th>
              <th className="px-3 py-2">Plate</th>
              <th className="px-3 py-2">Start duty</th>
              <th className="px-3 py-2">End duty</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-zinc-500">
                  No Driver/Rigger employees found.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.employeeId} className="border-t border-zinc-100">
                  <td className="px-3 py-2 font-medium text-zinc-900">{r.name}</td>
                  <td className="px-3 py-2 text-zinc-600">{r.region || "—"}</td>
                  <td className="px-3 py-2">{r.plate || "No vehicle assigned"}</td>
                  <td className="px-3 py-2">
                    {r.vehicleId ? <SlotCell slot={r.morning} /> : <span className="text-zinc-400">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    {r.vehicleId ? <SlotCell slot={r.evening} /> : <span className="text-zinc-400">—</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
