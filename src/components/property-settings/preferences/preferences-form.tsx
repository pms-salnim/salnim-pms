'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';import { timeZoneOptions } from '@/types/property';import { AlertCircle, CheckCircle } from 'lucide-react';

interface PreferencesData {
  // Localization & Format
  applicationLanguage: string;
  propertyTimeZone: string;
  applicationCurrency: string;
  currencyFormat: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  sizeMetric: 'sqft' | 'sqm' | 'hectare';

  // Check-in/Check-out
  defaultCheckInTime: string;
  defaultCheckOutTime: string;
  earlyCheckInAllowed: boolean;
  earlyCheckInFee: number;
  lateCheckOutAllowed: boolean;
  lateCheckOutFee: number;
  gracePeriodHours: number;

  // Reservation & Availability
  allowOverbooking: boolean;
  autoNoShowAfterArrival: boolean;
  autoAssignRooms: boolean;
  allowSameDayBookings: boolean;
  sameDayCutoffTime: string;
  autoCheckoutExtension: boolean;
  useDefaultCountry: boolean;
  defaultCountry: string;

  // Calendar & Display
  showEstimatedArrivalTime: boolean;
  enableGDPRFeatures: boolean;
  enablePaymentAllocation: boolean;
  requireFullPaymentBeforeCheckin: boolean;
  showCheckoutsInDeparture: boolean;
  calendarNameFormat: 'firstLast' | 'lastFirst' | 'firstOnly';
  calendarWeekStart: 'sunday' | 'monday' | 'saturday';

  // Channel Distribution
  breakfastChannelDistribution: 'included' | 'extra' | 'variable';

  // Guest & Reservation Experience
  requireGuestIdUpload: boolean;
  allowGuestRoomSelection: boolean;
  guestCancellationWindow: number; // days
}

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'es', label: 'Español' },
  { value: 'de', label: 'Deutsch' },
  { value: 'it', label: 'Italiano' },
  { value: 'pt', label: 'Português' },
];



const CURRENCIES = [
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'JPY', label: 'JPY - Japanese Yen' },
  { value: 'AUD', label: 'AUD - Australian Dollar' },
  { value: 'CAD', label: 'CAD - Canadian Dollar' },
  { value: 'CHF', label: 'CHF - Swiss Franc' },
  { value: 'CNY', label: 'CNY - Chinese Yuan' },
  { value: 'INR', label: 'INR - Indian Rupee' },
  { value: 'AED', label: 'AED - UAE Dirham' },
];

const COUNTRIES = [
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'FR', label: 'France' },
  { value: 'DE', label: 'Germany' },
  { value: 'JP', label: 'Japan' },
  { value: 'AU', label: 'Australia' },
  { value: 'AE', label: 'United Arab Emirates' },
  { value: 'CA', label: 'Canada' },
  { value: 'IN', label: 'India' },
];

const SIZE_METRICS = [
  { value: 'sqft', label: 'Square Feet (ft²)' },
  { value: 'sqm', label: 'Square Meters (m²)' },
  { value: 'hectare', label: 'Hectare (ha)' },
];

interface PreferencesFormProps {
  onSave?: (data: PreferencesData) => Promise<void>;
  initialData?: Partial<PreferencesData>;
}

