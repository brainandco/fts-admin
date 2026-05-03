"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { UserAvatar } from "@/components/profile/UserAvatar";
import {
  PERMISSION_EMPLOYEE_ASSIGN_REGION_PROJECT,
  PERMISSION_EMPLOYEE_FILES_MANAGE,
  PERMISSION_EMPLOYEE_MANAGE,
} from "@/lib/rbac/permission-codes";
import { AdminNavGlyph, SidebarCollapseGlyph, SidebarSignOutGlyph } from "./admin-nav-glyphs";

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
  { type: "link", item: { href: "/leave", label: "Leave" } },
  { type: "link", item: { href: "/settings/profile", label: "My profile" } },
  {
    type: "group",
    key: "organization",
    group: {
      label: "Organization",
      children: [
        { href: "/regions", label: "Regions", permission: "regions.manage" },
        { href: "/projects", label: "Projects", permission: "projects.manage" },
        { href: "/teams", label: "Teams", permission: "teams.manage" },
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
        { href: "/people", label: "Users & employees", permission: "users.view" },
        {
          href: "/employees",
          label: "Employees",
          permissionAnyOf: ["users.view", PERMISSION_EMPLOYEE_MANAGE],
        },
        {
          href: "/employees/region-project-assignments",
          label: "Employee region & project",
          permission: PERMISSION_EMPLOYEE_ASSIGN_REGION_PROJECT,
        },
        { href: "/employee-files", label: "Employee files", permission: PERMISSION_EMPLOYEE_FILES_MANAGE },
        {
          href: "/employee-files/pp-reports",
          label: "PP final reports",
          permission: PERMISSION_EMPLOYEE_FILES_MANAGE,
        },
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
        {
          href: "/employee-requests",
          label: "Employee requests",
          permissionAnyOf: ["approvals.view", "approvals.approve", "approvals.reject"],
        },
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
        {
          href: "/assets/who-has",
          label: "Who has assets",
          permissionAnyOf: ["assets.manage", "assets.assign"],
        },
        { href: "/sims", label: "SIM cards", permission: "assets.manage" },
        {
          href: "/assets/returns",
          label: "Asset returns",
          permissionAnyOf: ["assets.manage", "assets.return"],
        },
        {
          href: "/receipt-confirmations",
          label: "Receipt confirmations",
          permissionAnyOf: ["assets.manage", "assets.assign", "vehicles.manage", "vehicles.assign"],
        },
        { href: "/vehicles", label: "Vehicles", permissionAnyOf: ["vehicles.manage", "vehicles.assign"] },
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
        { href: "/software-library", label: "Software library", permission: "approvals.approve" },
        { href: "/company-documents", label: "Company documents", permission: "approvals.approve" },
        { href: "/audit", label: "Audit logs", permission: "audit_logs.view_all" },
        { href: "/settings/roles", label: "Roles & permissions", superOnly: true },
      ],
    },
  },
];

