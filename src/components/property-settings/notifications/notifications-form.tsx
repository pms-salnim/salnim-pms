'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { 
  playTestSound, 
  isAudioSupported,
  requestNotificationPermission,
  hasNotificationPermission,
  isNotificationSupported
} from '@/lib/audio-utils';

interface NotificationChannels {
  inApp: boolean;
  email: boolean;
  sms: boolean;
}

interface NotificationSetting {
  id: string;
  label: string;
  description: string;
  category: string;
  channels: NotificationChannels;
}

interface NotificationsData {
  // Reservation Notifications
  newReservationReceived: NotificationChannels;
  reservationModified: NotificationChannels;
  reservationCancelled: NotificationChannels;
  reservationConfirmed: NotificationChannels;
  
  // Guest Notifications
  guestCheckInReminder: NotificationChannels;
  guestCheckOutReminder: NotificationChannels;
  guestCheckInConfirmed: NotificationChannels;
  guestCheckOutCompleted: NotificationChannels;
  
  // Payment Notifications
  paymentReceived: NotificationChannels;
  paymentFailed: NotificationChannels;
  paymentReminder: NotificationChannels;
  refundProcessed: NotificationChannels;
  
  // Staff Notifications
  staffTaskAssigned: NotificationChannels;
  staffTaskCompleted: NotificationChannels;
  maintenanceReportSubmitted: NotificationChannels;
  housekeepingReportSubmitted: NotificationChannels;
  
  // System Notifications
  systemAlert: NotificationChannels;
  integrationError: NotificationChannels;
  lowInventory: NotificationChannels;
  holidayPriceUpdate: NotificationChannels;
  
  // Email Settings
  emailFromAddress: string;
  emailFromName: string;
  enableEmailTemplates: boolean;
  
  // SMS Settings
  enableSMS: boolean;
  smsFromNumber: string;
  smsTimeWindow: string; // e.g., "09:00-22:00"
  
  // Do Not Disturb
  enableDND: boolean;
  dndStartTime: string; // HH:MM
  dndEndTime: string; // HH:MM
  
  // Sound Settings
  enableSound: boolean;
  soundVolume: number; // 0-100
  soundMode: 'global' | 'perCategory'; // Global sound for all, or different per category
  globalSoundPreset: 'alert' | 'aurora' | 'bongo_sms' | 'chord' | 'nintendo_switch' | 'note' | 'notification_bell' | 'rebound' | 'tri_tone' | 'tweet' | 'water_drop';
  categorySoundPresets: {
    reservations: 'alert' | 'aurora' | 'bongo_sms' | 'chord' | 'nintendo_switch' | 'note' | 'notification_bell' | 'rebound' | 'tri_tone' | 'tweet' | 'water_drop';
    guestArrivals: 'alert' | 'aurora' | 'bongo_sms' | 'chord' | 'nintendo_switch' | 'note' | 'notification_bell' | 'rebound' | 'tri_tone' | 'tweet' | 'water_drop';
    payments: 'alert' | 'aurora' | 'bongo_sms' | 'chord' | 'nintendo_switch' | 'note' | 'notification_bell' | 'rebound' | 'tri_tone' | 'tweet' | 'water_drop';
    staffOperations: 'alert' | 'aurora' | 'bongo_sms' | 'chord' | 'nintendo_switch' | 'note' | 'notification_bell' | 'rebound' | 'tri_tone' | 'tweet' | 'water_drop';
    systemAlerts: 'alert' | 'aurora' | 'bongo_sms' | 'chord' | 'nintendo_switch' | 'note' | 'notification_bell' | 'rebound' | 'tri_tone' | 'tweet' | 'water_drop';
  };
  muteInDND: boolean; // Mute sound during DND hours
}

interface NotificationsFormProps {
  initialData?: Partial<NotificationsData>;
  onSave?: (data: NotificationsData) => Promise<void>;
  isLoading?: boolean;
}

