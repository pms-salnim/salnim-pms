'use client';

import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { siX, siTripadvisor } from 'simple-icons';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/auth-context';
import { defaultEmailTemplateContents } from '@/lib/email-templates/defaults';
import { uploadFile } from '@/lib/uploadHelper';

export interface SignatureTemplate {
  id: string;
  propertyId: string;
  name: string;
  isDefault?: boolean;
  fullName?: string;
  propertyName?: string;
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
  logo?: string;
  socialMedia?: {
    facebook?: string;
    instagram?: string;
    x?: string;
    linkedin?: string;
    tripadvisor?: string;
  };
}

interface EmailTemplate {
  id: string;
  name: string;
  category: 'confirmation' | 'cancellation' | 'reminder' | 'marketing' | 'manual' | 'other';
  enabled: boolean;
  isDefault?: boolean;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
  ccList?: string;
  bccList?: string;
  emailType?: 'transactional' | 'marketing' | 'notification';
  subject?: string;
  preheaderText?: string;
  description?: string;
  signatureTemplateId?: string;
  // Inline signature fields
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
    x?: string;
    whatsapp?: string;
    linkedin?: string;
    tripadvisor?: string;
  };
}

const MERGE_TAGS = [
  { 
    category: 'Guest', 
    tags: [
      { tag: '{{guest_name}}', label: 'Guest Name' },
      { tag: '{{guest_phone}}', label: 'Guest Phone' },
      { tag: '{{guest_email}}', label: 'Guest Email' }
    ]
  },
  { 
    category: 'Reservation', 
    tags: [
      { tag: '{{reservation_code}}', label: 'Reservation Code' },
      { tag: '{{reservation_number}}', label: 'Reservation Number' },
      { tag: '{{check_in_date}}', label: 'Check-in Date' },
      { tag: '{{check_out_date}}', label: 'Check-out Date' },
      { tag: '{{number_of_nights}}', label: 'Number of Nights' },
      { tag: '{{number_of_guests}}', label: 'Number of Guests' }
    ]
  },
  { 
    category: 'Room', 
    tags: [
      { tag: '{{room_type}}', label: 'Room Type' },
      { tag: '{{room_number}}', label: 'Room Number' },
      { tag: '{{check_in_time}}', label: 'Check-in Time' },
      { tag: '{{check_out_time}}', label: 'Check-out Time' }
    ]
  },
  { 
    category: 'Property', 
    tags: [
      { tag: '{{property_name}}', label: 'Property Name' },
      { tag: '{{property_address}}', label: 'Property Address' },
      { tag: '{{property_phone}}', label: 'Property Phone' },
      { tag: '{{property_email}}', label: 'Property Email' },
      { tag: '{{property_website}}', label: 'Property Website' }
    ]
  },
  { 
    category: 'Pricing', 
    tags: [
      { tag: '{{total_price}}', label: 'Total Price' },
      { tag: '{{total_taxes}}', label: 'Total Taxes' },
      { tag: '{{price_breakdown}}', label: 'Price Breakdown' },
      { tag: '{{currency}}', label: 'Currency' }
    ]
  },
  { 
    category: 'Invoice', 
    tags: [
      { tag: '{{invoice_number}}', label: 'Invoice Number' },
      { tag: '{{invoice_amount}}', label: 'Invoice Amount' },
      { tag: '{{invoice_due_date}}', label: 'Invoice Due Date' }
    ]
  },
  { 
    category: 'Extras', 
    tags: [
      { tag: '{{extras}}', label: 'Additional Extras/Services' }
    ]
  }
];

interface EmailTemplateFormProps {
  template: EmailTemplate | null;
  onSubmit: (data: EmailTemplate) => void;
  isLoading?: boolean;
}