type UserProfile = { full_name?: string | null; email?: string | null; avatar_url?: string | null } | null;

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
  collapsed = false,
  onToggleCollapsed,
  positionLabel = null,
}: {
  isSuper?: boolean;
  permissions?: string[];
  userProfile?: UserProfile;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  positionLabel?: string | null;
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
  const profileTitle = [displayName, displayEmail, positionLabel].filter(Boolean).join(" · ");

  function handleNav() {
    onCloseMobile?.();
  }

  const rail = collapsed;

  function linkActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  /** Among sibling nav hrefs, only the longest matching prefix is active (e.g. /assets/who-has vs /assets). */
  function linkActiveAmong(href: string, siblingHrefs: string[]) {
    const candidates = siblingHrefs.filter((h) => pathname === h || pathname.startsWith(h + "/"));
    if (candidates.length === 0) return false;
    const best = candidates.reduce((a, b) => (b.length > a.length ? b : a));
    return best === href;
  }

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-full w-56 flex-col border-r border-slate-800 bg-slate-900 shadow-xl shadow-slate-900/30 transition-[width] duration-300 ease-out lg:z-20 lg:translate-x-0 ${
        rail ? "lg:w-16" : "lg:w-56"
      } ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
    >
      {/* Logo + collapse (desktop) */}
      <div
        className={`flex shrink-0 items-center justify-between gap-1 border-b border-white/10 bg-black/20 px-3 max-lg:h-14 max-lg:min-h-[3.5rem] ${
          rail ? "lg:min-h-0 lg:flex-col lg:justify-center lg:gap-2 lg:py-3" : "h-14 min-h-[3.5rem]"
        }`}
      >
        <Link
          href="/dashboard"
          onClick={handleNav}
          className={`group flex min-w-0 items-center font-semibold text-white transition-transform duration-200 hover:scale-[1.02] ${
            rail ? "lg:w-full lg:justify-center" : "flex-1"
          }`}
        >
          <span className={`relative shrink-0 ${rail ? "h-8 w-32 max-lg:w-32 lg:h-9 lg:w-9" : "h-8 w-32"}`}>
            <Image
              src="/images/black.svg"
              alt="Fast Technology Solutions"
              fill
              sizes="128px"
              className="object-contain object-left brightness-0 invert lg:object-center"
              priority
            />
          </span>
        </Link>
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-expanded={!rail}
          aria-label={rail ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white lg:flex"
        >
          <SidebarCollapseGlyph collapsed={rail} />
        </button>
      </div>

      {/* Profile — below logo */}
      <div className={`shrink-0 border-b border-white/10 ${rail ? "lg:px-2 lg:py-2" : "px-3 py-3"}`}>
        <div
          className={`flex items-center gap-3 rounded-xl bg-white/5 p-2 ring-1 ring-white/10 ${
            rail ? "max-lg:flex-row lg:flex-col lg:items-center lg:justify-center lg:gap-1 lg:p-1.5" : ""
          }`}
          title={rail ? profileTitle : undefined}
        >
          <UserAvatar name={displayName} email={displayEmail} avatarUrl={userProfile?.avatar_url} size="md" />
          <div className={`min-w-0 flex-1 ${rail ? "max-lg:block lg:hidden" : ""}`}>
            <p className="truncate text-sm font-medium text-white">{displayName}</p>
            {displayEmail ? <p className="truncate text-xs text-slate-400">{displayEmail}</p> : null}
            {positionLabel ? (
              <p className="mt-0.5 truncate text-[11px] font-medium text-teal-300/95">{positionLabel}</p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="fts-nav-scrollbar min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {navFiltered.map((entry, idx) => {
          if (entry.type === "link") {
            const active = linkActive(entry.item.href);
            if (rail) {
              return (
                <div key={entry.item.href} className={idx > 0 ? "max-lg:mt-0 lg:mt-1" : ""}>
                  <Link
                    href={entry.item.href}
                    onClick={handleNav}
                    title={entry.item.label}
                    className={`mb-0.5 flex justify-center rounded-lg p-2.5 transition-all duration-200 max-lg:mb-0.5 max-lg:block max-lg:px-3 max-lg:py-2.5 max-lg:text-left max-lg:text-sm lg:mx-auto lg:w-10 ${
                      active
                        ? "bg-teal-600 text-white shadow-md shadow-teal-900/25 max-lg:font-medium"
                        : "text-slate-300 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span className="hidden lg:contents">
                      <AdminNavGlyph href={entry.item.href} className={active ? "text-white" : "text-slate-200"} />
                    </span>
                    <span className="lg:hidden">{entry.item.label}</span>
                  </Link>
                </div>
              );
            }
            return (
              <Link
                key={entry.item.href}
                href={entry.item.href}
                onClick={handleNav}
                className={`mb-0.5 block rounded-lg px-3 py-2.5 text-sm transition-all duration-200 ${
                  active
                    ? "bg-teal-600 font-medium text-white shadow-md shadow-teal-900/25"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                {entry.item.label}
              </Link>
            );
          }
          const { key, group } = entry;
          const isOpen = openKeys.has(key);
          const childrenVisible = group.children.filter((c) => canSeeLink(c, isSuper, permissionSet));
          const siblingHrefs = childrenVisible.map((c) => c.href);
          const hasActiveChild = childrenVisible.some((c) => linkActiveAmong(c.href, siblingHrefs));

          if (rail) {
            return (
              <div key={key} className={idx > 0 ? "mt-2 border-t border-white/10 pt-2 max-lg:mt-0 max-lg:border-0 max-lg:pt-0 lg:mt-2 lg:border-t lg:border-white/10 lg:pt-2" : ""}>
                {childrenVisible.map((child) => {
                  const active = linkActiveAmong(child.href, siblingHrefs);
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={handleNav}
                      title={child.label}
                      className={`mb-0.5 flex justify-center rounded-lg p-2.5 transition-all duration-200 max-lg:mb-0.5 max-lg:block max-lg:px-3 max-lg:py-2.5 max-lg:text-left max-lg:text-sm lg:mx-auto lg:w-10 ${
                        active
                          ? "bg-teal-600 text-white shadow-md shadow-teal-900/25 max-lg:font-medium"
                          : "text-slate-300 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <span className="hidden lg:contents">
                        <AdminNavGlyph href={child.href} className={active ? "text-white" : "text-slate-200"} />
                      </span>
                      <span className="lg:hidden">{child.label}</span>
                    </Link>
                  );
                })}
              </div>
            );
          }

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
                    const active = linkActiveAmong(child.href, siblingHrefs);
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

      <div className="shrink-0 px-3 py-3">
        <button
          type="button"
          onClick={signOut}
          title="Sign out"
          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-slate-400 transition-colors duration-200 hover:bg-rose-500/20 hover:text-rose-200 ${
            rail ? "lg:justify-center lg:px-2" : ""
          }`}
        >
          <SidebarSignOutGlyph className={`shrink-0 ${rail ? "max-lg:hidden lg:inline" : "hidden"}`} />
          <span className={rail ? "max-lg:inline lg:sr-only" : ""}>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
