'use client';

import { PropertySettingsSidebar } from '@/components/property-settings/property-settings-sidebar';

export default function PropertySettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full ">
      <PropertySettingsSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-2 md:p-2">
          {children}
        </div>
      </main>
    </div>
  );
}
