'use client';

import { PropertySettingsSubtabs } from '@/components/property-settings/property-settings-subtabs';

const pricingSubtabs = [
  { id: 'rate-plans', label: 'Rate Plans', href: '/property-settings/pricing/rate-plans' },
  { id: 'seasonal', label: 'Seasonnal Rates', href: '/property-settings/pricing/seasonal-rates' },
  { id: 'promotions', label: 'Promotions', href: '/property-settings/pricing/promotions' },
];

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <PropertySettingsSubtabs subtabs={pricingSubtabs} />
      {children}
    </div>
  );
}
