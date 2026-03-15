
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useState, useEffect, useRef } from 'react';
import { siteConfig } from "@/config/site";
import { Icons } from "@/components/icons";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  useSidebar, 
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Property } from "@/types/property";
import { Badge } from "@/components/ui/badge";
import type { Task } from '@/types/task';
import { collection, query, where, onSnapshot, getDocs, orderBy } from 'firebase/firestore';
import { toast, useToast } from '@/hooks/use-toast';
import { ToastAction } from '../ui/toast';
import { useTranslation } from "react-i18next";


export function AppSidebar() {
  const pathname = usePathname();
  const { user, unreadEmailCount, unreadMessageCount } = useAuth();
  const { toggleSidebar, state } = useSidebar(); 
  const [propertyName, setPropertyName] = useState<string | null>(null);
  const [propertyAddress, setPropertyAddress] = useState<string | null>(null);
  const [isLoadingProperty, setIsLoadingProperty] = useState(true);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const [assignedTaskCount, setAssignedTaskCount] = useState(0);
  const { dismiss } = useToast();
  const router = useRouter();
  const taskToastsRef = useRef<Record<string, string>>({});
  const { t } = useTranslation('sidebar');

  const settingsNavItem = siteConfig.mainNav.find(item => item.href === "/settings");
  const mainNavItems = siteConfig.mainNav.filter(item => item.href !== "/settings");

  useEffect(() => {
    if (!user?.id || !user.role || !user.propertyId) {
      setAssignedTaskCount(0);
      return;
    }
    
    const queries = [
        query(collection(db, "tasks"), where("property_id", "==", user.propertyId), where("assigned_to_uid", "==", user.id)),
        query(collection(db, "tasks"), where("property_id", "==", user.propertyId), where("assigned_to_role", "==", user.role))
    ];

    const unsubs = queries.map(q => onSnapshot(q, async () => {
        // Just re-fetch counts when any relevant query changes.
        // This is simpler than trying to merge docChanges from multiple listeners.
        const userTasksSnap = await getDocs(query(collection(db, "tasks"), where("property_id", "==", user.propertyId!), where("assigned_to_uid", "==", user.id!), where("status", "in", ["Open", "In Progress"])));
        const roleTasksSnap = await getDocs(query(collection(db, "tasks"), where("property_id", "==", user.propertyId!), where("assigned_to_role", "==", user.role!), where("status", "in", ["Open", "In Progress"])));
        
        const uniqueIds = new Set<string>();
        userTasksSnap.forEach(doc => uniqueIds.add(doc.id));
        roleTasksSnap.forEach(doc => uniqueIds.add(doc.id));
        setAssignedTaskCount(uniqueIds.size);
    }));

    return () => {
        unsubs.forEach(unsub => unsub());
    };
  }, [user?.id, user?.role, user?.propertyId]);

  useEffect(() => {
    const newOpenMenus: Record<string, boolean> = {};
    siteConfig.mainNav.forEach(item => {
      if (item.children && item.children.some(child => pathname.startsWith(child.href))) {
        newOpenMenus[item.href] = true;
      }
    });
    setOpenMenus(newOpenMenus);
  }, [pathname]);

  const toggleMenu = (href: string) => {
    setOpenMenus(prev => ({ ...prev, [href]: !prev[href] }));
  };

  useEffect(() => {
    const fetchPropertyDetails = async () => {
      if (user?.propertyId) {
        setIsLoadingProperty(true);
        try {
          const propertyDocRef = doc(db, "properties", user.propertyId);
          const propertyDocSnap = await getDoc(propertyDocRef);
          if (propertyDocSnap.exists()) {
            const propertyData = propertyDocSnap.data() as Property;
            setPropertyName(propertyData.name);
            setPropertyAddress(propertyData.address);
          } else {
            setPropertyName("Property Not Found");
            setPropertyAddress("Please check settings");
          }
        } catch (error) {
          console.error("Error fetching property details:", error);
          setPropertyName("Error Loading Property");
          setPropertyAddress("Could not load details");
        } finally {
          setIsLoadingProperty(false);
        }
      } else { 
        setPropertyName(null);
        setPropertyAddress(null);
        setIsLoadingProperty(false);
      }
    };

    fetchPropertyDetails();
  }, [user?.propertyId]);

  return (
    <Sidebar collapsible="icon" variant="sidebar" side="left" className="z-[51]"> 
      <SidebarHeader className="p-0">
        <div className="flex h-auto min-h-[4rem] items-center justify-start border-b border-sidebar-border group-data-[collapsible=icon]:h-12 px-3 py-2 group-data-[collapsible=icon]:py-0 group-data-[collapsible=icon]:justify-center">
          <div className="flex flex-col items-start group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:text-center">
            {isLoadingProperty && !propertyName && (
              <div className="flex items-center justify-center h-full w-full group-data-[collapsible=icon]:h-auto">
                <Icons.Spinner className="h-5 w-5 animate-spin text-sidebar-primary" />
                <span className="sr-only group-data-[collapsible=icon]:hidden">{t('loading_property')}</span>
              </div>
            )}
            {!isLoadingProperty && propertyName && (
              <>
                <span className="font-semibold text-base text-sidebar-foreground truncate group-data-[collapsible=icon]:hidden" title={propertyName}>
                  {propertyName}
                </span>
                <span className="text-xs text-sidebar-foreground/70 truncate group-data-[collapsible=icon]:hidden" title={propertyAddress || ""}>
                  {propertyAddress || "Address not set"}
                </span>
                <span className="hidden font-semibold text-lg text-sidebar-primary group-data-[collapsible=icon]:block" title={propertyName}>
                  {propertyName.charAt(0).toUpperCase()}
                </span>
              </>
            )}
             {!isLoadingProperty && !propertyName && !user?.propertyId && (
                <>
                  <span className="font-semibold text-base text-sidebar-foreground group-data-[collapsible=icon]:hidden">
                    {siteConfig.name}
                  </span>
                  <span className="text-xs text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden">
                    {t('no_property_assigned')}
                  </span>
                   <Icons.Logo className="h-5 w-5 hidden text-sidebar-primary group-data-[collapsible=icon]:block" />
                </>
            )}
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="p-2">
        <SidebarMenu>
          {mainNavItems.map((item, index) => {
            const hasPermission = !item.permissionKey || (user?.permissions && user.permissions[item.permissionKey]);
            if (!hasPermission) return null;

            const IconComponent = Icons[item.icon as keyof typeof Icons] || Icons.Menu;
            const isOpen = openMenus[item.href];

            const workspaceCount = unreadMessageCount + assignedTaskCount;
            const guestCount = unreadEmailCount;

            // Check if we should render a section header
            const previousItem = index > 0 ? mainNavItems[index - 1] : null;
            const shouldShowSectionHeader = item.section && item.section !== previousItem?.section;

            if (item.children) {
              const visibleChildren = item.children.filter(child => !child.permissionKey || (user?.permissions && user.permissions[child.permissionKey]));
              if (visibleChildren.length === 0) return null;

              return (
                <React.Fragment key={item.href}>
                  {shouldShowSectionHeader && (
                    <div className="px-3 pt-4 pb-0 mt-2 text-[0.55rem] font-semibold text-sidebar-foreground/70 uppercase tracking-wider group-data-[collapsible=icon]:hidden border-t border-sidebar-border">
                      {t(item.section)}
                    </div>
                  )}
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => toggleMenu(item.href)}
                      className="justify-between"
                      isActive={pathname.startsWith(item.href)}
                      tooltip={{ children: t(item.title), className: "group-data-[collapsible=icon]:block hidden bg-popover text-popover-foreground"}}
                    >
                      <span className="flex items-center justify-between w-full">
                          <span className="flex items-center gap-2">
                            <IconComponent className="h-5 w-5" />
                            <span className="group-data-[collapsible=icon]:hidden">
                              {t(item.title)}
                            </span>
                          </span>
                          {item.href === '/team-workspace' && workspaceCount > 0 && (
                              <Badge className="h-5 w-5 p-0 flex items-center justify-center rounded-full bg-blue-600 text-white group-data-[collapsible=icon]:hidden">
                                  {workspaceCount}
                              </Badge>
                          )}
                          {item.href === '/guests' && guestCount > 0 && (
                              <Badge className="h-5 w-5 p-0 flex items-center justify-center rounded-full bg-blue-600 text-white group-data-[collapsible=icon]:hidden">
                                  {guestCount}
                              </Badge>
                          )}
                      </span>
                      <Icons.DropdownArrow className={cn("h-4 w-4 transform transition-transform duration-200 group-data-[collapsible=icon]:hidden", isOpen && "rotate-180")} />
                    </SidebarMenuButton>
                  {isOpen && !state.includes('collapsed') && (
                    <SidebarMenuSub>
                      {visibleChildren.map(child => {
                        const isTasks = child.href === '/team-workspace/tasks';
                        const isMessages = child.href === '/team-workspace/messages';
                        const isCommunication = child.href === '/guests/communication';
                        
                        let badgeCount = 0;
                        if (isTasks) badgeCount = assignedTaskCount;
                        if (isMessages) badgeCount = unreadMessageCount;
                        if (isCommunication) badgeCount = unreadEmailCount;

                        return (
                          <SidebarMenuSubItem key={child.href}>
                            <SidebarMenuSubButton asChild isActive={pathname === child.href} className="w-full justify-between">
                                <Link href={child.href}>
                                  <span className="truncate">{t(child.title)}</span>
                                  {badgeCount > 0 && (
                                      <Badge className="h-5 w-5 p-0 flex items-center justify-center rounded-full bg-blue-600 text-white">
                                          {badgeCount}
                                      </Badge>
                                  )}
                                </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  )}
                  </SidebarMenuItem>
                </React.Fragment>
              );
            }

            return (
              <React.Fragment key={item.href}>
                {shouldShowSectionHeader && (
                  <div className="px-3 pt-4 pb-2 mt-2 text-[0.55rem] font-semibold text-sidebar-foreground/70 uppercase tracking-wider group-data-[collapsible=icon]:hidden border-t border-sidebar-border">
                    {t(item.section)}
                  </div>
                )}
                <SidebarMenuItem>
                   <SidebarMenuButton
                      asChild
                      isActive={pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))}
                      tooltip={{ children: t(item.title), className: "group-data-[collapsible=icon]:block hidden bg-popover text-popover-foreground"}}
                      className="justify-start"
                    >
                      <Link href={item.href}>
                        <span className="flex items-center gap-2">
                          <IconComponent className="h-5 w-5" />
                          <span className="group-data-[collapsible=icon]:hidden">
                            {t(item.title)}
                          </span>
                        </span>
                      </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
              </React.Fragment>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="mt-auto border-t border-sidebar-border p-2">
        {settingsNavItem && (
            (() => {
                const hasPermission = !settingsNavItem.permissionKey || (user?.permissions && user.permissions[settingsNavItem.permissionKey]);
                if (!hasPermission) return null;
                const IconComponent = Icons[settingsNavItem.icon as keyof typeof Icons] || Icons.Menu;

                return (
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            asChild
                            isActive={pathname.startsWith(settingsNavItem.href)}
                            tooltip={{ children: t(settingsNavItem.title), className: "group-data-[collapsible=icon]:block hidden bg-popover text-popover-foreground" }}
                            className="justify-start"
                        >
                            <Link href={settingsNavItem.href}>
                                <span className="flex items-center gap-2">
                                    <IconComponent className="h-5 w-5" />
                                    <span className="group-data-[collapsible=icon]:hidden">
                                        {t(settingsNavItem.title)}
                                    </span>
                                </span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                );
            })()
        )}
      </SidebarFooter>

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
            <span className="sr-only">{state === 'expanded' ? t('collapse') : t('expand')}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          align="center"
          className="bg-popover text-popover-foreground"
        >
          {state === 'expanded' ? t('collapse') : t('expand')}
        </TooltipContent>
      </Tooltip>
    </Sidebar>
  );
}
