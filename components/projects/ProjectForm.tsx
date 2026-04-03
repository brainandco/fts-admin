"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type ProjectType = "MS" | "Rollout" | "Huawei Minor" | "Other";
type Project = { id: string; name: string; project_type: string; description: string | null } | null;

/** Operators are independent of type: same list for all types (MS, Rollout, Huawei Minor, Other). */
const OPERATORS_INDEPENDENT = ["Zain", "STC", "Mobily", "Salam", "Other"];
const OPERATORS_FOR_HUAWEI_MINOR = ["Huawei Minor", "Other"];
function getOperators(projectType: ProjectType): string[] {
  return projectType === "Huawei Minor" ? OPERATORS_FOR_HUAWEI_MINOR : OPERATORS_INDEPENDENT;
}

const TYPES: ProjectType[] = ["MS", "Rollout", "Huawei Minor", "Other"];

function getTypeLabel(projectType: ProjectType, customType: string): string {
  return projectType === "Other" ? customType : projectType;
}

function getOperatorLabel(operator: string, customOperator: string): string {
  return operator === "Other" ? customOperator : operator;
}

function buildName(projectType: ProjectType, operator: string, customType: string, customOperator: string): string {
  const typeLabel = getTypeLabel(projectType, customType);
  const operatorLabel = getOperatorLabel(operator, customOperator);
  if (projectType === "Huawei Minor" && operator !== "Other") return "Huawei Minor";
  if (!typeLabel.trim() || !operatorLabel.trim()) return "";
  return `${operatorLabel.trim()} ${typeLabel.trim()}`;
}

const KNOWN_TYPES: ProjectType[] = ["MS", "Rollout", "Huawei Minor"];

export function ProjectForm({ existing }: { existing: Project }) {
  const router = useRouter();
  const isKnownType = existing && KNOWN_TYPES.includes(existing.project_type as ProjectType);
  const [projectType, setProjectType] = useState<ProjectType>(isKnownType ? (existing!.project_type as ProjectType) : (existing?.project_type ? "Other" : "MS"));
  const [customType, setCustomType] = useState(existing && !KNOWN_TYPES.includes(existing.project_type as ProjectType) ? existing.project_type : "");
  const operators = getOperators(projectType);
  const typeSuffix = projectType === "Other" ? customType : projectType;
  const existingOperator = existing
    ? typeSuffix && existing.name.endsWith(typeSuffix)
      ? existing.name.slice(0, -typeSuffix.length).trim()
      : existing.name.split(" ")[0] ?? ""
    : "";
  const [operator, setOperator] = useState(() => {
    if (existingOperator && operators.includes(existingOperator)) return existingOperator;
    if (existingOperator) return "Other";
    return operators[0] ?? "";
  });
  const [customOperator, setCustomOperator] = useState(existingOperator && !operators.includes(existingOperator) ? existingOperator : "");
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!existing) setName(buildName(projectType, operator, customType, customOperator));
  }, [projectType, operator, customType, customOperator, !!existing]);

  function handleTypeChange(newType: ProjectType) {
    setProjectType(newType);
    const ops = getOperators(newType);
    const first = ops[0] ?? "";
    setOperator(first);
    if (newType !== "Other") setCustomType("");
    if (!existing) setName(buildName(newType, first, newType === "Other" ? customType : "", operator === "Other" ? customOperator : ""));
  }

  function handleOperatorChange(newOperator: string) {
    setOperator(newOperator);
    if (newOperator !== "Other") setCustomOperator("");
    if (!existing) setName(buildName(projectType, newOperator, customType, newOperator === "Other" ? customOperator : ""));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const typeLabel = getTypeLabel(projectType, customType).trim();
    const operatorLabel = getOperatorLabel(operator, customOperator).trim();
    if (projectType === "Other" && !typeLabel) {
      setError("Enter a custom type name when Type is Other.");
      return;
    }
    if (operator === "Other" && !operatorLabel) {
      setError("Enter a custom operator name when Operator is Other.");
      return;
    }
    const finalName = name.trim() || (operatorLabel && typeLabel ? `${operatorLabel} ${typeLabel}` : "");
    if (!finalName) {
      setError("Name is required.");
      return;
    }
    setError("");
    setSaving(true);
    const url = existing ? `/api/projects/${existing.id}` : "/api/projects";
    const res = await fetch(url, {
      method: existing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: finalName,
        project_type: typeLabel,
        description: description || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.message || "Failed to save");
      return;
    }
    router.push("/projects");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="max-w-md space-y-4 rounded-lg border border-zinc-200 bg-white p-6">
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Type</label>
        <select
          value={projectType}
          onChange={(e) => handleTypeChange(e.target.value as ProjectType)}
          className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      {projectType === "Other" && (
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Custom type name</label>
          <input
            value={customType}
            onChange={(e) => { setCustomType(e.target.value); if (!existing) setName(buildName(projectType, operator, e.target.value, customOperator)); }}
            placeholder="e.g. New Project Type"
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
      )}
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Operator / Variant</label>
        <select
          value={operator}
          onChange={(e) => handleOperatorChange(e.target.value)}
          className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
        >
          {operators.map((op) => (
            <option key={op} value={op}>{op}</option>
          ))}
        </select>
        <p className="mt-1 text-xs text-zinc-500">
          Same for all types: Zain, STC, Mobily, Salam. Use Other to add a new operator in future.
        </p>
      </div>
      {operator === "Other" && (
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Custom operator name</label>
          <input
            value={customOperator}
            onChange={(e) => { setCustomOperator(e.target.value); if (!existing) setName(buildName(projectType, operator, customType, e.target.value)); }}
            placeholder="e.g. New Operator"
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
      )}
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
          placeholder="e.g. STC MS, Zain Rollout"
        />
        <p className="mt-1 text-xs text-zinc-500">Shown when assigning employees, teams, vehicles. You can edit if needed.</p>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full rounded border border-zinc-300 px-3 py-2 text-sm" />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
          {saving ? "Saving…" : existing ? "Update" : "Create"}
        </button>
        <button type="button" onClick={() => router.back()} className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">Cancel</button>
      </div>
    </form>
  );
}
