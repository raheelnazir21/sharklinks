/**
 * Header.tsx — Top navigation bar for all protected pages.
 * Shows page title, search bar, and user quick actions.
 */
"use client";

import { Bell, LogOut, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { IndustrialHeading } from "@/components/ui/PagePrimitives";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const heading = title === "Dashboard" ? getPageHeading(pathname) : {
    eyebrow: "Textile QC",
    title,
    highlight: "",
    subtitle: subtitle || "Production and quality control workspace.",
  };

  return (
    <header className="sticky top-0 z-10 flex min-h-36 items-center justify-between gap-6 border-b border-slate-200 bg-white/95 px-7 py-5 shadow-sm shadow-slate-950/[0.03] backdrop-blur">
      <IndustrialHeading
        eyebrow={heading.eyebrow}
        title={heading.title}
        highlight={heading.highlight}
        subtitle={heading.subtitle}
        compact
      />

      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search..."
            className="w-64 rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-4 focus:ring-slate-100"
          />
        </div>

        <button className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50">
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-slate-500" />
        </button>

        <div className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-sm font-black uppercase text-emerald-700 transition hover:bg-emerald-100">
          {user?.full_name?.[0] ?? "U"}
        </div>

        <button
          onClick={logout}
          title="Log out"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

function getPageHeading(pathname: string) {
  if (pathname.startsWith("/vendors")) return {
    eyebrow: "Supplier Network",
    title: "Vendor",
    highlight: "Management",
    subtitle: "Manufacturing partners, floor capacity and production history",
  };
  if (pathname.startsWith("/samples")) return {
    eyebrow: "Sample Development",
    title: "Sample",
    highlight: "Pipeline",
    subtitle: "Design approval lifecycle and sampling stage monitoring",
  };
  if (pathname.startsWith("/bulk-projects")) return {
    eyebrow: "Bulk Production",
    title: "Bulk",
    highlight: "Execution",
    subtitle: "Industrial production lifecycle and SLA monitoring",
  };
  if (pathname.startsWith("/tracking-dashboard")) return {
    eyebrow: "Vendor Floor Line Tracking",
    title: "Bulk Order",
    highlight: "Tracking",
    subtitle: "One frame for product class, current stage and delay risk",
  };
  if (pathname.startsWith("/qc-reports")) return {
    eyebrow: "Textile Quality Command Center",
    title: "Quality",
    highlight: "Management",
    subtitle: "Inspection reports, defect master, printing and manual forms",
  };
  if (pathname.startsWith("/approvals")) return {
    eyebrow: "Manager Review",
    title: "Approval",
    highlight: "Control",
    subtitle: "Pending inspections, review actions and release status",
  };
  if (pathname.startsWith("/users")) return {
    eyebrow: "System Access",
    title: "User",
    highlight: "Management",
    subtitle: "Accounts, roles and permission control",
  };
  if (pathname.startsWith("/activity-logs")) return {
    eyebrow: "Factory Historian",
    title: "Activity",
    highlight: "Logs",
    subtitle: "Trace user actions, production changes and quality events",
  };
  if (pathname.startsWith("/orders")) return {
    eyebrow: "Production Flow",
    title: "Bulk Order",
    highlight: "Detail",
    subtitle: "Stage timing, attachments, comments and current production status",
  };
  if (pathname.startsWith("/settings")) return {
    eyebrow: "Workspace Control",
    title: "System",
    highlight: "Settings",
    subtitle: "Account preferences, security and session controls",
  };
  return {
    eyebrow: "Factory Control Room",
    title: "Production",
    highlight: "Dashboard",
    subtitle: "Bulk, sample, vendor, line, stage, defects and delay risk",
  };
}
