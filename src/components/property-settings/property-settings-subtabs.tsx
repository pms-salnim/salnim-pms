'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface SubTab {
  id: string;
  label: string;
  href: string;
}

interface PropertySettingsSubtabsProps {
  subtabs: SubTab[];
}

export function PropertySettingsSubtabs({ subtabs }: PropertySettingsSubtabsProps) {
  const pathname = usePathname();

  return (
    <div className="inline-flex gap-2 bg-slate-200 rounded-full p-1">
      {subtabs.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          className={cn(
            'px-4 py-2 text-sm font-medium transition-colors rounded-full whitespace-nowrap',
            pathname === tab.href
              ? 'bg-white text-slate-900'
              : 'text-slate-600 hover:text-slate-900'
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
