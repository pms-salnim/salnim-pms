'use client';

import { PropertySettingsSubtabs } from '@/components/property-settings/property-settings-subtabs';
import { TermsPoliciesForm } from '@/components/property-settings/terms-policies/terms-policies-form';

const propertySubtabs = [
  { id: 'infos', label: 'Property Infos', href: '/property-settings/property/infos' },
  { id: 'contact', label: 'Contact', href: '/property-settings/property/contact' },
  { id: 'multi-property', label: 'Multi-Property', href: '/property-settings/property/multi-property' },
  { id: 'terms-policies', label: 'Terms & Policies', href: '/property-settings/property/terms-policies' },
];

export default function TermsPoliciesPage() {
  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Property</h1>
          <p className="text-slate-600 mt-1">Terms, policies, and booking rules</p>
        </div>
        <PropertySettingsSubtabs subtabs={propertySubtabs} />
      </div>

      <TermsPoliciesForm />
    </>
  );
}
