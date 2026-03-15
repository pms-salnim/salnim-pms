'use client';

import { PropertySettingsSubtabs } from '@/components/property-settings/property-settings-subtabs';

const integrationsSubtabs = [
  { id: 'channel-manager', label: 'Channel Manager', href: '/property-settings/integrations/channel-manager' },
  { id: 'payment-gateways', label: 'Payment Gateways', href: '/property-settings/integrations/payment-gateways' },
  { id: 'multi-property-controls', label: 'Multi-Property Controls', href: '/property-settings/integrations/multi-property-controls' },
];

export default function PaymentGatewaysPage() {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b bg-background px-6 py-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage third-party integrations and connections</p>
          </div>
          <PropertySettingsSubtabs subtabs={integrationsSubtabs} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="rounded-lg border bg-white p-6">
          <h2 className="text-lg font-semibold mb-4">Payment Gateways</h2>
          <p className="text-sm text-muted-foreground">Configure and manage your payment processing solutions.</p>
        </div>
      </div>
    </div>
  );
}