export const EmailTemplateForm = forwardRef<{ submitForm: () => void }, EmailTemplateFormProps>(function EmailTemplateForm({ template, onSubmit, isLoading = false }, ref) {
  const { user, property } = useAuth() || {};
  const currentProperty = property;
  
  const [activeTab, setActiveTab] = useState<'content' | 'settings' | 'advanced'>('content');
  const [editorMode, setEditorMode] = useState<'rich' | 'code' | 'preview'>('rich');
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [availableEmails, setAvailableEmails] = useState<Array<{ email: string; type: string }>>([]);
  const [propertyData, setPropertyData] = useState<any>(null);
  
  const [formData, setFormData] = useState<EmailTemplate>(() => {
    if (!template) {
      return {
        id: '',
        name: '',
        category: 'manual',
        enabled: true,
        fromName: '',
        fromEmail: '',
        replyTo: '',
        ccList: '',
        bccList: '',
        emailType: 'transactional',
        subject: '',
        preheaderText: '',
        description: '',
        signatureTemplateId: '',
        signatureName: '',
        signaturePropertyName: '',
        signaturePhone: '',
        signatureEmail: '',
        signatureAddress: '',
        signatureWebsite: '',
        signatureLogo: '',
        signatureSocialMedia: {},
      };
    }

    // Get default content if available
    const defaultContent = defaultEmailTemplateContents[template.id as keyof typeof defaultEmailTemplateContents];
    
    return {
      id: template.id,
      name: template.name || '',
      category: template.category || 'manual',
      enabled: template.enabled !== undefined ? template.enabled : true,
      fromName: template.fromName || '',
      fromEmail: template.fromEmail || '',
      replyTo: template.replyTo || '',
      ccList: template.ccList || '',
      bccList: template.bccList || '',
      emailType: template.emailType || 'transactional',
      subject: template.subject || defaultContent?.subject || '',
      preheaderText: template.preheaderText || defaultContent?.preheaderText || '',
      description: template.description || '',
      signatureTemplateId: template.signatureTemplateId || '',
      signatureName: template.signatureName || '',
      signaturePropertyName: template.signaturePropertyName || '',
      signaturePhone: template.signaturePhone || '',
      signatureEmail: template.signatureEmail || '',
      signatureAddress: template.signatureAddress || '',
      signatureWebsite: template.signatureWebsite || '',
      signatureLogo: template.signatureLogo || '',
      signatureSocialMedia: template.signatureSocialMedia || {},
    };
  });

  const [htmlContent, setHtmlContent] = useState(() => {
    if (!template?.id) return '';
    const defaultContent = defaultEmailTemplateContents[template.id as keyof typeof defaultEmailTemplateContents];
    return template.htmlContent || defaultContent?.htmlContent || '';
  });
  const richEditorRef = useRef<HTMLDivElement>(null);
  const selectedRangeRef = useRef<Range | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [hasSelectedText, setHasSelectedText] = useState(false);
  const [linkText, setLinkText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkEdit, setShowLinkEdit] = useState(false);
  const [editingLinkElement, setEditingLinkElement] = useState<HTMLAnchorElement | null>(null);
  const [editingLinkUrl, setEditingLinkUrl] = useState('');
  const [textColor, setTextColor] = useState('#000000');
  const [highlightColor, setHighlightColor] = useState('#FFFF00');
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableColumns, setTableColumns] = useState(3);
  const [showTestEmailDialog, setShowTestEmailDialog] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [testEmailStatus, setTestEmailStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [testEmailMessage, setTestEmailMessage] = useState('');
  const [resizingCell, setResizingCell] = useState<HTMLElement | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [imageWidth, setImageWidth] = useState('300');
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showImageEdit, setShowImageEdit] = useState(false);
  const [editingImageElement, setEditingImageElement] = useState<HTMLImageElement | null>(null);
  const [imageEditUrl, setImageEditUrl] = useState('');
  const [imageEditAlt, setImageEditAlt] = useState('');
  const [imageEditWidth, setImageEditWidth] = useState('');
  const [imageEditAlign, setImageEditAlign] = useState<'left' | 'center' | 'right'>('left');
  const [isResizingImage, setIsResizingImage] = useState(false);
  
  // Image resize state
  const [selectedImageForResize, setSelectedImageForResize] = useState<HTMLImageElement | null>(null);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [imageResizeStartX, setImageResizeStartX] = useState(0);
  const [imageResizeStartY, setImageResizeStartY] = useState(0);
  const [imageResizeOriginalWidth, setImageResizeOriginalWidth] = useState(0);
  const [imageResizeOriginalHeight, setImageResizeOriginalHeight] = useState(0);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  
  // Element styling state
  const [selectedElement, setSelectedElement] = useState<HTMLElement | null>(null);
  const [showStyleEditor, setShowStyleEditor] = useState(false);
  const [elementBgColor, setElementBgColor] = useState('');
  const [elementTextColor, setElementTextColor] = useState('');
  const [elementBorderColor, setElementBorderColor] = useState('');
  const [elementBorderWidth, setElementBorderWidth] = useState('');
  const [elementBorderRadius, setElementBorderRadius] = useState('');
  const [elementPaddingAll, setElementPaddingAll] = useState('');
  const [elementPaddingTop, setElementPaddingTop] = useState('');
  const [elementPaddingRight, setElementPaddingRight] = useState('');
  const [elementPaddingBottom, setElementPaddingBottom] = useState('');
  const [elementPaddingLeft, setElementPaddingLeft] = useState('');
  const [showIndividualPadding, setShowIndividualPadding] = useState(false);
  const [elementMarginAll, setElementMarginAll] = useState('');
  const [elementMarginTop, setElementMarginTop] = useState('');
  const [elementMarginRight, setElementMarginRight] = useState('');
  const [elementMarginBottom, setElementMarginBottom] = useState('');
  const [elementMarginLeft, setElementMarginLeft] = useState('');
  const [showIndividualMargin, setShowIndividualMargin] = useState(false);
  const [elementLineHeight, setElementLineHeight] = useState('');
  const [editButtonPosition, setEditButtonPosition] = useState({ top: 0, right: 0 });

  // Zoom state
  const [editorZoom, setEditorZoom] = useState(100);

  // SMTP emails dropdown state
  const [smtpEmails, setSmtpEmails] = useState<string[]>([]);

  // Advanced customization features state
  const [templateTrigger, setTemplateTrigger] = useState<'inquiry' | 'confirmation' | 'cancellation' | 'payment_received' | 'pre_arrival' | 'post_stay' | 'review_request' | 'custom'>('confirmation');
  const [templateLanguage, setTemplateLanguage] = useState('en');
  const [fallbackLanguage, setFallbackLanguage] = useState('en');
  const [enableLanguageVariant, setEnableLanguageVariant] = useState(false);
  
  // Global branding colors
  const [brandingColors, setBrandingColors] = useState({
    primary: '#0f172a',
    secondary: '#64748b',
    accent: '#3b82f6',
    bgColor: '#ffffff',
    borderColor: '#e2e8f0',
  });

  // Merge tag autocomplete
  const [mergeTagSearch, setMergeTagSearch] = useState('');
  const [showMergeTagSuggestions, setShowMergeTagSuggestions] = useState(false);
  const [selectedMergeTagIndex, setSelectedMergeTagIndex] = useState(0);
  
  // Conditional content rules
  const [conditionalRules, setConditionalRules] = useState<Record<string, any>>({});
  const [showConditionalEditor, setShowConditionalEditor] = useState(false);
  
  // Reusable content blocks
  const [reusableBlocks, setReusableBlocks] = useState<Array<{
    id: string;
    name: string;
    type: 'signature' | 'footer' | 'legal' | 'social' | 'custom';
    content: string;
    isActive: boolean;
  }>>([]);

  // Template versioning
  const [templateVersions, setTemplateVersions] = useState<Array<any>>([]);
  const [currentVersion, setCurrentVersion] = useState(1);
  const [isDraft, setIsDraft] = useState(false);
  const [draftChanges, setDraftChanges] = useState('');

  // Personalization settings
  const [enablePersonalization, setEnablePersonalization] = useState({
    language: true,
    roomType: false,
    paymentStatus: false,
    guestNationality: false,
    otaSource: false,
  });



  // Fetch property data including contact info
  useEffect(() => {
    const fetchPropertyData = async () => {
      if (!currentProperty?.id) return;
      try {
        const contactDoc = await getDoc(doc(db, 'properties', currentProperty.id, 'settings', 'contact'));
        const infosDoc = await getDoc(doc(db, 'properties', currentProperty.id, 'settings', 'infos'));
        const propertyDoc = await getDoc(doc(db, 'properties', currentProperty.id));
        
        if (contactDoc.exists() || infosDoc.exists() || propertyDoc.exists()) {
          setPropertyData({
            contact: contactDoc.data() || {},
            infos: infosDoc.data() || {},
            main: propertyDoc.data() || {},
          });
          
          // Build available emails list
          const emails: Array<{ email: string; type: string }> = [];
          const contactData = contactDoc.data() || {};
          
          if (contactData.primaryEmail) {
            emails.push({ email: contactData.primaryEmail, type: 'Primary Property Email' });
          }
          
          if (contactData.departmentContacts && Array.isArray(contactData.departmentContacts)) {
            contactData.departmentContacts.forEach((dept: any) => {
              if (dept.type === 'email') {
                emails.push({ email: dept.value, type: `${dept.departmentName} - Email` });
              }
            });
          }
          
          setAvailableEmails(emails);
        }
      } catch (error) {
        console.error('Error fetching property data:', error);
      }
    };

    fetchPropertyData();
  }, [currentProperty?.id]);

  // Fetch SMTP configured emails
  useEffect(() => {
    const fetchSmtpEmails = async () => {
      if (!currentProperty?.id) return;

      try {
        const { getDoc } = await import('firebase/firestore');
        const propertyRef = doc(db, 'properties', currentProperty.id);
        const propertyDoc = await getDoc(propertyRef);

        if (propertyDoc.exists()) {
          const data = propertyDoc.data();
          const emailConfigs = data?.communicationChannelSettings?.emailConfigurations || [];
          const emails = emailConfigs
            .filter((config: any) => config.smtpUser)
            .map((config: any) => config.smtpUser);
          
          setSmtpEmails(emails);
          
          // Set first SMTP email as default if fromEmail is empty
          if (!formData.fromEmail && emails.length > 0) {
            handleChange('fromEmail', emails[0]);
          }
        }
      } catch (error) {
        console.error('Error fetching SMTP emails:', error);
      }
    };

    fetchSmtpEmails();
  }, [currentProperty?.id]);

  useEffect(() => {
    if (template) {
      setFormData({
        id: template.id || '',
        name: template.name || '',
        category: template.category || 'manual',
        enabled: template.enabled !== undefined ? template.enabled : true,
        fromName: template.fromName || '',
        fromEmail: template.fromEmail || '',
        replyTo: template.replyTo || '',
        subject: template.subject || '',
        preheaderText: template.preheaderText || '',
        description: template.description || '',
        signatureTemplateId: template.signatureTemplateId || '',
        signatureName: template.signatureName || '',
        signaturePropertyName: template.signaturePropertyName || '',
        signaturePhone: template.signaturePhone || '',
        signatureEmail: template.signatureEmail || '',
        signatureAddress: template.signatureAddress || '',
        signatureWebsite: template.signatureWebsite || '',
        signatureLogo: template.signatureLogo || '',
        signatureSocialMedia: template.signatureSocialMedia || {},
      });
      // Load HTML content from the template, with fallback to defaults
      const defaultContent = defaultEmailTemplateContents[template.id as keyof typeof defaultEmailTemplateContents];
      let contentToLoad = template.htmlContent || defaultContent?.htmlContent || '';
      
      // Replace property placeholders with actual property data
      if (currentProperty) {
        contentToLoad = contentToLoad.replace(/\{property\.logo\}/g, currentProperty.logoUrl || '');
        contentToLoad = contentToLoad.replace(/\{property\.name\}/g, currentProperty.name || '');
        contentToLoad = contentToLoad.replace(/\{property\.address\}/g, currentProperty.address || '');
        contentToLoad = contentToLoad.replace(/\{property\.phone\}/g, currentProperty.phone || '');
        contentToLoad = contentToLoad.replace(/\{property\.email\}/g, currentProperty.email || '');
        contentToLoad = contentToLoad.replace(/\{property\.website\}/g, currentProperty.website || '');
      }
      
      setHtmlContent(contentToLoad);
      console.log('Template loaded - htmlContent:', contentToLoad);
    }
  }, [template?.id]); // Only reset when template ID changes, not when the entire object reference changes

  useEffect(() => {
    if (richEditorRef.current && editorMode === 'rich') {
      // Only set innerHTML if it's different from current content
      if (richEditorRef.current.innerHTML !== htmlContent) {
        richEditorRef.current.innerHTML = htmlContent;
        // Attach resize listeners to any tables in the content
        setTimeout(() => {
          attachTableResizeListeners();
        }, 100);
      }
    }
  }, [editorMode]);

  // Handle column resize for tables
  useEffect(() => {
    if (!resizingCell) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingCell) return;
      
      const diff = e.clientX - resizeStartX;
      const newWidth = resizeStartWidth + diff;
      
      resizingCell.style.width = newWidth + 'px';
    };
    
    const handleMouseUp = () => {
      if (resizingCell && richEditorRef.current) {
        setHtmlContent(richEditorRef.current.innerHTML);
      }
      setResizingCell(null);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingCell, resizeStartX, resizeStartWidth]);

  const handleChange = (field: keyof EmailTemplate, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    // Include htmlContent and richEditorRef content in the submission
    const rawHtmlContent = editorMode === 'rich' && richEditorRef.current ? richEditorRef.current.innerHTML : htmlContent;
    const processedHtmlContent = processTemplateContent(rawHtmlContent);
    
    const submissionData = {
      ...formData,
      id: formData.id || '', // Ensure id is always present
      htmlContent: processedHtmlContent,
    };
    console.log('Form submitting with data:', submissionData);
    onSubmit(submissionData);
  };

  // Expose submit method through ref
  useImperativeHandle(ref, () => ({
    submitForm: handleSubmit,
  }), [formData, htmlContent, editorMode, onSubmit]);

  const sendTestEmail = async () => {
    if (!testEmailAddress || !testEmailAddress.includes('@')) {
      setTestEmailStatus('error');
      setTestEmailMessage('Please enter a valid email address');
      return;
    }

    if (!user?.propertyId) {
      setTestEmailStatus('error');
      setTestEmailMessage('Property ID not found. Please refresh the page.');
      return;
    }

    setIsSendingTestEmail(true);
    setTestEmailStatus('idle');
    setTestEmailMessage('');

    try {
      // Fetch property's SMTP configuration from Firestore
      // Config is saved at: properties/{propertyId}.communicationChannelSettings.emailConfigurations
      const { getDoc } = await import('firebase/firestore');
      const propertyRef = doc(db, 'properties', user.propertyId);
      const propertyDoc = await getDoc(propertyRef);
      
      let smtpConfig = {
        smtpHost: '',
        smtpPort: 587,
        smtpUser: '',
        smtpPass: '',
      };

      if (propertyDoc.exists()) {
        const data = propertyDoc.data();
        const emailConfigs = data?.communicationChannelSettings?.emailConfigurations || [];
        const primaryConfig = emailConfigs.find((config: any) => config.enabled) || emailConfigs[0];
        
        if (primaryConfig) {
          smtpConfig = {
            smtpHost: primaryConfig.smtpHost || '',
            smtpPort: primaryConfig.smtpPort || 587,
            smtpUser: primaryConfig.smtpUser || '',
            smtpPass: primaryConfig.smtpPass || '',
          };
        }
      }

      // Validate that SMTP is configured
      if (!smtpConfig.smtpHost || !smtpConfig.smtpUser || !smtpConfig.smtpPass) {
        setTestEmailStatus('error');
        setTestEmailMessage('SMTP configuration not found. Please configure email settings first.');
        setIsSendingTestEmail(false);
        return;
      }

      const emailContent = editorMode === 'rich' && richEditorRef.current 
        ? richEditorRef.current.innerHTML 
        : htmlContent;

      const testPayload = {
        templateId: formData.id || 'test-template',
        recipientEmail: testEmailAddress,
        subject: formData.subject,
        htmlContent: processTemplateContent(emailContent) + generateSignatureHtml(),
        preheaderText: formData.preheaderText,
        fromName: formData.fromName,
        fromEmail: formData.fromEmail,
        replyTo: formData.replyTo,
        smtpConfig: smtpConfig,
      };

      // Call the sendTestEmail Firebase function with SMTP config (europe-west1 region)
      const { httpsCallable } = await import('firebase/functions');
      const { functionsEurope } = await import('@/lib/firebase');
      
      const sendTestEmailFn = httpsCallable(functionsEurope, 'sendTestEmail');
      const response = await sendTestEmailFn(testPayload);

      setTestEmailStatus('success');
      setTestEmailMessage(`Test email sent successfully to ${testEmailAddress}`);
      setShowTestEmailDialog(false);
      setTestEmailAddress('');

      // Reset status after 5 seconds
      setTimeout(() => {
        setTestEmailStatus('idle');
        setTestEmailMessage('');
      }, 5000);
    } catch (error: any) {
      console.error('Error sending test email:', error);
      setTestEmailStatus('error');
      setTestEmailMessage(error.message || 'Failed to send test email. Please try again.');
    } finally {
      setIsSendingTestEmail(false);
    }
  };





  const autoFillSignature = () => {
    if (!propertyData && !currentProperty) return;
    
    const contactData = propertyData?.contact || {};
    
    // Build address: Street address, zip code, city from property object
    const addressParts = [];
    if (currentProperty?.address) addressParts.push(currentProperty.address);
    if (currentProperty?.phone) addressParts.push(currentProperty.phone);
    if (currentProperty?.city) addressParts.push(currentProperty.city);
    const fullAddress = addressParts.join(', ');
    
    setFormData(prev => ({
      ...prev,
      signatureName: user?.name || '',
      signaturePropertyName: currentProperty?.name || '',
      signaturePhone: contactData.primaryPhone || currentProperty?.phone || '',
      signatureEmail: contactData.primaryEmail || currentProperty?.email || '',
      signatureAddress: fullAddress || (currentProperty?.address ? currentProperty.address : ''),
      signatureWebsite: contactData.websiteUrl || currentProperty?.website || '',
      signatureLogo: currentProperty?.logoUrl || '',
    }));
  };

  const insertMergeTag = (tag: string) => {
    if (editorMode === 'rich') {
      // Insert at cursor position in rich text editor
      richEditorRef.current?.focus();
      setTimeout(() => {
        document.execCommand('insertHTML', false, `<span class="bg-blue-100 text-blue-700 px-1 rounded font-mono text-xs font-semibold">${tag}</span> `);
        richEditorRef.current?.focus();
      }, 0);
    } else {
      // Append to end for visual/code modes
      setHtmlContent(prev => prev + tag);
    }
  };

  const handleRichEditorChange = (e: React.FormEvent<HTMLDivElement>) => {
    const newContent = e.currentTarget.innerHTML;
    setHtmlContent(newContent);
  };

  const handleRichEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Handle image deletion when image is selected
    if ((e.key === 'Backspace' || e.key === 'Delete') && selectedImageForResize) {
      e.preventDefault();
      
      // Delete the entire image wrapper
      const wrapper = selectedImageForResize.parentElement;
      if (wrapper?.classList.contains('image-resize-wrapper')) {
        wrapper.remove();
      } else {
        selectedImageForResize.remove();
      }
      
      // Clear selection state
      setSelectedImageForResize(null);
      
      // Update content
      if (richEditorRef.current) {
        setHtmlContent(richEditorRef.current.innerHTML);
      }
      
      // Focus back on editor
      richEditorRef.current?.focus();
      return;
    }
    
    // Handle Enter key inside styled containers to prevent container duplication
    if (e.key === 'Enter') {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      
      // Find the closest styled element
      let element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container as HTMLElement;
      
      // If we're inside or next to an image wrapper, deselect the image and move cursor outside
      while (element && element !== richEditorRef.current) {
        if (element.classList.contains('image-resize-wrapper')) {
          e.preventDefault();
          
          // Deselect the image
          cleanupAllImageSelections();
          
          // Create a new paragraph after the wrapper
          const br = document.createElement('br');
          element.parentNode?.insertBefore(br, element.nextSibling);
          
          // Move cursor after the break
          const newRange = document.createRange();
          newRange.setStartAfter(br);
          newRange.setEndAfter(br);
          selection.removeAllRanges();
          selection.addRange(newRange);
          
          // Update content
          if (richEditorRef.current) {
            setHtmlContent(richEditorRef.current.innerHTML);
          }
          return;
        }
        
        const isUserButton = element.getAttribute('data-user-button') === 'true';
        const isUserContainer = element.getAttribute('data-user-container') === 'true';
        
        // Only handle Enter for user containers, not for buttons
        if (isUserContainer && !isUserButton) {
          e.preventDefault();
          
          // Insert a line break
          const br = document.createElement('br');
          range.deleteContents();
          range.insertNode(br);
          
          // Move cursor after the line break
          range.setStartAfter(br);
          range.setEndAfter(br);
          selection.removeAllRanges();
          selection.addRange(range);
          
          // Update content
          if (richEditorRef.current) {
            setHtmlContent(richEditorRef.current.innerHTML);
          }
          return;
        }
        element = element.parentElement as HTMLElement;
      }
    }
    
    // Prevent deletion of container elements (buttons, links, divs) when they would become empty
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      
      // Find the closest user-inserted element
      let element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container as HTMLElement;
      
      // Check if we're inside a user-inserted button or container
      while (element && element !== richEditorRef.current) {
        const isUserButton = element.getAttribute('data-user-button') === 'true';
        const isUserContainer = element.getAttribute('data-user-container') === 'true';
        
        if (isUserButton || isUserContainer) {
          const textContent = element.textContent || '';
          const trimmedContent = textContent.trim();
          
          // If the element only has 1 character or less (or will be empty after this keystroke)
          if (trimmedContent.length <= 1) {
            e.preventDefault();
            // Clear element completely and create a proper empty state
            element.textContent = '';
            
            // Add a placeholder text node
            const textNode = document.createTextNode('');
            element.appendChild(textNode);
            
            // Position cursor at the start of the text node
            const newRange = document.createRange();
            newRange.setStart(textNode, 0);
            newRange.setEnd(textNode, 0);
            selection.removeAllRanges();
            selection.addRange(newRange);
            
            // Update content
            if (richEditorRef.current) {
              setHtmlContent(richEditorRef.current.innerHTML);
            }
            return;
          }
          break;
        }
        element = element.parentElement as HTMLElement;
      }
    }
  };

  const execCommand = (command: string, value?: string) => {
    richEditorRef.current?.focus();
    setTimeout(() => {
      document.execCommand(command, false, value);
      richEditorRef.current?.focus();
    }, 0);
  };

  const handleRichEditorDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    
    // Check if double-click is on or inside user-inserted containers/buttons
    let element = target;
    let styledElement: HTMLElement | null = null;
    
    while (element && element !== richEditorRef.current) {
      const isUserButton = element.getAttribute('data-user-button') === 'true';
      const isUserContainer = element.getAttribute('data-user-container') === 'true';
      
      if (isUserButton || isUserContainer) {
        styledElement = element;
        break;
      }
      element = element.parentElement as HTMLElement;
    }
    
    // If double-click is on a styled element, move cursor outside of it
    if (styledElement && richEditorRef.current) {
      e.preventDefault();
      
      const selection = window.getSelection();
      if (selection) {
        // Create a line break after the styled element
        const br = document.createElement('br');
        
        // Insert the break after the styled element
        if (styledElement.nextSibling) {
          styledElement.parentNode?.insertBefore(br, styledElement.nextSibling);
        } else {
          styledElement.parentNode?.appendChild(br);
        }
        
        // Add another break for proper spacing
        const br2 = document.createElement('br');
        if (br.nextSibling) {
          br.parentNode?.insertBefore(br2, br.nextSibling);
        } else {
          br.parentNode?.appendChild(br2);
        }
        
        // Position cursor after the first break
        const range = document.createRange();
        range.setStartAfter(br);
        range.setEndAfter(br);
        selection.removeAllRanges();
        selection.addRange(range);
        
        richEditorRef.current.focus();
        setHtmlContent(richEditorRef.current.innerHTML);
      }
    }
  };

  const handleInsertLink = () => {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();
    
    // Close all other panels first
    setShowLinkEdit(false);
    setShowImageDialog(false);
    setShowImageEdit(false);
    setShowStyleEditor(false);
    setShowTableDialog(false);
    cleanupAllImageSelections();
    setEditingImageElement(null);
    setSelectedElement(null);
    
    // Store the selection range if text is selected
    if (selectedText && selection && selection.rangeCount > 0) {
      selectedRangeRef.current = selection.getRangeAt(0);
      setHasSelectedText(true);
      setLinkText(selectedText);
      setLinkUrl('');
    } else {
      // No text selected
      selectedRangeRef.current = null;
      setHasSelectedText(false);
      setLinkText('');
      setLinkUrl('');
    }
    setShowLinkForm(true);
  };

  const handleCreateLink = () => {
    if (!linkUrl.trim()) return;
    
    // Ensure URL has protocol
    let url = linkUrl.trim();
    if (!url.match(/^https?:\/\//)) {
      url = 'https://' + url;
    }
    
    if (hasSelectedText && selectedRangeRef.current) {
      // Restore the selection range before applying the link
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(selectedRangeRef.current);
      }
      // Apply link to selected text
      document.execCommand('createLink', false, url);
    } else if (linkText.trim()) {
      // Create link with custom text
      richEditorRef.current?.focus();
      setTimeout(() => {
        document.execCommand('insertHTML', false, `<a href="${url}">${linkText}</a>`);
      }, 0);
    }
    
    richEditorRef.current?.focus();
    setLinkUrl('');
    setLinkText('');
    setShowLinkForm(false);
    selectedRangeRef.current = null;
  };

  const handleLinkClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    
    if (target.tagName === 'A') {
      e.preventDefault();
      const linkElement = target as HTMLAnchorElement;
      const href = linkElement.getAttribute('href') || '';
      
      // Close all other panels
      setShowLinkForm(false);
      setShowImageDialog(false);
      setShowImageEdit(false);
      setShowStyleEditor(false);
      setShowTableDialog(false);
      cleanupAllImageSelections();
      setEditingImageElement(null);
      setSelectedElement(null);
      
      setEditingLinkElement(linkElement);
      setEditingLinkUrl(href);
      setShowLinkEdit(true);
    }
    
    // Handle image clicks for resize functionality
    if (target.tagName === 'IMG') {
      e.preventDefault();
      e.stopPropagation(); // Prevent container selection when clicking images
      const imgElement = target as HTMLImageElement;
      handleImageSelect(imgElement);
      return; // Don't process other click handlers
    }
  };

  const handleElementClick = (e: React.MouseEvent<HTMLDivElement>) => {
    let target = e.target as HTMLElement;
    
    // Skip if clicking on a link (handle separately)
    if (target.tagName === 'A' && !target.className.includes('btn')) {
      return;
    }
    
    // Skip if clicking on an image (handle separately)
    if (target.tagName === 'IMG') {
      return;
    }
    
    // Helper function to check if element is styleable
    const isStyleableElement = (el: HTMLElement): boolean => {
      const tagName = el.tagName.toLowerCase();
      const hasClass = typeof el.className === 'string' && el.className.length > 0;
      
      return (
        tagName === 'td' || 
        tagName === 'table' ||
        (tagName === 'div' && el.getAttribute('data-user-container') === 'true') ||
        (tagName === 'a' && el.getAttribute('data-user-button') === 'true') ||
        (tagName === 'a' && hasClass && (el.className.includes('btn') || el.className.includes('button'))) ||
        ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName) ||
        (hasClass && (el.className.includes('header') || el.className.includes('content') || el.className.includes('details-box') || el.className.includes('cta-container')))
      );
    };
    
    // First, check if the clicked element itself is styleable
    if (isStyleableElement(target)) {
      e.stopPropagation();
      selectElement(target);
      return;
    }
    
    // If not, traverse upward to find the closest styleable element
    while (target && target !== richEditorRef.current) {
      target = target.parentElement as HTMLElement;
      
      if (target && isStyleableElement(target)) {
        e.stopPropagation();
        selectElement(target);
        return;
      }
    }
  };

  // Helper function to select and configure an element
  const selectElement = (target: HTMLElement) => {
    // Close all other panels
    setShowLinkForm(false);
    setShowLinkEdit(false);
    setShowTableDialog(false);
    setShowImageDialog(false);
    setShowImageEdit(false);
    cleanupAllImageSelections();
    setEditingImageElement(null);
    setEditingLinkElement(null);
    
    // Clean up previous selection's visual indicator
    if (selectedElement && selectedElement !== target) {
      selectedElement.classList.remove('editor-selected');
    }
    
    setSelectedElement(target);
    
    // Get current styles from element
    const computedStyle = window.getComputedStyle(target);
    const bgcolor = target.style.backgroundColor || computedStyle.backgroundColor;
    const txtcolor = target.style.color || computedStyle.color;
    const bordercolor = target.style.borderColor || computedStyle.borderColor;
    const borderwidth = target.style.borderWidth || computedStyle.borderWidth;
    const borderradius = target.style.borderRadius || computedStyle.borderRadius;
    const paddingtop = target.style.paddingTop || computedStyle.paddingTop;
    const paddingright = target.style.paddingRight || computedStyle.paddingRight;
    const paddingbottom = target.style.paddingBottom || computedStyle.paddingBottom;
    const paddingleft = target.style.paddingLeft || computedStyle.paddingLeft;
    const margintop = target.style.marginTop || computedStyle.marginTop;
    const marginright = target.style.marginRight || computedStyle.marginRight;
    const marginbottom = target.style.marginBottom || computedStyle.marginBottom;
    const marginleft = target.style.marginLeft || computedStyle.marginLeft;
    const lineheight = target.style.lineHeight || computedStyle.lineHeight;
    
    setElementBgColor(rgbToHex(bgcolor) || '');
    setElementTextColor(rgbToHex(txtcolor) || '');
    setElementBorderColor(rgbToHex(bordercolor) || '');
    setElementBorderWidth(extractNumericValue(borderwidth));
    setElementBorderRadius(extractNumericValue(borderradius));
    setElementPaddingTop(extractNumericValue(paddingtop));
    setElementPaddingRight(extractNumericValue(paddingright));
    setElementPaddingBottom(extractNumericValue(paddingbottom));
    setElementPaddingLeft(extractNumericValue(paddingleft));
    setElementMarginTop(extractNumericValue(margintop));
    setElementMarginRight(extractNumericValue(marginright));
    setElementMarginBottom(extractNumericValue(marginbottom));
    setElementMarginLeft(extractNumericValue(marginleft));
    setElementLineHeight(extractNumericValue(lineheight));
    
    // Check if all padding values are the same
    if (paddingtop === paddingright && paddingright === paddingbottom && paddingbottom === paddingleft) {
      setElementPaddingAll(extractNumericValue(paddingtop));
      setShowIndividualPadding(false);
    } else {
      setElementPaddingAll('');
      setShowIndividualPadding(true);
    }
    
    // Check if all margin values are the same
    if (margintop === marginright && marginright === marginbottom && marginbottom === marginleft) {
      setElementMarginAll(extractNumericValue(margintop));
      setShowIndividualMargin(false);
    } else {
      setElementMarginAll('');
      setShowIndividualMargin(true);
    }
    
    // Do NOT auto-open style editor - user clicks pen icon instead
    // Add visual selection class to the element
    if (target) {
      target.classList.add('editor-selected');
    }
  };

  const rgbToHex = (rgb: string): string => {
    if (!rgb || rgb === 'transparent') return '';
    if (rgb.startsWith('#')) return rgb;
    
    const result = rgb.match(/\d+/g);
    if (!result || result.length < 3) return '';
    
    const r = parseInt(result[0]);
    const g = parseInt(result[1]);
    const b = parseInt(result[2]);
    
    return '#' + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  };

  const extractNumericValue = (cssValue: string): string => {
    if (!cssValue) return '';
    const match = cssValue.match(/^([\d.]+)/);
    return match ? match[1] : '';
  };

  const applyElementStyle = (property: 'backgroundColor' | 'color' | 'borderColor' | 'borderWidth' | 'borderRadius' | 'padding' | 'paddingTop' | 'paddingRight' | 'paddingBottom' | 'paddingLeft' | 'margin' | 'marginTop' | 'marginRight' | 'marginBottom' | 'marginLeft' | 'lineHeight', value: string) => {
    if (!selectedElement) return;
    
    selectedElement.style[property] = value;
    
    if (richEditorRef.current) {
      setHtmlContent(richEditorRef.current.innerHTML);
    }
  };

  const applyPaddingAll = (value: string) => {
    if (!selectedElement) return;
    
    const cssValue = value ? `${value}px` : '';
    selectedElement.style.padding = cssValue;
    setElementPaddingTop(value);
    setElementPaddingRight(value);
    setElementPaddingBottom(value);
    setElementPaddingLeft(value);
    
    if (richEditorRef.current) {
      setHtmlContent(richEditorRef.current.innerHTML);
    }
  };

  const applyMarginAll = (value: string) => {
    if (!selectedElement) return;
    
    const cssValue = value ? `${value}px` : '';
    selectedElement.style.margin = cssValue;
    setElementMarginTop(value);
    setElementMarginRight(value);
    setElementMarginBottom(value);
    setElementMarginLeft(value);
    
    if (richEditorRef.current) {
      setHtmlContent(richEditorRef.current.innerHTML);
    }
  };

  const handleDeleteElement = () => {
    if (selectedElement) {
      selectedElement.remove();
      setShowStyleEditor(false);
      setSelectedElement(null);
      if (richEditorRef.current) {
        setHtmlContent(richEditorRef.current.innerHTML);
      }
      richEditorRef.current?.focus();
    }
  };

  const handleUpdateLink = () => {
    if (editingLinkElement && editingLinkUrl.trim()) {
      let url = editingLinkUrl.trim();
      if (!url.match(/^https?:\/\//)) {
        url = 'https://' + url;
      }
      editingLinkElement.setAttribute('href', url);
      setShowLinkEdit(false);
      setEditingLinkElement(null);
      setEditingLinkUrl('');
      richEditorRef.current?.focus();
    }
  };

  const handleDeleteLink = () => {
    if (editingLinkElement) {
      const text = editingLinkElement.textContent || '';
      richEditorRef.current?.focus();
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editingLinkElement);
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
      document.execCommand('unlink', false);
      setShowLinkEdit(false);
      setEditingLinkElement(null);
      setEditingLinkUrl('');
    }
  };

  const handleInsertImage = () => {
    // Close all other panels
    setShowLinkForm(false);
    setShowLinkEdit(false);
    setShowImageEdit(false);
    setShowStyleEditor(false);
    setShowTableDialog(false);
    cleanupAllImageSelections();
    setEditingImageElement(null);
    setEditingLinkElement(null);
    setSelectedElement(null);
    
    // Trigger file picker directly
    imageFileInputRef.current?.click();
  };

  const handleImageFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploadingImage(true);
    try {
      // Upload the file
      const uploadPath = `email-templates/${currentProperty?.id || 'default'}/images`;
      const finalImageUrl = await uploadFile(uploadPath, file);
      
      // Insert the image into the editor
      richEditorRef.current?.focus();
      const imgHtml = `<img src="${finalImageUrl}" alt="${file.name}" style="max-width: 100%; height: auto; display: block; margin: 10px 0;" />`;
      document.execCommand('insertHTML', false, imgHtml);
      
      // Update content
      if (richEditorRef.current) {
        setHtmlContent(richEditorRef.current.innerHTML);
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setIsUploadingImage(false);
      // Reset the input so the same file can be selected again
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  const handleUpdateImage = () => {
    if (!editingImageElement) return;
    
    // Update image properties
    editingImageElement.src = imageEditUrl;
    editingImageElement.alt = imageEditAlt;
    editingImageElement.style.maxWidth = `${imageEditWidth}px`;
    editingImageElement.style.width = `${imageEditWidth}px`;
    editingImageElement.style.height = 'auto';
    
    // Apply alignment
    if (imageEditAlign === 'center') {
      editingImageElement.style.display = 'block';
      editingImageElement.style.marginLeft = 'auto';
      editingImageElement.style.marginRight = 'auto';
    } else if (imageEditAlign === 'right') {
      editingImageElement.style.display = 'block';
      editingImageElement.style.marginLeft = 'auto';
      editingImageElement.style.marginRight = '0';
    } else {
      editingImageElement.style.display = 'block';
      editingImageElement.style.marginLeft = '0';
      editingImageElement.style.marginRight = 'auto';
    }
    
    // Clean up wrapper and handles
    cleanupImageSelection(editingImageElement);
    
    if (richEditorRef.current) {
      setHtmlContent(richEditorRef.current.innerHTML);
    }
    
    setShowImageEdit(false);
    setEditingImageElement(null);
    richEditorRef.current?.focus();
  };

  // Cleanup image resize handles
  const cleanupImageSelection = (imgElement: HTMLImageElement | null) => {
    if (!imgElement) return;
    
    const wrapper = imgElement.parentElement;
    if (wrapper?.classList.contains('image-resize-wrapper')) {
      const handles = wrapper.querySelectorAll('.resize-handle');
      handles.forEach(h => h.remove());
      wrapper.style.outline = '';
    }
  };

  const cleanupAllImageSelections = () => {
    const allWrappers = richEditorRef.current?.querySelectorAll('.image-resize-wrapper');
    allWrappers?.forEach(wrapper => {
      const handles = wrapper.querySelectorAll('.resize-handle');
      handles.forEach(h => h.remove());
      (wrapper as HTMLElement).style.outline = '';
    });
    setSelectedImageForResize(null);
  };

  // Handle image selection and create resize handles
  const handleImageSelect = (imgElement: HTMLImageElement) => {
    // Clean up any existing selections
    cleanupAllImageSelections();
    
    // Wrap image in resize wrapper if not already wrapped
    let wrapper = imgElement.parentElement;
    if (!wrapper?.classList.contains('image-resize-wrapper')) {
      wrapper = document.createElement('span');
      wrapper.className = 'image-resize-wrapper';
      wrapper.style.position = 'relative';
      wrapper.style.display = 'inline-block';
      wrapper.style.maxWidth = '100%';
      
      imgElement.parentNode?.insertBefore(wrapper, imgElement);
      wrapper.appendChild(imgElement);
    } else {
      // If wrapper already exists, make sure to remove any existing handles first
      const existingHandles = wrapper.querySelectorAll('.resize-handle');
      existingHandles.forEach(h => h.remove());
    }
    
    // Add selection outline
    wrapper.style.outline = '2px solid #3b82f6';
    wrapper.style.outlineOffset = '2px';
    
    // Create resize handles only once
    const handlePositions = [
      { pos: 'nw', cursor: 'nw-resize', top: '-6px', left: '-6px' },
      { pos: 'n', cursor: 'n-resize', top: '-6px', left: '50%', transform: 'translateX(-50%)' },
      { pos: 'ne', cursor: 'ne-resize', top: '-6px', right: '-6px' },
      { pos: 'e', cursor: 'e-resize', top: '50%', right: '-6px', transform: 'translateY(-50%)' },
      { pos: 'se', cursor: 'se-resize', bottom: '-6px', right: '-6px' },
      { pos: 's', cursor: 's-resize', bottom: '-6px', left: '50%', transform: 'translateX(-50%)' },
      { pos: 'sw', cursor: 'sw-resize', bottom: '-6px', left: '-6px' },
      { pos: 'w', cursor: 'w-resize', top: '50%', left: '-6px', transform: 'translateY(-50%)' }
    ];
    
    handlePositions.forEach(({ pos, cursor, top, left, right, bottom, transform }) => {
      const handle = document.createElement('div');
      handle.className = 'resize-handle';
      handle.dataset.position = pos;
      handle.style.position = 'absolute';
      handle.style.width = '12px';
      handle.style.height = '12px';
      handle.style.backgroundColor = '#3b82f6';
      handle.style.border = '2px solid white';
      handle.style.borderRadius = '50%';
      handle.style.cursor = cursor;
      handle.style.zIndex = '1000';
      handle.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)'; // Inline to prevent accumulation
      
      if (top) handle.style.top = top;
      if (left) handle.style.left = left;
      if (right) handle.style.right = right;
      if (bottom) handle.style.bottom = bottom;
      if (transform) handle.style.transform = transform;
      
      handle.addEventListener('mousedown', (e) => handleResizeStart(e, imgElement, pos));
      
      wrapper.appendChild(handle);
    });
    
    setSelectedImageForResize(imgElement);
  };

  // Start resizing
  const handleResizeStart = (e: MouseEvent, imgElement: HTMLImageElement, position: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    setResizeHandle(position);
    setImageResizeStartX(e.clientX);
    setImageResizeStartY(e.clientY);
    setImageResizeOriginalWidth(imgElement.width);
    setImageResizeOriginalHeight(imgElement.height);
    setIsResizingImage(true);
  };

  // Handle mouse move during resize
  const handleResizeMove = (e: MouseEvent) => {
    if (!isResizingImage || !selectedImageForResize || !resizeHandle) return;
    
    const deltaX = e.clientX - imageResizeStartX;
    const deltaY = e.clientY - imageResizeStartY;
    const aspectRatio = imageResizeOriginalWidth / imageResizeOriginalHeight;
    
    let newWidth = imageResizeOriginalWidth;
    let newHeight = imageResizeOriginalHeight;
    
    // Calculate new dimensions based on handle position
    if (resizeHandle.includes('e')) {
      newWidth = Math.max(50, imageResizeOriginalWidth + deltaX);
    } else if (resizeHandle.includes('w')) {
      newWidth = Math.max(50, imageResizeOriginalWidth - deltaX);
    }
    
    if (resizeHandle.includes('s')) {
      newHeight = Math.max(50, imageResizeOriginalHeight + deltaY);
    } else if (resizeHandle.includes('n')) {
      newHeight = Math.max(50, imageResizeOriginalHeight - deltaY);
    }
    
    // Maintain aspect ratio by default (unless Shift is pressed)
    if (!e.shiftKey) {
      // For corner handles, use the dimension that changed more
      if (resizeHandle.length === 2) {
        const widthChange = Math.abs(newWidth - imageResizeOriginalWidth);
        const heightChange = Math.abs(newHeight - imageResizeOriginalHeight);
        
        if (widthChange > heightChange) {
          newHeight = newWidth / aspectRatio;
        } else {
          newWidth = newHeight * aspectRatio;
        }
      } else {
        // For side handles, maintain aspect ratio
        if (resizeHandle === 'e' || resizeHandle === 'w') {
          newHeight = newWidth / aspectRatio;
        } else {
          newWidth = newHeight * aspectRatio;
        }
      }
    }
    
    // Apply dimensions
    selectedImageForResize.style.width = `${newWidth}px`;
    selectedImageForResize.style.height = `${newHeight}px`;
    
    // Update wrapper max-width
    const wrapper = selectedImageForResize.parentElement;
    if (wrapper?.classList.contains('image-resize-wrapper')) {
      wrapper.style.maxWidth = '100%';
    }
  };

  // Finish resizing
  const handleResizeEnd = () => {
    if (isResizingImage && selectedImageForResize) {
      // Persist the dimensions
      if (richEditorRef.current) {
        setHtmlContent(richEditorRef.current.innerHTML);
      }
    }
    
    setIsResizingImage(false);
    setResizeHandle(null);
  };

  const closeAllPanels = () => {
    setShowLinkForm(false);
    setShowLinkEdit(false);
    setShowImageEdit(false);
    setShowStyleEditor(false);
    setShowTableDialog(false);
    cleanupAllImageSelections();
    setEditingImageElement(null);
    setEditingLinkElement(null);
    setSelectedElement(null);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape key closes all panels
      if (e.key === 'Escape') {
        if (showLinkForm || showLinkEdit || showImageEdit || showStyleEditor || showTableDialog) {
          e.preventDefault();
          closeAllPanels();
          richEditorRef.current?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showLinkForm, showLinkEdit, showImageEdit, showStyleEditor, showTableDialog]);

  // Image resize mouse event listeners
  useEffect(() => {
    if (isResizingImage) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizingImage, selectedImageForResize, resizeHandle, imageResizeStartX, imageResizeStartY, imageResizeOriginalWidth, imageResizeOriginalHeight]);

  // Track Shift key for free resize
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(true);
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(false);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAllImageSelections();
    };
  }, []);

  // Cleanup editor-selected class when selectedElement changes
  useEffect(() => {
    return () => {
      if (selectedElement) {
        selectedElement.classList.remove('editor-selected');
      }
    };
  }, [selectedElement]);

  // Update edit button position when selectedElement changes
  useEffect(() => {
    if (!selectedElement) return;

    const updateButtonPosition = () => {
      const rect = selectedElement.getBoundingClientRect();
      const editorRect = richEditorRef.current?.getBoundingClientRect();
      
      if (editorRect) {
        setEditButtonPosition({
          top: Math.max(0, rect.top - editorRect.top - 20),
          right: Math.max(0, editorRect.right - rect.right - 20),
        });
      }
    };

    updateButtonPosition();
    
    // Update on resize
    window.addEventListener('resize', updateButtonPosition);
    return () => {
      window.removeEventListener('resize', updateButtonPosition);
    };
  }, [selectedElement]);

  // Images are now treated as normal inline content - no special delete handler needed
  // (Delete images using normal backspace/delete keys or use browser's delete/cut commands)
  const handleDeleteImage = () => {
    if (editingImageElement) {
      editingImageElement.remove();
      
      setShowImageEdit(false);
      setEditingImageElement(null);
      if (richEditorRef.current) {
        setHtmlContent(richEditorRef.current.innerHTML);
      }
      richEditorRef.current?.focus();
    }
  };

  const insertTable = (rows: number, cols: number) => {
    let tableHtml = '<table style="border-collapse: collapse; width: 100%; margin: 10px 0;">';
    
    for (let i = 0; i < rows; i++) {
      tableHtml += '<tr>';
      for (let j = 0; j < cols; j++) {
        tableHtml += `<td style="border: 1px solid #e2e8f0; padding: 10px; text-align: left; position: relative;">&nbsp;</td>`;
      }
      tableHtml += '</tr>';
    }
    
    tableHtml += '</table>';
    
    if (richEditorRef.current) {
      richEditorRef.current.focus();
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : document.createRange();
      const fragment = document.createRange().createContextualFragment(tableHtml);
      range.insertNode(fragment);
      range.collapse(false);
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
      setHtmlContent(richEditorRef.current.innerHTML);
      setShowTableDialog(false);
      
      // Attach resize listeners to table cells
      setTimeout(() => {
        attachTableResizeListeners();
      }, 100);
    }
  };

  const handleInsertContainer = () => {
    const containerHtml = '<div data-user-container="true" style="padding: 20px; margin: 10px 0; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #f8fafc;">Click here to add content...</div>';
    
    if (richEditorRef.current) {
      richEditorRef.current.focus();
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : document.createRange();
      const fragment = document.createRange().createContextualFragment(containerHtml);
      range.insertNode(fragment);
      range.collapse(false);
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
      setHtmlContent(richEditorRef.current.innerHTML);
    }
  };

  const attachTableResizeListeners = () => {
    if (!richEditorRef.current) return;
    
    const tables = richEditorRef.current.querySelectorAll('table');
    tables.forEach(table => {
      const cells = table.querySelectorAll('th, td');
      cells.forEach((cell) => {
        const element = cell as HTMLElement;
        element.style.position = 'relative';
        element.style.userSelect = 'none';
        
        // Remove existing resize handle if any
        const existingHandle = element.querySelector('[data-resize-handle]');
        if (existingHandle) existingHandle.remove();
        
        // Create resize handle
        const resizeHandle = document.createElement('div');
        resizeHandle.setAttribute('data-resize-handle', 'true');
        resizeHandle.style.position = 'absolute';
        resizeHandle.style.right = '0';
        resizeHandle.style.top = '0';
        resizeHandle.style.width = '6px';
        resizeHandle.style.height = '100%';
        resizeHandle.style.cursor = 'col-resize';
        resizeHandle.style.backgroundColor = 'transparent';
        resizeHandle.style.borderRight = '2px solid #3b82f6';
        resizeHandle.style.opacity = '0';
        resizeHandle.style.transition = 'opacity 0.2s';
        resizeHandle.style.zIndex = '10';
        
        element.appendChild(resizeHandle);
        
        element.addEventListener('mouseenter', () => {
          resizeHandle.style.opacity = '1';
        });
        
        element.addEventListener('mouseleave', () => {
          if (!resizingCell) {
            resizeHandle.style.opacity = '0';
          }
        });
        
        resizeHandle.addEventListener('mousedown', (e: MouseEvent) => {
          e.preventDefault();
          setResizingCell(element);
          setResizeStartX(e.clientX);
          setResizeStartWidth(element.offsetWidth);
        });
      });
    });
  };

  // Helper function to ensure https:// prefix
  const ensureHttps = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `https://${url}`;
  };

  // Helper function to format WhatsApp URL
  const formatWhatsAppUrl = (input: string) => {
    if (!input) return '';
    // Remove all non-numeric and + characters
    const number = input.replace(/[^0-9+]/g, '');
    // Ensure it starts with + for international format, otherwise assume domestic
    const formatted = number.startsWith('+') ? number : `+${number}`;
    return `https://wa.me/${formatted.replace(/\D/g, '')}`;
  };

  // Helper function to replace logo placeholder with actual logo
  const processTemplateContent = (content: string): string => {
    // Use the signature logo if available, otherwise use property main document logoUrl
    const logoUrl = formData.signatureLogo || propertyData?.main?.logoUrl || '';
    
    // Replace {{property_logo}} placeholder with actual logo URL
    return content.replace(/\{\{property_logo\}\}/g, logoUrl);
  };

  const generateSignatureHtml = () => {
    const { signatureName, signaturePropertyName, signaturePhone, signatureEmail, signatureAddress, signatureWebsite, signatureLogo, signatureSocialMedia } = formData;
    
    // Return empty signature if no data is provided
    const hasSignatureData = signatureName || signaturePropertyName || signaturePhone || signatureEmail || signatureAddress || signatureWebsite || signatureLogo;
    if (!hasSignatureData) {
      return '';
    }

    const currentYear = new Date().getFullYear();

    return `
      <div class="footer" style="padding: 30px 40px; background-color: #ffffff; border-top: 1px solid #eeeeee; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
        <!-- Brand Signature -->

        <!-- Contact & Social Bar (Swapped Positions) -->
        <div style="border-top: 1px solid #e0e0e0; padding-top: 20px; display: block; clear: both;">
          <!-- Left Side: Property Details -->
          <div style="float: left; width: 55%; text-align: left;">
            ${signaturePropertyName ? `<p style="margin: 0; font-size: 16px; color: #1a2b49; font-weight: bold;">${signaturePropertyName}</p>` : ''}
            ${signatureAddress ? `<p style="margin: 4px 0 0 0; font-size: 11px; color: #666666;">${signatureAddress}</p>` : ''}
            
            <!-- Contact Details with Icons -->
            <div style="margin-top: 10px;">
              ${signaturePhone ? `<p style="margin: 4px 0 0 0; font-size: 11px; color: #666666;"><a href="tel:${signaturePhone.replace(/[^0-9+]/g, '')}" target="_blank" rel="noopener noreferrer" style="color: #666666; text-decoration: none;">📞 ${signaturePhone}</a></p>` : ''}
              ${signatureEmail ? `<p style="margin: 4px 0 0 0; font-size: 11px; color: #666666;"><a href="mailto:${signatureEmail}" target="_blank" rel="noopener noreferrer" style="color: #666666; text-decoration: none;">📧 ${signatureEmail}</a></p>` : ''}
              ${signatureWebsite ? `<p style="margin: 4px 0 0 0; font-size: 11px; color: #666666;"><a href="${ensureHttps(signatureWebsite)}" target="_blank" rel="noopener noreferrer" style="color: #666666; text-decoration: none;">🌐 ${signatureWebsite}</a></p>` : ''}
            </div>
          </div>
          
          <!-- Right Side: Connect With Us -->
          <div style="float: right; width: 45%; text-align: right;">
            <p style="margin: 0; font-size: 10px; color: #888888; text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">Connect With Us</p>
            <div style="margin-top: 10px;">
              ${signatureSocialMedia?.facebook ? `<a href="${ensureHttps(signatureSocialMedia.facebook)}" target="_blank" rel="noopener noreferrer" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center; margin-left: 12px; width: 24px; height: 24px;"><img src="https://cdn-icons-png.flaticon.com/512/733/733547.png" width="16" height="16" style="vertical-align: middle; opacity: 0.6;"></a>` : ''}
              ${signatureSocialMedia?.instagram ? `<a href="${ensureHttps(signatureSocialMedia.instagram)}" target="_blank" rel="noopener noreferrer" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center; margin-left: 12px; width: 24px; height: 24px;"><img src="https://cdn-icons-png.flaticon.com/512/2111/2111463.png" width="16" height="16" style="vertical-align: middle; opacity: 0.6;"></a>` : ''}
              ${signatureSocialMedia?.x ? `<a href="${ensureHttps(signatureSocialMedia.x)}" target="_blank" rel="noopener noreferrer" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center; margin-left: 12px; width: 24px; height: 24px;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" style="vertical-align: middle; opacity: 0.6; fill: currentColor;"><title>X</title>${siX.svg.replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '')}</svg></a>` : ''}
              ${signatureSocialMedia?.whatsapp ? `<a href="${formatWhatsAppUrl(signatureSocialMedia.whatsapp)}" target="_blank" rel="noopener noreferrer" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center; margin-left: 12px; width: 24px; height: 24px;"><img src="https://cdn-icons-png.flaticon.com/512/733/733585.png" width="16" height="16" style="vertical-align: middle; opacity: 0.6;"></a>` : ''}
              ${signatureSocialMedia?.linkedin ? `<a href="${ensureHttps(signatureSocialMedia.linkedin)}" target="_blank" rel="noopener noreferrer" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center; margin-left: 12px; width: 24px; height: 24px;"><img src="https://cdn-icons-png.flaticon.com/512/3536/3536505.png" width="16" height="16" style="vertical-align: middle; opacity: 0.6;"></a>` : ''}
              ${signatureSocialMedia?.tripadvisor ? `<a href="${ensureHttps(signatureSocialMedia.tripadvisor)}" target="_blank" rel="noopener noreferrer" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center; margin-left: 12px; width: 24px; height: 24px;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" style="vertical-align: middle; opacity: 0.6; fill: currentColor;"><title>TripAdvisor</title>${siTripadvisor.svg.replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '')}</svg></a>` : ''}
            </div>
          </div>
          <div style="clear: both;"></div>
        </div>

        <!-- Legal Notice -->
        <div style="margin-top: 20px; text-align: center; border-top: 1px solid #e0e0e0; padding-top: 15px;">
          <p style="margin: 0; font-size: 10px; color: #999999; line-height: 1.6;">
            &copy; ${currentYear} ${signaturePropertyName || 'Our Hotel'}. All rights reserved.
          </p>
        </div>
      </div>
    `;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 py-0 h-full">
      {/* Left Sidebar: Form Controls */}
      <div className="lg:col-span-1 flex flex-col h-full overflow-hidden">
        
        {/* Navigation Tabs - Fixed at top */}
        <div className="bg-slate-100 p-1 rounded-xl flex gap-1 flex-shrink-0">
          {(['content', 'settings', 'advanced'] as const).map(tab => {
            const tabLabels = {
              content: 'Content',
              settings: 'Dynamic Tags',
              advanced: 'Signature'
            };
            return (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-all ${
                  activeTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tabLabels[tab]}
              </button>
            );
          })}
        </div>

        {/* Test Email Button */}
        <button
          onClick={() => setShowTestEmailDialog(true)}
          disabled={!formData.subject || !formData.fromEmail || isSendingTestEmail}
          className="w-full px-3 py-2 bg-purple-50 hover:bg-purple-100 disabled:bg-slate-100 disabled:text-slate-400 text-purple-700 disabled:text-slate-400 text-xs font-bold rounded-lg border border-purple-200 transition-all flex items-center justify-center gap-2 flex-shrink-0"
          title={!formData.subject || !formData.fromEmail ? 'Fill in subject and from email first' : 'Send a test email to preview'}
        >
          <Icons.Mail className="w-3 h-3" />
          Test Email
        </button>

        {/* Test Email Status Message */}
        {testEmailStatus !== 'idle' && (
          <div className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 flex-shrink-0 ${
            testEmailStatus === 'success' 
              ? 'bg-green-50 text-green-700 border border-green-200' 
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {testEmailStatus === 'success' ? (
              <Icons.CheckCircle2 className="w-3 h-3" />
            ) : (
              <Icons.AlertCircle className="w-3 h-3" />
            )}
            <span>{testEmailMessage}</span>
          </div>
        )}

        {/* Tab Content Wrapper - Scrollable */}
        <div className="flex-1 overflow-y-auto space-y-4 py-4">

        {/* CONTENT TAB */}
        {activeTab === 'content' && (
          <div className="space-y-4">
            {/* Sender Details */}
            <div className="bg-white border rounded-lg p-4 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold text-slate-600 uppercase border-b pb-2">Sender Details</h3>
              
              <div>
                <div className="flex justify-between items-end mb-2">
                  <Label className="text-xs font-bold text-slate-600 uppercase">Template Name</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 uppercase">Enabled</span>
                    <Switch
                      checked={formData.enabled}
                      onCheckedChange={(checked) => handleChange('enabled', checked)}
                      className="h-4 w-8"
                    />
                  </div>
                </div>
                <Input
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="h-8 text-sm"
                  placeholder="e.g., Welcome Email"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-600 uppercase mb-2 block">Language</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="overrideLanguages"
                      className="rounded border-slate-300"
                    />
                    <label htmlFor="overrideLanguages" className="text-xs text-slate-600">Override all languages</label>
                  </div>
                  <div className="flex gap-2">
                    <Select defaultValue="en">
                      <SelectTrigger className="h-8 text-sm flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="fr">Français</SelectItem>
                        <SelectItem value="es">Español</SelectItem>
                        <SelectItem value="de">Deutsch</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1">
                      <Icons.Languages className="h-3 w-3" /> Translate
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Subject & Preview */}
            <div className="bg-white border rounded-lg p-4 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold text-slate-600 uppercase border-b pb-2">Subject & Preview</h3>
              
              <div>
                <Label className="text-xs font-bold text-slate-600 uppercase mb-2 block">Subject Line</Label>
                <Input
                  value={formData.subject}
                  onChange={(e) => handleChange('subject', e.target.value)}
                  className="h-8 text-sm"
                  placeholder="e.g., Your reservation is confirmed!"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-600 uppercase mb-2 block">Preview Text</Label>
                <Input
                  value={formData.preheaderText}
                  onChange={(e) => handleChange('preheaderText', e.target.value)}
                  className="h-8 text-sm"
                  placeholder="Brief snippet seen in inbox..."
                />
              </div>
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="space-y-4 animate-in fade-in duration-200 h-full">
            {/* Merge Tags */}
            <div className="bg-white border rounded-lg p-4 shadow-sm flex flex-col h-full overflow-hidden">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-bold text-slate-600 uppercase">Merge Tags</h3>
                <Button size="sm" variant="ghost" className="h-6 text-xs">
                  <Icons.HelpCircle className="h-3 w-3 mr-1" /> Guide
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1">
                {MERGE_TAGS.map((group) => (
                  <div key={group.category}>
                    <p className="text-xs font-bold text-slate-500 uppercase mb-2">{group.category}</p>
                    <div className="space-y-1 ml-2">
                      {group.tags.map((item) => (
                        <button
                          key={item.tag}
                          onClick={() => insertMergeTag(item.tag)}
                          className="w-full flex justify-between items-center p-2 rounded-lg hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-all text-left group"
                        >
                          <code className="text-xs font-semibold text-blue-600">{item.tag}</code>
                          <span className="text-xs text-slate-500 group-hover:text-blue-600">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ADVANCED TAB */}
        {activeTab === 'advanced' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Auto-Fill Button */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <Button 
                onClick={autoFillSignature}
                disabled={!currentProperty}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold h-9 text-sm"
              >
                <Icons.RefreshCw className="h-4 w-4 mr-2" />
                Auto-Fill from Property Settings
              </Button>
              <p className="text-xs text-slate-600 mt-2">Automatically fills name, property name, phone, email, address, website, and logo from your property settings.</p>
            </div>

            {/* Logo Upload */}
            <div className="bg-white border rounded-lg p-4 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold text-slate-600 uppercase border-b pb-2">Email Signature</h3>
              
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-3">Logo / Brand Image</label>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:bg-slate-50 hover:border-slate-300 cursor-pointer transition-all">
                      <Icons.UploadCloud className="h-6 w-6 text-slate-400 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-600 uppercase">Click to Upload Logo</p>
                      <p className="text-xs text-slate-500 mt-1">PNG, JPG (Max 200x100px recommended)</p>
                    </div>
                  </div>
                  
                  {/* Logo Thumbnail Preview */}
                  {formData.signatureLogo && (
                    <div className="w-24 h-24 flex-shrink-0">
                      <div className="relative w-full h-full border border-slate-300 rounded-lg overflow-hidden bg-slate-50 flex items-center justify-center">
                        <img
                          src={formData.signatureLogo}
                          alt="Logo"
                          className="max-w-full max-h-full object-contain p-1"
                        />
                        <button
                          onClick={() => handleChange('signatureLogo', '')}
                          className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white p-1 rounded transition-colors"
                          title="Remove logo"
                        >
                          <Icons.X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Signature Contact Information */}
            <div className="bg-white border rounded-lg p-4 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold text-slate-600 uppercase border-b pb-2">Contact Information</h3>
              
              <div>
                <Label className="text-xs font-bold text-slate-600 uppercase mb-2 block">Full Name *</Label>
                <Input
                  value={formData.signatureName}
                  onChange={(e) => handleChange('signatureName', e.target.value)}
                  className="h-8 text-sm"
                  placeholder="e.g., John Smith"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold text-slate-600 uppercase mb-2 block">Property Name</Label>
                  <Input
                    value={formData.signaturePropertyName}
                    onChange={(e) => handleChange('signaturePropertyName', e.target.value)}
                    className="h-8 text-sm"
                    placeholder="e.g., Riad Al Medina"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold text-slate-600 uppercase mb-2 block">Phone</Label>
                  <Input
                    value={formData.signaturePhone}
                    onChange={(e) => handleChange('signaturePhone', e.target.value)}
                    className="h-8 text-sm"
                    placeholder="e.g., +1 (555) 123-4567"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-600 uppercase mb-2 block">Email Address</Label>
                {availableEmails.length > 0 ? (
                  <Select value={formData.signatureEmail} onValueChange={(value) => handleChange('signatureEmail', value)}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableEmails.map((emailOption, idx) => (
                        <SelectItem key={idx} value={emailOption.email}>
                          {emailOption.email} ({emailOption.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type="email"
                    value={formData.signatureEmail}
                    onChange={(e) => handleChange('signatureEmail', e.target.value)}
                    className="h-8 text-sm"
                    placeholder="e.g., contact@property.com"
                  />
                )}
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-600 uppercase mb-2 block">Property Address</Label>
                <div className="flex gap-2">
                  <Input
                    value={formData.signatureAddress}
                    onChange={(e) => handleChange('signatureAddress', e.target.value)}
                    className="h-8 text-sm flex-1"
                    placeholder="e.g., 123 Main St, 12345, City"
                  />
                  {propertyData?.infos?.googleMapsLink && (
                    <a 
                      href={propertyData.infos.googleMapsLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="px-3 h-8 flex items-center bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded text-blue-600 text-xs font-bold transition-all"
                      title="Open in Google Maps"
                    >
                      <Icons.MapPin className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-600 uppercase mb-2 block">Website</Label>
                <Input
                  type="url"
                  value={formData.signatureWebsite}
                  onChange={(e) => handleChange('signatureWebsite', e.target.value)}
                  className="h-8 text-sm"
                  placeholder="e.g., www.yourproperty.com"
                />
              </div>
            </div>

            {/* Social Media Links */}
            <div className="bg-white border rounded-lg p-4 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold text-slate-600 uppercase border-b pb-2">Social Media Links</h3>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold text-slate-600 uppercase mb-2 block flex items-center gap-1">
                    <Icons.Facebook className="h-3 w-3" /> Facebook
                  </Label>
                  <Input
                    value={formData.signatureSocialMedia?.facebook || ''}
                    onChange={(e) => handleChange('signatureSocialMedia', { ...formData.signatureSocialMedia, facebook: e.target.value })}
                    className="h-8 text-sm"
                    placeholder="facebook.com/yourpage"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold text-slate-600 uppercase mb-2 block flex items-center gap-1">
                    <Icons.Instagram className="h-3 w-3" /> Instagram
                  </Label>
                  <Input
                    value={formData.signatureSocialMedia?.instagram || ''}
                    onChange={(e) => handleChange('signatureSocialMedia', { ...formData.signatureSocialMedia, instagram: e.target.value })}
                    className="h-8 text-sm"
                    placeholder="instagram.com/yourpage"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold text-slate-600 uppercase mb-2 block flex items-center gap-1">
                    <Icons.MessageCircle className="h-3 w-3" /> WhatsApp
                  </Label>
                  <Input
                    value={formData.signatureSocialMedia?.whatsapp || ''}
                    onChange={(e) => handleChange('signatureSocialMedia', { ...formData.signatureSocialMedia, whatsapp: e.target.value })}
                    className="h-8 text-sm"
                    placeholder="https://wa.me/yourphone"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold text-slate-600 uppercase mb-2 block flex items-center gap-1">
                    <Icons.TwitterX className="h-3 w-3" /> X
                  </Label>
                  <Input
                    value={formData.signatureSocialMedia?.x || ''}
                    onChange={(e) => handleChange('signatureSocialMedia', { ...formData.signatureSocialMedia, x: e.target.value })}
                    className="h-8 text-sm"
                    placeholder="x.com/yourpage"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold text-slate-600 uppercase mb-2 block flex items-center gap-1">
                    <Icons.Linkedin className="h-3 w-3" /> LinkedIn
                  </Label>
                  <Input
                    value={formData.signatureSocialMedia?.linkedin || ''}
                    onChange={(e) => handleChange('signatureSocialMedia', { ...formData.signatureSocialMedia, linkedin: e.target.value })}
                    className="h-8 text-sm"
                    placeholder="linkedin.com/company/yourpage"
                  />
                </div>

                <div className="col-span-2">
                  <Label className="text-xs font-bold text-slate-600 uppercase mb-2 block flex items-center gap-1">
                    <Icons.Tripadvisor className="h-3 w-3" /> TripAdvisor
                  </Label>
                  <Input
                    value={formData.signatureSocialMedia?.tripadvisor || ''}
                    onChange={(e) => handleChange('signatureSocialMedia', { ...formData.signatureSocialMedia, tripadvisor: e.target.value })}
                    className="h-8 text-sm"
                    placeholder="tripadvisor.com/hotel/yourpage"
                  />
                </div>
              </div>
            </div>

            {/* Template Trigger & Type */}
            <div className="bg-white border rounded-lg p-4 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold text-slate-600 uppercase border-b pb-2">Email Trigger & Automation</h3>
              
              <div>
                <Label className="text-xs font-bold text-slate-600 uppercase mb-2 block">Trigger Event</Label>
                <Select value={templateTrigger} onValueChange={setTemplateTrigger}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select trigger..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inquiry">Reservation Inquiry</SelectItem>
                    <SelectItem value="confirmation">Booking Confirmation</SelectItem>
                    <SelectItem value="cancellation">Reservation Cancellation</SelectItem>
                    <SelectItem value="payment_received">Payment Received</SelectItem>
                    <SelectItem value="pre_arrival">Pre-Arrival (Check-in)</SelectItem>
                    <SelectItem value="post_stay">Post-Stay Review Request</SelectItem>
                    <SelectItem value="review_request">Review Request</SelectItem>
                    <SelectItem value="custom">Custom Event</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 mt-2">Choose when this email should be automatically sent.</p>
              </div>
            </div>

            {/* Global Branding Colors */}
            <div className="bg-white border rounded-lg p-4 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold text-slate-600 uppercase border-b pb-2">Brand Colors & Styling</h3>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-2">Primary Color</label>
                  <div className="flex gap-2">
                    <input 
                      type="color" 
                      value={brandingColors.primary}
                      onChange={(e) => setBrandingColors({ ...brandingColors, primary: e.target.value })}
                      className="w-12 h-8 rounded cursor-pointer border border-slate-300"
                    />
                    <input 
                      type="text" 
                      value={brandingColors.primary}
                      onChange={(e) => setBrandingColors({ ...brandingColors, primary: e.target.value })}
                      className="flex-1 px-2 py-1 text-xs border rounded"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-2">Accent Color</label>
                  <div className="flex gap-2">
                    <input 
                      type="color" 
                      value={brandingColors.accent}
                      onChange={(e) => setBrandingColors({ ...brandingColors, accent: e.target.value })}
                      className="w-12 h-8 rounded cursor-pointer border border-slate-300"
                    />
                    <input 
                      type="text" 
                      value={brandingColors.accent}
                      onChange={(e) => setBrandingColors({ ...brandingColors, accent: e.target.value })}
                      className="flex-1 px-2 py-1 text-xs border rounded"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-2">Secondary Color</label>
                  <div className="flex gap-2">
                    <input 
                      type="color" 
                      value={brandingColors.secondary}
                      onChange={(e) => setBrandingColors({ ...brandingColors, secondary: e.target.value })}
                      className="w-12 h-8 rounded cursor-pointer border border-slate-300"
                    />
                    <input 
                      type="text" 
                      value={brandingColors.secondary}
                      onChange={(e) => setBrandingColors({ ...brandingColors, secondary: e.target.value })}
                      className="flex-1 px-2 py-1 text-xs border rounded"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-2">Background Color</label>
                  <div className="flex gap-2">
                    <input 
                      type="color" 
                      value={brandingColors.bgColor}
                      onChange={(e) => setBrandingColors({ ...brandingColors, bgColor: e.target.value })}
                      className="w-12 h-8 rounded cursor-pointer border border-slate-300"
                    />
                    <input 
                      type="text" 
                      value={brandingColors.bgColor}
                      onChange={(e) => setBrandingColors({ ...brandingColors, bgColor: e.target.value })}
                      className="flex-1 px-2 py-1 text-xs border rounded"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Attachments */}
            <div className="bg-white border rounded-lg p-4 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold text-slate-600 uppercase border-b pb-2">Attachments & Options</h3>
              
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-3">Additional Attachments</label>
                <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:bg-slate-50 hover:border-slate-300 cursor-pointer transition-all">
                  <Icons.Paperclip className="h-6 w-6 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600 uppercase">Click to Upload PDF / DOCX</p>
                </div>
              </div>

              <div className="pt-2 space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-blue-600" />
                  <span className="text-sm font-semibold text-slate-700">Include Unsubscribe Link</span>
                </label>
                <p className="text-xs text-slate-500 italic ml-7">Mandatory for Marketing categories.</p>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Right Side: Preview Panel */}
      <div className="lg:col-span-2 bg-slate-50 rounded-lg border flex flex-col overflow-hidden shadow-inner h-full">
        
        {/* Editor Mode Controls */}
        <div className="bg-white border-b px-4 py-2 flex justify-between items-center flex-shrink-0">
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">

            <button 
              onClick={() => {
                if (richEditorRef.current && (editorMode === 'preview' || editorMode === 'code')) {
                  setHtmlContent(richEditorRef.current.innerHTML);
                }
                setEditorMode('rich');
              }}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md transition-all ${editorMode === 'rich' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Icons.Type className="w-3.5 h-3.5" /> Rich Text
            </button>
            <button 
              onClick={() => {
                if (richEditorRef.current && editorMode === 'rich') {
                  setHtmlContent(richEditorRef.current.innerHTML);
                }
                setEditorMode('code');
              }}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md transition-all ${editorMode === 'code' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Icons.Code className="w-3.5 h-3.5" /> HTML
            </button>
            <button 
              onClick={() => {
                if (richEditorRef.current && editorMode === 'rich') {
                  setHtmlContent(richEditorRef.current.innerHTML);
                }
                setEditorMode('preview');
              }}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md transition-all ${editorMode === 'preview' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Icons.Eye className="w-3.5 h-3.5" /> Preview
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="h-4 w-px bg-slate-200" />
            <div className="flex bg-slate-100 p-1 rounded-lg gap-1">
              <button 
                onClick={() => setPreviewMode('desktop')}
                className={`p-1.5 rounded-md transition-all ${previewMode === 'desktop' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                title="Desktop Preview"
              >
                <Icons.Monitor className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setPreviewMode('mobile')}
                className={`p-1.5 rounded-md transition-all ${previewMode === 'mobile' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                title="Mobile Preview"
              >
                <Icons.Smartphone className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">


          {editorMode === 'code' && (
            <div className="max-w-4xl mx-auto h-full bg-[#1e1e1e] rounded-xl p-6 font-mono text-sm text-blue-300 shadow-2xl flex flex-col">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-white/10">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-[10px] text-slate-500 ml-4">email.html — HTML Code View</span>
              </div>
              <textarea
                value={htmlContent}
                onChange={(e) => setHtmlContent(e.target.value)}
                className="flex-1 bg-[#1e1e1e] text-blue-300 font-mono text-sm outline-none resize-none p-4 rounded"
                spellCheck="false"
                dir="ltr"
              />
            </div>
          )}

          {editorMode === 'preview' && (
            <div className={`mx-auto transition-all duration-500 bg-white shadow-2xl rounded-xl overflow-hidden flex flex-col ${previewMode === 'mobile' ? 'max-w-[360px]' : 'max-w-[800px]'}`}>
              <div className="px-6 py-10 text-sm leading-relaxed overflow-y-auto max-h-[calc(100vh-400px)]">
                <div 
                  dir="ltr"
                  dangerouslySetInnerHTML={{ __html: processTemplateContent(htmlContent) + generateSignatureHtml() }}
                  className="max-w-none break-words"
                />
              </div>
            </div>
          )}

          {editorMode === 'rich' && (
            <div className="max-w-4xl mx-auto w-full bg-white border rounded-xl shadow-xl overflow-hidden flex flex-col" style={{height: 'calc(100vh - 280px)'}}>
              {/* Rich Text Toolbar */}
              <div className="bg-slate-50 border-b px-2 py-1.5 flex flex-wrap gap-1 items-center flex-shrink-0">
                {/* Headings */}
                <div className="flex gap-0.5 border-r pr-1.5">
                  <select
                    onChange={(e) => {
                      if (e.target.value) execCommand('formatBlock', `<${e.target.value}>`);
                      e.target.value = '';
                    }}
                    className="px-1.5 py-1 hover:bg-slate-200 rounded text-[10px] outline-none bg-white border border-slate-200 transition"
                    defaultValue=""
                  >
                    <option value="">Heading</option>
                    <option value="h1">H1</option>
                    <option value="h2">H2</option>
                    <option value="h3">H3</option>
                    <option value="h4">H4</option>
                    <option value="h5">H5</option>
                    <option value="h6">H6</option>
                    <option value="p">Paragraph</option>
                  </select>
                </div>

                {/* Text Formatting */}
                <div className="flex gap-0.5 border-r pr-1.5">
                  <button
                    onClick={() => execCommand('bold')}
                    className="p-1.5 hover:bg-slate-200 rounded transition"
                    title="Bold (Ctrl+B)"
                  >
                    <Icons.Bold className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => execCommand('italic')}
                    className="p-1.5 hover:bg-slate-200 rounded transition"
                    title="Italic (Ctrl+I)"
                  >
                    <Icons.Italic className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => execCommand('underline')}
                    className="p-1.5 hover:bg-slate-200 rounded transition"
                    title="Underline (Ctrl+U)"
                  >
                    <Icons.Underline className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => execCommand('strikeThrough')}
                    className="p-1.5 hover:bg-slate-200 rounded transition"
                    title="Strikethrough"
                  >
                    <Icons.Strikethrough className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Font Size */}
                <div className="flex gap-0.5 border-r pr-1.5">
                  <select
                    onChange={(e) => execCommand('fontSize', e.target.value)}
                    className="px-1.5 py-1 hover:bg-slate-200 rounded text-[10px] outline-none bg-white border border-slate-200 transition"
                    defaultValue=""
                  >
                    <option value="">Size</option>
                    <option value="1">Small</option>
                    <option value="3">Normal</option>
                    <option value="4">Medium</option>
                    <option value="5">Large</option>
                    <option value="6">X-Large</option>
                  </select>
                </div>

                {/* Text Color & Background */}
                <div className="flex gap-0.5 border-r pr-1.5">
                  <div className="relative group">
                    <input
                      type="color"
                      onChange={(e) => {
                        setTextColor(e.target.value);
                        execCommand('foreColor', e.target.value);
                      }}
                      className="absolute opacity-0 w-8 h-7 cursor-pointer"
                      title="Text Color"
                    />
                    <button
                      className="p-1.5 hover:bg-slate-200 rounded transition flex items-center justify-center"
                      title="Text Color"
                      onClick={(e) => {
                        const colorInput = e.currentTarget.previousElementSibling as HTMLInputElement;
                        colorInput.click();
                      }}
                    >
                      <span className="text-lg font-bold" style={{ color: textColor }}>A</span>
                    </button>
                  </div>

                  <div className="relative group">
                    <input
                      type="color"
                      onChange={(e) => {
                        setHighlightColor(e.target.value);
                        execCommand('backColor', e.target.value);
                      }}
                      className="absolute opacity-0 w-8 h-7 cursor-pointer"
                      title="Highlight Color"
                    />
                    <button
                      className="p-1.5 hover:bg-slate-200 rounded transition flex items-center justify-center"
                      title="Highlight Color"
                      onClick={(e) => {
                        const colorInput = e.currentTarget.previousElementSibling as HTMLInputElement;
                        colorInput.click();
                      }}
                    >
                      <span className="text-lg font-bold px-0.5 py-0 rounded" style={{ backgroundColor: highlightColor, color: '#000' }}>A</span>
                    </button>
                  </div>
                </div>

                {/* Alignment */}
                <div className="flex gap-0.5 border-r pr-1.5">
                  <button
                    onClick={() => execCommand('justifyLeft')}
                    className="p-1.5 hover:bg-slate-200 rounded transition"
                    title="Align Left"
                  >
                    <Icons.AlignLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => execCommand('justifyCenter')}
                    className="p-1.5 hover:bg-slate-200 rounded transition"
                    title="Align Center"
                  >
                    <Icons.AlignCenter className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => execCommand('justifyRight')}
                    className="p-1.5 hover:bg-slate-200 rounded transition"
                    title="Align Right"
                  >
                    <Icons.AlignRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Lists */}
                <div className="flex gap-0.5 border-r pr-1.5">
                  <button
                    onClick={() => execCommand('insertUnorderedList')}
                    className="p-1.5 hover:bg-slate-200 rounded transition"
                    title="Bullet List"
                  >
                    <Icons.List className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => execCommand('insertOrderedList')}
                    className="p-1.5 hover:bg-slate-200 rounded transition"
                    title="Numbered List"
                  >
                    <Icons.ListOrdered className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Indentation */}
                <div className="flex gap-0.5 border-r pr-1.5">
                  <button
                    onClick={() => execCommand('indent')}
                    className="p-1.5 hover:bg-slate-200 rounded transition"
                    title="Increase Indent"
                  >
                    <Icons.Indent className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => execCommand('outdent')}
                    className="p-1.5 hover:bg-slate-200 rounded transition"
                    title="Decrease Indent"
                  >
                    <Icons.Outdent className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Links & Special */}
                <div className="flex gap-0.5 border-r pr-1.5">
                  <button
                    onClick={handleInsertLink}
                    className="p-1.5 hover:bg-slate-200 rounded transition"
                    title="Insert Link"
                  >
                    <Icons.Link2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleInsertImage}
                    className="p-1.5 hover:bg-slate-200 rounded transition"
                    title="Insert Image"
                  >
                    <Icons.ImageIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleInsertContainer}
                    className="p-1.5 hover:bg-slate-200 rounded transition"
                    title="Insert Container"
                  >
                    <Icons.Package className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => execCommand('insertHorizontalRule')}
                    className="p-1.5 hover:bg-slate-200 rounded transition"
                    title="Insert Horizontal Line"
                  >
                    <Icons.Minus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setShowTableDialog(true)}
                    className="p-1.5 hover:bg-slate-200 rounded transition"
                    title="Insert Table"
                  >
                    <Icons.Square className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Format Tools */}
                <div className="flex gap-0.5">
                  <button
                    onClick={() => execCommand('removeFormat')}
                    className="p-1.5 hover:bg-slate-200 rounded transition"
                    title="Clear Formatting"
                  >
                    <Icons.Eraser className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => execCommand('undo')}
                    className="p-1.5 hover:bg-slate-200 rounded transition"
                    title="Undo (Ctrl+Z)"
                  >
                    <Icons.Undo2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => execCommand('redo')}
                    className="p-1.5 hover:bg-slate-200 rounded transition"
                    title="Redo (Ctrl+Y)"
                  >
                    <Icons.Redo2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Zoom Controls */}
                <div className="flex items-center gap-0.5 pr-1.5">
                  <button
                    onClick={() => setEditorZoom(Math.max(50, editorZoom - 10))}
                    className="p-1.5 hover:bg-slate-200 rounded transition"
                    title="Zoom Out"
                    disabled={editorZoom <= 50}
                  >
                    <Icons.ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] font-mono text-slate-600 px-1.5 min-w-[45px] text-center">
                    {editorZoom}%
                  </span>
                  <button
                    onClick={() => setEditorZoom(Math.min(200, editorZoom + 10))}
                    className="p-1.5 hover:bg-slate-200 rounded transition"
                    title="Zoom In"
                    disabled={editorZoom >= 200}
                  >
                    <Icons.ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setEditorZoom(100)}
                    className="p-1.5 hover:bg-slate-200 rounded transition text-[9px] font-medium"
                    title="Reset Zoom"
                  >
                    <Icons.Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Rich Text Editor Container with Pen Button */}
              <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                {/* Rich Text Editor */}
                <div 
                  ref={richEditorRef}
                  className="px-4 py-3 flex-1 outline-none text-slate-700 bg-white overflow-y-auto min-h-0"
                  style={{
                    zoom: `${editorZoom}%`,
                    lineHeight: '1.6',
                  }}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={handleRichEditorChange}
                  onKeyDown={handleRichEditorKeyDown}
                  onDoubleClick={handleRichEditorDoubleClick}
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    
                    // Handle images first (highest priority)
                    if (target.tagName === 'IMG') {
                      handleLinkClick(e); // This will handle image selection
                      return; // Don't process other handlers
                    }
                    
                    // If clicking outside an image, wrapper, or resize handle, deselect image
                    if (!target.classList.contains('resize-handle') && 
                        !target.classList.contains('image-resize-wrapper')) {
                      cleanupAllImageSelections();
                    }
                    
                    // Handle link clicks
                    handleLinkClick(e);
                    
                    // Handle element clicks (containers, buttons, etc.)
                    handleElementClick(e);
                  }}
                />
                <style>{`
                  [contenteditable] a {
                    color: #2563eb;
                    text-decoration: underline;
                    cursor: pointer;
                    font-weight: 500;
                  }
                  [contenteditable] a:hover {
                    color: #1d4ed8;
                    text-decoration: underline double;
                    background-color: rgba(37, 99, 235, 0.05);
                  }
                  [contenteditable] img {
                    max-width: 100%;
                    height: auto;
                    display: block;
                  }
                  [contenteditable] .image-resize-wrapper {
                    position: relative;
                    display: inline-block;
                    max-width: 100%;
                    line-height: 0;
                  }
                [contenteditable] .image-resize-wrapper img {
                  max-width: 100%;
                  height: auto;
                  display: block;
                }
                [contenteditable] .resize-handle {
                  position: absolute;
                  width: 12px;
                  height: 12px;
                  background-color: #3b82f6;
                  border: 2px solid white;
                  border-radius: 50%;
                  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                  z-index: 1000;
                  transition: transform 0.1s;
                }
                [contenteditable] .resize-handle:hover {
                  transform: scale(1.2);
                  background-color: #2563eb;
                }
                [contenteditable] table {
                  border-collapse: collapse;
                  margin: 10px 0;
                }
                [contenteditable] table td {
                  border: 1px solid #e2e8f0;
                  padding: 10px;
                  position: relative;
                  min-height: 24px;
                }
                [contenteditable] table td:hover {
                  background-color: rgba(59, 130, 246, 0.05);
                }
                [contenteditable] .header:hover,
                [contenteditable] .content:hover,
                [contenteditable] .details-box:hover,
                [contenteditable] .cta-container:hover,
                [contenteditable] .btn:hover,
                [contenteditable] div[data-user-container]:hover,
                [contenteditable] a[data-user-button]:hover,
                [contenteditable] td:hover {
                  outline: 2px dashed rgba(147, 51, 234, 0.4);
                  outline-offset: 2px;
                  cursor: pointer;
                }
                [contenteditable] .editor-selected {
                  outline: 2px solid #9333ea !important;
                  outline-offset: 2px;
                  position: relative;
                }
              `}</style>

                {/* Pen Icon Button for Editing Selected Element */}
                {selectedElement && (
                  <div
                    style={{
                      position: 'absolute',
                      top: `${editButtonPosition.top}px`,
                      right: `${editButtonPosition.right}px`,
                      pointerEvents: 'auto',
                      zIndex: 50,
                    }}
                    className="pointer-events-none"
                  >
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowStyleEditor(true);
                      }}
                      className="pointer-events-auto w-8 h-8 flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-lg transition hover:scale-105"
                      title="Edit element styles"
                    >
                      <Icons.Edit className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Inline Link Form */}
              {showLinkForm && (
                <div className="bg-slate-50 border-t border-slate-200 px-3 py-2.5 space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-[10px] font-bold text-slate-700 uppercase tracking-wide">Insert Link</h4>
                  </div>
                  {!hasSelectedText && (
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block mb-1">Link Text</label>
                      <input
                        type="text"
                        value={linkText}
                        onChange={(e) => setLinkText(e.target.value)}
                        placeholder="Enter link text"
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 block mb-1">URL</label>
                    <input
                      type="text"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      placeholder="https://example.com"
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleCreateLink();
                        }
                      }}
                      autoFocus={hasSelectedText}
                    />
                  </div>
                  <div className="flex gap-1.5 justify-end pt-1.5">
                    <button
                      onClick={() => {
                        setShowLinkForm(false);
                        setLinkUrl('');
                        setLinkText('');
                        richEditorRef.current?.focus();
                      }}
                      className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateLink}
                      className="px-2.5 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition"
                    >
                      Insert
                    </button>
                  </div>
                </div>
              )}

              {/* Link Edit Form */}
              {showLinkEdit && editingLinkElement && (
                <div className="bg-slate-50 border-t border-slate-200 px-3 py-2.5 space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-[10px] font-bold text-slate-700 uppercase tracking-wide">Edit Link</h4>
                    <span className="text-[10px] text-slate-500 font-normal truncate max-w-[200px]">{editingLinkElement.textContent}</span>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 block mb-1">URL</label>
                    <input
                      type="text"
                      value={editingLinkUrl}
                      onChange={(e) => setEditingLinkUrl(e.target.value)}
                      placeholder="https://example.com"
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleUpdateLink();
                        }
                      }}
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-1.5 justify-end pt-1.5">
                    <button
                      onClick={() => {
                        setShowLinkEdit(false);
                        setEditingLinkElement(null);
                        setEditingLinkUrl('');
                        richEditorRef.current?.focus();
                      }}
                      className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteLink}
                      className="px-2.5 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition"
                    >
                      Remove
                    </button>
                    <button
                      onClick={handleUpdateLink}
                      className="px-2.5 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition"
                    >
                      Update
                    </button>
                  </div>
                </div>
              )}

              {/* Image Edit Form - DISABLED: Images are now treated as normal inline content */}
              {/* Use toolbar alignment buttons to align images, browser native resize by dragging corners */}

              {/* Element Style Editor */}
              {showStyleEditor && selectedElement && (
                <div className="bg-slate-50 border-t border-slate-200 px-3 py-1.5">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-[10px] font-bold text-slate-700 uppercase tracking-wide">
                      Customize {selectedElement.tagName}
                    </h4>
                    <button
                      onClick={() => {
                        setShowStyleEditor(false);
                        setSelectedElement(null);
                        richEditorRef.current?.focus();
                      }}
                      className="text-slate-400 hover:text-slate-600 transition"
                    >
                      <Icons.X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  
                  {/* All Controls in Single Row */}
                  <div className="flex items-end gap-2">
                    {/* Background Color */}
                    <div className="w-28">
                      <label className="text-[9px] font-semibold text-slate-600 block mb-0.5">BG</label>
                      <div className="flex items-center gap-0.5">
                        <input
                          type="color"
                          value={elementBgColor}
                          onChange={(e) => {
                            setElementBgColor(e.target.value);
                            applyElementStyle('backgroundColor', e.target.value);
                          }}
                          className="w-6 h-6 border border-slate-300 rounded cursor-pointer flex-shrink-0"
                        />
                        <input
                          type="text"
                          value={elementBgColor}
                          onChange={(e) => {
                            setElementBgColor(e.target.value);
                            applyElementStyle('backgroundColor', e.target.value);
                          }}
                          placeholder="#000"
                          className="flex-1 px-1 py-1 border border-slate-300 rounded text-[9px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-0"
                        />
                      </div>
                    </div>

                    {/* Text Color */}
                    <div className="w-28">
                      <label className="text-[9px] font-semibold text-slate-600 block mb-0.5">Text</label>
                      <div className="flex items-center gap-0.5">
                        <input
                          type="color"
                          value={elementTextColor}
                          onChange={(e) => {
                            setElementTextColor(e.target.value);
                            applyElementStyle('color', e.target.value);
                          }}
                          className="w-6 h-6 border border-slate-300 rounded cursor-pointer flex-shrink-0"
                        />
                        <input
                          type="text"
                          value={elementTextColor}
                          onChange={(e) => {
                            setElementTextColor(e.target.value);
                            applyElementStyle('color', e.target.value);
                          }}
                          placeholder="#FFF"
                          className="flex-1 px-1 py-1 border border-slate-300 rounded text-[9px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-0"
                        />
                      </div>
                    </div>

                    {/* Border Color */}
                    <div className="w-28">
                      <label className="text-[9px] font-semibold text-slate-600 block mb-0.5">Border</label>
                      <div className="flex items-center gap-0.5">
                        <input
                          type="color"
                          value={elementBorderColor}
                          onChange={(e) => {
                            setElementBorderColor(e.target.value);
                            applyElementStyle('borderColor', e.target.value);
                          }}
                          className="w-6 h-6 border border-slate-300 rounded cursor-pointer flex-shrink-0"
                        />
                        <input
                          type="text"
                          value={elementBorderColor}
                          onChange={(e) => {
                            setElementBorderColor(e.target.value);
                            applyElementStyle('borderColor', e.target.value);
                          }}
                          placeholder="#E0E"
                          className="flex-1 px-1 py-1 border border-slate-300 rounded text-[9px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-0"
                        />
                      </div>
                    </div>

                    {/* Border Width */}
                    <div className="w-16">
                      <label className="text-[9px] font-semibold text-slate-600 block mb-0.5">Width</label>
                      <div className="flex items-center gap-0.5">
                        <input
                          type="number"
                          value={elementBorderWidth}
                          onChange={(e) => {
                            setElementBorderWidth(e.target.value);
                            applyElementStyle('borderWidth', e.target.value ? `${e.target.value}px` : '');
                          }}
                          placeholder="1"
                          min="0"
                          step="1"
                          className="w-10 px-1 py-1 border border-slate-300 rounded text-[9px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="text-[8px] text-slate-500 font-mono">px</span>
                      </div>
                    </div>

                    {/* Border Radius */}
                    <div className="w-16">
                      <label className="text-[9px] font-semibold text-slate-600 block mb-0.5">Radius</label>
                      <div className="flex items-center gap-0.5">
                        <input
                          type="number"
                          value={elementBorderRadius}
                          onChange={(e) => {
                            setElementBorderRadius(e.target.value);
                            applyElementStyle('borderRadius', e.target.value ? `${e.target.value}px` : '');
                          }}
                          placeholder="8"
                          min="0"
                          step="1"
                          className="w-10 px-1 py-1 border border-slate-300 rounded text-[9px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="text-[8px] text-slate-500 font-mono">px</span>
                      </div>
                    </div>

                    {/* Padding */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="text-[9px] font-semibold text-slate-600">Padding</label>
                        <span className="text-[8px] text-slate-500 font-mono">px</span>
                      </div>
                      <div>
                        {/* Unified bordered container */}
                        <div className="flex border border-slate-300 rounded overflow-hidden">
                          <div className="flex-1 flex flex-col">
                            <input
                              type="number"
                              value={showIndividualPadding ? elementPaddingTop : elementPaddingAll}
                              onChange={(e) => {
                                if (showIndividualPadding) {
                                  setElementPaddingTop(e.target.value);
                                  applyElementStyle('paddingTop', e.target.value ? `${e.target.value}px` : '');
                                } else {
                                  const val = e.target.value;
                                  setElementPaddingAll(val);
                                  applyPaddingAll(val);
                                }
                              }}
                              placeholder="0"
                              title="Top"
                              min="0"
                              step="1"
                              className="w-full px-0.5 py-1 text-[8px] font-mono focus:outline-none text-center bg-white text-slate-900 border-0"
                            />
                            <label className="text-[7px] text-slate-500 block text-center py-0.5 bg-slate-50 border-t border-slate-300">Top</label>
                          </div>
                          <div className="w-px bg-slate-300"></div>
                          <div className="flex-1 flex flex-col">
                            <input
                              type="number"
                              value={showIndividualPadding ? elementPaddingRight : elementPaddingAll}
                              onChange={(e) => {
                                if (showIndividualPadding) {
                                  setElementPaddingRight(e.target.value);
                                  applyElementStyle('paddingRight', e.target.value ? `${e.target.value}px` : '');
                                } else {
                                  const val = e.target.value;
                                  setElementPaddingAll(val);
                                  applyPaddingAll(val);
                                }
                              }}
                              placeholder="0"
                              title="Right"
                              min="0"
                              step="1"
                              className="w-full px-0.5 py-1 text-[8px] font-mono focus:outline-none text-center bg-white text-slate-900 border-0"
                            />
                            <label className="text-[7px] text-slate-500 block text-center py-0.5 bg-slate-50 border-t border-slate-300">Right</label>
                          </div>
                          <div className="w-px bg-slate-300"></div>
                          <div className="flex-1 flex flex-col">
                            <input
                              type="number"
                              value={showIndividualPadding ? elementPaddingBottom : elementPaddingAll}
                              onChange={(e) => {
                                if (showIndividualPadding) {
                                  setElementPaddingBottom(e.target.value);
                                  applyElementStyle('paddingBottom', e.target.value ? `${e.target.value}px` : '');
                                } else {
                                  const val = e.target.value;
                                  setElementPaddingAll(val);
                                  applyPaddingAll(val);
                                }
                              }}
                              placeholder="0"
                              title="Bottom"
                              min="0"
                              step="1"
                              className="w-full px-0.5 py-1 text-[8px] font-mono focus:outline-none text-center bg-white text-slate-900 border-0"
                            />
                            <label className="text-[7px] text-slate-500 block text-center py-0.5 bg-slate-50 border-t border-slate-300">Bottom</label>
                          </div>
                          <div className="w-px bg-slate-300"></div>
                          <div className="flex-1 flex flex-col">
                            <input
                              type="number"
                              value={showIndividualPadding ? elementPaddingLeft : elementPaddingAll}
                              onChange={(e) => {
                                if (showIndividualPadding) {
                                  setElementPaddingLeft(e.target.value);
                                  applyElementStyle('paddingLeft', e.target.value ? `${e.target.value}px` : '');
                                } else {
                                  const val = e.target.value;
                                  setElementPaddingAll(val);
                                  applyPaddingAll(val);
                                }
                              }}
                              placeholder="0"
                              title="Left"
                              min="0"
                              step="1"
                              className="w-full px-0.5 py-1 text-[8px] font-mono focus:outline-none text-center bg-white text-slate-900 border-0"
                            />
                            <label className="text-[7px] text-slate-500 block text-center py-0.5 bg-slate-50 border-t border-slate-300">Left</label>
                          </div>
                          <div className="w-px bg-slate-300"></div>
                          <button
                            onClick={() => {
                              if (!showIndividualPadding) {
                                setShowIndividualPadding(true);
                              } else {
                                setShowIndividualPadding(false);
                                const unifiedValue = elementPaddingTop || elementPaddingRight || elementPaddingBottom || elementPaddingLeft || '';
                                setElementPaddingAll(unifiedValue);
                                if (unifiedValue) {
                                  applyPaddingAll(unifiedValue);
                                }
                              }
                            }}
                            className={`px-1.5 flex items-center justify-center transition ${
                              showIndividualPadding 
                                ? 'text-slate-400 hover:text-slate-600 bg-white' 
                                : 'text-blue-500 hover:text-blue-600 bg-white'
                            }`}
                            title={showIndividualPadding ? 'Link values together' : 'Unlink values'}
                          >
                            <Icons.Link2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Second Row: Margin and Line Height */}
                  <div className="flex items-end gap-2 mt-2">
                    {/* Margin */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="text-[9px] font-semibold text-slate-600">Margin</label>
                        <span className="text-[8px] text-slate-500 font-mono">px</span>
                      </div>
                      <div>
                        {/* Unified bordered container */}
                        <div className="flex border border-slate-300 rounded overflow-hidden">
                          <div className="flex-1 flex flex-col">
                            <input
                              type="number"
                              value={showIndividualMargin ? elementMarginTop : elementMarginAll}
                              onChange={(e) => {
                                if (showIndividualMargin) {
                                  setElementMarginTop(e.target.value);
                                  applyElementStyle('marginTop', e.target.value ? `${e.target.value}px` : '');
                                } else {
                                  const val = e.target.value;
                                  setElementMarginAll(val);
                                  applyMarginAll(val);
                                }
                              }}
                              placeholder="0"
                              title="Top"
                              min="0"
                              step="1"
                              className="w-full px-0.5 py-1 text-[8px] font-mono focus:outline-none text-center bg-white text-slate-900 border-0"
                            />
                            <label className="text-[7px] text-slate-500 block text-center py-0.5 bg-slate-50 border-t border-slate-300">Top</label>
                          </div>
                          <div className="w-px bg-slate-300"></div>
                          <div className="flex-1 flex flex-col">
                            <input
                              type="number"
                              value={showIndividualMargin ? elementMarginRight : elementMarginAll}
                              onChange={(e) => {
                                if (showIndividualMargin) {
                                  setElementMarginRight(e.target.value);
                                  applyElementStyle('marginRight', e.target.value ? `${e.target.value}px` : '');
                                } else {
                                  const val = e.target.value;
                                  setElementMarginAll(val);
                                  applyMarginAll(val);
                                }
                              }}
                              placeholder="0"
                              title="Right"
                              min="0"
                              step="1"
                              className="w-full px-0.5 py-1 text-[8px] font-mono focus:outline-none text-center bg-white text-slate-900 border-0"
                            />
                            <label className="text-[7px] text-slate-500 block text-center py-0.5 bg-slate-50 border-t border-slate-300">Right</label>
                          </div>
                          <div className="w-px bg-slate-300"></div>
                          <div className="flex-1 flex flex-col">
                            <input
                              type="number"
                              value={showIndividualMargin ? elementMarginBottom : elementMarginAll}
                              onChange={(e) => {
                                if (showIndividualMargin) {
                                  setElementMarginBottom(e.target.value);
                                  applyElementStyle('marginBottom', e.target.value ? `${e.target.value}px` : '');
                                } else {
                                  const val = e.target.value;
                                  setElementMarginAll(val);
                                  applyMarginAll(val);
                                }
                              }}
                              placeholder="0"
                              title="Bottom"
                              min="0"
                              step="1"
                              className="w-full px-0.5 py-1 text-[8px] font-mono focus:outline-none text-center bg-white text-slate-900 border-0"
                            />
                            <label className="text-[7px] text-slate-500 block text-center py-0.5 bg-slate-50 border-t border-slate-300">Bottom</label>
                          </div>
                          <div className="w-px bg-slate-300"></div>
                          <div className="flex-1 flex flex-col">
                            <input
                              type="number"
                              value={showIndividualMargin ? elementMarginLeft : elementMarginAll}
                              onChange={(e) => {
                                if (showIndividualMargin) {
                                  setElementMarginLeft(e.target.value);
                                  applyElementStyle('marginLeft', e.target.value ? `${e.target.value}px` : '');
                                } else {
                                  const val = e.target.value;
                                  setElementMarginAll(val);
                                  applyMarginAll(val);
                                }
                              }}
                              placeholder="0"
                              title="Left"
                              min="0"
                              step="1"
                              className="w-full px-0.5 py-1 text-[8px] font-mono focus:outline-none text-center bg-white text-slate-900 border-0"
                            />
                            <label className="text-[7px] text-slate-500 block text-center py-0.5 bg-slate-50 border-t border-slate-300">Left</label>
                          </div>
                          <div className="w-px bg-slate-300"></div>
                          <button
                            onClick={() => {
                              if (!showIndividualMargin) {
                                setShowIndividualMargin(true);
                              } else {
                                setShowIndividualMargin(false);
                                const unifiedValue = elementMarginTop || elementMarginRight || elementMarginBottom || elementMarginLeft || '';
                                setElementMarginAll(unifiedValue);
                                if (unifiedValue) {
                                  applyMarginAll(unifiedValue);
                                }
                              }
                            }}
                            className={`px-1.5 flex items-center justify-center transition ${
                              showIndividualMargin 
                                ? 'text-slate-400 hover:text-slate-600 bg-white' 
                                : 'text-blue-500 hover:text-blue-600 bg-white'
                            }`}
                            title={showIndividualMargin ? 'Link values together' : 'Unlink values'}
                          >
                            <Icons.Link2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Line Height */}
                    <div className="w-24">
                      <label className="text-[9px] font-semibold text-slate-600 block mb-0.5">Line Height</label>
                      <div className="flex items-center gap-0.5">
                        <input
                          type="number"
                          value={elementLineHeight}
                          onChange={(e) => {
                            setElementLineHeight(e.target.value);
                            applyElementStyle('lineHeight', e.target.value ? e.target.value : '');
                          }}
                          placeholder="1.5"
                          min="1"
                          max="3"
                          step="0.1"
                          className="w-16 px-1 py-1 border border-slate-300 rounded text-[9px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="text-[8px] text-slate-500">em</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-between items-center pt-1.5">
                    <button
                      onClick={handleDeleteElement}
                      className="px-2.5 py-1 text-[10px] font-medium text-white bg-red-600 hover:bg-red-700 rounded transition flex items-center gap-1"
                      title="Delete this element"
                    >
                      <Icons.Trash className="w-3 h-3" />
                      Delete
                    </button>
                    <button
                      onClick={() => {
                        setShowStyleEditor(false);
                        setSelectedElement(null);
                        richEditorRef.current?.focus();
                      }}
                      className="px-2.5 py-1 text-[10px] font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}

              {/* Table Insertion Dialog */}
              {showTableDialog && (
                <div className="bg-slate-50 border-t border-slate-200 px-3 py-2.5 space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-[10px] font-bold text-slate-700 uppercase tracking-wide">Insert Table</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block mb-1">Rows (1-20)</label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={tableRows}
                        onChange={(e) => setTableRows(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block mb-1">Columns (1-10)</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={tableColumns}
                        onChange={(e) => setTableColumns(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex gap-1.5 justify-end pt-1.5">
                    <button
                      onClick={() => setShowTableDialog(false)}
                      className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => insertTable(tableRows, tableColumns)}
                      className="px-2.5 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition"
                    >
                      Insert
                    </button>
                  </div>
                </div>
              )}

              {/* Hidden file input for direct image insertion */}
              <input
                ref={imageFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageFileSelect}
                style={{ display: 'none' }}
              />

            </div>
          )}
        </div>
      </div>

      {/* Test Email Dialog */}
      {showTestEmailDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Icons.Mail className="w-5 h-5 text-purple-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Send Test Email</h2>
            </div>

            <p className="text-sm text-slate-600">
              Send a preview of this email template to your address to test the layout and content.
            </p>

            <div className="space-y-2">
              <label htmlFor="testEmailInput" className="block text-sm font-semibold text-slate-700">
                Recipient Email
              </label>
              <input
                id="testEmailInput"
                type="email"
                value={testEmailAddress}
                onChange={(e) => setTestEmailAddress(e.target.value)}
                placeholder="your.email@example.com"
                disabled={isSendingTestEmail}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100 disabled:text-slate-500"
              />
              {testEmailAddress && !testEmailAddress.includes('@') && (
                <p className="text-xs text-red-600">Please enter a valid email address</p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setShowTestEmailDialog(false);
                  setTestEmailAddress('');
                }}
                disabled={isSendingTestEmail}
                className="flex-1 px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-100 disabled:text-slate-400 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={sendTestEmail}
                disabled={isSendingTestEmail || !testEmailAddress.includes('@')}
                className="flex-1 px-3 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 disabled:text-slate-500 rounded-lg transition flex items-center justify-center gap-2"
              >
                {isSendingTestEmail && <Icons.Spinner className="w-4 h-4 animate-spin" />}
                {isSendingTestEmail ? 'Sending...' : 'Send Test'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});



export default EmailTemplateForm;
