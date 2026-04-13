'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { PropertySettingsSubtabs } from '@/components/property-settings/property-settings-subtabs';
import { EmailTemplateForm } from '@/components/property-settings/email-template-form';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/auth-context';
import { toast } from '@/hooks/use-toast';
import { defaultEmailTemplateContents } from '@/lib/email-templates/defaults';

const communicationSubtabs = [
  { id: 'guests-profiles', label: 'Guests Profiles', href: '/property-settings/communication/guests-profiles' },
  { id: 'communication-channels', label: 'Communication Channels', href: '/property-settings/communication/communication-channels' },
  { id: 'email-templates', label: 'Email Templates', href: '/property-settings/communication/email-templates' },
  { id: 'guest-portal', label: 'Guest Portal', href: '/property-settings/communication/guest-portal' },
  { id: 'notifications', label: 'Notifications', href: '/property-settings/communication/notifications' },
];

interface EmailTemplate {
  id: string;
  name: string;
  category: 'confirmation' | 'cancellation' | 'reminder' | 'marketing' | 'manual' | 'other';
  enabled: boolean;
  isDefault: boolean;
  createdAt?: Date | any;
  updatedAt?: Date | any;
  lastEdited?: Date | any; // Keep for backward compatibility
  languages: string[];
  subject?: string;
  description?: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
  ccList?: string;
  bccList?: string;
  emailType?: 'transactional' | 'marketing' | 'notification';
  preheaderText?: string;
  htmlContent?: string;
  plainTextContent?: string;
  signatureTemplateId?: string;
  signatureName?: string;
  signaturePropertyName?: string;
  signaturePhone?: string;
  signatureEmail?: string;
  signatureAddress?: string;
  signatureWebsite?: string;
  signatureLogo?: string;
  signatureSocialMedia?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    tripadvisor?: string;
  };
}

// Default system templates
const DEFAULT_TEMPLATES_BASE: EmailTemplate[] = [
  {
    id: 'reservation-inquiry',
    name: 'Reservation Inquiry',
    category: 'confirmation',
    enabled: true,
    isDefault: true,
    lastEdited: new Date('2025-01-15'),
    languages: ['en', 'fr'],
    description: 'Sent when inquiry about rooms availability and pricing is received',
  },
  {
    id: 'reservation-information',
    name: 'Reservation Information',
    category: 'confirmation',
    enabled: true,
    isDefault: true,
    lastEdited: new Date('2025-01-10'),
    languages: ['en'],
    description: 'Sent to the guest automatically when a reservation is made manually in-app',
  },
  {
    id: 'booking-confirmation',
    name: 'Booking Confirmation',
    category: 'confirmation',
    enabled: true,
    isDefault: true,
    lastEdited: new Date('2025-01-20'),
    languages: ['en', 'fr'],
    description: 'Sent to the guest when their booking is successfully created from the booking page',
  },
  {
    id: 'reservation-modification',
    name: 'Reservation Modification',
    category: 'reminder',
    enabled: true,
    isDefault: true,
    lastEdited: new Date('2025-01-18'),
    languages: ['en'],
    description: 'Sent to the guest when their reservation details are modified by staff',
  },
  {
    id: 'reservation-cancellation',
    name: 'Reservation Cancellation',
    category: 'cancellation',
    enabled: true,
    isDefault: true,
    lastEdited: new Date('2025-01-20'),
    languages: ['en', 'fr'],
    description: 'Sent to the guest when their reservation is cancelled',
  },
  {
    id: 'check-in-instructions',
    name: 'Check-in Instructions / Pre-Arrival',
    category: 'reminder',
    enabled: true,
    isDefault: true,
    lastEdited: new Date('2025-01-12'),
    languages: ['en', 'fr'],
    description: 'Sent before check-in with arrival info and request digital check-in from the guest-portal',
  },
  {
    id: 'checked-in-welcome',
    name: 'Checked-in / Welcome',
    category: 'confirmation',
    enabled: true,
    isDefault: true,
    lastEdited: new Date('2025-01-15'),
    languages: ['en'],
    description: 'Sent after check-in to welcome and invite to access the guest portal to browse all services and amenities',
  },
  {
    id: 'check-out-review',
    name: 'Check-out / Post-stay Review Request',
    category: 'reminder',
    enabled: true,
    isDefault: true,
    lastEdited: new Date('2025-01-20'),
    languages: ['en', 'fr'],
    description: 'Sent after departure asking about reviews',
  },
  {
    id: 'invoice-receipt',
    name: 'Invoice / Receipt',
    category: 'other',
    enabled: true,
    isDefault: true,
    lastEdited: new Date('2025-01-08'),
    languages: ['en'],
    description: 'Sent with invoices with payment request or receipts',
  },
  {
    id: 'payment-confirmation',
    name: 'Payment Confirmation',
    category: 'other',
    enabled: true,
    isDefault: true,
    lastEdited: new Date('2025-01-12'),
    languages: ['en'],
    description: 'Sent after a payment is processed successfully',
  },
  {
    id: 'payment-error',
    name: 'Payment Error',
    category: 'other',
    enabled: true,
    isDefault: true,
    lastEdited: new Date('2025-01-16'),
    languages: ['en'],
    description: 'Sent after a payment processing fails mentioning the cause of the error',
  },
  {
    id: 'late-payment-reminder',
    name: 'Late Payment Reminder',
    category: 'reminder',
    enabled: true,
    isDefault: true,
    lastEdited: new Date('2025-01-18'),
    languages: ['en'],
    description: 'Automatic reminder for overdue payment after X days from the expected payment date',
  },
];

