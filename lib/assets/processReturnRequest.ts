import type { SupabaseClient } from "@supabase/supabase-js";
import { auditLog } from "@/lib/audit/log";

export type ReturnDisposition = "Available" | "Under_Maintenance" | "Damaged";

export async function processAssetReturnRequest(
  supabase: SupabaseClient,
  requestId: string,
  processedByUserId: string,
  decision: ReturnDisposition,
  pmComment: string | null,
  options?: { skipAudit?: boolean }
): Promise<{ ok: true } | { ok: false; message: string }> {
  const trimmedPm = pmComment?.trim() ?? "";
  if (decision !== "Available") {
    if (!trimmedPm) {
      return { ok: false, message: "PM comment is required for Under Maintenance or Damaged." };
    }
  }

  const { data: row, error: fetchErr } = await supabase
    .from("asset_return_requests")
    .select("id, asset_id, status")
    .eq("id", requestId)
    .single();

  if (fetchErr || !row) return { ok: false, message: "Return request not found." };
  if (row.status !== "pending") return { ok: false, message: "This return was already processed." };

  const now = new Date().toISOString();
  const pm_comment =
    decision === "Available" ? (trimmedPm || null) : trimmedPm;

  const { error: updReqErr } = await supabase
    .from("asset_return_requests")
    .update({
      status: "processed",
      pm_decision: decision,
      pm_comment,
      processed_by_user_id: processedByUserId,
      processed_at: now,
    })
    .eq("id", requestId)
    .eq("status", "pending");

  if (updReqErr) return { ok: false, message: updReqErr.message };

  const { error: assetErr } = await supabase
    .from("assets")
    .update({
      status: decision,
      assigned_to_employee_id: null,
      assigned_by: null,
      assigned_at: null,
    })
    .eq("id", row.asset_id);

  if (assetErr) return { ok: false, message: assetErr.message };

  if (!options?.skipAudit) {
    await auditLog({
      actionType: "update",
      entityType: "asset",
      entityId: row.asset_id,
      newValue: { status: decision, return_request_id: requestId, pm_comment },
      description: `Asset return processed: ${decision}`,
    });
  }

  return { ok: true };
}
