
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { useTranslation } from 'react-i18next';

const settingsNavItems = [
  {
    titleKey: "my_profile",
    href: "/settings/user",
    icon: Icons.User,
  },
  {
    titleKey: "property",
    href: "/settings/property",
    icon: Icons.Building,
  },
  {
    titleKey: "branding_booking",
    href: "/settings/booking",
    icon: Icons.BookOpenCheck,
  },
  {
    titleKey: "email_templates",
    href: "/settings/email-templates",
    icon: Icons.Mail,
  },
  {
    titleKey: "whatsapp_integration",
    href: "/settings/whatsapp",
    icon: Icons.MessageSquare,
  },
  {
    titleKey: "notifications",
    href: "/settings/notifications",
    icon: Icons.Notification,
  },
];

const NavLink = ({ href, children, active }: { href: string; children: React.ReactNode; active: boolean; }) => (
    <Button
        asChild
        variant="ghost"
        className={cn(
            "w-full justify-start",
            active && "bg-muted font-semibold"
        )}
    >
        <Link href={href}>{children}</Link>
    </Button>
);

export function SettingsSidebar() {
  const pathname = usePathname();
  const { t } = useTranslation('settings/sidebar/tabs');

  return (
    <aside className="space-y-4">
      <nav className="space-y-1">
        {settingsNavItems.map(item => {
            const IconComponent = item.icon;
            return (
                <NavLink
                    key={item.href}
                    href={item.href}
                    active={pathname === item.href}
                >
                    <IconComponent className="mr-2 h-4 w-4" />
                    {t(item.titleKey)}
                </NavLink>
            )
        })}
      </nav>
    </aside>
  );
}
