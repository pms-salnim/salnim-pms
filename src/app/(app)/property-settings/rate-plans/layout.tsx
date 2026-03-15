'use client';

import { PropertySettingsSubtabs } from '@/components/property-settings/property-settings-subtabs';

const rateePlansSubtabs = [
  { id: 'rates', label: 'Rate Plans', href: '/property-settings/rates-discounts/rates' },
  { id: 'seasonal', label: 'Seasonal Pricing', href: '/property-settings/rates-discounts/seasonal' },
  { id: 'discounts', label: 'Discounts', href: '/property-settings/rates-discounts/discounts' },
];

export default function RatePlansLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <PropertySettingsSubtabs subtabs={rateePlansSubtabs} />
      {children}
    </div>
  );
}
