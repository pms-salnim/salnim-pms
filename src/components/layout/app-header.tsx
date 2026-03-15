
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSidebar } from '@/components/ui/sidebar';
import { timeZoneOptions } from '@/types/property';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, limit, doc, updateDoc, writeBatch, type Timestamp } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import type { Notification } from '@/types/notification';
import { useTranslation } from 'react-i18next';


interface AppHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export function AppHeader({ className, ...props }: AppHeaderProps) {
  const { user, logout, property, preferredLanguage, setPreferredLanguage } = useAuth();
  const { state } = useSidebar(); 
  const router = useRouter();
  const currentDate = new Date();
  const { i18n, t } = useTranslation('header/content');
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [unreadAlerts, setUnreadAlerts] = useState(0);

  // Options for date formatting
  const dateOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  const formattedDate = new Intl.DateTimeFormat(i18n.language, dateOptions).format(currentDate);

  const city = property?.city || "City";
  
  const timeZoneDisplay = useMemo(() => {
    if (!property?.timeZone) {
      return t('timezone_fallback');
    }
    const selectedOption = timeZoneOptions.find(opt => opt.value === property.timeZone);
    if (selectedOption) {
      // Extracts "UTC+01:00" from "(UTC+01:00) Casablanca"
      const match = selectedOption.label.match(/UTC[+-]\d{1,2}:\d{2}/);
      if (match) {
        return match[0];
      }
    }
    return property.timeZone; // Fallback to the value if no match or pattern mismatch
  }, [property?.timeZone, t]);

  const helpLinks = [
    { titleKey: "help_menu.getting_started_link", href: "/docs/getting-started" },
    { titleKey: "help_menu.rooms_rates_link", href: "/docs/rooms-and-rates" },
    { titleKey: "help_menu.calendar_guide_link", href: "/docs/calendar-guide" },
    { titleKey: "help_menu.reservations_guide_link", href: "/docs/manage-reservations" },
    { titleKey: "help_menu.payments_invoices_link", href: "/docs/payments-invoices" },
    { titleKey: "help_menu.extras_guide_link", href: "/docs/extras" },
    { titleKey: "help_menu.revenue_reports_link", href: "/docs/revenue-reports" },
    { titleKey: "help_menu.guest_relationships_link", href: "/docs/guest-relationships" },
    { titleKey: "help_menu.housekeeping_guide_link", href: "/docs/housekeeping" },
    { titleKey: "help_menu.team_workspace_link", href: "/docs/team-workspace" },
    { titleKey: "help_menu.users_roles_link", href: "/docs/user-staff-roles" },
  ];
  
  useEffect(() => {
    if (!user?.propertyId) return;

    const q = query(
        collection(db, "notifications"), 
        where("propertyId", "==", user.propertyId), 
        orderBy("createdAt", "desc"), 
        limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedNotifs = snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data(),
            createdAt: (docSnap.data().createdAt as Timestamp),
        } as Notification));
        
