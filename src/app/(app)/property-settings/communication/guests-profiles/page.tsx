'use client';

import React, { useState, useEffect } from 'react';
import { PropertySettingsSubtabs } from '@/components/property-settings/property-settings-subtabs';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';

const communicationSubtabs = [
  { id: 'guests-profiles', label: 'Guests Profiles', href: '/property-settings/communication/guests-profiles' },
  { id: 'communication-channels', label: 'Communication Channels', href: '/property-settings/communication/communication-channels' },
  { id: 'email-templates', label: 'Email Templates', href: '/property-settings/communication/email-templates' },
  { id: 'guest-portal', label: 'Guest Portal', href: '/property-settings/communication/guest-portal' },
  { id: 'notifications', label: 'Notifications', href: '/property-settings/communication/notifications' },
];

interface CustomField {
  id: string;
  name: string;
  type: 'text' | 'dropdown' | 'date' | 'checkbox' | 'file';
  appliedTo: 'reservation' | 'guest';
  maxCharacters?: number;
  isRequired: boolean;
  displayLocations: ('direct' | 'booking-engine' | 'registration-card')[];
  isSearchable: boolean;
  visibleInProfileSummary: boolean;
  autoCarryForward: boolean;
  options?: string[];
}

interface statusRule {
  enabled: boolean;
  triggerType: 'stays' | 'totalSpend' | 'avgSpendPerStay' | 'nightsBooked' | 'bookingValue';
  threshold: number; // e.g., 3 for stays, 1000 for spend
}

interface status {
  id: string;
  name: string;
  color: string;
  reasonRequired: boolean;
  rule: statusRule;
  isDefault?: boolean;
  visibleOnGuestActions?: boolean;
}

interface CoreFieldConfig {
  fieldName: string;  // e.g., 'firstName', 'lastName', 'email'
  displayName: string; // e.g., 'First Name'
  reservationFormVisible: boolean;
  reservationFormRequired: boolean;
  guestDetailsVisible: boolean;
  guestDetailsRequired: boolean;
  isDefault?: boolean;
}

interface NoteCategory {
  id: string;
  name: string;
  displayOnReservationForm: boolean;
  displayOnGuestDetails: boolean;
  isDefault?: boolean;
}

interface GuestProfileSettings {
  // Profile Creation & Auto-Behavior
  autoCreateProfile: boolean;
  autoCreateForWalkIns: boolean;
  enableMultiPropertyAggregation: boolean;

  // Core Fields Defaults
  coreFieldsConfig: CoreFieldConfig[];
  requiredFields: string[];
  repeatGuestThreshold: number;
  vipStatusAssignment: 'manual' | 'auto' | 'manual-and-auto';

  // Custom Fields
  customFields: CustomField[];

  // Notes & Status
  noteCategories: NoteCategory[];
  enableStatus: boolean;
  status: status[];

  // General Configuration (existing)
  enableDuplicateDetection: boolean;
  duplicateDetectionFields: ('email' | 'phone')[];
  duplicateDetectionCustomFields?: string[];
  autoMergeDuplicates: boolean;
  defaultGuestType: 'individual' | 'company';
  requireProfileCompletionBeforeCheckin: boolean;

  // Identification & Compliance
  enableIdTypes: ('passport' | 'nationalId' | 'driverLicense')[];
  idScanUploadRequired: boolean;
  idExpiryDateMandatory: boolean;
  dataRetentionYears: number;
  enableAutoAnonymization: boolean;
  enableGDPRConsent: boolean;
  enableMarketingConsent: boolean;

  // Communication Preferences
  defaultLanguage: string;
  preferredContactMethod: 'email' | 'sms' | 'whatsapp';
  enablePreArrivalEmails: boolean;
  enablePostStayEmails: boolean;

  // Segmentation
  enableAutoTagRepeat: boolean;
  autoTagRepeatAfterXStays: number;
  enableAutoTagHighValue: boolean;
  highValueThreshold: number;
  enableBlacklist: boolean;
  blacklistBehavior: 'warning' | 'hard-block';

  // Corporate
  enableCompanyAccounts: boolean;
  requireVATID: boolean;
  enableCreditLimit: boolean;

  // Multi-Property
  shareProfilesAcrossProperties: boolean;
  syncBlacklistAcrossProperties: boolean;

  // Privacy & Audit
  enableProfileAuditLog: boolean;

  // Loyalty Program
  enableLoyaltyProgram: boolean;
  pointsEarningRate: number; // Dollar spend required to earn 1 point
  pointsRedemptionValue: number; // Dollar value per point
  pointExpirationMonths: number; // Months until points expire
  autoEnrollNewGuests: boolean;
  loyaltyTiers: Array<{
    name: string;
    color: string;
    minPoints: number;
    bonusEnabled: boolean;
    bonusCoefficient: number; // Bonus multiplier coefficient
  }>;
}

const defaultSettings: GuestProfileSettings = {
  autoCreateProfile: true,
  autoCreateForWalkIns: true,
  enableMultiPropertyAggregation: false,
  coreFieldsConfig: [
    { fieldName: 'fullName', displayName: 'Full Name', reservationFormVisible: true, reservationFormRequired: true, guestDetailsVisible: true, guestDetailsRequired: true, isDefault: true },
    { fieldName: 'email', displayName: 'Email', reservationFormVisible: true, reservationFormRequired: true, guestDetailsVisible: true, guestDetailsRequired: true, isDefault: true },
    { fieldName: 'phone', displayName: 'Phone', reservationFormVisible: true, reservationFormRequired: false, guestDetailsVisible: true, guestDetailsRequired: false, isDefault: true },
    { fieldName: 'country', displayName: 'Country', reservationFormVisible: true, reservationFormRequired: false, guestDetailsVisible: true, guestDetailsRequired: false, isDefault: true },
    { fieldName: 'city', displayName: 'City', reservationFormVisible: false, reservationFormRequired: false, guestDetailsVisible: true, guestDetailsRequired: false, isDefault: true },
    { fieldName: 'zipCode', displayName: 'ZIP Code', reservationFormVisible: false, reservationFormRequired: false, guestDetailsVisible: true, guestDetailsRequired: false, isDefault: true },
    { fieldName: 'address', displayName: 'Address', reservationFormVisible: false, reservationFormRequired: false, guestDetailsVisible: true, guestDetailsRequired: false, isDefault: true },
    { fieldName: 'idType', displayName: 'ID Type', reservationFormVisible: false, reservationFormRequired: false, guestDetailsVisible: true, guestDetailsRequired: false, isDefault: true },
    { fieldName: 'passport', displayName: 'Passport', reservationFormVisible: false, reservationFormRequired: false, guestDetailsVisible: true, guestDetailsRequired: false, isDefault: true },
    { fieldName: 'nationalId', displayName: 'National ID', reservationFormVisible: false, reservationFormRequired: false, guestDetailsVisible: true, guestDetailsRequired: false, isDefault: true },
    { fieldName: 'gender', displayName: 'Gender', reservationFormVisible: false, reservationFormRequired: false, guestDetailsVisible: true, guestDetailsRequired: false, isDefault: true },
    { fieldName: 'birthDate', displayName: 'Birth Date', reservationFormVisible: false, reservationFormRequired: false, guestDetailsVisible: true, guestDetailsRequired: false, isDefault: true },
  ],
  requiredFields: ['fullName', 'email'],
  repeatGuestThreshold: 2,
  vipStatusAssignment: 'manual',
  customFields: [],
  noteCategories: [
    { id: '1', name: 'Preferences', displayOnReservationForm: true, displayOnGuestDetails: true, isDefault: true },
    { id: '2', name: 'Special Requests', displayOnReservationForm: true, displayOnGuestDetails: true, isDefault: true },
    { id: '3', name: 'VIP / Loyalty Notes', displayOnReservationForm: false, displayOnGuestDetails: true, isDefault: true },
    { id: '4', name: 'Housekeeping Notes', displayOnReservationForm: false, displayOnGuestDetails: true, isDefault: true },
    { id: '5', name: 'Do Not Rent / Blacklist', displayOnReservationForm: false, displayOnGuestDetails: true, isDefault: true },
    { id: '6', name: 'Allergies / Dietary', displayOnReservationForm: true, displayOnGuestDetails: true, isDefault: true },
    { id: '7', name: 'Accessibility / Mobility', displayOnReservationForm: true, displayOnGuestDetails: true, isDefault: true },
    { id: '8', name: 'Payment / Billing Notes', displayOnReservationForm: false, displayOnGuestDetails: true, isDefault: true },
    { id: '9', name: 'Behavioral / Incident', displayOnReservationForm: false, displayOnGuestDetails: true, isDefault: true },
    { id: '10', name: 'Celebrations / Occasions', displayOnReservationForm: true, displayOnGuestDetails: true, isDefault: true },
    { id: '11', name: 'Feedback / Complaints', displayOnReservationForm: false, displayOnGuestDetails: true, isDefault: true },
    { id: '12', name: 'Staff Internal', displayOnReservationForm: false, displayOnGuestDetails: true, isDefault: true },
  ],
  enableStatus: true,
  status: [
    { id: 'vip', name: 'VIP', color: '#FFD700', reasonRequired: false, rule: { enabled: false, triggerType: 'stays', threshold: 3 }, isDefault: true, visibleOnGuestActions: true },
    { id: 'repeat', name: 'Repeat', color: '#4CAF50', reasonRequired: false, rule: { enabled: true, triggerType: 'stays', threshold: 2 }, isDefault: true, visibleOnGuestActions: true },
    { id: 'blacklist', name: 'Blacklist', color: '#F44336', reasonRequired: true, rule: { enabled: false, triggerType: 'stays', threshold: 1 }, isDefault: true, visibleOnGuestActions: true },
    { id: 'high-value', name: 'High-Value', color: '#2196F3', reasonRequired: false, rule: { enabled: true, triggerType: 'totalSpend', threshold: 5000 }, isDefault: true, visibleOnGuestActions: true },
  ],
  enableDuplicateDetection: true,
  duplicateDetectionFields: ['email'],
  duplicateDetectionCustomFields: [],
  autoMergeDuplicates: true,
  defaultGuestType: 'individual',
  requireProfileCompletionBeforeCheckin: false,
  enableIdTypes: ['passport', 'nationalId'],
  idScanUploadRequired: false,
  idExpiryDateMandatory: true,
  dataRetentionYears: 7,
  enableAutoAnonymization: false,
  enableGDPRConsent: true,
  enableMarketingConsent: true,
  defaultLanguage: 'en',
  preferredContactMethod: 'email',
  enablePreArrivalEmails: true,
  enablePostStayEmails: true,
  enableAutoTagRepeat: true,
  autoTagRepeatAfterXStays: 2,
  enableAutoTagHighValue: true,
  highValueThreshold: 500,
  enableBlacklist: true,
  blacklistBehavior: 'warning',
  enableCompanyAccounts: false,
  requireVATID: false,
  enableCreditLimit: false,
  shareProfilesAcrossProperties: false,
  syncBlacklistAcrossProperties: false,
  enableProfileAuditLog: true,
  enableLoyaltyProgram: true,
  pointsEarningRate: 50,
  pointsRedemptionValue: 0.01,
  pointExpirationMonths: 36,
  autoEnrollNewGuests: true,
  loyaltyTiers: [
    { name: 'Member', color: '#808080', minPoints: 0, bonusEnabled: false, bonusCoefficient: 1 },
    { name: 'Silver', color: '#C0C0C0', minPoints: 100, bonusEnabled: false, bonusCoefficient: 1.25 },
    { name: 'Gold', color: '#FFD700', minPoints: 500, bonusEnabled: false, bonusCoefficient: 1.5 },
    { name: 'Platinum', color: '#001f3f', minPoints: 1000, bonusEnabled: false, bonusCoefficient: 2 },
  ],
};

