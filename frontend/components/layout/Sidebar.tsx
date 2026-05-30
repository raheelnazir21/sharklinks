/**
 * Sidebar.tsx — Role-aware navigation sidebar.
 * Menu items are filtered based on the user's role so each
 * user only sees what they're allowed to access.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import type { UserRole } from "@/types/auth";
import api from "@/services/api";
import { formatRelativeTime } from "@/services/dateUtils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: UserRole[]; // Which roles can see this item
  group: "Overview" | "Production" | "Quality" | "Management";
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    group: "Overview",
    roles: ["super_admin", "admin", "manager", "qc_officer", "viewer"],
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    label: "Vendors",
    href: "/vendors",
    group: "Management",
    roles: ["super_admin", "admin", "manager"],
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: "Sampling Projects",
    href: "/samples",
    group: "Production",
    roles: ["super_admin", "admin", "manager", "qc_officer"],
    icon: (
      <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.691.31a2 2 0 01-1.782 0l-.691-.31a6 6 0 00-3.86-.517l-2.387.477a2 2 0 00-1.022.547V18.5a2 2 0 001.022 1.553l2.387.477a6 6 0 003.86-.517l.691-.31a2 2 0 011.782 0l.691.31a6 6 0 003.86.517l2.387-.477a2 2 0 001.022-1.553V15.428z" />
      </svg>
    ),
  },
  {
    label: "Bulk Projects",
    href: "/bulk-projects",
    group: "Production",
    roles: ["super_admin", "admin", "manager", "qc_officer"],
    icon: (
      <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    label: "Order Tracking",
    href: "/tracking-dashboard",
    group: "Production",
    roles: ["super_admin", "admin", "manager", "qc_officer", "viewer"],
    icon: (
      <svg className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />
      </svg>
    ),
  },

  {
    label: "QC Reports",
    href: "/qc-reports",
    group: "Quality",
    roles: ["super_admin", "admin", "manager", "qc_officer"],
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: "Approvals",
    href: "/approvals",
    group: "Quality",
    roles: ["super_admin", "admin", "manager"],
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  {
    label: "Users",
    href: "/users",
    group: "Management",
    roles: ["super_admin", "admin"],
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    label: "Activity Logs",
    href: "/activity-logs",
    group: "Management",
    roles: ["super_admin", "admin", "manager"],
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    label: "Settings",
    href: "/settings",
    group: "Management",
    roles: ["super_admin", "admin", "manager"],
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.607 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

interface HistorianEvent {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details?: string;
  created_at?: string;
  user?: {
    full_name?: string;
    email?: string;
  } | null;
}

function formatRelative(value?: string) {
  return formatRelativeTime(value);
}

function eventTone(action: string) {
  if (action.includes("LOGIN")) return "bg-emerald-50 text-emerald-700";
  if (action.includes("CREATED")) return "bg-teal-50 text-teal-700";
  if (action.includes("UPDATED")) return "bg-blue-50 text-blue-700";
  if (action.includes("DEACTIVATED") || action.includes("REJECT")) return "bg-red-50 text-red-700";
  return "bg-amber-50 text-amber-700";
}

function HistorianPanel({ historian }: { historian: HistorianEvent[] }) {
  return (
    <div className="mt-2 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.04]">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xl font-black tracking-tight text-slate-950">Historian</p>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Recent factory events</p>
        </div>
        <Link
          href="/activity-logs"
          prefetch={false}
          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-emerald-700 transition hover:border-emerald-200 hover:bg-emerald-50"
        >
          Open
        </Link>
      </div>

      <div className="space-y-3">
        {historian.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-3 text-xs font-semibold text-slate-500">No activity recorded yet.</p>
        ) : historian.map((event) => (
          <Link key={event.id} href="/activity-logs" prefetch={false} className="group flex gap-3">
            <div className="flex flex-col items-center">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full ${eventTone(event.action)}`}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </span>
              <span className="mt-2 h-10 w-px bg-slate-200 last:hidden" />
            </div>
            <div className="min-w-0 flex-1 border-b border-slate-100 pb-3">
              <p className="truncate text-xs font-black text-slate-800 group-hover:text-emerald-700">
                {event.action.replaceAll("_", " ")}
              </p>
              <p className="truncate text-[11px] font-semibold text-slate-500">
                {event.user?.full_name || "System"} · {event.entity_type}
              </p>
              <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">
                {event.details || "Activity recorded."}
              </p>
              <p className="mt-2 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                {formatRelative(event.created_at)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [historian, setHistorian] = useState<HistorianEvent[]>([]);

  // Filter nav items by current user's role
  const visibleItems = user
    ? NAV_ITEMS.filter((item) => item.roles.includes(user.role))
    : NAV_ITEMS;
  const canViewActivity = useMemo(
    () => Boolean(user && ["super_admin", "admin", "manager"].includes(user.role)),
    [user]
  );

  useEffect(() => {
    if (!canViewActivity) return;
    let active = true;
    api.get("/activity-logs/recent", { params: { limit: 4 } })
      .then((res) => {
        if (active) setHistorian(res.data.data || []);
      })
      .catch(() => {
        if (active) setHistorian([]);
      });
    return () => {
      active = false;
    };
  }, [canViewActivity]);

  const groupedItems = (["Overview", "Production", "Quality", "Management"] as const)
    .map((group) => ({ group, items: visibleItems.filter((item) => item.group === group) }))
    .filter(({ items }) => items.length);

  return (
    <aside className={`flex min-h-screen shrink-0 flex-col border-r border-slate-200 bg-white/95 shadow-sm shadow-slate-950/[0.03] backdrop-blur transition-all duration-300 ${collapsed ? "w-20" : "w-72"}`}>
      {/* Brand */}
      <div className={`flex items-center gap-3 border-b border-slate-200 px-4 py-5 ${collapsed ? "justify-center" : ""}`}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 shadow-sm">
          <svg className="h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
        </div>
        {!collapsed && <div className="min-w-0">
          <p className="text-sm font-black leading-tight text-slate-950">Textile QC</p>
          <p className="text-xs font-medium text-slate-500">Production System</p>
        </div>}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="ml-auto rounded-xl border border-slate-200 px-2 py-1 text-xs font-black text-slate-500 transition hover:bg-slate-50"
            title="Collapse sidebar"
          >
            ‹
          </button>
        )}
      </div>
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="mx-auto mt-3 rounded-xl border border-slate-200 px-2 py-1 text-xs font-black text-slate-500 transition hover:bg-slate-50"
          title="Expand sidebar"
        >
          ›
        </button>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {groupedItems.map(({ group, items }) => (
          <div key={group}>
            {!collapsed && <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{group}</p>}
            <div className="space-y-1">
              {items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={false}
                    title={collapsed ? item.label : undefined}
                    className={`group relative flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold transition-all duration-200 ${
                      isActive
                        ? "border border-emerald-100 bg-emerald-50 text-emerald-800 shadow-sm"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                    } ${collapsed ? "justify-center" : ""}`}
                  >
                    {isActive && <span className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-emerald-600" />}
                    <span className={isActive ? "text-emerald-700" : "text-slate-500 group-hover:text-emerald-700"}>
                      {item.icon}
                    </span>
                    {!collapsed && item.label}
                    {!collapsed && item.href === "/approvals" && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-yellow-400" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
        {!collapsed && canViewActivity && <HistorianPanel historian={historian} />}
      </nav>

      {/* User footer */}
      <div className="border-t border-slate-200 px-3 py-4">
        <div className={`mb-2 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm ${collapsed ? "justify-center" : ""}`}>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-black uppercase text-emerald-700 ring-1 ring-slate-200">
            {user?.full_name?.[0] ?? "U"}
          </div>
          {!collapsed && <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-bold text-slate-950">{user?.full_name}</p>
            <p className="text-xs capitalize text-slate-500">{user?.role?.replace("_", " ")}</p>
          </div>}
        </div>
        <button
          onClick={logout}
          className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-500 transition-all duration-150 hover:bg-emerald-50 hover:text-emerald-700 ${collapsed ? "justify-center" : ""}`}
          title="Sign out"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {!collapsed && "Sign Out"}
        </button>
      </div>
    </aside>
  );
}
