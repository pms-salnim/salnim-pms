'use client';

import { useState, useEffect } from 'react';
import { PropertySettingsSubtabs } from '@/components/property-settings/property-settings-subtabs';
import { PropertyInfosForm } from '@/components/property-settings/property-infos/property-infos-form';
import { useAuth } from '@/contexts/auth-context';
import { Icons } from '@/components/icons';
import { createClient } from '@supabase/supabase-js';
import { toast } from '@/hooks/use-toast';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
);

const propertySubtabs = [
  { id: 'infos', label: 'Property Infos', href: '/property-settings/property/infos' },
  { id: 'contact', label: 'Contact', href: '/property-settings/property/contact' },
  { id: 'multi-property', label: 'Multi-Property', href: '/property-settings/property/multi-property' },
  { id: 'terms-policies', label: 'Terms & Policies', href: '/property-settings/property/terms-policies' },
];

interface FormInitialData {
  propertyName?: string;
  propertyType?: string;
  starRating?: number;
  description?: string;
  tagline?: string;
  yearEstablished?: number;
  logoUrl?: string;
  jurisdiction?: string;
  legalBusinessName?: string;
  europeanCompanyRegNumber?: string;
  europeanVATNumber?: string;
  europeanTradeRegEntry?: string;
  europeanChamberRegistration?: string;
  europeanTaxRegistration?: string;
  moroccanLegalCompanyForm?: string;
  moroccanICE?: string;
  moroccanRC?: string;
  moroccanIF?: string;
  moroccanCNSS?: string;
  moroccanPatentNumber?: string;
  usaEIN?: string;
  usaStateLicenseNumber?: string;
  usaSecretaryOfStateNumber?: string;
  usaFederalTaxID?: string;
  totalRooms?: number;
  maxGuestCapacity?: number;
  propertySizeSquareFeet?: number;
  numberFloors?: number;
  numberBuildings?: number;
  propertyStyle?: string;
  streetAddress?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;
  googleMapsLink?: string;
}

