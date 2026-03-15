"use client";

import { SettingsSidebar } from "@/components/settings/settings-sidebar";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-8 items-start">
        <SettingsSidebar />
        <main>{children}</main>
      </div>
    </div>
  );
}