export default function GuestsProfilesPage() {
  const { user: currentUser, isLoadingAuth } = useAuth();
  const [settings, setSettings] = useState<GuestProfileSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentPropertyId, setCurrentPropertyId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'profile-configuration' | 'duplicate-data-rules' | 'loyalty-program'>('profile-configuration');
  const [showAddFieldForm, setShowAddFieldForm] = useState(false);
  const [optionInput, setOptionInput] = useState('');
  const [isAddingNewFlag, setIsAddingNewFlag] = useState(false);
  const [editingFlagId, setEditingFlagId] = useState<string | null>(null);
  const [editingFlagName, setEditingFlagName] = useState('');
  const [editingFlagColor, setEditingFlagColor] = useState('');
  const [newFlagData, setNewFlagData] = useState<Partial<status>>({
    name: '',
    color: '#4CAF50',
    reasonRequired: false,
    rule: {
      enabled: false,
      triggerType: 'stays',
      threshold: 1,
    },
  });
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newCategoryData, setNewCategoryData] = useState<Partial<NoteCategory>>({
    name: '',
    displayOnReservationForm: true,
    displayOnGuestDetails: true,
  });
  const [editingTierIdx, setEditingTierIdx] = useState<number | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showLoyaltyGuide, setShowLoyaltyGuide] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editingFieldData, setEditingFieldData] = useState<Partial<CustomField> | null>(null);
  const [fieldFormData, setFieldFormData] = useState<Partial<CustomField>>({
    name: '',
    appliedTo: 'guest',
    type: 'text',
    isRequired: false,
    displayLocations: [],
    maxCharacters: 255,
    isSearchable: false,
    visibleInProfileSummary: false,
    autoCarryForward: false,
    options: [],
  });
  const [isAddingNewField, setIsAddingNewField] = useState(false);
  const [newFieldData, setNewFieldData] = useState<Partial<CustomField>>({
    name: '',
    appliedTo: 'guest',
    type: 'text',
    isRequired: false,
    displayLocations: [],
    maxCharacters: 255,
    isSearchable: false,
    visibleInProfileSummary: false,
    autoCarryForward: false,
    options: [],
  });
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [deletingTierIdx, setDeletingTierIdx] = useState<number | null>(null);
  const [deletingFieldIdx, setDeletingFieldIdx] = useState<number | null>(null);

  useEffect(() => {
    if (currentUser?.propertyId) {
      setCurrentPropertyId(currentUser.propertyId);
      loadSettings(currentUser.propertyId);
    }
  }, [currentUser?.propertyId]);

  const loadSettings = async (propertyId: string) => {
    try {
      const propertyDocRef = doc(db, 'properties', propertyId);
      const propertyDoc = await getDoc(propertyDocRef);
      
      if (propertyDoc.exists() && propertyDoc.data()?.guestProfileSettings) {
        const loadedSettings = propertyDoc.data().guestProfileSettings;
        const mergedSettings = {
          ...defaultSettings,
          ...loadedSettings,
          // Ensure nested arrays/objects are preserved from defaults if missing
          coreFieldsConfig: loadedSettings.coreFieldsConfig || defaultSettings.coreFieldsConfig,
          loyaltyTiers: loadedSettings.loyaltyTiers || defaultSettings.loyaltyTiers,
          duplicateDetectionFields: loadedSettings.duplicateDetectionFields || defaultSettings.duplicateDetectionFields,
          duplicateDetectionCustomFields: loadedSettings.duplicateDetectionCustomFields || defaultSettings.duplicateDetectionCustomFields,
          enableIdTypes: loadedSettings.enableIdTypes || defaultSettings.enableIdTypes,
          requiredFields: loadedSettings.requiredFields || defaultSettings.requiredFields,
          customFields: loadedSettings.customFields || defaultSettings.customFields,
          noteCategories: loadedSettings.noteCategories || defaultSettings.noteCategories,
          enableStatus: loadedSettings.enableStatus !== undefined ? loadedSettings.enableStatus : defaultSettings.enableStatus,
          predefinedFlags: loadedSettings.predefinedFlags || defaultSettings.status,
        };
        setSettings(mergedSettings);
      } else {
        setSettings(defaultSettings);
      }
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading settings:', error);
      toast({ title: 'Error', description: 'Could not load settings', variant: 'destructive' });
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentPropertyId) return;

    // Validate loyalty tiers
    const errors: string[] = [];
    if (settings.loyaltyTiers && settings.loyaltyTiers.length > 0) {
      settings.loyaltyTiers.forEach((tier, idx) => {
        if (!tier.name || tier.name.trim() === '') {
          errors.push(`Tier ${idx + 1}: Tier name is required`);
        }
        if (tier.minPoints === undefined || tier.minPoints === null) {
          errors.push(`Tier ${idx + 1}: Min points is required`);
        }
        if (tier.bonusEnabled && (tier.bonusCoefficient === undefined || tier.bonusCoefficient === null || tier.bonusCoefficient < 1)) {
          errors.push(`Tier ${idx + 1}: Multiplier coefficient must be at least 1 when bonus is enabled`);
        }
      });
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors([]);
    setIsSaving(true);
    try {
      const propertyDocRef = doc(db, 'properties', currentPropertyId);
      
      // Remove undefined values from settings for Firebase compatibility
      const cleanedSettings = Object.fromEntries(
        Object.entries(settings).filter(([_, v]) => v !== undefined)
      );
      
      await updateDoc(propertyDocRef, {
        guestProfileSettings: cleanedSettings,
        updatedAt: serverTimestamp(),
      });
      toast({ title: 'Success', description: 'Guest profile settings saved successfully' });
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast({ title: 'Error', description: error.message || 'Could not save settings', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    // Clear validation errors when user edits loyalty tiers
    if (key === 'loyaltyTiers' && validationErrors.length > 0) {
      setValidationErrors([]);
    }
  };

  const handleResetToDefaults = async () => {
    if (!currentPropertyId) return;

    setIsSaving(true);
    try {
      const propertyDocRef = doc(db, 'properties', currentPropertyId);
      
      // Remove undefined values from settings for Firebase compatibility
      const cleanedSettings = Object.fromEntries(
        Object.entries(defaultSettings).filter(([_, v]) => v !== undefined)
      );
      
      await updateDoc(propertyDocRef, {
        guestProfileSettings: cleanedSettings,
        updatedAt: serverTimestamp(),
      });
      setSettings(defaultSettings);
      setShowResetDialog(false);
      toast({ title: 'Success', description: 'Settings have been reset to defaults and saved' });
    } catch (error: any) {
      console.error('Error resetting settings:', error);
      toast({ title: 'Error', description: error.message || 'Could not reset settings', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCustomField = () => {
    // Validate required fields
    if (!fieldFormData.name || fieldFormData.name.trim() === '') {
      toast({ title: 'Error', description: 'Custom field name is required', variant: 'destructive' });
      return;
    }

    // Validate options for dropdown and checkbox
    if ((fieldFormData.type === 'dropdown' || fieldFormData.type === 'checkbox') && (!fieldFormData.options || fieldFormData.options.length === 0)) {
      toast({ title: 'Error', description: `${fieldFormData.type === 'dropdown' ? 'Dropdown' : 'Checkbox'} fields require at least one option`, variant: 'destructive' });
      return;
    }

    // Create new custom field
    const newField: CustomField = {
      id: Date.now().toString(),
      name: fieldFormData.name,
      type: (fieldFormData.type || 'text') as CustomField['type'],
      appliedTo: (fieldFormData.appliedTo || 'guest') as 'reservation' | 'guest',
      maxCharacters: fieldFormData.maxCharacters || 255,
      isRequired: fieldFormData.isRequired || false,
      displayLocations: fieldFormData.displayLocations || [],
      isSearchable: fieldFormData.isSearchable || false,
      visibleInProfileSummary: fieldFormData.visibleInProfileSummary || false,
      autoCarryForward: fieldFormData.autoCarryForward || false,
      options: fieldFormData.options || [],
    };

    // Add to settings
    handleChange('customFields', [...(settings.customFields || []), newField]);

    // Reset form
    setShowAddFieldForm(false);
    setOptionInput('');
    setFieldFormData({
      name: '',
      appliedTo: 'guest',
      type: 'text',
      isRequired: false,
      displayLocations: [],
      maxCharacters: 255,
      isSearchable: false,
      visibleInProfileSummary: false,
      autoCarryForward: false,
      options: [],
    });

    toast({ title: 'Success', description: 'Custom field added successfully' });
  };

  const handleStartAddFlag = () => {
    setIsAddingNewFlag(true);
    setNewFlagData({
      name: '',
      color: '#4CAF50',
      reasonRequired: false,
      rule: {
        enabled: false,
        triggerType: 'stays',
        threshold: 1,
      },
    });
  };

  const handleSaveNewFlag = () => {
    if (!newFlagData.name || newFlagData.name.trim() === '') {
      toast({ title: 'Error', description: 'Flag name is required', variant: 'destructive' });
      return;
    }

    const newFlag: status = {
      id: Date.now().toString(),
      name: newFlagData.name,
      color: newFlagData.color || '#4CAF50',
      reasonRequired: newFlagData.reasonRequired || false,
      rule: newFlagData.rule || {
        enabled: false,
        triggerType: 'stays',
        threshold: 1,
      },
    };

    handleChange('status', [...(settings.status || []), newFlag]);
    setIsAddingNewFlag(false);
    setNewFlagData({
      name: '',
      color: '#4CAF50',
      reasonRequired: false,
      rule: {
        enabled: false,
        triggerType: 'stays',
        threshold: 1,
      },
    });
    toast({ title: 'Success', description: 'Status added successfully' });
  };

  const handleCancelAddFlag = () => {
    setIsAddingNewFlag(false);
    setNewFlagData({
      name: '',
      color: '#4CAF50',
      reasonRequired: false,
      rule: {
        enabled: false,
        triggerType: 'stays',
        threshold: 1,
      },
    });
  };

  const handleStartAddCategory = () => {
    setIsAddingNewCategory(true);
    setNewCategoryData({
      name: '',
      displayOnReservationForm: true,
      displayOnGuestDetails: true,
    });
  };

  const handleSaveNewCategory = () => {
    if (!newCategoryData.name || newCategoryData.name.trim() === '') {
      toast({ title: 'Error', description: 'Category name is required', variant: 'destructive' });
      return;
    }

    const newCategory: NoteCategory = {
      id: Date.now().toString(),
      name: newCategoryData.name,
      displayOnReservationForm: newCategoryData.displayOnReservationForm || true,
      displayOnGuestDetails: newCategoryData.displayOnGuestDetails || true,
    };

    handleChange('noteCategories', [...(settings.noteCategories || []), newCategory]);
    setIsAddingNewCategory(false);
    setNewCategoryData({
      name: '',
      displayOnReservationForm: true,
      displayOnGuestDetails: true,
    });
    toast({ title: 'Success', description: 'Note category added successfully' });
  };

  const handleCancelAddCategory = () => {
    setIsAddingNewCategory(false);
    setNewCategoryData({
      name: '',
      displayOnReservationForm: true,
      displayOnGuestDetails: true,
    });
  };

  const handleUpdateFlag = (flagId: string, updatedFlag: Partial<status>) => {
    const newFlags = (settings.status || []).map(f =>
      f.id === flagId ? { ...f, ...updatedFlag } : f
    );
    handleChange('status', newFlags);
  };

  const handleDeleteFlag = (flagId: string) => {
    const newFlags = (settings.status || []).filter(f => f.id !== flagId);
    handleChange('status', newFlags);
  };

  const handleStartEditFlag = (flag: status) => {
    setEditingFlagId(flag.id);
    setEditingFlagName(flag.name);
    setEditingFlagColor(flag.color);
  };

  const handleSaveEditFlag = () => {
    if (!editingFlagName.trim()) {
      toast({ title: 'Error', description: 'Flag name cannot be empty', variant: 'destructive' });
      return;
    }

    handleUpdateFlag(editingFlagId!, {
      name: editingFlagName,
      color: editingFlagColor,
    });

    setEditingFlagId(null);
    setEditingFlagName('');
    setEditingFlagColor('');
    toast({ title: 'Success', description: 'Flag updated successfully' });
  };

  const handleCancelEditFlag = () => {
    setEditingFlagId(null);
    setEditingFlagName('');
    setEditingFlagColor('');
  };

  const handleStartEditField = (field: CustomField) => {
    setEditingFieldId(field.id);
    setEditingFieldData({ ...field });
  };

  const handleSaveEditField = () => {
    if (!editingFieldData?.name?.trim()) {
      toast({ title: 'Error', description: 'Field name cannot be empty', variant: 'destructive' });
      return;
    }

    const newFields = (settings.customFields || []).map(f => 
      f.id === editingFieldId ? editingFieldData as CustomField : f
    );
    handleChange('customFields', newFields);

    setEditingFieldId(null);
    setEditingFieldData(null);
    toast({ title: 'Success', description: 'Field updated successfully' });
  };

  const handleCancelEditField = () => {
    setEditingFieldId(null);
    setEditingFieldData(null);
  };

  const handleToggleStatusVisibility = (flagId: string) => {
    const flag = (settings.status || []).find(f => f.id === flagId);
    if (flag) {
      handleUpdateFlag(flagId, { 
        visibleOnGuestActions: !flag.visibleOnGuestActions 
      });
    }
  };

  const handleStartAddCustomField = () => {
    setIsAddingNewField(true);
    setNewFieldData({
      name: '',
      appliedTo: 'guest',
      type: 'text',
      isRequired: false,
      displayLocations: [],
      maxCharacters: 255,
      isSearchable: false,
      visibleInProfileSummary: false,
      autoCarryForward: false,
      options: [],
    });
  };

  const handleSaveNewCustomField = () => {
    if (!newFieldData.name || newFieldData.name.trim() === '') {
      toast({ title: 'Error', description: 'Custom field name is required', variant: 'destructive' });
      return;
    }

    if ((newFieldData.type === 'dropdown' || newFieldData.type === 'checkbox') && (!newFieldData.options || newFieldData.options.length === 0)) {
      toast({ title: 'Error', description: `${newFieldData.type === 'dropdown' ? 'Dropdown' : 'Checkbox'} fields require at least one option`, variant: 'destructive' });
      return;
    }

    const newField: CustomField = {
      id: Date.now().toString(),
      name: newFieldData.name || '',
      type: (newFieldData.type || 'text') as CustomField['type'],
      appliedTo: (newFieldData.appliedTo || 'guest') as 'reservation' | 'guest',
      maxCharacters: newFieldData.maxCharacters || 255,
      isRequired: newFieldData.isRequired || false,
      displayLocations: newFieldData.displayLocations || [],
      isSearchable: newFieldData.isSearchable || false,
      visibleInProfileSummary: newFieldData.visibleInProfileSummary || false,
      autoCarryForward: newFieldData.autoCarryForward || false,
      options: newFieldData.options || [],
    };

    handleChange('customFields', [...(settings.customFields || []), newField]);
    setIsAddingNewField(false);
    setNewFieldData({
      name: '',
      appliedTo: 'guest',
      type: 'text',
      isRequired: false,
      displayLocations: [],
      maxCharacters: 255,
      isSearchable: false,
      visibleInProfileSummary: false,
      autoCarryForward: false,
      options: [],
    });
    toast({ title: 'Success', description: 'Custom field created successfully' });
  };

  const handleCancelAddCustomField = () => {
    setIsAddingNewField(false);
    setNewFieldData({
      name: '',
      appliedTo: 'guest',
      type: 'text',
      isRequired: false,
      displayLocations: [],
      maxCharacters: 255,
      isSearchable: false,
      visibleInProfileSummary: false,
      autoCarryForward: false,
      options: [],
    });
  };

  if (isLoading || isLoadingAuth) {
    return (
      <div className="flex h-full items-center justify-center">
        <Icons.Spinner className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b bg-background px-6 py-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Guests & Communication</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage guest preferences and communication settings</p>
          </div>
          <PropertySettingsSubtabs subtabs={communicationSubtabs} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6 overflow-x-hidden">
          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="p-4 bg-red-50 border border-red-300 rounded-lg">
              <p className="font-semibold text-red-900 mb-2">Please fix the following errors:</p>
              <ul className="list-disc list-inside space-y-1 text-red-800">
                {validationErrors.map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Internal Tabs */}
          <div className="border-b border-slate-200 -mx-6 px-6">
            <div className="flex gap-8">
              <button 
                onClick={() => setActiveTab('profile-configuration')} 
                className={`pb-3 px-1 text-sm font-semibold transition-colors relative ${
                  activeTab === 'profile-configuration' 
                    ? 'text-primary' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Profile Configuration
                {activeTab === 'profile-configuration' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-md"></div>
                )}
              </button>
              <button 
                onClick={() => setActiveTab('duplicate-data-rules')} 
                className={`pb-3 px-1 text-sm font-semibold transition-colors relative ${
                  activeTab === 'duplicate-data-rules' 
                    ? 'text-primary' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Duplicate Data Rules
                {activeTab === 'duplicate-data-rules' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-md"></div>
                )}
              </button>
              <button 
                onClick={() => setActiveTab('loyalty-program')} 
                className={`pb-3 px-1 text-sm font-semibold transition-colors relative ${
                  activeTab === 'loyalty-program' 
                    ? 'text-primary' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Loyalty Program
                {activeTab === 'loyalty-program' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-md"></div>
                )}
              </button>
            </div>
          </div>

          {/* Profile Configuration Tab */}
          {activeTab === 'profile-configuration' && (
            <div className="space-y-6">
            {/* Profile Creation & Auto-Behavior */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Profile Creation & Auto-Behavior</CardTitle>
                <CardDescription className="text-xs">Configure how guest profiles are automatically created and managed</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm ">Auto-create profile on new booking/reservation</Label>
                  <Switch checked={settings.autoCreateProfile} onCheckedChange={(val) => handleChange('autoCreateProfile', val)} />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Auto-create for manual walk-ins</Label>
                  <Switch checked={settings.autoCreateForWalkIns} onCheckedChange={(val) => handleChange('autoCreateForWalkIns', val)} />
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-sm">Enable multi-property aggregation</Label>
                  <Switch checked={settings.enableMultiPropertyAggregation} onCheckedChange={(val) => handleChange('enableMultiPropertyAggregation', val)} />
                </div>
                
                {settings.enableMultiPropertyAggregation && (
                  <p className="text-xs text-muted-foreground p-3 bg-blue-50 rounded-md">Shows total stays, nights, spend, and lifetime value across all your properties in guest profiles</p>
                )}
              </CardContent>
            </Card>

            {/* Core Fields Defaults */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Core Fields & Visibility</CardTitle>
                <CardDescription className="text-xs">Configure which fields appear and are required on reservation forms and guest details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border border-slate-300">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-300">
                        <th className="px-3 py-2 h-8 text-left font-semibold text-xs border-r border-slate-300">Field Name</th>
                        <th colSpan={2} className="px-3 py-2 h-8 text-center font-semibold text-xs border-r border-slate-300">Reservation Form</th>
                        <th colSpan={2} className="px-3 py-2 h-8 text-center font-semibold text-xs">Guest Details</th>
                      </tr>
                      <tr className="bg-slate-100 border-b border-slate-300">
                        <th className="px-3 py-2 h-8 text-left font-semibold text-xs border-r border-slate-300"></th>
                        <th className="px-3 py-2 h-8 text-center font-semibold text-xs border-r border-slate-300">Show</th>
                        <th className="px-3 py-2 h-8 text-center font-semibold text-xs border-r border-slate-300">Required</th>
                        <th className="px-3 py-2 h-8 text-center font-semibold text-xs border-r border-slate-300">Show</th>
                        <th className="px-3 py-2 h-8 text-center font-semibold text-xs">Required</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(settings.coreFieldsConfig || []).map((field) => (
                        <tr key={field.fieldName} className="border-b border-slate-300 hover:bg-slate-50 transition-colors">
                          <td className="px-3 py-2 font-medium border-r border-slate-300">{field.displayName}</td>
                          <td className="px-3 py-2 text-center border-r border-slate-300">
                            <input 
                              type="checkbox"
                              checked={field.reservationFormVisible}
                              onChange={(e) => {
                                const newConfig = (settings.coreFieldsConfig || []).map(f => 
                                  f.fieldName === field.fieldName 
                                    ? { ...f, reservationFormVisible: e.target.checked }
                                    : f
                                );
                                handleChange('coreFieldsConfig', newConfig);
                              }}
                              className="w-4 h-4 rounded"
                            />
                          </td>
                          <td className="px-3 py-2 text-center border-r border-slate-300">
                            <input 
                              type="checkbox"
                              checked={field.reservationFormRequired}
                              disabled={!field.reservationFormVisible}
                              onChange={(e) => {
                                const newConfig = (settings.coreFieldsConfig || []).map(f => 
                                  f.fieldName === field.fieldName 
                                    ? { ...f, reservationFormRequired: e.target.checked }
                                    : f
                                );
                                handleChange('coreFieldsConfig', newConfig);
                              }}
                              className="w-4 h-4 rounded disabled:opacity-50"
                            />
                          </td>
                          <td className="px-3 py-2 text-center border-r border-slate-300">
                            <input 
                              type="checkbox"
                              checked={field.guestDetailsVisible}
                              onChange={(e) => {
                                const newConfig = (settings.coreFieldsConfig || []).map(f => 
                                  f.fieldName === field.fieldName 
                                    ? { ...f, guestDetailsVisible: e.target.checked }
                                    : f
                                );
                                handleChange('coreFieldsConfig', newConfig);
                              }}
                              className="w-4 h-4 rounded"
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input 
                              type="checkbox"
                              checked={field.guestDetailsRequired}
                              disabled={!field.guestDetailsVisible}
                              onChange={(e) => {
                                const newConfig = (settings.coreFieldsConfig || []).map(f => 
                                  f.fieldName === field.fieldName 
                                    ? { ...f, guestDetailsRequired: e.target.checked }
                                    : f
                                );
                                handleChange('coreFieldsConfig', newConfig);
                              }}
                              className="w-4 h-4 rounded disabled:opacity-50"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Custom Fields */}
                <div className="space-y-4 pt-6 border-t">
                  <h3 className="font-semibold text-xl">Custom Fields</h3>
                  <p className="text-xs text-muted-foreground">Create custom fields for collecting additional guest information like preferences, special needs, and more.</p>
                
                {(settings.customFields || []).length > 0 || isAddingNewField ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border border-slate-300">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-300">
                          <th className="px-3 py-2 h-8 text-left font-semibold border-r border-slate-300">Field Name</th>
                          <th className="px-3 py-2 h-8 text-left font-semibold border-r border-slate-300">Type</th>
                          <th className="px-3 py-2 h-8 text-center font-semibold border-r border-slate-300">Required</th>
                          <th className="px-3 py-2 h-8 text-left font-semibold border-r border-slate-300">Apply To</th>
                          <th className="px-3 py-2 h-8 text-left font-semibold border-r border-slate-300">Display On</th>
                          <th className="px-3 py-2 h-8 text-center font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(settings.customFields || []).map((field, idx) => (
                          <React.Fragment key={field.id}>
                            <tr className="border-b border-slate-300 hover:bg-slate-50 transition-colors">
                              <td className="px-3 py-2 font-medium border-r border-slate-300">
                                {editingFieldId === field.id ? (
                                  <input 
                                    type="text"
                                    value={editingFieldData?.name || ''}
                                    onChange={(e) => setEditingFieldData({ ...editingFieldData!, name: e.target.value })}
                                    className="w-full px-2 py-1 border rounded text-sm"
                                  />
                                ) : (
                                  field.name
                                )}
                              </td>
                              <td className="px-3 py-2 capitalize border-r border-slate-300">
                                {editingFieldId === field.id ? (
                                  <select 
                                    value={editingFieldData?.type || 'text'}
                                    onChange={(e) => setEditingFieldData({ ...editingFieldData!, type: e.target.value as any })}
                                    className="w-full px-2 py-1 border rounded text-sm"
                                  >
                                    <option value="text">Text</option>
                                    <option value="number">Number</option>
                                    <option value="email">Email</option>
                                    <option value="dropdown">Dropdown</option>
                                    <option value="checkbox">Checkbox</option>
                                  </select>
                                ) : (
                                  field.type
                                )}
                              </td>
                              <td className="px-3 py-2 text-center border-r border-slate-300">
                                {editingFieldId === field.id ? (
                                  <input 
                                    type="checkbox"
                                    checked={editingFieldData?.isRequired || false}
                                    onChange={(e) => setEditingFieldData({ ...editingFieldData!, isRequired: e.target.checked })}
                                    className="w-4 h-4 rounded"
                                  />
                                ) : (
                                  field.isRequired ? (
                                    <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-1 rounded text-xs font-medium">
                                      ✓ Yes
                                    </span>
                                  ) : (
                                    <span className="text-slate-500">No</span>
                                  )
                                )}
                              </td>
                              <td className="px-3 py-2 capitalize border-r border-slate-300">
                                {editingFieldId === field.id ? (
                                  <select 
                                    value={editingFieldData?.appliedTo || 'guest'}
                                    onChange={(e) => setEditingFieldData({ ...editingFieldData!, appliedTo: e.target.value as any })}
                                    className="w-full px-2 py-1 border rounded text-sm"
                                  >
                                    <option value="guest">Guest Profile</option>
                                    <option value="reservation">Reservation</option>
                                  </select>
                                ) : (
                                  <span className="bg-slate-100 px-2 py-1 rounded text-xs">
                                    {field.appliedTo === 'guest' ? 'Guest Profile' : 'Reservation'}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 border-r border-slate-300">
                                {editingFieldId === field.id ? (
                                  <div className="space-y-2">
                                    <label className="flex items-center gap-2 cursor-pointer text-xs">
                                      <input 
                                        type="checkbox"
                                        checked={(editingFieldData?.displayLocations || []).includes('direct')}
                                        onChange={(e) => {
                                          const locations = editingFieldData?.displayLocations || [];
                                          if (e.target.checked) {
                                            setEditingFieldData({ ...editingFieldData!, displayLocations: [...locations, 'direct'] });
                                          } else {
                                            setEditingFieldData({ ...editingFieldData!, displayLocations: locations.filter(l => l !== 'direct') });
                                          }
                                        }}
                                        className="w-3 h-3 rounded"
                                      />
                                      <span>In-App Reservations</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer text-xs">
                                      <input 
                                        type="checkbox"
                                        checked={(editingFieldData?.displayLocations || []).includes('booking-engine')}
                                        onChange={(e) => {
                                          const locations = editingFieldData?.displayLocations || [];
                                          if (e.target.checked) {
                                            setEditingFieldData({ ...editingFieldData!, displayLocations: [...locations, 'booking-engine'] });
                                          } else {
                                            setEditingFieldData({ ...editingFieldData!, displayLocations: locations.filter(l => l !== 'booking-engine') });
                                          }
                                        }}
                                        className="w-3 h-3 rounded"
                                      />
                                      <span>Booking engine</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer text-xs">
                                      <input 
                                        type="checkbox"
                                        checked={(editingFieldData?.displayLocations || []).includes('registration-card')}
                                        onChange={(e) => {
                                          const locations = editingFieldData?.displayLocations || [];
                                          if (e.target.checked) {
                                            setEditingFieldData({ ...editingFieldData!, displayLocations: [...locations, 'registration-card'] });
                                          } else {
                                            setEditingFieldData({ ...editingFieldData!, displayLocations: locations.filter(l => l !== 'registration-card') });
                                          }
                                        }}
                                        className="w-3 h-3 rounded"
                                      />
                                      <span>Registration card</span>
                                    </label>
                                  </div>
                                ) : (
                                  <div className="flex flex-wrap gap-1">
                                    {(field.displayLocations || []).length > 0 ? (
                                      (field.displayLocations || []).map((location) => (
                                        <span key={location} className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                                          {location === 'direct' && 'Direct'}
                                          {location === 'booking-engine' && 'Booking'}
                                          {location === 'registration-card' && 'Registration'}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-slate-400 text-xs">Not specified</span>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                {editingFieldId === field.id ? (
                                  <div className="flex justify-center gap-2">
                                    <Button 
                                      size="sm"
                                      variant="default"
                                      onClick={handleSaveEditField}
                                    >
                                      Save
                                    </Button>
                                    <Button 
                                      size="sm"
                                      variant="outline"
                                      onClick={handleCancelEditField}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex justify-center gap-2">
                                    <Button 
                                      size="sm"
                                      variant="ghost"
                                      title="Edit field"
                                      onClick={() => handleStartEditField(field)}
                                    >
                                      <Icons.Edit className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                      size="sm"
                                      variant="ghost"
                                      title="Delete field"
                                      className="text-red-600 hover:text-red-700"
                                      onClick={() => setDeletingFieldIdx(idx)}
                                    >
                                      <Icons.X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                              </td>
                            </tr>
                            {(field.type === 'dropdown' || field.type === 'checkbox') && (field.options || []).length > 0 && (
                              <tr className="border-b border-slate-300 bg-slate-25">
                                <td colSpan={6} className="px-3 py-2">
                                  <div className="text-xs space-y-2">
                                    <p className="font-semibold text-slate-700">
                                      {field.type === 'dropdown' ? 'Options' : 'Options'}:
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      {(field.options || []).map((option, optIdx) => (
                                        <span key={`${field.id}-option-${optIdx}`} className="bg-purple-100 text-purple-800 px-3 py-1 rounded text-xs">
                                          {option}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                        {isAddingNewField && (
                          <tr className="border-b border-slate-300 bg-blue-50">
                            <td className="px-3 py-2 border-r border-slate-300">
                              <input 
                                type="text"
                                placeholder="Field name"
                                value={newFieldData.name || ''}
                                onChange={(e) => setNewFieldData(prev => ({ ...prev, name: e.target.value }))}
                                className="w-full px-2 py-1 border rounded text-sm"
                              />
                            </td>
                            <td className="px-3 py-2 border-r border-slate-300">
                              <Select value={newFieldData.type || 'text'} onValueChange={(value) => setNewFieldData(prev => ({ ...prev, type: value as CustomField['type'] }))}>
                                <SelectTrigger className="h-8 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="text">Text</SelectItem>
                                  <SelectItem value="dropdown">Dropdown</SelectItem>
                                  <SelectItem value="date">Date</SelectItem>
                                  <SelectItem value="checkbox">Checkbox</SelectItem>
                                  <SelectItem value="file">File</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="px-3 py-2 text-center border-r border-slate-300">
                              <input 
                                type="checkbox"
                                checked={newFieldData.isRequired || false}
                                onChange={(e) => setNewFieldData(prev => ({ ...prev, isRequired: e.target.checked }))}
                                className="w-4 h-4 rounded"
                              />
                            </td>
                            <td className="px-3 py-2 border-r border-slate-300">
                              <Select value={newFieldData.appliedTo || 'guest'} onValueChange={(value) => setNewFieldData(prev => ({ ...prev, appliedTo: value as 'guest' | 'reservation' }))}>
                                <SelectTrigger className="h-8 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="guest">Guest Details</SelectItem>
                                  <SelectItem value="reservation">Reservation</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="px-3 py-2 border-r border-slate-300">
                              <div className="space-y-2">
                                <label className="flex items-center gap-2 cursor-pointer text-xs">
                                  <input 
                                    type="checkbox"
                                    checked={(newFieldData.displayLocations || []).includes('direct')}
                                    onChange={(e) => {
                                      const locations = newFieldData.displayLocations || [];
                                      if (e.target.checked) {
                                        setNewFieldData(prev => ({ ...prev, displayLocations: [...locations, 'direct'] }));
                                      } else {
                                        setNewFieldData(prev => ({ ...prev, displayLocations: locations.filter(l => l !== 'direct') }));
                                      }
                                    }}
                                    className="w-3 h-3 rounded"
                                  />
                                    <span>In-App Reservations</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer text-xs">
                                  <input 
                                    type="checkbox"
                                    checked={(newFieldData.displayLocations || []).includes('booking-engine')}
                                    onChange={(e) => {
                                      const locations = newFieldData.displayLocations || [];
                                      if (e.target.checked) {
                                        setNewFieldData(prev => ({ ...prev, displayLocations: [...locations, 'booking-engine'] }));
                                      } else {
                                        setNewFieldData(prev => ({ ...prev, displayLocations: locations.filter(l => l !== 'booking-engine') }));
                                      }
                                    }}
                                    className="w-3 h-3 rounded"
                                  />
                                  <span>Booking engine</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer text-xs">
                                  <input 
                                    type="checkbox"
                                    checked={(newFieldData.displayLocations || []).includes('registration-card')}
                                    onChange={(e) => {
                                      const locations = newFieldData.displayLocations || [];
                                      if (e.target.checked) {
                                        setNewFieldData(prev => ({ ...prev, displayLocations: [...locations, 'registration-card'] }));
                                      } else {
                                        setNewFieldData(prev => ({ ...prev, displayLocations: locations.filter(l => l !== 'registration-card') }));
                                      }
                                    }}
                                    className="w-3 h-3 rounded"
                                  />
                                  <span>Registration card</span>
                                </label>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <div className="flex justify-center gap-2">
                                <Button 
                                  size="sm"
                                  variant="default"
                                  onClick={handleSaveNewCustomField}
                                >
                                  Save
                                </Button>
                                <Button 
                                  size="sm"
                                  variant="outline"
                                  onClick={handleCancelAddCustomField}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground py-4">No custom fields created yet. Add one to get started.</p>
                )}

                <Button 
                  variant="outline"
                  onClick={handleStartAddCustomField}
                >
                  <Icons.PlusCircle className="mr-2 h-4 w-4" /> Add Custom Field
                </Button>
                </div>
              </CardContent>
            </Card>

            {/* Status */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Status</CardTitle>
                <CardDescription className="text-xs">Configure statuses logic for guest profiles</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Enable statuses on profiles</Label>
                  <Switch checked={settings.enableStatus} onCheckedChange={(val) => handleChange('enableStatus', val)} />
                </div>

                {settings.enableStatus && (
                  <>
                    <div className="space-y-4 border-t pt-4">
                      <h3 className="font-semibold text-xl">Status & Auto-Apply Logic</h3>
                      <p className="text-xs text-muted-foreground">Configure when flags should automatically apply to guests</p>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border border-slate-300">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-300">
                              <th className="px-3 py-2 h-8 text-left font-semibold border-r border-slate-300">Status Name</th>
                              <th className="px-3 py-2 h-8 text-left font-semibold border-r border-slate-300">Auto-Apply</th>
                              <th className="px-3 py-2 h-8 text-left font-semibold border-r border-slate-300">Trigger</th>
                              <th className="px-3 py-2 h-8 text-left font-semibold border-r border-slate-300">Threshold</th>
                              <th className="px-3 py-2 h-8 text-left font-semibold border-r border-slate-300">Reason Required</th>
                              <th className="px-3 py-2 h-8 text-center font-semibold">Enabled</th>
                              <th className="px-3 py-2 h-8 text-center font-semibold">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(settings.status || []).map((flag, idx) => (
                              <tr key={flag.id} className="border-b border-slate-300 hover:bg-slate-50 transition-colors">
                                <td className="px-3 py-2 border-r border-slate-300">
                                  {editingFlagId === flag.id ? (
                                    <div className="flex items-center gap-2">
                                      <input 
                                        type="color"
                                        value={editingFlagColor}
                                        onChange={(e) => setEditingFlagColor(e.target.value)}
                                        className="h-8 w-12 border rounded cursor-pointer"
                                      />
                                      <input 
                                        type="text"
                                        value={editingFlagName}
                                        onChange={(e) => setEditingFlagName(e.target.value)}
                                        className="flex-1 px-2 py-1 border rounded text-sm"
                                      />
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <div className="w-4 h-4 rounded" style={{ backgroundColor: flag.color }}></div>
                                      <span className="font-medium">{flag.name}</span>
                                    </div>
                                  )}
                                </td>
                                <td className="px-3 py-2 border-r border-slate-300">
                                  {editingFlagId === flag.id ? (
                                    <input 
                                      type="checkbox"
                                      checked={flag.rule?.enabled || false}
                                      onChange={(e) => {
                                        handleUpdateFlag(flag.id, {
                                          rule: { ...flag.rule, enabled: e.target.checked } as statusRule
                                        });
                                      }}
                                      className="w-4 h-4 rounded"
                                    />
                                  ) : (
                                    <input 
                                      type="checkbox"
                                      checked={flag.rule?.enabled || false}
                                      readOnly
                                      className="w-4 h-4 rounded cursor-not-allowed opacity-60"
                                    />
                                  )}
                                </td>
                                <td className="px-3 py-2 border-r border-slate-300">
                                  {editingFlagId === flag.id ? (
                                    <select 
                                      value={flag.rule?.triggerType || 'stays'}
                                      onChange={(e) => {
                                        handleUpdateFlag(flag.id, {
                                          rule: { ...flag.rule, triggerType: e.target.value as any } as statusRule
                                        });
                                      }}
                                      disabled={!flag.rule?.enabled}
                                      className="text-xs px-2 py-1 border rounded disabled:opacity-50"
                                    >
                                      <option value="stays">Number of Stays</option>
                                      <option value="totalSpend">Total Spend ($)</option>
                                      <option value="avgSpendPerStay">Avg Spend/Stay ($)</option>
                                      <option value="nightsBooked">Nights Booked</option>
                                      <option value="bookingValue">Last Booking Value ($)</option>
                                    </select>
                                  ) : (
                                    <span className="text-sm text-slate-700">
                                      {flag.rule?.triggerType === 'stays' && 'Number of Stays'}
                                      {flag.rule?.triggerType === 'totalSpend' && 'Total Spend ($)'}
                                      {flag.rule?.triggerType === 'avgSpendPerStay' && 'Avg Spend/Stay ($)'}
                                      {flag.rule?.triggerType === 'nightsBooked' && 'Nights Booked'}
                                      {flag.rule?.triggerType === 'bookingValue' && 'Last Booking Value ($)'}
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2 border-r border-slate-300">
                                  {editingFlagId === flag.id ? (
                                    <input 
                                      type="number"
                                      value={flag.rule?.threshold || 1}
                                      onChange={(e) => {
                                        handleUpdateFlag(flag.id, {
                                          rule: { ...flag.rule, threshold: parseInt(e.target.value) || 1 } as statusRule
                                        });
                                      }}
                                      disabled={!flag.rule?.enabled}
                                      className="w-16 px-2 py-1 border rounded text-xs disabled:opacity-50"
                                    />
                                  ) : (
                                    <span className="text-sm text-slate-700">{flag.rule?.threshold || 1}</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 border-r border-slate-300">
                                  {editingFlagId === flag.id ? (
                                    <input 
                                      type="checkbox"
                                      checked={flag.reasonRequired}
                                      onChange={(e) => {
                                        handleUpdateFlag(flag.id, { reasonRequired: e.target.checked });
                                      }}
                                      className="w-4 h-4 rounded"
                                    />
                                  ) : (
                                    <input 
                                      type="checkbox"
                                      checked={flag.reasonRequired}
                                      readOnly
                                      className="w-4 h-4 rounded cursor-not-allowed opacity-60"
                                    />
                                  )}
                                </td>
                                <td className="px-3 py-2 text-center border-r border-slate-300">
                                  {editingFlagId === flag.id ? (
                                    <Switch
                                      checked={flag.visibleOnGuestActions !== false}
                                      onCheckedChange={() => handleToggleStatusVisibility(flag.id)}
                                      title={flag.visibleOnGuestActions !== false ? "Visible on guest actions" : "Hidden from guest actions"}
                                    />
                                  ) : (
                                    <Switch
                                      checked={flag.visibleOnGuestActions !== false}
                                      disabled
                                      title={flag.visibleOnGuestActions !== false ? "Visible on guest actions" : "Hidden from guest actions"}
                                    />
                                  )}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {editingFlagId === flag.id ? (
                                    <div className="flex justify-center gap-2">
                                      <Button 
                                        size="sm"
                                        variant="default"
                                        onClick={handleSaveEditFlag}
                                      >
                                        Save
                                      </Button>
                                      <Button 
                                        size="sm"
                                        variant="outline"
                                        onClick={handleCancelEditFlag}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="flex justify-center gap-2">
                                      <Button 
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleStartEditFlag(flag)}
                                        title="Edit flag name and color"
                                      >
                                        <Icons.Edit className="h-4 w-4" />
                                      </Button>
                                      <Button 
                                        size="sm"
                                        variant="ghost"
                                        disabled={flag.isDefault}
                                        onClick={() => handleDeleteFlag(flag.id)}
                                        title={flag.isDefault ? "Default flags cannot be deleted" : "Delete flag"}
                                        className={flag.isDefault ? "text-slate-300 cursor-not-allowed" : "text-red-600 hover:text-red-700"}
                                      >
                                        <Icons.X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))}
                            {isAddingNewFlag && (
                              <tr className="border-b border-slate-300 bg-blue-50">
                                <td className="px-3 py-2 border-r border-slate-300">
                                  <div className="flex items-center gap-2">
                                    <input 
                                      type="color"
                                      value={newFlagData.color || '#4CAF50'}
                                      onChange={(e) => setNewFlagData(prev => ({ ...prev, color: e.target.value }))}
                                      className="h-8 w-12 border rounded cursor-pointer"
                                    />
                                    <input 
                                      type="text"
                                      placeholder="Flag name"
                                      value={newFlagData.name || ''}
                                      onChange={(e) => setNewFlagData(prev => ({ ...prev, name: e.target.value }))}
                                      className="flex-1 px-2 py-1 border rounded text-sm"
                                    />
                                  </div>
                                </td>
                                <td className="px-3 py-2 border-r border-slate-300">
                                  <input 
                                    type="checkbox"
                                    checked={newFlagData.rule?.enabled || false}
                                    onChange={(e) => setNewFlagData(prev => ({ 
                                      ...prev, 
                                      rule: { ...prev.rule, enabled: e.target.checked } as statusRule 
                                    }))}
                                    className="w-4 h-4 rounded"
                                  />
                                </td>
                                <td className="px-3 py-2 border-r border-slate-300">
                                  <select 
                                    value={newFlagData.rule?.triggerType || 'stays'}
                                    onChange={(e) => setNewFlagData(prev => ({ 
                                      ...prev, 
                                      rule: { ...prev.rule, triggerType: e.target.value as any } as statusRule 
                                    }))}
                                    disabled={!newFlagData.rule?.enabled}
                                    className="text-xs px-2 py-1 border rounded disabled:opacity-50"
                                  >
                                    <option value="stays">Number of Stays</option>
                                    <option value="totalSpend">Total Spend ($)</option>
                                    <option value="avgSpendPerStay">Avg Spend/Stay ($)</option>
                                    <option value="nightsBooked">Nights Booked</option>
                                    <option value="bookingValue">Last Booking Value ($)</option>
                                  </select>
                                </td>
                                <td className="px-3 py-2 border-r border-slate-300">
                                  <input 
                                    type="number"
                                    value={newFlagData.rule?.threshold || 1}
                                    onChange={(e) => setNewFlagData(prev => ({ 
                                      ...prev, 
                                      rule: { ...prev.rule, threshold: parseInt(e.target.value) || 1 } as statusRule 
                                    }))}
                                    disabled={!newFlagData.rule?.enabled}
                                    className="w-16 px-2 py-1 border rounded text-xs disabled:opacity-50"
                                  />
                                </td>
                                <td className="px-3 py-2 border-r border-slate-300">
                                  <input 
                                    type="checkbox"
                                    checked={newFlagData.reasonRequired || false}
                                    onChange={(e) => setNewFlagData(prev => ({ ...prev, reasonRequired: e.target.checked }))}
                                    className="w-4 h-4 rounded"
                                  />
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <div className="flex justify-center gap-2">
                                    <Button 
                                      size="sm"
                                      variant="default"
                                      onClick={handleSaveNewFlag}
                                    >
                                      Save
                                    </Button>
                                    <Button 
                                      size="sm"
                                      variant="outline"
                                      onClick={handleCancelAddFlag}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      <Button 
                        variant="outline"
                        onClick={handleStartAddFlag}
                      >
                        <Icons.PlusCircle className="mr-2 h-4 w-4" /> Add Custom Status
                      </Button>

                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Note Categories */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Note Categories</CardTitle>
                <CardDescription className="text-xs">Configure note categories available for guest profiles</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border border-slate-300">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-300">
                        <th className="px-3 py-2 h-8 text-left font-semibold border-r border-slate-300">Note Category Name</th>
                        <th className="px-3 py-2 h-8 text-center font-semibold border-r border-slate-300">Reservation Form</th>
                        <th className="px-3 py-2 h-8 text-center font-semibold border-r border-slate-300">Guest Details</th>
                        <th className="px-3 py-2 h-8 text-center font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(settings.noteCategories || []).map((category) => (
                        <tr key={category.id} className="border-b border-slate-300 hover:bg-slate-50 transition-colors">
                          <td className="px-3 py-2 font-medium border-r border-slate-300">{category.name}</td>
                          <td className="px-3 py-2 text-center border-r border-slate-300">
                            <input 
                              type="checkbox"
                              checked={category.displayOnReservationForm}
                              onChange={(e) => {
                                const updated = (settings.noteCategories || []).map(cat => 
                                  cat.id === category.id 
                                    ? { ...cat, displayOnReservationForm: e.target.checked }
                                    : cat
                                );
                                handleChange('noteCategories', updated);
                              }}
                              className="w-4 h-4 rounded"
                            />
                          </td>
                          <td className="px-3 py-2 text-center border-r border-slate-300">
                            <input 
                              type="checkbox"
                              checked={category.displayOnGuestDetails}
                              onChange={(e) => {
                                const updated = (settings.noteCategories || []).map(cat => 
                                  cat.id === category.id 
                                    ? { ...cat, displayOnGuestDetails: e.target.checked }
                                    : cat
                                );
                                handleChange('noteCategories', updated);
                              }}
                              className="w-4 h-4 rounded"
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Button 
                              size="sm" 
                              variant="ghost"
                              disabled={category.isDefault}
                              onClick={() => {
                                const newCats = (settings.noteCategories || []).filter(cat => cat.id !== category.id);
                                handleChange('noteCategories', newCats);
                              }}
                              title={category.isDefault ? "Default categories cannot be deleted" : "Delete category"}
                              className={category.isDefault ? "text-slate-300 cursor-not-allowed" : "text-red-600 hover:text-red-700"}
                            >
                              <Icons.X className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {isAddingNewCategory && (
                        <tr className="border-b border-slate-300 bg-blue-50">
                          <td className="px-3 py-2 border-r border-slate-300">
                            <input 
                              type="text"
                              placeholder="Category name"
                              value={newCategoryData.name || ''}
                              onChange={(e) => setNewCategoryData(prev => ({ ...prev, name: e.target.value }))}
                              className="w-full px-2 py-1 border rounded text-sm"
                            />
                          </td>
                          <td className="px-3 py-2 text-center border-r border-slate-300">
                            <input 
                              type="checkbox"
                              checked={newCategoryData.displayOnReservationForm || false}
                              onChange={(e) => setNewCategoryData(prev => ({ ...prev, displayOnReservationForm: e.target.checked }))}
                              className="w-4 h-4 rounded"
                            />
                          </td>
                          <td className="px-3 py-2 text-center border-r border-slate-300">
                            <input 
                              type="checkbox"
                              checked={newCategoryData.displayOnGuestDetails || false}
                              onChange={(e) => setNewCategoryData(prev => ({ ...prev, displayOnGuestDetails: e.target.checked }))}
                              className="w-4 h-4 rounded"
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex justify-center gap-2">
                              <Button 
                                size="sm"
                                variant="default"
                                onClick={handleSaveNewCategory}
                              >
                                Save
                              </Button>
                              <Button 
                                size="sm"
                                variant="outline"
                                onClick={handleCancelAddCategory}
                              >
                                Cancel
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <Button 
                  variant="outline"
                  onClick={handleStartAddCategory}
                >
                  <Icons.PlusCircle className="mr-2 h-4 w-4" /> Add Category
                </Button>
              </CardContent>
            </Card>
            </div>
          )}

          {/* Duplicate Data Rules Tab */}
          {activeTab === 'duplicate-data-rules' && (
            <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Duplicate Detection Settings</CardTitle>
                <CardDescription className="text-xs">Configure how the system detects and handles duplicate guest records</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Enable duplicate detection</Label>
                  <Switch checked={settings.enableDuplicateDetection} onCheckedChange={(val) => handleChange('enableDuplicateDetection', val)} />
                </div>
                
                {settings.enableDuplicateDetection && (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-base">Detection Fields</Label>
                      <div className="space-y-2 mt-2">
                        {['email', 'phone'].map(field => (
                          <div key={field} className="flex items-center gap-2">
                            <input 
                              type="checkbox" 
                              id={`dup-${field}`}
                              checked={settings.duplicateDetectionFields.includes(field as any)}
                              onChange={(e) => {
                                const newFields = e.target.checked 
                                  ? [...settings.duplicateDetectionFields, field as any]
                                  : settings.duplicateDetectionFields.filter(f => f !== field);
                                handleChange('duplicateDetectionFields', newFields);
                              }}
                              className="rounded"
                            />
                            <label htmlFor={`dup-${field}`} className="text-sm cursor-pointer capitalize">{field}</label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label className="text-base mb-3 block">Choose Custom Fields</Label>
                      <div className="space-y-2">
                        {(settings.coreFieldsConfig || []).map(field => (
                          <div key={field.fieldName} className="flex items-center gap-2">
                            <input 
                              type="checkbox" 
                              id={`custom-${field.fieldName}`}
                              checked={(settings.duplicateDetectionCustomFields || []).includes(field.fieldName)}
                              onChange={(e) => {
                                const customFields = settings.duplicateDetectionCustomFields || [];
                                const newCustomFields = e.target.checked
                                  ? [...customFields, field.fieldName]
                                  : customFields.filter(f => f !== field.fieldName);
                                handleChange('duplicateDetectionCustomFields', newCustomFields);
                              }}
                              className="rounded"
                            />
                            <label htmlFor={`custom-${field.fieldName}`} className="text-sm cursor-pointer">{field.displayName}</label>
                          </div>
                        ))}
                        {(settings.customFields || []).map(field => (
                          <div key={field.id} className="flex items-center gap-2">
                            <input 
                              type="checkbox" 
                              id={`custom-${field.id}`}
                              checked={(settings.duplicateDetectionCustomFields || []).includes(field.id)}
                              onChange={(e) => {
                                const customFields = settings.duplicateDetectionCustomFields || [];
                                const newCustomFields = e.target.checked
                                  ? [...customFields, field.id]
                                  : customFields.filter(f => f !== field.id);
                                handleChange('duplicateDetectionCustomFields', newCustomFields);
                              }}
                              className="rounded"
                            />
                            <label htmlFor={`custom-${field.id}`} className="text-base cursor-pointer">{field.name} (Custom)</label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <Label className="text-base">Auto-merge duplicates</Label>
                  <Switch checked={settings.autoMergeDuplicates} onCheckedChange={(val) => handleChange('autoMergeDuplicates', val)} />
                </div>
              </CardContent>
            </Card>
            </div>
          )}

          {/* Loyalty Program Tab */}
          {activeTab === 'loyalty-program' && (
            <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Loyalty Program</CardTitle>
                <CardDescription className="text-xs">Configure point earning, redemption, and tier settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Enable loyalty program</Label>
                  <Switch checked={settings.enableLoyaltyProgram} onCheckedChange={(val) => handleChange('enableLoyaltyProgram', val)} />
                </div>

                {settings.enableLoyaltyProgram && (
                  <>
                    <div className="space-y-4 border-t pt-4">
                      <h3 className="font-semibold text-lg">Points Configuration</h3>
                      
                      <div className="space-y-2">
                        <Label htmlFor="pointsEarning" className="text-sm">Earning Rate (Spend $ to earn 1 point)</Label>
                        <Input 
                          id="pointsEarning"
                          type="number" 
                          min="0.01"
                          step="0.01"
                          placeholder="e.g., 50"
                          value={settings.pointsEarningRate}
                          onChange={(e) => handleChange('pointsEarningRate', parseFloat(e.target.value))}
                        />
                        <p className="text-xs text-muted-foreground">Guests earn 1 point for every ${settings.pointsEarningRate} spent</p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="pointsRedemption" className="text-sm">Points Redemption Value ($ per point)</Label>
                        <Input 
                          id="pointsRedemption"
                          type="number" 
                          min="0.001"
                          step="0.001"
                          value={settings.pointsRedemptionValue}
                          onChange={(e) => handleChange('pointsRedemptionValue', parseFloat(e.target.value))}
                        />
                        <p className="text-xs text-muted-foreground">Each point can be redeemed for ${settings.pointsRedemptionValue}</p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="pointExpiration" className="text-sm">Point Expiration (months)</Label>
                        <Input 
                          id="pointExpiration"
                          type="number" 
                          min="1"
                          max="120"
                          value={settings.pointExpirationMonths}
                          onChange={(e) => handleChange('pointExpirationMonths', parseInt(e.target.value))}
                        />
                        <p className="text-xs text-muted-foreground">Points expire after {settings.pointExpirationMonths} months of inactivity</p>
                      </div>
                    </div>

                    <div className="space-y-4 border-t pt-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-base">Auto-enroll new guests in loyalty program</Label>
                        <Switch checked={settings.autoEnrollNewGuests} onCheckedChange={(val) => handleChange('autoEnrollNewGuests', val)} />
                      </div>
                    </div>

                    <div className="space-y-4 border-t pt-4">
                      <h3 className="font-semibold text-lg">Loyalty Tiers</h3>
                      <p className="text-xs text-muted-foreground">Configure tier thresholds and benefits</p>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border border-slate-300">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-300">
                              <th className="px-3 py-2 h-8 text-center font-semibold border-r border-slate-300">Color</th>
                              <th className="px-3 py-2 h-8 text-left font-semibold border-r border-slate-300">Tier Name</th>
                              <th className="px-3 py-2 h-8 text-left font-semibold border-r border-slate-300">Min Points</th>
                              <th className="px-3 py-2 h-8 text-center font-semibold border-r border-slate-300">Bonus Multiplier</th>
                              <th className="px-3 py-2 h-8 text-left font-semibold border-r border-slate-300">Multiplier Coefficient</th>
                              <th className="px-3 py-2 h-8 text-center font-semibold">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(settings.loyaltyTiers || []).map((tier, idx) => (
                              <tr key={`tier-${idx}`} className="border-b border-slate-300 hover:bg-slate-50 transition-colors">
                                <td className="px-3 py-2 text-center border-r border-slate-300">
                                  <input 
                                    type="color"
                                    value={tier.color || '#9CA3AF'}
                                    disabled={editingTierIdx !== idx}
                                    onChange={(e) => {
                                      const newTiers = [...settings.loyaltyTiers];
                                      newTiers[idx].color = e.target.value;
                                      handleChange('loyaltyTiers', newTiers);
                                    }}
                                    className="w-6 h-6 cursor-pointer disabled:cursor-default"
                                  />
                                </td>
                                <td className="px-3 py-2 border-r border-slate-300">
                                  <input 
                                    type="text"
                                    value={tier.name || ''}
                                    disabled={editingTierIdx !== idx}
                                    onChange={(e) => {
                                      const newTiers = [...settings.loyaltyTiers];
                                      newTiers[idx].name = e.target.value;
                                      handleChange('loyaltyTiers', newTiers);
                                    }}
                                    className="w-full px-2 py-1 border rounded text-sm disabled:bg-transparent disabled:border-0 disabled:cursor-default"
                                  />
                                </td>
                                <td className="px-3 py-2 border-r border-slate-300">
                                  <input 
                                    type="number"
                                    min="0"
                                    value={tier.minPoints ?? 0}
                                    disabled={editingTierIdx !== idx}
                                    onChange={(e) => {
                                      const newTiers = [...settings.loyaltyTiers];
                                      newTiers[idx].minPoints = parseInt(e.target.value) || 0;
                                      handleChange('loyaltyTiers', newTiers);
                                    }}
                                    className="w-full px-2 py-1 border rounded text-sm disabled:bg-transparent disabled:border-0 disabled:cursor-default"
                                  />
                                </td>
                                <td className="px-3 py-2 text-center border-r border-slate-300">
                                  <Switch 
                                    checked={tier.bonusEnabled ?? false}
                                    disabled={editingTierIdx !== idx}
                                    onCheckedChange={(checked) => {
                                      const newTiers = [...settings.loyaltyTiers];
                                      newTiers[idx].bonusEnabled = checked;
                                      handleChange('loyaltyTiers', newTiers);
                                    }}
                                  />
                                </td>
                                <td className="px-3 py-2 border-r border-slate-300">
                                  <input 
                                    type="number"
                                    min="1"
                                    step="0.01"
                                    max="99.99"
                                    placeholder="1.00"
                                    value={tier.bonusCoefficient ?? 1}
                                    disabled={editingTierIdx !== idx || !(tier.bonusEnabled ?? false)}
                                    onChange={(e) => {
                                      const newTiers = [...settings.loyaltyTiers];
                                      let value = parseFloat(e.target.value) || 1;
                                      // Round to 2 decimal places
                                      value = Math.round(value * 100) / 100;
                                      newTiers[idx].bonusCoefficient = value;
                                      handleChange('loyaltyTiers', newTiers);
                                    }}
                                    className="w-full px-2 py-1 border rounded text-sm disabled:bg-transparent disabled:border-0 disabled:cursor-default disabled:opacity-100"
                                  />
                                </td>
                                <td className="px-3 py-2 text-center space-x-2 flex justify-center">
                                  {editingTierIdx === idx ? (
                                    <div className="flex justify-center gap-2">
                                      <Button 
                                        size="sm"
                                        variant="default"
                                        onClick={() => setEditingTierIdx(null)}
                                      >
                                        Save
                                      </Button>
                                      <Button 
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setEditingTierIdx(null)}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="flex justify-center gap-2">
                                      <Button 
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setEditingTierIdx(idx)}
                                        title="Edit tier"
                                      >
                                        <Icons.Edit className="h-4 w-4" />
                                      </Button>
                                      <Button 
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setDeletingTierIdx(idx)}
                                        title="Delete tier"
                                        className="text-red-600 hover:text-red-700"
                                      >
                                        <Icons.X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <Button 
                        variant="outline"
                        onClick={() => {
                          const newTier = { name: 'New Tier', color: '#9CA3AF', minPoints: 0, bonusEnabled: false, bonusCoefficient: 1 };
                          const currentTiers = settings.loyaltyTiers || [];
                          handleChange('loyaltyTiers', [...currentTiers, newTier]);
                        }}
                      >
                        <Icons.PlusCircle className="mr-2 h-4 w-4" /> Add Tier
                      </Button>

                      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => setShowLoyaltyGuide(!showLoyaltyGuide)}
                          className="w-full px-3 py-3 flex items-center justify-between hover:bg-blue-100 transition-colors"
                        >
                          <p className="font-semibold text-sm text-blue-900">How Loyalty Tiers & Multipliers Work</p>
                          <Icons.DropdownArrow 
                            className={`h-4 w-4 text-blue-900 transition-transform ${showLoyaltyGuide ? 'rotate-180' : ''}`}
                          />
                        </button>
                        
                        {showLoyaltyGuide && (
                          <div className="px-3 pb-3 pt-3 text-xs text-slate-700 border-t border-blue-200">
                            <ul className="space-y-2 ml-2">
                              <li><span className="font-medium">Tier Assignment:</span> Guests are automatically assigned to the highest tier where their loyalty points are greater than or equal to the "Min Points" threshold.</li>
                              <li><span className="font-medium">Base Earning Rate:</span> The earning rate ({settings.pointsEarningRate ? `$${settings.pointsEarningRate}` : 'N/A'} spent = 1 point) is the base for all guests, regardless of tier.</li>
                              <li><span className="font-medium">Tier Multiplier:</span> When enabled, the multiplier coefficient increases points earned for that tier. For example:
                                <ul className="list-disc ml-6 mt-1 space-y-1">
                                  <li>Member (1.0x): Earns base points</li>
                                  <li>Silver (1.25x): Earns 1.25× the base points</li>
                                  <li>Gold (1.50x): Earns 1.50× the base points</li>
                                  <li>Platinum (2.00x): Earns 2× the base points</li>
                                </ul>
                              </li>
                              <li><span className="font-medium">Example Calculation:</span> If earning rate is $50 per point and a guest in Silver tier (1.25x) spends $500:
                                <ul className="list-disc ml-6 mt-1 space-y-1">
                                  <li>Base points: $500 ÷ $50 = 10 points</li>
                                  <li>Silver tier: 10 × 1.25 = 12.50 points</li>
                                </ul>
                              </li>
                              <li><span className="font-medium">Rounding:</span> Points are rounded to 2 decimal places. Values ≤ .244 round down (e.g., 12.244 → 12.24), values ≥ .245 round up (e.g., 12.245 → 12.25).</li>
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="fixed bottom-6 right-6 flex gap-2">
          <Button variant="outline" onClick={() => setShowResetDialog(true)}>
            Reset to Defaults
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>

        {/* Reset Confirmation Dialog */}
        <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset to Default Settings?</AlertDialogTitle>
              <AlertDialogDescription>
                This action will reset all settings to their default values. All custom settings you have added and any modifications to default values will be permanently lost.
                <br />
                <span className="font-semibold text-red-600 block mt-2">This action cannot be undone.</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex gap-3 justify-end">
              <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleResetToDefaults} disabled={isSaving} className="bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {isSaving ? 'Resetting...' : 'Reset'}
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Tier Confirmation Dialog */}
        <AlertDialog open={deletingTierIdx !== null} onOpenChange={(open) => !open && setDeletingTierIdx(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Loyalty Tier?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the <span className="font-semibold">{deletingTierIdx !== null && settings.loyaltyTiers?.[deletingTierIdx]?.name}</span> tier?
                <br />
                <span className="text-red-600 block mt-2">This action cannot be undone.</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex gap-3 justify-end">
              <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => {
                  if (deletingTierIdx !== null) {
                    const newTiers = settings.loyaltyTiers.filter((_, i) => i !== deletingTierIdx);
                    handleChange('loyaltyTiers', newTiers);
                    setDeletingTierIdx(null);
                  }
                }} 
                disabled={isSaving} 
                className="bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Custom Field Confirmation Dialog */}
        <AlertDialog open={deletingFieldIdx !== null} onOpenChange={(open) => !open && setDeletingFieldIdx(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Custom Field?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the <span className="font-semibold">{deletingFieldIdx !== null && settings.customFields?.[deletingFieldIdx]?.name}</span> field?
                <br />
                <span className="text-red-600 block mt-2">This action cannot be undone.</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex gap-3 justify-end">
              <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => {
                  if (deletingFieldIdx !== null) {
                    const newFields = settings.customFields.filter((_, i) => i !== deletingFieldIdx);
                    handleChange('customFields', newFields);
                    setDeletingFieldIdx(null);
                  }
                }} 
                disabled={isSaving} 
                className="bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
