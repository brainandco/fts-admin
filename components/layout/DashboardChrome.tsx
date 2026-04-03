"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { DashboardHeader } from "./DashboardHeader";

type UserProfile = { full_name?: string | null; email?: string | null; avatar_url?: string | null } | null;

export function DashboardChrome({
  children,
  isSuper,
  permissions,
  userProfile,
  unreadNotifications,
}: {
  children: React.ReactNode;
  isSuper: boolean;
  permissions: string[];
  userProfile: UserProfile;
  unreadNotifications: number;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  return (
    <>
      <Sidebar
        isSuper={isSuper}
        permissions={permissions}
        userProfile={userProfile}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
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
    </>
  );
}
