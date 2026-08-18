import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import { DRIVER_RIGGER_ROLE, driverPortalEmail, normalizeIqama } from "./driver-iqama";

export type DriverLoginSheetRow = {
  Name: string;
  Iqama: string;
  Phone: string;
  Password: string;
  "Login with": string;
  "Portal URL": string;
  Status: string;
  Notes: string;
};

export type ProvisionDriverLoginsResult = {
  rows: DriverLoginSheetRow[];
  okCount: number;
  errorCount: number;
  workbook: Buffer;
};

function randomPassword(length = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < length; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

function portalLoginUrl(): string {
  const override = (process.env.EMPLOYEE_PORTAL_PUBLIC_URL || "").trim().replace(/\/$/, "");
  const base = override || "https://employee.fts-ksa.com";
  const withScheme = /^https?:\/\//i.test(base) ? base : `https://${base}`;
  return `${withScheme.replace(/\/$/, "")}/login`;
}

function createAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required");
  }
  return createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function loadAuthEmailMap(admin: ReturnType<typeof createAdmin>): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const users = data?.users ?? [];
    for (const u of users) {
      const email = (u.email ?? "").trim().toLowerCase();
      if (email && u.id) map.set(email, u.id);
    }
    if (users.length < 200) break;
  }
  return map;
}

export function workbookFromDriverLoginRows(rows: DriverLoginSheetRow[]): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 28 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
    { wch: 36 },
    { wch: 10 },
    { wch: 42 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Driver Rigger logins");
  const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.from(out as ArrayBuffer);
}

/**
 * Set a random password for every ACTIVE Driver/Rigger and return a one-time sheet.
 * Does not email drivers. Does not force password change (sheet stays valid).
 */
export async function provisionDriverRiggerLogins(): Promise<ProvisionDriverLoginsResult> {
  const admin = createAdmin();
  const portalUrl = portalLoginUrl();
  const authByEmail = await loadAuthEmailMap(admin);

  const { data: roleRows, error: roleErr } = await admin
    .from("employee_roles")
    .select("employee_id")
    .eq("role", DRIVER_RIGGER_ROLE);
  if (roleErr) throw new Error(roleErr.message);

  const ids = [...new Set((roleRows ?? []).map((r) => r.employee_id as string).filter(Boolean))];
  if (ids.length === 0) {
    return { rows: [], okCount: 0, errorCount: 0, workbook: workbookFromDriverLoginRows([]) };
  }

  const { data: employees, error: empErr } = await admin
    .from("employees")
    .select("id, full_name, email, phone, iqama_number, status")
    .in("id", ids)
    .eq("status", "ACTIVE")
    .order("full_name", { ascending: true });
  if (empErr) throw new Error(empErr.message);

  const rows: DriverLoginSheetRow[] = [];
  let okCount = 0;
  let errorCount = 0;

  for (const emp of employees ?? []) {
    const name = (emp.full_name ?? "").trim() || "—";
    const phone = (emp.phone ?? "").trim();
    const iqama = normalizeIqama(String(emp.iqama_number ?? ""));
    const base = {
      Name: name,
      Iqama: iqama || String(emp.iqama_number ?? ""),
      Phone: phone,
      Password: "",
      "Login with": iqama || "Iqama missing",
      "Portal URL": portalUrl,
    };

    if (!iqama) {
      errorCount += 1;
      rows.push({ ...base, Status: "ERROR", Notes: "Missing Iqama number" });
      continue;
    }

    const email = driverPortalEmail(iqama, emp.email);
    try {
      const { data: clash } = await admin.from("employees").select("id, email").eq("email", email).limit(5);
      const other = (clash ?? []).filter((r) => r.id !== emp.id);
      if (other.length > 0) {
        errorCount += 1;
        rows.push({
          ...base,
          Status: "ERROR",
          Notes: `Email ${email} already used by another employee`,
        });
        continue;
      }

      const currentEmail = (emp.email ?? "").trim().toLowerCase();
      if (currentEmail !== email) {
        const { error: updEmailErr } = await admin.from("employees").update({ email }).eq("id", emp.id);
        if (updEmailErr) throw new Error(updEmailErr.message);
      }

      const password = randomPassword(12);
      let portalUserId = authByEmail.get(email) ?? null;

      if (portalUserId) {
        const { data: profile } = await admin
          .from("users_profile")
          .select("is_super_user, employee_portal_only")
          .eq("id", portalUserId)
          .maybeSingle();
        if (profile?.is_super_user) {
          errorCount += 1;
          rows.push({
            ...base,
            Status: "ERROR",
            Notes: "This email belongs to a Super User — password not changed",
          });
          continue;
        }
        if (profile && profile.employee_portal_only === false) {
          errorCount += 1;
          rows.push({
            ...base,
            Status: "ERROR",
            Notes: "This email is an admin login — password not changed",
          });
          continue;
        }
        const { error: pwErr } = await admin.auth.admin.updateUserById(portalUserId, { password });
        if (pwErr) throw new Error(pwErr.message);
      } else {
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        if (createErr) throw new Error(createErr.message);
        portalUserId = created?.user?.id ?? null;
        if (!portalUserId) throw new Error("Auth user created without id");
        authByEmail.set(email, portalUserId);
      }

      const { error: profileErr } = await admin.from("users_profile").upsert(
        {
          id: portalUserId,
          email,
          full_name: name === "—" ? null : name,
          status: "ACTIVE",
          employee_portal_only: true,
          must_change_password: false,
        },
        { onConflict: "id" }
      );
      if (profileErr) throw new Error(profileErr.message);

      await admin.from("employees").update({ must_change_password: false }).eq("id", emp.id);

      okCount += 1;
      rows.push({
        ...base,
        Password: password,
        Status: "OK",
        Notes: "Share Iqama + this password one by one. Do not email.",
      });
    } catch (e) {
      errorCount += 1;
      rows.push({
        ...base,
        Status: "ERROR",
        Notes: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  return {
    rows,
    okCount,
    errorCount,
    workbook: workbookFromDriverLoginRows(rows),
  };
}
