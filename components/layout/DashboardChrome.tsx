"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { DashboardHeader } from "./DashboardHeader";

const SIDEBAR_COLLAPSED_KEY = "fts-admin-sidebar-collapsed";

type UserProfile = { full_name?: string | null; email?: string | null; avatar_url?: string | null } | null;

export function DashboardChrome({
  children,
  isSuper,
  permissions,
  userProfile,
  unreadNotifications,
  positionLabel,
}: {
  children: React.ReactNode;
  isSuper: boolean;
  permissions: string[];
  userProfile: UserProfile;
  unreadNotifications: number;
  positionLabel?: string | null;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1") {
        setSidebarCollapsed(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  return (
    <div className={sidebarCollapsed ? "fts-sidebar-collapsed" : ""}>
      <Sidebar
        isSuper={isSuper}
        permissions={permissions}
        userProfile={userProfile}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((c) => !c)}
        positionLabel={positionLabel}
      />

      <button
        type="button"
        aria-label="Close menu"
        className={`fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-[2px] transition-opacity duration-200 lg:hidden ${
          mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMobileOpen(false)}
      />

      <div className="fts-dashboard-column">
        <DashboardHeader
          userProfile={userProfile}
          unreadNotifications={unreadNotifications}
          onOpenMenu={() => setMobileOpen(true)}
        />
        <main className="fts-dashboard-scroll px-4 pb-8 pt-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl min-w-0">{children}</div>
        </main>
      </div>
    </div>
  );
}
