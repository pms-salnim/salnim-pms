'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertCircle, Plus, X, ChevronDown } from 'lucide-react';
import { timeZoneOptions } from '@/types/property';

interface DepartmentContact {
  id: string; // auto-generated: [department_name_email] or [department_name_phone]
  departmentName: string;
  type: 'email' | 'phone';
  value: string;
}

interface ContactData {
  // Primary Property Contact
  primaryEmail: string;
  primaryPhone: string;
  landlineNumber: string;
  websiteUrl: string;

  // Communication Preferences
  preferredContactMethod: 'phone' | 'email' | 'both';
  officeHoursOpen: string; // HH:MM format
  officeHoursClose: string; // HH:MM format
  timeZone: string;
  languagesAvailable: string; // comma-separated

  // Department Contacts (dynamic)
  departmentContacts: DepartmentContact[];

  // Digital Channels
  whatsappNumber: string;
  facebookUrl: string;
  instagramUrl: string;
  twitterUrl: string;
  linkedinUrl: string;
  youtubeUrl: string;

  // Guest Accessibility
  showContactToGuests: boolean;
  enableGuestContactForm: boolean;
  directBookingContact: boolean;
  emergencyContact24_7: boolean;
}

interface ContactFormProps {
  initialData?: Partial<ContactData>;
  onSave?: (data: ContactData) => Promise<void>;
  isLoading?: boolean;
}

