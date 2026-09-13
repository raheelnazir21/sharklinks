/**
 * Header.tsx — Top navigation bar for all protected pages.
 * Shows page title, search bar, and user quick actions.
 *
 * Mobile additions:
 *   - Hamburger button (md:hidden) that opens the sidebar drawer
 *   - Compact height on small screens
 *   - Subtitle hidden on xs to save space
 */
"use client";

import { LogOut, Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useSidebar } from "@/hooks/useSidebar";
import { useHeader } from "@/hooks/useHeader";
import { IndustrialHeading } from "@/components/ui/PagePrimitives";
import GlobalSearch from "@/components/layout/GlobalSearch";
import { NotificationBell } from "@/components/ui/NotificationSystem";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  const { user, logout } = useAuth();
  const { setMobileOpen } = useSidebar();
  const pathname = usePathname();
  const { headerConfig } = useHeader();
  
  const heading = headerConfig || (title === "Dashboard" ? getPageHeading(pathname) : {
    eyebrow: "Textile QC",
    title,
    highlight: "",
    subtitle: subtitle || "Production and quality control workspace.",
  });

  return (
    <header className="sticky top-0 z-10 flex min-h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm shadow-slate-950/[0.03] backdrop-blur md:min-h-36 md:gap-6 md:px-7 md:py-5">
      {/* Hamburger — mobile only */}
      <button
        onClick={() => setMobileOpen(true)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 md:hidden"
        aria-label="Open navigation menu"
      >
        <Menu className="h-4 w-4" />
      </button>

      {/* Page heading — hidden on mobile to keep header compact, shown from sm up */}
      <div className="hidden sm:block min-w-0 flex-1">
        <IndustrialHeading
          eyebrow={heading.eyebrow}
          title={heading.title || title || "Workspace"}
          highlight={heading.highlight}
          subtitle={heading.subtitle}
          compact
        />
      </div>

      {/* Page title — mobile only (single line, no subtitle) */}
      <p className="sm:hidden flex-1 truncate text-sm font-black text-slate-900">
        {heading.title || title || "Workspace"} {heading.highlight}
      </p>

      <div className="flex items-center gap-2 shrink-0 md:gap-3">
        {/* Global Search */}
        <GlobalSearch />

        {/* Live Notification Bell — dropdown panel + sound toggle */}
        <NotificationBell />

        <div className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-sm font-black uppercase text-emerald-700 transition hover:bg-emerald-100 md:h-10 md:w-10">
          {user?.full_name?.[0] ?? "U"}
        </div>

        <button
          onClick={logout}
          title="Log out"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 md:h-10 md:w-10"
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
    title: "Order",
    highlight: "Tracking",
    subtitle: "One frame for product class, current stage and delay risk",
  };
  if (pathname.startsWith("/qc-reports/defects")) return {
    eyebrow: "Quality Configuration",
    title: "Defect",
    highlight: "Master",
    subtitle: "Configure defect codes and categories for each QC stage",
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
  if (pathname === "/orders") return {
    eyebrow: "Production Flow",
    title: "Order",
    highlight: "Execution",
    subtitle: "Stage timing, attachments, comments and current production status",
  };
  if (pathname.startsWith("/orders/")) return {
    eyebrow: "Production Flow",
    title: "Order",
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
