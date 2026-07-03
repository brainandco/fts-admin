"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchableSelect, type SearchableOption } from "@/components/ui/SearchableSelect";
import { getEhsToolType, type EhsWearRole } from "@/lib/assets/ehs-tool-catalog";

type EhsAsset = {
  id: string;
  asset_id: string | null;
  name: string | null;
  category: string | null;
  status: string;
  ehs_wear_role?: string | null;
  ehs_tool_type: string | null;
  en_code: string | null;
  assigned_to_employee_id?: string | null;
};

type SearchCatalogAsset = EhsAsset & { assigneeName: string | null };
type DtTeam = {
  teamId: string;
  teamName: string;
  dt: { id: string; full_name: string };
  driver: { id: string; full_name: string } | null;
};

function toolTypeKey(a: Pick<EhsAsset, "ehs_tool_type">): string {
  const def = a.ehs_tool_type ? getEhsToolType(a.ehs_tool_type) : undefined;
  return def?.label ?? a.ehs_tool_type ?? "Other";
}

function matchesSearch(a: EhsAsset, q: string): boolean {
  const tokens = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const hay = [a.asset_id, a.name, a.category, a.en_code, a.ehs_wear_role]
    .map((x) => (x ?? "").toLowerCase())
    .join(" ");
  return tokens.every((t) => hay.includes(t));
}

export function AdminBulkAssignEhsToolsClient({
  assets,
  searchCatalog,
  dtTeams,
}: {
  assets: EhsAsset[];
  searchCatalog: SearchCatalogAsset[];
  dtTeams: DtTeam[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [teamId, setTeamId] = useState("");
  const [assignWearRole, setAssignWearRole] = useState<EhsWearRole | "">("");
  const [activeType, setActiveType] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const teamOptions: SearchableOption[] = useMemo(
    () =>
      dtTeams.map((t) => ({
        id: t.teamId,
        label: `${t.teamName} — DT: ${t.dt.full_name}${t.driver ? ` · Driver: ${t.driver.full_name}` : ""}`,
      })),
    [dtTeams]
  );

  const selectedTeam = teamId ? dtTeams.find((t) => t.teamId === teamId) : undefined;

  const typeTabs = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of assets) {
      const key = toolTypeKey(a);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return ["All", ...Array.from(counts.keys()).sort((a, b) => a.localeCompare(b))];
  }, [assets]);

  const filteredAssets = useMemo(() => {
    const byType = activeType === "All" ? assets : assets.filter((a) => toolTypeKey(a) === activeType);
    return byType.filter((a) => matchesSearch(a, search));
  }, [assets, activeType, search]);

  const selectedRows = useMemo(() => {
    const map = new Map(assets.map((a) => [a.id, a]));
    return [...selected].map((id) => map.get(id)).filter(Boolean) as EhsAsset[];
  }, [selected, assets]);

  const needsDriver = assignWearRole === "driver_rigger";

  async function submit() {
    setError("");
    setMessage("");
    if (!selectedTeam) {
      setError("Select a team (DT).");
      return;
    }
    if (!assignWearRole) {
      setError("Select whether these tools are for DT or Driver/Rigger.");
      return;
    }
    if (selected.size === 0) {
      setError("Select at least one EHS tool.");
      return;
    }
    if (needsDriver && !selectedTeam.driver) {
      setError("Selected tools include Driver/Rigger wear items but this team has no driver.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/ehs-tools/bulk-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset_ids: [...selected],
          dt_employee_id: selectedTeam.dt.id,
          driver_employee_id: selectedTeam.driver?.id ?? null,
          assign_wear_role: assignWearRole,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? "Assign failed");
      setMessage(data.message ?? "Assigned.");
      setSelected(new Set());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assign failed");
    } finally {
      setSubmitting(false);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const catalogHits = useMemo(() => {
    if (!search.trim()) return [];
    return searchCatalog.filter((a) => matchesSearch(a, search)).slice(0, 20);
  }, [searchCatalog, search]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <label className="mb-1 block text-sm font-medium text-zinc-700">Assign to team (DT)</label>
        <SearchableSelect
          options={teamOptions}
          value={teamId}
          onChange={setTeamId}
          placeholder="Search team or DT name…"
        />
        {selectedTeam ? (
          <p className="mt-2 text-xs text-zinc-600">
            DT: <strong>{selectedTeam.dt.full_name}</strong>
            {selectedTeam.driver ? (
              <>
                {" "}
                · Driver/Rigger: <strong>{selectedTeam.driver.full_name}</strong>
              </>
            ) : (
              <span className="text-amber-700"> · No driver on team (Driver/Rigger tools cannot be assigned)</span>
            )}
          </p>
        ) : null}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <label className="mb-1 block text-sm font-medium text-zinc-700">Assign as</label>
        <select
          value={assignWearRole}
          onChange={(e) => setAssignWearRole(e.target.value as EhsWearRole | "")}
          className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">Select wear context…</option>
          <option value="dt">DT wear (held by DT)</option>
          <option value="driver_rigger">Driver / Rigger wear (held by DT, for team driver)</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        {typeTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveType(tab)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              activeType === tab ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by asset ID, EN code, type…"
        className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
      />

      {catalogHits.length > 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm">
          <p className="mb-2 font-medium text-zinc-700">Search matches</p>
          <ul className="space-y-1">
            {catalogHits.map((h) => (
              <li key={h.id} className="flex flex-wrap gap-2">
                <span className="font-mono text-xs">{h.asset_id}</span>
                <span>{h.name}</span>
                {h.assigneeName ? (
                  <span className="text-amber-800">Assigned to {h.assigneeName}</span>
                ) : (
                  <span className="text-emerald-700">In pool</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="max-h-[420px] overflow-y-auto rounded-xl border border-zinc-200">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 bg-zinc-50 text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-3 py-2">Select</th>
              <th className="px-3 py-2">Asset ID</th>
              <th className="px-3 py-2">Tool</th>
              <th className="px-3 py-2">EN</th>
            </tr>
          </thead>
          <tbody>
            {filteredAssets.map((a) => (
              <tr key={a.id} className="border-t border-zinc-100">
                <td className="px-3 py-2">
                  <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} />
                </td>
                <td className="px-3 py-2 font-mono text-xs">{a.asset_id}</td>
                <td className="px-3 py-2">{a.name}</td>
                <td className="px-3 py-2 text-xs">{a.en_code}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredAssets.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500">No available EHS tools match filters.</p>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <button
        type="button"
        disabled={submitting}
        onClick={submit}
        className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {submitting ? "Assigning…" : `Assign ${selected.size} tool(s) to DT`}
      </button>
    </div>
  );
}
