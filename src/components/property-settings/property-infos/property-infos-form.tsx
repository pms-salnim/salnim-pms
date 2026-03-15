'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertCircle, HelpCircle, Settings, ChevronRight, Upload, X } from 'lucide-react';
import { Country, State, City } from 'country-state-city';
import { uploadFile, deleteFile } from '@/lib/uploadHelper';
import { useAuth } from '@/contexts/auth-context';

interface PropertyInfosData {
  // Core Information
  propertyName: string;
  propertyType: string;
  starRating: number;
  description: string;
  tagline: string;
  yearEstablished: number;
  logoUrl?: string;

  // Legal & Business Details
  jurisdiction: 'europe' | 'morocco' | 'usa';
  legalBusinessName: string;
  
  // Europe specific
  europeanCompanyRegNumber?: string;
  europeanVATNumber?: string;
  europeanTradeRegEntry?: string;
  europeanChamberRegistration?: string;
  europeanTaxRegistration?: string;
  
  // Morocco specific
  moroccanLegalCompanyForm?: string;
  moroccanICE?: string;
  moroccanRC?: string;
  moroccanIF?: string;
  moroccanCNSS?: string;
  moroccanPatentNumber?: string;
  
  // USA specific
  usaEIN?: string;
  usaStateLicenseNumber?: string;
  usaSecretaryOfStateNumber?: string;
  usaFederalTaxID?: string;

  // Property Specifications
  totalRooms: number;
  maxGuestCapacity: number;
  propertySizeSquareFeet: number;
  numberFloors: number;
  numberBuildings: number;
  propertyStyle: string;

  // Property Location
  streetAddress: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
  googleMapsLink: string;
}

interface PropertyInfosFormProps {
  initialData?: Partial<PropertyInfosData>;
  onSave?: (data: PropertyInfosData) => Promise<void>;
  isLoading?: boolean;
  sizeMetric?: 'sqft' | 'sqm' | 'hectare';
}

const defaultPropertyInfos: PropertyInfosData = {
  // Core Information
  propertyName: '',
  propertyType: 'Hotel',
  starRating: 3,
  description: '',
  tagline: '',
  yearEstablished: new Date().getFullYear(),
  logoUrl: '',

  // Legal & Business Details
  jurisdiction: 'europe',
  legalBusinessName: '',
  
  // Europe specific
  europeanCompanyRegNumber: '',
  europeanVATNumber: '',
  europeanTradeRegEntry: '',
  europeanChamberRegistration: '',
  europeanTaxRegistration: '',
  
  // Morocco specific
  moroccanLegalCompanyForm: 'Limited Liability Company (SARL)',
  moroccanICE: '',
  moroccanRC: '',
  moroccanIF: '',
  moroccanCNSS: '',
  moroccanPatentNumber: '',
  
  // USA specific
  usaEIN: '',
  usaStateLicenseNumber: '',
  usaSecretaryOfStateNumber: '',
  usaFederalTaxID: '',

  // Property Specifications
  totalRooms: 0,
  maxGuestCapacity: 0,
  propertySizeSquareFeet: 0,
  numberFloors: 1,
  numberBuildings: 1,
  propertyStyle: 'Modern',

  // Property Location
  streetAddress: '',
  city: '',
  stateProvince: '',
  postalCode: '',
  country: '',
  googleMapsLink: '',
};

const propertyTypes = [
  'Hotel',
  'Boutique Hotel',
  'Resort',
  'Bed & Breakfast',
  'Hostel',
  'Vacation Rental',
  'Motel',
  'Inn',
  'Apartment',
  'Villa',
];

const propertyStyles = [
  'Modern',
  'Contemporary',
  'Traditional',
  'Boutique',
  'Luxury',
  'Budget',
  'Business',
  'Resort',
  'Colonial',
  'Minimalist',
];

