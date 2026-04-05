/** Local calendar date YYYY-MM-DD (browser/server local timezone). */
export function todayLocalIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseLocalDate(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, mo, da] = iso.split("-").map(Number);
  return new Date(y, mo - 1, da);
}

/** Inclusive calendar days from fromIso through toIso (same day = 1). */
export function inclusiveCalendarDays(fromIso: string, toIso: string): number {
  const a = parseLocalDate(fromIso);
  const b = parseLocalDate(toIso);
  if (!a || !b || b < a) return 0;
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000) + 1;
}

function isRejected(status: string): boolean {
  return status === "PM_Rejected" || status === "Admin_Rejected";
}

/** Approved enough to treat leave dates as "booked" for tracking copy. */
function isLeaveBooked(status: string): boolean {
  return (
    status === "PM_Approved" ||
    status === "Admin_Approved" ||
    status === "Completed"
  );
}

/**
 * Human-readable tracking: days in range, and where the window sits vs today.
 * `daysLeftInLeave` is set when the leave is booked and today is inside [from, to].
 */
export function leaveRequestTracking(
  fromIso: string,
  toIso: string,
  status: string,
  todayIso = todayLocalIso()
): { requestedDays: number; tracking: string; daysLeftInLeave: number | null } {
  const requestedDays = inclusiveCalendarDays(fromIso, toIso);
  if (!fromIso || !toIso || requestedDays === 0) {
    return { requestedDays: 0, tracking: "—", daysLeftInLeave: null };
  }

  if (isRejected(status)) {
    return { requestedDays, tracking: "Rejected", daysLeftInLeave: null };
  }

  if (!isLeaveBooked(status)) {
    return {
      requestedDays,
      tracking: `Pending — ${requestedDays} day(s) requested`,
      daysLeftInLeave: null,
    };
  }

  if (todayIso < fromIso) {
    const start = parseLocalDate(fromIso)!;
    const today = parseLocalDate(todayIso)!;
    const daysUntil = Math.max(0, Math.round((start.getTime() - today.getTime()) / 86_400_000));
    return {
      requestedDays,
      tracking: `Starts in ${daysUntil} day(s) — ${requestedDays} day(s) booked`,
      daysLeftInLeave: null,
    };
  }

  if (todayIso > toIso) {
    return {
      requestedDays,
      tracking: `Ended — ${requestedDays} day(s) in period`,
      daysLeftInLeave: null,
    };
  }

  const left = inclusiveCalendarDays(todayIso, toIso);
  return {
    requestedDays,
    tracking: `Active — ${left} day(s) left in this leave`,
    daysLeftInLeave: left,
  };
}
