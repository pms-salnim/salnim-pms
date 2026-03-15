'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building,
  Bed,
  DollarSign,
  Users,
  MessageSquare,
  Zap,
  CreditCard,
  Shield,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Tab {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
}

const tabs: Tab[] = [
  {
    id: 'system',
    label: 'System',
    icon: <Settings className="w-4 h-4" />,
    href: '/property-settings/system/preferences',
  },
  {
    id: 'property',
    label: 'Property',
    icon: <Building className="w-4 h-4" />,
    href: '/property-settings/property/infos',
  },
  {
    id: 'rooms',
    label: 'Rooms & Configuration',
    icon: <Bed className="w-4 h-4" />,
    href: '/property-settings/rooms',
  },
  {
    id: 'rates-discounts',
    label: 'Rate Plans & Discounts',
    icon: <DollarSign className="w-4 h-4" />,
    href: '/property-settings/rates-discounts',
  },
  {
    id: 'services-extras',
    label: 'Services & Extras',
    icon: <Zap className="w-4 h-4" />,
    href: '/property-settings/services-extras',
  },
  {
    id: 'team',
    label: 'Team & Access',
    icon: <Users className="w-4 h-4" />,
    href: '/property-settings/team/users',
  },
  {
    id: 'communication',
    label: 'Guests & Communication',
    icon: <MessageSquare className="w-4 h-4" />,
    href: '/property-settings/communication//guests-profiles',
  },
  {
    id: 'integrations',
    label: 'Integrations',
    icon: <Zap className="w-4 h-4" />,
    href: '/property-settings/integrations/channel-manager',
  },
  {
    id: 'billing',
    label: 'Billing & Payments',
    icon: <CreditCard className="w-4 h-4" />,
    href: '/property-settings/billing',
  },
  {
    id: 'security',
    label: 'Security & Privacy',
    icon: <Shield className="w-4 h-4" />,
    href: '/property-settings/security',
  },
];

interface PropertySettingsSidebarProps {
  activeTab?: string;
}

export function PropertySettingsSidebar({ activeTab }: PropertySettingsSidebarProps) {
  const pathname = usePathname();

  const isTabActive = (tabId: string) => {
    return pathname.includes(`/property-settings/${tabId}`);
  };

  return (
      <aside className="hidden lg:block w-64  h-full overflow-y-auto">
      <div className="sticky top-0 p-4 z-10">
        <h2 className="text-lg font-semibold text-slate-900">Settings</h2>
      </div>

      <nav className="space-y-1 p-4">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              isTabActive(tab.id)
                ? 'bg-white text-blue-700'
                : 'text-slate-700 hover:bg-slate-100'
            )}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
