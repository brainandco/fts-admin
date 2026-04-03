"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

/** Optional permission: user needs this permission (or be super) to see the link. superOnly: only super user sees it. */
type NavLink = {
  href: string;
  label: string;
  superOnly?: boolean;
  permission?: string;
  /** If set, visible when super or when the user has any of these permissions. */
  permissionAnyOf?: string[];
};
type NavGroup = { label: string; superOnly?: boolean; children: NavLink[] };
type NavEntry = { type: "link"; item: NavLink } | { type: "group"; key: string; group: NavGroup };

const navStructure: NavEntry[] = [
  { type: "link", item: { href: "/dashboard", label: "Dashboard" } },
  {
    type: "group",
    key: "organization",
    group: {
      label: "Organization",
      children: [
        { href: "/regions", label: "Regions", permission: "regions.manage" },
        { href: "/projects", label: "Projects", permission: "projects.manage" },
        { href: "/teams", label: "Teams", permission: "teams.manage" },
        { href: "/teams/region-project-assignments", label: "Team region & project", superOnly: true },
        { href: "/users", label: "Users", superOnly: true },
      ],
    },
  },
  {
    type: "group",
    key: "people",
    group: {
      label: "People",
      children: [
        { href: "/employees", label: "Employees", permission: "users.view" },
        { href: "/employees/region-project-assignments", label: "Employee region & project", superOnly: true },
        { href: "/delegate", label: "Delegate" },
      ],
    },
  },
  {
    type: "group",
    key: "workflow",
    group: {
      label: "Tasks & approvals",
      children: [
        { href: "/tasks", label: "Tasks", permission: "tasks.view_all" },
        { href: "/approvals", label: "Approvals", permission: "approvals.view" },
        { href: "/notifications", label: "Notifications", permission: "users.view" },
      ],
    },
  },
  {
    type: "group",
    key: "management",
    group: {
      label: "Asset management",
      children: [
        { href: "/assets", label: "Assets", permission: "assets.manage" },
        { href: "/sims", label: "SIM cards", permission: "assets.manage" },
        {
          href: "/assets/returns",
          label: "Asset returns",
          permissionAnyOf: ["assets.manage", "assets.return"],
        },
        { href: "/vehicles", label: "Vehicles", permission: "vehicles.manage" },
      ],
    },
  },
  {
    type: "group",
    key: "system",
    group: {
      label: "System",
      children: [
        { href: "/exports", label: "Exports", permission: "approvals.approve" },
        { href: "/audit", label: "Audit logs", permission: "audit_logs.view_all" },
        { href: "/settings/roles", label: "Roles & permissions", superOnly: true },
      ],
    },
  },
];

type UserProfile = { full_name?: string | null; email?: string | null } | null;

function pathInGroup(pathname: string, group: NavGroup): boolean {
  return group.children.some((c) => pathname === c.href || pathname.startsWith(c.href + "/"));
}

function canSeeLink(link: NavLink, isSuper: boolean, permissionSet: Set<string>): boolean {
  if (link.superOnly) return isSuper;
  if (link.permissionAnyOf?.length) {
    if (isSuper || permissionSet.has("*")) return true;
    return link.permissionAnyOf.some((p) => permissionSet.has(p));
  }
  if (link.permission) return isSuper || permissionSet.has(link.permission) || permissionSet.has("*");
  return true;
}

export function Sidebar({
  isSuper = false,
  permissions = [],
  userProfile = null,
  mobileOpen = false,
  onCloseMobile,
}: {
  isSuper?: boolean;
  permissions?: string[];
  userProfile?: UserProfile;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}) {
  const pathname = usePathname();
  const permissionSet = useMemo(() => new Set(permissions), [permissions]);
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    navStructure.forEach((entry) => {
      if (entry.type === "group" && pathInGroup(pathname, entry.group)) initial.add(entry.key);
    });
    return initial;
  });

  useEffect(() => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      navStructure.forEach((entry) => {
        if (entry.type === "group" && pathInGroup(pathname, entry.group)) next.add(entry.key);
      });
      return next;
    });
  }, [pathname]);

  const navFiltered = useMemo(() => {
    return navStructure.filter((entry) => {
      if (entry.type === "link") return canSeeLink(entry.item, isSuper, permissionSet);
      const group = entry.group;
      const visibleChildren = group.children.filter((c) => canSeeLink(c, isSuper, permissionSet));
      return visibleChildren.length > 0;
    });
  }, [isSuper, permissionSet]);

  function toggleGroup(key: string) {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function signOut() {
    await fetch("/api/auth/signout", { method: "POST", credentials: "include" });
    window.location.href = "/login";
  }

  const displayName = userProfile?.full_name?.trim() || userProfile?.email || "User";
  const displayEmail = userProfile?.email || null;
  const initials = displayName
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

  function handleNav() {
    onCloseMobile?.();
  }

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-full w-56 flex-col border-r border-slate-800 bg-slate-900 shadow-xl shadow-slate-900/30 transition-transform duration-300 ease-out lg:z-20 lg:translate-x-0 ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      {/* Logo - same height as header (h-14) */}
      <div className="flex h-14 shrink-0 items-center border-b border-white/10 bg-black/20 px-4">
        <Link
          href="/dashboard"
          onClick={handleNav}
          className="group flex items-center gap-2 font-semibold text-white transition-transform duration-200 hover:scale-[1.02]"
        >
          <span className="relative h-8 w-32 shrink-0">
            <Image
              src="/images/black.png"
              alt="FTS"
              fill
              className="object-contain object-left brightness-0 invert"
              priority
            />
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {navFiltered.map((entry) => {
          if (entry.type === "link") {
            const active = pathname === entry.item.href || pathname.startsWith(entry.item.href + "/");
            return (
              <Link
                key={entry.item.href}
                href={entry.item.href}
                onClick={handleNav}
                className={`mb-0.5 block rounded-lg px-3 py-2.5 text-sm transition-all duration-200 ${
                  active
                    ? "bg-indigo-600 font-medium text-white shadow-md shadow-indigo-900/25"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                {entry.item.label}
              </Link>
            );
          }
          const { key, group } = entry;
          const isOpen = openKeys.has(key);
          const childrenVisible = group.children.filter((c) => !c.superOnly || isSuper);
          const hasActiveChild = childrenVisible.some(
            (c) => pathname === c.href || pathname.startsWith(c.href + "/")
          );
          return (
            <div key={key} className="mb-1">
              <button
                type="button"
                onClick={() => toggleGroup(key)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors duration-200 ${
                  hasActiveChild ? "font-medium text-cyan-200" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                <span>{group.label}</span>
                <svg
                  className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {isOpen && (
                <div className="ml-2 mt-0.5 space-y-0.5 border-l border-cyan-500/30 py-1 pl-2">
                  {childrenVisible.map((child) => {
                    const active = pathname === child.href || pathname.startsWith(child.href + "/");
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={handleNav}
                        className={`block rounded-md px-2 py-1.5 text-sm transition-all duration-200 ${
                          active
                            ? "bg-white/15 font-medium text-white"
                            : "text-slate-400 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-white/10" />

      <div className="shrink-0 px-3 py-4">
        <div className="flex items-center gap-3 rounded-xl bg-white/5 p-2 ring-1 ring-white/10">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{displayName}</p>
            {displayEmail && <p className="truncate text-xs text-slate-400">{displayEmail}</p>}
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-white/10" />

      <div className="shrink-0 px-3 py-3">
        <button
          type="button"
          onClick={signOut}
          className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-slate-400 transition-colors duration-200 hover:bg-rose-500/20 hover:text-rose-200"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
