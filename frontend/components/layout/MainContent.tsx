/**
 * MainContent.tsx — Client wrapper that shifts the main content column
 * reactively when the sidebar collapses/expands.
 *
 * Desktop (md+): left margin matches sidebar width (72 expanded / 20 collapsed).
 * Mobile (<md): no margin — sidebar is an off-canvas drawer so content takes full width.
 */
"use client";

import { useSidebar } from "@/hooks/useSidebar";

export default function MainContent({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();

  return (
    <div
      className={`flex min-h-screen flex-col transition-all duration-300 ${
        collapsed ? "md:ml-20" : "md:ml-72"
      }`}
    >
      {children}
    </div>
  );
}
