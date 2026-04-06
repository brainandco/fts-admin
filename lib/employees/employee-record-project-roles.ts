/**
 * Formal `employees.project_id` on the employee record:
 * — **Driver/Rigger** and **QC** are region-only (no project on the record).
 * — All other roles (DT, Self DT, PM, QA, PP, Project Coordinator, Other/custom, etc.) may have a project.
 *
 * Use `employee_roles.role` (canonical enum), not display labels from `formatEmployeeRoleDisplay`.
 */
const CANONICAL_ROLES_WITHOUT_FORMAL_PROJECT = new Set(["Driver/Rigger", "QC"]);

export function employeeMayHaveFormalProjectOnRecord(canonicalRole: string): boolean {
  const r = canonicalRole.trim();
  if (!r) return false;
  return !CANONICAL_ROLES_WITHOUT_FORMAL_PROJECT.has(r);
}
