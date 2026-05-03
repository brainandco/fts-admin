/**
 * Valid `employee_roles.role` values — must match DB CHECK (see migrations on employee_roles).
 * Use `Other` with `role_custom` for any label not in the fixed list.
 */
export const EMPLOYEE_ROLE_OTHER = "Other" as const;

export const ALLOWED_EMPLOYEE_ROLE_VALUES = [
  "DT",
  "Driver/Rigger",
  "Self DT",
  "QC",
  "QA",
  "PP",
  "Project Manager",
  "Project Coordinator",
  "Reporting Team",
  EMPLOYEE_ROLE_OTHER,
] as const;

export type AllowedEmployeeRole = (typeof ALLOWED_EMPLOYEE_ROLE_VALUES)[number];

const ALLOWED_SET = new Set<string>(ALLOWED_EMPLOYEE_ROLE_VALUES);

/** Roles that cannot occupy DT / Driver-Rigger team slots (includes custom "Other"). */
export const ROLES_NOT_ALLOWED_ON_TEAM = new Set<string>([
  "QC",
  "QA",
  "PP",
  "Project Manager",
  "Project Coordinator",
  "Reporting Team",
  EMPLOYEE_ROLE_OTHER,
]);

export function formatEmployeeRoleDisplay(
  role: string,
  roleCustom: string | null | undefined
): string {
  if (role === EMPLOYEE_ROLE_OTHER && roleCustom?.trim()) return roleCustom.trim();
  return role;
}

export type NormalizedEmployeeRole =
  | { ok: true; role: string; role_custom: string | null }
  | { ok: false; message: string };

/** POST/PATCH body: exactly one allowed role; `role_custom` required when role is Other (1–120 chars). */
export function normalizeEmployeeRolePayload(input: {
  roles: unknown;
  role_custom?: unknown;
}): NormalizedEmployeeRole {
  const roles = Array.isArray(input.roles)
    ? input.roles.filter((r): r is string => typeof r === "string")
    : [];
  const filtered = roles.map((r) => r.trim()).filter((r) => ALLOWED_SET.has(r));
  if (filtered.length !== 1) {
    return { ok: false, message: "Exactly one role is required." };
  }
  const role = filtered[0];
  if (role === EMPLOYEE_ROLE_OTHER) {
    const raw = typeof input.role_custom === "string" ? input.role_custom.trim() : "";
    if (!raw || raw.length > 120) {
      return { ok: false, message: "Other role: enter a description (1–120 characters)." };
    }
    return { ok: true, role, role_custom: raw };
  }
  return { ok: true, role, role_custom: null };
}

/** CSV `roles` cell: one role. Fixed enum, `Other:Label`, or any free text (stored as Other + custom). */
export function parseImportRoleToken(token: string): NormalizedEmployeeRole {
  const t = token.trim();
  if (!t) return { ok: false, message: "Empty role" };
  if (t === EMPLOYEE_ROLE_OTHER) {
    return {
      ok: false,
      message: 'Use "Other:Your role" or type the custom role text directly (e.g. Mechanic).',
    };
  }
  if (t.startsWith("Other:")) {
    const c = t.slice(6).trim();
    if (!c || c.length > 120) {
      return { ok: false, message: "Other: needs 1–120 characters after the colon." };
    }
    return { ok: true, role: EMPLOYEE_ROLE_OTHER, role_custom: c };
  }
  if (ALLOWED_SET.has(t) && t !== EMPLOYEE_ROLE_OTHER) {
    return { ok: true, role: t, role_custom: null };
  }
  if (t.length <= 120) {
    return { ok: true, role: EMPLOYEE_ROLE_OTHER, role_custom: t };
  }
  return { ok: false, message: "Role text too long (max 120 characters)." };
}

/** Grouped labels for create/edit employee UI. */
export const EMPLOYEE_ROLE_GROUPS: {
  heading: string;
  description?: string;
  options: { value: Exclude<AllowedEmployeeRole, "Other">; label: string }[];
}[] = [
  {
    heading: "Field operations",
    description: "Team-based field work",
    options: [
      { value: "DT", label: "DT (detailing / tools)" },
      { value: "Driver/Rigger", label: "Driver / Rigger" },
      { value: "Self DT", label: "Self DT (one person: DT + driver)" },
    ],
  },
  {
    heading: "Quality & projects",
    description: "Not assigned to DT/Driver team rows",
    options: [
      { value: "QC", label: "QC" },
      { value: "QA", label: "QA" },
      { value: "PP", label: "PP (post processor)" },
      { value: "Reporting Team", label: "Reporting Team" },
      { value: "Project Manager", label: "Project Manager" },
      { value: "Project Coordinator", label: "Project Coordinator" },
    ],
  },
];
