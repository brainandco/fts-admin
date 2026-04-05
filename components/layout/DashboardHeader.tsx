"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NotificationBellDropdown } from "@/components/notifications/NotificationBellDropdown";
import { UserAvatar } from "@/components/profile/UserAvatar";

const SECTION_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  employees: "Employees",
  regions: "Regions",
  projects: "Projects",
  teams: "Teams",
  users: "Users",
  tasks: "Tasks",
  approvals: "Approvals",
  "employee-requests": "Employee requests",
  notifications: "Notifications",
  exports: "Exports",
  assets: "Assets",
  sims: "SIM cards",
  vehicles: "Vehicles",
  audit: "Audit logs",
  settings: "Settings",
  delegate: "Delegate",
};

function titleCaseSegment(s: string) {
  return s
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function getHeading(pathname: string): { primary: string; secondary?: string } {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return { primary: "Dashboard" };

  const root = parts[0];
  if (root === "settings" && parts[1] === "profile") {
    return { primary: "My profile", secondary: "Settings" };
  }
  const section = SECTION_LABELS[root] ?? titleCaseSegment(root);

  if (parts.length === 1) {
    return { primary: section };
  }

  const rest = parts.slice(1);
  if (rest[0] === "region-project-assignments") {
    return { primary: "Region & project assignments", secondary: section };
  }
  if (rest[0] === "new") {
    const base = section.replace(/s$/, "");
    return { primary: `New ${base}`, secondary: section };
  }
  if (rest[0] === "invite") {
    return { primary: "Invite user", secondary: "Users" };
  }
  if (rest[0] === "assign" || rest[0] === "assign-to-qc") {
    return { primary: titleCaseSegment(rest.join(" / ")), secondary: section };
  }
  if (root === "assets" && rest[0] === "returns") {
    return { primary: "Asset returns", secondary: section };
  }
  if (rest.length >= 1 && rest[0] !== "new") {
    const idOrSlug = rest[0];
    if (/^[0-9a-f-]{8,}$/i.test(idOrSlug) || idOrSlug.length > 20) {
      return { primary: "Details", secondary: section };
    }
    return { primary: titleCaseSegment(idOrSlug), secondary: section };
  }

  return { primary: section };
}

type UserProfile = {
  full_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
} | null;

export function DashboardHeader({
  userProfile,
  unreadNotifications,
  onOpenMenu,
}: {
  userProfile: UserProfile;
  unreadNotifications: number;
  onOpenMenu: () => void;
}) {
  const pathname = usePathname();
  const { primary, secondary } = getHeading(pathname);
  const displayName = userProfile?.full_name?.trim() || userProfile?.email || "";
  const [unread, setUnread] = useState(unreadNotifications);

  useEffect(() => {
    setUnread(unreadNotifications);
  }, [unreadNotifications]);

  return (
    <header className="fts-dashboard-topbar z-20 px-4 sm:px-6">
      <button
        type="button"
        onClick={onOpenMenu}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800 lg:hidden"
        aria-label="Open navigation menu"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="min-w-0 flex-1">
        {secondary && secondary !== primary ? (
          <p className="truncate text-xs font-medium text-slate-500">
            <span className="text-teal-700">Admin</span>
            <span className="mx-1.5 text-slate-300">/</span>
            <span>{secondary}</span>
          </p>
        ) : (
          <p className="truncate text-xs font-medium uppercase tracking-wider text-teal-700">Admin portal</p>
        )}
        <div className="truncate text-lg font-semibold leading-tight tracking-tight text-slate-900 sm:text-xl">
          {primary}
        </div>
      </div>

      <div className="hidden shrink-0 items-center gap-2 sm:flex" aria-hidden>
        <UserAvatar
          name={displayName}
          email={userProfile?.email}
          avatarUrl={userProfile?.avatar_url}
          size="sm"
        />
      </div>

      <NotificationBellDropdown
        unreadCount={unread}
        onUnreadDecrement={() => setUnread((c) => Math.max(0, c - 1))}
      />
    </header>
  );
}
