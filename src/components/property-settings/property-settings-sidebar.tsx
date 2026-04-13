'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Icons } from '@/components/icons';
import { useAuth } from '@/contexts/auth-context';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Property } from '@/types/property';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface Tab {
  id: string;
  label: string;
  icon: keyof typeof Icons;
  href: string;
  section?: string;
}

const tabs: Tab[] = [
  {
    id: 'system',
    label: 'System',
    icon: 'Settings',
    href: '/property-settings/system/preferences',
    section: 'general',
  },
  {
    id: 'property',
    label: 'Property',
    icon: 'Building2',
    href: '/property-settings/property/infos',
    section: 'general',
  },
  {
    id: 'rooms',
    label: 'Rooms & Configuration',
    icon: 'BedDouble',
    href: '/property-settings/rooms',
    section: 'management',
  },
  {
    id: 'rates-discounts',
    label: 'Rate Plans & Discounts',
    icon: 'DollarSign',
    href: '/property-settings/rates-discounts',
    section: 'management',
  },
  {
    id: 'services-extras',
    label: 'Services & Extras',
    icon: 'Package',
    href: '/property-settings/services-extras',
    section: 'management',
  },
  {
    id: 'team',
    label: 'Team & Access',
    icon: 'Users',
    href: '/property-settings/team/users',
    section: 'access',
  },
  {
    id: 'communication',
    label: 'Guests & Communication',
    icon: 'MessageSquare',
    href: '/property-settings/communication/guests-profiles',
    section: 'access',
  },
  {
    id: 'integrations',
    label: 'Integrations',
    icon: 'Link2',
    href: '/property-settings/integrations/channel-manager',
    section: 'integrations',
  },
  {
    id: 'billing',
    label: 'Billing & Payments',
    icon: 'CreditCard',
    href: '/property-settings/billing',
    section: 'integrations',
  },
  {
    id: 'security',
    label: 'Security & Privacy',
    icon: 'Lock',
    href: '/property-settings/security',
    section: 'security',
  },
];

const sectionLabels: Record<string, string> = {
  general: 'General',
  management: 'Management',
  access: 'Access',
  integrations: 'Integrations',
  security: 'Security',
};

export function PropertySettingsSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { toggleSidebar, state } = useSidebar();
  const [propertyName, setPropertyName] = useState<string | null>(null);
  const [propertyAddress, setPropertyAddress] = useState<string | null>(null);
  const [isLoadingProperty, setIsLoadingProperty] = useState(true);

  // Group tabs by section
  const tabsBySection = tabs.reduce(
    (acc, tab) => {
      const section = tab.section || 'general';
      if (!acc[section]) {
        acc[section] = [];
      }
      acc[section].push(tab);
      return acc;
    },
    {} as Record<string, Tab[]>
  );

  useEffect(() => {
    const fetchPropertyDetails = async () => {
      if (user?.propertyId) {
        setIsLoadingProperty(true);
        try {
          const propertyDocRef = doc(db, 'properties', user.propertyId);
          const propertyDocSnap = await getDoc(propertyDocRef);
          if (propertyDocSnap.exists()) {
            const propertyData = propertyDocSnap.data() as Property;
            setPropertyName(propertyData.name);
            setPropertyAddress(propertyData.address);
          }
        } catch (error) {
          console.error('Error fetching property details:', error);
        } finally {
          setIsLoadingProperty(false);
        }
      } else {
        setIsLoadingProperty(false);
      }
    };

    fetchPropertyDetails();
  }, [user?.propertyId]);

  const isTabActive = (href: string) => pathname.startsWith(href);

  return (
    <Sidebar collapsible="icon" variant="sidebar" side="left" className="z-[51]">
      <SidebarHeader className="p-0">
        <div className="flex h-auto min-h-[4rem] items-center justify-start border-b border-sidebar-border group-data-[collapsible=icon]:h-12 px-3 py-2 group-data-[collapsible=icon]:py-0 group-data-[collapsible=icon]:justify-center">
          <div className="flex flex-col items-start group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:text-center">
            {isLoadingProperty && !propertyName && (
              <div className="flex items-center justify-center h-full w-full group-data-[collapsible=icon]:h-auto">
                <Icons.Spinner className="h-5 w-5 animate-spin text-sidebar-primary" />
              </div>
            )}
            {!isLoadingProperty && propertyName && (
              <>
                <span
                  className="font-semibold text-base text-sidebar-foreground truncate group-data-[collapsible=icon]:hidden"
                  title={propertyName}
                >
                  {propertyName}
                </span>
                <span
                  className="text-xs text-sidebar-foreground/70 truncate group-data-[collapsible=icon]:hidden"
                  title={propertyAddress || ''}
                >
                  {propertyAddress || 'Address not set'}
                </span>
                <span
                  className="hidden font-semibold text-lg text-sidebar-primary group-data-[collapsible=icon]:block"
                  title={propertyName}
                >
                  {propertyName.charAt(0).toUpperCase()}
                </span>
              </>
            )}
            {!isLoadingProperty && !propertyName && (
              <>
                <span className="font-semibold text-base text-sidebar-foreground group-data-[collapsible=icon]:hidden">
                  Settings
                </span>
                <Icons.Settings className="h-5 w-5 hidden text-sidebar-primary group-data-[collapsible=icon]:block" />
              </>
            )}
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="p-2">
        <SidebarMenu>
          {Object.entries(tabsBySection).map(([section, sectionTabs]) => (
            <div key={section}>
              <div className="px-3 pt-4 pb-2 mt-2 text-[0.55rem] font-semibold text-sidebar-foreground/70 uppercase tracking-wider group-data-[collapsible=icon]:hidden border-t border-sidebar-border">
                {sectionLabels[section]}
              </div>
              {sectionTabs.map((tab) => {
                const IconComponent = Icons[tab.icon as keyof typeof Icons] || Icons.Settings;
                return (
                  <SidebarMenuItem key={tab.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={isTabActive(tab.href)}
                      tooltip={{
                        children: tab.label,
                        className: 'group-data-[collapsible=icon]:block hidden bg-popover text-popover-foreground',
                      }}
                    >
                      <Link href={tab.href}>
                        <IconComponent className="h-4 w-4" />
                        <span>{tab.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </div>
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className={cn(
                "absolute top-16 right-0 z-[52] hidden md:flex",
                "h-8 w-8 rounded-full shadow-md",
                "bg-background hover:bg-accent text-foreground",
                "transform translate-x-1/2 -translate-y-1/2"
              )}
              onClick={toggleSidebar}
            >
              <Icons.SidebarToggle className="h-4 w-4" />
              <span className="sr-only">{state === 'expanded' ? 'Collapse' : 'Expand'}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            align="center"
            className="bg-popover text-popover-foreground"
          >
            {state === 'expanded' ? 'Collapse' : 'Expand'}
          </TooltipContent>
        </Tooltip>
      </SidebarFooter>
    </Sidebar>
  );
}
