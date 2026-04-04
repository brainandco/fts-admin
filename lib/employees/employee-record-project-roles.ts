/**
 * Roles that may have `employees.region_id` and `employees.project_id` (project must belong to that region).
 * Super User sets these on Region & project assignments. Other roles are region-only on the record.
 */
export const EMPLOYEE_RECORD_PROJECT_ROLES = new Set([
  "Project Manager",
  "QA",
  "PP",
  "Project Coordinator",
  "Self DT",
]);