export default function PropertyInfosPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [formInitialData, setFormInitialData] = useState<FormInitialData | null>(null);
  const { property } = useAuth();

  // Debug state
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>({
    propertyId: null,
    propertyName: null,
    loadStatus: 'pending',
    lastError: null,
    lastSaveTime: null,
    lastSaveStatus: null,
    propertyDataLoaded: false,
    mappedFieldCount: 0,
  });

  useEffect(() => {
    if (property?.id) {
      // Map property fields to form field names
      const initialData: FormInitialData = {
        propertyName: property.name,
        propertyType: property.type,
        streetAddress: property.address,
        city: property.city,
        legalBusinessName: property.legalName,
        // Add any other fields from property that match form fields
        ...property,
      };

      setFormInitialData(initialData);
      setDebugInfo(prev => ({
        ...prev,
        propertyId: property.id,
        propertyName: property.name,
        loadStatus: 'success',
        propertyDataLoaded: true,
        mappedFieldCount: Object.keys(initialData).filter(k => initialData[k as keyof FormInitialData]).length,
      }));
      setIsLoading(false);
    } else {
      setDebugInfo(prev => ({
        ...prev,
        loadStatus: 'loading',
      }));
    }
  }, [property]);

  const handleSavePropertyInfos = async (data: any) => {
    if (!property?.id) {
      const errorMsg = 'Property not found';
      toast({
        title: 'Error',
        description: errorMsg,
        variant: 'destructive',
      });
      throw new Error(errorMsg);
    }

    try {
      setDebugInfo(prev => ({ ...prev, lastSaveStatus: 'saving', lastError: null }));

      // Prepare updates - map form field names to property document field names
      const updates = {
        propertyName: data.propertyName,
        propertyType: data.propertyType,
        starRating: data.starRating,
        description: data.description,
        tagline: data.tagline,
        yearEstablished: data.yearEstablished,
        logoUrl: data.logoUrl || '',

        // Legal & Business Details
        jurisdiction: data.jurisdiction,
        legalBusinessName: data.legalBusinessName,
        europeanCompanyRegNumber: data.europeanCompanyRegNumber,
        europeanVATNumber: data.europeanVATNumber,
        europeanTradeRegEntry: data.europeanTradeRegEntry,
        europeanChamberRegistration: data.europeanChamberRegistration,
        europeanTaxRegistration: data.europeanTaxRegistration,
        moroccanLegalCompanyForm: data.moroccanLegalCompanyForm,
        moroccanICE: data.moroccanICE,
        moroccanRC: data.moroccanRC,
        moroccanIF: data.moroccanIF,
        moroccanCNSS: data.moroccanCNSS,
        moroccanPatentNumber: data.moroccanPatentNumber,
        usaEIN: data.usaEIN,
        usaStateLicenseNumber: data.usaStateLicenseNumber,
        usaSecretaryOfStateNumber: data.usaSecretaryOfStateNumber,
        usaFederalTaxID: data.usaFederalTaxID,

        // Property Specifications
        totalRooms: data.totalRooms,
        maxGuestCapacity: data.maxGuestCapacity,
        propertySizeSquareFeet: data.propertySizeSquareFeet,
        numberFloors: data.numberFloors,
        numberBuildings: data.numberBuildings,
        propertyStyle: data.propertyStyle,

        // Property Location
        streetAddress: data.streetAddress,
        city: data.city,
        stateProvince: data.stateProvince,
        postalCode: data.postalCode,
        country: data.country,
        googleMapsLink: data.googleMapsLink || '',
      };

      // Get current session for auth token
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('Not authenticated');
      }

      // Call Supabase API endpoint
      const response = await fetch('/api/properties/infos/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          propertyId: property.id,
          updates,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log('Property infos saved successfully', result);
      setDebugInfo(prev => ({
        ...prev,
        lastSaveStatus: 'success',
        lastSaveTime: new Date().toISOString(),
        lastError: null,
      }));

      toast({
        title: 'Success',
        description: 'Property information saved successfully',
      });
    } catch (error: any) {
      console.error('Error saving property infos:', error);
      const errorMsg = error.message || String(error);
      setDebugInfo(prev => ({
        ...prev,
        lastSaveStatus: 'error',
        lastError: errorMsg,
      }));
      toast({
        title: 'Error',
        description: errorMsg,
        variant: 'destructive',
      });
      throw error;
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Property</h1>
        <PropertySettingsSubtabs subtabs={propertySubtabs} />
      </div>

      <div className="mb-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-slate-600">Loading property information...</div>
          </div>
        ) : (
          <PropertyInfosForm
            initialData={formInitialData || undefined}
            onSave={handleSavePropertyInfos}
            isLoading={isLoading}
          />
        )}
      </div>

      {/* Debug Panel */}
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setDebugOpen(!debugOpen)}
          className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 shadow-lg transition-all"
        >
          <Icons.Code className="w-4 h-4" />
          Debug {debugOpen ? '▼' : '▶'}
        </button>

        {debugOpen && (
          <div className="absolute bottom-12 right-0 bg-slate-900 text-slate-100 rounded-lg shadow-2xl p-6 w-96 max-h-96 overflow-y-auto border border-slate-700">
            <div className="space-y-3 text-sm font-mono">
              <div>
                <div className="text-xs uppercase font-bold text-slate-400 mb-1">Property ID</div>
                <div className="bg-slate-800 p-2 rounded text-slate-200 break-all">
                  {debugInfo.propertyId || 'Not found'}
                </div>
              </div>

              <div>
                <div className="text-xs uppercase font-bold text-slate-400 mb-1">Property Name</div>
                <div className="bg-slate-800 p-2 rounded text-slate-200 break-all">
                  {debugInfo.propertyName || 'Not found'}
                </div>
              </div>

              <div>
                <div className="text-xs uppercase font-bold text-slate-400 mb-1">Load Status</div>
                <div className={`bg-slate-800 p-2 rounded text-sm font-bold ${
                  debugInfo.loadStatus === 'success' ? 'text-green-400' :
                  debugInfo.loadStatus === 'error' ? 'text-red-400' :
                  debugInfo.loadStatus === 'loading' ? 'text-yellow-400' :
                  'text-slate-200'
                }`}>
                  {debugInfo.loadStatus.toUpperCase()}
                </div>
              </div>

              <div>
                <div className="text-xs uppercase font-bold text-slate-400 mb-1">Property Data Loaded</div>
                <div className={`${debugInfo.propertyDataLoaded ? 'text-green-400' : 'text-red-400'}`}>
                  {debugInfo.propertyDataLoaded ? '✓ Yes' : '✗ No'}
                </div>
              </div>

              <div>
                <div className="text-xs uppercase font-bold text-slate-400 mb-1">Mapped Fields</div>
                <div className={`bg-slate-800 p-2 rounded text-slate-300`}>
                  {debugInfo.mappedFieldCount} fields loaded
                </div>
              </div>

              <div>
                <div className="text-xs uppercase font-bold text-slate-400 mb-1">Last Save Status</div>
                <div className={`bg-slate-800 p-2 rounded text-sm font-bold ${
                  debugInfo.lastSaveStatus === 'success' ? 'text-green-400' :
                  debugInfo.lastSaveStatus === 'error' ? 'text-red-400' :
                  debugInfo.lastSaveStatus === 'saving' ? 'text-yellow-400' :
                  'text-slate-400'
                }`}>
                  {debugInfo.lastSaveStatus ? debugInfo.lastSaveStatus.toUpperCase() : 'No save yet'}
                </div>
              </div>

              {debugInfo.lastSaveTime && (
                <div>
                  <div className="text-xs uppercase font-bold text-slate-400 mb-1">Last Save Time</div>
                  <div className="bg-slate-800 p-2 rounded text-slate-300 text-xs">
                    {new Date(debugInfo.lastSaveTime).toLocaleString()}
                  </div>
                </div>
              )}

              {debugInfo.lastError && (
                <div>
                  <div className="text-xs uppercase font-bold text-red-400 mb-1">Error</div>
                  <div className="bg-red-900 bg-opacity-30 p-2 rounded text-red-400 text-xs break-all">
                    {debugInfo.lastError}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
