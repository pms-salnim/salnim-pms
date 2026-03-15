'use client';

import React, { useState, useEffect, useRef } from 'react';
import { PropertySettingsSubtabs } from '@/components/property-settings/property-settings-subtabs';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, setDoc, deleteDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { uploadFile, deleteFile } from '@/lib/uploadHelper';

const communicationSubtabs = [
  { id: 'guests-profiles', label: 'Guests Profiles', href: '/property-settings/communication/guests-profiles' },
  { id: 'communication-channels', label: 'Communication Channels', href: '/property-settings/communication/communication-channels' },
  { id: 'email-templates', label: 'Email Templates', href: '/property-settings/communication/email-templates' },
  { id: 'guest-portal', label: 'Guest Portal', href: '/property-settings/communication/guest-portal' },
  { id: 'notifications', label: 'Notifications', href: '/property-settings/communication/notifications' },
];

interface GuestPortalSettings {
  id?: string;
  createdAt?: any;
  updatedAt?: any;
  // General Tab
  general: {
    portalName: string;
    enabled: boolean;
    properties: string[]; // property IDs
    roomTypes: string[]; // room categories to include
    defaultPortal: boolean;
    customDomain?: string;
    customDomainFull?: string; // e.g., guest.riadmedina.ma
    shortLinkEnabled: boolean;
    preArrivalDays: number;
    postDepartureDays: number;
    permanentAccessEnabled: boolean; // for loyalty programs
    maintenanceMode: boolean;
    testMode: boolean; // use mock data instead of PMS
    globalKillSwitch: boolean; // instantly deactivate portal
    authenticationMethod: 'magic-link' | 'pin' | 'password' | 'reservation-number';
    magicLinkExpiration: number; // hours
    manualLoginFields: string[]; // field combination, e.g., ['lastname', 'confirmation-number']
    keepLoggedInEnabled: boolean;
    deviceLimit: number; // max devices per reservation
    autoSendLinkTiming: string;
    autoSendTriggers: string[]; // 'booking-confirmed', 'pre-arrival', 'check-in-complete', 'manual'
    pmsSyncStatus?: {
      lastSync?: Date;
      status: 'synced' | 'syncing' | 'error';
      message?: string;
    };
  };
  // Branding & Home Tab
  branding: {
    logo?: string;
    darkLogo?: string;
    favicon?: string;
    primaryColor: string;
    accentColor: string;
    backgroundColor: string;
    fontFamily: string;
    darkModeEnabled: boolean;
    welcomeTitle: string;
    welcomeMessage: string;
    heroImages: string[];
    heroCaptions: string[];
    contactPhone?: string;
    contactWhatsApp?: string;
    contactEmail?: string;
    socialLinks: {
      facebook?: string;
      instagram?: string;
      twitter?: string;
      linkedin?: string;
    };
    footerText: string;
    copyrightText: string;
    legalLinks: { label: string; url: string }[];
  };
  // Navigation & Content Tab
  navigation: {
    menuItems: { label: string; enabled: boolean; order: number }[];
    builtInPages: {
      home: boolean;
      myBooking: boolean;
      houseRules: boolean;
      wifiInstructions: boolean;
      localGuide: boolean;
      addOns: boolean;
      contact: boolean;
      reviews: boolean;
    };
    customPages: { title: string; url: string; icon?: string }[];
    quickLinks: { label: string; url: string; icon?: string }[];
  };
  // Check-in & Features Tab
  features: {
    digitalCheckInEnabled: boolean;
    checkInSteps: {
      guestInfo: { enabled: boolean; required: boolean; order: number };
      additionalGuests: { enabled: boolean; required: boolean; order: number };
      idUpload: { enabled: boolean; required: boolean; order: number };
      registrationCard: { enabled: boolean; required: boolean; order: number };
      paymentAuth: { enabled: boolean; required: boolean; order: number };
      specialRequests: { enabled: boolean; required: boolean; order: number };
      houseRules: { enabled: boolean; required: boolean; order: number };
    };
    checkInTimeWindow: string;
    mobileKeyEnabled: boolean;
    accessCodeDelivery: 'sms' | 'email' | 'both';
    inPortalChat: boolean;
    folioViewEnabled: boolean;
    upsellMarketplaceEnabled: boolean;
    reviewRequestTiming: 'during-stay' | 'checkout' | 'post-stay';
    checkoutFlowEnabled: boolean;
    qrCodeSettingsEnabled: boolean;
  };
  // Languages & Advanced Tab
  languages: {
    availableLanguages: string[];
    defaultLanguage: string;
    autoDetect: 'browser' | 'profile';
    autoTranslateEnabled: boolean;
    translationCompletion: { [key: string]: number };
  };
  advanced: {
    analyticPixel?: string;
    customCss?: string;
    customJs?: string;
    dataRetention: number; // days
    httpsEnforced: boolean;
  };
}

const defaultSettings: GuestPortalSettings = {
  general: {
    portalName: '',
    enabled: true,
    properties: [],
    roomTypes: [],
    defaultPortal: false,
    customDomain: '',
    customDomainFull: '',
    shortLinkEnabled: false,
    preArrivalDays: 4,
    postDepartureDays: 4,
    permanentAccessEnabled: false,
    maintenanceMode: false,
    testMode: false,
    globalKillSwitch: false,
    authenticationMethod: 'reservation-number',
    magicLinkExpiration: 24,
    manualLoginFields: [],
    keepLoggedInEnabled: false,
    deviceLimit: 3,
    autoSendLinkTiming: 'immediate',
    autoSendTriggers: ['booking-confirmed'],
    pmsSyncStatus: {
      status: 'synced',
      message: 'All synced',
    },
  },
  branding: {
    primaryColor: '#3B82F6',
    accentColor: '#10B981',
    backgroundColor: '#FFFFFF',
    fontFamily: 'Inter',
    darkModeEnabled: false,
    welcomeTitle: 'Welcome to Your Stay',
    welcomeMessage: 'We are excited to host you!',
    heroImages: [],
    heroCaptions: [],
    contactPhone: '',
    contactWhatsApp: '',
    contactEmail: '',
    socialLinks: {},
    footerText: 'Booking.com verified guest experience',
    copyrightText: '© 2024 All rights reserved',
    legalLinks: [],
  },
  navigation: {
    menuItems: [
      { label: 'Home', enabled: true, order: 1 },
      { label: 'My Booking', enabled: true, order: 2 },
      { label: 'Messages', enabled: true, order: 3 },
      { label: 'Services', enabled: true, order: 4 },
      { label: 'Profile', enabled: true, order: 5 },
    ],
    builtInPages: {
      home: true,
      myBooking: true,
      houseRules: true,
      wifiInstructions: true,
      localGuide: false,
      addOns: true,
      contact: true,
      reviews: true,
    },
    customPages: [],
    quickLinks: [],
  },
  features: {
    digitalCheckInEnabled: true,
    checkInSteps: {
      guestInfo: { enabled: true, required: true, order: 1 },
      additionalGuests: { enabled: true, required: false, order: 2 },
      idUpload: { enabled: true, required: true, order: 3 },
      registrationCard: { enabled: true, required: true, order: 4 },
      paymentAuth: { enabled: true, required: false, order: 5 },
      specialRequests: { enabled: true, required: false, order: 6 },
      houseRules: { enabled: true, required: true, order: 7 },
    },
    checkInTimeWindow: '24h',
    mobileKeyEnabled: true,
    accessCodeDelivery: 'sms',
    inPortalChat: true,
    folioViewEnabled: true,
    upsellMarketplaceEnabled: true,
    reviewRequestTiming: 'post-stay',
    checkoutFlowEnabled: true,
    qrCodeSettingsEnabled: false,
  },
  languages: {
    availableLanguages: ['en'],
    defaultLanguage: 'en',
    autoDetect: 'browser',
    autoTranslateEnabled: false,
    translationCompletion: { en: 100 },
  },
  advanced: {
    dataRetention: 365,
    httpsEnforced: true,
  },
};

