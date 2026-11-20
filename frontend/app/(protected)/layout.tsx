/**
 * app/(protected)/layout.tsx — Shared layout for all protected pages.
 * Wraps every dashboard page with the Sidebar + Header.
 * Next.js App Router: the (protected) folder name is a route group (no URL segment).
 */
import { SidebarProvider } from "@/hooks/useSidebar";
import { HeaderProvider } from "@/hooks/useHeader";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import MainContent from "@/components/layout/MainContent";
import { NotificationToasts } from "@/components/ui/NotificationSystem";
import AIChatWidget from "@/components/ai/AIChatWidget";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <HeaderProvider>
        <div className="light-ui min-h-screen bg-[#F6F8FC] text-[#16233B]">
          {/* Fixed sidebar — stays locked while content scrolls */}
          <Sidebar />
          {/* Reactive main area — shifts when sidebar collapses */}
          <MainContent>
            <Header title="Dashboard" />
            <main className="flex-1 bg-[#F6F8FC] p-6">{children}</main>
          </MainContent>
          {/* Global toast popups — renders above everything */}
          <NotificationToasts />
          {/* AI Assistant — floating chat bubble on every protected page */}
          <AIChatWidget />
        </div>
      </HeaderProvider>
    </SidebarProvider>
  );
}
