/**
 * app/(protected)/layout.tsx — Shared layout for all protected pages.
 * Wraps every dashboard page with the Sidebar + Header.
 * Next.js App Router: the (protected) folder name is a route group (no URL segment).
 */
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="light-ui flex min-h-screen bg-[#f7faf9] text-slate-950">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Dashboard" />
        <main className="flex-1 overflow-y-auto bg-[#f7faf9] p-6">{children}</main>
      </div>
    </div>
  );
}