        setNotifications(fetchedNotifs);
        const unread = fetchedNotifs.filter(n => !n.read).length;
        setUnreadCount(unread);
    }, (error) => {
        console.error("Error fetching notifications: ", error);
    });

    return () => unsubscribe();
  }, [user?.propertyId]);

  const handleMarkAsRead = async (notificationId: string) => {
    const notifDocRef = doc(db, "notifications", notificationId);
    try {
        await updateDoc(notifDocRef, { read: true });
    } catch (error) {
        console.error("Error marking notification as read:", error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    handleMarkAsRead(notification.id);
    if (notification.type === 'new_reservation' && notification.relatedDocId) {
        router.push(`/reservations/all?view=${notification.relatedDocId}`);
    }
    // Future notification types can be handled here
  };

  const handleMarkAllAsRead = async () => {
    const unreadNotifications = notifications.filter(n => !n.read);
    if (unreadNotifications.length === 0) return;

    const batch = writeBatch(db);
    unreadNotifications.forEach(n => {
        const docRef = doc(db, "notifications", n.id);
        batch.update(docRef, { read: true });
    });
    try {
        await batch.commit();
    } catch (error) {
        console.error("Error marking all notifications as read:", error);
    }
  }
  
  const handleLanguageChange = (lang: string) => {
    setPreferredLanguage(lang);
  };

  // Expose header height as a CSS variable for other components to consume
  useEffect(() => {
    try {
      // header uses h-16 (4rem)
      document.documentElement.style.setProperty('--app-header-height', '4rem');
    } catch (e) {
      // ignore environment where document isn't available
    }
    return () => {
      try { document.documentElement.style.removeProperty('--app-header-height'); } catch (e) {}
    };
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 border-b bg-background/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/60",
        "h-16 flex items-center justify-between pr-4 md:pr-8 transition-all duration-200 ease-in-out",
        state.includes('collapsed')
            ? "pl-[calc(var(--sidebar-width-icon)_+_1rem)]"
            : "pl-[calc(var(--sidebar-width)_+_1rem)]",
        className
      )}
      {...props}
    >
      {/* Date & Location Info - Left Aligned */}
      <div className="flex items-center">
        <div className="text-left text-sm">
          <div className="text-muted-foreground">
            {t('location', { city, timeZone: timeZoneDisplay })}
          </div>
          <div className="font-medium">
            {formattedDate}
          </div>
        </div>
      </div>

      {/* Icons - Right Aligned */}
      <div className="flex items-center space-x-2">
        {/* Alert Widget - Eye-catching Icon */}
        {unreadAlerts > 0 && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="relative h-9 w-9 animate-pulse"
            title="Action required"
          >
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 bg-red-500 rounded-full animate-pulse opacity-75"></div>
              <div className="relative bg-red-500 rounded-full p-1.5 shadow-lg shadow-red-500/50">
                <Icons.AlertCircle className="h-5 w-5 text-white" />
              </div>
            </div>
          </Button>
        )}

        {/* Language Selector */}
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 w-auto px-3">
                    <span className="font-medium uppercase">{preferredLanguage}</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleLanguageChange('en')}>English</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleLanguageChange('fr')}>Français</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications Bell Icon */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-9 w-9">
              <Icons.Notification className="h-6 w-6" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-[8px] text-white">
                  {unreadCount}
                </span>
              )}
              <span className="sr-only">{t('notifications.toggle_label')}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="flex justify-between items-center pr-2">
                <DropdownMenuLabel>{t('notifications.title')}</DropdownMenuLabel>
                <Button variant="link" size="sm" className="h-auto p-0 text-xs text-muted-foreground hover:text-primary" onClick={(e) => { e.preventDefault(); handleMarkAllAsRead();}} disabled={unreadCount === 0}>
                    {t('notifications.mark_all_read')}
                </Button>
            </div>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? (
                <DropdownMenuItem disabled>
                    <p className="text-sm text-muted-foreground p-2 text-center w-full">{t('notifications.empty_state')}</p>
                </DropdownMenuItem>
            ) : (
                notifications.map(notif => {
                    const Icon = notif.type === 'new_reservation' ? Icons.CalendarCheck : Icons.CreditCard;
                    return (
                        <DropdownMenuItem key={notif.id} onClick={() => handleNotificationClick(notif)} className={cn(!notif.read && "bg-blue-50 dark:bg-blue-900/20")}>
                            <div className="flex items-start gap-3">
                                <Icon className="h-4 w-4 mt-1 text-blue-500" />
                                <div>
                                    <p className="font-medium text-sm">{notif.title}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {notif.description}
                                    </p>
                                    <p className="text-xs text-muted-foreground/80 mt-1">
                                        {formatDistanceToNow(notif.createdAt.toDate(), { addSuffix: true })}
                                    </p>
                                </div>
                            </div>
                        </DropdownMenuItem>
                    )
                })
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="justify-center text-sm text-muted-foreground hover:text-foreground cursor-pointer">
              <Link href="/notifications">{t('notifications.view_all')}</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Documentation Icon */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Icons.HelpCircle className="h-5 w-5" />
              <span className="sr-only">{t('help_menu.toggle_label')}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{t('help_menu.title')}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {t('help_menu.description')}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {helpLinks.map((link) => (
              <DropdownMenuItem key={link.href} asChild>
                <Link href={link.href} target="_blank" rel="noopener noreferrer" className="cursor-pointer w-full">
                  {t(link.titleKey)}
                </Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href="https://api.whatsapp.com/send/?phone=212644122401&text&type=phone_number&app_absent=0" target="_blank" rel="noopener noreferrer" className="cursor-pointer w-full">
                {t('help_menu.contact_support')}
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

         {/* Profile Icon */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full border border-border">
              <Icons.User className="h-5 w-5" />
              <span className="sr-only">{t('user_menu.toggle_label')}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {user?.name}
                  {user?.role && <span className="ml-1.5 text-xs text-muted-foreground capitalize">({user.role})</span>}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                    <Link href="/settings/user">
                    <Icons.Settings className="mr-2 h-4 w-4" />
                    <span>{t('user_menu.settings')}</span>
                    </Link>
                </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout}>
              <Icons.LogOut className="mr-2 h-4 w-4" />
              <span>{t('user_menu.logout')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

      </div>
    </header>
  );
}