const defaultContactData: ContactData = {
  primaryEmail: '',
  primaryPhone: '',
  landlineNumber: '',
  websiteUrl: '',
  preferredContactMethod: 'email',
  officeHoursOpen: '09:00',
  officeHoursClose: '18:00',
  timeZone: 'UTC',
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

const countries = [
  'United States',
  'United Kingdom',
  'Canada',
  'Australia',
  'France',
  'Germany',
  'Spain',
  'Italy',
  'Japan',
  'China',
  'India',
  'United Arab Emirates',
  'Morocco',
  'Mexico',
  'Brazil',
];

// Helper function to generate ID from department name and type
const generateContactId = (name: string, type: 'email' | 'phone'): string => {
  const suffix = type === 'email' ? 'email' : 'phone';
  return `${name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')}_${suffix}`;
};



export function ContactForm({ onSave, initialData, isLoading = false }: ContactFormProps) {
  const [formData, setFormData] = useState<ContactData>(() => ({
    ...defaultContactData,
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
  
  // Department Contact Form State
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactFormType, setContactFormType] = useState<'email' | 'phone' | null>(null);
  const [contactFormData, setContactFormData] = useState({
    departmentName: '',
    value: '',
  });
  const [showDropdown, setShowDropdown] = useState(false);

  const originalData = {
    ...defaultContactData,
    ...(initialData || {}),
  };

  const handleChange = (field: keyof ContactData, value: any) => {
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
    try {
      await onSave(formData);
      setSaveStatus({
        type: 'success',
        message: 'Contact information saved successfully',
      });
      setHasChanges(false);
      setTimeout(() => setSaveStatus({ type: null, message: '' }), 3000);
    } catch (error) {
      setSaveStatus({
        type: 'error',
        message: 'Failed to save contact information. Please try again.',
      });
      setTimeout(() => setSaveStatus({ type: null, message: '' }), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setFormData(originalData);
    setHasChanges(false);
    setSaveStatus({ type: null, message: '' });
  };

  const openAddContactForm = (type: 'email' | 'phone') => {
    setContactFormType(type);
    setContactFormData({ departmentName: '', value: '' });
    setShowContactForm(true);
    setShowDropdown(false);
  };

  const handleSaveContact = () => {
    if (!contactFormData.departmentName.trim()) {
      setSaveStatus({
        type: 'error',
        message: 'Department name is required',
      });
      setTimeout(() => setSaveStatus({ type: null, message: '' }), 2000);
      return;
    }

    if (!contactFormData.value.trim()) {
      setSaveStatus({
        type: 'error',
        message: `${contactFormType === 'email' ? 'Email' : 'Phone'} is required`,
      });
      setTimeout(() => setSaveStatus({ type: null, message: '' }), 2000);
      return;
    }

    const newContact: DepartmentContact = {
      id: generateContactId(contactFormData.departmentName, contactFormType!),
      departmentName: contactFormData.departmentName,
      type: contactFormType!,
      value: contactFormData.value,
    };

    handleChange('departmentContacts', [
      ...(formData.departmentContacts || []),
      newContact,
    ]);

    setSaveStatus({
      type: 'success',
      message: `Contact added successfully`,
    });
    setTimeout(() => setSaveStatus({ type: null, message: '' }), 2000);

    // Reset and close form
    setContactFormData({ departmentName: '', value: '' });
    setShowContactForm(false);
    setContactFormType(null);
  };

  const removeContact = (index: number) => {
    const updatedContacts = formData.departmentContacts?.filter(
      (_, i) => i !== index
    ) || [];
    handleChange('departmentContacts', updatedContacts);
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

      {/* Primary Property Contact Container */}
      <div className="bg-white rounded-lg p-6 md:p-8">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          📞 Primary Property Contact
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Primary Email */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Primary Email
            </label>
            <input
              type="email"
              value={formData.primaryEmail}
              onChange={(e) => handleChange('primaryEmail', e.target.value)}
              placeholder="contact@property.com"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Primary Phone */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Primary Phone
            </label>
            <input
              type="tel"
              value={formData.primaryPhone}
              onChange={(e) => handleChange('primaryPhone', e.target.value)}
              placeholder="+1 (555) 000-0000"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Landline Number */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Landline Number
            </label>
            <input
              type="tel"
              value={formData.landlineNumber}
              onChange={(e) => handleChange('landlineNumber', e.target.value)}
              placeholder="+1 (555) 000-0000"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Website URL */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Website URL
            </label>
            <input
              type="url"
              value={formData.websiteUrl}
              onChange={(e) => handleChange('websiteUrl', e.target.value)}
              placeholder="https://www.property.com"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Communication Preferences Container */}
      <div className="bg-white rounded-lg p-6 md:p-8">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          💬 Communication Preferences
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Preferred Contact Method */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Preferred Contact Method
            </label>
            <select
              value={formData.preferredContactMethod}
              onChange={(e) =>
                handleChange(
                  'preferredContactMethod',
                  e.target.value as 'phone' | 'email' | 'both'
                )
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="phone">Phone</option>
              <option value="email">Email</option>
              <option value="both">Both</option>
            </select>
          </div>

          {/* Time Zone */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Time Zone
            </label>
            <select
              value={formData.timeZone}
              onChange={(e) => handleChange('timeZone', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {timeZoneOptions.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>

          {/* Office Hours Open */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Office Hours - Opening
            </label>
            <input
              type="time"
              value={formData.officeHoursOpen}
              onChange={(e) => handleChange('officeHoursOpen', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Office Hours Close */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Office Hours - Closing
            </label>
            <input
              type="time"
              value={formData.officeHoursClose}
              onChange={(e) => handleChange('officeHoursClose', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Languages Available */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Languages Available (comma-separated)
            </label>
            <input
              type="text"
              value={formData.languagesAvailable}
              onChange={(e) => handleChange('languagesAvailable', e.target.value)}
              placeholder="English, Spanish, French"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Department Contacts Container */}
      <div className="bg-white rounded-lg p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-900">
            🏢 Department Contacts
          </h2>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Contact
              <ChevronDown className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-300 rounded-md shadow-lg z-10">
                <button
                  type="button"
                  onClick={() => openAddContactForm('email')}
                  className="w-full text-left px-4 py-2 hover:bg-slate-100 text-slate-900 first:rounded-t-md"
                >
                  Add Email
                </button>
                <button
                  type="button"
                  onClick={() => openAddContactForm('phone')}
                  className="w-full text-left px-4 py-2 hover:bg-slate-100 text-slate-900 last:rounded-b-md border-t border-slate-200"
                >
                  Add Phone
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Contact Form */}
        {showContactForm && contactFormType && (
          <div className="mb-6 p-4 border border-blue-200 bg-blue-50 rounded-lg space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Department Name */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Department Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={contactFormData.departmentName}
                  onChange={(e) => setContactFormData({ ...contactFormData, departmentName: e.target.value })}
                  placeholder="e.g., Front Desk, Concierge, Housekeeping"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Email/Phone Field */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  {contactFormType === 'email' ? 'Email' : 'Phone'} <span className="text-red-500">*</span>
                </label>
                <input
                  type={contactFormType === 'email' ? 'email' : 'tel'}
                  value={contactFormData.value}
                  onChange={(e) => setContactFormData({ ...contactFormData, value: e.target.value })}
                  placeholder={contactFormType === 'email' ? 'dept@property.com' : '+1 (555) 000-0000'}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Variable ID Preview */}
            {contactFormData.departmentName && (
              <div className="p-3 bg-white border border-slate-200 rounded">
                <p className="text-xs text-slate-600">Variable ID:</p>
                <p className="text-sm font-mono text-slate-900">
                  [{generateContactId(contactFormData.departmentName, contactFormType)}]
                </p>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                onClick={() => {
                  setShowContactForm(false);
                  setContactFormType(null);
                  setContactFormData({ departmentName: '', value: '' });
                }}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-900 rounded-md hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSaveContact}
                className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-900 rounded-md border border-blue-300"
              >
                Save Contact
              </Button>
            </div>
          </div>
        )}

        {/* Contacts Table */}
        {formData.departmentContacts && formData.departmentContacts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-300 bg-slate-50">
                  <th className="px-4 py-3 text-left font-semibold text-slate-900">ID</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-900">Department</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-900">Email/Phone</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-900">Action</th>
                </tr>
              </thead>
              <tbody>
                {formData.departmentContacts.map((contact, index) => (
                  <tr key={index} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-900 font-mono text-xs">
                      [{contact.id}]
                    </td>
                    <td className="px-4 py-3 text-slate-900">{contact.departmentName}</td>
                    <td className="px-4 py-3 text-slate-900">
                      <span className="inline-block px-2 py-1 bg-slate-100 rounded text-xs mr-2">
                        {contact.type === 'email' ? '📧' : '📱'} {contact.type}
                      </span>
                      {contact.value}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => removeContact(index)}
                        className="text-red-500 hover:bg-red-50 p-1 rounded transition-colors"
                        title="Remove contact"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : !showContactForm ? (
          <div className="p-6 text-center border border-dashed border-slate-300 rounded-lg">
            <p className="text-slate-500 mb-3">No department contacts added yet</p>
          </div>
        ) : null}
      </div>

      {/* Digital Channels Container */}
      <div className="bg-white rounded-lg p-6 md:p-8">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          💻 Digital Channels
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* WhatsApp Number */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              WhatsApp Business Number
            </label>
            <input
              type="tel"
              value={formData.whatsappNumber}
              onChange={(e) => handleChange('whatsappNumber', e.target.value)}
              placeholder="+1 (555) 000-0000"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Facebook URL */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Facebook
            </label>
            <input
              type="url"
              value={formData.facebookUrl}
              onChange={(e) => handleChange('facebookUrl', e.target.value)}
              placeholder="https://facebook.com/property"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Instagram URL */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Instagram
            </label>
            <input
              type="url"
              value={formData.instagramUrl}
              onChange={(e) => handleChange('instagramUrl', e.target.value)}
              placeholder="https://instagram.com/property"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Twitter URL */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Twitter / X
            </label>
            <input
              type="url"
              value={formData.twitterUrl}
              onChange={(e) => handleChange('twitterUrl', e.target.value)}
              placeholder="https://twitter.com/property"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* LinkedIn URL */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              LinkedIn
            </label>
            <input
              type="url"
              value={formData.linkedinUrl}
              onChange={(e) => handleChange('linkedinUrl', e.target.value)}
              placeholder="https://linkedin.com/company/property"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* YouTube URL */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              YouTube
            </label>
            <input
              type="url"
              value={formData.youtubeUrl}
              onChange={(e) => handleChange('youtubeUrl', e.target.value)}
              placeholder="https://youtube.com/@property"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Guest Accessibility Container */}
      <div className="bg-white rounded-lg p-6 md:p-8">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          👥 Guest Accessibility
        </h2>
        <div className="space-y-4">
          {/* Show Contact to Guests */}
          <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
            <div>
              <label className="block text-sm font-medium text-slate-900">
                Show contact information to guests
              </label>
              <p className="text-xs text-slate-500 mt-1">
                Display contact details on property listing
              </p>
            </div>
            <input
              type="checkbox"
              checked={formData.showContactToGuests}
              onChange={(e) => handleChange('showContactToGuests', e.target.checked)}
              className="w-5 h-5 text-blue-600 rounded"
            />
          </div>

          {/* Enable Guest Contact Form */}
          <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
            <div>
              <label className="block text-sm font-medium text-slate-900">
                Enable guest contact form
              </label>
              <p className="text-xs text-slate-500 mt-1">
                Allow guests to submit inquiries through a contact form
              </p>
            </div>
            <input
              type="checkbox"
              checked={formData.enableGuestContactForm}
              onChange={(e) => handleChange('enableGuestContactForm', e.target.checked)}
              className="w-5 h-5 text-blue-600 rounded"
            />
          </div>

          {/* Direct Booking Contact */}
          <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
            <div>
              <label className="block text-sm font-medium text-slate-900">
                Direct booking contact method
              </label>
              <p className="text-xs text-slate-500 mt-1">
                Show direct contact option during booking process
              </p>
            </div>
            <input
              type="checkbox"
              checked={formData.directBookingContact}
              onChange={(e) => handleChange('directBookingContact', e.target.checked)}
              className="w-5 h-5 text-blue-600 rounded"
            />
          </div>

          {/* Emergency Contact 24/7 */}
          <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
            <div>
              <label className="block text-sm font-medium text-slate-900">
                24/7 emergency contact availability
              </label>
              <p className="text-xs text-slate-500 mt-1">
                Emergency support available around the clock
              </p>
            </div>
            <input
              type="checkbox"
              checked={formData.emergencyContact24_7}
              onChange={(e) => handleChange('emergencyContact24_7', e.target.checked)}
              className="w-5 h-5 text-blue-600 rounded"
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <Button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
        <Button
          onClick={handleReset}
          disabled={!hasChanges}
          variant="outline"
          className="text-slate-700"
        >
          Reset
        </Button>
      </div>
    </div>
  );
}
