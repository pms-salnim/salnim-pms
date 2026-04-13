'use client';

import { PropertySettingsSidebar } from '@/components/property-settings/property-settings-sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';

export default function PropertySettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="flex w-full h-full">
        <PropertySettingsSidebar />
        <main className="flex-1 overflow-hidden">
          <div className="w-full h-full">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