const SizeMetricTooltip = () => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      className="relative inline-block align-middle"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {/* The Question Mark Trigger */}
      <div className="cursor-help text-slate-400 hover:text-primary transition-colors">
        <HelpCircle size={16} />
      </div>

      {/* The Tooltip Card */}
      {isVisible && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 w-64 p-4 bg-white rounded-md shadow-xl border border-slate-200 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-primary font-semibold text-sm">
              <Settings size={14} />
              <span>Unit Preferences</span>
            </div>
            <p className="text-slate-600 text-sm leading-relaxed">
              This metric is currently set to your property default. You can switch between <strong>Square Feet</strong>, <strong>Square Meters</strong>, and <strong>Hectares</strong> at any time.
            </p>
            <div className="mt-2 pt-2 border-t border-slate-100">
              <a
                href="/property-settings/system/preferences"
                className="flex items-center justify-between w-full text-xs font-medium text-slate-500 hover:text-primary transition-colors group"
              >
                Go to System Preferences
                <ChevronRight size={12} className="group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export function PropertyInfosForm({
  initialData,
  onSave,
  isLoading = false,
  sizeMetric = 'sqft',
}: PropertyInfosFormProps) {
  const { property } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [oldLogoUrl, setOldLogoUrl] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<PropertyInfosData>(() => ({
    ...defaultPropertyInfos,
    ...(initialData || {}),
  }));

  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({
    type: null,
    message: '',
  });
  const [hasChanges, setHasChanges] = useState(false);

  // Location dropdowns state
  const [countries, setCountries] = useState<any[]>([]);
  const [states, setStates] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [isCustomCityMode, setIsCustomCityMode] = useState(false);

  // Load all countries on component mount
  useEffect(() => {
    try {
      const allCountries = Country.getAllCountries();
      setCountries(allCountries);
      setLoadingCountries(false);
    } catch (error) {
      console.error('Error loading countries:', error);
      setLoadingCountries(false);
    }
  }, []);

  // Load states when country changes
  useEffect(() => {
    if (!formData.country) {
      setStates([]);
      setCities([]);
      return;
    }

    setLoadingStates(true);
    try {
      // Find the country object by name
      const selectedCountry = countries.find((c) => c.name === formData.country);
      if (selectedCountry) {
        let countryStates = State.getStatesOfCountry(selectedCountry.isoCode);
        
        // Filter states to only show those with available cities
        if (countryStates && countryStates.length > 0) {
          countryStates = countryStates.filter((state) => {
            const stateCities = City.getCitiesOfState(selectedCountry.isoCode, state.isoCode);
            return stateCities && stateCities.length > 0;
          });
        }
        
        setStates(countryStates || []);
        // Reset state and cities when country changes
        if (formData.stateProvince) {
          handleChange('stateProvince', '');
        }
        setCities([]);
        setIsCustomCityMode(false);
        // Clear city when country changes
        if (formData.city) {
          handleChange('city', '');
        }
      }
    } catch (error) {
      console.error('Error loading states:', error);
      setStates([]);
    }
    setLoadingStates(false);
  }, [formData.country, countries]);

  // Load cities when state changes
  useEffect(() => {
    if (!formData.country || !formData.stateProvince) {
      setCities([]);
      return;
    }

    setLoadingCities(true);
    try {
      // Find the country object by name
      const selectedCountry = countries.find((c) => c.name === formData.country);
      if (selectedCountry) {
        const stateCities = City.getCitiesOfState(selectedCountry.isoCode, formData.stateProvince);
        setCities(stateCities || []);
      }
    } catch (error) {
      console.error('Error loading cities:', error);
      setCities([]);
    }
    setLoadingCities(false);
  }, [formData.country, formData.stateProvince, countries]);

  const getSizeUnit = () => {
    switch (sizeMetric) {
      case 'sqft':
        return 'ft²';
      case 'sqm':
        return 'm²';
      case 'hectare':
        return 'ha';
      default:
        return 'ft²';
    }
  };

  const getSizeMetricLabel = () => {
    switch (sizeMetric) {
      case 'sqft':
        return 'Square Feet (ft²)';
      case 'sqm':
        return 'Square Meters (m²)';
      case 'hectare':
        return 'Hectares (ha)';
      default:
        return 'Square Feet (ft²)';
    }
  };

  const originalData = {
    ...defaultPropertyInfos,
    ...(initialData || {}),
  };

  const handleChange = (field: keyof PropertyInfosData, value: any) => {
    const newData = {
      ...formData,
      [field]: value,
    };
    setFormData(newData);
    setHasChanges(JSON.stringify(newData) !== JSON.stringify(originalData));
  };

  const handleSave = async () => {
    if (!onSave) {
      console.log('No onSave handler provided');
      return;
    }

    setIsSaving(true);
    setSaveStatus({ type: null, message: '' });

    try {
      await onSave(formData);
      setSaveStatus({
        type: 'success',
        message: 'Property information saved successfully!',
      });
      setHasChanges(false);
    } catch (error) {
      setSaveStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to save property information',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setFormData(originalData);
    setHasChanges(false);
    setSaveStatus({ type: null, message: '' });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !property?.id) return;

    setIsUploadingLogo(true);
    try {
      // Store old logo URL for potential deletion
      if (formData.logoUrl) {
        setOldLogoUrl(formData.logoUrl);
      }

      // Upload new logo
      const downloadUrl = await uploadFile(`properties/${property.id}/logo`, file);
      
      // Update form data with new logo URL
      handleChange('logoUrl', downloadUrl);
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error uploading logo:', error);
      setSaveStatus({
        type: 'error',
        message: 'Failed to upload logo. Please try again.',
      });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!formData.logoUrl) return;

    try {
      // Delete from Firebase Storage
      await deleteFile(formData.logoUrl);
      
      // Update form data
      handleChange('logoUrl', '');
    } catch (error) {
      console.error('Error removing logo:', error);
      setSaveStatus({
        type: 'error',
        message: 'Failed to remove logo. Please try again.',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Messages */}
      {saveStatus.type && (
        <div
          className={`flex items-center gap-3 p-4 rounded-lg ${
            saveStatus.type === 'success'
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          {saveStatus.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          )}
          <span
            className={
              saveStatus.type === 'success' ? 'text-green-800' : 'text-red-800'
            }
          >
            {saveStatus.message}
          </span>
        </div>
      )}

      {/* Core Information Container */}
      <div className="bg-white rounded-lg p-6 md:p-8">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          📋 Core Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Property Name */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Property Name *
            </label>
            <input
              type="text"
              value={formData.propertyName}
              onChange={(e) => handleChange('propertyName', e.target.value)}
              placeholder="e.g., Grand Hotel"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Property Type */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Property Type
            </label>
            <select
              value={formData.propertyType}
              onChange={(e) => handleChange('propertyType', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {propertyTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* Star Rating */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Star Rating
            </label>
            <select
              value={formData.starRating}
              onChange={(e) =>
                handleChange('starRating', parseInt(e.target.value))
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[1, 2, 3, 4, 5].map((star) => (
                <option key={star} value={star}>
                  {star} Star{star !== 1 ? 's' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Year Established */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Year Established
            </label>
            <input
              type="number"
              value={formData.yearEstablished || ''}
              onChange={(e) =>
                handleChange('yearEstablished', e.target.value ? parseInt(e.target.value) : 0)
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Tagline */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Tagline / Slogan
            </label>
            <input
              type="text"
              value={formData.tagline}
              onChange={(e) => handleChange('tagline', e.target.value)}
              placeholder="e.g., Experience Luxury Hospitality"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Description */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Describe your property, its features, and what makes it special..."
              rows={4}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Logo Upload */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-900 mb-3">
              Property Logo / Brand Image
            </label>
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={isUploadingLogo}
                    className="hidden"
                  />
                  <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-700">
                    {isUploadingLogo ? 'Uploading...' : 'Click to upload logo'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">PNG, JPG, GIF up to 5MB</p>
                </div>
              </div>

              {/* Logo Preview */}
              {formData.logoUrl && (
                <div className="w-32 h-32 flex-shrink-0">
                  <div className="relative w-full h-full border border-slate-300 rounded-lg overflow-hidden bg-slate-50 flex items-center justify-center">
                    <img
                      src={formData.logoUrl}
                      alt="Property Logo"
                      className="max-w-full max-h-full object-contain p-2"
                    />
                    <button
                      onClick={handleRemoveLogo}
                      disabled={isUploadingLogo}
                      className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white p-1 rounded transition-colors"
                      title="Remove logo"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Property Specifications Container */}
      <div className="bg-white rounded-lg p-6 md:p-8">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          🏢 Property Specifications
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Total Rooms */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Total Number of Rooms
            </label>
            <input
              type="number"
              value={formData.totalRooms || ''}
              onChange={(e) =>
                handleChange('totalRooms', e.target.value ? parseInt(e.target.value) : 0)
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="0"
            />
          </div>

          {/* Max Guest Capacity */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Maximum Guest Capacity
            </label>
            <input
              type="number"
              value={formData.maxGuestCapacity || ''}
              onChange={(e) =>
                handleChange('maxGuestCapacity', e.target.value ? parseInt(e.target.value) : 0)
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="0"
            />
          </div>

          {/* Property Size */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="block text-sm font-medium text-slate-900">
                Property Size ({getSizeUnit()})
              </label>
              <SizeMetricTooltip />
            </div>
            <input
              type="number"
              value={formData.propertySizeSquareFeet || ''}
              onChange={(e) =>
                handleChange(
                  'propertySizeSquareFeet',
                  e.target.value ? parseInt(e.target.value) : 0
                )
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="0"
            />
            <p className="text-xs text-slate-500 mt-1">{getSizeMetricLabel()}</p>
          </div>

          {/* Number of Floors */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Number of Floors
            </label>
            <input
              type="number"
              value={formData.numberFloors || ''}
              onChange={(e) =>
                handleChange('numberFloors', e.target.value ? parseInt(e.target.value) : 1)
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="1"
            />
          </div>

          {/* Number of Buildings */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Number of Buildings
            </label>
            <input
              type="number"
              value={formData.numberBuildings || ''}
              onChange={(e) =>
                handleChange('numberBuildings', e.target.value ? parseInt(e.target.value) : 1)
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="1"
            />
          </div>

          {/* Property Style */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Property Style
            </label>
            <select
              value={formData.propertyStyle}
              onChange={(e) => handleChange('propertyStyle', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {propertyStyles.map((style) => (
                <option key={style} value={style}>
                  {style}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Legal & Business Details Container */}
      <div className="bg-white rounded-lg p-6 md:p-8">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          ⚖️ Legal & Business Details
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Legal Business Name */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Legal Business Name
            </label>
            <input
              type="text"
              value={formData.legalBusinessName}
              onChange={(e) =>
                handleChange('legalBusinessName', e.target.value)
              }
              placeholder="Official registered business name"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Jurisdiction Dropdown */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Jurisdiction / Country of Creation
            </label>
            <select
              value={formData.jurisdiction}
              onChange={(e) =>
                handleChange(
                  'jurisdiction',
                  e.target.value as 'europe' | 'morocco' | 'usa'
                )
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="europe">🇪🇺 Europe</option>
              <option value="morocco">🇲🇦 Morocco</option>
              <option value="usa">🇺🇸 USA</option>
            </select>
          </div>

          {/* Europe Specific Fields */}
          {formData.jurisdiction === 'europe' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Company Registration Number
                </label>
                <input
                  type="text"
                  value={formData.europeanCompanyRegNumber || ''}
                  onChange={(e) =>
                    handleChange('europeanCompanyRegNumber', e.target.value)
                  }
                  placeholder="e.g., CR-123456"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  VAT Number
                </label>
                <input
                  type="text"
                  value={formData.europeanVATNumber || ''}
                  onChange={(e) =>
                    handleChange('europeanVATNumber', e.target.value)
                  }
                  placeholder="e.g., VAT-123456"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Trade Register Entry
                </label>
                <input
                  type="text"
                  value={formData.europeanTradeRegEntry || ''}
                  onChange={(e) =>
                    handleChange('europeanTradeRegEntry', e.target.value)
                  }
                  placeholder="e.g., HRB-789456"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Chamber of Commerce Registration
                </label>
                <input
                  type="text"
                  value={formData.europeanChamberRegistration || ''}
                  onChange={(e) =>
                    handleChange('europeanChamberRegistration', e.target.value)
                  }
                  placeholder="e.g., CCI-654321"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Tax Registration Number
                </label>
                <input
                  type="text"
                  value={formData.europeanTaxRegistration || ''}
                  onChange={(e) =>
                    handleChange('europeanTaxRegistration', e.target.value)
                  }
                  placeholder="e.g., TAX-987654"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          {/* Morocco Specific Fields */}
          {formData.jurisdiction === 'morocco' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Legal Company Form
                </label>
                <select
                  value={formData.moroccanLegalCompanyForm || ''}
                  onChange={(e) =>
                    handleChange('moroccanLegalCompanyForm', e.target.value)
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Sole Proprietorship">Sole Proprietorship</option>
                  <option value="Individual Business">Individual Business</option>
                  <option value="Limited Liability Company (SARL)">
                    Limited Liability Company (SARL)
                  </option>
                  <option value="Single-Member Limited Liability Company (SARLAU)">
                    Single-Member Limited Liability Company (SARLAU)
                  </option>
                  <option value="General Partnership">General Partnership</option>
                  <option value="Limited Partnership">Limited Partnership</option>
                  <option value="Limited Partnership with Shares">
                    Limited Partnership with Shares
                  </option>
                  <option value="Public Limited Company">
                    Public Limited Company
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  ICE (Common Enterprise Identifier)
                </label>
                <input
                  type="text"
                  value={formData.moroccanICE || ''}
                  onChange={(e) =>
                    handleChange('moroccanICE', e.target.value)
                  }
                  placeholder="e.g., ICE-123456789"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Commercial Register (RC)
                </label>
                <input
                  type="text"
                  value={formData.moroccanRC || ''}
                  onChange={(e) =>
                    handleChange('moroccanRC', e.target.value)
                  }
                  placeholder="e.g., RC-123456"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Tax Identification Number (IF)
                </label>
                <input
                  type="text"
                  value={formData.moroccanIF || ''}
                  onChange={(e) =>
                    handleChange('moroccanIF', e.target.value)
                  }
                  placeholder="e.g., IF-789456"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  CNSS Number
                </label>
                <input
                  type="text"
                  value={formData.moroccanCNSS || ''}
                  onChange={(e) =>
                    handleChange('moroccanCNSS', e.target.value)
                  }
                  placeholder="e.g., CNSS-654321"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Patent Number
                </label>
                <input
                  type="text"
                  value={formData.moroccanPatentNumber || ''}
                  onChange={(e) =>
                    handleChange('moroccanPatentNumber', e.target.value)
                  }
                  placeholder="e.g., PATENT-987654"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          {/* USA Specific Fields */}
          {formData.jurisdiction === 'usa' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Employer Identification Number (EIN)
                </label>
                <input
                  type="text"
                  value={formData.usaEIN || ''}
                  onChange={(e) => handleChange('usaEIN', e.target.value)}
                  placeholder="e.g., 12-3456789"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  State License Number
                </label>
                <input
                  type="text"
                  value={formData.usaStateLicenseNumber || ''}
                  onChange={(e) =>
                    handleChange('usaStateLicenseNumber', e.target.value)
                  }
                  placeholder="e.g., LICENSE-123456"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Secretary of State Registration Number
                </label>
                <input
                  type="text"
                  value={formData.usaSecretaryOfStateNumber || ''}
                  onChange={(e) =>
                    handleChange('usaSecretaryOfStateNumber', e.target.value)
                  }
                  placeholder="e.g., SOS-789456"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Federal Tax ID
                </label>
                <input
                  type="text"
                  value={formData.usaFederalTaxID || ''}
                  onChange={(e) =>
                    handleChange('usaFederalTaxID', e.target.value)
                  }
                  placeholder="e.g., FTID-654321"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Property Location Container */}
      <div className="bg-white rounded-lg p-6 md:p-8">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          📍 Property Location
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Street Address */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Street Address
            </label>
            <input
              type="text"
              value={formData.streetAddress}
              onChange={(e) => handleChange('streetAddress', e.target.value)}
              placeholder="123 Main Street"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* City */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              City
            </label>
            {formData.country === 'United States' ? (
              // For United States: show dropdown with custom option
              !isCustomCityMode ? (
                <select
                  value={formData.city}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setIsCustomCityMode(true);
                      handleChange('city', '');
                    } else {
                      handleChange('city', e.target.value);
                    }
                  }}
                  disabled={!formData.country || !formData.stateProvince || loadingCities}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
                >
                  <option value="">
                    {!formData.country
                      ? 'Select a country first'
                      : !formData.stateProvince
                        ? 'Select a state/province first'
                        : loadingCities
                          ? 'Loading cities...'
                          : cities && cities.length > 0
                            ? 'Select a city'
                            : 'No cities available - enter custom'}
                  </option>
                  {cities && cities.length > 0 && cities.map((city) => (
                    <option key={city.name} value={city.name}>
                      {city.name}
                    </option>
                  ))}
                  {formData.country && formData.stateProvince && !loadingCities && (
                    <option value="__custom__">+ Add Custom City</option>
                  )}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="Enter custom city name"
                  value={formData.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  onBlur={(e) => {
                    if (!e.target.value.trim()) {
                      setIsCustomCityMode(false);
                      handleChange('city', '');
                    }
                  }}
                  autoFocus
                  className="w-full px-3 py-2 border border-blue-500 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              )
            ) : (
              // For other countries: show simple text input
              <input
                type="text"
                value={formData.city}
                onChange={(e) => handleChange('city', e.target.value)}
                placeholder="City name"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>

          {/* State/Province - Only for United States */}
          {formData.country === 'United States' && (
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                State / Province
              </label>
              <select
                value={formData.stateProvince}
                onChange={(e) => handleChange('stateProvince', e.target.value)}
                disabled={!formData.country || loadingStates}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
              >
                <option value="">
                  {!formData.country ? 'Select a country first' : loadingStates ? 'Loading states...' : 'Select a state/province'}
                </option>
                {states.map((state) => (
                  <option key={state.isoCode} value={state.isoCode}>
                    {state.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Postal Code */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Postal / ZIP Code
            </label>
            <input
              type="text"
              value={formData.postalCode}
              onChange={(e) => handleChange('postalCode', e.target.value)}
              placeholder="10001"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Country */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Country
            </label>
            <select
              value={formData.country}
              onChange={(e) => handleChange('country', e.target.value)}
              disabled={loadingCountries}
              className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
            >
              <option value="">{loadingCountries ? 'Loading countries...' : 'Select a country'}</option>
              {countries.map((country) => (
                <option key={country.isoCode} value={country.name}>
                  {country.name}
                </option>
              ))}
            </select>
          </div>

          {/* Latitude */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Latitude
            </label>
            <input
              type="number"
              value={formData.latitude || ''}
              onChange={(e) => handleChange('latitude', e.target.value ? parseFloat(e.target.value) : 0)}
              placeholder="40.7128"
              step="0.0001"
              min="-90"
              max="90"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-500 mt-1">Click on the map to set coordinates</p>
          </div>

          {/* Longitude */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Longitude
            </label>
            <input
              type="number"
              value={formData.longitude || ''}
              onChange={(e) => handleChange('longitude', e.target.value ? parseFloat(e.target.value) : 0)}
              placeholder="-74.0060"
              step="0.0001"
              min="-180"
              max="180"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-500 mt-1">Click on the map to set coordinates</p>
          </div>
        </div>

        {/* Map Container */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-900 mb-2">
            Google Maps Link
          </label>
          <input
            type="url"
            value={formData.googleMapsLink || ''}
            onChange={(e) => handleChange('googleMapsLink', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., https://maps.google.com/maps?q=property+address or https://goo.gl/maps/..."
          />
          <p className="text-xs text-slate-500 mt-2">
            📍 Paste the Google Maps link or embed link for your property location
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-6 border-t border-slate-200">
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={!hasChanges || isSaving}
          className="min-w-[120px]"
        >
          Reset
        </Button>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || isSaving || isLoading}
          className="min-w-[120px]"
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
