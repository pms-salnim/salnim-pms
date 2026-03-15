'use client';

import { useState, useEffect } from 'react';
import { PropertySettingsSubtabs } from '@/components/property-settings/property-settings-subtabs';
import { ContactForm } from '@/components/property-settings/contact/contact-form';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/auth-context';
import { Icons } from '@/components/icons';
import { toast } from '@/hooks/use-toast';

const propertySubtabs = [
  { id: 'infos', label: 'Property Infos', href: '/property-settings/property/infos' },
  { id: 'contact', label: 'Contact', href: '/property-settings/property/contact' },
  { id: 'multi-property', label: 'Multi-Property', href: '/property-settings/property/multi-property' },
  { id: 'terms-policies', label: 'Terms & Policies', href: '/property-settings/property/terms-policies' },
];

export default function PropertyContactPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [contactData, setContactData] = useState(null);
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
    contactDataLoaded: false,
    fieldCount: 0,
  });

  // Load contact data from Firestore
  useEffect(() => {
    const loadContactData = async () => {
      if (!property?.id) {
        setDebugInfo(prev => ({
          ...prev,
          loadStatus: 'no_property',
          propertyId: null,
        }));
        setIsLoading(false);
        return;
      }

      try {
        setDebugInfo(prev => ({
          ...prev,
          propertyId: property.id,
          propertyName: property.name,
          loadStatus: 'loading',
        }));

        // Load contact data from settings subcollection
        const contactRef = doc(db, 'properties', property.id, 'settings', 'contact');
        const contactDoc = await getDoc(contactRef);
        
        if (contactDoc.exists()) {
          const data = contactDoc.data();
          setContactData(data);
          setDebugInfo(prev => ({
            ...prev,
            loadStatus: 'success',
            contactDataLoaded: true,
            fieldCount: Object.keys(data).length,
          }));
        } else {
          // Initialize with empty data if contact settings don't exist yet
          // Pre-fill with property data where applicable
          const initialData = {
            primaryEmail: property.email || '',
            primaryPhone: property.phone || '',
            websiteUrl: property.website || '',
            landlineNumber: '',
            preferredContactMethod: 'email',
            officeHoursOpen: '09:00',
            officeHoursClose: '18:00',
            timeZone: property.timeZone || 'UTC',
            languagesAvailable: 'English',
            departmentContacts: [],
            whatsappNumber: '',
            facebookUrl: '',
            instagramUrl: '',
            twitterUrl: '',
            linkedinUrl: '',
            youtubeUrl: '',
            showContactToGuests: true,
            enableGuestContactForm: true,
            directBookingContact: true,
            emergencyContact24_7: true,
          };
          setContactData(initialData);
          setDebugInfo(prev => ({
            ...prev,
            loadStatus: 'success',
            contactDataLoaded: false,
            fieldCount: 0,
          }));
        }
      } catch (error: any) {
        console.error('Failed to load contact data:', error);
        setDebugInfo(prev => ({
          ...prev,
          loadStatus: 'error',
          lastError: error.message || String(error),
        }));
      } finally {
        setIsLoading(false);
      }
    };

    loadContactData();
  }, [property?.id]);

  const handleSaveContactData = async (data: any) => {
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

      // Save contact data to Firestore in settings subcollection
      const contactRef = doc(db, 'properties', property.id, 'settings', 'contact');
      
      const contactDataToSave = {
        // Primary Property Contact
        primaryEmail: data.primaryEmail,
        primaryPhone: data.primaryPhone,
        landlineNumber: data.landlineNumber,
        websiteUrl: data.websiteUrl,

        // Communication Preferences
        preferredContactMethod: data.preferredContactMethod,
        officeHoursOpen: data.officeHoursOpen,
        officeHoursClose: data.officeHoursClose,
        timeZone: data.timeZone,
        languagesAvailable: data.languagesAvailable,

        // Department Contacts
        departmentContacts: data.departmentContacts || [],

        // Digital Channels
        whatsappNumber: data.whatsappNumber,
        facebookUrl: data.facebookUrl,
        instagramUrl: data.instagramUrl,
        twitterUrl: data.twitterUrl,
        linkedinUrl: data.linkedinUrl,
        youtubeUrl: data.youtubeUrl,

        // Guest Accessibility
        showContactToGuests: data.showContactToGuests,
        enableGuestContactForm: data.enableGuestContactForm,
        directBookingContact: data.directBookingContact,
        emergencyContact24_7: data.emergencyContact24_7,

        // Metadata
        updatedAt: serverTimestamp(),
      };

      // Check if document exists
      const contactDocSnapshot = await getDoc(contactRef);
      
      if (contactDocSnapshot.exists()) {
        // Update existing document
        await updateDoc(contactRef, contactDataToSave);
      } else {
        // Create new document
        await setDoc(contactRef, {
          ...contactDataToSave,
          createdAt: serverTimestamp(),
        });
      }

      console.log('Contact data saved successfully');
      setDebugInfo(prev => ({
        ...prev,
        lastSaveStatus: 'success',
        lastSaveTime: new Date().toISOString(),
        lastError: null,
      }));

      toast({
        title: 'Success',
        description: 'Contact information saved successfully',
      });
    } catch (error: any) {
      console.error('Error saving contact data:', error);
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
            <div className="text-slate-600">Loading contact information...</div>
          </div>
        ) : (
          <ContactForm
            initialData={contactData}
            onSave={handleSaveContactData}
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
                <div className="text-xs uppercase font-bold text-slate-400 mb-1">Contact Data Loaded</div>
                <div className={`${debugInfo.contactDataLoaded ? 'text-green-400' : 'text-yellow-400'}`}>
                  {debugInfo.contactDataLoaded ? '✓ Yes' : '✗ Empty (will create new)'}
                </div>
              </div>

              <div>
                <div className="text-xs uppercase font-bold text-slate-400 mb-1">Data Fields</div>
                <div className={`bg-slate-800 p-2 rounded text-slate-300`}>
                  {debugInfo.fieldCount} fields {debugInfo.fieldCount > 0 ? 'loaded' : 'will be created'}
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
