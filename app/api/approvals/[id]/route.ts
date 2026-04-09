import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDataClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { can, getCurrentUserProfile } from "@/lib/rbac/permissions";
import { auditLog } from "@/lib/audit/log";
import { createServerSupabaseAdmin } from "@/lib/supabase/admin";
import { fillLeavePerformaPdf } from "@/lib/leave/fill-leave-performa-pdf";
import { buildPerformaFillFromPayload } from "@/lib/leave/performa-from-payload";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const action = body.action;
  const comment = body.comment ?? "";
  if (!["approve", "reject"].includes(action)) return NextResponse.json({ message: "action must be approve or reject" }, { status: 400 });
  const supabase = await createServerSupabaseClient();
  const { data: approval } = await supabase.from("approvals").select("*").eq("id", id).single();
  if (!approval) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const { profile } = await getCurrentUserProfile();
  const isPm = approval.region_id && profile?.region_id === approval.region_id;
  const canApprove = await can("approvals.approve");
  const isSuper = profile?.is_super_user === true;
  const isAdminNonSuper = !isSuper && canApprove;

  const dataClient = await getDataClient();

  /** --- Leave: admin → filled performa → requester signs → super final --- */
  if (approval.approval_type === "leave_request") {
    if (approval.status === "Submitted" && isAdminNonSuper) {
      if (!String(comment).trim()) {
        return NextResponse.json({ message: "Admin remarks are required for leave requests" }, { status: 400 });
      }
      if (action === "reject") {
        const updates = {
          status: "Admin_Rejected",
          admin_acted_at: new Date().toISOString(),
          admin_acted_by: profile?.id,
          admin_comment: comment,
        };
        const { error } = await dataClient.from("approvals").update(updates).eq("id", id);
        if (error) return NextResponse.json({ message: error.message }, { status: 400 });
        await supabase.from("notifications").insert({
          recipient_user_id: approval.requester_id,
          title: "Leave request rejected by Admin",
          body: "Your leave request was rejected at admin review stage.",
          category: "leave_request",
          link: "/leave",
          meta: { approval_id: id, final_status: "Admin_Rejected" },
        });
        await auditLog({
          actionType: "approval_rejected",
          entityType: "approval",
          entityId: id,
          newValue: updates,
          description: "Leave rejected at admin stage",
        });
        return NextResponse.json({ ok: true });
      }

      const { data: template } = await dataClient
        .from("company_documents")
        .select("file_url")
        .eq("is_leave_performa_template", true)
        .maybeSingle();
      if (!template?.file_url) {
        return NextResponse.json(
          {
            message:
              "No leave performa PDF template is configured. Upload a PDF under Company documents and mark it as the leave performa template.",
          },
          { status: 400 }
        );
      }

      const genDate = new Date().toISOString().slice(0, 10);
      const fillData = buildPerformaFillFromPayload(approval.payload_json, genDate);
      if (!fillData?.requestor_full_name) {
        return NextResponse.json(
          { message: "Leave request is missing applicant snapshot data; cannot generate performa." },
          { status: 400 }
        );
      }

      const tplRes = await fetch(template.file_url as string);
      if (!tplRes.ok) {
        return NextResponse.json({ message: "Could not download the performa template file." }, { status: 400 });
      }
      const templateBytes = new Uint8Array(await tplRes.arrayBuffer());
      let pdfBytes: Uint8Array;
      try {
        pdfBytes = await fillLeavePerformaPdf(templateBytes, fillData);
      } catch {
        return NextResponse.json({ message: "Failed to process the PDF template (must be a valid PDF)." }, { status: 400 });
      }

      const admin = createServerSupabaseAdmin();
      const storagePath = `leave-performa/filled/${id}.pdf`;
      const { error: upErr } = await admin.storage.from("resource-photos").upload(storagePath, Buffer.from(pdfBytes), {
        contentType: "application/pdf",
        upsert: true,
      });
      if (upErr) return NextResponse.json({ message: upErr.message }, { status: 400 });
      const {
        data: { publicUrl },
      } = admin.storage.from("resource-photos").getPublicUrl(storagePath);

      const prevPayload =
        approval.payload_json && typeof approval.payload_json === "object" && !Array.isArray(approval.payload_json)
          ? { ...(approval.payload_json as Record<string, unknown>) }
          : {};
      const payload_json = {
        ...prevPayload,
        filled_performa_pdf_url: publicUrl,
        performa_generated_at: new Date().toISOString(),
      };

      const updates = {
        status: "Awaiting_Signed_Performa",
        admin_acted_at: new Date().toISOString(),
        admin_acted_by: profile?.id,
        admin_comment: comment,
        payload_json,
      };
      const { error } = await dataClient.from("approvals").update(updates).eq("id", id);
      if (error) return NextResponse.json({ message: error.message }, { status: 400 });

      await supabase.from("notifications").insert({
        recipient_user_id: approval.requester_id,
        title: "Leave performa ready",
        body: "Admin approved your leave in principle. Download the filled performa PDF from Leave, print and sign it, then upload the signed copy with a short note.",
        category: "leave_request",
        link: "/leave",
        meta: { approval_id: id, stage: "performa" },
      });

      await auditLog({
        actionType: "approval_approved",
        entityType: "approval",
        entityId: id,
        newValue: updates,
        description: "Leave admin approved — performa sent to requester",
      });
      return NextResponse.json({ ok: true });
    }

    if (approval.status === "Performa_Submitted" && isSuper) {
      if (!String(comment).trim()) {
        return NextResponse.json({ message: "Super user remarks are required for final leave decision" }, { status: 400 });
      }
      const newStatus = action === "approve" ? "Completed" : "PM_Rejected";
      const updates = {
        status: newStatus,
        pm_acted_at: new Date().toISOString(),
        pm_acted_by: profile?.id,
        pm_comment: comment,
      };
      const { error } = await dataClient.from("approvals").update(updates).eq("id", id);
      if (error) return NextResponse.json({ message: error.message }, { status: 400 });

      const { data: admins } = await supabase
        .from("users_profile")
        .select("id")
        .eq("status", "ACTIVE")
        .eq("is_super_user", false);
      const adminRows = (admins ?? []).map((u) => ({
        recipient_user_id: u.id,
        title: "Leave request final decision",
        body:
          newStatus === "Completed"
            ? "A leave request has been finally approved by super user."
            : "A leave request has been rejected by super user.",
        category: "leave_request",
        link: `/approvals/${id}`,
        meta: { approval_id: id, final_status: newStatus },
      }));
      await supabase.from("notifications").insert([
        ...adminRows,
        {
          recipient_user_id: approval.requester_id,
          title: "Your leave request was updated",
          body: newStatus === "Completed" ? "Your leave request is approved." : "Your leave request was rejected.",
          category: "leave_request",
          link: "/leave",
          meta: { approval_id: id, final_status: newStatus },
        },
      ]);

      await auditLog({
        actionType: action === "approve" ? "approval_approved" : "approval_rejected",
        entityType: "approval",
        entityId: id,
        newValue: updates,
        description: `Leave final super ${action}`,
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ message: "Forbidden or invalid state for leave workflow" }, { status: 403 });
  }

  /** --- Asset request: unchanged admin → super --- */
  if (approval.approval_type === "asset_request") {
    let newStatus: string;
    let updates: Record<string, unknown> = {};

    if (approval.status === "Submitted" && isAdminNonSuper) {
      if (!String(comment).trim()) {
        return NextResponse.json({ message: "Admin remarks are required for asset requests" }, { status: 400 });
      }
      newStatus = action === "approve" ? "Admin_Approved" : "Admin_Rejected";
      updates = {
        status: newStatus,
        admin_acted_at: new Date().toISOString(),
        admin_acted_by: profile?.id,
        admin_comment: comment,
      };
    } else if (approval.status === "Admin_Approved" && isSuper) {
      if (!String(comment).trim()) {
        return NextResponse.json({ message: "Super user remarks are required for final asset request decision" }, { status: 400 });
      }
      newStatus = action === "approve" ? "Completed" : "PM_Rejected";
      updates = {
        status: newStatus,
        pm_acted_at: new Date().toISOString(),
        pm_acted_by: profile?.id,
        pm_comment: comment,
      };
    } else {
      return NextResponse.json({ message: "Forbidden or invalid state for this approval workflow" }, { status: 403 });
    }

    const { error } = await supabase.from("approvals").update(updates).eq("id", id);
    if (error) return NextResponse.json({ message: error.message }, { status: 400 });

    const category = "asset_request";
    const requesterLink = "/dashboard/assets/request";

    if (approval.status === "Submitted" && newStatus === "Admin_Rejected") {
      await supabase.from("notifications").insert({
        recipient_user_id: approval.requester_id,
        title: "Asset request rejected by Admin",
        body: "Your asset request was rejected at admin review stage.",
        category,
        link: requesterLink,
        meta: { approval_id: id, final_status: newStatus },
      });
    }
    if (approval.status === "Submitted" && newStatus === "Admin_Approved") {
      const { data: supers } = await supabase
        .from("users_profile")
        .select("id")
        .eq("status", "ACTIVE")
        .eq("is_super_user", true);
      const rows = (supers ?? []).map((u) => ({
        recipient_user_id: u.id,
        title: "Asset request requires final review",
        body: "Admin reviewed and approved a PM asset request. Final super-user decision is needed.",
        category,
        link: `/approvals/${id}`,
        meta: { approval_id: id, stage: "super_review" },
      }));
      if (rows.length) await supabase.from("notifications").insert(rows);
      await supabase.from("notifications").insert({
        recipient_user_id: approval.requester_id,
        title: "Asset request moved to final approval",
        body: "Admin reviewed your asset request. It is now pending super-user final decision.",
        category,
        link: requesterLink,
        meta: { approval_id: id, stage: "super_review" },
      });
    }
    if (approval.status === "Admin_Approved" && (newStatus === "Completed" || newStatus === "PM_Rejected")) {
      const { data: admins } = await supabase
        .from("users_profile")
        .select("id")
        .eq("status", "ACTIVE")
        .eq("is_super_user", false);
      const adminRows = (admins ?? []).map((u) => ({
        recipient_user_id: u.id,
        title: "Asset request final decision",
        body:
          newStatus === "Completed"
            ? "A PM asset request has been finally approved by super user."
            : "A PM asset request has been rejected by super user.",
        category,
        link: `/approvals/${id}`,
        meta: { approval_id: id, final_status: newStatus },
      }));
      await supabase.from("notifications").insert([
        ...adminRows,
        {
          recipient_user_id: approval.requester_id,
          title: "Your asset request was updated",
          body: newStatus === "Completed" ? "Your asset request is approved." : "Your asset request was rejected.",
          category,
          link: requesterLink,
          meta: { approval_id: id, final_status: newStatus },
        },
      ]);
    }

    await auditLog({
      actionType: action === "approve" ? "approval_approved" : "approval_rejected",
      entityType: "approval",
      entityId: id,
      newValue: updates,
      description: `Approval ${action}`,
    });
    return NextResponse.json({ ok: true });
  }

  /** --- Other approval types --- */
  let newStatus: string;
  let updates: Record<string, unknown> = {};

  if (approval.status === "Submitted" && isPm) {
    newStatus = action === "approve" ? "PM_Approved" : "PM_Rejected";
    updates = { status: newStatus, pm_acted_at: new Date().toISOString(), pm_acted_by: profile?.id, pm_comment: comment };
  } else if ((approval.status === "PM_Approved" || approval.status === "Submitted") && (isSuper || canApprove)) {
    newStatus = action === "approve" ? (approval.admin_final_approver_enabled ? "Admin_Approved" : "Completed") : "Admin_Rejected";
    if (newStatus === "Admin_Approved") newStatus = "Completed";
    updates = { status: newStatus, admin_acted_at: new Date().toISOString(), admin_acted_by: profile?.id, admin_comment: comment };
  } else {
    return NextResponse.json({ message: "Forbidden or invalid state" }, { status: 403 });
  }

  const { error } = await supabase.from("approvals").update(updates).eq("id", id);
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });

  await auditLog({
    actionType: action === "approve" ? "approval_approved" : "approval_rejected",
    entityType: "approval",
    entityId: id,
    newValue: updates,
    description: `Approval ${action}`,
  });
  return NextResponse.json({ ok: true });
}