// Initialize DEFAULT_TEMPLATES with content from defaultEmailTemplateContents
const DEFAULT_TEMPLATES = DEFAULT_TEMPLATES_BASE.map(template => ({
  ...template,
  subject: defaultEmailTemplateContents[template.id as keyof typeof defaultEmailTemplateContents]?.subject || '',
  preheaderText: defaultEmailTemplateContents[template.id as keyof typeof defaultEmailTemplateContents]?.preheaderText || '',
  htmlContent: defaultEmailTemplateContents[template.id as keyof typeof defaultEmailTemplateContents]?.htmlContent || '',
}));

export default function EmailTemplatesPage() {
  const { user } = useAuth();
  const formRef = useRef<{ submitForm: () => void }>(null);
  const [allTemplates, setAllTemplates] = useState<EmailTemplate[]>(DEFAULT_TEMPLATES);
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    category: 'confirmation' as const,
    enabled: true,
    fromName: '',
    fromEmail: '',
    replyTo: '',
  });
  const [currentFormData, setCurrentFormData] = useState<any>(null);

  // Load templates from Supabase
  useEffect(() => {
    if (!user?.propertyId) return;

    const loadTemplates = async () => {
      try {
        const url = new URL('/api/property-settings/email-templates', window.location.origin);
        url.searchParams.set('propertyId', user.propertyId);

        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });

        if (!response.ok) {
          console.warn('Error loading templates:', response.statusText);
          setAllTemplates(DEFAULT_TEMPLATES);
          return;
        }

        const data = await response.json();
        const customTemplates = (data.templates || []).map((template: any) => ({
          id: template.template_id,
          name: template.name,
          category: template.category,
          enabled: template.enabled !== undefined ? template.enabled : true,
          isDefault: template.is_default || false,
          languages: template.languages || ['en'],
          subject: template.subject || '',
          preheaderText: template.preheader_text || '',
          htmlContent: template.html_content || '',
          description: template.description || '',
          fromName: template.from_name || '',
          fromEmail: template.from_email || '',
          replyTo: template.reply_to || '',
          ccList: template.cc_list || '',
          bccList: template.bcc_list || '',
          emailType: template.email_type || 'transactional',
        }));

        // Separate custom templates into overrides and truly custom ones
        const defaultIds = DEFAULT_TEMPLATES.map(t => t.id);
        const customOverrides = customTemplates.filter(t => defaultIds.includes(t.id));
        const trulyCustom = customTemplates.filter(t => !defaultIds.includes(t.id));

        // Build the map of custom overrides for quick lookup
        const overrideMap = new Map(customOverrides.map(t => [t.id, t]));

        // Merge: Default templates (using override if exists), then truly custom
        const merged = [
          ...DEFAULT_TEMPLATES.map(defaultTemplate => 
            overrideMap.get(defaultTemplate.id) || defaultTemplate
          ),
          ...trulyCustom,
        ];

        setAllTemplates(merged);
      } catch (error) {
        console.error('Error loading templates:', error);
        setAllTemplates(DEFAULT_TEMPLATES);
      }
    };

    loadTemplates();
  }, [user?.propertyId]);

  // Return all templates without filtering
  const filteredTemplates = useMemo(() => {
    return allTemplates;
  }, [allTemplates]);

  const handleToggleTemplate = async (templateId: string) => {
    const template = allTemplates.find(t => t.id === templateId);
    if (!template || !user?.propertyId) return;

    const newEnabled = !template.enabled;

    try {
      const defaultTemplate = DEFAULT_TEMPLATES.find(t => t.id === templateId);
      
      if (template.isDefault && defaultTemplate) {
        // For default templates, save as custom override with isDefault: false
        const response = await fetch('/api/property-settings/email-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            propertyId: user.propertyId,
            template: {
              template_id: templateId,
              name: defaultTemplate.name,
              category: defaultTemplate.category,
              description: defaultTemplate.description,
              subject: defaultTemplate.subject,
              preheader_text: defaultTemplate.preheaderText,
              html_content: defaultTemplate.htmlContent,
              enabled: newEnabled,
              is_default: false,
              languages: defaultTemplate.languages || ['en'],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          }),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.statusText}`);
        }
        console.log('Default template override created for:', templateId);
      } else {
        // For custom templates, just update the enabled status
        const response = await fetch('/api/property-settings/email-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            propertyId: user.propertyId,
            template: {
              template_id: templateId,
              enabled: newEnabled,
              updated_at: new Date().toISOString(),
            },
          }),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.statusText}`);
        }
      }
      
      // Update local state
      setAllTemplates(prev => prev.map(t =>
        t.id === templateId ? { ...t, enabled: newEnabled } : t
      ));
      
      toast({ title: 'Success', description: `Template ${newEnabled ? 'enabled' : 'disabled'}` });
    } catch (error) {
      console.error('Error updating template status:', error);
      toast({ title: 'Error', description: 'Failed to update template status.' });
    }
  };

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(templateId)) {
        newSet.delete(templateId);
      } else {
        newSet.add(templateId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedTemplates.size === filteredTemplates.length) {
      setSelectedTemplates(new Set());
    } else {
      setSelectedTemplates(new Set(filteredTemplates.map(t => t.id)));
    }
  };

  const handleBulkEnable = async () => {
    try {
      const templateIds = Array.from(selectedTemplates);
      const response = await fetch('/api/property-settings/email-templates/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          propertyId: user.propertyId,
          templateIds,
          enabled: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      setAllTemplates(prev => prev.map(t =>
        selectedTemplates.has(t.id) ? { ...t, enabled: true } : t
      ));
      setSelectedTemplates(new Set());
      toast({ title: 'Success', description: 'Templates enabled' });
    } catch (error) {
      console.error('Error enabling templates:', error);
      toast({ title: 'Error', description: 'Failed to enable templates' });
    }
  };

  const handleBulkDisable = async () => {
    try {
      const templateIds = Array.from(selectedTemplates);
      const response = await fetch('/api/property-settings/email-templates/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          propertyId: user.propertyId,
          templateIds,
          enabled: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      setAllTemplates(prev => prev.map(t =>
        selectedTemplates.has(t.id) ? { ...t, enabled: false } : t
      ));
      setSelectedTemplates(new Set());
      toast({ title: 'Success', description: 'Templates disabled' });
    } catch (error) {
      console.error('Error disabling templates:', error);
      toast({ title: 'Error', description: 'Failed to disable templates' });
    }
  };

  const handleBulkDelete = async () => {
    try {
      const templateIds = Array.from(selectedTemplates);
      const response = await fetch('/api/property-settings/email-templates/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          propertyId: user.propertyId,
          templateIds,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      setAllTemplates(prev => prev.filter(t => !selectedTemplates.has(t.id)));
      setSelectedTemplates(new Set());
      toast({ title: 'Success', description: 'Templates deleted' });
    } catch (error) {
      console.error('Error deleting templates:', error);
      toast({ title: 'Error', description: 'Failed to delete templates' });
    }
  };

  const handleDuplicateTemplate = (templateId: string) => {
    const template = allTemplates.find(t => t.id === templateId);
    if (template) {
      const duplicate = {
        ...template,
        id: `${template.id}-copy-${Date.now()}`,
        name: `${template.name} (Copy)`,
        isDefault: false,
        lastEdited: new Date(),
      };
      setAllTemplates(prev => [...prev, duplicate]);
      toast({ title: 'Success', description: 'Template duplicated' });
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!user?.propertyId) {
      toast({ title: 'Error', description: 'Unable to delete template. Property ID not found.' });
      return;
    }

    try {
      const template = allTemplates.find(t => t.id === templateId);
      
      // Only delete custom templates via API
      if (template && !template.isDefault) {
        const response = await fetch(`/api/property-settings/email-templates?propertyId=${user.propertyId}&templateId=${templateId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.statusText}`);
        }
      }

      setAllTemplates(prev => prev.filter(t => t.id !== templateId));
      setDeletingTemplateId(null);
      toast({ title: 'Success', description: 'Template deleted' });
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({ title: 'Error', description: 'Failed to delete template. Please try again.' });
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      confirmation: 'bg-blue-100 text-blue-800',
      cancellation: 'bg-red-100 text-red-800',
      reminder: 'bg-yellow-100 text-yellow-800',
      marketing: 'bg-purple-100 text-purple-800',
      manual: 'bg-gray-100 text-gray-800',
      other: 'bg-slate-100 text-slate-800',
    };
    return colors[category] || colors.other;
  };

  const handleOpenCreateModal = () => {
    setFormData({
      name: '',
      category: 'confirmation',
      enabled: true,
      fromName: '',
      fromEmail: '',
      replyTo: '',
    });
    setEditingTemplateId(null);    setCurrentFormData(null);
    console.log('Opening create modal, editingTemplateId set to null');    setIsModalOpen(true);
  };

  const handleOpenEditModal = (templateId: string) => {
    console.log('Opening edit modal for templateId:', templateId);
    const template = allTemplates.find(t => t.id === templateId);
    if (template) {
      // Get default content if available
      const defaultContent = defaultEmailTemplateContents[templateId as keyof typeof defaultEmailTemplateContents];
      
      setFormData({
        name: template.name,
        category: template.category,
        enabled: template.enabled,
        fromName: template.fromName || '',
        fromEmail: template.fromEmail || '',
        replyTo: template.replyTo || '',
      });
      
      // Set current form data with template content, including default content if available
      setCurrentFormData({
        ...template,
        subject: template.subject || defaultContent?.subject || '',
        preheaderText: template.preheaderText || defaultContent?.preheaderText || '',
        htmlContent: template.htmlContent || defaultContent?.htmlContent || '',
      });
      
      setEditingTemplateId(templateId);
      setIsModalOpen(true);
    }
  };

  const handleSaveTemplate = () => {
    // Use the currentFormData that was set by the form's onSubmit, which contains all fields
    const dataToSave = currentFormData || formData;
    
    if (!dataToSave || !dataToSave.name || !dataToSave.name.trim()) {
      toast({ title: 'Error', description: 'Template name is required' });
      return;
    }

    if (editingTemplateId) {
      // Update existing template
      setAllTemplates(prev => prev.map(t => 
        t.id === editingTemplateId 
          ? {
              ...t,
              name: dataToSave.name,
              category: dataToSave.category,
              enabled: dataToSave.enabled,
              fromName: dataToSave.fromName || undefined,
              fromEmail: dataToSave.fromEmail || undefined,
              replyTo: dataToSave.replyTo || undefined,
              lastEdited: new Date(),
            }
          : t
      ));
      toast({ title: 'Success', description: 'Template updated' });
    } else {
      // Create new template
      const newTemplate: EmailTemplate = {
        id: `custom-${Date.now()}`,
        name: dataToSave.name,
        category: dataToSave.category,
        enabled: dataToSave.enabled,
        isDefault: false,
        lastEdited: new Date(),
        languages: ['en'],
        description: `Custom template`,
        fromName: dataToSave.fromName || undefined,
        fromEmail: dataToSave.fromEmail || undefined,
        replyTo: dataToSave.replyTo || undefined,
      };
      setAllTemplates(prev => [...prev, newTemplate]);
      toast({ title: 'Success', description: 'Template created' });
    }

    setIsModalOpen(false);
    setCurrentFormData(null);
  };

  const handleSaveAfterForm = async (data: any) => {
    console.log('handleSaveAfterForm called with data:', data);
    console.log('Current editingTemplateId:', editingTemplateId);
    
    if (!data || !data.name || !data.name.trim()) {
      toast({ title: 'Error', description: 'Template name is required' });
      return;
    }

    if (!user?.propertyId) {
      console.error('No propertyId found:', user);
      toast({ title: 'Error', description: 'Unable to save template. Property ID not found.' });
      return;
    }

    console.log('Saving to Supabase with propertyId:', user.propertyId);

    try {
      const templateData = {
        name: data.name,
        category: data.category,
        enabled: data.enabled !== undefined ? data.enabled : true,
        from_name: data.fromName || '',
        from_email: data.fromEmail || '',
        reply_to: data.replyTo || '',
        cc_list: data.ccList || '',
        bcc_list: data.bccList || '',
        email_type: data.emailType || 'transactional',
        subject: data.subject || '',
        preheader_text: data.preheaderText || '',
        description: data.description || '',
        html_content: data.htmlContent || '',
        // Signature fields
        signature_template_id: data.signatureTemplateId || '',
        signature_name: data.signatureName || '',
        signature_property_name: data.signaturePropertyName || '',
        signature_phone: data.signaturePhone || '',
        signature_email: data.signatureEmail || '',
        signature_address: data.signatureAddress || '',
        signature_website: data.signatureWebsite || '',
        signature_logo: data.signatureLogo || '',
        signature_social_media: data.signatureSocialMedia || {},
        updated_at: new Date().toISOString(),
      };

      // Check if this is an update to an existing template
      if (editingTemplateId) {
        // Check if editing a default template
        const defaultTemplate = DEFAULT_TEMPLATES.find(t => t.id === editingTemplateId);
        
        if (defaultTemplate) {
          // Editing a default template - save as custom override with same ID
          console.log('Overriding default template:', editingTemplateId);
          const response = await fetch('/api/property-settings/email-templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              propertyId: user.propertyId,
              template: {
                template_id: editingTemplateId,
                is_default: false,
                languages: ['en'],
                ...templateData,
              },
            }),
          });

          if (!response.ok) {
            throw new Error(`API error: ${response.statusText}`);
          }
          console.log('Default template overridden successfully');
          toast({ title: 'Success', description: 'Template updated' });
        } else {
          // Updating a custom template
          console.log('Updating custom template:', editingTemplateId);
          const response = await fetch('/api/property-settings/email-templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              propertyId: user.propertyId,
              template: {
                template_id: editingTemplateId,
                ...templateData,
              },
            }),
          });

          if (!response.ok) {
            throw new Error(`API error: ${response.statusText}`);
          }
          console.log('Template updated successfully');
          toast({ title: 'Success', description: 'Template updated' });
        }
      } else {
        // Create new template
        const newTemplateId = `custom-${Date.now()}`;
        
        console.log('Creating new template with ID:', newTemplateId);
        const response = await fetch('/api/property-settings/email-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            propertyId: user.propertyId,
            template: {
              template_id: newTemplateId,
              is_default: false,
              languages: ['en'],
              created_at: new Date().toISOString(),
              ...templateData,
            },
          }),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.statusText}`);
        }
        console.log('Template created successfully');
        toast({ title: 'Success', description: 'Template created' });
      }

      setIsModalOpen(false);
      setEditingTemplateId(null);
      setCurrentFormData(null);
    } catch (error) {
      console.error('Error saving template:', error);
      toast({ title: 'Error', description: 'Failed to save template. Please try again.' });
    }
  };





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
        <div className="space-y-6">
          {/* Page Title */}
          <div>
            <h2 className="text-xl font-bold mb-1">Email Templates</h2>
            <p className="text-sm text-muted-foreground">Manage and customize email templates for guest communications. Edit default templates or create custom ones.</p>
          </div>

          {/* Bulk Actions */}
          {selectedTemplates.size > 0 && (
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <span className="text-sm font-medium text-blue-900">
                {selectedTemplates.size} template{selectedTemplates.size > 1 ? 's' : ''} selected
              </span>
              <div className="flex gap-2 ml-auto">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleBulkEnable}
                >
                  <Icons.Check className="h-4 w-4 mr-1" /> Enable
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleBulkDisable}
                >
                  <Icons.X className="h-4 w-4 mr-1" /> Disable
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (confirm('Delete selected templates? This cannot be undone.')) {
                      handleBulkDelete();
                    }
                  }}
                  className="text-red-600 hover:text-red-700"
                >
                  <Icons.X className="h-4 w-4 mr-1" /> Delete
                </Button>
              </div>
            </div>
          )}

          {/* Create Button */}
          <Button className="gap-2" onClick={handleOpenCreateModal}>
            <Icons.PlusCircle className="h-4 w-4" />
            Create New Template
          </Button>

          {/* Template List Table */}
          <div className="border rounded-lg overflow-hidden bg-white">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-300">
                  <th className="px-3 py-2 h-8 w-8">
                    <input
                      type="checkbox"
                      checked={selectedTemplates.size > 0 && selectedTemplates.size === filteredTemplates.length}
                      onChange={handleSelectAll}
                      className="rounded"
                    />
                  </th>
                  <th className="px-3 py-2 h-8 text-left font-semibold border-r border-slate-300">Template Name</th>
                  <th className="px-3 py-2 h-8 text-center font-semibold border-r border-slate-300">Languages</th>
                  <th className="px-3 py-2 h-8 text-left font-semibold border-r border-slate-300">Status</th>
                  <th className="px-3 py-2 h-8 text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTemplates.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                      No templates found
                    </td>
                  </tr>
                ) : (
                  filteredTemplates.map((template) => (
                    <tr key={template.id} className="border-b border-slate-300 hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedTemplates.has(template.id)}
                          onChange={() => handleSelectTemplate(template.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-3 py-2 border-r border-slate-300 font-medium">
                        <div className="flex items-center gap-2">
                          {template.name}
                          {template.isDefault && (
                            <Badge variant="outline" className="text-xs">Default</Badge>
                          )}
                        </div>
                        {template.description && (
                          <div className="text-xs text-muted-foreground mt-0.5">{template.description}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center border-r border-slate-300">
                        <Badge variant="secondary" className="text-xs">
                          {template.languages?.length || 0} lang
                        </Badge>
                      </td>
                      <td className="px-3 py-2 border-r border-slate-300">
                        <Switch
                          checked={template.enabled}
                          onCheckedChange={() => handleToggleTemplate(template.id)}
                          disabled={!user?.propertyId}
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex justify-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            title="Edit template details"
                            onClick={() => handleOpenEditModal(template.id)}
                          >
                            <Icons.Edit className="h-4 w-4" />
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => handleDuplicateTemplate(template.id)}
                            title="Duplicate template"
                          >
                            <Icons.Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => setDeletingTemplateId(template.id)}
                            disabled={template.isDefault}
                            title={template.isDefault ? 'Cannot delete default template' : 'Delete template'}
                            className={template.isDefault ? 'opacity-50 cursor-not-allowed' : 'text-red-600 hover:text-red-700'}
                          >
                            <Icons.X className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Delete Confirmation Dialog */}
          <AlertDialog open={deletingTemplateId !== null} onOpenChange={(open) => !open && setDeletingTemplateId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Template</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this template? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex gap-3">
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deletingTemplateId && handleDeleteTemplate(deletingTemplateId)}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Delete
                </AlertDialogAction>
              </div>
            </AlertDialogContent>
          </AlertDialog>

          {/* Create/Edit Template Modal */}
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogContent className=" fixed h-full max-h-full w-full max-w-full z-[100] sm:rounded-none">
              {/* Modal Header */}
              <div className="border-b px-6 py-4 flex justify-between items-start gap-4">
                <div className="flex-1">
                  <DialogHeader>
                    <DialogTitle>
                      {editingTemplateId ? 'Edit Template' : 'Create New Template'}
                    </DialogTitle>
                    <DialogDescription>
                      {editingTemplateId 
                        ? 'Update the template details below.'
                        : 'Fill in the template information and configure the email content.'
                      }
                    </DialogDescription>
                  </DialogHeader>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsModalOpen(false);
                      setCurrentFormData(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      formRef.current?.submitForm();
                    }}
                  >
                    Save Template
                  </Button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                <EmailTemplateForm
                  ref={formRef}
                  template={editingTemplateId 
                    ? allTemplates.find(t => t.id === editingTemplateId) || null 
                    : null
                  }
                  onSubmit={(data) => {
                    console.log('EmailTemplateForm onSubmit called with:', data);
                    setCurrentFormData(data);
                    // Handle save after setting the data
                    handleSaveAfterForm(data);
                  }}
                />
              </div>

              {/* Modal Footer - REMOVED, buttons moved to header */}
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
