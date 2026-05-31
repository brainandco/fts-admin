import type { AuditActionCategory, AuditEntityType } from "@/lib/audit/types";

const SKIP_PATH_PREFIXES = [
  "/api/notifications/recent",
  "/api/auth/callback",
];

export function shouldSkipApiAudit(pathname: string): boolean {
  return SKIP_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/** Log GET only for file/export/browse endpoints to avoid noise from routine reads. */
export function shouldLogApiMethod(method: string, pathname: string): boolean {
  const m = method.toUpperCase();
  if (m !== "GET") return true;
  const p = pathname.toLowerCase();
  return (
    p.includes("download") ||
    p.includes("presign") ||
    p.includes("export") ||
    p.includes("folder-zip") ||
    p.includes("/browse") ||
    p.includes("multipart")
  );
}

export function inferFromApiRoute(
  method: string,
  pathname: string
): {
  actionType: string;
  entityType: AuditEntityType;
  actionCategory: AuditActionCategory;
  description: string;
} {
  const m = method.toUpperCase();
  const p = pathname.toLowerCase();

  if (p.includes("/auth/login")) {
    return { actionType: "login", entityType: "auth", actionCategory: "auth", description: "User signed in" };
  }
  if (p.includes("/auth/logout") || p.includes("/auth/signout")) {
    return { actionType: "logout", entityType: "auth", actionCategory: "auth", description: "User signed out" };
  }
  if (p.includes("/auth/register")) {
    return { actionType: "register", entityType: "auth", actionCategory: "auth", description: "User registration" };
  }

  if (p.includes("presign-batch") || p.includes("presign")) {
    return {
      actionType: "file_upload_init",
      entityType: "employee_file",
      actionCategory: "file",
      description: `${m} upload presign — ${pathname}`,
    };
  }
  if (p.includes("multipart-init") || p.includes("multipart-part-urls")) {
    return {
      actionType: "file_upload_multipart",
      entityType: "employee_file",
      actionCategory: "file",
      description: `${m} multipart upload — ${pathname}`,
    };
  }
  if (p.includes("multipart-complete") || p.includes("/complete-batch") || p.endsWith("/complete")) {
    return {
      actionType: "file_upload_complete",
      entityType: "employee_file",
      actionCategory: "file",
      description: `${m} upload complete — ${pathname}`,
    };
  }
  if (p.includes("/download") || p.includes("folder-zip") || p.includes("/zip-p/")) {
    return {
      actionType: "file_download",
      entityType: "employee_file",
      actionCategory: "file",
      description: `${m} download / zip — ${pathname}`,
    };
  }
  if (p.includes("/delete") && p.includes("file")) {
    return {
      actionType: "file_delete",
      entityType: "employee_file",
      actionCategory: "file",
      description: `${m} file delete — ${pathname}`,
    };
  }

  if (p.includes("/import/save") || p.includes("/import/parse")) {
    return {
      actionType: p.includes("/save") ? "import_save" : "import_parse",
      entityType: "import",
      actionCategory: "import",
      description: `${m} data import — ${pathname}`,
    };
  }
  if (p.includes("/exports")) {
    return {
      actionType: "export",
      entityType: "export",
      actionCategory: "export",
      description: `${m} data export — ${pathname}`,
    };
  }

  if (p.includes("/assign")) {
    return {
      actionType: "assign",
      entityType: "asset",
      actionCategory: "assignment",
      description: `${m} assignment — ${pathname}`,
    };
  }
  if (p.includes("/approvals/") || p.includes("/approval")) {
    return {
      actionType: m === "GET" ? "approval_view" : "approval_action",
      entityType: "approval",
      actionCategory: "approval",
      description: `${m} approval — ${pathname}`,
    };
  }
  if (p.includes("/leave")) {
    return {
      actionType: m === "POST" ? "leave_submit" : "leave_view",
      entityType: "leave",
      actionCategory: "approval",
      description: `${m} leave — ${pathname}`,
    };
  }

  if (p.includes("/assets")) {
    return {
      actionType: m === "POST" ? "create" : m === "DELETE" ? "delete" : m === "PATCH" || m === "PUT" ? "update" : "view",
      entityType: "asset",
      actionCategory: "data",
      description: `${m} asset API — ${pathname}`,
    };
  }
  if (p.includes("/employees")) {
    return {
      actionType: m === "POST" ? "create" : m === "DELETE" ? "delete" : m === "PATCH" || m === "PUT" ? "update" : "view",
      entityType: "employee",
      actionCategory: "data",
      description: `${m} employee API — ${pathname}`,
    };
  }
  if (p.includes("/vehicles")) {
    return {
      actionType: m === "POST" ? "create" : m === "DELETE" ? "delete" : "update",
      entityType: "vehicle",
      actionCategory: "data",
      description: `${m} vehicle API — ${pathname}`,
    };
  }
  if (p.includes("/sims")) {
    return {
      actionType: m === "POST" ? "create" : m === "DELETE" ? "delete" : "update",
      entityType: "sim_card",
      actionCategory: "data",
      description: `${m} sim API — ${pathname}`,
    };
  }

  const genericAction =
    m === "POST" ? "create" : m === "PUT" || m === "PATCH" ? "update" : m === "DELETE" ? "delete" : "api_access";

  return {
    actionType: genericAction,
    entityType: "api",
    actionCategory: "api",
    description: `${m} ${pathname}`,
  };
}
