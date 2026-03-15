"use client";

import { usePathname } from 'next/navigation';
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AuthWrapper } from "@/components/auth/auth-wrapper";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isTeamWorkspace = pathname.startsWith('/team-workspace');
  const isFullscreenCalendar = pathname === '/calendar-availability/calendar';
  
  // A page is considered "fullscreen" if it's one of the special cases.
  const isFullscreenPage = isTeamWorkspace || isFullscreenCalendar;

  return (
    <AuthWrapper>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background font-body text-foreground">
          <AppSidebar />

          <div className="flex flex-1 flex-col transition-all duration-300 ease-in-out">
            <AppHeader />

            <main className="flex-1 mt-16">
              {isFullscreenPage ? (
                <div className="h-[calc(100vh-4rem)] w-full flex flex-col">{children}</div>
              ) : (
                <div className="w-full p-4">{children}</div>
              )}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </AuthWrapper>
  );
}