export function PreferencesForm({ onSave, initialData }: PreferencesFormProps) {
  const [formData, setFormData] = useState<PreferencesData>({
    applicationLanguage: 'en',
    propertyTimeZone: 'UTC',
    applicationCurrency: 'USD',
    currencyFormat: 'symbol',
    dateFormat: 'mm/dd/yyyy',
    timeFormat: '12h',
    sizeMetric: 'sqft',
    defaultCheckInTime: '15:00',
    defaultCheckOutTime: '11:00',
    earlyCheckInAllowed: false,
    earlyCheckInFee: 0,
    lateCheckOutAllowed: false,
    lateCheckOutFee: 0,
    gracePeriodHours: 0,
    allowOverbooking: false,
    autoNoShowAfterArrival: true,
    autoAssignRooms: false,
    allowSameDayBookings: true,
    sameDayCutoffTime: '14:00',
    autoCheckoutExtension: false,
    useDefaultCountry: true,
    defaultCountry: 'US',
    showEstimatedArrivalTime: true,
    enableGDPRFeatures: true,
    enablePaymentAllocation: true,
    requireFullPaymentBeforeCheckin: false,
    showCheckoutsInDeparture: false,
    calendarNameFormat: 'firstLast',
    calendarWeekStart: 'sunday',
    breakfastChannelDistribution: 'included',
    requireGuestIdUpload: false,
    allowGuestRoomSelection: false,
    guestCancellationWindow: 48,
    ...initialData,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [hasChanges, setHasChanges] = useState(false);

  const handleChange = (
    field: keyof PreferencesData,
    value: string | boolean | number
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    setHasChanges(true);
    setSaveStatus('idle');
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (onSave) {
        await onSave(formData);
      }
      setSaveStatus('success');
      setHasChanges(false);
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      setSaveStatus('error');
      console.error('Failed to save preferences:', error);
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Status Messages */}
      {saveStatus === 'success' && (
        <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          <CheckCircle className="w-5 h-5" />
          <span>Preferences saved successfully</span>
        </div>
      )}
      {saveStatus === 'error' && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="w-5 h-5" />
          <span>Failed to save preferences. Please try again.</span>
        </div>
      )}

      {/* 1. Localization & Format Preferences */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Localization & Format Preferences</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Application Language */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Application Language
            </label>
            <select
              value={formData.applicationLanguage}
              onChange={(e) => handleChange('applicationLanguage', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          {/* Property Time Zone */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Property Time Zone
            </label>
            <select
              value={formData.propertyTimeZone}
              onChange={(e) => handleChange('propertyTimeZone', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {timeZoneOptions.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>

          {/* Application Currency */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Application Currency
            </label>
            <select
              value={formData.applicationCurrency}
              onChange={(e) => handleChange('applicationCurrency', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {CURRENCIES.map((curr) => (
                <option key={curr.value} value={curr.value}>
                  {curr.label}
                </option>
              ))}
            </select>
          </div>

          {/* Currency Format */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Currency Format
            </label>
            <select
              value={formData.currencyFormat}
              onChange={(e) => handleChange('currencyFormat', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="symbol">Symbol ($1,234.56)</option>
              <option value="code">Code (1,234.56 USD)</option>
              <option value="name">Full Name (1,234.56 US Dollar)</option>
            </select>
          </div>

          {/* Date Format */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Date Format
            </label>
            <select
              value={formData.dateFormat}
              onChange={(e) => handleChange('dateFormat', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="dd/mm/yyyy">DD/MM/YYYY (01/02/2026)</option>
              <option value="mm/dd/yyyy">MM/DD/YYYY (02/01/2026)</option>
              <option value="yyyy-mm-dd">YYYY-MM-DD (2026-02-01)</option>
            </select>
          </div>

          {/* Time Format */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Time Format
            </label>
            <select
              value={formData.timeFormat}
              onChange={(e) => handleChange('timeFormat', e.target.value as '12h' | '24h')}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="12h">12-hour (2:30 PM)</option>
              <option value="24h">24-hour (14:30)</option>
            </select>
          </div>

          {/* Size Metric */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Size Metric
            </label>
            <select
              value={formData.sizeMetric}
              onChange={(e) => handleChange('sizeMetric', e.target.value as 'sqft' | 'sqm' | 'hectare')}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {SIZE_METRICS.map((metric) => (
                <option key={metric.value} value={metric.value}>
                  {metric.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <hr className="border-slate-200" />

      {/* 2. Check-in/Check-out */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">🕐 Check-in/Check-out</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Default Check-in Time */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Default Check-in Time
            </label>
            <input
              type="time"
              value={formData.defaultCheckInTime}
              onChange={(e) => handleChange('defaultCheckInTime', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Default Check-out Time */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Default Check-out Time
            </label>
            <input
              type="time"
              value={formData.defaultCheckOutTime}
              onChange={(e) => handleChange('defaultCheckOutTime', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Early Check-in Allowed */}
          <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
            <div>
              <label className="block text-sm font-medium text-slate-900">
                Allow Early Check-in
              </label>
              <p className="text-xs text-slate-600 mt-1">Enable guests to check in before default time</p>
            </div>
            <input
              type="checkbox"
              checked={formData.earlyCheckInAllowed}
              onChange={(e) => handleChange('earlyCheckInAllowed', e.target.checked)}
              className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
          </div>

          {/* Early Check-in Fee */}
          {formData.earlyCheckInAllowed && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Early Check-in Fee
              </label>
              <input
                type="number"
                value={formData.earlyCheckInFee}
                onChange={(e) => handleChange('earlyCheckInFee', parseFloat(e.target.value))}
                placeholder="0"
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          {/* Late Check-out Allowed */}
          <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
            <div>
              <label className="block text-sm font-medium text-slate-900">
                Allow Late Check-out
              </label>
              <p className="text-xs text-slate-600 mt-1">Enable guests to check out after default time</p>
            </div>
            <input
              type="checkbox"
              checked={formData.lateCheckOutAllowed}
              onChange={(e) => handleChange('lateCheckOutAllowed', e.target.checked)}
              className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
          </div>

          {/* Late Check-out Fee */}
          {formData.lateCheckOutAllowed && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Late Check-out Fee
              </label>
              <input
                type="number"
                value={formData.lateCheckOutFee}
                onChange={(e) => handleChange('lateCheckOutFee', parseFloat(e.target.value))}
                placeholder="0"
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          {/* Grace Period */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Grace Period Before Charging (hours)
            </label>
            <input
              type="number"
              value={formData.gracePeriodHours}
              onChange={(e) => handleChange('gracePeriodHours', parseInt(e.target.value))}
              placeholder="0"
              min="0"
              step="1"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-slate-500 mt-1">Hours to wait before charging late check-out fees</p>
          </div>
        </div>
      </section>

      <hr className="border-slate-200" />

      {/* 2. Reservation & Availability Preferences */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Reservation & Availability Preferences</h2>
        
        <div className="space-y-4">
          {/* Allow Overbooking */}
          <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
            <div>
              <label className="block text-sm font-medium text-slate-900">
                Allow additional bookings when property is full
              </label>
              <p className="text-xs text-slate-600 mt-1">Overrides strict occupancy if other room types available</p>
            </div>
            <input
              type="checkbox"
              checked={formData.allowOverbooking}
              onChange={(e) => handleChange('allowOverbooking', e.target.checked)}
              className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
          </div>

          {/* Auto No-Show */}
          <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
            <div>
              <label className="block text-sm font-medium text-slate-900">
                Auto-change status to No-Show
              </label>
              <p className="text-xs text-slate-600 mt-1">Automatically marks reservations as no-show after arrival date</p>
            </div>
            <input
              type="checkbox"
              checked={formData.autoNoShowAfterArrival}
              onChange={(e) => handleChange('autoNoShowAfterArrival', e.target.checked)}
              className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
          </div>

          {/* Auto Assign Rooms */}
          <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
            <div>
              <label className="block text-sm font-medium text-slate-900">
                Auto Assign Reservations
              </label>
              <p className="text-xs text-slate-600 mt-1">Automatically assigns rooms instead of requiring manual action</p>
            </div>
            <input
              type="checkbox"
              checked={formData.autoAssignRooms}
              onChange={(e) => handleChange('autoAssignRooms', e.target.checked)}
              className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
          </div>

          {/* Allow Same-Day Bookings */}
          <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
            <div>
              <label className="block text-sm font-medium text-slate-900">
                Allow same-day bookings
              </label>
              <p className="text-xs text-slate-600 mt-1">Shows same-day availability on booking channels</p>
            </div>
            <input
              type="checkbox"
              checked={formData.allowSameDayBookings}
              onChange={(e) => handleChange('allowSameDayBookings', e.target.checked)}
              className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
          </div>

          {/* Same-Day Cutoff Time */}
          {formData.allowSameDayBookings && (
            <div className="md:col-span-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Same-day cutoff time
              </label>
              <input
                type="time"
                value={formData.sameDayCutoffTime}
                onChange={(e) => handleChange('sameDayCutoffTime', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-slate-600 mt-2">Time after which same-day bookings are blocked</p>
            </div>
          )}

          {/* Auto Checkout Extension */}
          <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
            <div>
              <label className="block text-sm font-medium text-slate-900">
                Auto-checkout date extension
              </label>
              <p className="text-xs text-slate-600 mt-1">Automatically extends checkout if guest hasn't left</p>
            </div>
            <input
              type="checkbox"
              checked={formData.autoCheckoutExtension}
              onChange={(e) => handleChange('autoCheckoutExtension', e.target.checked)}
              className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
          </div>

          {/* Use Default Country */}
          <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
            <div>
              <label className="block text-sm font-medium text-slate-900">
                Use default country for guest
              </label>
              <p className="text-xs text-slate-600 mt-1">Autofills guest country during reservation creation</p>
            </div>
            <input
              type="checkbox"
              checked={formData.useDefaultCountry}
              onChange={(e) => handleChange('useDefaultCountry', e.target.checked)}
              className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
          </div>

          {/* Default Country */}
          {formData.useDefaultCountry && (
            <div className="md:col-span-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Default country
              </label>
              <select
                value={formData.defaultCountry}
                onChange={(e) => handleChange('defaultCountry', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {COUNTRIES.map((country) => (
                  <option key={country.value} value={country.value}>
                    {country.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </section>

      <hr className="border-slate-200" />

      {/* 3. Calendar & Display Preferences */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Calendar & Display Preferences</h2>
        
        <div className="space-y-4">
          {/* Show Estimated Arrival Time */}
          <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
            <div>
              <label className="block text-sm font-medium text-slate-900">
                Show Estimated Arrival Time
              </label>
              <p className="text-xs text-slate-600 mt-1">Shows arrival time field in relevant screens</p>
            </div>
            <input
              type="checkbox"
              checked={formData.showEstimatedArrivalTime}
              onChange={(e) => handleChange('showEstimatedArrivalTime', e.target.checked)}
              className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
          </div>

          {/* GDPR Features */}
          <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
            <div>
              <label className="block text-sm font-medium text-slate-900">
                Enable GDPR features
              </label>
              <p className="text-xs text-slate-600 mt-1">Activates anonymization and compliance tools</p>
            </div>
            <input
              type="checkbox"
              checked={formData.enableGDPRFeatures}
              onChange={(e) => handleChange('enableGDPRFeatures', e.target.checked)}
              className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
          </div>

          {/* Payment Allocation */}
          <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
            <div>
              <label className="block text-sm font-medium text-slate-900">
                Enable Payment Allocation
              </label>
              <p className="text-xs text-slate-600 mt-1">Lets users apply payments to specific charges</p>
            </div>
            <input
              type="checkbox"
              checked={formData.enablePaymentAllocation}
              onChange={(e) => handleChange('enablePaymentAllocation', e.target.checked)}
              className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
          </div>

          {/* Require Full Payment */}
          <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
            <div>
              <label className="block text-sm font-medium text-slate-900">
                Require full payment before check-in
              </label>
              <p className="text-xs text-slate-600 mt-1">Blocks check-in until reservation is fully paid</p>
            </div>
            <input
              type="checkbox"
              checked={formData.requireFullPaymentBeforeCheckin}
              onChange={(e) => handleChange('requireFullPaymentBeforeCheckin', e.target.checked)}
              className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
          </div>

          {/* Show Checkouts in Departure */}
          <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
            <div>
              <label className="block text-sm font-medium text-slate-900">
                Show check-outs in departure list
              </label>
              <p className="text-xs text-slate-600 mt-1">Includes guests who already checked out on the dashboard</p>
            </div>
            <input
              type="checkbox"
              checked={formData.showCheckoutsInDeparture}
              onChange={(e) => handleChange('showCheckoutsInDeparture', e.target.checked)}
              className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
          </div>

          {/* Calendar Name Format */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Format for customer names in calendar
            </label>
            <select
              value={formData.calendarNameFormat}
              onChange={(e) => handleChange('calendarNameFormat', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="firstLast">First Name Last Name</option>
              <option value="lastFirst">Last Name, First Name</option>
              <option value="firstOnly">First Name Only</option>
            </select>
          </div>

          {/* Calendar Week Start */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Calendar week start day
            </label>
            <select
              value={formData.calendarWeekStart}
              onChange={(e) => handleChange('calendarWeekStart', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="sunday">Sunday</option>
              <option value="monday">Monday</option>
              <option value="saturday">Saturday</option>
            </select>
          </div>
        </div>
      </section>

      <hr className="border-slate-200" />

      {/* 4. Channel & Rate Distribution */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Channel & Rate Distribution Preferences</h2>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Breakfast (Channel Distribution)
          </label>
          <select
            value={formData.breakfastChannelDistribution}
            onChange={(e) => handleChange('breakfastChannelDistribution', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="included">Breakfast Included</option>
            <option value="extra">Breakfast Extra (Optional)</option>
            <option value="variable">Variable (Different by Rate Plan)</option>
          </select>
          <p className="text-xs text-slate-600 mt-2">How breakfast is reported to OTA channels</p>
        </div>
      </section>

      <hr className="border-slate-200" />

      {/* 5. Guest & Reservation Experience */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Guest & Reservation Experience</h2>
        <p className="text-sm text-slate-600">Customize how guests interact with your property.</p>
        
        <div className="space-y-4">
          {/* Require Guest ID Upload */}
          <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
            <div>
              <label className="block text-sm font-medium text-slate-900">
                Require guest ID/passport upload before check-in
              </label>
              <p className="text-xs text-slate-600 mt-1">Enforces identification verification</p>
            </div>
            <input
              type="checkbox"
              checked={formData.requireGuestIdUpload}
              onChange={(e) => handleChange('requireGuestIdUpload', e.target.checked)}
              className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
          </div>

          {/* Allow Guest Room Selection */}
          <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
            <div>
              <label className="block text-sm font-medium text-slate-900">
                Allow guest to select room type
              </label>
              <p className="text-xs text-slate-600 mt-1">Guest chooses room vs. pre-assigned</p>
            </div>
            <input
              type="checkbox"
              checked={formData.allowGuestRoomSelection}
              onChange={(e) => handleChange('allowGuestRoomSelection', e.target.checked)}
              className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
          </div>

          {/* Guest Cancellation Window */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Guest cancellation window
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="365"
                value={formData.guestCancellationWindow}
                onChange={(e) => handleChange('guestCancellationWindow', parseInt(e.target.value))}
                className="w-20 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <span className="text-sm text-slate-600">days in advance to allow cancellations</span>
            </div>
          </div>
        </div>
      </section>

      <hr className="border-slate-200" />

      {/* Save Button */}
      <div className="flex justify-end gap-3 pt-6">
        <Button
          variant="outline"
          onClick={() => {
            setFormData({
              applicationLanguage: 'en',
              propertyTimeZone: 'UTC',
              applicationCurrency: 'USD',
              currencyFormat: 'symbol',
              dateFormat: 'mm/dd/yyyy',
              timeFormat: '12h',
              sizeMetric: 'sqft',
              defaultCheckInTime: '15:00',
              defaultCheckOutTime: '11:00',
              earlyCheckInAllowed: false,
              earlyCheckInFee: 0,
              lateCheckOutAllowed: false,
              lateCheckOutFee: 0,
              gracePeriodHours: 0,
              allowOverbooking: false,
              autoNoShowAfterArrival: true,
              autoAssignRooms: false,
              allowSameDayBookings: true,
              sameDayCutoffTime: '14:00',
              autoCheckoutExtension: false,
              useDefaultCountry: true,
              defaultCountry: 'US',
              showEstimatedArrivalTime: true,
              enableGDPRFeatures: true,
              enablePaymentAllocation: true,
              requireFullPaymentBeforeCheckin: false,
              showCheckoutsInDeparture: false,
              calendarNameFormat: 'firstLast',
              calendarWeekStart: 'sunday',
              breakfastChannelDistribution: 'included',
              requireGuestIdUpload: false,
              allowGuestRoomSelection: false,
              guestCancellationWindow: 48,
              ...initialData,
            });
            setHasChanges(false);
          }}
          disabled={!hasChanges || isSaving}
        >
          Reset
        </Button>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isSaving ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>
    </div>
  );
}