const defaultNotifications: NotificationsData = {
  // Reservation Notifications
  newReservationReceived: { inApp: true, email: true, sms: false },
  reservationModified: { inApp: true, email: true, sms: false },
  reservationCancelled: { inApp: true, email: true, sms: false },
  reservationConfirmed: { inApp: true, email: true, sms: true },
  
  // Guest Notifications
  guestCheckInReminder: { inApp: false, email: true, sms: false },
  guestCheckOutReminder: { inApp: false, email: true, sms: false },
  guestCheckInConfirmed: { inApp: true, email: true, sms: false },
  guestCheckOutCompleted: { inApp: true, email: true, sms: false },
  
  // Payment Notifications
  paymentReceived: { inApp: true, email: true, sms: false },
  paymentFailed: { inApp: true, email: true, sms: true },
  paymentReminder: { inApp: false, email: true, sms: true },
  refundProcessed: { inApp: true, email: true, sms: false },
  
  // Staff Notifications
  staffTaskAssigned: { inApp: true, email: true, sms: false },
  staffTaskCompleted: { inApp: true, email: false, sms: false },
  maintenanceReportSubmitted: { inApp: true, email: true, sms: false },
  housekeepingReportSubmitted: { inApp: true, email: true, sms: false },
  
  // System Notifications
  systemAlert: { inApp: true, email: true, sms: true },
  integrationError: { inApp: true, email: true, sms: false },
  lowInventory: { inApp: true, email: true, sms: false },
  holidayPriceUpdate: { inApp: true, email: true, sms: false },
  
  // Email Settings
  emailFromAddress: 'noreply@property.com',
  emailFromName: 'Property Management',
  enableEmailTemplates: true,
  
  // SMS Settings
  enableSMS: false,
  smsFromNumber: '',
  smsTimeWindow: '09:00-22:00',
  
  // Do Not Disturb
  enableDND: false,
  dndStartTime: '22:00',
  dndEndTime: '08:00',
  
  // Sound Settings
  enableSound: true,
  soundVolume: 70,
  soundMode: 'global',
  globalSoundPreset: 'alert',
  categorySoundPresets: {
    reservations: 'notification_bell',
    guestArrivals: 'chord',
    payments: 'water_drop',
    staffOperations: 'tweet',
    systemAlerts: 'alert',
  },
  muteInDND: true,
};

const notificationSettings: Array<{
  category: string;
  icon: string;
  settings: Array<{ id: keyof NotificationsData; label: string; description: string }>;
}> = [
  {
    category: 'Reservation Events',
    icon: '📅',
    settings: [
      { id: 'newReservationReceived', label: 'New Reservation', description: 'When a new booking is received' },
      { id: 'reservationModified', label: 'Reservation Modified', description: 'When a guest modifies their booking' },
      { id: 'reservationCancelled', label: 'Reservation Cancelled', description: 'When a reservation is cancelled' },
      { id: 'reservationConfirmed', label: 'Reservation Confirmed', description: 'When a booking is confirmed' },
    ],
  },
  {
    category: 'Guest Arrivals & Departures',
    icon: '🔑',
    settings: [
      { id: 'guestCheckInReminder', label: 'Check-In Reminder', description: 'Before guest arrival (24h notice)' },
      { id: 'guestCheckOutReminder', label: 'Check-Out Reminder', description: 'Reminder on departure day' },
      { id: 'guestCheckInConfirmed', label: 'Check-In Confirmed', description: 'When guest checks in' },
      { id: 'guestCheckOutCompleted', label: 'Check-Out Completed', description: 'When guest checks out' },
    ],
  },
  {
    category: 'Payment Events',
    icon: '💳',
    settings: [
      { id: 'paymentReceived', label: 'Payment Received', description: 'When payment is processed' },
      { id: 'paymentFailed', label: 'Payment Failed', description: 'When payment attempt fails' },
      { id: 'paymentReminder', label: 'Payment Reminder', description: 'Reminder for pending payments' },
      { id: 'refundProcessed', label: 'Refund Processed', description: 'When refund is issued' },
    ],
  },
  {
    category: 'Staff & Operations',
    icon: '👥',
    settings: [
      { id: 'staffTaskAssigned', label: 'Task Assigned', description: 'When a task is assigned to staff' },
      { id: 'staffTaskCompleted', label: 'Task Completed', description: 'When staff completes a task' },
      { id: 'maintenanceReportSubmitted', label: 'Maintenance Report', description: 'When maintenance is reported' },
      { id: 'housekeepingReportSubmitted', label: 'Housekeeping Report', description: 'When housekeeping submits report' },
    ],
  },
  {
    category: 'System & Alerts',
    icon: '⚠️',
    settings: [
      { id: 'systemAlert', label: 'System Alerts', description: 'Critical system issues' },
      { id: 'integrationError', label: 'Integration Error', description: 'When channel integration fails' },
      { id: 'lowInventory', label: 'Low Inventory', description: 'When supplies are low' },
      { id: 'holidayPriceUpdate', label: 'Price Updates', description: 'When holiday prices are set' },
    ],
  },
];

