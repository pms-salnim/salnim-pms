
"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MoreHorizontal, PlusCircle, Trash2, UploadCloud, X, Minus, Plus, Settings2, ChevronDown, Download as DownloadIcon, Upload as UploadIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Icons } from "@/components/icons";
import { createClient } from '@supabase/supabase-js';
import { toast } from '@/hooks/use-toast';
import type { RoomType, Amenity, BedConfiguration, BedType, AmenityCategory } from '@/types/roomType';
import { defaultAmenities, bedTypes, amenityCategories } from '@/types/roomType';
import type { Property } from "@/types/property";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Image from "next/image";
import { uploadFile, deleteFile } from '@/lib/uploadHelper';
import { useTranslation } from "react-i18next";

interface RoomTypesComponentProps {
  propertyId: string;
}

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
);

export default function RoomTypesComponent({ propertyId }: RoomTypesComponentProps) {
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoomType, setEditingRoomType] = useState<RoomType | null>(null);

  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingRoomType, setViewingRoomType] = useState<RoomType | null>(null);

  const [activeTab, setActiveTab] = useState("details");
  const [propertySettings, setPropertySettings] = useState<Property | null>(null);

  // Form state variables
  const [name, setName] = useState("");
  const [maxGuests, setMaxGuests] = useState<string>("");
  const [description, setDescription] = useState("");
  const [numberOfRoomsAvailable, setNumberOfRoomsAvailable] = useState<string>("");
  const [assignedRoomNumbersInput, setAssignedRoomNumbersInput] = useState(""); 
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [beds, setBeds] = useState<BedConfiguration[]>([]);

  // Form enhancement state
  const [amenitySearchTerm, setAmenitySearchTerm] = useState("");
  const [parsedRoomNumbers, setParsedRoomNumbers] = useState<string[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Template state
  const [customTemplates, setCustomTemplates] = useState<Record<string, any>>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`roomTypeTemplates_${propertyId}`);
      return stored ? JSON.parse(stored) : {};
    }
    return {};
  });
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  
  // Image state variables
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [initialThumbnailUrl, setInitialThumbnailUrl] = useState<string | null>(null);
  
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);
  const [initialGalleryUrls, setInitialGalleryUrls] = useState<string[]>([]);

  // Image management enhancement state
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [draggedOverIndex, setDraggedOverIndex] = useState<number | null>(null);
  const [dragSource, setDragSource] = useState<'thumbnail' | 'gallery' | null>(null);
  const [draggedThumbnailOverGallery, setDraggedThumbnailOverGallery] = useState<boolean>(false);
  const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
  const [dragToIndex, setDragToIndex] = useState<number | null>(null);

  // Form progress state
  const [formCompletion, setFormCompletion] = useState<number>(0);

  // Auto-save state
  const [draftSaveTime, setDraftSaveTime] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Filter state variables
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAmenities, setFilterAmenities] = useState<string[]>([]);
  const [filterBeds, setFilterBeds] = useState<string[]>([]);
  const [minCapacity, setMinCapacity] = useState<string>("");
  const [maxCapacity, setMaxCapacity] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  // Bulk operations state
  const [selectedRoomTypeIds, setSelectedRoomTypeIds] = useState(new Set<string>());
  const [isBulkAmenitiesModalOpen, setIsBulkAmenitiesModalOpen] = useState(false);
  const [isBulkBedsModalOpen, setIsBulkBedsModalOpen] = useState(false);
  const [bulkAmenititesToAdd, setBulkAmenititesToAdd] = useState<string[]>([]);
  const [bulkAmenititesToRemove, setBulkAmenititesToRemove] = useState<string[]>([]);
  const [bulkBedsToAdd, setBulkBedsToAdd] = useState<BedConfiguration[]>([]);
  const [bulkBedsToRemove, setBulkBedsToRemove] = useState<string[]>([]);

  // Import/Export state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Favorites/pinning state
  const [favoriteRoomTypeIds, setFavoriteRoomTypeIds] = useState<Set<string>>(new Set());
  const [sortByFavorites, setSortByFavorites] = useState(false);

  const thumbInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation(['pages/rooms/types/content', 'amenities']);

  useEffect(() => {
    if (!propertyId) {
      setIsLoading(false);
      setRoomTypes([]);
      return;
    }
    setIsLoading(true);

    const loadRoomTypes = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          console.error('Not authenticated');
          setIsLoading(false);
          return;
        }

        const response = await fetch(
          `/api/rooms/room-types/list?propertyId=${propertyId}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${sessionData.session.access_token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const transformed = transformRoomTypesResponse(data.roomTypes);
        setRoomTypes(transformed);
      } catch (error) {
        console.error("Error fetching room types:", error);
        toast({ title: "Error", description: "Could not fetch room types.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };

    loadRoomTypes();
  }, [propertyId]);

  // Predefined room type templates
  const predefinedTemplates = {
    standard: {
      name: "Standard Double Room",
      maxGuests: 2,
      description: "Comfortable double room with modern amenities",
      beds: [{ type: "Queen" as BedType, count: 1 }],
      selectedAmenities: ["wifi", "tv", "ac", "minibar"].filter(id => defaultAmenities.some(a => a.id === id)),
    },
    luxury: {
      name: "Luxury Suite",
      maxGuests: 4,
      description: "Premium suite with premium amenities and spacious layout",
      beds: [
        { type: "King" as BedType, count: 1 },
        { type: "Queen" as BedType, count: 1 },
      ],
      selectedAmenities: defaultAmenities.slice(0, 10).map(a => a.id),
    },
    budget: {
      name: "Budget Room",
      maxGuests: 2,
      description: "Affordable room with essential amenities",
      beds: [{ type: "Twin" as BedType, count: 1 }],
      selectedAmenities: ["wifi", "fan"].filter(id => defaultAmenities.some(a => a.id === id)),
    },
  };

  // Helper function to transform API response to RoomType format
  // Handles both old format (data nested in amenities JSONB) and new format (flat columns)
  const transformRoomTypesResponse = (roomTypesData: any[]): RoomType[] => {
    return (roomTypesData || []).map((rt: any) => {
      let amenitiesData: any = {};
      
      if (rt.amenities && typeof rt.amenities === 'object' && !Array.isArray(rt.amenities)) {
        amenitiesData = rt.amenities;
      } else if (typeof rt.amenities === 'string') {
        try {
          amenitiesData = JSON.parse(rt.amenities);
        } catch {
          amenitiesData = {};
        }
      } else {
        amenitiesData = {
          selectedAmenities: rt.selected_amenities || [],
          beds: rt.beds || [],
          numberOfRoomsAvailable: rt.number_of_rooms_available || null,
          assignedRoomNumbers: rt.assigned_room_numbers || [],
          thumbnailImageUrl: rt.thumbnail_image_url || '',
          galleryImageUrls: rt.gallery_image_urls || [],
        };
      }

      return {
        id: rt.id,
        name: rt.name,
        maxGuests: rt.max_guests,
        description: rt.description,
        propertyId: rt.property_id,
        numberOfRoomsAvailable: amenitiesData.numberOfRoomsAvailable || null,
        assignedRoomNumbers: amenitiesData.assignedRoomNumbers || [],
        selectedAmenities: amenitiesData.selectedAmenities || [],
        beds: amenitiesData.beds || [],
        thumbnailImageUrl: amenitiesData.thumbnailImageUrl || '',
        galleryImageUrls: amenitiesData.galleryImageUrls || [],
        createdAt: new Date(rt.created_at),
      };
    });
  };

  // Load template
  const loadTemplate = (templateKey: string) => {
    const template = templateKey.startsWith("custom_") 
      ? customTemplates[templateKey]
      : predefinedTemplates[templateKey as keyof typeof predefinedTemplates];
    
    if (template) {
      setName(template.name);
      setMaxGuests(template.maxGuests.toString());
      setDescription(template.description || "");
      setBeds(template.beds || []);
      setSelectedAmenities(template.selectedAmenities || []);
      setSelectedTemplate(templateKey);
      toast({ title: "Template Loaded", description: `Loaded "${template.name}" template` });
    }
  };

  // Save current form as custom template
  const saveAsTemplate = () => {
    if (!name.trim()) {
      toast({ title: "Error", description: "Room type name is required", variant: "destructive" });
      return;
    }

    const templateKey = `custom_${Date.now()}`;
    const newTemplate = {
      name,
      maxGuests: parseInt(maxGuests),
      description,
      beds,
      selectedAmenities,
    };

    const updated = { ...customTemplates, [templateKey]: newTemplate };
    setCustomTemplates(updated);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(`roomTypeTemplates_${propertyId}`, JSON.stringify(updated));
    }

    toast({ title: "Success", description: `Template "${name}" saved` });
  };

  // Calculate total bed capacity
  const calculateBedCapacity = (): number => {
    const bedCapacityMap: Record<string, number> = {
      'Twin': 1,
      'Double': 2,
      'Queen': 2,
      'King': 2,
      'Bunk': 2,
      'Sofa': 1,
    };
    
    return beds.reduce((total, bed) => {
      const capacity = bedCapacityMap[bed.type] || 1;
      return total + (capacity * (bed.count || 1));
    }, 0);
  };

  // Get bed visual preview
  const getBedVisualPreview = (): string => {
    if (beds.length === 0) return "No beds configured";
    const bedEmojis: Record<string, string> = {
      'Twin': '🛏️',
      'Double': '🛏️',
      'Queen': '👑',
      'King': '👑',
      'Bunk': '🔲',
      'Sofa': '🛋️',
    };
    
    return beds
      .map(b => `${bedEmojis[b.type] || '🛏️'} ${b.type} x${b.count}`)
      .join(" • ");
  };

  const resetForm = () => {
    setName("");
    setMaxGuests("");
    setDescription("");
    setNumberOfRoomsAvailable("");
    setAssignedRoomNumbersInput("");
    setSelectedAmenities([]);
    setBeds([]);
    setEditingRoomType(null);
    setActiveTab("details");
    setThumbnailFile(null);
    setThumbnailPreview(null);
    setInitialThumbnailUrl(null);
    setGalleryFiles([]);
    setGalleryPreviews([]);
    setInitialGalleryUrls([]);
    setAmenitySearchTerm("");
    setParsedRoomNumbers([]);
    setFormErrors({});
  };
  
  useEffect(() => {
    if (editingRoomType) {
      setName(editingRoomType.name);
      setMaxGuests(editingRoomType.maxGuests !== undefined ? String(editingRoomType.maxGuests) : "");
      setDescription(editingRoomType.description || "");
      setNumberOfRoomsAvailable(editingRoomType.numberOfRoomsAvailable === null || editingRoomType.numberOfRoomsAvailable === undefined ? "" : String(editingRoomType.numberOfRoomsAvailable));
      const roomNumbersStr = editingRoomType.assignedRoomNumbers?.join(', ') || "";
      setAssignedRoomNumbersInput(roomNumbersStr);
      setParsedRoomNumbers(editingRoomType.assignedRoomNumbers || []);
      setSelectedAmenities(editingRoomType.selectedAmenities || []);
      setBeds(editingRoomType.beds || []);
      
      setThumbnailPreview(editingRoomType.thumbnailImageUrl || null);
      setInitialThumbnailUrl(editingRoomType.thumbnailImageUrl || null);
      setGalleryPreviews(editingRoomType.galleryImageUrls || []);
      setInitialGalleryUrls(editingRoomType.galleryImageUrls || []);
    } else {
        resetForm();
    }
  }, [editingRoomType]);

  const handleOpenModal = (roomType: RoomType | null = null) => {
    if (roomType) {
      setEditingRoomType(roomType); 
    } else {
      resetForm();
    }
    setIsModalOpen(true);
  };
  
  const handleViewDetails = (roomType: RoomType) => {
    setViewingRoomType(roomType);
    setIsViewModalOpen(true);
  };

  // Calculate form completion percentage
  const calculateFormCompletion = () => {
    let filledFields = 0;
    let totalFields = 8; // Configurable count of important fields

    if (name.trim()) filledFields++;
    if (maxGuests) filledFields++;
    if (description.trim()) filledFields++;
    if (beds.length > 0) filledFields++;
    if (selectedAmenities.length > 0) filledFields++;
    if (thumbnailPreview || initialThumbnailUrl) filledFields++;
    if (galleryPreviews.length > 0 || initialGalleryUrls.length > 0) filledFields++;
    if (numberOfRoomsAvailable) filledFields++;

    const percentage = Math.round((filledFields / totalFields) * 100);
    setFormCompletion(Math.min(percentage, 100));
    return percentage;
  };

  // Update form completion on any field change
  useEffect(() => {
    calculateFormCompletion();
  }, [name, maxGuests, description, beds, selectedAmenities, thumbnailPreview, initialThumbnailUrl, galleryPreviews, initialGalleryUrls, numberOfRoomsAvailable]);

  // Auto-save form data every 10 seconds and track unsaved changes
  useEffect(() => {
    if (!isModalOpen) return;
    
    setHasUnsavedChanges(true);
    
    // Clear previous timer
    if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
    
    // Set new auto-save timer
    autoSaveTimerRef.current = setInterval(() => {
      autoSaveFormData();
    }, 10000); // Auto-save every 10 seconds
    
    return () => {
      if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
    };
  }, [name, maxGuests, description, numberOfRoomsAvailable, assignedRoomNumbersInput, selectedAmenities, beds, thumbnailPreview, galleryPreviews, isModalOpen, propertyId, editingRoomType?.id]);

  // Load draft when modal opens
  useEffect(() => {
    if (isModalOpen && !editingRoomType) {
      loadDraftData();
    }
  }, [isModalOpen, editingRoomType]);

  // Warn before closing if unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && isModalOpen) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, isModalOpen]);

  // Reorder gallery images via drag
  const reorderGalleryImages = (fromIndex: number, toIndex: number) => {
    const newPreviews = [...galleryPreviews];
    const newFiles = [...galleryFiles];
    
    // Move items
    const preview = newPreviews.splice(fromIndex, 1)[0];
    newPreviews.splice(toIndex, 0, preview);
    
    if (newFiles[fromIndex]) {
      const file = newFiles.splice(fromIndex, 1)[0];
      newFiles.splice(toIndex, 0, file);
      setGalleryFiles(newFiles);
    }
    
    setGalleryPreviews(newPreviews);
    toast({ title: "Success", description: "Image reordered" });
  };

  // Cross-section drag handlers: swap between thumbnail and gallery
  const moveGalleryImageToThumbnail = (galleryIndex: number) => {
    const galleryPreview = galleryPreviews[galleryIndex];
    const galleryFile = galleryFiles[galleryIndex];
    
    // Save old thumbnail to gallery if it exists
    if (thumbnailFile && thumbnailPreview) {
      const newGalleryFiles = [...galleryFiles];
      const newGalleryPreviews = [...galleryPreviews];
      
      // Remove the gallery item being promoted
      newGalleryFiles.splice(galleryIndex, 1);
      newGalleryPreviews.splice(galleryIndex, 1);
      
      // Add old thumbnail at the start of gallery
      newGalleryFiles.unshift(thumbnailFile);
      newGalleryPreviews.unshift(thumbnailPreview);
      
      setGalleryFiles(newGalleryFiles);
      setGalleryPreviews(newGalleryPreviews);
    } else {
      // Just remove from gallery
      setGalleryFiles(prev => prev.filter((_, i) => i !== galleryIndex));
      setGalleryPreviews(prev => prev.filter((_, i) => i !== galleryIndex));
    }
    
    // Set new thumbnail
    setThumbnailFile(galleryFile);
    setThumbnailPreview(galleryPreview);
    setDragSource(null);
    toast({ title: "Success", description: "Image set as thumbnail" });
  };

  const moveThumbnailToGallery = () => {
    if (!thumbnailFile || !thumbnailPreview) return;
    
    // Add thumbnail to beginning of gallery
    setGalleryFiles(prev => [thumbnailFile, ...prev]);
    setGalleryPreviews(prev => [thumbnailPreview, ...prev]);
    
    // Clear thumbnail
    setThumbnailFile(null);
    setThumbnailPreview(null);
    if(thumbInputRef.current) thumbInputRef.current.value = "";
    
    setDragSource(null);
    toast({ title: "Success", description: "Thumbnail moved to gallery" });
  };

  // Get gallery with live reordering preview
  const getDisplayGallery = () => {
    if (dragFromIndex !== null && dragToIndex !== null && dragFromIndex !== dragToIndex) {
      const preview = [...galleryPreviews];
      const item = preview.splice(dragFromIndex, 1)[0];
      preview.splice(dragToIndex, 0, item);
      return preview;
    }
    return galleryPreviews;
  };

  // Quick select amenity presets
  const amenityPresets = {
    essential: {
      label: "Essential",
      description: "WiFi, TV, AC",
      amenityIds: ["wifi", "tv", "ac"].filter(id => defaultAmenities.some(a => a.id === id)),
    },
    luxury: {
      label: "Luxury",
      description: "All premium amenities",
      amenityIds: defaultAmenities.slice(0, 15).map(a => a.id),
    },
    business: {
      label: "Business",
      description: "WiFi, Desk, Phone",
      amenityIds: ["wifi", "tv", "ac"].filter(id => defaultAmenities.some(a => a.id === id)),
    },
    family: {
      label: "Family",
      description: "WiFi, TV, Kitchen",
      amenityIds: defaultAmenities.filter(a => ["wifi", "tv", "ac", "kitchen"].some(key => a.id.includes(key))).slice(0, 5).map(a => a.id),
    },
  };

  const applyAmenityPreset = (preset: keyof typeof amenityPresets) => {
    const presetAmenities = amenityPresets[preset].amenityIds;
    setSelectedAmenities(presetAmenities);
    toast({ title: "Preset Applied", description: `Applied "${amenityPresets[preset].label}" amenities` });
  };

  const selectAllAmenitiesInCategory = (category: string) => {
    const categoryAmenities = defaultAmenities
      .filter(a => a.category === category)
      .map(a => a.id);
    
    const newSelected = Array.from(new Set([...selectedAmenities, ...categoryAmenities]));
    setSelectedAmenities(newSelected);
  };

  const deselectAllAmenitiesInCategory = (category: string) => {
    const categoryAmenities = defaultAmenities
      .filter(a => a.category === category)
      .map(a => a.id);
    
    const newSelected = selectedAmenities.filter(id => !categoryAmenities.includes(id));
    setSelectedAmenities(newSelected);
  };

  const handleAmenityChange = (amenityId: string) => {
    setSelectedAmenities(prev =>
      prev.includes(amenityId)
        ? prev.filter(id => id !== amenityId)
        : [...prev, amenityId]
    );
  };

  // Parse room numbers from input string (handles ranges and comma-separated values)
  const parseRoomNumbers = (input: string): string[] => {
    const numbers: Set<string> = new Set();
    if (!input.trim()) return [];

    const parts = input.split(/[,;]/).map(p => p.trim());
    
    for (const part of parts) {
      if (!part) continue;
      
      // Check if it's a range (e.g., "101-110")
      if (part.includes("-")) {
        const [start, end] = part.split("-").map(s => s.trim());
        const startNum = parseInt(start);
        const endNum = parseInt(end);
        
        if (!isNaN(startNum) && !isNaN(endNum)) {
          const min = Math.min(startNum, endNum);
          const max = Math.max(startNum, endNum);
          for (let i = min; i <= max; i++) {
            numbers.add(i.toString());
          }
        } else {
          numbers.add(part);
        }
      } else {
        numbers.add(part);
      }
    }
    
    return Array.from(numbers).sort((a, b) => {
      const aNum = parseInt(a);
      const bNum = parseInt(b);
      if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
      return a.localeCompare(b);
    });
  };

  // Handle room numbers input with real-time parsing
  const handleRoomNumbersChange = (value: string) => {
    setAssignedRoomNumbersInput(value);
    const parsed = parseRoomNumbers(value);
    setParsedRoomNumbers(parsed);
  };

  // Validate form fields
  const validateForm = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    
    if (!name.trim()) {
      errors.name = "Room type name is required";
    } else if (name.trim().length < 2) {
      errors.name = "Name must be at least 2 characters";
    }
    
    if (!maxGuests) {
      errors.maxGuests = "Max guests is required";
    } else if (parseInt(maxGuests) < 1) {
      errors.maxGuests = "Max guests must be at least 1";
    }
    
    if (description.length > 1000) {
      errors.description = "Description must be less than 1000 characters";
    }

    if (numberOfRoomsAvailable && parseInt(numberOfRoomsAvailable) < 0) {
      errors.numberOfRoomsAvailable = "Number of rooms cannot be negative";
    }

    setFormErrors(errors);
    return errors;
  };

  // Check if form has specific field errors
  const hasFieldError = (fieldName: string): boolean => {
    return !!formErrors[fieldName];
  };

  // Format time for draft save indicator
  const formatDraftTime = (): string => {
    if (!draftSaveTime) return "";
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - draftSaveTime.getTime()) / 1000);
    
    if (diffSeconds < 60) return "Just now";
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return "Long ago";
  };

  // Auto-save form data to localStorage
  const autoSaveFormData = () => {
    if (!propertyId || !isModalOpen) return;
    
    const draftData = {
      name, maxGuests, description, numberOfRoomsAvailable,
      assignedRoomNumbersInput, selectedAmenities, beds,
      parsedRoomNumbers, thumbnailPreview, galleryPreviews
    };
    
    localStorage.setItem(`roomTypeDraft_${propertyId}_${editingRoomType?.id || 'new'}`, JSON.stringify(draftData));
    setDraftSaveTime(new Date());
    setHasUnsavedChanges(false);
  };

  // Load draft from localStorage
  const loadDraftData = () => {
    const draftKey = `roomTypeDraft_${propertyId}_${editingRoomType?.id || 'new'}`;
    const saved = localStorage.getItem(draftKey);
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        setName(draft.name || "");
        setMaxGuests(draft.maxGuests || "");
        setDescription(draft.description || "");
        setNumberOfRoomsAvailable(draft.numberOfRoomsAvailable || "");
        setAssignedRoomNumbersInput(draft.assignedRoomNumbersInput || "");
        setSelectedAmenities(draft.selectedAmenities || []);
        setBeds(draft.beds || []);
        setParsedRoomNumbers(draft.parsedRoomNumbers || []);
        if (draft.thumbnailPreview) setThumbnailPreview(draft.thumbnailPreview);
        if (draft.galleryPreviews) setGalleryPreviews(draft.galleryPreviews);
        setDraftSaveTime(new Date());
      } catch (e) {
        console.error("Failed to load draft:", e);
      }
    }
  };

  // Check if a tab is complete
  const isTabComplete = (tab: string): boolean => {
    switch (tab) {
      case "details":
        return !hasFieldError("name") && !hasFieldError("maxGuests") && name.trim() !== "" && maxGuests !== "";
      case "beds":
        return beds.length > 0;
      case "amenities":
        return selectedAmenities.length > 0;
      case "gallery":
        return !!thumbnailPreview;
      default:
        return true;
    }
  };

  // Get tabs with incomplete fields
  const getIncompleteTabsCount = (): number => {
    return ["details", "beds", "amenities", "gallery"].filter(tab => !isTabComplete(tab)).length;
  };

  // Auto-scroll to first error field
  const scrollToFirstError = () => {
    const errorFields = Object.keys(formErrors);
    if (errorFields.length === 0) return;
    
    const firstErrorField = errorFields[0];
    const element = document.querySelector(`[data-field="${firstErrorField}"]`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      (element as HTMLInputElement).focus();
    }
  };

  const handleBedCountChange = (bedType: BedType, delta: number) => {
    setBeds(prevBeds => {
        const existingBed = prevBeds.find(b => b.type === bedType);
        if (existingBed) {
            const newCount = (existingBed.count || 0) + delta;
            if (newCount > 0) {
                return prevBeds.map(b => b.type === bedType ? { ...b, count: newCount } : b);
            } else {
                return prevBeds.filter(b => b.type !== bedType);
            }
        } else if (delta > 0) {
            return [...prevBeds, { type: bedType, count: 1 }];
        }
        return prevBeds;
    });
  };
  
  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        setThumbnailFile(file);
        setThumbnailPreview(URL.createObjectURL(file));
    }
  };

  const removeThumbnail = (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    setThumbnailFile(null); setThumbnailPreview(null);
    if(thumbInputRef.current) thumbInputRef.current.value = "";
  };
  
  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
        const files = Array.from(e.target.files);
        // Simulate progress for UX
        let currentProgress = 0;
        const interval = setInterval(() => {
          currentProgress += Math.random() * 30;
          if (currentProgress >= 90) {
            setUploadProgress(90);
            clearInterval(interval);
          } else {
            setUploadProgress(Math.round(currentProgress));
          }
        }, 100);

        setGalleryFiles(prev => [...prev, ...files]);
        const newPreviews = files.map(file => URL.createObjectURL(file));
        setGalleryPreviews(prev => [...prev, ...newPreviews]);
        
        setTimeout(() => {
          setUploadProgress(100);
          setTimeout(() => setUploadProgress(0), 1000);
          clearInterval(interval);
        }, 800);
    }
  };

  const handleGalleryDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggedOverIndex(null);
    
    if (e.dataTransfer.files) {
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      if (files.length > 0) {
        setGalleryFiles(prev => [...prev, ...files]);
        const newPreviews = files.map(file => URL.createObjectURL(file));
        setGalleryPreviews(prev => [...prev, ...newPreviews]);
        toast({ title: "Success", description: `Added ${files.length} image(s)` });
      }
    }
  };

  const removeGalleryImage = (e: React.MouseEvent, index: number, previewUrl: string) => {
    e.stopPropagation(); e.preventDefault();
    if (previewUrl.startsWith('blob:')) {
        const fileIndex = galleryPreviews.filter(p => p.startsWith('blob:')).indexOf(previewUrl);
        setGalleryFiles(prev => prev.filter((_, i) => i !== fileIndex));
    }
    setGalleryPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const removeAllGalleryImages = () => {
    setGalleryFiles([]);
    setGalleryPreviews([]);
    setInitialGalleryUrls([]);
    toast({ title: "Success", description: "All gallery images removed" });
  };

  const handleSaveChanges = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!propertyId) {
      toast({ title: "Error", description: "Property ID is missing.", variant: "destructive" });
      return;
    }

    // Validate form
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      scrollToFirstError();
      toast({ title: t('toasts.validation_error.title'), description: Object.values(errors)[0], variant: "destructive" });
      return;
    }

    setIsLoading(true);

    try {
        let finalThumbnailUrl = initialThumbnailUrl;
        if (thumbnailFile) {
            finalThumbnailUrl = await uploadFile(`properties/${propertyId}/roomTypes`, thumbnailFile);
            if (initialThumbnailUrl) {
                await deleteFile(initialThumbnailUrl).catch(e => console.warn("Old thumbnail deletion failed.", e));
            }
        } else if (!thumbnailPreview && initialThumbnailUrl) {
            await deleteFile(initialThumbnailUrl).catch(e => console.warn("Old thumbnail deletion failed.", e));
            finalThumbnailUrl = null;
        }

        const existingUrls = galleryPreviews.filter(p => !p.startsWith('blob:'));
        const newImageFiles = galleryFiles;
        const uploadedUrls = await Promise.all(
            newImageFiles.map(file => uploadFile(`properties/${propertyId}/roomTypes`, file))
        );

        const urlsToDelete = initialGalleryUrls.filter(url => !existingUrls.includes(url));
        await Promise.all(urlsToDelete.map(url => deleteFile(url)));
        
        const finalGalleryUrls = [...existingUrls, ...uploadedUrls];
      
        const parsedAssignedRoomNumbers = parsedRoomNumbers.length > 0 ? parsedRoomNumbers : [];
        
        // Get session for auth
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          throw new Error('Not authenticated');
        }

        const payload = {
          action: editingRoomType ? 'update' : 'create',
          propertyId,
          roomTypeId: editingRoomType?.id,
          name,
          description: description || "",
          maxGuests: Number(maxGuests),
          amenities: JSON.stringify({
            selectedAmenities,
            beds,
            numberOfRoomsAvailable: numberOfRoomsAvailable === "" ? null : Number(numberOfRoomsAvailable),
            assignedRoomNumbers: parsedAssignedRoomNumbers,
            thumbnailImageUrl: finalThumbnailUrl || '',
            galleryImageUrls: finalGalleryUrls,
          }),
        };

        const response = await fetch('/api/rooms/room-types/crud', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData.session.access_token}`,
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        toast({ 
          title: editingRoomType ? t('toasts.success_update.title') : t('toasts.success_create.title'), 
          description: editingRoomType ? t('toasts.success_update.description') : t('toasts.success_create.description')
        });
        
        // Clear draft on successful save
        const draftKey = `roomTypeDraft_${propertyId}_${editingRoomType?.id || 'new'}`;
        localStorage.removeItem(draftKey);
        setDraftSaveTime(null);
        setHasUnsavedChanges(false);
        
        setIsModalOpen(false);
        resetForm();

        // Reload room types
        const listResponse = await fetch(
          `/api/rooms/room-types/list?propertyId=${propertyId}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${sessionData.session.access_token}`,
            },
          }
        );
        if (listResponse.ok) {
          const data = await listResponse.json();
          const transformed = transformRoomTypesResponse(data.roomTypes);
          setRoomTypes(transformed);
        }

    } catch (error: any) { 
        console.error("Error saving room type:", error);
        toast({ title: t('toasts.error_save.title'), description: t('toasts.error_save.description'), variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleDeleteRoomType = async (roomTypeId: string) => {
    if (!confirm(t('confirm_delete'))) {
        return;
    }
    setIsLoading(true);
    try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          throw new Error('Not authenticated');
        }

        const response = await fetch('/api/rooms/room-types/crud', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData.session.access_token}`,
          },
          body: JSON.stringify({
            action: 'delete',
            propertyId,
            roomTypeId,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          
          // Check if this is a dependency error (rooms still assigned)
          if (response.status === 400 && errorData.dependentRoomCount !== undefined) {
            throw new Error(errorData.error || `Cannot delete: ${errorData.dependentRoomCount} room(s) are still assigned to this type`);
          }
          
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        toast({ title: t('toasts.success_delete.title'), description: t('toasts.success_delete.description') });

        // Reload room types
        const listResponse = await fetch(
          `/api/rooms/room-types/list?propertyId=${propertyId}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${sessionData.session.access_token}`,
            },
          }
        );
        if (listResponse.ok) {
          const data = await listResponse.json();
          const transformed = transformRoomTypesResponse(data.roomTypes);
          setRoomTypes(transformed);
        }
    } catch (error) {
        console.error("Error deleting room type:", error);
        const errorMessage = error instanceof Error ? error.message : t('toasts.error_delete.description');
        toast({ title: t('toasts.error_delete.title'), description: errorMessage, variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  };
  
  const getBedTypeLabel = (bedType: BedType) => {
    return t(`bed_types.${bedType.toLowerCase().replace(/_/g, '-')}`);
  }

  const getAmenityDetails = (amenityId: string): Amenity | undefined => {
    return defaultAmenities.find(a => a.id === amenityId);
  };

  // Filtered room types based on search and filters
  const filteredRoomTypes = React.useMemo(() => {
    return roomTypes.filter(type => {
      // Search filter by name
      if (searchTerm && !type.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }

      // Filter by amenities (must have all selected amenities)
      if (filterAmenities.length > 0) {
        const hasAllAmenities = filterAmenities.every(amenityId =>
          type.selectedAmenities?.includes(amenityId)
        );
        if (!hasAllAmenities) return false;
      }

      // Filter by bed configuration (must have at least one of selected beds)
      if (filterBeds.length > 0) {
        const hasMatchingBed = filterBeds.some(bedType =>
          type.beds?.some(b => b.type === bedType)
        );
        if (!hasMatchingBed) return false;
      }

      // Filter by capacity range
      if (minCapacity !== "") {
        if (type.maxGuests < parseInt(minCapacity)) return false;
      }
      if (maxCapacity !== "") {
        if (type.maxGuests > parseInt(maxCapacity)) return false;
      }

      return true;
    });
  }, [roomTypes, searchTerm, filterAmenities, filterBeds, minCapacity, maxCapacity]);

  const handleAmenityFilterChange = (amenityId: string) => {
    setFilterAmenities(prev =>
      prev.includes(amenityId)
        ? prev.filter(id => id !== amenityId)
        : [...prev, amenityId]
    );
  };

  const handleBedFilterChange = (bedType: string) => {
    setFilterBeds(prev =>
      prev.includes(bedType)
        ? prev.filter(t => t !== bedType)
        : [...prev, bedType]
    );
  };

  const resetFilters = () => {
    setSearchTerm("");
    setFilterAmenities([]);
    setFilterBeds([]);
    setMinCapacity("");
    setMaxCapacity("");
    setShowFilters(false);
  };

  const handleSelectRoomType = (roomTypeId: string) => {
    setSelectedRoomTypeIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(roomTypeId)) {
        newSet.delete(roomTypeId);
      } else {
        newSet.add(roomTypeId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedRoomTypeIds.size === filteredRoomTypes.length) {
      setSelectedRoomTypeIds(new Set());
    } else {
      setSelectedRoomTypeIds(new Set(filteredRoomTypes.map(rt => rt.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRoomTypeIds.size === 0) return;
    if (!confirm(`Delete ${selectedRoomTypeIds.size} room type(s)?`)) {
      return;
    }

    setIsLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('Not authenticated');
      }

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const roomTypeId of selectedRoomTypeIds) {
        try {
          const response = await fetch('/api/rooms/room-types/crud', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sessionData.session.access_token}`,
            },
            body: JSON.stringify({
              action: 'delete',
              propertyId,
              roomTypeId,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            
            // Handle dependency errors
            if (response.status === 400 && errorData.dependentRoomCount !== undefined) {
              errors.push(`${roomTypes.find(rt => rt.id === roomTypeId)?.name || roomTypeId}: ${errorData.dependentRoomCount} room(s) assigned`);
              errorCount++;
            } else {
              errors.push(`${roomTypes.find(rt => rt.id === roomTypeId)?.name || roomTypeId}: ${errorData.error || 'Failed to delete'}`);
              errorCount++;
            }
          } else {
            successCount++;
          }
        } catch (itemError) {
          console.error(`Error deleting room type ${roomTypeId}:`, itemError);
          errors.push(`${roomTypes.find(rt => rt.id === roomTypeId)?.name || roomTypeId}: ${itemError instanceof Error ? itemError.message : 'Unknown error'}`);
          errorCount++;
        }
      }

      // Reload room types
      const listResponse = await fetch(
        `/api/rooms/room-types/list?propertyId=${propertyId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${sessionData.session.access_token}`,
          },
        }
      );
      if (listResponse.ok) {
        const data = await listResponse.json();
        const transformed = transformRoomTypesResponse(data.roomTypes);
        setRoomTypes(transformed);
      }

      setSelectedRoomTypeIds(new Set());

      // Show results
      if (successCount > 0) {
        toast({ 
          title: "Success", 
          description: `Deleted ${successCount} room type(s)` 
        });
      }
      
      if (errorCount > 0) {
        toast({ 
          title: "Partial Failure", 
          description: `Failed to delete ${errorCount} room type(s). ${errors.join('; ')}`,
          variant: "destructive" 
        });
      }
    } catch (error) {
      console.error("Error deleting room types:", error);
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to delete room types", 
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkAmenitiesApply = async () => {
    if (selectedRoomTypeIds.size === 0 || (bulkAmenititesToAdd.length === 0 && bulkAmenititesToRemove.length === 0)) {
      return;
    }

    setIsLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('Not authenticated');
      }

      let successCount = 0;
      let errorCount = 0;

      for (const roomTypeId of selectedRoomTypeIds) {
        try {
          const roomType = roomTypes.find(rt => rt.id === roomTypeId);
          if (!roomType) continue;

          let updatedAmenities = [...(roomType.selectedAmenities || [])];
          
          // Add amenities
          bulkAmenititesToAdd.forEach(amenity => {
            if (!updatedAmenities.includes(amenity)) {
              updatedAmenities.push(amenity);
            }
          });

          // Remove amenities
          updatedAmenities = updatedAmenities.filter(a => !bulkAmenititesToRemove.includes(a));

          const response = await fetch('/api/rooms/room-types/crud', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sessionData.session.access_token}`,
            },
            body: JSON.stringify({
              action: 'update',
              propertyId,
              roomTypeId,
              name: roomType.name,
              description: roomType.description,
              maxGuests: roomType.maxGuests,
              amenities: {
                selectedAmenities: updatedAmenities,
                beds: roomType.beds,
                numberOfRoomsAvailable: roomType.numberOfRoomsAvailable,
                assignedRoomNumbers: roomType.assignedRoomNumbers,
                thumbnailImageUrl: roomType.thumbnailImageUrl,
                galleryImageUrls: roomType.galleryImageUrls,
              },
            }),
          });

          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          console.error(`Error updating amenities for room type ${roomTypeId}:`, error);
          errorCount++;
        }
      }

      // Reload room types
      const listResponse = await fetch(
        `/api/rooms/room-types/list?propertyId=${propertyId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${sessionData.session.access_token}`,
          },
        }
      );
      if (listResponse.ok) {
        const data = await listResponse.json();
        const transformed = transformRoomTypesResponse(data.roomTypes);
        setRoomTypes(transformed);
      }

      toast({ title: "Success", description: `Updated amenities for ${successCount} room type(s)` });
      setIsBulkAmenitiesModalOpen(false);
      setBulkAmenititesToAdd([]);
      setBulkAmenititesToRemove([]);
      setSelectedRoomTypeIds(new Set());
      
      if (errorCount > 0) {
        toast({ title: "Warning", description: `Failed to update amenities for ${errorCount} room type(s)`, variant: "destructive" });
      }
    } catch (error) {
      console.error("Error updating amenities:", error);
      toast({ title: "Error", description: "Failed to update amenities", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkBedsApply = async () => {
    if (selectedRoomTypeIds.size === 0 || (bulkBedsToAdd.length === 0 && bulkBedsToRemove.length === 0)) {
      return;
    }

    setIsLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('Not authenticated');
      }

      let successCount = 0;
      let errorCount = 0;

      for (const roomTypeId of selectedRoomTypeIds) {
        try {
          const roomType = roomTypes.find(rt => rt.id === roomTypeId);
          if (!roomType) continue;

          let updatedBeds = [...(roomType.beds || [])];

          // Add/update bed counts
          bulkBedsToAdd.forEach(newBed => {
            const existingIndex = updatedBeds.findIndex(b => b.type === newBed.type);
            if (existingIndex >= 0) {
              updatedBeds[existingIndex] = { ...updatedBeds[existingIndex], count: (updatedBeds[existingIndex].count || 0) + (newBed.count || 1) };
            } else {
              updatedBeds.push(newBed);
            }
          });

          // Remove bed types
          updatedBeds = updatedBeds.filter(b => !bulkBedsToRemove.includes(b.type));
          updatedBeds = updatedBeds.filter(b => (b.count || 0) > 0);

          const response = await fetch('/api/rooms/room-types/crud', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sessionData.session.access_token}`,
            },
            body: JSON.stringify({
              action: 'update',
              propertyId,
              roomTypeId,
              name: roomType.name,
              description: roomType.description,
              maxGuests: roomType.maxGuests,
              amenities: {
                selectedAmenities: roomType.selectedAmenities,
                beds: updatedBeds,
                numberOfRoomsAvailable: roomType.numberOfRoomsAvailable,
                assignedRoomNumbers: roomType.assignedRoomNumbers,
                thumbnailImageUrl: roomType.thumbnailImageUrl,
                galleryImageUrls: roomType.galleryImageUrls,
              },
            }),
          });

          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          console.error(`Error updating beds for room type ${roomTypeId}:`, error);
          errorCount++;
        }
      }

      // Reload room types
      const listResponse = await fetch(
        `/api/rooms/room-types/list?propertyId=${propertyId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${sessionData.session.access_token}`,
          },
        }
      );
      if (listResponse.ok) {
        const data = await listResponse.json();
        const transformed = transformRoomTypesResponse(data.roomTypes);
        setRoomTypes(transformed);
      }

      toast({ title: "Success", description: `Updated beds for ${successCount} room type(s)` });
      setIsBulkBedsModalOpen(false);
      setBulkBedsToAdd([]);
      setBulkBedsToRemove([]);
      setSelectedRoomTypeIds(new Set());
      
      if (errorCount > 0) {
        toast({ title: "Warning", description: `Failed to update beds for ${errorCount} room type(s)`, variant: "destructive" });
      }
    } catch (error) {
      console.error("Error updating beds:", error);
      toast({ title: "Error", description: "Failed to update beds", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (roomTypes.length === 0) {
      toast({ title: "No data", description: "No room types to export", variant: "default" });
      return;
    }

    const headers = ["Room Type Name", "Max Guests", "Number of Rooms", "Assigned Room Numbers", "Description", "Amenities", "Beds"];
    const csvContent = [
      headers.join(","),
      ...roomTypes.map(type => {
        const amenitiesStr = (type.selectedAmenities || [])
          .map(id => {
            const amenity = defaultAmenities.find(a => a.id === id);
            return amenity ? t(`amenities:${amenity.labelKey}`) : id;
          })
          .join(";");
        
        const bedsStr = (type.beds || [])
          .map(bed => `${getBedTypeLabel(bed.type)}:${bed.count}`)
          .join(";");

        const descriptionStr = (type.description || "").replace(/,/g, ";").replace(/"/g, '""');
        const assignedRoomsStr = (type.assignedRoomNumbers || []).join(";");

        return [
          `"${type.name}"`,
          type.maxGuests,
          type.numberOfRoomsAvailable || "",
          `"${assignedRoomsStr}"`,
          `"${descriptionStr}"`,
          `"${amenitiesStr}"`,
          `"${bedsStr}"`,
        ].join(",");
      }),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `room-types_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast({ title: "Success", description: `Exported ${roomTypes.length} room type(s) to CSV` });
  };

  const handleImportCSV = async (file: File) => {
    setImportError(null);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split("\n").filter(line => line.trim());

        if (lines.length < 2) {
          setImportError("CSV file must contain header and at least one data row");
          return;
        }

        const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
        const nameIdx = headers.findIndex(h => h.includes("name"));
        const maxGuestsIdx = headers.findIndex(h => h.includes("max guests"));
        const roomCountIdx = headers.findIndex(h => h.includes("number of rooms"));
        const roomNumbersIdx = headers.findIndex(h => h.includes("assigned room"));
        const descriptionIdx = headers.findIndex(h => h.includes("description"));
        const amenitiesIdx = headers.findIndex(h => h.includes("amenities"));
        const bedsIdx = headers.findIndex(h => h.includes("beds"));

        if (nameIdx === -1 || maxGuestsIdx === -1) {
          setImportError("CSV must contain 'Room Type Name' and 'Max Guests' columns");
          return;
        }

        setIsLoading(true);
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          throw new Error('Not authenticated');
        }

        let importedCount = 0;
        let errorCount = 0;

        for (let i = 1; i < lines.length; i++) {
          try {
            // Parse CSV line handling quoted fields
            const fields = [];
            let current = "";
            let inQuotes = false;

            for (let j = 0; j < lines[i].length; j++) {
              const char = lines[i][j];
              if (char === '"') {
                inQuotes = !inQuotes;
              } else if (char === "," && !inQuotes) {
                fields.push(current.trim().replace(/^"|"$/g, ""));
                current = "";
              } else {
                current += char;
              }
            }
            fields.push(current.trim().replace(/^"|"$/g, ""));

            const roomTypeName = fields[nameIdx];
            const maxGuestsStr = fields[maxGuestsIdx];

            if (!roomTypeName || !maxGuestsStr) {
              errorCount++;
              continue;
            }

            const maxGuests = parseInt(maxGuestsStr);
            if (isNaN(maxGuests)) {
              errorCount++;
              continue;
            }

            // Parse amenities
            const selectedAmenities = amenitiesIdx !== -1 && fields[amenitiesIdx]
              ? fields[amenitiesIdx].split(";").map(a => {
                  const trimmed = a.trim();
                  const amenity = defaultAmenities.find(am => 
                    t(`amenities:${am.labelKey}`) === trimmed || am.id === trimmed
                  );
                  return amenity?.id;
                }).filter(Boolean) as string[]
              : [];

            // Parse beds
            const beds = bedsIdx !== -1 && fields[bedsIdx]
              ? fields[bedsIdx].split(";").map(b => {
                  const [bedLabel, count] = b.split(":").map(s => s.trim());
                  const bedType = bedTypes.find(bt => getBedTypeLabel(bt) === bedLabel);
                  return bedType ? { type: bedType as BedType, count: parseInt(count) || 1 } : null;
                }).filter(Boolean) as BedConfiguration[]
              : [];

            // Parse room numbers
            const assignedRoomNumbers = roomNumbersIdx !== -1 && fields[roomNumbersIdx]
              ? fields[roomNumbersIdx].split(";").map(r => r.trim()).filter(r => r)
              : [];

            const response = await fetch('/api/rooms/room-types/crud', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionData.session.access_token}`,
              },
              body: JSON.stringify({
                action: 'create',
                propertyId,
                name: roomTypeName,
                description: descriptionIdx !== -1 ? fields[descriptionIdx] : "",
                maxGuests,
                amenities: {
                  selectedAmenities,
                  beds,
                  numberOfRoomsAvailable: roomCountIdx !== -1 ? parseInt(fields[roomCountIdx]) || null : null,
                  assignedRoomNumbers,
                  thumbnailImageUrl: "",
                  galleryImageUrls: [],
                },
              }),
            });

            if (response.ok) {
              importedCount++;
            } else {
              errorCount++;
            }
          } catch (err) {
            console.error(`Error processing row ${i + 1}:`, err);
            errorCount++;
          }
        }

        setIsImportModalOpen(false);
        toast({
          title: "Import Complete",
          description: `Imported ${importedCount} room type(s)${errorCount > 0 ? ` (${errorCount} errors)` : ""}`,
        });
        if (importInputRef.current) {
          importInputRef.current.value = "";
        }

        // Reload room types
        const listResponse = await fetch(
          `/api/rooms/room-types/list?propertyId=${propertyId}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${sessionData.session.access_token}`,
            },
          }
        );
        if (listResponse.ok) {
          const data = await listResponse.json();
          const transformed = transformRoomTypesResponse(data.roomTypes);
          setRoomTypes(transformed);
        }
      } catch (err) {
        console.error("Import error:", err);
        setImportError("Failed to process CSV file. Please check the format and try again.");
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const handleDuplicateRoomType = async (roomType: RoomType) => {
    try {
      setIsLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('Not authenticated');
      }

      const duplicateRoomType = {
        name: `${roomType.name} (Copy)`,
        maxGuests: roomType.maxGuests,
        description: roomType.description,
        amenities: {
          selectedAmenities: [...(roomType.selectedAmenities || [])],
          beds: [...(roomType.beds || [])],
          numberOfRoomsAvailable: roomType.numberOfRoomsAvailable,
          assignedRoomNumbers: [...(roomType.assignedRoomNumbers || [])],
          thumbnailImageUrl: roomType.thumbnailImageUrl,
          galleryImageUrls: [...(roomType.galleryImageUrls || [])],
        },
      };

      const response = await fetch('/api/rooms/room-types/crud', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          action: 'create',
          propertyId,
          ...duplicateRoomType,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to duplicate room type');
      }

      const data = await response.json();

      toast({
        title: "Success",
        description: `Room type "${duplicateRoomType.name}" created successfully!`,
      });

      // Reload room types
      const listResponse = await fetch(
        `/api/rooms/room-types/list?propertyId=${propertyId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${sessionData.session.access_token}`,
          },
        }
      );
      if (listResponse.ok) {
        const listData = await listResponse.json();
        const transformed = transformRoomTypesResponse(listData.roomTypes);
        setRoomTypes(transformed);

        // Open the new room type for editing
        const newRoomType = transformed.find(rt => rt.name === duplicateRoomType.name);
        if (newRoomType) {
          handleOpenModal(newRoomType);
        }
      }
    } catch (err) {
      console.error("Error duplicating room type:", err);
      toast({
        title: "Error",
        description: "Failed to duplicate room type",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleFavorite = async (roomTypeId: string) => {
    try {
      const newFavorites = new Set(favoriteRoomTypeIds);
      if (newFavorites.has(roomTypeId)) {
        newFavorites.delete(roomTypeId);
      } else {
        newFavorites.add(roomTypeId);
      }
      setFavoriteRoomTypeIds(newFavorites);

      // Store in localStorage for persistence
      localStorage.setItem(
        `favorites_${propertyId}`,
        JSON.stringify(Array.from(newFavorites))
      );
    } catch (err) {
      console.error("Error toggling favorite:", err);
    }
  };

  // Load favorites from localStorage on mount
  useEffect(() => {
    if (propertyId) {
      const stored = localStorage.getItem(`favorites_${propertyId}`);
      if (stored) {
        setFavoriteRoomTypeIds(new Set(JSON.parse(stored)));
      }
    }
  }, [propertyId]);

  // Get bed configuration summary string
  const getBedSummary = (beds: BedConfiguration[] | undefined) => {
    if (!beds || beds.length === 0) return "No beds configured";
    return beds
      .map(b => `${getBedTypeLabel(b.type)}: ${b.count}`)
      .join(" • ");
  };

  // Format last updated date
  const formatLastUpdated = (date: any) => {
    if (!date) return "Never";
    try {
      const d = date.toDate?.() || new Date(date);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return d.toLocaleDateString();
    } catch {
      return "Unknown";
    }
  };

  // Sort room types with favorites first
  const sortedRoomTypes = sortByFavorites
    ? [...filteredRoomTypes].sort((a, b) => {
        const aIsFav = favoriteRoomTypeIds.has(a.id);
        const bIsFav = favoriteRoomTypeIds.has(b.id);
        if (aIsFav && !bIsFav) return -1;
        if (!aIsFav && bIsFav) return 1;
        return 0;
      })
    : filteredRoomTypes;

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={handleExportCSV} disabled={isLoading}>
          <DownloadIcon className="mr-2 h-4 w-4" /> {t('export_button', 'Export CSV')}
        </Button>
        <Button variant="outline" onClick={() => setIsImportModalOpen(true)} disabled={isLoading}>
          <UploadIcon className="mr-2 h-4 w-4" /> {t('import_button', 'Import CSV')}
        </Button>
        <Dialog open={isModalOpen} onOpenChange={(isOpen) => { setIsModalOpen(isOpen); if (!isOpen) resetForm(); }}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenModal()}>
              <PlusCircle className="mr-2 h-4 w-4" /> {t('add_room_type_button')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <form onSubmit={handleSaveChanges}>
              <DialogHeader className="pb-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DialogTitle>{editingRoomType ? t('edit_modal.title') : t('add_modal.title')}</DialogTitle>
                      {draftSaveTime && (
                        <span className="text-xs text-orange-600 dark:text-orange-500 font-medium">
                          ✓ Draft saved {formatDraftTime()}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      {formCompletion}% {t('form.complete', 'Complete')}
                    </span>
                  </div>
                  {getIncompleteTabsCount() > 0 && (
                    <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                      ⚠️ {getIncompleteTabsCount()} tab(s) incomplete
                    </div>
                  )}
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        formCompletion >= 100 
                          ? 'bg-green-600' 
                          : formCompletion >= 75
                          ? 'bg-blue-600'
                          : formCompletion >= 50
                          ? 'bg-yellow-600'
                          : 'bg-orange-600'
                      }`}
                      style={{ width: `${formCompletion}%` }}
                    ></div>
                  </div>
                </div>
                <DialogDescription>
                  {t('edit_modal.description')}
                </DialogDescription>
              </DialogHeader>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="details" className="relative">
                    <span>{t('tabs.details')}</span>
                    {!isTabComplete("details") && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>}
                  </TabsTrigger>
                  <TabsTrigger value="beds" className="relative">
                    <span>{t('tabs.beds')}</span>
                    {!isTabComplete("beds") && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>}
                  </TabsTrigger>
                  <TabsTrigger value="amenities" className="relative">
                    <span>{t('tabs.amenities')}</span>
                    {!isTabComplete("amenities") && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>}
                  </TabsTrigger>
                  <TabsTrigger value="gallery" className="relative">
                    <span>{t('tabs.gallery')}</span>
                    {!isTabComplete("gallery") && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>}
                  </TabsTrigger>
                </TabsList>
                <ScrollArea className="max-h-[60vh] overflow-y-auto pr-1">
                  <TabsContent value="details" className="mt-2 space-y-4 p-1">
                    {/* Template Section */}
                    {!editingRoomType && (
                      <div className="space-y-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div>
                          <Label className="text-sm font-medium">Load Template</Label>
                          <select 
                            value={selectedTemplate}
                            onChange={(e) => {
                              if (e.target.value) loadTemplate(e.target.value);
                            }}
                            className="w-full mt-1 px-3 py-2 border rounded-md text-sm bg-white dark:bg-slate-950 dark:border-slate-800"
                          >
                            <option value="">Choose a template...</option>
                            <optgroup label="Predefined">
                              <option value="standard">📋 Standard Double Room</option>
                              <option value="luxury">✨ Luxury Suite</option>
                              <option value="budget">💰 Budget Room</option>
                            </optgroup>
                            {Object.keys(customTemplates).length > 0 && (
                              <optgroup label="Custom">
                                {Object.entries(customTemplates).map(([key, template]) => (
                                  <option key={key} value={key}>
                                    ⭐ {(template as any).name}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                        </div>
                        <Button 
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={saveAsTemplate}
                          className="w-full"
                        >
                          <Plus className="mr-2 h-4 w-4" /> Save Current as Template
                        </Button>
                      </div>
                    )}

                    <div className="space-y-1">
                      <Label htmlFor="typeName">{t('form.type_name_label')} <span className="text-destructive">*</span></Label>
                      <Input 
                        id="typeName"
                        data-field="name"
                        value={name} 
                        onChange={e => { setName(e.target.value); setFormErrors({...formErrors, name: ''}) }} 
                        placeholder={t('form.type_name_placeholder')} 
                        required 
                        className={hasFieldError('name') ? 'border-destructive' : ''}
                        onBlur={() => validateForm()}
                      />
                      {hasFieldError('name') && <p className="text-xs text-destructive">{formErrors.name}</p>}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label htmlFor="maxGuests">{t('form.max_guests_label')} <span className="text-destructive">*</span></Label>
                        <Input 
                          id="maxGuests"
                          data-field="maxGuests"
                          type="number" 
                          value={maxGuests} 
                          onChange={e => { setMaxGuests(e.target.value); setFormErrors({...formErrors, maxGuests: ''}) }} 
                          placeholder={t('form.max_guests_placeholder')} 
                          required 
                          min="1"
                          className={hasFieldError('maxGuests') ? 'border-destructive' : ''}
                          onBlur={() => validateForm()}
                        />
                        {hasFieldError('maxGuests') && <p className="text-xs text-destructive">{formErrors.maxGuests}</p>}
                      </div>
                       <div className="space-y-1">
                            <Label htmlFor="numberOfRoomsAvailable">{t('form.rooms_count_label')}</Label>
                            <Input 
                              id="numberOfRoomsAvailable"
                              data-field="numberOfRoomsAvailable"
                              type="number" 
                              value={numberOfRoomsAvailable} 
                              onChange={e => { setNumberOfRoomsAvailable(e.target.value); setFormErrors({...formErrors, numberOfRoomsAvailable: ''}) }} 
                              placeholder={t('form.rooms_count_placeholder')} 
                              min="0"
                              className={hasFieldError('numberOfRoomsAvailable') ? 'border-destructive' : ''}
                            />
                            {hasFieldError('numberOfRoomsAvailable') && <p className="text-xs text-destructive">{formErrors.numberOfRoomsAvailable}</p>}
                        </div>
                    </div>
                     <div className="grid grid-cols-1">
                        <div className="space-y-1">
                            <Label htmlFor="assignedRoomNumbersInput">{t('form.room_numbers_label')}</Label>
                            <Textarea 
                                id="assignedRoomNumbersInput" 
                                value={assignedRoomNumbersInput} 
                                onChange={e => handleRoomNumbersChange(e.target.value)} 
                                placeholder="e.g., 101-110 or 101, 102, 103 or 101; 102; 103" 
                                rows={2}
                            />
                             <p className="text-xs text-muted-foreground mb-2">{t('form.room_numbers_description')}</p>
                             {parsedRoomNumbers.length > 0 && (
                               <div className="space-y-2">
                                 <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Parsed Room Numbers ({parsedRoomNumbers.length}):</p>
                                 <div className="flex flex-wrap gap-2">
                                   {parsedRoomNumbers.map(num => (
                                     <Badge key={num} variant="secondary" className="text-xs">
                                       {num}
                                     </Badge>
                                   ))}
                                 </div>
                               </div>
                             )}
                        </div>
                     </div>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <Label htmlFor="description">{t('form.description_label')}</Label>
                        <span className="text-xs text-muted-foreground">{description.length}/1000</span>
                      </div>
                      <Textarea 
                        id="description"
                        data-field="description"
                        value={description} 
                        onChange={e => { setDescription(e.target.value); setFormErrors({...formErrors, description: ''}) }} 
                        placeholder={t('form.description_placeholder')}
                        maxLength={1000}
                        className={hasFieldError('description') ? 'border-destructive' : ''}
                      />
                      {hasFieldError('description') && <p className="text-xs text-destructive">{formErrors.description}</p>}
                    </div>
                  </TabsContent>
                   <TabsContent value="beds" className="mt-2 space-y-4 p-1">
                        <div className="space-y-1 mb-3">
                            <h4 className="font-medium">{t('form.beds_title')}</h4>
                            <p className="text-xs text-muted-foreground">{t('form.beds_description')}</p>
                        </div>

                        {/* Copy from Room Type Option */}
                        {!editingRoomType && roomTypes.length > 0 && (
                          <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800 space-y-2">
                            <Label className="text-sm font-medium">Copy Beds from Existing Room Type</Label>
                            <select 
                              onChange={(e) => {
                                if (e.target.value) {
                                  const roomType = roomTypes.find(rt => rt.id === e.target.value);
                                  if (roomType && roomType.beds) {
                                    setBeds([...roomType.beds]);
                                    toast({ title: "Success", description: `Copied beds from "${roomType.name}"` });
                                  }
                                }
                              }}
                              className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-slate-950 dark:border-slate-800"
                            >
                              <option value="">Select a room type...</option>
                              {roomTypes.map(rt => (
                                <option key={rt.id} value={rt.id}>
                                  {rt.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Bed Visual Preview */}
                        <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                          <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Bed Configuration</p>
                          <p className="text-sm text-gray-800 dark:text-gray-200">{getBedVisualPreview()}</p>
                        </div>

                        {/* Capacity Calculator */}
                        <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                          <p className="text-xs font-medium text-green-800 dark:text-green-300 mb-2">Capacity Info</p>
                          <div className="space-y-2">
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              <span className="font-semibold">Total Bed Capacity:</span> {calculateBedCapacity()} guests
                            </p>
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              <span className="font-semibold">Max Guests Set:</span> {maxGuests || '—'} guests
                            </p>
                            {maxGuests && calculateBedCapacity() < parseInt(maxGuests) && (
                              <p className="text-xs text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900 p-2 rounded">
                                ⚠️ Warning: Bed capacity ({calculateBedCapacity()}) is less than max guests ({maxGuests})
                              </p>
                            )}
                            {maxGuests && calculateBedCapacity() > parseInt(maxGuests) && (
                              <p className="text-xs text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900 p-2 rounded">
                                ℹ️ Note: Bed capacity ({calculateBedCapacity()}) exceeds max guests ({maxGuests})
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Bed Configuration Controls */}
                        <div className="space-y-3 mt-4">
                            <h5 className="font-medium text-sm">Configure Beds</h5>
                            {bedTypes.map(type => {
                                const currentBed = beds.find(b => b.type === type);
                                const count = currentBed?.count || 0;
                                return (
                                    <div key={type} className="flex items-center justify-between">
                                        <Label className="capitalize">{getBedTypeLabel(type)}</Label>
                                        <div className="flex items-center gap-2">
                                            <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => handleBedCountChange(type, -1)} disabled={count === 0}>
                                                <Minus className="h-4 w-4"/>
                                            </Button>
                                            <span className="font-bold text-center w-8">{count}</span>
                                            <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => handleBedCountChange(type, 1)}>
                                                <Plus className="h-4 w-4"/>
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                   </TabsContent>
                  <TabsContent value="amenities" className="mt-2 p-1">
                    <div className="space-y-4">
                      {/* Quick Select Presets */}
                      <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800 space-y-2">
                        <p className="text-xs font-medium text-blue-800 dark:text-blue-300">Quick Select Presets</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {Object.entries(amenityPresets).map(([key, preset]) => (
                            <Button
                              key={key}
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => applyAmenityPreset(key as keyof typeof amenityPresets)}
                              className="text-xs h-8"
                              title={preset.description}
                            >
                              {preset.label}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {/* Search Box */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <Label className="text-sm font-medium">Search & Filter</Label>
                          <span className="text-xs text-muted-foreground">Selected: {selectedAmenities.length}/{defaultAmenities.length}</span>
                        </div>
                        <Input 
                          placeholder="Search amenities..." 
                          value={amenitySearchTerm}
                          onChange={(e) => setAmenitySearchTerm(e.target.value.toLowerCase())}
                          className="text-sm"
                        />
                      </div>

                      {/* Amenities by Category */}
                      {amenityCategories.map(category => {
                        const amenitiesInCategory = defaultAmenities
                          .filter(a => a.category === category.key)
                          .filter(a => {
                            if (!amenitySearchTerm) return true;
                            const amenityLabel = t(`amenities:${a.labelKey}`).toLowerCase();
                            return amenityLabel.includes(amenitySearchTerm);
                          });
                        if (amenitiesInCategory.length === 0) return null;

                        const allInCategorySelected = amenitiesInCategory.every(a => selectedAmenities.includes(a.id));
                        const someInCategorySelected = amenitiesInCategory.some(a => selectedAmenities.includes(a.id));

                        return (
                          <div key={category.key} className="border rounded-lg p-3">
                            <div className="flex items-center justify-between mb-3">
                              <h5 className="font-semibold text-sm capitalize">{t(`amenities:categories.${category.labelKey}`)}</h5>
                              <div className="flex gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => selectAllAmenitiesInCategory(category.key)}
                                  className="h-7 px-2 text-xs"
                                  disabled={allInCategorySelected}
                                >
                                  All
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deselectAllAmenitiesInCategory(category.key)}
                                  className="h-7 px-2 text-xs"
                                  disabled={!someInCategorySelected}
                                >
                                  None
                                </Button>
                              </div>
                            </div>
                             <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
                                {amenitiesInCategory.map((amenity) => (
                                  <div key={amenity.id} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`amenity-${amenity.id}`}
                                      checked={selectedAmenities.includes(amenity.id)}
                                      onCheckedChange={() => handleAmenityChange(amenity.id)}
                                    />
                                    <Label htmlFor={`amenity-${amenity.id}`} className="font-normal text-sm cursor-pointer flex items-center gap-2">
                                       {amenity.icon && React.createElement(Icons[amenity.icon], { className: "h-4 w-4 text-muted-foreground"})}
                                       {t(`amenities:${amenity.labelKey}`)}
                                    </Label>
                                  </div>
                                ))}
                              </div>
                          </div>
                        )
                      })}
                    </div>
                  </TabsContent>
                  <TabsContent value="gallery" className="mt-2 space-y-4 p-1">
                     <div className="space-y-2">
                        <Label>{t('form.thumbnail_label')}</Label>
                        <div 
                          className={`mt-1 flex justify-center items-center p-4 border-2 border-dashed rounded-md cursor-pointer hover:border-primary aspect-video transition-colors ${draggedThumbnailOverGallery ? 'border-primary bg-primary/5' : ''}`}
                          onClick={() => thumbInputRef.current?.click()} 
                          onDragOver={(e) => { 
                            e.preventDefault(); 
                            e.currentTarget.classList.add('border-primary', 'bg-primary/5');
                            const data = e.dataTransfer.types.includes('text/plain');
                            if (data) setDraggedThumbnailOverGallery(true);
                          }} 
                          onDragLeave={(e) => { 
                            e.currentTarget.classList.remove('border-primary', 'bg-primary/5');
                            setDraggedThumbnailOverGallery(false);
                          }} 
                          onDrop={(e) => { 
                            e.preventDefault(); 
                            e.currentTarget.classList.remove('border-primary', 'bg-primary/5');
                            setDraggedThumbnailOverGallery(false);
                            
                            // Handle dragged gallery image
                            const galleryIndex = e.dataTransfer.getData('text/plain');
                            if (galleryIndex && dragSource === 'gallery') {
                              moveGalleryImageToThumbnail(parseInt(galleryIndex));
                            } else if (e.dataTransfer.files?.[0]) {
                              // Handle file drop
                              const file = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('image/'));
                              if (file) {
                                setThumbnailFile(file);
                                setThumbnailPreview(URL.createObjectURL(file));
                              }
                            }
                          }}
                        >
                           <div className="space-y-1 text-center w-full h-full relative">
                              {thumbnailPreview ? (
                                <div className="relative group w-full h-full cursor-grab active:cursor-grabbing" 
                                  draggable
                                  onDragStart={(e) => {
                                    e.dataTransfer?.setData('text/plain', 'thumbnail');
                                    setDragSource('thumbnail');
                                  }}
                                  onDragEnd={() => setDragSource(null)}
                                >
                                  <Image src={thumbnailPreview} alt="Thumbnail preview" fill style={{ objectFit: "cover" }} className="rounded-md"/>
                                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all rounded-md flex items-center justify-center">
                                    <span className="text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">📤 Drag to gallery</span>
                                  </div>
                                  <Button variant="destructive" size="icon" className="absolute -top-3 -right-3 h-7 w-7 opacity-0 group-hover:opacity-100 z-10" onClick={removeThumbnail}> <X className="h-4 w-4"/> </Button>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center justify-center h-full">
                                  <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground" />
                                  <p className="text-sm text-muted-foreground">{t('form.thumbnail_upload')}</p>
                                  <p className="text-xs text-muted-foreground mt-2">or drag and drop</p>
                                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">or drag an image from gallery below</p>
                                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">📦 Image will be optimized for web</p>
                                </div>
                              )}
                           </div>
                           <Input ref={thumbInputRef} type="file" className="sr-only" onChange={handleThumbnailChange} accept="image/*" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <Label>{t('form.gallery_label')}</Label>
                          {galleryPreviews.length > 0 && (
                            <Button variant="destructive" size="sm" onClick={removeAllGalleryImages}>
                              <Trash2 className="mr-2 h-4 w-4" /> Remove All
                            </Button>
                          )}
                        </div>

                        {uploadProgress > 0 && uploadProgress < 100 && (
                          <div className="space-y-2">
                            <div className="flex justify-between items-center text-xs">
                              <span>Uploading...</span>
                              <span>{uploadProgress}%</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${uploadProgress}%` }}
                              ></div>
                            </div>
                          </div>
                        )}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {getDisplayGallery().map((preview, displayIndex) => {
                              // Find the actual index in the original array
                              const actualIndex = dragFromIndex !== null && dragToIndex !== null && dragFromIndex !== dragToIndex 
                                ? dragFromIndex < dragToIndex && displayIndex >= dragFromIndex && displayIndex < dragToIndex
                                  ? displayIndex + 1
                                  : dragFromIndex > dragToIndex && displayIndex > dragToIndex && displayIndex <= dragFromIndex
                                  ? displayIndex - 1
                                  : dragFromIndex === displayIndex
                                  ? dragToIndex
                                  : displayIndex
                                : displayIndex;
                              
                              return (
                                <div 
                                  key={displayIndex} 
                                  className={`relative group aspect-square cursor-move transition-all ${dragFromIndex === actualIndex ? 'opacity-60 scale-95' : 'opacity-100'}`}
                                  draggable
                                  onDragStart={(e) => {
                                    e.dataTransfer?.setData('text/plain', actualIndex.toString());
                                    setDragFromIndex(actualIndex);
                                    setDragSource('gallery');
                                  }}
                                  onDragEnd={() => {
                                    setDragFromIndex(null);
                                    setDragToIndex(null);
                                    setDragSource(null);
                                  }}
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    setDragToIndex(actualIndex);
                                  }}
                                  onDragLeave={() => {
                                    // Don't reset on drag leave - only reset on drag end
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    const data = e.dataTransfer?.getData('text/plain');
                                    if (data === 'thumbnail') {
                                      // Drag from thumbnail to gallery
                                      moveThumbnailToGallery();
                                    } else {
                                      // Reorder within gallery - use dragFromIndex and dragToIndex
                                      if (dragFromIndex !== null && dragToIndex !== null && dragFromIndex !== dragToIndex) {
                                        reorderGalleryImages(dragFromIndex, dragToIndex);
                                      }
                                    }
                                    setDragFromIndex(null);
                                    setDragToIndex(null);
                                  }}
                                >
                                    <Image src={preview} alt={`Gallery image ${displayIndex + 1}`} fill style={{ objectFit: "cover" }} className="rounded-md"/>
                                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all rounded-md flex items-center justify-center">
                                      <span className="text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">🔄 Reorder or 📤 to thumbnail</span>
                                    </div>
                                    <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 z-10" onClick={(e) => removeGalleryImage(e, actualIndex, preview)}> <X className="h-4 w-4"/> </Button>
                                </div>
                              );
                            })}
                            <div 
                              className="flex justify-center items-center border-2 border-dashed rounded-md cursor-pointer hover:border-primary aspect-square transition-colors" 
                              onClick={() => galleryInputRef.current?.click()}
                              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-primary'); }}
                              onDragLeave={(e) => e.currentTarget.classList.remove('border-primary')}
                              onDrop={(e) => {
                                e.preventDefault();
                                e.currentTarget.classList.remove('border-primary');
                                
                                const data = e.dataTransfer?.getData('text/plain');
                                if (data === 'thumbnail') {
                                  // Moving thumbnail to gallery
                                  moveThumbnailToGallery();
                                } else if (e.dataTransfer.files) {
                                  // File drop
                                  handleGalleryDrop(e);
                                }
                              }}
                            >
                                <div className="text-center">
                                    <UploadCloud className="mx-auto h-8 w-8 text-muted-foreground" />
                                    <p className="text-xs text-muted-foreground mt-1">{t('form.gallery_upload')}</p>
                                    <p className="text-xs text-muted-foreground mt-1">or drag photos</p>
                                </div>
                                <Input ref={galleryInputRef} type="file" multiple className="sr-only" onChange={handleGalleryChange} accept="image/*" />
                            </div>
                        </div>

                        {galleryPreviews.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            💡 Tip: Drag and drop images to reorder. {galleryPreviews.length} image(s) will be optimized for web.
                          </p>
                        )}
                    </div>
                  </TabsContent>
                </ScrollArea>
              </Tabs>
              <DialogFooter className="sm:justify-start mt-6 pt-4 border-t">
                <DialogClose asChild>
                  <Button type="button" variant="secondary">{t('buttons.close')}</Button>
                </DialogClose>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
                  {t('buttons.save')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && (
        <div className="flex justify-center items-center h-64"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>
      )}

      {!isLoading && roomTypes.length > 0 && (
        <>
          {/* Search and Filter Bar */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center gap-2 p-4 border rounded-lg bg-card">
              <Input 
                placeholder="Search room types by name..."
                className="w-full sm:flex-1"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Button
                variant={sortByFavorites ? "default" : "outline"}
                size="sm"
                onClick={() => setSortByFavorites(!sortByFavorites)}
                className="w-full sm:w-auto"
                title="Sort by favorites"
              >
                <Icons.Star className={`mr-2 h-4 w-4 ${sortByFavorites ? 'fill-current' : ''}`} />
                Favorites
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="w-full sm:w-auto"
              >
                <Settings2 className="mr-2 h-4 w-4" />
                Filters {(filterAmenities.length + filterBeds.length + (minCapacity ? 1 : 0) + (maxCapacity ? 1 : 0)) > 0 && `(${filterAmenities.length + filterBeds.length + (minCapacity ? 1 : 0) + (maxCapacity ? 1 : 0)})`}
                <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </div>

            {/* Filters Panel */}
            {showFilters && (
              <Card className="p-4">
                <div className="space-y-4">
                  {/* Capacity Range Filter */}
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Capacity Range</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="minCapacity" className="text-xs">Min Guests</Label>
                        <Input
                          id="minCapacity"
                          type="number"
                          placeholder="Min"
                          value={minCapacity}
                          onChange={(e) => setMinCapacity(e.target.value)}
                          min="1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="maxCapacity" className="text-xs">Max Guests</Label>
                        <Input
                          id="maxCapacity"
                          type="number"
                          placeholder="Max"
                          value={maxCapacity}
                          onChange={(e) => setMaxCapacity(e.target.value)}
                          min="1"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Bed Configuration Filter */}
                  {bedTypes.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm mb-2">Bed Configuration</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {bedTypes.map(bedType => (
                          <div key={bedType} className="flex items-center space-x-2">
                            <Checkbox
                              id={`bed-filter-${bedType}`}
                              checked={filterBeds.includes(bedType)}
                              onCheckedChange={() => handleBedFilterChange(bedType)}
                            />
                            <Label htmlFor={`bed-filter-${bedType}`} className="text-sm font-normal cursor-pointer">
                              {getBedTypeLabel(bedType)}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Amenities Filter */}
                  {defaultAmenities.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm mb-2">Amenities</h4>
                      <ScrollArea className="h-48 border rounded-md p-3">
                        <div className="grid grid-cols-2 gap-2">
                          {defaultAmenities.map(amenity => (
                            <div key={amenity.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`amenity-filter-${amenity.id}`}
                                checked={filterAmenities.includes(amenity.id)}
                                onCheckedChange={() => handleAmenityFilterChange(amenity.id)}
                              />
                              <Label htmlFor={`amenity-filter-${amenity.id}`} className="text-xs font-normal cursor-pointer">
                                {t(`amenities:${amenity.labelKey}`)}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  {/* Reset Filters Button */}
                  {(searchTerm || filterAmenities.length > 0 || filterBeds.length > 0 || minCapacity || maxCapacity) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resetFilters}
                      className="w-full"
                    >
                      Reset Filters
                    </Button>
                  )}
                </div>
              </Card>
            )}
          </div>

          {/* Results Count */}
          {filteredRoomTypes.length !== roomTypes.length && (
            <p className="text-sm text-muted-foreground">
              Showing {filteredRoomTypes.length} of {roomTypes.length} room types
            </p>
          )}

          {/* Bulk Actions Toolbar */}
          {selectedRoomTypeIds.size > 0 && (
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-primary/10 border border-primary/20 rounded-lg">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedRoomTypeIds.size === filteredRoomTypes.length}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all"
                />
                <span className="text-sm font-medium">
                  {selectedRoomTypeIds.size} of {filteredRoomTypes.length} selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsBulkAmenitiesModalOpen(true)}
                  disabled={isLoading}
                >
                  Edit Amenities
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsBulkBedsModalOpen(true)}
                  disabled={isLoading}
                >
                  Edit Beds
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleBulkDelete}
                  disabled={isLoading}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedRoomTypeIds(new Set())}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Room Types Grid */}
          {sortedRoomTypes.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {sortedRoomTypes.map((type) => {
            const amenitiesToShow = (type.selectedAmenities || [])
                .map(id => defaultAmenities.find(a => a.id === id))
                .filter(Boolean) as Amenity[];
            const isSelected = selectedRoomTypeIds.has(type.id);
            const isFavorite = favoriteRoomTypeIds.has(type.id);
            return (
                <Card key={type.id} className={`overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-300 w-full flex flex-row relative ${isSelected ? 'ring-2 ring-primary' : ''}`}>
                    <div className="absolute top-2 left-2 z-10">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleSelectRoomType(type.id)}
                        aria-label={`Select ${type.name}`}
                      />
                    </div>
                    <div className="absolute top-2 right-12 z-10">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleToggleFavorite(type.id)}
                        title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                      >
                        <Icons.Star className={`h-4 w-4 ${isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                      </Button>
                    </div>
                    <div className="relative flex-shrink-0 w-48 md:w-64 aspect-[4/3] bg-muted flex items-center justify-center">
                        <Image 
                            src={type.thumbnailImageUrl || `https://placehold.co/400x300.png`} 
                            alt={type.name} 
                            fill 
                            style={{ objectFit: "cover" }}
                            data-ai-hint="hotel room"
                        />
                    </div>
                    
                    <div className="p-4 sm:p-6 flex flex-col flex-grow relative">
                        <div className="flex justify-between items-start">
                            <div>
                                {type.numberOfRoomsAvailable !== null && typeof type.numberOfRoomsAvailable !== 'undefined' && type.numberOfRoomsAvailable > 0 && type.numberOfRoomsAvailable <= 5 && (
                                    <Badge variant="default" className="mb-2 bg-primary text-primary-foreground text-xs">
                                        {t('card.rooms_available_badge', { count: type.numberOfRoomsAvailable })}
                                    </Badge>
                                )}
                                <CardTitle className="text-2xl font-bold font-headline">{type.name}</CardTitle>
                            </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleViewDetails(type)}><Icons.Eye className="mr-2 h-4 w-4" /> {t('card.view_details')}</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleOpenModal(type)}><Icons.Edit className="mr-2 h-4 w-4" /> {t('card.edit')}</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleDuplicateRoomType(type)}><Icons.Copy className="mr-2 h-4 w-4" /> Duplicate</DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteRoomType(type.id)}><Trash2 className="mr-2 h-4 w-4" /> {t('card.delete')}</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 my-2 text-muted-foreground text-sm">
                            <TooltipProvider>
                                {amenitiesToShow.slice(0, 5).map(amenity => {
                                    const IconComponent = Icons[amenity.icon as keyof typeof Icons] || Icons.HelpCircle;
                                    return (
                                        <Tooltip key={amenity.id}>
                                            <TooltipTrigger asChild>
                                                <button type="button" aria-label={t(`amenities:${amenity.labelKey}`)}><IconComponent className="h-5 w-5" /></button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>{t(`amenities:${amenity.labelKey}`)}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    );
                                })}
                            </TooltipProvider>
                            {amenitiesToShow.length > 5 && (
                                <span className="text-xs">+ {amenitiesToShow.length - 5} more</span>
                            )}
                        </div>

                        {/* Bed Configuration Summary */}
                        <div className="bg-gray-50 dark:bg-gray-900 rounded px-3 py-2 mb-3">
                          <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Bed Configuration</p>
                          <p className="text-sm text-gray-700 dark:text-gray-200">{getBedSummary(type.beds)}</p>
                        </div>

                        {/* Last Updated & Capacity */}
                        <div className="flex justify-between items-center text-xs text-muted-foreground mt-2 pt-2 border-t">
                          <div>
                            <span>Max Guests: <span className="font-semibold">{type.maxGuests}</span></span>
                          </div>
                          <div>
                            <span>Updated: {formatLastUpdated(type.updatedAt || type.createdAt)}</span>
                          </div>
                        </div>

                        <div className="flex-grow" />

                    </div>
                </Card>
            )
        })}
        </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground py-8">
                  No room types match your filters. Try adjusting your search criteria.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
      
      {viewingRoomType && (
        <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh]">
            <DialogTitle className="sr-only">{viewingRoomType?.name}</DialogTitle>
            <ScrollArea className="max-h-[85vh] overflow-y-auto">
              <div className="space-y-0">
                {/* Hero Section with Thumbnail */}
                <div className="relative bg-gradient-to-br from-primary to-primary dark:from-primary dark:to-primary rounded-t-lg overflow-hidden">
                  <div className="absolute inset-0 opacity-20">
                    <div className="absolute inset-0 bg-pattern" style={{backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 50%)'}}></div>
                  </div>
                  
                  <div className="relative grid grid-cols-1 md:grid-cols-3 gap-6 p-8">
                    {/* Thumbnail Image */}
                    <div className="md:col-span-1 flex justify-center items-center">
                      {viewingRoomType.thumbnailImageUrl ? (
                        <div className="relative w-full aspect-square rounded-lg overflow-hidden shadow-2xl border-4 border-white/30 backdrop-blur-sm">
                          <Image 
                            src={viewingRoomType.thumbnailImageUrl} 
                            alt={viewingRoomType.name}
                            fill
                            style={{ objectFit: "cover" }}
                            className="hover:scale-110 transition-transform duration-300"
                          />
                        </div>
                      ) : (
                        <div className="w-full aspect-square rounded-lg bg-white/20 backdrop-blur-sm border-2 border-white/40 flex items-center justify-center">
                          <UploadCloud className="h-16 w-16 text-white/50" />
                        </div>
                      )}
                    </div>

                    {/* Basic Info */}
                    <div className="md:col-span-2 flex flex-col justify-center space-y-4">
                      <div>
                        <h2 className="text-4xl font-bold text-white mb-2">{viewingRoomType.name}</h2>
                        <div className="flex flex-wrap gap-2">
                          <Badge className="bg-white/30 text-white border-white/50 backdrop-blur-sm">
                            👥 {viewingRoomType.maxGuests} {viewingRoomType.maxGuests === 1 ? 'Guest' : 'Guests'}
                          </Badge>
                          <Badge className="bg-white/30 text-white border-white/50 backdrop-blur-sm">
                            🛏️ {viewingRoomType.beds?.length || 0} Bed Type(s)
                          </Badge>
                          <Badge className="bg-white/30 text-white border-white/50 backdrop-blur-sm">
                            🎁 {viewingRoomType.selectedAmenities?.length || 0} Amenities
                          </Badge>
                        </div>
                      </div>
                      
                      {viewingRoomType.numberOfRoomsAvailable && (
                        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 border border-white/30">
                          <p className="text-white/80 text-sm font-medium">Rooms Available</p>
                          <p className="text-white text-2xl font-bold">{viewingRoomType.numberOfRoomsAvailable}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Content Sections */}
                <div className="p-8 space-y-6">
                  {/* Description Section */}
                  {viewingRoomType.description && (
                    <section className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1 w-8 bg-primary rounded-full"></div>
                        <h3 className="text-xl font-bold text-foreground">{t('view_modal.description_label')}</h3>
                      </div>
                      <div className="bg-gradient-to-r from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/15 rounded-lg p-4 border border-primary/30 dark:border-primary/30">
                        <p className="text-foreground whitespace-pre-wrap leading-relaxed">{viewingRoomType.description}</p>
                      </div>
                    </section>
                  )}

                  {/* Room Numbers Section */}
                  {viewingRoomType.assignedRoomNumbers && viewingRoomType.assignedRoomNumbers.length > 0 && (
                    <section className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1 w-8 bg-primary rounded-full"></div>
                        <h3 className="text-xl font-bold text-foreground">{t('view_modal.room_numbers_label')}</h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {viewingRoomType.assignedRoomNumbers.map(roomNum => (
                          <Badge 
                            key={roomNum}
                            className="bg-primary text-white border-0 px-4 py-2 text-base font-semibold"
                          >
                            🏠 {roomNum}
                          </Badge>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Beds Configuration Section */}
                  {viewingRoomType.beds && viewingRoomType.beds.length > 0 && (
                    <section className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1 w-8 bg-primary rounded-full"></div>
                        <h3 className="text-xl font-bold text-foreground">{t('view_modal.beds_section_title')}</h3>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {viewingRoomType.beds.map(bed => (
                          <div 
                            key={bed.type}
                            className="bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/15 rounded-lg p-4 border border-primary/30 dark:border-primary/30 hover:shadow-lg transition-shadow"
                          >
                            <p className="text-primary dark:text-primary font-semibold text-sm mb-1">
                              {getBedTypeLabel(bed.type)}
                            </p>
                            <p className="text-3xl font-bold text-primary dark:text-primary">
                              {bed.count} <span className="text-lg">bed{bed.count !== 1 ? 's' : ''}</span>
                            </p>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Amenities Section */}
                  {viewingRoomType.selectedAmenities && viewingRoomType.selectedAmenities.length > 0 && (
                    <section className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1 w-8 bg-gradient-to-r from-primary to-primary-600 rounded-full"></div>
                        <h3 className="text-xl font-bold text-foreground">{t('view_modal.amenities_section_title')}</h3>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {defaultAmenities
                          .filter(a => viewingRoomType.selectedAmenities?.includes(a.id))
                          .map(amenity => (
                            <div 
                              key={amenity.id}
                              className="bg-primary rounded-lg p-3 border border-primary-200 dark:border-primary-800/50 hover:shadow-md transition-shadow flex flex-col items-center text-center"
                            >
                              {Icons[amenity.icon as keyof typeof Icons] && (
                                <div className="mb-2 text-white dark:text-white">
                                  {React.createElement(Icons[amenity.icon as keyof typeof Icons], { 
                                    className: "h-6 w-6" 
                                  })}
                                </div>
                              )}
                              <span className="text-xs font-semibold text-white">{t(`amenities:${amenity.labelKey}`)}</span>
                            </div>
                          ))}
                      </div>
                    </section>
                  )}

                  {/* Gallery Preview Section */}
                  {viewingRoomType.galleryImageUrls && viewingRoomType.galleryImageUrls.length > 0 && (
                    <section className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1 w-8 bg-orange-600 rounded-full"></div>
                        <h3 className="text-xl font-bold text-foreground">Gallery ({viewingRoomType.galleryImageUrls.length})</h3>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {viewingRoomType.galleryImageUrls.map((imageUrl, idx) => (
                          <div 
                            key={idx}
                            className="relative aspect-square rounded-lg overflow-hidden border-2 border-cyan-200 dark:border-cyan-800/50 hover:shadow-lg transition-all hover:scale-105"
                          >
                            <Image 
                              src={imageUrl}
                              alt={`Gallery ${idx + 1}`}
                              fill
                              style={{ objectFit: "cover" }}
                            />
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>

                {/* Footer */}
                <div className="flex flex-col sm:flex-row gap-3 p-8 border-t bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900/50 dark:to-slate-800/50 rounded-b-lg">
                  <div className="flex-1 space-y-1">
                    <p className="text-xs text-muted-foreground">Last Updated</p>
                    <p className="text-sm font-medium">
                      {viewingRoomType.updatedAt 
                        ? new Date(viewingRoomType.updatedAt.toMillis?.() || viewingRoomType.updatedAt).toLocaleDateString()
                        : 'N/A'
                      }
                    </p>
                  </div>
                  <Button 
                    onClick={() => {
                      setIsViewModalOpen(false);
                      setEditingRoomType(viewingRoomType);
                      setIsModalOpen(true);
                    }}
                    className="bg-gradient-to-r from-primary to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-semibold"
                  >
                    ✏️ Edit
                  </Button>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">{t('buttons.close')}</Button>
                  </DialogClose>
                </div>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}

      {!isLoading && roomTypes.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground py-8">
              {t('no_room_types')}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Bulk Edit Amenities Modal */}
      <Dialog open={isBulkAmenitiesModalOpen} onOpenChange={setIsBulkAmenitiesModalOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Amenities for {selectedRoomTypeIds.size} Room Type(s)</DialogTitle>
            <DialogDescription>
              Add or remove amenities from selected room types
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] overflow-y-auto pr-4">
            <div className="space-y-6 py-4">
              <div>
                <h4 className="font-semibold text-sm mb-3">Add Amenities</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {defaultAmenities.map(amenity => (
                    <div key={amenity.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`add-amenity-${amenity.id}`}
                        checked={bulkAmenititesToAdd.includes(amenity.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setBulkAmenititesToAdd(prev => [...prev, amenity.id]);
                            setBulkAmenititesToRemove(prev => prev.filter(id => id !== amenity.id));
                          } else {
                            setBulkAmenititesToAdd(prev => prev.filter(id => id !== amenity.id));
                          }
                        }}
                      />
                      <Label htmlFor={`add-amenity-${amenity.id}`} className="text-sm font-normal cursor-pointer">
                        {t(`amenities:${amenity.labelKey}`)}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold text-sm mb-3">Remove Amenities</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {defaultAmenities.map(amenity => (
                    <div key={amenity.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`remove-amenity-${amenity.id}`}
                        checked={bulkAmenititesToRemove.includes(amenity.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setBulkAmenititesToRemove(prev => [...prev, amenity.id]);
                            setBulkAmenititesToAdd(prev => prev.filter(id => id !== amenity.id));
                          } else {
                            setBulkAmenititesToRemove(prev => prev.filter(id => id !== amenity.id));
                          }
                        }}
                      />
                      <Label htmlFor={`remove-amenity-${amenity.id}`} className="text-sm font-normal cursor-pointer text-destructive">
                        {t(`amenities:${amenity.labelKey}`)}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkAmenitiesModalOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={handleBulkAmenitiesApply} disabled={isLoading || (bulkAmenititesToAdd.length === 0 && bulkAmenititesToRemove.length === 0)}>
              {isLoading && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
              Apply Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Edit Beds Modal */}
      <Dialog open={isBulkBedsModalOpen} onOpenChange={setIsBulkBedsModalOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Beds for {selectedRoomTypeIds.size} Room Type(s)</DialogTitle>
            <DialogDescription>
              Add or remove bed configurations from selected room types
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] overflow-y-auto pr-4">
            <div className="space-y-6 py-4">
              <div>
                <h4 className="font-semibold text-sm mb-3">Add Beds</h4>
                <div className="space-y-3">
                  {bedTypes.map(bedType => {
                    const bulkBed = bulkBedsToAdd.find(b => b.type === bedType);
                    const count = bulkBed?.count || 0;
                    return (
                      <div key={bedType} className="flex items-center justify-between">
                        <Label className="capitalize">{getBedTypeLabel(bedType)}</Label>
                        <div className="flex items-center gap-2">
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="icon" 
                            className="h-7 w-7"
                            onClick={() => {
                              if (count > 0) {
                                setBulkBedsToAdd(prev => 
                                  prev.map(b => b.type === bedType ? { ...b, count: (b.count || 0) - 1 } : b).filter(b => (b.count || 0) > 0)
                                );
                              }
                            }}
                            disabled={count === 0}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="font-bold text-center w-8">{count}</span>
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="icon" 
                            className="h-7 w-7"
                            onClick={() => {
                              setBulkBedsToAdd(prev => {
                                const existing = prev.find(b => b.type === bedType);
                                if (existing) {
                                  return prev.map(b => b.type === bedType ? { ...b, count: (b.count || 0) + 1 } : b);
                                } else {
                                  return [...prev, { type: bedType as BedType, count: 1 }];
                                }
                              });
                            }}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold text-sm mb-3">Remove Bed Types</h4>
                <div className="grid grid-cols-2 gap-2">
                  {bedTypes.map(bedType => (
                    <div key={bedType} className="flex items-center space-x-2">
                      <Checkbox
                        id={`remove-bed-${bedType}`}
                        checked={bulkBedsToRemove.includes(bedType)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setBulkBedsToRemove(prev => [...prev, bedType]);
                          } else {
                            setBulkBedsToRemove(prev => prev.filter(b => b !== bedType));
                          }
                        }}
                      />
                      <Label htmlFor={`remove-bed-${bedType}`} className="text-sm font-normal cursor-pointer capitalize text-destructive">
                        {getBedTypeLabel(bedType)}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkBedsModalOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={handleBulkBedsApply} disabled={isLoading || (bulkBedsToAdd.length === 0 && bulkBedsToRemove.length === 0)}>
              {isLoading && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
              Apply Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('import_room_types', 'Import Room Types')}</DialogTitle>
            <DialogDescription>
              {t('import_room_types_desc', 'Upload a CSV file to import room type configurations')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition cursor-pointer"
              onClick={() => importInputRef.current?.click()}
            >
              <UploadIcon className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm font-medium">{t('import_select_file', 'Click to select CSV file')}</p>
              <p className="text-xs text-gray-500 mt-1">{t('import_file_format', 'Expected format: Room Type Name, Max Guests, etc.')}</p>
              <input
                ref={importInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleImportCSV(file);
                  }
                }}
                disabled={isLoading}
              />
            </div>

            {importError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">{importError}</p>
              </div>
            )}

            {isLoading && (
              <div className="flex items-center justify-center py-4">
                <Icons.Spinner className="h-5 w-5 animate-spin text-gray-600 mr-2" />
                <span className="text-sm text-gray-600">{t('importing', 'Importing...')}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportModalOpen(false)} disabled={isLoading}>
              {t('cancel', 'Cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

