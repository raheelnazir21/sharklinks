/**
 * MainContent.tsx — Client wrapper that shifts the main content column
 * reactively when the sidebar collapses/expands.
 */
"use client";

import { useSidebar } from "@/hooks/useSidebar";

export default function MainContent({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();

  return (
    <div
      className={`flex min-h-screen flex-col transition-all duration-300 ${
        collapsed ? "ml-20" : "ml-72"
      }`}
    >
      {children}
    </div>
  );
}
