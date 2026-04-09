import { inclusiveCalendarDays } from "@/lib/employee-requests/leave-metrics";
import type { LeavePerformaFillInput } from "@/lib/leave/fill-leave-performa-pdf";

type Payload = Record<string, unknown>;

/** Build PDF field values from leave approval payload (snapshots set at application time). */
export function buildPerformaFillFromPayload(
  payloadJson: unknown,
  /** YYYY-MM-DD — usually the day admin generates the performa. */
  generatedDateIso: string
): LeavePerformaFillInput | null {
  const p = payloadJson && typeof payloadJson === "object" && !Array.isArray(payloadJson) ? (payloadJson as Payload) : null;
  if (!p) return null;
  const from = String(p.from_date ?? "").trim();
  const to = String(p.to_date ?? "").trim();
  const days = from && to ? String(inclusiveCalendarDays(from, to)) : "";

  return {
    requestor_full_name: String(p.requester_display_name ?? p.requester_name ?? "").trim(),
    requestor_date: generatedDateIso,
    requestor_iqama: String(p.requester_iqama ?? "").trim(),
    requestor_job_title: String(p.requester_job_title ?? "").trim(),
    requestor_project: String(p.requester_project_name ?? p.project_name_other ?? "").trim(),
    requestor_region: String(p.requester_region_name ?? "").trim(),
    leave_type: String(p.leave_type ?? "").trim(),
    guarantor_name: String(p.guarantor_display_name ?? "").trim(),
    guarantor_iqama: String(p.guarantor_iqama ?? "").trim(),
    guarantor_phone: String(p.guarantor_phone ?? "").trim(),
    guarantor_email: String(p.guarantor_email ?? "").trim(),
    guarantor_designation: String(p.guarantor_job_title ?? "").trim(),
    guarantor_project: String(p.guarantor_project_name ?? "").trim(),
    guarantor_region: String(p.guarantor_region_name ?? "").trim(),
    leave_start_date: from,
    leave_end_date: to,
    leave_total_days: days,
  };
}
