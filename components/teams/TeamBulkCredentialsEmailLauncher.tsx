"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { InfoModal } from "@/components/ui/InfoModal";

type ResultRow = {
  employeeId: string;
  role: "dt" | "driver_rigger";
  email?: string;
  fullName?: string;
  credentialsSent?: boolean;
  credentialsError?: string;
  temporaryPassword?: string;
  error?: string;
};

type ApiResponse = {
  message?: string;
  results?: ResultRow[];
  summary?: {
    credentialsEmailedOk: number;
    emailDeliveryFailed: number;
    otherErrors: number;
  };
};

function roleLabel(r: ResultRow["role"]) {
  return r === "dt" ? "DT" : "Driver/Rigger";
}

function buildResultMessage(data: ApiResponse): string {
  if (data.message && !data.results) return data.message;
  const lines: string[] = [];
  if (data.summary) {
    lines.push(
      `Emailed OK: ${data.summary.credentialsEmailedOk} · Email failed: ${data.summary.emailDeliveryFailed} · Other errors: ${data.summary.otherErrors}`
    );
  }
  for (const r of data.results ?? []) {
    const head = `${roleLabel(r.role)}${r.fullName ? `: ${r.fullName}` : ""}${r.email ? ` (${r.email})` : ""}`;
    if (r.error) lines.push(`${head}\n  ${r.error}`);
    else if (r.credentialsSent) lines.push(`${head}\n  Credentials email sent.`);
    else {
      lines.push(
        `${head}\n  Email not delivered${r.credentialsError ? `: ${r.credentialsError}` : ""}.` +
          (r.temporaryPassword ? `\n  Temporary password: ${r.temporaryPassword}` : "")
      );
    }
  }
  return lines.join("\n\n");
}

/**
 * Confirm → POST → summary modal → onClose. Parent remounts with key={teamId} for each open.
 */
export function TeamBulkCredentialsEmailLauncher({
  teamId,
  teamName,
  memberCount,
  onClose,
}: {
  teamId: string;
  teamName: string;
  memberCount: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<{ title: string; message: string; variant: "default" | "success" | "danger" } | null>(
    null
  );

  async function runSend() {
    if (memberCount === 0) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/send-member-credentials`, {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as ApiResponse;
      setConfirmOpen(false);
      if (!res.ok) {
        setInfo({
          title: "Could not send",
          message: data.message ?? "Request failed",
          variant: "danger",
        });
        return;
      }
      const partial =
        !!data.summary && (data.summary.emailDeliveryFailed > 0 || data.summary.otherErrors > 0);
      setInfo({
        title: "Credentials email run finished",
        message: buildResultMessage(data),
        variant: partial ? "default" : "success",
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  function handleInfoClose() {
    setInfo(null);
    onClose();
  }

  function handleConfirmCancel() {
    if (loading) return;
    setConfirmOpen(false);
    onClose();
  }

  return (
    <>
      <ConfirmModal
        open={confirmOpen && !info}
        title="Send portal credentials to team members?"
        message={`Team: ${teamName}. This emails Employee Portal login details to each current member (${memberCount}). Each person gets a new temporary password—the same as “Resend credentials” on their employee record.`}
        confirmLabel="Send emails"
        cancelLabel="Cancel"
        variant="default"
        panelClassName="max-w-md"
        loading={loading}
        onConfirm={() => void runSend()}
        onCancel={handleConfirmCancel}
      />
      <InfoModal
        open={info !== null}
        title={info?.title ?? ""}
        message={info?.message ?? ""}
        variant={info?.variant === "danger" ? "danger" : info?.variant === "success" ? "success" : "default"}
        onClose={handleInfoClose}
      />
    </>
  );
}
