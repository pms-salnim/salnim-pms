'use client';

import { PropertySettingsSubtabs } from '@/components/property-settings/property-settings-subtabs';

const propertySubtabs = [
  { id: 'infos', label: 'Property Infos', href: '/property-settings/property/infos' },
  { id: 'contact', label: 'Contact', href: '/property-settings/property/contact' },
  { id: 'multi-property', label: 'Multi-Property', href: '/property-settings/property/multi-property' },
  { id: 'terms-policies', label: 'Terms & Policies', href: '/property-settings/property/terms-policies' },
];

export default function PropertyMultiPropertyPage() {
  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Property</h1>
        <PropertySettingsSubtabs subtabs={propertySubtabs} />
      </div>

      <div className="bg-white rounded-lg p-6 md:p-8">
        <p className="text-slate-600">Manage multiple properties and cross-property rules</p>
      </div>
    </>
  );
}
