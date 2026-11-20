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

import { BookOpen, LogOut, Menu } from "lucide-react";
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
    eyebrow: "Sharknits WIP",
    title,
    highlight: "",
    subtitle: subtitle || "Production and quality control workspace.",
  });

  return (
    <header className="sticky top-0 z-10 flex min-h-14 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 py-2 shadow-sm shadow-slate-950/[0.03] backdrop-blur md:min-h-[4.75rem] md:gap-6 md:px-7 md:py-3">
      {/* Hamburger — mobile only */}
      <button
        onClick={() => setMobileOpen(true)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 md:hidden"
        aria-label="Open navigation menu"
      >
        <Menu className="h-4 w-4" />
      </button>

      {/* Page heading — hidden on mobile to keep header compact, shown from sm up */}
      <div className="hidden sm:block min-w-0 flex-1 overflow-hidden">
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

        {/* Operating Handbook (PDF) Download */}
        <a
          href="/Sample-and-Bulk-Order-Handbook.pdf"
          download="Sample-and-Bulk-Order-Handbook.pdf"
          target="_blank"
          rel="noopener noreferrer"
          title="Download Official Operating Handbook (PDF)"
          className="flex h-9 items-center gap-2 rounded-xl border border-[#C7D6FF] bg-[#EBF0FF] px-3 text-xs font-black uppercase tracking-wider text-[#0044E6] transition hover:bg-[#dbe8ff] hover:border-[#0044E6] active:scale-95 md:h-10 shrink-0"
        >
          <BookOpen className="h-4 w-4 text-[#0044E6] shrink-0" />
          <span className="hidden xl:inline">Handbook</span>
        </a>

        {/* User Profile matching Screenshot 2 */}
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2.5 py-1.5 shadow-xs transition hover:border-slate-300 md:gap-3 md:px-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e2be9b] text-xs font-black uppercase text-slate-800 ring-2 ring-slate-100 md:h-9 md:w-9">
            {user?.full_name?.[0] ?? "U"}
          </div>
          <div className="hidden sm:flex flex-col text-left leading-tight">
            <span className="text-xs font-black uppercase text-slate-900 tracking-wide">
              {user?.full_name || "RAHEEL"}
            </span>
            <span className="text-[10px] font-semibold text-slate-500">
              {user?.role ? `Role: ${String(user.role).replace('_', ' ').toUpperCase()}` : "Role: Manager"}
            </span>
          </div>
          <button
            onClick={logout}
            title="Log out"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
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
    eyebrow: "Sharknits Quality Command Center",
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
  if (pathname.startsWith("/pre-orders")) return {
    eyebrow: "Order Accountability",
    title: "Orders to",
    highlight: "Process",
    subtitle: "Assign orders to managers and track acknowledgment",
  };
  return {
    eyebrow: "Factory Control Room",
    title: "Production",
    highlight: "Dashboard",
    subtitle: "Bulk, sample, vendor, line, stage, defects and delay risk",
  };
}