export default function GuestPortalPage() {
  const { property } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [portals, setPortals] = useState<GuestPortalSettings[]>([]);
  const [selectedPortalId, setSelectedPortalId] = useState<string | null>(null);
  const [showCreatePortal, setShowCreatePortal] = useState(false);
  const [newPortalName, setNewPortalName] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    identity: true,
    access: true,
    windows: false,
    triggers: false,
    domain: false,
  });

  // Branding tab states
  const [logoUploadLoading, setLogoUploadLoading] = useState(false);
  const [darkLogoUploadLoading, setDarkLogoUploadLoading] = useState(false);
  const [faviconUploadLoading, setFaviconUploadLoading] = useState(false);
  const [heroUploadLoading, setHeroUploadLoading] = useState(false);
  const [expandedBrandingSections, setExpandedBrandingSections] = useState<{ [key: string]: boolean }>({
    logos: true,
    colors: true,
    welcome: true,
    hero: false,
    quickLinks: false,
    social: false,
    contact: true,
    footer: false,
  });

  // Prevent duplicate auto-creation of default portal
  const autoCreatingRef = useRef(false);

  const selectedPortal = portals.find(p => p.id === selectedPortalId) || null;

  // Load all portals for this property
  useEffect(() => {
    const fetchPortals = async () => {
      if (!property?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const portalsPath = collection(db, 'properties', property.id, 'guestPortals');
        const portalsSnapshot = await getDocs(portalsPath);
        
        let loadedPortals = portalsSnapshot.docs.map(doc => ({
          ...(doc.data() as GuestPortalSettings),
          id: doc.id,
        }));

        // Auto-create default portal if none exist (with guard to prevent duplicates)
        if (loadedPortals.length === 0 && !autoCreatingRef.current) {
          const defaultPortalId = `portal-${Date.now()}`;
          autoCreatingRef.current = true; // Mark as in-progress
          
          const defaultPortal: GuestPortalSettings = {
            ...defaultSettings,
            general: {
              ...defaultSettings.general,
              portalName: 'Guest Portal',
              defaultPortal: true,
            },
          };

          try {
            // Create in Firestore (timestamps will be set by server)
            await setDoc(
              doc(db, 'properties', property.id, 'guestPortals', defaultPortalId),
              {
                ...defaultPortal,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              }
            );

            // Load the created portal back from Firestore to get actual timestamps
            const createdDocSnap = await getDoc(
              doc(db, 'properties', property.id, 'guestPortals', defaultPortalId)
            );
            
            if (createdDocSnap.exists()) {
              loadedPortals = [{ ...(createdDocSnap.data() as GuestPortalSettings), id: defaultPortalId }];
            } else {
              // Fallback if document doesn't exist yet
              loadedPortals = [{ ...defaultPortal, id: defaultPortalId }];
            }
          } finally {
            autoCreatingRef.current = false; // Mark as complete
          }
        }
        setPortals(loadedPortals);
        
        // Automatically select the default portal or the first one
        if (loadedPortals.length > 0) {
          const defaultPortal = loadedPortals.find(p => p.general.defaultPortal);
          const selectedId = defaultPortal?.id || loadedPortals[0].id;
          setSelectedPortalId(selectedId);
        } else {
          setSelectedPortalId(null);
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching portals:', error);
        autoCreatingRef.current = false; // Reset flag on error
        toast({
          title: 'Error',
          description: 'Failed to load guest portals',
          variant: 'destructive',
        });
        setIsLoading(false);
      }
    };

    fetchPortals();
  }, [property?.id]);

  const handleCreatePortal = async () => {
    if (!property?.id || !newPortalName.trim()) {
      toast({
        title: 'Error',
        description: 'Portal name is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      const portalId = `portal-${Date.now()}`;
      const newPortal: GuestPortalSettings = {
        ...defaultSettings,
        general: {
          ...defaultSettings.general,
          portalName: newPortalName,
          defaultPortal: portals.length === 0, // First portal is default
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(
        doc(db, 'properties', property.id, 'guestPortals', portalId),
        newPortal
      );

      const portalWithId = { ...newPortal, id: portalId };
      setPortals([...portals, portalWithId]);
      setSelectedPortalId(portalId);
      setNewPortalName('');
      setShowCreatePortal(false);

      toast({
        title: 'Success',
        description: 'Guest portal created successfully',
      });
    } catch (error) {
      console.error('Error creating portal:', error);
      toast({
        title: 'Error',
        description: 'Failed to create portal',
        variant: 'destructive',
      });
    }
  };

  const handleSave = async () => {
    if (!property?.id || !selectedPortal?.id) {
      toast({
        title: 'Error',
        description: 'Property or portal not found',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const { id, ...dataToSave } = selectedPortal;
      const docRef = doc(db, 'properties', property.id, 'guestPortals', selectedPortal.id);
      
      // Check if document exists
      const docSnapshot = await getDoc(docRef);
      
      if (docSnapshot.exists()) {
        // Document exists, use updateDoc
        await updateDoc(docRef, {
          ...dataToSave,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Document doesn't exist, use setDoc
        await setDoc(docRef, {
          ...dataToSave,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      toast({
        title: 'Success',
        description: 'Portal settings saved successfully',
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save settings',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePortal = async () => {
    if (!property?.id || !selectedPortal?.id) return;

    setIsSaving(true);
    try {
      await deleteDoc(
        doc(db, 'properties', property.id, 'guestPortals', selectedPortal.id)
      );

      const updatedPortals = portals.filter(p => p.id !== selectedPortal.id);
      setPortals(updatedPortals);
      setSelectedPortalId(updatedPortals.length > 0 ? (updatedPortals[0].id as string) : null);
      setDeleteConfirmOpen(false);

      toast({
        title: 'Success',
        description: 'Portal deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting portal:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete portal',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const updatePortalSetting = (section: keyof GuestPortalSettings, field: string, value: any) => {
    if (!selectedPortal) return;

    setPortals(prev => prev.map(p => {
      if (p.id === selectedPortal.id) {
        const updated = { ...p };
        if (section === 'general' || section === 'branding' || section === 'navigation' || section === 'features' || section === 'languages' || section === 'advanced') {
          (updated[section] as any) = {
            ...(updated[section] as any),
            [field]: value
          };
        }
        return updated;
      }
      return p;
    }));
  };

  // File upload handlers
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Error',
        description: 'Please upload a PNG, JPG, WebP, AVIF, or SVG file',
        variant: 'destructive',
      });
      return;
    }

    setLogoUploadLoading(true);
    try {
      const uploadPath = `guest-portal-logos/${selectedPortal?.id}`;
      const url = await uploadFile(uploadPath, file);
      updatePortalSetting('branding', 'logo', url);
      toast({
        title: 'Success',
        description: 'Logo uploaded successfully',
      });
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload logo',
        variant: 'destructive',
      });
    } finally {
      setLogoUploadLoading(false);
    }
  };

  const handleDarkLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Error',
        description: 'Please upload a PNG, JPG, WebP, AVIF, or SVG file',
        variant: 'destructive',
      });
      return;
    }

    setDarkLogoUploadLoading(true);
    try {
      const uploadPath = `guest-portal-logos/${selectedPortal?.id}/dark`;
      const url = await uploadFile(uploadPath, file);
      updatePortalSetting('branding', 'darkLogo', url);
      toast({
        title: 'Success',
        description: 'Dark logo uploaded successfully',
      });
    } catch (error) {
      console.error('Error uploading dark logo:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload dark logo',
        variant: 'destructive',
      });
    } finally {
      setDarkLogoUploadLoading(false);
    }
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/svg+xml', 'image/x-icon'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Error',
        description: 'Please upload a PNG, JPG, WebP, AVIF, SVG, or ICO file',
        variant: 'destructive',
      });
      return;
    }

    setFaviconUploadLoading(true);
    try {
      const uploadPath = `guest-portal-favicons/${selectedPortal?.id}`;
      const url = await uploadFile(uploadPath, file);
      updatePortalSetting('branding', 'favicon', url);
      toast({
        title: 'Success',
        description: 'Favicon uploaded successfully',
      });
    } catch (error) {
      console.error('Error uploading favicon:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload favicon',
        variant: 'destructive',
      });
    } finally {
      setFaviconUploadLoading(false);
    }
  };

  const handleHeroImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Error',
        description: 'Please upload an image file',
        variant: 'destructive',
      });
      return;
    }

    setHeroUploadLoading(true);
    try {
      const uploadPath = `guest-portal-hero/${selectedPortal?.id}`;
      const url = await uploadFile(uploadPath, file);
      
      const updatedImages = [...(selectedPortal?.branding.heroImages || []), url];
      const updatedCaptions = [...(selectedPortal?.branding.heroCaptions || []), ''];
      
      updatePortalSetting('branding', 'heroImages', updatedImages);
      updatePortalSetting('branding', 'heroCaptions', updatedCaptions);
      
      toast({
        title: 'Success',
        description: 'Hero image added to carousel',
      });
    } catch (error) {
      console.error('Error uploading hero image:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload hero image',
        variant: 'destructive',
      });
    } finally {
      setHeroUploadLoading(false);
    }
  };

  const removeHeroImage = (index: number) => {
    const updatedImages = selectedPortal!.branding.heroImages.filter((_, i) => i !== index);
    const updatedCaptions = selectedPortal!.branding.heroCaptions.filter((_, i) => i !== index);
    
    updatePortalSetting('branding', 'heroImages', updatedImages);
    updatePortalSetting('branding', 'heroCaptions', updatedCaptions);
  };

  const updateHeroCaption = (index: number, caption: string) => {
    const updatedCaptions = [...selectedPortal!.branding.heroCaptions];
    updatedCaptions[index] = caption;
    updatePortalSetting('branding', 'heroCaptions', updatedCaptions);
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-slate-600">Loading guest portals...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b bg-background px-6 py-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Guest Portal Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage and customize guest portal configurations</p>
          </div>
          <PropertySettingsSubtabs subtabs={communicationSubtabs} />
        </div>
      </div>

      {/* Portal List & Selector */}
      <div className="bg-background px-6 py-3">
        <div className="flex items-center gap-3">
          <Label className="text-sm font-semibold text-slate-700 whitespace-nowrap">Portal</Label>
          <div className="flex items-center gap-2 ml-auto">
            <Select value={selectedPortalId} onValueChange={(value) => setSelectedPortalId(value)}>
              <SelectTrigger className="h-9 w-64">
                <SelectValue placeholder="Select a portal" />
              </SelectTrigger>
              <SelectContent>
                {portals.map(portal => (
                  <SelectItem key={portal.id} value={portal.id || ''}>
                    <div className="flex items-center gap-2">
                      <span>{portal.general.portalName || 'Unnamed Portal'}</span>
                      {portal.general.defaultPortal && (
                        <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Default</span>
                      )}
                      {!portal.general.enabled && (
                        <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Offline</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={() => setShowCreatePortal(true)}
              className="h-9 text-xs gap-1 bg-blue-600 hover:bg-blue-700"
            >
              <Icons.PlusCircle className="w-3 h-3" /> New Portal
            </Button>
          </div>
        </div>
      </div>

      {/* Create Portal Dialog */}
      {showCreatePortal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Create New Portal</CardTitle>
              <CardDescription>Add a new guest portal configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs font-bold text-slate-600 uppercase mb-2 block">Portal Name</Label>
                <Input
                  value={newPortalName}
                  onChange={(e) => setNewPortalName(e.target.value)}
                  placeholder="e.g., Standard Portal"
                  className="h-9"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleCreatePortal}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold h-9"
                >
                  Create
                </Button>
                <Button
                  onClick={() => {
                    setShowCreatePortal(false);
                    setNewPortalName('');
                  }}
                  variant="outline"
                  className="flex-1 h-9"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Content - Show settings for selected portal */}
      {selectedPortal ? (
        <div className="flex-1 overflow-auto">
          {/* Internal Tabs */}
          <div className="border-b border-slate-200 bg-background px-6 sticky top-0 z-10">
            <div className="flex gap-8">
              <button 
                onClick={() => setActiveTab('general')} 
                className={`pb-3 px-1 text-sm font-semibold transition-colors relative ${
                  activeTab === 'general' 
                    ? 'text-primary' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                General
                {activeTab === 'general' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-md"></div>
                )}
              </button>
              <button 
                onClick={() => setActiveTab('branding')} 
                className={`pb-3 px-1 text-sm font-semibold transition-colors relative ${
                  activeTab === 'branding' 
                    ? 'text-primary' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Branding
                {activeTab === 'branding' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-md"></div>
                )}
              </button>
              <button 
                onClick={() => setActiveTab('navigation')} 
                className={`pb-3 px-1 text-sm font-semibold transition-colors relative ${
                  activeTab === 'navigation' 
                    ? 'text-primary' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Navigation
                {activeTab === 'navigation' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-md"></div>
                )}
              </button>
              <button 
                onClick={() => setActiveTab('features')} 
                className={`pb-3 px-1 text-sm font-semibold transition-colors relative ${
                  activeTab === 'features' 
                    ? 'text-primary' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Features
                {activeTab === 'features' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-md"></div>
                )}
              </button>
              <button 
                onClick={() => setActiveTab('advanced')} 
                className={`pb-3 px-1 text-sm font-semibold transition-colors relative ${
                  activeTab === 'advanced' 
                    ? 'text-primary' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Advanced
                {activeTab === 'advanced' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-md"></div>
                )}
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* GENERAL TAB */}
            {activeTab === 'general' && (
              <>
                {/* PORTAL IDENTITY */}
                <Card>
                  <CardHeader 
                    className="pb-3 cursor-pointer hover:bg-slate-50"
                    onClick={() => setExpandedSections(p => ({ ...p, identity: !p.identity }))}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-xl">Portal Identity</CardTitle>
                        <CardDescription className="text-xs">Configure portal name, properties, status, and default settings</CardDescription>
                      </div>
                      <Icons.DropdownArrow className={`w-5 h-5 text-slate-500 transition-transform ${expandedSections.identity ? 'rotate-180' : ''}`} />
                    </div>
                  </CardHeader> 
                  {expandedSections.identity && (
                    <CardContent className="space-y-4 pt-4 border-t">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border border-slate-300">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-300">
                              <th className="px-3 py-2 h-8 text-left font-semibold text-xs border-r border-slate-300">Portal Name</th>
                              <th className="px-3 py-2 h-8 text-left font-semibold text-xs border-r border-slate-300">Properties</th>
                              <th className="px-3 py-2 h-8 text-left font-semibold text-xs">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b border-slate-300 hover:bg-slate-50 transition-colors">
                              <td className="px-3 py-2 border-r border-slate-300">
                                <Input
                                  value={selectedPortal.general.portalName}
                                  onChange={(e) => updatePortalSetting('general', 'portalName', e.target.value)}
                                  placeholder="e.g., Main Portal"
                                  className="h-8 text-xs"
                                />
                              </td>
                              <td className="px-3 py-2 border-r border-slate-300">
                                <Select value={selectedPortal.general.properties?.[0] || ''} onValueChange={(val) => updatePortalSetting('general', 'properties', [val])}>
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Select properties" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">All Properties</SelectItem>
                                    <SelectItem value={selectedPortal.id || ''}>Current Property</SelectItem>
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <Switch
                                  checked={selectedPortal.general.enabled}
                                  onCheckedChange={(checked) => updatePortalSetting('general', 'enabled', checked)}
                                />
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  )}
                </Card>

                {/* HOW GUESTS ACCESS */}
                <Card>
                  <CardHeader 
                    className="pb-3 cursor-pointer hover:bg-slate-50"
                    onClick={() => setExpandedSections(p => ({ ...p, access: !p.access }))}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-xl">How Guests Access</CardTitle>
                        <CardDescription className="text-xs">Configure authentication methods and link expiration</CardDescription>
                      </div>
                      <Icons.DropdownArrow className={`w-5 h-5 text-slate-500 transition-transform ${expandedSections.access ? 'rotate-180' : ''}`} />
                    </div>
                  </CardHeader>
              {expandedSections.access && (
                <CardContent className="space-y-4 pt-4 border-t">
                  {/* Magic Link */}
                  <label className="flex items-start gap-3 p-3 rounded-lg border border-blue-200 bg-blue-50 cursor-pointer">
                    <input
                      type="radio"
                      name="auth"
                      value="magic-link"
                      checked={selectedPortal.general.authenticationMethod === 'magic-link'}
                      onChange={(e) => updatePortalSetting('general', 'authenticationMethod', e.target.value)}
                      className="w-4 h-4 mt-0.5"
                    />
                    <div className="flex-1">
                      <p className="font-semibold text-sm">Magic Link</p>
                      <p className="text-xs text-slate-600 mt-1">One-click email/SMS links. No passwords needed.</p>
                      {selectedPortal.general.authenticationMethod === 'magic-link' && (
                        <div className="mt-3 space-y-2">
                          <label className="flex items-center gap-2">
                            <input type="checkbox" className="w-4 h-4" />
                            <span className="text-xs">Set link expiration</span>
                          </label>
                          <div className="flex items-center gap-2 pl-6">
                            <Input
                              type="number"
                              value={selectedPortal.general.magicLinkExpiration}
                              onChange={(e) => updatePortalSetting('general', 'magicLinkExpiration', parseInt(e.target.value))}
                              min={1}
                              className="h-8 w-20 text-sm"
                            />
                            <span className="text-xs text-slate-600">hours</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </label>

                  {/* PIN Code */}
                  <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                    <input
                      type="radio"
                      name="auth"
                      value="pin"
                      checked={selectedPortal.general.authenticationMethod === 'pin'}
                      onChange={(e) => updatePortalSetting('general', 'authenticationMethod', e.target.value)}
                      className="w-4 h-4 mt-0.5"
                    />
                    <div className="flex-1">
                      <p className="font-semibold text-sm">PIN Code</p>
                      <p className="text-xs text-slate-600 mt-1">6-digit code sent via SMS/WhatsApp</p>
                      {selectedPortal.general.authenticationMethod === 'pin' && (
                        <p className="text-xs text-red-600 mt-2">SMS configuration required</p>
                      )}
                    </div>
                  </label>

                  {/* Reservation Number */}
                  <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                    <input
                      type="radio"
                      name="auth"
                      value="reservation-number"
                      checked={selectedPortal.general.authenticationMethod === 'reservation-number'}
                      onChange={(e) => updatePortalSetting('general', 'authenticationMethod', e.target.value)}
                      className="w-4 h-4 mt-0.5"
                    />
                    <div className="flex-1">
                      <p className="font-semibold text-sm">Reservation Number</p>
                      <p className="text-xs text-slate-600 mt-1">Guests use their confirmation number</p>
                    </div>
                  </label>

                  {/* Email + Password */}
                  <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                    <input
                      type="radio"
                      name="auth"
                      value="password"
                      checked={selectedPortal.general.authenticationMethod === 'password'}
                      onChange={(e) => updatePortalSetting('general', 'authenticationMethod', e.target.value)}
                      className="w-4 h-4 mt-0.5"
                    />
                    <div className="flex-1">
                      <p className="font-semibold text-sm">Email + Password</p>
                      <p className="text-xs text-slate-600 mt-1">For guest accounts only - guests create their own password</p>
                    </div>
                  </label>
                </CardContent>
              )}
            </Card>

            {/* WHEN GUESTS CAN ACCESS IT */}
            <Card>
              <CardHeader 
                className="pb-3 cursor-pointer hover:bg-slate-50"
                onClick={() => setExpandedSections(p => ({ ...p, windows: !p.windows }))}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">When Guests Can Access It</CardTitle>
                    <CardDescription className="text-xs">Set access windows and conditions for guest portal availability</CardDescription>
                  </div>
                  <Icons.DropdownArrow className={`w-5 h-5 text-slate-500 transition-transform ${expandedSections.windows ? 'rotate-180' : ''}`} />
                </div>
              </CardHeader>
              {expandedSections.windows && (
                <CardContent className="space-y-4 pt-4 border-t">
                  
                  {/* GRANT ACCESS */}
                  <div>
                    <h4 className="font-semibold text-sm text-slate-700 mb-2">Grant Access</h4>
                    <div className="space-y-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="radio" 
                          name="grantAccess" 
                          checked={selectedPortal.general.preArrivalDays === 0}
                          onChange={() => updatePortalSetting('general', 'preArrivalDays', 0)}
                          className="w-4 h-4" 
                        />
                        <span className="text-sm hover:text-primary transition-colors">Once checked-in</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="radio" 
                          name="grantAccess" 
                          checked={selectedPortal.general.preArrivalDays > 0}
                          onChange={() => updatePortalSetting('general', 'preArrivalDays', 4)}
                          className="w-4 h-4" 
                        />
                        <span className="text-sm hover:text-primary transition-colors">X days before check-in</span>
                        <Input 
                          type="number" 
                          min={0} 
                          value={selectedPortal.general.preArrivalDays}
                          onChange={(e) => updatePortalSetting('general', 'preArrivalDays', parseInt(e.target.value) || 0)}
                          className="h-7 w-14 ml-1 text-sm" 
                        />
                      </label>
                    </div>
                  </div>

                  {/* BLOCK ACCESS */}
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-sm text-slate-700 mb-2">Block Access</h4>
                    <div className="space-y-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="radio" 
                          name="blockAccess" 
                          checked={selectedPortal.general.postDepartureDays === 0}
                          onChange={() => updatePortalSetting('general', 'postDepartureDays', 0)}
                          className="w-4 h-4" 
                        />
                        <span className="text-sm hover:text-primary transition-colors">Once checked-out</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="radio" 
                          name="blockAccess" 
                          checked={selectedPortal.general.postDepartureDays > 0}
                          onChange={() => updatePortalSetting('general', 'postDepartureDays', 4)}
                          className="w-4 h-4" 
                        />
                        <span className="text-sm hover:text-primary transition-colors">X days after departure</span>
                        <Input 
                          type="number" 
                          min={0} 
                          value={selectedPortal.general.postDepartureDays}
                          onChange={(e) => updatePortalSetting('general', 'postDepartureDays', parseInt(e.target.value) || 0)}
                          className="h-7 w-14 ml-1 text-sm" 
                        />
                      </label>
                    </div>
                  </div>

                  {/* PERMANENT ACCESS */}
                  <div className="border-t pt-4">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <p className="font-semibold text-sm hover:text-primary transition-colors">Permanent Access</p>
                        <p className="text-xs text-slate-600 mt-0.5">For registered loyal guest accounts only</p>
                      </div>
                      <Switch checked={selectedPortal.general.permanentAccessEnabled} onCheckedChange={(checked) => updatePortalSetting('general', 'permanentAccessEnabled', checked)} />
                    </label>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* AUTO SEND */}
            <Card>
              <CardHeader 
                className="pb-3 cursor-pointer hover:bg-slate-50"
                onClick={() => setExpandedSections(p => ({ ...p, triggers: !p.triggers }))}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">Auto Send</CardTitle>
                    <CardDescription className="text-xs">Configure rules and channels for automatic portal link delivery</CardDescription>
                  </div>
                  <Icons.DropdownArrow className={`w-5 h-5 text-slate-500 transition-transform ${expandedSections.triggers ? 'rotate-180' : ''}`} />
                </div>
              </CardHeader>
              {expandedSections.triggers && (
                <CardContent className="space-y-4 pt-4 border-t">
                  
                  {/* RULES */}
                  <div>
                    <h4 className="font-semibold text-sm text-slate-700 mb-2">Rules</h4>
                    <div className="space-y-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={selectedPortal.general.autoSendTriggers.includes('booking-confirmed')}
                          onChange={(e) => {
                            const triggers = e.target.checked 
                              ? [...selectedPortal.general.autoSendTriggers, 'booking-confirmed']
                              : selectedPortal.general.autoSendTriggers.filter(t => t !== 'booking-confirmed');
                            updatePortalSetting('general', 'autoSendTriggers', triggers);
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-sm hover:text-primary transition-colors">On booking confirmed</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={selectedPortal.general.autoSendTriggers.includes('pre-arrival')}
                          onChange={(e) => {
                            const triggers = e.target.checked 
                              ? [...selectedPortal.general.autoSendTriggers, 'pre-arrival']
                              : selectedPortal.general.autoSendTriggers.filter(t => t !== 'pre-arrival');
                            updatePortalSetting('general', 'autoSendTriggers', triggers);
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-sm hover:text-primary transition-colors">Before check-in</span>
                        <Input type="number" min={0} placeholder="Days" className="h-7 w-14 ml-1 text-sm" />
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={selectedPortal.general.autoSendTriggers.includes('check-in')}
                          onChange={(e) => {
                            const triggers = e.target.checked 
                              ? [...selectedPortal.general.autoSendTriggers, 'check-in']
                              : selectedPortal.general.autoSendTriggers.filter(t => t !== 'check-in');
                            updatePortalSetting('general', 'autoSendTriggers', triggers);
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-sm hover:text-primary transition-colors">After check-in (default)</span>
                      </label>
                    </div>
                  </div>

                  {/* CHANNELS */}
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-sm text-slate-700 mb-2">Channels</h4>
                    <div className="space-y-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" defaultChecked className="w-4 h-4" />
                        <span className="text-sm hover:text-primary transition-colors">Email (default)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="w-4 h-4" />
                        <span className="text-sm hover:text-primary transition-colors">SMS</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="w-4 h-4" />
                        <span className="text-sm hover:text-primary transition-colors">WhatsApp</span>
                      </label>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* LANGUAGE */}
            <Card>
              <CardHeader 
                className="pb-3 cursor-pointer hover:bg-slate-50"
                onClick={() => setExpandedSections(p => ({ ...p, domain: !p.domain }))}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">Language</CardTitle>
                    <CardDescription className="text-xs">Set default language and configure auto-detection preferences</CardDescription>
                  </div>
                  <Icons.DropdownArrow className={`w-5 h-5 text-slate-500 transition-transform ${expandedSections.domain ? 'rotate-180' : ''}`} />
                </div>
              </CardHeader>
              {expandedSections.domain && (
                <CardContent className="space-y-4 pt-4 border-t">
                  <div>
                    <Label className="text-sm font-semibold text-slate-700 mb-2 block">Default Language</Label>
                    <Select>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="fr">Français</SelectItem>
                        <SelectItem value="es">Español</SelectItem>
                        <SelectItem value="ar">العربية</SelectItem>
                        <SelectItem value="de">Deutsch</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="border-t pt-4">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <p className="font-semibold text-sm hover:text-primary transition-colors">Auto-detect Language</p>
                        <p className="text-xs text-slate-600 mt-0.5">Automatically detect guest language</p>
                      </div>
                      <Switch />
                    </label>

                    <div className="mt-2 pl-4 space-y-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="autoDetect" defaultChecked className="w-4 h-4" />
                        <span className="text-sm hover:text-primary transition-colors">Browser Preferences</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="autoDetect" className="w-4 h-4" />
                        <span className="text-sm hover:text-primary transition-colors">Guest Country on Profile</span>
                      </label>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* SAVE BUTTON */}
            <div className="flex gap-2 pt-4 sticky bottom-0 bg-white/80 backdrop-blur border-t p-4 -m-6 mt-0">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 h-10"
              >
                {isSaving ? (
                  <>
                    <Icons.Spinner className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Icons.Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
            </>
            )}

            {/* BRANDING & HOME TAB */}
            {activeTab === 'branding' && (
              <>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* LEFT: Branding Controls */}
                    <div className="lg:col-span-2 space-y-4">
                
                    {/* LOGO & FAVICON */}
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader 
                    className="pb-3 cursor-pointer hover:bg-slate-50"
                    onClick={() => setExpandedBrandingSections(p => ({ ...p, logos: !p.logos }))}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icons.ImageIcon className="w-5 h-5 text-slate-500" />
                        <div>
                          <CardTitle className="text-base">Logo & Favicon</CardTitle>
                          <CardDescription className="text-xs">Brand identity assets</CardDescription>
                        </div>
                      </div>
                      <Icons.DropdownArrow className={`w-5 h-5 text-slate-500 transition-transform ${expandedBrandingSections.logos ? 'rotate-180' : ''}`} />
                    </div>
                  </CardHeader>
                  {expandedBrandingSections.logos && (
                    <CardContent className="space-y-4 pt-4 border-t">
                      {/* Main Logo */}
                      <div>
                        <Label className="text-sm font-semibold mb-2 block">Logo <span className="text-xs text-slate-500">(Light Mode)</span></Label>
                        <p className="text-xs text-slate-600 mb-3">180–300px wide, PNG/JPG/WebP/AVIF/SVG</p>
                        <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:bg-slate-50 transition-colors">
                          {selectedPortal.branding.logo ? (
                            <div className="space-y-3">
                              <div className="w-32 h-20 mx-auto bg-white rounded border flex items-center justify-center">
                                <img 
                                  src={selectedPortal.branding.logo} 
                                  alt="Logo preview" 
                                  className="max-w-full max-h-full object-contain"
                                />
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full text-xs gap-1"
                                onClick={() => document.getElementById('logo-input')?.click()}
                                disabled={logoUploadLoading}
                              >
                                {logoUploadLoading ? (
                                  <>
                                    <Icons.Spinner className="w-3 h-3 animate-spin" />
                                    Uploading...
                                  </>
                                ) : (
                                  <>
                                    <Icons.PlusCircle className="w-3 h-3" />
                                    Change Logo
                                  </>
                                )}
                              </Button>
                            </div>
                          ) : (
                            <div 
                              className="space-y-2 cursor-pointer"
                              onClick={() => document.getElementById('logo-input')?.click()}
                            >
                              <Icons.UploadCloud className="w-8 h-8 text-slate-400 mx-auto" />
                              <p className="text-sm font-medium text-slate-700">Drop logo here or click to upload</p>
                              <p className="text-xs text-slate-600">PNG, JPG, WebP, AVIF, SVG up to 5MB</p>
                            </div>
                          )}
                          <input
                            id="logo-input"
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/avif,image/svg+xml"
                            onChange={handleLogoUpload}
                            disabled={logoUploadLoading}
                            className="hidden"
                          />
                        </div>
                      </div>

                      {/* Dark Mode Logo */}
                      <div>
                        <Label className="text-sm font-semibold mb-2 block">Dark Mode Logo <span className="text-xs text-slate-500">(Optional)</span></Label>
                        <p className="text-xs text-slate-600 mb-3">For dark themed portals - PNG/JPG/WebP/AVIF/SVG</p>
                        <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:bg-slate-50 transition-colors">
                          {selectedPortal.branding.darkLogo ? (
                            <div className="space-y-3">
                              <div className="w-32 h-20 mx-auto bg-slate-900 rounded border flex items-center justify-center">
                                <img 
                                  src={selectedPortal.branding.darkLogo} 
                                  alt="Dark logo preview" 
                                  className="max-w-full max-h-full object-contain"
                                />
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full text-xs gap-1"
                                onClick={() => document.getElementById('dark-logo-input')?.click()}
                                disabled={darkLogoUploadLoading}
                              >
                                {darkLogoUploadLoading ? (
                                  <>
                                    <Icons.Spinner className="w-3 h-3 animate-spin" />
                                    Uploading...
                                  </>
                                ) : (
                                  <>
                                    <Icons.PlusCircle className="w-3 h-3" />
                                    Change Dark Logo
                                  </>
                                )}
                              </Button>
                            </div>
                          ) : (
                            <div 
                              className="space-y-2 cursor-pointer"
                              onClick={() => document.getElementById('dark-logo-input')?.click()}
                            >
                              <Icons.UploadCloud className="w-8 h-8 text-slate-400 mx-auto" />
                              <p className="text-sm font-medium text-slate-700">Drop dark logo here or click to upload</p>
                              <p className="text-xs text-slate-600">PNG, JPG, WebP, AVIF, SVG up to 5MB</p>
                            </div>
                          )}
                          <input
                            id="dark-logo-input"
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/avif,image/svg+xml"
                            onChange={handleDarkLogoUpload}
                            disabled={darkLogoUploadLoading}
                            className="hidden"
                          />
                        </div>
                      </div>

                      {/* Favicon */}
                      <div className="border-t pt-4">
                        <Label className="text-sm font-semibold mb-2 block">Favicon</Label>
                        <p className="text-xs text-slate-600 mb-3">16×16 to 64×64 px, PNG/JPG/WebP/AVIF/SVG/ICO</p>
                        <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:bg-slate-50 transition-colors">
                          {selectedPortal.branding.favicon ? (
                            <div className="flex items-center justify-center gap-3">
                              <div className="w-10 h-10 rounded border flex items-center justify-center bg-white">
                                <img 
                                  src={selectedPortal.branding.favicon} 
                                  alt="Favicon" 
                                  className="w-6 h-6"
                                />
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs gap-1"
                                onClick={() => document.getElementById('favicon-input')?.click()}
                                disabled={faviconUploadLoading}
                              >
                                {faviconUploadLoading ? 'Uploading...' : 'Change Favicon'}
                              </Button>
                            </div>
                          ) : (
                            <div
                              onClick={() => document.getElementById('favicon-input')?.click()}
                              className="cursor-pointer"
                            >
                              <p className="text-sm text-slate-600">Click to upload favicon</p>
                            </div>
                          )}
                          <input
                            id="favicon-input"
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/avif,image/svg+xml,image/x-icon"
                            onChange={handleFaviconUpload}
                            disabled={faviconUploadLoading}
                            className="hidden"
                          />
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>

                {/* COLORS */}
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader 
                    className="pb-3 cursor-pointer hover:bg-slate-50"
                    onClick={() => setExpandedBrandingSections(p => ({ ...p, colors: !p.colors }))}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icons.Palette className="w-5 h-5 text-slate-500" />
                        <div>
                          <CardTitle className="text-base">Colors & Theme</CardTitle>
                          <CardDescription className="text-xs">Customize color scheme</CardDescription>
                        </div>
                      </div>
                      <Icons.DropdownArrow className={`w-5 h-5 text-slate-500 transition-transform ${expandedBrandingSections.colors ? 'rotate-180' : ''}`} />
                    </div>
                  </CardHeader>
                  {expandedBrandingSections.colors && (
                    <CardContent className="space-y-4 pt-4 border-t">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-semibold mb-2 block">Primary Color</Label>
                          <p className="text-xs text-slate-600 mb-2">Buttons, links, accents</p>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={selectedPortal.branding.primaryColor}
                              onChange={(e) => updatePortalSetting('branding', 'primaryColor', e.target.value)}
                              className="h-10 w-16 rounded cursor-pointer border"
                            />
                            <Input
                              value={selectedPortal.branding.primaryColor}
                              onChange={(e) => updatePortalSetting('branding', 'primaryColor', e.target.value)}
                              className="h-10 flex-1 font-mono text-xs"
                            />
                          </div>
                        </div>

                        <div>
                          <Label className="text-sm font-semibold mb-2 block">Secondary Color</Label>
                          <p className="text-xs text-slate-600 mb-2">Subheadings, borders</p>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={selectedPortal.branding.accentColor}
                              onChange={(e) => updatePortalSetting('branding', 'accentColor', e.target.value)}
                              className="h-10 w-16 rounded cursor-pointer border"
                            />
                            <Input
                              value={selectedPortal.branding.accentColor}
                              onChange={(e) => updatePortalSetting('branding', 'accentColor', e.target.value)}
                              className="h-10 flex-1 font-mono text-xs"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-semibold mb-2 block">Background Color</Label>
                          <p className="text-xs text-slate-600 mb-2">Page fallback color</p>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={selectedPortal.branding.backgroundColor}
                              onChange={(e) => updatePortalSetting('branding', 'backgroundColor', e.target.value)}
                              className="h-10 w-16 rounded cursor-pointer border"
                            />
                            <Input
                              value={selectedPortal.branding.backgroundColor}
                              onChange={(e) => updatePortalSetting('branding', 'backgroundColor', e.target.value)}
                              className="h-10 flex-1 font-mono text-xs"
                            />
                          </div>
                        </div>

                        <div>
                          <Label className="text-sm font-semibold mb-2 block">Text Color</Label>
                          <p className="text-xs text-slate-600 mb-2">Override for contrast</p>
                          <p className="text-xs text-blue-600 mt-2">🔗 Set automatically</p>
                        </div>
                      </div>

                      <div className="border-t pt-4">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border">
                          <div>
                            <Label className="text-sm font-semibold">Dark Mode</Label>
                            <p className="text-xs text-slate-600 mt-1">Auto-detect system preference</p>
                          </div>
                          <Switch
                            checked={selectedPortal.branding.darkModeEnabled}
                            onCheckedChange={(checked) => updatePortalSetting('branding', 'darkModeEnabled', checked)}
                          />
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>

                {/* FONTS */}
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader 
                    className="pb-3 cursor-pointer hover:bg-slate-50"
                    onClick={() => setExpandedBrandingSections(p => ({ ...p, colors: !p.colors }))}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icons.Type className="w-5 h-5 text-slate-500" />
                        <div>
                          <CardTitle className="text-base">Typography</CardTitle>
                          <CardDescription className="text-xs">Font family selection</CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-4 border-t">
                    <Select value={selectedPortal.branding.fontFamily} onValueChange={(value) => updatePortalSetting('branding', 'fontFamily', value)}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="system">System Default (Arial/Helvetica)</SelectItem>
                        <SelectItem value="Inter">Inter (Modern, Clean)</SelectItem>
                        <SelectItem value="Poppins">Poppins (Rounded, Friendly)</SelectItem>
                        <SelectItem value="Roboto">Roboto (Professional)</SelectItem>
                        <SelectItem value="Raleway">Raleway (Elegant)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-600">Applies to all portal text</p>
                  </CardContent>
                </Card>

                {/* WELCOME CONTENT */}
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader 
                    className="pb-3 cursor-pointer hover:bg-slate-50"
                    onClick={() => setExpandedBrandingSections(p => ({ ...p, welcome: !p.welcome }))}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icons.MessageSquare className="w-5 h-5 text-slate-500" />
                        <div>
                          <CardTitle className="text-base">Welcome Content</CardTitle>
                          <CardDescription className="text-xs">Home page greeting</CardDescription>
                        </div>
                      </div>
                      <Icons.DropdownArrow className={`w-5 h-5 text-slate-500 transition-transform ${expandedBrandingSections.welcome ? 'rotate-180' : ''}`} />
                    </div>
                  </CardHeader>
                  {expandedBrandingSections.welcome && (
                    <CardContent className="space-y-4 pt-4 border-t">
                      <div>
                        <Label className="text-sm font-semibold mb-2 block">Welcome Title</Label>
                        <Input
                          value={selectedPortal.branding.welcomeTitle}
                          onChange={(e) => updatePortalSetting('branding', 'welcomeTitle', e.target.value)}
                          placeholder="e.g., Welcome to {property.name}"
                          className="h-10"
                        />
                        <p className="text-xs text-slate-600 mt-2">Supports merge tags: {'{guest.first_name}'}, {'{property.name}'}</p>
                      </div>

                      <div>
                        <Label className="text-sm font-semibold mb-2 block">Welcome Message</Label>
                        <Textarea
                          value={selectedPortal.branding.welcomeMessage}
                          onChange={(e) => updatePortalSetting('branding', 'welcomeMessage', e.target.value)}
                          placeholder="Write a warm welcome message for your guests..."
                          className="min-h-24"
                        />
                        <p className="text-xs text-slate-600 mt-2">Rich text support coming soon (bold, italic, links)</p>
                      </div>
                    </CardContent>
                  )}
                </Card>

                {/* HERO CAROUSEL */}
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader 
                    className="pb-3 cursor-pointer hover:bg-slate-50"
                    onClick={() => setExpandedBrandingSections(p => ({ ...p, hero: !p.hero }))}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icons.Layers className="w-5 h-5 text-slate-500" />
                        <div>
                          <CardTitle className="text-base">Featured Images</CardTitle>
                          <CardDescription className="text-xs">Hero carousel on home</CardDescription>
                        </div>
                      </div>
                      <Icons.DropdownArrow className={`w-5 h-5 text-slate-500 transition-transform ${expandedBrandingSections.hero ? 'rotate-180' : ''}`} />
                    </div>
                  </CardHeader>
                  {expandedBrandingSections.hero && (
                    <CardContent className="space-y-4 pt-4 border-t">
                      <p className="text-sm text-slate-600">Recommended: 1920×1080px or larger (drag to reorder)</p>
                      
                      {selectedPortal.branding.heroImages.length > 0 && (
                        <div className="space-y-3 mb-4">
                          {selectedPortal.branding.heroImages.map((image, idx) => (
                            <div key={idx} className="border rounded-lg p-3 flex items-start gap-3 bg-slate-50">
                              <div className="w-20 h-20 rounded flex-shrink-0 bg-white border overflow-hidden">
                                <img src={image} alt={`Hero ${idx + 1}`} className="w-full h-full object-cover" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <Input
                                  value={selectedPortal.branding.heroCaptions[idx] || ''}
                                  onChange={(e) => updateHeroCaption(idx, e.target.value)}
                                  placeholder="Add caption (optional)"
                                  className="h-8 text-sm mb-2"
                                />
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="text-xs h-7 gap-1"
                                  onClick={() => removeHeroImage(idx)}
                                >
                                  <Icons.Trash className="w-3 h-3" /> Remove
                                </Button>
                              </div>
                              <Icons.GripVertical className="w-4 h-4 text-slate-400 flex-shrink-0 mt-1" />
                            </div>
                          ))}
                        </div>
                      )}

                      <div 
                        className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => document.getElementById('hero-input')?.click()}
                      >
                        <Icons.PlusCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                        <p className="text-sm font-medium text-slate-700">Add Hero Image</p>
                        <p className="text-xs text-slate-600">Click or drag to upload</p>
                      </div>
                      <input
                        id="hero-input"
                        type="file"
                        accept="image/*"
                        onChange={handleHeroImageUpload}
                        disabled={heroUploadLoading}
                        className="hidden"
                      />

                      <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border">
                        <Label className="text-sm font-semibold">Autoplay Carousel</Label>
                        <Switch defaultChecked className="m-0" />
                      </div>
                    </CardContent>
                  )}
                </Card>

                {/* QUICK LINKS */}
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader 
                    className="pb-3 cursor-pointer hover:bg-slate-50"
                    onClick={() => setExpandedBrandingSections(p => ({ ...p, quickLinks: !p.quickLinks }))}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icons.Link2 className="w-5 h-5 text-slate-500" />
                        <div>
                          <CardTitle className="text-base">Quick Links</CardTitle>
                          <CardDescription className="text-xs">Buttons on home page</CardDescription>
                        </div>
                      </div>
                      <Icons.DropdownArrow className={`w-5 h-5 text-slate-500 transition-transform ${expandedBrandingSections.quickLinks ? 'rotate-180' : ''}`} />
                    </div>
                  </CardHeader>
                  {expandedBrandingSections.quickLinks && (
                    <CardContent className="space-y-3 pt-4 border-t">
                      <p className="text-sm text-slate-600">Examples: "View Folio", "Request Early Check-in", "Local Guide", "Chat with Us"</p>
                      
                      {selectedPortal.navigation.quickLinks?.length > 0 && (
                        <div className="space-y-2 mb-3">
                          {selectedPortal.navigation.quickLinks.map((link, idx) => (
                            <div key={idx} className="flex gap-2 items-end">
                              <Input placeholder="Link text" defaultValue={link.label} className="h-9 flex-1" />
                              <Input placeholder="URL" defaultValue={link.url} className="h-9 flex-1" />
                              <Button variant="ghost" size="sm" className="text-xs h-9">✕</Button>
                            </div>
                          ))}
                        </div>
                      )}

                      <Button variant="outline" className="w-full h-9 text-xs gap-1">
                        <Icons.PlusCircle className="w-3 h-3" /> Add Quick Link
                      </Button>
                    </CardContent>
                  )}
                </Card>

                {/* SOCIAL LINKS */}
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader 
                    className="pb-3 cursor-pointer hover:bg-slate-50"
                    onClick={() => setExpandedBrandingSections(p => ({ ...p, social: !p.social }))}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icons.Inbox className="w-5 h-5 text-slate-500" />
                        <div>
                          <CardTitle className="text-base">Social Links</CardTitle>
                          <CardDescription className="text-xs">Footer social icons</CardDescription>
                        </div>
                      </div>
                      <Icons.DropdownArrow className={`w-5 h-5 text-slate-500 transition-transform ${expandedBrandingSections.social ? 'rotate-180' : ''}`} />
                    </div>
                  </CardHeader>
                  {expandedBrandingSections.social && (
                    <CardContent className="space-y-3 pt-4 border-t">
                      {['facebook', 'instagram', 'twitter', 'tripadvisor'].map((platform) => (
                        <div key={platform}>
                          <Label className="text-sm font-semibold capitalize mb-2 block">{platform}</Label>
                          <Input
                            placeholder={`https://${platform}.com/yourpage`}
                            defaultValue={selectedPortal.branding.socialLinks[platform as keyof typeof selectedPortal.branding.socialLinks] || ''}
                            className="h-9 text-sm"
                          />
                        </div>
                      ))}
                      
                      <div className="pt-3 border-t">
                        <Label className="text-sm font-semibold mb-2 block">Style</Label>
                        <Select>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Select style" defaultValue="colored" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="colored">Colored Icons</SelectItem>
                            <SelectItem value="monochrome">Monochrome Icons</SelectItem>
                            <SelectItem value="rounded">Rounded Buttons</SelectItem>
                            <SelectItem value="square">Square Buttons</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  )}
                </Card>

                {/* CONTACT & FOOTER */}
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader 
                    className="pb-3 cursor-pointer hover:bg-slate-50"
                    onClick={() => setExpandedBrandingSections(p => ({ ...p, contact: !p.contact }))}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icons.Phone className="w-5 h-5 text-slate-500" />
                        <div>
                          <CardTitle className="text-base">Contact & Footer</CardTitle>
                          <CardDescription className="text-xs">Contact options & footer text</CardDescription>
                        </div>
                      </div>
                      <Icons.DropdownArrow className={`w-5 h-5 text-slate-500 transition-transform ${expandedBrandingSections.contact ? 'rotate-180' : ''}`} />
                    </div>
                  </CardHeader>
                  {expandedBrandingSections.contact && (
                    <CardContent className="space-y-4 pt-4 border-t">
                      <div>
                        <Label className="text-sm font-semibold mb-2 block">Phone Number</Label>
                        <Input
                          value={selectedPortal.branding.contactPhone || ''}
                          onChange={(e) => updatePortalSetting('branding', 'contactPhone', e.target.value)}
                          placeholder="+1 (555) 123-4567"
                          className="h-9"
                        />
                      </div>

                      <div>
                        <Label className="text-sm font-semibold mb-2 block">WhatsApp Number</Label>
                        <Input
                          value={selectedPortal.branding.contactWhatsApp || ''}
                          onChange={(e) => updatePortalSetting('branding', 'contactWhatsApp', e.target.value)}
                          placeholder="+1 555 123 4567"
                          className="h-9"
                        />
                        <p className="text-xs text-slate-600 mt-1">Shows as green button in portal</p>
                      </div>

                      <div>
                        <Label className="text-sm font-semibold mb-2 block">Email</Label>
                        <Input
                          type="email"
                          value={selectedPortal.branding.contactEmail || ''}
                          onChange={(e) => updatePortalSetting('branding', 'contactEmail', e.target.value)}
                          placeholder="contact@property.com"
                          className="h-9"
                        />
                      </div>

                      <div className="border-t pt-4">
                        <Label className="text-sm font-semibold mb-2 block">Footer Text</Label>
                        <Input
                          value={selectedPortal.branding.footerText || ''}
                          onChange={(e) => updatePortalSetting('branding', 'footerText', e.target.value)}
                          placeholder="Booking.com verified guest experience"
                          className="h-9"
                        />
                      </div>

                      <div>
                        <Label className="text-sm font-semibold mb-2 block">Copyright</Label>
                        <Input
                          value={selectedPortal.branding.copyrightText || ''}
                          onChange={(e) => updatePortalSetting('branding', 'copyrightText', e.target.value)}
                          placeholder="© 2026 {property.name} | All rights reserved"
                          className="h-9"
                        />
                      </div>
                    </CardContent>
                  )}
                </Card>

              </div>

              {/* RIGHT: Live Preview */}
              <div className="lg:col-span-1">
                <Card className="sticky top-6 border-2 border-blue-200 bg-gradient-to-b from-blue-50 to-white">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Icons.Eye className="w-4 h-4" /> Live Preview
                    </CardTitle>
                    <CardDescription className="text-xs">See changes in real-time</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Preview Device Frame */}
                    <div className="border-8 border-slate-900 rounded-3xl bg-white overflow-hidden shadow-xl" style={{ backgroundColor: selectedPortal.branding.backgroundColor }}>
                      <div className="w-full bg-white p-4 space-y-3" style={{ backgroundColor: selectedPortal.branding.backgroundColor }}>
                        
                        {/* Logo */}
                        {selectedPortal.branding.logo && (
                          <div className="text-center pb-2">
                            <img 
                              src={selectedPortal.branding.logo} 
                              alt="Logo" 
                              className="h-12 mx-auto"
                            />
                          </div>
                        )}

                        {/* Welcome Title */}
                        <h1 
                          className="text-lg font-bold text-center py-2"
                          style={{ color: selectedPortal.branding.primaryColor }}
                        >
                          {selectedPortal.branding.welcomeTitle || 'Welcome'}
                        </h1>

                        {/* Welcome Message */}
                        <p 
                          className="text-xs text-center leading-relaxed"
                          style={{ color: 'inherit' }}
                        >
                          {selectedPortal.branding.welcomeMessage || 'Your portal message appears here'}
                        </p>

                        {/* Hero Image Preview */}
                        {selectedPortal.branding.heroImages.length > 0 && (
                          <div className="w-full h-24 rounded-lg overflow-hidden bg-slate-200 mt-3 flex items-center justify-center">
                            <img 
                              src={selectedPortal.branding.heroImages[0]} 
                              alt="Hero" 
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}

                        {/* Quick Links Preview */}
                        <button 
                          className="w-full py-2 rounded font-semibold text-white text-xs mt-4 transition-opacity hover:opacity-90"
                          style={{ backgroundColor: selectedPortal.branding.primaryColor }}
                        >
                          Enter Portal
                        </button>

                        {/* Contact Info Preview */}
                        {(selectedPortal.branding.contactPhone || selectedPortal.branding.contactEmail) && (
                          <div className="text-xs text-center space-y-1 pt-3 border-t">
                            {selectedPortal.branding.contactPhone && (
                              <p>📞 {selectedPortal.branding.contactPhone}</p>
                            )}
                            {selectedPortal.branding.contactEmail && (
                              <p>✉️ {selectedPortal.branding.contactEmail}</p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Phone notch */}
                      <div className="h-6 bg-slate-900"></div>
                    </div>

                    {/* Preview Stats */}
                    <div className="grid grid-cols-2 gap-2 pt-3 border-t text-xs">
                      <div className="text-center p-2 rounded bg-slate-100">
                        <div className="font-semibold" style={{ color: selectedPortal.branding.primaryColor }}>Primary</div>
                        <div className="text-slate-600">{selectedPortal.branding.primaryColor}</div>
                      </div>
                      <div className="text-center p-2 rounded bg-slate-100">
                        <div className="font-semibold" style={{ color: selectedPortal.branding.accentColor }}>Secondary</div>
                        <div className="text-slate-600">{selectedPortal.branding.accentColor}</div>
                      </div>
                    </div>

                    <Button variant="outline" className="w-full h-9 text-xs gap-1" onClick={() => window.open(`/guest-portal/${selectedPortalId}`, '_blank')}>
                      <Icons.ArrowRight className="w-3 h-3" /> Open Full Preview
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
            </div>
            </>
            )}

            {/* NAVIGATION & CONTENT TAB */}
            {activeTab === 'navigation' && (
              <>
                <div className="space-y-4">
                  <Card>
              <CardHeader>
                <CardTitle>Menu Items</CardTitle>
                <CardDescription>Manage visible menu items (drag to reorder)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {selectedPortal.navigation.menuItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 rounded border">
                    <Icons.GripVertical className="w-4 h-4 text-slate-400 cursor-grab" />
                    <Input
                      value={item.label}
                      onChange={(e) => {
                        const updated = [...selectedPortal.navigation.menuItems];
                        updated[idx].label = e.target.value;
                        updatePortalSetting('navigation', 'menuItems', updated);
                      }}
                      className="flex-1 h-8 text-sm"
                    />
                    <Switch
                      checked={item.enabled}
                      onCheckedChange={(checked) => {
                        const updated = [...selectedPortal.navigation.menuItems];
                        updated[idx].enabled = checked;
                        updatePortalSetting('navigation', 'menuItems', updated);
                      }}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Built-in Pages</CardTitle>
                <CardDescription>Toggle visibility of default portal pages</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(selectedPortal.navigation.builtInPages).map(([key, enabled]) => {
                  const labels: { [key: string]: string } = {
                    home: 'Home',
                    myBooking: 'My Booking / Folio',
                    houseRules: 'House Rules',
                    wifiInstructions: 'WiFi & Instructions',
                    localGuide: 'Local Guide',
                    addOns: 'Add-ons/Services',
                    contact: 'Contact/Chat',
                    reviews: 'Reviews'
                  };

                  return (
                    <div key={key} className="flex items-center justify-between p-3 bg-slate-50 rounded border">
                      <Label className="text-xs font-medium text-slate-600">{labels[key]}</Label>
                      <Switch
                        checked={enabled}
                        onCheckedChange={(checked) => {
                          const updated = { ...selectedPortal.navigation.builtInPages, [key]: checked };
                          updatePortalSetting('navigation', 'builtInPages', updated);
                        }}
                      />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
                </div>
              </>
            )}

            {/* CHECK-IN & FEATURES TAB */}
            {activeTab === 'features' && (
              <>
                <div className="space-y-4">
                  <Card>
              <CardHeader>
                <CardTitle>Digital Check-in</CardTitle>
                <CardDescription>Configure check-in process and options</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded border">
                  <div>
                    <Label className="text-xs font-bold text-slate-600 uppercase">Enable Digital Check-in</Label>
                    <p className="text-xs text-slate-500 mt-1">Allow guests to check in through the portal</p>
                  </div>
                  <Switch
                    checked={selectedPortal.features.digitalCheckInEnabled}
                    onCheckedChange={(checked) => {
                      updatePortalSetting('features', 'digitalCheckInEnabled', checked);
                    }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-bold text-slate-600 uppercase mb-2 block">Check-in Time Window</Label>
                    <Select value={selectedPortal.features.checkInTimeWindow} onValueChange={(value) => {
                      updatePortalSetting('features', 'checkInTimeWindow', value);
                    }}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="24h">24 hours</SelectItem>
                        <SelectItem value="48h">48 hours</SelectItem>
                        <SelectItem value="unlimited">Unlimited</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs font-bold text-slate-600 uppercase mb-2 block">Access Code Delivery</Label>
                    <Select value={selectedPortal.features.accessCodeDelivery} onValueChange={(value: any) => {
                      updatePortalSetting('features', 'accessCodeDelivery', value);
                    }}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="both">Both SMS & Email</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded border">
                  <Label className="text-xs font-bold text-slate-600 uppercase">Mobile Key</Label>
                  <Switch
                    checked={selectedPortal.features.mobileKeyEnabled}
                    onCheckedChange={(checked) => {
                      updatePortalSetting('features', 'mobileKeyEnabled', checked);
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Portal Features</CardTitle>
                <CardDescription>Enable or disable guest portal capabilities</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded border">
                  <Label className="text-xs font-medium text-slate-600">In-Portal Chat / Messaging</Label>
                  <Switch
                    checked={selectedPortal.features.inPortalChat}
                    onCheckedChange={(checked) => {
                      updatePortalSetting('features', 'inPortalChat', checked);
                    }}
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded border">
                  <Label className="text-xs font-medium text-slate-600">Folio View & Payment</Label>
                  <Switch
                    checked={selectedPortal.features.folioViewEnabled}
                    onCheckedChange={(checked) => {
                      updatePortalSetting('features', 'folioViewEnabled', checked);
                    }}
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded border">
                  <Label className="text-xs font-medium text-slate-600">Upsell/Add-ons Marketplace</Label>
                  <Switch
                    checked={selectedPortal.features.upsellMarketplaceEnabled}
                    onCheckedChange={(checked) => {
                      updatePortalSetting('features', 'upsellMarketplaceEnabled', checked);
                    }}
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded border">
                  <Label className="text-xs font-medium text-slate-600">Checkout Flow</Label>
                  <Switch
                    checked={selectedPortal.features.checkoutFlowEnabled}
                    onCheckedChange={(checked) => {
                      updatePortalSetting('features', 'checkoutFlowEnabled', checked);
                    }}
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold text-slate-600 uppercase mb-2 block">Review Request Timing</Label>
                  <Select value={selectedPortal.features.reviewRequestTiming} onValueChange={(value: any) => {
                    updatePortalSetting('features', 'reviewRequestTiming', value);
                  }}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="during-stay">During Stay</SelectItem>
                      <SelectItem value="checkout">At Checkout</SelectItem>
                      <SelectItem value="post-stay">Post-Stay</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
                </div>
              </>
            )}

            {/* LANGUAGES & ADVANCED TAB */}
            {activeTab === 'advanced' && (
              <>
                <div className="space-y-4">
                  <Card>
              <CardHeader>
                <CardTitle>Languages</CardTitle>
                <CardDescription>Manage portal language options</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs font-bold text-slate-600 uppercase mb-2 block">Default Language</Label>
                  <Select value={selectedPortal.languages.defaultLanguage} onValueChange={(value) => {
                    updatePortalSetting('languages', 'defaultLanguage', value);
                  }}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="de">Deutsch</SelectItem>
                      <SelectItem value="ar">العربية</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-bold text-slate-600 uppercase mb-2 block">Auto-Detect Language</Label>
                  <Select value={selectedPortal.languages.autoDetect} onValueChange={(value: any) => {
                    updatePortalSetting('languages', 'autoDetect', value);
                  }}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="browser">Browser Preference</SelectItem>
                      <SelectItem value="profile">Guest Profile</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded border">
                  <Label className="text-xs font-bold text-slate-600 uppercase">Auto-Translate</Label>
                  <Switch
                    checked={selectedPortal.languages.autoTranslateEnabled}
                    onCheckedChange={(checked) => {
                      updatePortalSetting('languages', 'autoTranslateEnabled', checked);
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Advanced Settings</CardTitle>
                <CardDescription>Security and data management options</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs font-bold text-slate-600 uppercase mb-2 block">Data Retention (days)</Label>
                  <Input
                    type="number"
                    value={selectedPortal.advanced.dataRetention}
                    onChange={(e) => {
                      updatePortalSetting('advanced', 'dataRetention', parseInt(e.target.value));
                    }}
                    min={30}
                    className="h-9"
                  />
                  <p className="text-xs text-slate-500 mt-2">How long guest data is retained after checkout</p>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded border">
                  <Label className="text-xs font-bold text-slate-600 uppercase">HTTPS Enforcement</Label>
                  <Switch
                    checked={selectedPortal.advanced.httpsEnforced}
                    onCheckedChange={(checked) => {
                      updatePortalSetting('advanced', 'httpsEnforced', checked);
                    }}
                  />
                </div>

                {selectedPortal.advanced.analyticPixel && (
                  <div>
                    <Label className="text-xs font-bold text-slate-600 uppercase mb-2 block">Analytics Pixel</Label>
                    <Input
                      value={selectedPortal.advanced.analyticPixel}
                      onChange={(e) => {
                        updatePortalSetting('advanced', 'analyticPixel', e.target.value);
                      }}
                      placeholder="Paste your analytics pixel code"
                      className="h-9 font-mono text-xs"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
                </div>
              </>
            )}
          </div>

        {/* Save Button */}
        <div className="mt-6 flex gap-3 sticky bottom-0 bg-white border-t pt-4">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="px-8 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
          >
            {isSaving ? (
              <>
                <Icons.Spinner className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Icons.Save className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    ) : (
      <div className="flex-1 flex items-center justify-center text-slate-500">
        <Icons.AlertTriangle className="w-6 h-6 mr-2" />
        <p>No portal selected. Create or select a portal to get started.</p>
      </div>
    )}
  </div>
  );
}
