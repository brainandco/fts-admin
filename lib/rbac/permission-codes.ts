/** Stable RBAC codes (match `public.permissions.code`). Safe to import from client components. */

export const PERMISSION_BULK_DELETE = "bulk_delete.execute";

export const PERMISSION_EMPLOYEE_ASSIGN_REGION_PROJECT = "employees.assign_region_project";

/** Create, edit, delete employees; import; PM extra regions / same as users.edit for employee APIs where applicable. */
export const PERMISSION_EMPLOYEE_MANAGE = "employees.manage";

/**
 * Region employee-file folders + browse all employee uploads in admin (Employee files + PP final reports).
 * Granted to Administrator, Regional Project Manager (see migration 00061), and any custom role via Settings → Roles.
 */
export const PERMISSION_EMPLOYEE_FILES_MANAGE = "employee_files.manage";