export function NotificationsForm({
  initialData = {},
  onSave,
  isLoading = false,
}: NotificationsFormProps) {
  const [formData, setFormData] = useState<NotificationsData>(() => {
    const merged = {
      ...defaultNotifications,
      ...(initialData || {}),
    };
    // Ensure categorySoundPresets is properly merged
    if (initialData?.categorySoundPresets) {
      merged.categorySoundPresets = {
        ...defaultNotifications.categorySoundPresets,
        ...initialData.categorySoundPresets,
      };
    }
    return merged;
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({
    type: null,
    message: '',
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [audioSupported, setAudioSupported] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [testSoundLoading, setTestSoundLoading] = useState(false);

  // Check if Web Audio API is supported and notification permission
  useEffect(() => {
    setAudioSupported(isAudioSupported());
    if (isNotificationSupported()) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const originalData = (() => {
    const merged = {
      ...defaultNotifications,
      ...(initialData || {}),
    };
    // Ensure categorySoundPresets is properly merged
    if (initialData?.categorySoundPresets) {
      merged.categorySoundPresets = {
        ...defaultNotifications.categorySoundPresets,
        ...initialData.categorySoundPresets,
      };
    }
    return merged;
  })();

  const handleChannelChange = (
    settingId: keyof NotificationsData,
    channel: keyof NotificationChannels,
    value: boolean
  ) => {
    const currentSetting = formData[settingId] as NotificationChannels;
    const newSetting = {
      ...currentSetting,
      [channel]: value,
    };

    const newData = {
      ...formData,
      [settingId]: newSetting,
    };

    setFormData(newData);
    const hasChanged = JSON.stringify(newData) !== JSON.stringify(originalData);
    setHasChanges(hasChanged);
  };

  const handleChange = (key: keyof NotificationsData, value: any) => {
    const newData = {
      ...formData,
      [key]: value,
    };

    setFormData(newData);
    const hasChanged = JSON.stringify(newData) !== JSON.stringify(originalData);
    setHasChanges(hasChanged);
  };

  const handleSave = async () => {
    if (!onSave || !hasChanges) return;

    setIsSaving(true);
    try {
      await onSave(formData);
      setSaveStatus({
        type: 'success',
        message: 'Notification settings saved successfully',
      });
      setHasChanges(false);

      setTimeout(() => {
        setSaveStatus({ type: null, message: '' });
      }, 3000);
    } catch (error) {
      setSaveStatus({
        type: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to save notifications',
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

  const ChannelToggle = ({
    channel,
    checked,
    onChange,
  }: {
    channel: string;
    checked: boolean;
    onChange: (value: boolean) => void;
  }) => (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        checked ? 'bg-blue-600' : 'bg-slate-300'
      }`}
      title={channel}
    >
      <span
        className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
  );

  const TextInput = ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  }) => (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  );

  const TimeInput = ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) => (
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  );

  return (
    <div className="space-y-8">
      {/* Status Message */}
      {saveStatus.type && (
        <div
          className={`flex items-center gap-3 p-4 rounded-lg ${
            saveStatus.type === 'success'
              ? 'bg-green-50 text-green-800'
              : 'bg-red-50 text-red-800'
          }`}
        >
          {saveStatus.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          <span className="text-sm font-medium">{saveStatus.message}</span>
        </div>
      )}

      {/* Notification Settings by Category */}
      {notificationSettings.map((category) => (
        <div key={category.category} className="space-y-4">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl">{category.icon}</span>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                {category.category}
              </h3>
            </div>
          </div>

          {category.settings.map((setting) => {
            const notificationData = formData[setting.id] as NotificationChannels;

            return (
              <div
                key={setting.id}
                className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-medium text-slate-900">{setting.label}</h4>
                    <p className="text-sm text-slate-600 mt-1">{setting.description}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-8 bg-slate-50 rounded p-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-700 w-16">In-App</span>
                    <ChannelToggle
                      channel="In-App"
                      checked={notificationData.inApp}
                      onChange={(value) =>
                        handleChannelChange(setting.id, 'inApp', value)
                      }
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-700 w-16">Email</span>
                    <ChannelToggle
                      channel="Email"
                      checked={notificationData.email}
                      onChange={(value) =>
                        handleChannelChange(setting.id, 'email', value)
                      }
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-700 w-12">SMS</span>
                    <ChannelToggle
                      channel="SMS"
                      checked={notificationData.sms}
                      onChange={(value) =>
                        handleChannelChange(setting.id, 'sms', value)
                      }
                    />
                  </div>
                </div>
              </div>
            );
          })}

          <hr className="border-slate-200" />
        </div>
      ))}

      {/* Email Settings Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <span>📧</span> Email Configuration
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 rounded-lg hover:bg-slate-50 transition-colors">
            <label className="block text-sm font-medium text-slate-900 mb-2">
              From Email Address
            </label>
            <p className="text-xs text-slate-600 mb-3">
              Email address notifications will be sent from
            </p>
            <TextInput
              value={formData.emailFromAddress}
              onChange={(value) => handleChange('emailFromAddress', value)}
              placeholder="noreply@property.com"
            />
          </div>

          <div className="p-4 rounded-lg hover:bg-slate-50 transition-colors">
            <label className="block text-sm font-medium text-slate-900 mb-2">
              From Name
            </label>
            <p className="text-xs text-slate-600 mb-3">
              Sender name in emails
            </p>
            <TextInput
              value={formData.emailFromName}
              onChange={(value) => handleChange('emailFromName', value)}
              placeholder="Property Management"
            />
          </div>

          <div className="p-4 rounded-lg hover:bg-slate-50 transition-colors md:col-span-2">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={formData.enableEmailTemplates}
                onChange={(e) =>
                  handleChange('enableEmailTemplates', e.target.checked)
                }
                className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-slate-900">
                Use Professional Email Templates
              </span>
            </label>
            <p className="text-xs text-slate-600 mt-2 ml-8">
              Automatically format all notification emails with branded templates
            </p>
          </div>
        </div>

        <hr className="border-slate-200" />
      </div>

      {/* SMS Settings Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <span>📱</span> SMS Configuration
        </h3>

        <div className="p-4 rounded-lg hover:bg-slate-50 transition-colors md:col-span-2">
          <label className="flex items-center gap-3 mb-4">
            <input
              type="checkbox"
              checked={formData.enableSMS}
              onChange={(e) => handleChange('enableSMS', e.target.checked)}
              className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-slate-900">
              Enable SMS Notifications
            </span>
          </label>
          <p className="text-xs text-slate-600 ml-8">
            Requires SMS provider integration (Twilio, etc.)
          </p>
        </div>

        {formData.enableSMS && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 rounded-lg bg-blue-50 rounded-lg hover:bg-slate-50 transition-colors">
              <label className="block text-sm font-medium text-slate-900 mb-2">
                SMS From Number
              </label>
              <p className="text-xs text-slate-600 mb-3">
                Phone number SMS will be sent from
              </p>
              <TextInput
                value={formData.smsFromNumber}
                onChange={(value) => handleChange('smsFromNumber', value)}
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div className="p-4 rounded-lg bg-blue-50 hover:bg-slate-50 transition-colors">
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Sending Time Window
              </label>
              <p className="text-xs text-slate-600 mb-3">
                Only send SMS during these hours
              </p>
              <input
                type="text"
                value={formData.smsTimeWindow}
                onChange={(e) => handleChange('smsTimeWindow', e.target.value)}
                placeholder="09:00-22:00"
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        <hr className="border-slate-200" />
      </div>

      {/* Do Not Disturb Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <span>🔇</span> Do Not Disturb Schedule
        </h3>

        <div className="p-4 rounded-lg hover:bg-slate-50 transition-colors md:col-span-2">
          <label className="flex items-center gap-3 mb-4">
            <input
              type="checkbox"
              checked={formData.enableDND}
              onChange={(e) => handleChange('enableDND', e.target.checked)}
              className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-slate-900">
              Enable Do Not Disturb
            </span>
          </label>
          <p className="text-xs text-slate-600 ml-8">
            Pause all notifications during specified hours
          </p>
        </div>

        {formData.enableDND && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 rounded-lg bg-blue-50 hover:bg-slate-50 transition-colors">
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Start Time
              </label>
              <p className="text-xs text-slate-600 mb-3">
                When to pause notifications
              </p>
              <TimeInput
                value={formData.dndStartTime}
                onChange={(value) => handleChange('dndStartTime', value)}
              />
            </div>

            <div className="p-4 rounded-lg bg-blue-50 hover:bg-slate-50 transition-colors">
              <label className="block text-sm font-medium text-slate-900 mb-2">
                End Time
              </label>
              <p className="text-xs text-slate-600 mb-3">
                When to resume notifications
              </p>
              <TimeInput
                value={formData.dndEndTime}
                onChange={(value) => handleChange('dndEndTime', value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Sound Settings Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <span>🔊</span> Sound Notifications
        </h3>

        <div className="p-4 rounded-lg hover:bg-slate-50 transition-colors md:col-span-2">
          <label className="flex items-center gap-3 mb-4">
            <input
              type="checkbox"
              checked={formData.enableSound}
              onChange={(e) => handleChange('enableSound', e.target.checked)}
              className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-slate-900">
              Enable Sound Notifications
            </span>
          </label>
          <p className="text-xs text-slate-600 ml-8">
            Play a sound when notifications are received
          </p>
        </div>

        {formData.enableSound && (
          <div className="space-y-4 bg-blue-50 rounded-lg p-6">
            {/* Sound Mode Selection */}
            <div className="p-4 rounded-lg bg-white border border-slate-200">
              <label className="block text-sm font-medium text-slate-900 mb-3">
                Sound Mode
              </label>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="soundMode"
                    value="global"
                    checked={formData.soundMode === 'global'}
                    onChange={() => handleChange('soundMode', 'global')}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm text-slate-700">Use same sound for all notifications</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="soundMode"
                    value="perCategory"
                    checked={formData.soundMode === 'perCategory'}
                    onChange={() => handleChange('soundMode', 'perCategory')}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm text-slate-700">Different sound per category</span>
                </label>
              </div>
            </div>

            {/* Global Sound Mode */}
            {formData.soundMode === 'global' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 rounded-lg hover:bg-slate-50 transition-colors">
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Global Sound
                  </label>
                  <p className="text-xs text-slate-600 mb-3">
                    Choose sound for all notifications
                  </p>
                  <select
                    value={formData.globalSoundPreset}
                    onChange={(e) => handleChange('globalSoundPreset', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="alert">Alert</option>
                    <option value="aurora">Aurora</option>
                    <option value="bongo_sms">Bongo SMS</option>
                    <option value="chord">Chord</option>
                    <option value="nintendo_switch">Nintendo Switch</option>
                    <option value="note">Note</option>
                    <option value="notification_bell">Notification Bell</option>
                    <option value="rebound">Rebound</option>
                    <option value="tri_tone">Tri Tone</option>
                    <option value="tweet">Tweet</option>
                    <option value="water_drop">Water Drop</option>
                  </select>
                </div>

                <div className="p-4 rounded-lg hover:bg-slate-50 transition-colors">
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Volume: {formData.soundVolume}%
                  </label>
                  <p className="text-xs text-slate-600 mb-3">
                    Notification sound volume level
                  </p>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={formData.soundVolume}
                    onChange={(e) => handleChange('soundVolume', parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-300 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div className="md:col-span-2">
                  {!audioSupported ? (
                    <div className="w-full px-4 py-2 bg-slate-200 text-slate-600 rounded-md text-center font-medium cursor-not-allowed">
                      🔊 Test Sound (Not Supported)
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={testSoundLoading}
                      onClick={async () => {
                        setTestSoundLoading(true);
                        try {
                          if (notificationPermission !== 'granted' && isNotificationSupported()) {
                            const permission = await requestNotificationPermission();
                            setNotificationPermission(permission);
                          }
                          await playTestSound(formData.globalSoundPreset, formData.soundVolume);
                        } catch (error) {
                          console.error('Error in test sound:', error);
                        } finally {
                          setTestSoundLoading(false);
                        }
                      }}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-400 transition-colors font-medium"
                    >
                      {testSoundLoading ? '🔊 Playing...' : '🔊 Test Sound'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Per-Category Sound Mode */}
            {formData.soundMode === 'perCategory' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-600 font-medium">Configure different sounds for each category:</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Reservation Events */}
                  <div className="p-4 rounded-lg bg-white border border-slate-200">
                    <label className="block text-sm font-medium text-slate-900 mb-2">
                      📅 Reservation Events
                    </label>
                    <select
                      value={formData.categorySoundPresets.reservations}
                      onChange={(e) => handleChange('categorySoundPresets', {
                        ...formData.categorySoundPresets,
                        reservations: e.target.value as any
                      })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="alert">Alert</option>
                      <option value="aurora">Aurora</option>
                      <option value="bongo_sms">Bongo SMS</option>
                      <option value="chord">Chord</option>
                      <option value="nintendo_switch">Nintendo Switch</option>
                      <option value="note">Note</option>
                      <option value="notification_bell">Notification Bell</option>
                      <option value="rebound">Rebound</option>
                      <option value="tri_tone">Tri Tone</option>
                      <option value="tweet">Tweet</option>
                      <option value="water_drop">Water Drop</option>
                    </select>
                  </div>

                  {/* Guest Events */}
                  <div className="p-4 rounded-lg bg-white border border-slate-200">
                    <label className="block text-sm font-medium text-slate-900 mb-2">
                      🏠 Guest Arrivals & Departures
                    </label>
                    <select
                      value={formData.categorySoundPresets.guestArrivals}
                      onChange={(e) => handleChange('categorySoundPresets', {
                        ...formData.categorySoundPresets,
                        guestArrivals: e.target.value as any
                      })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="alert">Alert</option>
                      <option value="aurora">Aurora</option>
                      <option value="bongo_sms">Bongo SMS</option>
                      <option value="chord">Chord</option>
                      <option value="nintendo_switch">Nintendo Switch</option>
                      <option value="note">Note</option>
                      <option value="notification_bell">Notification Bell</option>
                      <option value="rebound">Rebound</option>
                      <option value="tri_tone">Tri Tone</option>
                      <option value="tweet">Tweet</option>
                      <option value="water_drop">Water Drop</option>
                    </select>
                  </div>

                  {/* Payment Events */}
                  <div className="p-4 rounded-lg bg-white border border-slate-200">
                    <label className="block text-sm font-medium text-slate-900 mb-2">
                      💳 Payment Events
                    </label>
                    <select
                      value={formData.categorySoundPresets.payments}
                      onChange={(e) => handleChange('categorySoundPresets', {
                        ...formData.categorySoundPresets,
                        payments: e.target.value as any
                      })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="alert">Alert</option>
                      <option value="aurora">Aurora</option>
                      <option value="bongo_sms">Bongo SMS</option>
                      <option value="chord">Chord</option>
                      <option value="nintendo_switch">Nintendo Switch</option>
                      <option value="note">Note</option>
                      <option value="notification_bell">Notification Bell</option>
                      <option value="rebound">Rebound</option>
                      <option value="tri_tone">Tri Tone</option>
                      <option value="tweet">Tweet</option>
                      <option value="water_drop">Water Drop</option>
                    </select>
                  </div>

                  {/* Staff Operations */}
                  <div className="p-4 rounded-lg bg-white border border-slate-200">
                    <label className="block text-sm font-medium text-slate-900 mb-2">
                      👥 Staff & Operations
                    </label>
                    <select
                      value={formData.categorySoundPresets.staffOperations}
                      onChange={(e) => handleChange('categorySoundPresets', {
                        ...formData.categorySoundPresets,
                        staffOperations: e.target.value as any
                      })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="alert">Alert</option>
                      <option value="aurora">Aurora</option>
                      <option value="bongo_sms">Bongo SMS</option>
                      <option value="chord">Chord</option>
                      <option value="nintendo_switch">Nintendo Switch</option>
                      <option value="note">Note</option>
                      <option value="notification_bell">Notification Bell</option>
                      <option value="rebound">Rebound</option>
                      <option value="tri_tone">Tri Tone</option>
                      <option value="tweet">Tweet</option>
                      <option value="water_drop">Water Drop</option>
                    </select>
                  </div>

                  {/* System Alerts */}
                  <div className="p-4 rounded-lg bg-white border border-slate-200">
                    <label className="block text-sm font-medium text-slate-900 mb-2">
                      ⚠️ System Alerts
                    </label>
                    <select
                      value={formData.categorySoundPresets.systemAlerts}
                      onChange={(e) => handleChange('categorySoundPresets', {
                        ...formData.categorySoundPresets,
                        systemAlerts: e.target.value as any
                      })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="alert">Alert</option>
                      <option value="aurora">Aurora</option>
                      <option value="bongo_sms">Bongo SMS</option>
                      <option value="chord">Chord</option>
                      <option value="nintendo_switch">Nintendo Switch</option>
                      <option value="note">Note</option>
                      <option value="notification_bell">Notification Bell</option>
                      <option value="rebound">Rebound</option>
                      <option value="tri_tone">Tri Tone</option>
                      <option value="tweet">Tweet</option>
                      <option value="water_drop">Water Drop</option>
                    </select>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-white border border-slate-200">
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Volume: {formData.soundVolume}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={formData.soundVolume}
                    onChange={(e) => handleChange('soundVolume', parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-300 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* Mute in DND */}
            <div className="md:col-span-2 p-4 rounded-lg bg-white hover:bg-slate-50 transition-colors border border-slate-200">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={formData.muteInDND}
                  onChange={(e) => handleChange('muteInDND', e.target.checked)}
                  className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-slate-900">
                  Mute Sound During Do Not Disturb Hours
                </span>
              </label>
              <p className="text-xs text-slate-600 mt-2 ml-8">
                Automatically silence notifications during your DND schedule
              </p>
            </div>
          </div>
        )}
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
