"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import ReservationStatusBadge from "./reservation-status-badge";
import type { Reservation, SelectedExtra, ReservationRoom } from '@/types/reservation';
import type { Promotion } from '@/types/promotion';
import type { LedgerEntry } from '@/types/folio';
import { format, parseISO, differenceInDays, isToday, startOfDay } from 'date-fns';
import { toDate } from '@/lib/dateUtils';
import { enUS, fr } from 'date-fns/locale';
import { Icons } from '@/components/icons';
import type { Property } from '@/types/property';
import { generateInvoicePdf } from '@/lib/pdfGenerator';
import { toast } from '@/hooks/use-toast';
import { db, app } from '@/lib/firebase';
import { doc, getDoc, type Timestamp, query, collection, where, limit, getDocs, onSnapshot, writeBatch, serverTimestamp, updateDoc, orderBy, addDoc, setDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import type { Invoice, Payment } from '@/app/(app)/payments/page';
import { cn, cleanFirestoreData } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '../ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import SendEmailDialog from './send-email-dialog';
import { PhoneInput } from '@/components/ui/phone-input';
import { getFunctions, httpsCallable } from 'firebase/functions';
import PaymentForm from '@/components/payments/payment-form';
import { ledgerService } from '@/lib/ledgerService';
import { SplitTransactionModal } from './split-transaction-modal';
import { VoidTransactionModal } from './void-transaction-modal';
import { MoveTransactionModal } from './move-transaction-modal';
import type { Service } from '@/types/service';
import type { MealPlan } from '@/types/mealPlan';
import { countries } from '@/lib/countries';
import { useTranslation } from 'react-i18next';
import { 
  Mail, 
  Phone, 
  BedDouble, 
  Calendar as CalendarIcon, 
  User, 
  ChevronDown, 
  ChevronUp, 
  ChevronRight,
  Tag,
  Globe,
  Users,
  MessageSquare,
  ClipboardList,
  CreditCard,
  Zap,
  FileText,
  Clock,
  Baby,
  X,
  HelpCircle
} from 'lucide-react';
import PaymentStatusBadge from '../payments/payment-status-badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { useSidebar } from '../ui/sidebar';

interface ReservationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: Reservation | null;
  propertySettings: Property | null;
  onEdit?: (reservation: Reservation) => void;
  onCheckIn?: (reservationId: string) => void;
  onCheckOut?: (reservation: Reservation) => void;
  canManage?: boolean;
}

const DetailSection = ({ icon: Icon, title, children }: { icon: React.ElementType, title: string, children: React.ReactNode }) => (
    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Icon size={14} />
            {title}
        </div>
        <div className="space-y-2">
            {children}
        </div>
    </div>
);

const InfoRow = ({ label, children }: { label: string, children: React.ReactNode }) => (
    <div className="flex justify-between items-center text-sm">
        <span className="font-medium text-slate-500">{label}:</span>
        <span className="text-slate-800 font-medium text-right truncate">{children}</span>
    </div>
);

const RoomCard = ({ 
  room, 
  index, 
  currencySymbol, 
  nights, 
  t,
  calculateExtraItemTotal
}: { 
  room: ReservationRoom, 
  index: number, 
  currencySymbol: string, 
  nights: number, 
  t: any,
  calculateExtraItemTotal: (extra: SelectedExtra) => { total: number, breakdown: string }
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const roomRate = room.roomRate || 0;
  const extrasTotal = Array.isArray(room.selectedExtras) ? room.selectedExtras.reduce((sum: number, extra: SelectedExtra) => sum + calculateExtraItemTotal(extra).total, 0) : 0;
  const roomTotal = (roomRate * nights) + extrasTotal;

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="text-left flex-1">
          <div className="font-semibold text-slate-800">{room.roomName || 'Room'}</div>
          <div className="text-sm text-slate-600">{room.adults || 0} Adults • {room.children || 0} Children</div>
        </div>
        <div className="text-right mr-4">
          <div className="font-bold text-slate-800">{currencySymbol}{roomTotal.toFixed(2)}</div>
          <div className="text-xs text-slate-600">{nights} nights</div>
        </div>
        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      {isExpanded && (
        <div className="border-t border-slate-200 p-4 bg-slate-50 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">{t('sections.booking.room_rate')} ({nights} nights)</span>
            <span className="font-medium text-slate-800">{currencySymbol}{(roomRate * nights).toFixed(2)}</span>
          </div>
          
          {Array.isArray(room.selectedExtras) && room.selectedExtras.length > 0 && (
            <div className="border-t border-slate-200 pt-3 space-y-2">
              {room.selectedExtras.map((extra: SelectedExtra, idx: number) => {
                const { total, breakdown } = calculateExtraItemTotal(extra);
                return (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-slate-600">{extra.name} - {breakdown}</span>
                    <span className="font-medium text-slate-800">{currencySymbol}{total.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function ReservationDetailModal({ isOpen, onClose, initialData, propertySettings, onEdit, canManage, onCheckIn, onCheckOut }: ReservationDetailModalProps) {
  // Safe date formatter
  const formatDateSafe = (dateValue: any): string => {
    if (!dateValue) return 'N/A';
    try {
      let date: Date;
      // If it's already a Date object
      if (dateValue instanceof Date) {
        date = dateValue;
      }
      // If it's a Firestore Timestamp
      else if (dateValue && typeof dateValue.toDate === 'function') {
        date = dateValue.toDate();
      }
      // If it's a string that looks like ISO format
      else if (typeof dateValue === 'string') {
        date = new Date(dateValue);
      }
      // Otherwise try to parse it
      else {
        return 'N/A';
      }
      
      // Check if the date is valid
      if (isNaN(date.getTime())) return 'N/A';
      return format(date, 'MMM dd, yyyy', { locale: enUS });
    } catch (err) {
      return 'N/A';
    }
  };

  const [isProcessing, setIsProcessing] = useState(false);
  const [fetchedInvoice, setFetchedInvoice] = useState<Invoice | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isSendEmailModalOpen, setIsSendEmailModalOpen] = useState(false);
  const [isPrintCardDateDialogOpen, setIsPrintCardDateDialogOpen] = useState(false);
  const [isPrintCardLoading, setIsPrintCardLoading] = useState(false);
  const [printCardDate, setPrintCardDate] = useState<Date>(new Date());
  const { t, i18n } = useTranslation(['pages/dashboard/reservation-details-modal-content', 'pdf_content', 'status/status_content']);
  const locale = i18n.language === 'fr' ? fr : enUS;
  const { state } = useSidebar();

  const [includedServices, setIncludedServices] = useState<Service[]>([]);
  const [includedMealPlans, setIncludedMealPlans] = useState<MealPlan[]>([]);
  const [isLoadingExtras, setIsLoadingExtras] = useState(false);
  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [isLoadingRoomTypes, setIsLoadingRoomTypes] = useState(false);
  const [refundDialogInfo, setRefundDialogInfo] = useState<{ reservationId: string; reservation: Reservation; shouldRefund: boolean; refundAmount: number } | null>(null);
  const [isRefundDialogOpen, setIsRefundDialogOpen] = useState(false);
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [roomAssignmentLoading, setRoomAssignmentLoading] = useState<{ [key: number]: boolean }>({});
  const [viewFullPaymentNote, setViewFullPaymentNote] = useState<string | null>(null);
  const [isAddPaymentModalOpen, setIsAddPaymentModalOpen] = useState(false);
  const [isRefundPaymentModalOpen, setIsRefundPaymentModalOpen] = useState(false);
  const [isPaymentSaving, setIsPaymentSaving] = useState(false);
  const [refundFormData, setRefundFormData] = useState({ selectedPaymentId: '', refundAmount: 0, reason: '', refundMethod: 'Cash' });
  const [selectedFolioId, setSelectedFolioId] = useState<string>('main-guest-folio');
  const [folios, setFolios] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);
  const [isSavingCharge, setIsSavingCharge] = useState(false);
  const [isAddChargeModalOpen, setIsAddChargeModalOpen] = useState(false);
  const [chargeMode, setChargeMode] = useState<'add' | 'adjust'>('add');
  const [chargeFormData, setChargeFormData] = useState({
    chargeType: '',
    guestId: '', // Will be set to main guest when guests are loaded
    category: 'Miscellaneous',
    description: '',
    amount: 0,
    quantity: 1,
    unitPrice: 0,
    postingDate: new Date().toISOString().split('T')[0],
    postingTime: new Date().toTimeString().slice(0, 5),
    taxStatus: 'taxable',
    taxRate: 10,
    taxAmount: 0,
    subtotal: 0,
    nights: 1,
    ratePerNight: 0,
    folioId: 'main-guest-folio',
    referenceId: '',
    notes: '',
    makeImmutable: false,
    voidImmediately: false,
    useCurrentDateTime: false
  });
  const [showAdvancedPricing, setShowAdvancedPricing] = useState(false);
  const [showTaxes, setShowTaxes] = useState(false);
  const [isAddFolioModalOpen, setIsAddFolioModalOpen] = useState(false);
  const [newFolioName, setNewFolioName] = useState('');
  const [isCreatingFolio, setIsCreatingFolio] = useState(false);
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [selectedEntryForSplit, setSelectedEntryForSplit] = useState<LedgerEntry | null>(null);
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [selectedEntryForVoid, setSelectedEntryForVoid] = useState<LedgerEntry | null>(null);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [selectedEntryForMove, setSelectedEntryForMove] = useState<LedgerEntry | null>(null);
  const [activities, setActivities] = useState<Array<{
    id: string;
    timestamp: Date;
    type: 'payment' | 'refund' | 'cancellation' | 'check-in' | 'check-out' | 'room-assignment' | 'guest-add' | 'guest-update' | 'note-add' | 'status-change' | 'creation';
    title: string;
    details: Record<string, any>;
    description: string;
  }>>([]);
  
  // Edit panel states
  const [isEditPanelOpen, setIsEditPanelOpen] = useState(false);
  const [editCheckInDate, setEditCheckInDate] = useState<Date | undefined>(initialData ? toDate(initialData.startDate) as Date : undefined);
  const [editCheckOutDate, setEditCheckOutDate] = useState<Date | undefined>(initialData ? toDate(initialData.endDate) as Date : undefined);
  const [editRoomTypeFilter, setEditRoomTypeFilter] = useState<string>('all');
  const [availabilityResults, setAvailabilityResults] = useState<any[]>([]);
  // Note type for guest notes
  interface GuestNote {
    id: string;
    content: string;
    createdAt: Date;
  }

  // Guest type for storing guest information
  interface GuestInfo {
    id: string;
    guestName: string;
    guestEmail: string;
    guestPhone: string;
    guestCountry: string;
    guestCity: string;
    guestZipCode: string;
    guestAddress: string;
    guestIdType: string;
    guestPassportOrId: string;
    guestGender: string;
    guestBirthDate: Date | undefined;
    guestProfileImage: string;
    notes?: GuestNote[];
  }

  // Initialize guests from reservation data
  const initializeGuests = (): GuestInfo[] => {
    const mainGuest: GuestInfo = {
      id: 'main-guest',
      guestName: initialData?.guestName || '',
      guestEmail: initialData?.guestEmail || '',
      guestPhone: initialData?.guestPhone || '',
      guestCountry: initialData?.guestCountry || '',
      guestCity: initialData?.guestCity || '',
      guestZipCode: initialData?.guestZipCode || '',
      guestAddress: initialData?.guestAddress || '',
      guestIdType: initialData?.guestIdType || 'passport',
      guestPassportOrId: initialData?.guestPassportOrId || '',
      guestGender: initialData?.guestGender || '',
      guestBirthDate: initialData?.guestBirthDate || undefined,
      guestProfileImage: initialData?.guestProfileImage || '',
      notes: ((initialData as any)?.guestNotes || []).map((note: any) => ({
        ...note,
        createdAt: note.createdAt instanceof Date ? note.createdAt : new Date(note.createdAt),
      })),
    };

    const allGuests: GuestInfo[] = [mainGuest];

    // Add additional guests from Firestore
    if ((initialData as any)?.additionalGuests && Array.isArray((initialData as any).additionalGuests)) {
      (initialData as any).additionalGuests.forEach((guest: any, index: number) => {
        allGuests.push({
          id: guest.id || `guest-${index + 1}`,
          guestName: guest.guestName || '',
          guestEmail: guest.guestEmail || '',
          guestPhone: guest.guestPhone || '',
          guestCountry: guest.guestCountry || '',
          guestCity: guest.guestCity || '',
          guestZipCode: guest.guestZipCode || '',
          guestAddress: guest.guestAddress || '',
          guestIdType: guest.guestIdType || 'passport',
          guestPassportOrId: guest.guestPassportOrId || '',
          guestGender: guest.guestGender || '',
          guestBirthDate: guest.guestBirthDate || undefined,
          guestProfileImage: guest.guestProfileImage || '',
          notes: (guest.notes || []).map((note: any) => ({
            ...note,
            createdAt: note.createdAt instanceof Date ? note.createdAt : new Date(note.createdAt),
          })),
        });
      });
    }

    return allGuests;
  };

  // Guest details edit states
  const [isGuestDetailsEditMode, setIsGuestDetailsEditMode] = useState(false);
  const [guests, setGuests] = useState<GuestInfo[]>(initializeGuests());
  const [selectedGuestId, setSelectedGuestId] = useState<string>('main-guest');
  const [editGuestDetails, setEditGuestDetails] = useState<GuestInfo>(
    guests[0] || {
      id: 'main-guest',
      guestName: '',
      guestEmail: '',
      guestPhone: '',
      guestCountry: '',
      guestCity: '',
      guestZipCode: '',
      guestAddress: '',
      guestIdType: 'passport',
      guestPassportOrId: '',
      guestGender: '',
      guestBirthDate: undefined,
      guestProfileImage: '',
    }
  );
  const [isGuestDetailsSaving, setIsGuestDetailsSaving] = useState(false);
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);
  const [guestDetailsTab, setGuestDetailsTab] = useState<'infos' | 'notes'>('infos');
  const [noteInput, setNoteInput] = useState('');
  
  const [reservation, setReservation] = useState<Reservation | null>(initialData);
  const currencySymbol = propertySettings?.currency || '$';

  // Calculate sidebar width based on state (16rem = 256px expanded, 3rem = 48px collapsed)
  const SIDEBAR_WIDTH_EXPANDED = 256;
  const SIDEBAR_WIDTH_COLLAPSED = 48;
  const sidebarWidth = state === 'expanded' ? SIDEBAR_WIDTH_EXPANDED : SIDEBAR_WIDTH_COLLAPSED;

  const calculateExtraItemTotal = useCallback((extra: SelectedExtra) => {
    if (!reservation) return { total: 0, breakdown: '' };
    const nights = differenceInDays(toDate(reservation.endDate) as Date, toDate(reservation.startDate) as Date);
    if (nights <= 0) return { total: 0, breakdown: '' };

    const room = reservation.rooms.find((r: ReservationRoom) => r.selectedExtras?.some((e: SelectedExtra) => e.id === extra.id));
    const totalGuests = (room?.adults || 0) + (room?.children || 0);

    let itemTotal = 0;
    let breakdown = '';
    const { price: unitPrice, quantity, unit } = extra;
    
    switch(unit) {
        case 'one_time':
        case 'per_booking':
        case 'one_time_per_room':
            itemTotal = unitPrice * quantity;
            breakdown = `${currencySymbol}${unitPrice.toFixed(2)} x ${quantity}`;
            break;
        case 'per_night':
        case 'per_night_per_room':
            itemTotal = unitPrice * nights * quantity;
            breakdown = t('breakdowns.per_night', { price: `${currencySymbol}${unitPrice.toFixed(2)}`, nights: nights, quantity: quantity });
            break;
        case 'per_guest':
        case 'one_time_per_guest':
            itemTotal = unitPrice * totalGuests * quantity;
            breakdown = t('breakdowns.per_guest', { price: `${currencySymbol}${unitPrice.toFixed(2)}`, guests: totalGuests, quantity: quantity });
            break;
        case 'per_night_per_guest':
            itemTotal = unitPrice * nights * totalGuests * quantity;
            breakdown = t('breakdowns.per_night_per_guest', { price: `${currencySymbol}${unitPrice.toFixed(2)}`, nights: nights, guests: totalGuests, quantity: quantity });
            break;
        default:
            itemTotal = unitPrice * quantity;
            breakdown = `${currencySymbol}${unitPrice.toFixed(2)} x ${quantity}`;
    }
    return { total: itemTotal, breakdown };
  }, [reservation, currencySymbol, t]);

  const fetchAvailableRooms = useCallback(async (roomTypeId: string) => {
    if (!reservation?.propertyId || !reservation || !roomTypeId) {
      console.warn('Missing required params:', { propertyId: reservation?.propertyId, hasReservation: !!reservation, roomTypeId });
      return;
    }
    try {
      setIsLoadingRooms(true);
      console.log('Fetching rooms for roomTypeId:', roomTypeId);
      console.log('Current reservation:', {
        id: reservation.id,
        propertyId: reservation.propertyId,
        startDate: toDate(reservation.startDate),
        endDate: toDate(reservation.endDate),
        actualCheckInTime: reservation.actualCheckInTime,
        actualCheckOutTime: reservation.actualCheckOutTime,
      });
      
      // Fetch all rooms of this property that match the room type
      const roomsQuery = query(
        collection(db, 'rooms'),
        where('propertyId', '==', reservation.propertyId),
        where('roomTypeId', '==', roomTypeId)
      );
      const roomsSnap = await getDocs(roomsQuery);
      const allRooms = roomsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      console.log('Found rooms for this type:', allRooms);
      
      // Get all reservations for this property (excluding canceled and no-show)
      const resQuery = query(
        collection(db, 'reservations'),
        where('propertyId', '==', reservation.propertyId)
      );
      const resSnap = await getDocs(resQuery);
      
      // Use check-in/check-out dates if available, otherwise use reservation dates
      const currentStart = reservation.actualCheckInTime 
        ? startOfDay(toDate(reservation.actualCheckInTime) as Date)
        : startOfDay(toDate(reservation.startDate) as Date);
      const currentEnd = reservation.actualCheckOutTime 
        ? startOfDay(toDate(reservation.actualCheckOutTime) as Date)
        : startOfDay(toDate(reservation.endDate) as Date);
      
      console.log('Date range for availability check:', {
        start: currentStart,
        end: currentEnd,
      });
      
      const occupiedRoomIds = new Set<string>();
      const conflictingReservations: any[] = [];
      
      // Check which rooms are occupied during the reservation period
      resSnap.docs.forEach(resDoc => {
        const resData = resDoc.data();
        
        // Skip the current reservation
        if (resDoc.id === reservation.id) return;
        
        // Skip canceled and no-show reservations
        if (resData.status === 'Canceled' || resData.status === 'No-Show') return;
        
        // Use actual check-in/check-out times if available
        const resStart = resData.actualCheckInTime
          ? startOfDay(toDate(resData.actualCheckInTime) as Date)
          : startOfDay(toDate(resData.startDate) as Date);
        const resEnd = resData.actualCheckOutTime
          ? startOfDay(toDate(resData.actualCheckOutTime) as Date)
          : startOfDay(toDate(resData.endDate) as Date);
        
        // Check if this reservation overlaps with current reservation
        if (currentStart < resEnd && currentEnd > resStart) {
          conflictingReservations.push({
            resId: resDoc.id,
            resStart,
            resEnd,
            rooms: resData.rooms?.map((r: any) => r.roomId || r.id) || [],
          });
          // Mark rooms as occupied
          if (resData.rooms && Array.isArray(resData.rooms)) {
            resData.rooms.forEach((room: any) => {
              occupiedRoomIds.add(room.roomId || room.id);
            });
          }
        }
      });
      
      console.log('Conflicting reservations:', conflictingReservations);
      console.log('Occupied room IDs:', Array.from(occupiedRoomIds));
      const availableRoomsList = allRooms.filter(room => 
        !occupiedRoomIds.has(room.id) || room.id === reservation.rooms?.[0]?.roomId
      );
      
      console.log('Available rooms after filtering:', availableRoomsList);
      setAvailableRooms(availableRoomsList);
    } catch (error) {
      console.error('Error fetching available rooms:', error);
      toast({ title: 'Error loading available rooms', variant: 'destructive' });
    } finally {
      setIsLoadingRooms(false);
    }
  }, [reservation, db]);

  // Helper function to convert Firestore Timestamp objects to strings
  const convertTimestampToString = (value: any): string => {
    if (!value) return 'Not set';
    
    // Handle Firestore Timestamp objects {seconds, nanoseconds}
    if (typeof value === 'object' && value.seconds !== undefined && value.nanoseconds !== undefined) {
      const date = new Date(value.seconds * 1000);
      return format(date, 'MMM dd, yyyy', { locale });
    }
    
    // Handle Date objects
    if (value instanceof Date) {
      return format(value, 'MMM dd, yyyy', { locale });
    }
    
    // Handle strings
    if (typeof value === 'string') {
      return value;
    }
    
    // Handle objects (convert to string)
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    
    return String(value);
  };

  const addActivity = useCallback((
    type: 'payment' | 'refund' | 'cancellation' | 'check-in' | 'check-out' | 'room-assignment' | 'guest-add' | 'guest-update' | 'note-add' | 'status-change' | 'creation',
    title: string,
    details: Record<string, any>,
    description: string
  ) => {
    const activity = {
      id: `${type}-${Date.now()}`,
      timestamp: new Date(),
      type,
      title,
      details,
      description
    };
    setActivities(prev => [activity, ...prev]);
    
    // Also save to Firestore (with undefined -> null conversion)
    if (reservation?.id) {
      try {
        const firestoreData = cleanFirestoreData({
          type,
          title,
          details,
          description,
          timestamp: serverTimestamp()
        });
        addDoc(collection(db, `reservations/${reservation.id}/activities`), firestoreData);
      } catch (error) {
        console.error('Error saving activity to Firestore:', error);
      }
    }
  }, [reservation?.id, db]);

  const handleRoomAssignment = async (roomIndex: number, newRoom: any) => {
    if (!reservation) return;
    
    try {
      setRoomAssignmentLoading(prev => ({ ...prev, [roomIndex]: true }));
      
      const updatedRooms = [...reservation.rooms];
      const oldRoomName = updatedRooms[roomIndex].roomName;
      
      updatedRooms[roomIndex] = {
        ...updatedRooms[roomIndex],
        roomId: newRoom.id,
        roomName: newRoom.name,
      };
      
      // Update reservation in Firestore
      const resRef = doc(db, 'reservations', reservation.id);
      const batch = writeBatch(db);
      batch.update(resRef, { rooms: updatedRooms });
      await batch.commit();
      
      // Log room assignment change to activity
      addActivity(
        'room-assignment',
        `Room Assignment Changed`,
        {
          'roomName': { oldValue: oldRoomName, newValue: newRoom.name }
        },
        `Room changed from "${oldRoomName}" to "${newRoom.name}"`
      );
      
      toast({ title: 'Room assignment updated successfully' });
    } catch (error) {
      console.error('Error updating room assignment:', error);
      toast({ title: 'Error updating room assignment', variant: 'destructive' });
    } finally {
      setRoomAssignmentLoading(prev => ({ ...prev, [roomIndex]: false }));
    }
  };
  const handleUpdateReservation = useCallback(async (room: any) => {
    if (!reservation || !editCheckInDate || !editCheckOutDate) {
      toast({ title: 'Please select check-in and check-out dates', variant: 'destructive' });
      return;
    }

    try {
      setRoomAssignmentLoading(prev => ({ ...prev, [room.id]: true }));

      // Find the room type details
      const roomType = roomTypes.find(rt => rt.id === room.roomTypeId);

      const resRef = doc(db, 'reservations', reservation.id);
      const batch = writeBatch(db);

      // Update the first room in the reservation (assuming single room reservation)
      const updatedRooms = [
        {
          roomId: room.id,
          roomName: room.name,
          roomType: roomType?.name || room.roomType || 'N/A',
          roomTypeId: room.roomTypeId,
          roomTypeName: roomType?.name || room.roomType || 'N/A',
          adults: reservation.rooms?.[0]?.adults || 0,
          children: reservation.rooms?.[0]?.children || 0,
        }
      ];

      batch.update(resRef, {
        rooms: updatedRooms,
        startDate: editCheckInDate,
        endDate: editCheckOutDate,
        updatedAt: new Date(),
      });

      await batch.commit();
      
      toast({ title: 'Reservation updated successfully' });
      
      // Log activity for room and date changes
      addActivity(
        'room-assignment',
        'Room Assignment Updated',
        {
          roomName: room.name,
          roomType: roomType?.name || room.roomType || 'N/A',
          checkInDate: format(editCheckInDate, 'PPp'),
          checkOutDate: format(editCheckOutDate, 'PPp')
        },
        `Room assigned: ${room.name} (${roomType?.name || 'N/A'}) from ${format(editCheckInDate, 'PP')} to ${format(editCheckOutDate, 'PP')}`
      );
      
      // Close the edit panel
      setIsEditPanelOpen(false);
    } catch (error) {
      console.error('Error updating reservation:', error);
      toast({ title: 'Error updating reservation', variant: 'destructive' });
    } finally {
      setRoomAssignmentLoading(prev => ({ ...prev, [room.id]: false }));
    }
  }, [reservation, editCheckInDate, editCheckOutDate, roomTypes, db, toast]);

  const handleSaveGuestDetails = useCallback(async () => {
    if (!reservation) return;

    try {
      setIsGuestDetailsSaving(true);
      const resRef = doc(db, 'reservations', reservation.id);
      
      // First, update the guests array with the current editGuestDetails
      const updatedGuests = guests.map(g => 
        g.id === selectedGuestId ? editGuestDetails : g
      );

      // Update main guest fields
      const mainGuest = updatedGuests.find(g => g.id === 'main-guest');
      const updateData: any = {
        guestName: mainGuest?.guestName || '',
        guestEmail: mainGuest?.guestEmail || '',
        guestPhone: mainGuest?.guestPhone || '',
        guestCountry: mainGuest?.guestCountry || '',
        guestCity: mainGuest?.guestCity || '',
        guestZipCode: mainGuest?.guestZipCode || '',
        guestAddress: mainGuest?.guestAddress || '',
        guestIdType: mainGuest?.guestIdType || 'passport',
        guestPassportOrId: mainGuest?.guestPassportOrId || '',
        guestGender: mainGuest?.guestGender || '',
        guestBirthDate: mainGuest?.guestBirthDate || null,
        guestProfileImage: mainGuest?.guestProfileImage || '',
        guestNotes: (mainGuest?.notes || []).map(note => ({
          ...note,
          createdAt: note.createdAt instanceof Date ? note.createdAt.toISOString() : note.createdAt,
        })),
        additionalGuests: updatedGuests.filter(g => g.id !== 'main-guest').map(({ id, ...guest }) => ({
          ...guest,
          guestBirthDate: guest.guestBirthDate || null,
          notes: (guest.notes || []).map(note => ({
            ...note,
            createdAt: note.createdAt instanceof Date ? note.createdAt.toISOString() : note.createdAt,
          })),
        })),
        updatedAt: new Date(),
      };

      await updateDoc(resRef, updateData);

      // Update local state with the saved guests
      setGuests(updatedGuests);
      setReservation(prev => prev ? { ...prev, ...updateData } : null);
      setIsGuestDetailsEditMode(false);
      
      // Detect and log only changed fields for activity
      const oldGuest = guests.find(g => g.id === selectedGuestId);
      const changedFields: Record<string, {oldValue: any, newValue: any}> = {};
      
      const fieldsToTrack = [
        'guestName', 'guestEmail', 'guestPhone', 'guestCountry', 'guestCity', 'guestZipCode', 'guestAddress',
        'guestIdType', 'guestPassportOrId', 'guestGender', 'guestBirthDate', 'guestProfileImage'
      ];
      
      const formatValue = (val: any, field: string): string => {
        if (!val) return 'Not set';
        if (field === 'guestBirthDate') {
          if (val instanceof Date) {
            return format(val, 'MMM dd, yyyy');
          } else if (typeof val === 'string') {
            return format(new Date(val), 'MMM dd, yyyy');
          } else if (val?.toDate) {
            return format(val.toDate(), 'MMM dd, yyyy');
          }
          return String(val);
        }
        return String(val);
      };
      
      fieldsToTrack.forEach(field => {
        const oldValue = oldGuest?.[field];
        const newValue = editGuestDetails?.[field];
        
        // Convert for comparison
        let oldComparable = oldValue;
        let newComparable = newValue;
        if (field === 'guestBirthDate' && oldValue) {
          oldComparable = oldValue instanceof Date ? oldValue.getTime() : (oldValue?.toDate?.()?.getTime?.() || oldValue);
        }
        if (field === 'guestBirthDate' && newValue) {
          newComparable = newValue instanceof Date ? newValue.getTime() : (newValue?.toDate?.()?.getTime?.() || newValue);
        }
        
        if (oldComparable !== newComparable) {
          changedFields[field] = { 
            oldValue: formatValue(oldValue, field), 
            newValue: formatValue(newValue, field),
            rawOldValue: oldValue,
            rawNewValue: newValue
          };
        }
      });
      
      // Log activity only if fields changed
      if (Object.keys(changedFields).length > 0) {
        const guestName = editGuestDetails.guestName || 'Guest';
        
        // Detect if this is a new guest being added (all old values are empty)
        const isNewGuest = selectedGuestId !== 'main-guest' && Object.values(changedFields).every(
          vals => vals.oldValue === 'Not set' || vals.oldValue === ''
        );
        
        if (isNewGuest) {
          // For new guests, show only the filled fields
          const filledFields: Record<string, any> = {};
          Object.entries(changedFields).forEach(([field, vals]: [string, any]) => {
            if (vals.newValue !== 'Not set' && vals.newValue !== '') {
              filledFields[field] = vals.newValue;
            }
          });
          
          const filledFieldsList = Object.entries(filledFields)
            .map(([field, value]) => `${field}: ${value}`)
            .join(', ');
          
          addActivity(
            'guest-add',
            'New Guest Added',
            filledFields,
            `${guestName} - ${filledFieldsList}`
          );
        } else {
          // For existing guests, show before/after changes
          const changes = Object.entries(changedFields).map(([field, vals]: [string, any]) => 
            `${field}: "${vals.oldValue}" → "${vals.newValue}"`
          ).join(', ');
          
          // Clean up the display object (remove raw values)
          const displayFields: Record<string, any> = {};
          Object.entries(changedFields).forEach(([field, vals]: [string, any]) => {
            displayFields[field] = { oldValue: vals.oldValue, newValue: vals.newValue };
          });
          
          addActivity(
            'guest-update',
            `Guest Edited: ${guestName}`,
            displayFields,
            `${changes}`
          );
        }
      }
      
      toast({ title: 'Guest details updated successfully' });
    } catch (error) {
      console.error('Error saving guest details:', error);
      toast({ title: 'Error saving guest details', variant: 'destructive' });
    } finally {
      setIsGuestDetailsSaving(false);
    }
  }, [reservation, guests, selectedGuestId, editGuestDetails, db, toast, addActivity]);

  const uploadPhotoToStorage = useCallback(async (imageData: string): Promise<string | null> => {
    if (!reservation?.id) return null;

    try {
      setIsPhotoUploading(true);
      const storage = getStorage(app);
      
      // Convert base64 to blob
      const base64Data = imageData.split(',')[1];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'image/jpeg' });

      // Create storage path with guest ID
      const guestId = selectedGuestId || 'main-guest';
      const storageRef = ref(storage, `guest-profiles/${reservation.propertyId}/${reservation.id}/${guestId}-profile-${Date.now()}.jpg`);

      // Upload to storage
      await uploadBytes(storageRef, blob);

      // Get download URL
      const downloadURL = await getDownloadURL(storageRef);
      return downloadURL;
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast({
        title: 'Upload Error',
        description: 'Failed to upload photo to storage.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsPhotoUploading(false);
    }
  }, [reservation, app, toast, selectedGuestId]);

  const deletePhotoFromStorage = useCallback(async () => {
    if (!reservation || !editGuestDetails.guestProfileImage) return;

    try {
      setIsPhotoUploading(true);
      const storage = getStorage(app);
      
      // Extract the path from the URL to delete the file
      const urlParts = editGuestDetails.guestProfileImage.split('/o/')[1];
      if (!urlParts) {
        throw new Error('Invalid photo URL');
      }
      
      const filePath = decodeURIComponent(urlParts.split('?')[0]);
      const fileRef = ref(storage, filePath);
      
      await deleteObject(fileRef);
      
      // Remove photo from guest details
      setEditGuestDetails({ ...editGuestDetails, guestProfileImage: '' });
      
      toast({
        title: 'Photo Deleted',
        description: 'Photo will be removed when you click Save.',
      });
    } catch (error) {
      console.error('Error deleting photo:', error);
      toast({
        title: 'Delete Error',
        description: 'Failed to delete photo from storage.',
        variant: 'destructive',
      });
    } finally {
      setIsPhotoUploading(false);
    }
  }, [editGuestDetails, app, toast]);

  const handleAddNote = useCallback(() => {
    if (!noteInput.trim()) return;

    const newNote: GuestNote = {
      id: `note-${Date.now()}`,
      content: noteInput,
      createdAt: new Date(),
    };

    const updatedNotes = [...(editGuestDetails.notes || []), newNote];
    setEditGuestDetails({ ...editGuestDetails, notes: updatedNotes });
    setNoteInput('');
    
    // Log activity for note addition
    addActivity(
      'note-add',
      'Note Added',
      {
        guestName: editGuestDetails.guestName || 'Guest',
        noteContent: noteInput.substring(0, 100) + (noteInput.length > 100 ? '...' : '')
      },
      `Note added for ${editGuestDetails.guestName || 'Guest'}: ${noteInput.substring(0, 50)}...`
    );

    toast({
      title: 'Note Added',
      description: 'Note will be saved when you click Save.',
    });
  }, [noteInput, editGuestDetails, toast, addActivity]);

  const handleDeleteNote = useCallback((noteId: string) => {
    const noteToDelete = (editGuestDetails.notes || []).find(n => n.id === noteId);
    const updatedNotes = (editGuestDetails.notes || []).filter(n => n.id !== noteId);
    setEditGuestDetails({ ...editGuestDetails, notes: updatedNotes });
    
    // Log activity for note deletion
    if (noteToDelete) {
      addActivity(
        'note-add',
        'Note Deleted',
        {
          guestName: editGuestDetails.guestName || 'Guest',
          noteContent: noteToDelete.content.substring(0, 100) + (noteToDelete.content.length > 100 ? '...' : '')
        },
        `Note deleted for ${editGuestDetails.guestName || 'Guest'}`
      );
    }

    toast({
      title: 'Note Deleted',
      description: 'Note will be removed when you click Save.',
    });
  }, [editGuestDetails, toast, addActivity]);

  const handleDeleteGuest = useCallback(async () => {
    if (!reservation || selectedGuestId === 'main-guest') return;

    const guestToDelete = guests.find(g => g.id === selectedGuestId);
    if (!guestToDelete) return;

    // Show confirmation
    if (!confirm(`Are you sure you want to delete "${guestToDelete.guestName || 'Guest'}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setIsGuestDetailsSaving(true);
      const resRef = doc(db, 'reservations', reservation.id);

      // Remove guest from array
      const updatedGuests = guests.filter(g => g.id !== selectedGuestId);

      // Get the additional guests (exclude main guest)
      const additionalGuests = updatedGuests
        .filter(g => g.id !== 'main-guest')
        .map(({ id, ...guest }) => ({
          ...guest,
          guestBirthDate: guest.guestBirthDate || null,
          notes: (guest.notes || []).map(note => ({
            ...note,
            createdAt: note.createdAt instanceof Date ? note.createdAt.toISOString() : note.createdAt,
          })),
        }));

      // Update Firestore
      await updateDoc(resRef, {
        additionalGuests: additionalGuests,
        updatedAt: new Date(),
      });

      // Update local state
      setGuests(updatedGuests);
      setSelectedGuestId('main-guest');
      setIsGuestDetailsEditMode(false);

      toast({
        title: 'Guest deleted successfully',
        description: `${guestToDelete.guestName || 'Guest'} has been removed from the reservation.`,
      });
    } catch (error) {
      console.error('Error deleting guest:', error);
      toast({
        title: 'Error deleting guest',
        variant: 'destructive',
      });
    } finally {
      setIsGuestDetailsSaving(false);
    }
  }, [reservation, guests, selectedGuestId, db, toast]);

  const handlePrintRegistrationCard = useCallback(() => {
    // Open date selection dialog immediately
    setPrintCardDate(new Date());
    setIsPrintCardDateDialogOpen(true);
  }, []);

  const generateAndPrintRegistrationCard = (dateForPrint: Date) => {
    // Generate fresh registration card with current guest and reservation data
    const guest = guests.find(g => g.id === selectedGuestId);
    if (!guest || !reservation) return;

    // Get room info for primary guest
    const room = reservation.rooms?.[selectedGuestId === 'main-guest' ? 0 : undefined];
    const roomType = room ? (room.roomTypeName || room.roomType || 'N/A') : 'N/A';
    const roomName = room ? (room.roomName || 'N/A') : 'N/A';

    // Get additional guests
    const additionalGuests = guests.filter(g => g.id !== 'main-guest');

    // Create print HTML
    const printContent = `
      <html>
        <head>
          <title>Guest Registration Card</title>
          <style>
            @page {
              size: A4;
              margin: 10mm;
            }
            @media print {
              * { margin: 0; padding: 0; }
              body { margin: 0; padding: 10mm; page-break-after: avoid; }
              .card { margin: 0; page-break-inside: avoid; }
            }
            * { box-sizing: border-box; }
            html, body { 
              width: 210mm;
              height: 297mm;
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
            }
            body { 
              padding: 10mm;
              background: #fff;
            }
            .card {
              width: 100%;
              height: 100%;
              border: 2px solid #333;
              padding: 10mm;
              background: #fff;
              display: flex;
              flex-direction: column;
            }
            .property-header {
              text-align: center;
              margin-bottom: 15px;
              border-bottom: 2px solid #333;
              padding-bottom: 15px;
            }
            .property-logo {
              max-width: 100px;
              height: auto;
              margin-bottom: 10px;
            }
            .property-name {
              font-size: 16px;
              font-weight: bold;
              color: #333;
              margin-bottom: 5px;
            }
            .property-address {
              font-size: 12px;
              color: #555;
            }
            .header { font-size: 14px; font-weight: bold; margin-bottom: 10px; text-align: center; border-bottom: 2px solid #333; padding-bottom: 8px; }
            .section { margin-bottom: 12px; flex-shrink: 0; }
            .section-title { font-weight: bold; font-size: 13px; margin-bottom: 8px; margin-top: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
            .label { font-weight: bold; font-size: 11px; color: #333; display: inline-block; width: 80px; }
            .value { font-size: 12px; color: #333; display: inline; }
            .row { display: flex; gap: 20px; margin-bottom: 0px; padding: 12px 0; align-items: center; }
            .col { flex: 1; min-width: 0; display: flex; align-items: center; }
            .col-label { font-weight: bold; font-size: 11px; color: #333; text-transform: uppercase; letter-spacing: 0.3px; min-width: 120px; }
            .col-value { font-size: 12px; color: #333; word-break: break-word; flex: 1; }
            .row-divider { border-bottom: 1px solid #333; }
            .divider { border-top: 2px solid #333; margin: 10px 0; }
            .footer { margin-top: 20px; flex-shrink: 0; padding-top: 10px; }
            .footer-row { display: flex; gap: 10px; margin-top: 20px; }
            .footer-col { flex: 1; }
            .footer-line { border-top: 1px solid #333; margin-top: 0px; padding-top: 4px; font-size: 10px; text-align: center; }
            .policy-text { font-size: 11px; margin: 12px 0; line-height: 1.5; }
            .additional-guest-item { margin-bottom: 8px; padding-bottom: 6px; }
            .additional-guest-name { font-weight: bold; font-size: 12px; }
            .additional-guest-info { font-size: 11px; margin-top: 2px; color: #555; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="property-header">
              ${propertySettings?.bookingPageSettings?.logoUrl ? `<img src="${propertySettings.bookingPageSettings.logoUrl}" class="property-logo" alt="Property Logo" />` : ''}
              <div class="property-name">${propertySettings?.name || 'Hotel'}</div>
              <div class="property-address">${propertySettings?.address || ''}</div>
            </div>
            
            <div class="header">GUEST REGISTRATION CARD</div>
            
            <div class="section">
              <div class="row row-divider">
                <div class="col">
                  <div class="col-label">Arrival Date</div>
                  <div class="col-value">${
                    reservation.startDate 
                      ? new Date(reservation.startDate).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })
                      : 'N/A'
                  }</div>
                </div>
              </div>
              
              <div class="row row-divider">
                <div class="col">
                  <div class="col-label">Departure Date</div>
                  <div class="col-value">${
                    reservation.endDate 
                      ? new Date(reservation.endDate).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })
                      : 'N/A'
                  }</div>
                </div>
              </div>
              
              <div class="row row-divider">
                <div class="col">
                  <div class="col-label">Booking #</div>
                  <div class="col-value">${reservation.reservationNumber || reservation.id}</div>
                </div>
              </div>
            </div>

            <div class="divider"></div>

            <div class="section">
              <div class="section-title">Primary Guest Information</div>
              
              <div class="row row-divider">
                <div class="col">
                  <div class="col-label">Full Name</div>
                  <div class="col-value">${guest.guestName || 'N/A'}</div>
                </div>
              </div>
              
              <div class="row row-divider">
                <div class="col">
                  <div class="col-label">Room Type</div>
                  <div class="col-value">${roomType}</div>
                </div>
              </div>
              
              <div class="row row-divider">
                <div class="col">
                  <div class="col-label">Room #</div>
                  <div class="col-value">${roomName}</div>
                </div>
              </div>
              
              <div class="row row-divider">
                <div class="col">
                  <div class="col-label">Country</div>
                  <div class="col-value">${guest.guestCountry || 'N/A'}</div>
                </div>
              </div>
              
              <div class="row row-divider">
                <div class="col">
                  <div class="col-label">City</div>
                  <div class="col-value">${guest.guestCity || 'N/A'}</div>
                </div>
              </div>
              
              <div class="row row-divider">
                <div class="col">
                  <div class="col-label">Zip Code</div>
                  <div class="col-value">${guest.guestZipCode || 'N/A'}</div>
                </div>
              </div>
              
              <div class="row row-divider">
                <div class="col">
                  <div class="col-label">Address</div>
                  <div class="col-value">${guest.guestAddress || 'N/A'}</div>
                </div>
              </div>
              
              <div class="row row-divider">
                <div class="col">
                  <div class="col-label">ID Type</div>
                  <div class="col-value">${
                    guest.guestIdType === 'id-card' ? 'ID Card' :
                    guest.guestIdType === 'eu-card' ? 'EU Card' :
                    guest.guestIdType === 'passport' ? 'Passport' :
                    guest.guestIdType === 'drivers-licence' ? "Driver's Licence" : 'N/A'
                  }</div>
                </div>
              </div>
              
              <div class="row row-divider">
                <div class="col">
                  <div class="col-label">ID Number</div>
                  <div class="col-value">${guest.guestPassportOrId || 'N/A'}</div>
                </div>
              </div>
            </div>

            ${additionalGuests.length > 0 ? `
              <div class="divider"></div>
              <div class="section">
                <div class="section-title">Additional Guests</div>
                ${additionalGuests.map(g => `
                  <div class="row row-divider">
                    <div class="col">
                      <div class="col-label">Guest Name</div>
                      <div class="col-value">${g.guestName || 'N/A'}</div>
                    </div>
                  </div>
                  ${g.guestCountry ? `
                    <div class="row row-divider">
                      <div class="col">
                        <div class="col-label">Country</div>
                        <div class="col-value">${g.guestCountry}</div>
                      </div>
                    </div>
                  ` : ''}
                  ${g.guestIdType ? `
                    <div class="row row-divider">
                      <div class="col">
                        <div class="col-label">ID</div>
                        <div class="col-value">${g.guestPassportOrId || 'N/A'}</div>
                      </div>
                    </div>
                  ` : ''}
                `).join('')}
              </div>
            ` : ''}

            <div class="divider"></div>

            <div class="section">
              <strong style="font-size: 12px;">Hotel Policy:</strong>
              <div class="policy-text">
                • Guest is responsible for all damages to the property<br/>
                • Noise must be kept to a minimum after 22:00<br/>
                • Keys must be returned upon checkout
              </div>
            </div>

            <div class="footer">
              <div class="footer-row">
                <div class="footer-col">
                  <div style="font-size: 9px; text-align: center; margin-bottom: 3px;">Date</div>
                  <div class="footer-line" style="font-size: 15px; font-weight: bold;here a padding-top: 8px;">${String(dateForPrint.getDate()).padStart(2, '0')}/${String(dateForPrint.getMonth() + 1).padStart(2, '0')}/${dateForPrint.getFullYear()}</div>
                  <div style="margin-top: 10px;"></div>
                </div>
                <div class="footer-col">
                  <div style="font-size: 9px; text-align: center; margin-bottom: 3px;">Guest Signature</div>
                  <div class="footer-line"></div>
                  <div style="margin-top: 10px;"></div>
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    // Create and open print window
    const printWindow = window.open('', '', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }

    toast({
      title: 'Print dialog opened',
      description: 'Use your browser print dialog to complete printing.',
    });
  };

  // Listen for photo captures from camera window
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data.type === 'photo-captured') {
        const imageData = event.data.image;
        const downloadURL = await uploadPhotoToStorage(imageData);
        if (downloadURL) {
          setEditGuestDetails(prev => ({ ...prev, guestProfileImage: downloadURL }));
          toast({
            title: 'Photo Captured',
            description: 'Photo will be saved when you click Save.',
          });
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [uploadPhotoToStorage, toast]);

  // Reload guests when initialData changes
  useEffect(() => {
    const updatedGuests = initializeGuests();
    setGuests(updatedGuests);
    setSelectedGuestId('main-guest');
    setEditGuestDetails(updatedGuests[0]);
  }, [initialData?.id]); // Only reload when reservation ID changes

  const fetchRoomTypes = useCallback(async () => {
    if (!reservation?.propertyId) return;
    try {
      setIsLoadingRoomTypes(true);
      const roomTypesQuery = query(
        collection(db, 'roomTypes'),
        where('propertyId', '==', reservation.propertyId)
      );
      const roomTypesSnap = await getDocs(roomTypesQuery);
      const types = roomTypesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setRoomTypes(types);
    } catch (error) {
      console.error('Error fetching room types:', error);
    } finally {
      setIsLoadingRoomTypes(false);
    }
  }, [reservation?.propertyId, db]);

  const checkAvailability = useCallback(async () => {
    if (!reservation || !editCheckInDate || !editCheckOutDate) {
      toast({ title: 'Please select check-in and check-out dates', variant: 'destructive' });
      return;
    }

    try {
      // Fetch all rooms or filter by type
      let roomsQuery: any;
      if (editRoomTypeFilter === 'all') {
        roomsQuery = query(
          collection(db, 'rooms'),
          where('propertyId', '==', reservation.propertyId)
        );
      } else {
        roomsQuery = query(
          collection(db, 'rooms'),
          where('propertyId', '==', reservation.propertyId),
          where('roomTypeId', '==', editRoomTypeFilter)
        );
      }

      const roomsSnap = await getDocs(roomsQuery);
      const allRooms = roomsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

      // Get all reservations for this property
      const resQuery = query(
        collection(db, 'reservations'),
        where('propertyId', '==', reservation.propertyId)
      );
      const resSnap = await getDocs(resQuery);

      const checkInStart = startOfDay(editCheckInDate);
      const checkOutEnd = startOfDay(editCheckOutDate);
      const occupiedRoomIds = new Set<string>();

      // Check which rooms are occupied during the selected period
      resSnap.docs.forEach(resDoc => {
        const resData = resDoc.data();

        // Skip the current reservation
        if (resDoc.id === reservation.id) return;

        // Skip canceled and no-show reservations
        if (resData.status === 'Canceled' || resData.status === 'No-Show') return;

        const resStart = startOfDay(toDate(resData.startDate) as Date);
        const resEnd = startOfDay(toDate(resData.endDate) as Date);

        // Check if this reservation overlaps with selected dates
        if (checkInStart < resEnd && checkOutEnd > resStart) {
          if (resData.rooms && Array.isArray(resData.rooms)) {
            resData.rooms.forEach((room: any) => {
              occupiedRoomIds.add(room.roomId || room.id);
            });
          }
        }
      });

      // Filter available rooms
      const available = allRooms.filter(room => !occupiedRoomIds.has(room.id));

      // Enrich with room type names and rate plan pricing
      const enrichedRooms = await Promise.all(
        available.map(async (room) => {
          try {
            // Fetch room type name
            let roomTypeName = room.roomType || 'N/A';
            if (room.roomTypeId && roomTypes.length > 0) {
              const roomType = roomTypes.find(rt => rt.id === room.roomTypeId);
              if (roomType) {
                roomTypeName = roomType.name || roomType.roomType || 'N/A';
              }
            }

            // Fetch default rate plan price
            let defaultPrice = 0;
            try {
              const ratePlanQuery = query(
                collection(db, 'ratePlans'),
                where('propertyId', '==', reservation.propertyId),
                where('isDefault', '==', true)
              );
              const ratePlanSnap = await getDocs(ratePlanQuery);
              if (ratePlanSnap.docs.length > 0) {
                const ratePlanData = ratePlanSnap.docs[0].data();
                // Look for pricing for this room type
                if (ratePlanData.pricing && typeof ratePlanData.pricing === 'object') {
                  defaultPrice = ratePlanData.pricing[room.roomTypeId] || 0;
                } else if (ratePlanData.basePrice) {
                  defaultPrice = ratePlanData.basePrice;
                }
              }
            } catch (err) {
              console.error('Error fetching rate plan:', err);
            }

            return {
              ...room,
              roomTypeName,
              defaultPrice: defaultPrice || room.basePrice || 0
            };
          } catch (err) {
            console.error('Error enriching room data:', err);
            return {
              ...room,
              roomTypeName: room.roomType || 'N/A',
              defaultPrice: room.basePrice || 0
            };
          }
        })
      );

      setAvailabilityResults(enrichedRooms);
    } catch (error) {
      console.error('Error checking availability:', error);
      toast({ title: 'Error checking availability', variant: 'destructive' });
    }
  }, [reservation, editCheckInDate, editCheckOutDate, editRoomTypeFilter, db, toast, roomTypes]);

  useEffect(() => {
    if (isEditPanelOpen && roomTypes.length === 0) {
      fetchRoomTypes();
    }
  }, [isEditPanelOpen, roomTypes.length, fetchRoomTypes]);

  useEffect(() => {
    if (isOpen && initialData?.id) {
      const resDocRef = doc(db, 'reservations', initialData.id);
      const unsub = onSnapshot(resDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setReservation({ 
              id: docSnap.id, 
              ...data, 
              startDate: (data.startDate as Timestamp).toDate(), 
              endDate: (data.endDate as Timestamp).toDate(),
              createdAt: data.createdAt ? (data.createdAt as Timestamp).toDate() : undefined,
              updatedAt: data.updatedAt ? (data.updatedAt as Timestamp).toDate() : undefined,
              actualCheckInTime: data.actualCheckInTime ? (data.actualCheckInTime as Timestamp).toDate() : undefined,
              actualCheckOutTime: data.actualCheckOutTime ? (data.actualCheckOutTime as Timestamp).toDate() : undefined,
          } as Reservation);
        }
      });
      return () => unsub();
    }
  }, [isOpen, initialData?.id]);

  useEffect(() => {
    const fetchPayments = async () => {
      if (!reservation?.id || !reservation?.propertyId) return;
      const paymentsSnap = await getDocs(
        query(
          collection(db, `properties/${reservation.propertyId}/payments`),
          where('reservationId', '==', reservation.id)
        )
      );
      setPayments(paymentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)));
    };
    fetchPayments();
  }, [reservation?.id, reservation?.propertyId]);

  useEffect(() => {
    const fetchActivities = async () => {
      if (!reservation?.id) return;
      try {
        const activitiesSnap = await getDocs(
          query(
            collection(db, `reservations/${reservation.id}/activities`),
            orderBy('timestamp', 'desc')
          )
        );
        const fetchedActivities = activitiesSnap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            timestamp: data.timestamp?.toDate?.() || new Date(data.timestamp),
            type: data.type,
            title: data.type === 'field-update' ? 'Reservation Updated' : data.title,
            details: data.type === 'field-update' ? {
              field: data.field,
              oldValue: data.oldValue,
              newValue: data.newValue
            } : data.details || {},
            description: data.type === 'field-update' 
              ? `${data.field}: changed from "${data.oldValue}" to "${data.newValue}"`
              : data.description
          };
        });
        setActivities(fetchedActivities);
      } catch (error) {
        console.error('Error fetching activities:', error);
      }
    };
    fetchActivities();
  }, [reservation?.id]);

  useEffect(() => {
    const fetchInvoice = async () => {
      if (!reservation?.id) return;
      const invoicesSnap = await getDocs(query(collection(db, 'invoices'), where('reservationId', '==', reservation.id), limit(1)));
      if (invoicesSnap.docs.length > 0) {
        setFetchedInvoice({ id: invoicesSnap.docs[0].id, ...invoicesSnap.docs[0].data() } as Invoice);
      }
    };
    fetchInvoice();
  }, [reservation?.id]);

  // Load ledger when folio changes
  useEffect(() => {
    if (selectedFolioId && reservation?.id && initialData?.propertyId && folios.length > 0) {
      loadFolioLedger(initialData.propertyId, reservation.id, selectedFolioId);
    }
  }, [selectedFolioId, reservation?.id, initialData?.propertyId, folios.length]);

  // Load folios from Firestore
  useEffect(() => {
    const loadFolios = async () => {
      if (!reservation?.id || !initialData?.propertyId) return;

      try {
        const foliosRef = collection(db, `properties/${initialData.propertyId}/reservations/${reservation.id}/folios`);
        const foliosSnap = await getDocs(foliosRef);

        if (foliosSnap.empty) {
          // Create default main-guest-folio if none exist
          setFolios([
            { id: 'main-guest-folio', name: reservation.guestName, type: 'guest' }
          ]);
          setSelectedFolioId('main-guest-folio');
        } else {
          const loadedFolios = foliosSnap.docs.map((doc) => ({
            id: doc.id,
            name: doc.data().name || doc.id,
            type: doc.data().type || doc.id
          }));
          setFolios(loadedFolios);
          
          // Set selected folio to main-guest-folio if it exists, otherwise first folio
          const mainFolio = loadedFolios.find(f => f.id === 'main-guest-folio');
          setSelectedFolioId(mainFolio?.id || loadedFolios[0]?.id || 'main-guest-folio');
        }
      } catch (error) {
        console.error("Error loading folios:", error);
        // Fallback to default folio
        setFolios([
          { id: 'main-guest-folio', name: reservation.guestName, type: 'guest' }
        ]);
        setSelectedFolioId('main-guest-folio');
      }
    };

    loadFolios();
  }, [reservation?.id, initialData?.propertyId, reservation?.guestName]);

  if (!reservation) return null;

  const nights = differenceInDays(toDate(reservation.endDate) as Date, toDate(reservation.startDate) as Date);
  const isCheckinDay = isToday(toDate(reservation.startDate) as Date);
  const isCheckoutDay = isToday(toDate(reservation.endDate) as Date);
  
  const subtotal = (reservation.roomRateTotal || 0) + (reservation.extrasTotal || 0);
  const taxAmount = reservation.taxAmount || 0;
  const discountAmount = reservation.discountAmount || 0;
  const grandTotal = reservation.totalPrice || (subtotal + taxAmount - discountAmount);
  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const amountDue = Math.max(0, grandTotal - totalPaid);
  const internalNotes = reservation.internalNotes;
  const specialRequests = reservation.specialRequests;

  const handleDownload = async () => {
    if (!fetchedInvoice) return;
    try {
      setIsProcessing(true);
      generateInvoicePdf(fetchedInvoice, reservation, propertySettings);
      toast({ title: 'Invoice downloaded successfully' });
    } catch (error) {
      console.error('Download error:', error);
      toast({ title: 'Error downloading invoice', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrint = async () => {
    if (!fetchedInvoice) return;
    try {
      setIsProcessing(true);
      const pdf = await generateInvoicePdf(fetchedInvoice, reservation, propertySettings);
      const blobUrl = pdf.output('bloburi');
      const printWindow = window.open(blobUrl.toString(), '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
      toast({ title: 'Opening print dialog' });
    } catch (error) {
      console.error('Print error:', error);
      toast({ title: 'Error printing invoice', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendInvoiceEmail = async () => {
    if (!fetchedInvoice || !reservation.guestEmail) return;
    try {
      setIsProcessing(true);
      const functions = getFunctions(app);
      const sendInvoiceEmail = httpsCallable(functions, 'sendInvoiceEmail');
      await sendInvoiceEmail({ invoiceId: fetchedInvoice.id, guestEmail: reservation.guestEmail });
      toast({ title: 'Invoice sent successfully' });
    } catch (error) {
      console.error('Email error:', error);
      toast({ title: 'Error sending invoice', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenSendEmailDialog = () => {
    setIsSendEmailModalOpen(true);
  };

  const handleCancelReservation = () => {
    setRefundDialogInfo({
      reservationId: reservation.id,
      reservation,
      shouldRefund: true,
      refundAmount: grandTotal
    });
    setIsRefundDialogOpen(true);
  };

  const handleRefundDialogConfirm = async () => {
    if (!refundDialogInfo) return;
    try {
      setIsProcessing(true);
      const resDocRef = doc(db, 'reservations', refundDialogInfo.reservationId);
      const batch = writeBatch(db);

      batch.update(resDocRef, {
        status: 'Canceled',
        updatedAt: serverTimestamp()
      });

      if (refundDialogInfo.shouldRefund && refundDialogInfo.refundAmount > 0) {
        const refundRef = doc(collection(db, 'refunds'));
        batch.set(refundRef, {
          reservationId: refundDialogInfo.reservationId,
          guestId: reservation.guestId,
          amount: refundDialogInfo.refundAmount,
          reason: 'Reservation Cancellation',
          status: 'Pending',
          createdAt: serverTimestamp()
        });
      }

      await batch.commit();
      addActivity(
        'cancellation',
        'Reservation Canceled',
        {
          refundAmount: refundDialogInfo.refundAmount,
          hasRefund: refundDialogInfo.shouldRefund,
          reason: 'Reservation Cancellation'
        },
        `Reservation canceled${refundDialogInfo.shouldRefund ? ` with refund of ${currencySymbol}${refundDialogInfo.refundAmount?.toFixed(2)}` : ' without refund'}`
      );
      toast({ title: refundDialogInfo.shouldRefund ? 'Reservation canceled with refund' : 'Reservation canceled' });
      onClose();
    } catch (error) {
      console.error('Cancel error:', error);
      toast({ title: 'Error canceling reservation', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
      setIsRefundDialogOpen(false);
      setRefundDialogInfo(null);
    }
  };

  const handlePrintReceipt = useCallback((payment: any) => {
    // Create print HTML for payment receipt
    const receiptContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Payment Receipt</title>
        <style>
          @media print {
            body { margin: 0; padding: 0; }
            .no-print { display: none; }
          }
          body {
            font-family: Arial, sans-serif;
            margin: 20px;
            padding: 0;
            background-color: #f9fafb;
          }
          .receipt {
            max-width: 600px;
            margin: 0 auto;
            background-color: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #1f2937;
            padding-bottom: 20px;
            margin-bottom: 20px;
          }
          .header h1 {
            margin: 0 0 5px 0;
            color: #1f2937;
            font-size: 24px;
          }
          .header p {
            margin: 5px 0;
            color: #6b7280;
            font-size: 12px;
          }
          .section {
            margin-bottom: 20px;
          }
          .section-title {
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 10px;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 5px;
          }
          .row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-size: 14px;
          }
          .label {
            color: #6b7280;
            font-weight: 500;
          }
          .value {
            color: #1f2937;
            font-weight: bold;
          }
          .amount {
            color: #059669;
            font-weight: bold;
            font-size: 16px;
          }
          .refund .amount {
            color: #dc2626;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 12px;
          }
          .badge {
            display: inline-block;
            padding: 4px 12px;
            background-color: #dcfce7;
            color: #166534;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            margin-top: 10px;
          }
          .badge.refund {
            background-color: #fee2e2;
            color: #991b1b;
          }
        </style>
      </head>
      <body>
        <div class="receipt ${payment.isRefund ? 'refund' : ''}">
          <div class="header">
            <h1>${payment.isRefund ? 'Refund Receipt' : 'Payment Receipt'}</h1>
            <p>Reservation #${reservation.reservationNumber || 'N/A'}</p>
          </div>
          
          <div class="section">
            <div class="row">
              <span class="label">Guest Name:</span>
              <span class="value">${reservation.guestName || 'N/A'}</span>
            </div>
            <div class="row">
              <span class="label">Property:</span>
              <span class="value">${propertySettings?.propertyName || 'N/A'}</span>
            </div>
            <div class="row">
              <span class="label">Date:</span>
              <span class="value">${payment.createdAt ? new Date(payment.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}</span>
            </div>
            <div class="row">
              <span class="label">Time:</span>
              <span class="value">${payment.createdAt ? new Date(payment.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'N/A'}</span>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Transaction Details</div>
            <div class="row">
              <span class="label">Payment Method:</span>
              <span class="value">${payment.paymentMethod || 'Not Specified'}</span>
            </div>
            <div class="row">
              <span class="label">Amount:</span>
              <span class="amount">${currencySymbol}${(payment.amountPaid || 0).toFixed(2)}</span>
            </div>
            ${payment.notes && !payment.isRefund ? `
            <div class="row">
              <span class="label">Notes:</span>
              <span class="value">${payment.notes}</span>
            </div>
            ` : ''}
            ${payment.isRefund && payment.reason ? `
            <div class="row">
              <span class="label">Reason:</span>
              <span class="value">${payment.reason}</span>
            </div>
            ` : ''}
          </div>
          
          <div class="badge ${payment.isRefund ? 'refund' : ''}">
            ${payment.isRefund ? '✓ REFUND PROCESSED' : '✓ PAYMENT RECEIVED'}
          </div>
          
          <div class="footer">
            <p>Printed on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
            <p>Thank you for your business</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Create and open print window
    const printWindow = window.open('', '', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.write(receiptContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  }, [reservation, propertySettings, currencySymbol]);

  const handleSavePayment = async (paymentData: any) => {
    if (!reservation || !reservation.propertyId) {
      toast({ title: "Error", description: "Missing reservation data", variant: "destructive" });
      return;
    }

    if (!selectedFolioId) {
      toast({ title: "Error", description: "Please select a folio", variant: "destructive" });
      return;
    }

    setIsPaymentSaving(true);
    try {
      // Prepare folio IDs and amounts
      let folioIds: string[] = [];
      let amounts: number[] = [];

      if (paymentData.allocatePayment) {
        // TODO: Implement allocation dialog to split payment across multiple folios
        // For now, use single folio
        folioIds = [selectedFolioId];
        amounts = [paymentData.amountReceived];
      } else {
        folioIds = [selectedFolioId];
        amounts = [paymentData.amountReceived];
      }

      // Call processPayment Cloud Function
      const result = await ledgerService.processPayment(
        reservation.propertyId,
        reservation.id,
        folioIds,
        amounts,
        paymentData.paymentMethod,
        paymentData.collectPayment || 'charge',
        paymentData.paymentDate,
        paymentData.creditCardToken, // Tokenized card or undefined
        paymentData.creditCardType,
        paymentData.creditCardLast4,
        paymentData.notes,
        paymentData.guestName || reservation.guestName,
        paymentData.useCurrentDate
      );

      if (!result.success) {
        throw new Error(result.error || "Failed to process payment");
      }

      // Success - update UI
      toast({
        title: "Success",
        description: result.message || "Payment processed successfully"
      });

      setIsAddPaymentModalOpen(false);

      // Reload ledger to show the new payment
      await loadFolioLedger(reservation.propertyId, reservation.id, selectedFolioId);

      // Add activity record
      const statusText = result.status === 'pre-authorized' ? 'Pre-authorized' : 'Processed';
      addActivity(
        'payment',
        `Payment ${statusText}`,
        {
          amount: paymentData.amountReceived,
          method: paymentData.paymentMethod,
          collectPayment: paymentData.collectPayment,
          date: paymentData.paymentDate,
          status: result.status,
          transactionId: result.transactionId,
          notes: paymentData.notes,
        },
        `${currencySymbol}${paymentData.amountReceived?.toFixed(2)} ${statusText} via ${paymentData.paymentMethod}`
      );
    } catch (error: any) {
      console.error("Error processing payment:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to process payment",
        variant: "destructive"
      });
    } finally {
      setIsPaymentSaving(false);
    }
  };

  const handleRefundPayment = async () => {
    if (!refundFormData.selectedPaymentId || refundFormData.refundAmount <= 0 || !reservation || !reservation.propertyId) {
      toast({ title: "Error", description: "Please fill all required fields", variant: "destructive" });
      return;
    }

    setIsPaymentSaving(true);
    try {
      const functions = getFunctions(app, 'us-central1');
      const createRefund = httpsCallable(functions, 'createRefund');

      const payload = {
        originalPaymentId: refundFormData.selectedPaymentId,
        propertyId: reservation.propertyId,
        refundAmount: refundFormData.refundAmount,
        reason: refundFormData.reason || 'No reason provided',
      };

      const result = await createRefund(payload);
      if ((result.data as any).success) {
        toast({ title: "Success", description: "Refund processed successfully" });
        setIsRefundPaymentModalOpen(false);
        
        // Use activity data from Cloud Function if available
        const activity = (result.data as any).activity;
        if (activity) {
          addActivity(
            activity.type as any,
            activity.title,
            activity.details,
            activity.description
          );
        } else {
          // Fallback to local activity creation
          addActivity(
            'refund',
            'Refund Processed',
            {
              amount: refundFormData.refundAmount,
              method: refundFormData.refundMethod,
              reason: refundFormData.reason,
              originalPaymentId: refundFormData.selectedPaymentId
            },
            `${currencySymbol}${refundFormData.refundAmount?.toFixed(2)} refunded via ${refundFormData.refundMethod} - ${refundFormData.reason || 'No reason provided'}`
          );
        }
        setRefundFormData({ selectedPaymentId: '', refundAmount: 0, reason: '', refundMethod: 'Cash' });
      } else {
        throw new Error((result.data as any).error || "Failed to process refund");
      }
    } catch (error: any) {
      console.error("Error processing refund:", error);
      toast({ title: "Error", description: error.message || "Failed to process refund", variant: "destructive" });
    } finally {
      setIsPaymentSaving(false);
    }
  };

  const handleSaveCharge = async () => {
    // Calculate amount based on charge type
    let finalAmount = chargeFormData.amount;
    
    if (chargeFormData.chargeType === 'room') {
      finalAmount = chargeFormData.nights * chargeFormData.ratePerNight;
    }

    if (finalAmount <= 0) {
      toast({ title: "Error", description: "Charge amount must be greater than 0", variant: "destructive" });
      return;
    }

    if (!chargeFormData.description.trim()) {
      toast({ title: "Error", description: "Please enter a charge description", variant: "destructive" });
      return;
    }

    if (!reservation?.id || !initialData?.propertyId) {
      toast({ title: "Error", description: "Missing reservation or property information", variant: "destructive" });
      return;
    }

    try {
      setIsSavingCharge(true);

      // Call Cloud Function to create ledger charge
      const result = await ledgerService.createCharge(
        initialData.propertyId,
        reservation.id,
        chargeFormData.folioId,
        finalAmount,
        chargeFormData.description,
        chargeFormData.category,
        {
          postingDate: chargeFormData.postingDate,
          taxStatus: chargeFormData.taxStatus,
          taxRate: chargeFormData.chargeType === 'room' ? 0 : chargeFormData.taxRate,
          referenceId: chargeFormData.referenceId || undefined,
          notes: chargeFormData.notes || undefined,
          immutable: chargeFormData.makeImmutable
        }
      );

      if (!result.success) {
        throw new Error(result.error || "Failed to create charge");
      }

      // Add activity log
      addActivity(
        'payment',
        'Charge Added',
        {
          amount: finalAmount,
          description: chargeFormData.description,
          category: chargeFormData.category,
          folioId: chargeFormData.folioId,
          entryId: result.entryId,
          chargeType: chargeFormData.chargeType,
          postingDate: chargeFormData.postingDate
        },
        `${currencySymbol}${finalAmount.toFixed(2)} charge added - ${chargeFormData.description}`
      );

      // Reload ledger entries for the folio
      await loadFolioLedger(initialData.propertyId, reservation.id, chargeFormData.folioId);

      // Reset form and close modal
      setChargeFormData({
        chargeType: '',
        guestId: '',
        category: 'Miscellaneous',
        description: '',
        amount: 0,
        quantity: 1,
        unitPrice: 0,
        postingDate: new Date().toISOString().split('T')[0],
        postingTime: new Date().toTimeString().slice(0, 5),
        taxStatus: 'taxable',
        taxRate: 10,
        taxAmount: 0,
        subtotal: 0,
        nights: 1,
        ratePerNight: 0,
        folioId: 'main-guest-folio',
        referenceId: '',
        notes: '',
        makeImmutable: false,
        voidImmediately: false,
        useCurrentDateTime: false
      });
      setIsAddChargeModalOpen(false);
      toast({ title: "Success", description: "Charge created successfully" });
    } catch (error: any) {
      console.error("Error adding charge:", error);
      toast({ title: "Error", description: error.message || "Failed to add charge", variant: "destructive" });
    } finally {
      setIsSavingCharge(false);
    }
  };

  /**
   * Load ledger entries for a specific folio
   */
  const loadFolioLedger = async (propertyId: string, reservationId: string, folioId: string) => {
    try {
      setIsLoadingLedger(true);
      const result = await ledgerService.getFolioBalance(propertyId, reservationId, folioId);
      
      if (result.success && result.entries) {
        // Filter out deleted entries and use as-is from backend
        const sanitizedEntries = result.entries
          .filter((e: LedgerEntry) => !e.deleted);
        
        setLedgerEntries(sanitizedEntries);
      } else {
        console.error("Failed to load ledger:", result.error);
      }
    } catch (error) {
      console.error("Error loading folio ledger:", error);
    } finally {
      setIsLoadingLedger(false);
    }
  };

  /**
   * Delete a ledger charge (soft delete via Cloud Function)
   */
  const handleDeleteCharge = async (entryId: string) => {
    if (!reservation?.id || !initialData?.propertyId || !selectedFolioId) {
      toast({ title: "Error", description: "Missing required information", variant: "destructive" });
      return;
    }

    try {
      // Mark entry as deleted in state for immediate UI update
      setLedgerEntries(ledgerEntries.map(e => 
        e.id === entryId ? { ...e, deleted: true } : e
      ));

      toast({ title: "Success", description: "Charge deleted" });

      // Add activity log
      addActivity(
        'payment',
        'Charge Deleted',
        { entryId },
        `Charge ${entryId} removed`
      );
    } catch (error: any) {
      console.error("Error deleting charge:", error);
      toast({ title: "Error", description: error.message || "Failed to delete charge", variant: "destructive" });
    }
  };

  return (
    <>
      {/* Background Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-[999]"
          onClick={onClose}
        />
      )}
      {/* FULL PAGE MODAL */}
      {isOpen && (
        <div 
          className="fixed inset-0 flex flex-col bg-white z-[9999] overflow-hidden"
          style={{
            top: '0',
            left: '0',
            right: '0',
            bottom: '0',
            width: '100vw',
            height: '100vh',
          }}
        >
          {/* HEADER - TOP ROW */}
          <div className="bg-white border-b border-slate-200 px-8 py-4 z-[9998] flex-shrink-0">
            {/* First Row: Guest name, Title, Status & Actions */}
            <div className="flex items-center justify-between mb-4">
              {/* Left: Guest Name */}
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900">{reservation.guestName}</h3>
              </div>
              
              {/* Center: Title */}
              <div className="flex-1 flex justify-center">
                <h2 className="text-lg font-semibold text-slate-700">Reservation Details Page</h2>
              </div>
              
              {/* Right: Status Badge, Dropdown, Actions, Close */}
              <div className="flex-1 flex justify-end items-center gap-3">
                <ReservationStatusBadge status={reservation.status} />
                
                <Select defaultValue={reservation.status || ""}>
                  <SelectTrigger className="w-40 h-9 text-sm bg-white border-slate-300">
                    <SelectValue placeholder="Select guest status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="checked-in">Checked In</SelectItem>
                    <SelectItem value="checked-out">Checked Out</SelectItem>
                  </SelectContent>
                </Select>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="default" size="sm" className="h-9 bg-blue-600 hover:bg-blue-700">
                      ACTIONS
                      <ChevronDown size={16} className="ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => setIsEditPanelOpen(true)}>
                      Edit Reservation
                    </DropdownMenuItem>
                    <DropdownMenuItem>Send Message</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-red-600">Cancel Reservation</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                <button 
                  onClick={onClose}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-slate-900 transition-colors focus:outline-none flex-shrink-0"
                >
                  <Icons.X size={24} />
                </button>
              </div>
            </div>

            {/* Second Row: Reservation Details Info */}
            <div className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 flex items-center gap-0 text-sm">
              <div className="flex-1 min-w-0 px-3 py-2">
                <p className="text-xs font-medium text-slate-500 uppercase truncate">Check-in</p>
                <p className="text-slate-900 font-semibold truncate">{formatDateSafe(reservation.checkInDate)}</p>
              </div>
              <div className="border-l border-slate-200 flex-1 min-w-0 px-3 py-2">
                <p className="text-xs font-medium text-slate-500 uppercase truncate">Check-Out</p>
                <p className="text-slate-900 font-semibold truncate">{formatDateSafe(reservation.checkOutDate)}</p>
              </div>
              <div className="border-l border-slate-200 flex-1 min-w-0 px-3 py-2">
                <p className="text-xs font-medium text-slate-500 uppercase truncate">Nights</p>
                <p className="text-slate-900 font-semibold truncate">{nights}</p>
              </div>
              <div className="border-l border-slate-200 flex-1 min-w-0 px-3 py-2">
                <p className="text-xs font-medium text-slate-500 uppercase truncate">Reservation Date</p>
                <p className="text-slate-900 font-semibold truncate">{formatDateSafe(reservation.createdAt)}</p>
              </div>
              <div className="border-l border-slate-200 flex-1 min-w-0 px-3 py-2">
                <p className="text-xs font-medium text-slate-500 uppercase truncate">Guests</p>
                <p className="text-slate-900 font-semibold truncate">{reservation.rooms ? reservation.rooms.reduce((sum, r) => sum + ((r.adults || 0) + (r.children || 0)), 0) : 0}</p>
              </div>
              <div className="border-l border-slate-200 flex-1 min-w-0 px-3 py-2">
                <p className="text-xs font-medium text-slate-500 uppercase truncate">Estimated Arrival</p>
                <p className="text-slate-900 font-semibold truncate">{reservation.estimatedArrivalTime || 'Not specified'}</p>
              </div>
              <div className="border-l border-slate-200 flex-1 min-w-0 px-3 py-2">
                <p className="text-xs font-medium text-slate-500 uppercase truncate">Source</p>
                <p className="text-slate-900 font-semibold truncate">{reservation.source || 'Direct'}</p>
              </div>
              <div className="border-l border-slate-200 flex-1 min-w-0 px-3 py-2">
                <p className="text-xs font-medium text-slate-500 uppercase truncate">Payment Type</p>
                <p className="text-slate-900 font-semibold truncate">{reservation.paymentType || 'Not set'}</p>
              </div>
              <div className="border-l border-slate-200 flex-1 min-w-0 px-3 py-2">
                <p className="text-xs font-medium text-slate-500 uppercase truncate">Rate Plan(s)</p>
                <p className="text-slate-900 font-semibold truncate">{reservation.ratePlan || 'Standard'}</p>
              </div>
              <div className="border-l border-slate-200 flex-1 min-w-0 px-3 py-2">
                <p className="text-xs font-medium text-slate-500 uppercase truncate">Balance Due</p>
                <p className="text-slate-900 font-semibold truncate">{propertySettings?.currencySymbol || '$'} {reservation.balanceDue?.toFixed(2) || '0.00'}</p>
              </div>
            </div>

            {/* Edit Reservation Button */}
            <div className="mt-4 flex justify-start">
              <Button 
                onClick={() => setIsEditPanelOpen(true)}
                className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold"
              >
                EDIT RESERVATION
              </Button>
            </div>
          </div>

          {/* TABS SECTION */}
          <Tabs defaultValue="accommodations" className="flex-1 flex flex-col overflow-hidden">
            <div className="bg-white border-b border-slate-200 px-8 flex-shrink-0">
              <TabsList className="bg-transparent border-none gap-0 rounded-none w-full justify-start h-auto p-0 overflow-x-auto">
                <TabsTrigger 
                  value="accommodations" 
                  className="rounded-none px-4 py-4 border-b-2 border-transparent data-[state=active]:border-b-primary data-[state=active]:bg-transparent data-[state=active]:text-primary text-slate-600 font-medium whitespace-nowrap flex-shrink-0"
                >
                  <BedDouble size={18} className="mr-2" />
                  Accommodations
                </TabsTrigger>
                <TabsTrigger 
                  value="guest-details" 
                  className="rounded-none px-4 py-4 border-b-2 border-transparent data-[state=active]:border-b-primary data-[state=active]:bg-transparent data-[state=active]:text-primary text-slate-600 font-medium whitespace-nowrap flex-shrink-0"
                >
                  <User size={18} className="mr-2" />
                  Guest Details
                </TabsTrigger>
                <TabsTrigger 
                  value="folio" 
                  className="rounded-none px-4 py-4 border-b-2 border-transparent data-[state=active]:border-b-primary data-[state=active]:bg-transparent data-[state=active]:text-primary text-slate-600 font-medium whitespace-nowrap flex-shrink-0"
                >
                  <CreditCard size={18} className="mr-2" />
                  Folio
                </TabsTrigger>
                <TabsTrigger 
                  value="notes" 
                  className="rounded-none px-4 py-4 border-b-2 border-transparent data-[state=active]:border-b-primary data-[state=active]:bg-transparent data-[state=active]:text-primary text-slate-600 font-medium whitespace-nowrap flex-shrink-0"
                >
                  <MessageSquare size={18} className="mr-2" />
                  Notes
                </TabsTrigger>
                <TabsTrigger 
                  value="documents" 
                  className="rounded-none px-4 py-4 border-b-2 border-transparent data-[state=active]:border-b-primary data-[state=active]:bg-transparent data-[state=active]:text-primary text-slate-600 font-medium whitespace-nowrap flex-shrink-0"
                >
                  <FileText size={18} className="mr-2" />
                  Documents
                </TabsTrigger>
                <TabsTrigger 
                  value="activity" 
                  className="rounded-none px-4 py-4 border-b-2 border-transparent data-[state=active]:border-b-primary data-[state=active]:bg-transparent data-[state=active]:text-primary text-slate-600 font-medium whitespace-nowrap flex-shrink-0"
                >
                  <Clock size={18} className="mr-2" />
                  Activity
                </TabsTrigger>
              </TabsList>
            </div>

            {/* TAB CONTENTS */}
            <div className="flex-1 overflow-y-auto px-8 py-6">
              {/* Accommodations Tab */}
              <TabsContent value="accommodations" className="m-0 space-y-2">
                {!isEditPanelOpen ? (
                  <>
                    <div className="flex justify-start">
                      <Button 
                        onClick={() => setIsEditPanelOpen(true)}
                        className="bg-primary hover:bg-primary/90 text-white"
                      >
                        Edit Reservation
                      </Button>
                    </div>
                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200">
                          <th className="px-2 py-1.5 text-left text-xs font-semibold text-slate-700 whitespace-nowrap">Res ID</th>
                          <th className="px-2 py-1.5 text-left text-xs font-semibold text-slate-700 whitespace-nowrap">Type</th>
                          <th className="px-2 py-1.5 text-left text-xs font-semibold text-slate-700 whitespace-nowrap">Assignment</th>
                          <th className="px-2 py-1.5 text-left text-xs font-semibold text-slate-700 whitespace-nowrap">Guest</th>
                          <th className="px-2 py-1.5 text-left text-xs font-semibold text-slate-700 whitespace-nowrap">Arrival - Departure</th>
                          <th className="px-2 py-1.5 text-left text-xs font-semibold text-slate-700 whitespace-nowrap">Guests</th>
                          <th className="px-2 py-1.5 text-left text-xs font-semibold text-slate-700 whitespace-nowrap">Nights</th>
                          <th className="px-2 py-1.5 text-left text-xs font-semibold text-slate-700 whitespace-nowrap">Total</th>
                          <th className="px-2 py-1.5 text-left text-xs font-semibold text-slate-700 whitespace-nowrap">Occupied</th>
                          <th className="px-2 py-1.5 text-left text-xs font-semibold text-slate-700 whitespace-nowrap">Edit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.isArray(reservation.rooms) && reservation.rooms.map((room, index) => {
                          const roomTotal = (room.roomRate || 0) * nights + (Array.isArray(room.selectedExtras) ? room.selectedExtras.reduce((sum, extra) => sum + calculateExtraItemTotal(extra).total, 0) : 0);
                          const guestCount = (room.adults || 0) + (room.children || 0);
                          return (
                            <tr key={index} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                              <td className="px-2 py-1.5 text-xs text-slate-800 font-medium whitespace-nowrap">{reservation.reservationNumber || reservation.id}</td>
                              <td className="px-2 py-1.5 text-xs text-slate-800 whitespace-nowrap">
                                {room.roomTypeName || room.roomType || "N/A"}
                              </td>
                              <td className="px-2 py-1.5 text-xs text-slate-800 whitespace-nowrap font-medium">
                                <DropdownMenu onOpenChange={(open) => {
                                  if (open) {
                                    console.log('Dropdown opening, room object:', room);
                                    console.log('Room roomTypeId:', room.roomTypeId);
                                    fetchAvailableRooms(room.roomTypeId);
                                  }
                                }}>
                                  <DropdownMenuTrigger asChild>
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="h-7"
                                    >
                                      {room.roomName || `Room ${index + 1}`}
                                      <ChevronDown size={14} className="ml-1" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="start" className="max-h-96 overflow-y-auto">
                                    {isLoadingRooms ? (
                                      <div className="px-4 py-2 text-sm text-slate-500">Loading rooms...</div>
                                    ) : availableRooms.length === 0 ? (
                                      <div className="px-4 py-2 text-sm text-slate-500">No available rooms</div>
                                    ) : (
                                      availableRooms.map((availRoom: any) => (
                                        <DropdownMenuItem 
                                          key={availRoom.id}
                                          onClick={() => handleRoomAssignment(index, availRoom)}
                                          disabled={roomAssignmentLoading[index]}
                                        >
                                          <span className="text-sm">
                                            {availRoom.name}
                                            {availRoom.id === room.roomId && ' (Current)'}
                                          </span>
                                        </DropdownMenuItem>
                                      ))
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                              <td className="px-2 py-1.5 text-xs text-slate-800">
                                <div className="whitespace-nowrap font-medium">{reservation.guestName || "N/A"}</div>
                                <div className="text-xs text-slate-500 truncate max-w-xs">{reservation.guestEmail || "N/A"}</div>
                              </td>
                              <td className="px-2 py-1.5 text-xs text-slate-800 whitespace-nowrap">
                                {format(toDate(reservation.startDate) as Date, "dd MMM")} - {format(toDate(reservation.endDate) as Date, "dd MMM")}
                              </td>
                              <td className="px-2 py-1.5 text-xs text-slate-800 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-0.5" title={`${room.adults || 0} Adult${(room.adults || 0) !== 1 ? 's' : ''}`}>
                                    <User size={14} className="text-slate-600" />
                                    <span className="text-xs font-medium text-slate-700">{room.adults || 0}</span>
                                  </div>
                                  <div className="flex items-center gap-0.5" title={`${room.children || 0} Child${(room.children || 0) !== 1 ? 'ren' : ''}`}>
                                    <Baby size={14} className="text-slate-600" />
                                    <span className="text-xs font-medium text-slate-700">{room.children || 0}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-2 py-1.5 text-xs text-slate-800 whitespace-nowrap font-medium">{nights}</td>
                              <td className="px-2 py-1.5 text-xs text-slate-800 whitespace-nowrap font-bold">{currencySymbol}{grandTotal.toFixed(2)}</td>
                              <td className="px-2 py-1.5 text-xs whitespace-nowrap">
                                <Switch 
                                  checked={!!(reservation.actualCheckInTime && !reservation.actualCheckOutTime)}
                                  disabled
                                  className="pointer-events-none"
                                />
                              </td>
                              <td className="px-4 py-3 text-sm whitespace-nowrap">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                      <Icons.MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => onEdit && onEdit(reservation)}>
                                      Edit Reservation
                                    </DropdownMenuItem>
                                    <DropdownMenuItem>
                                      View on Calendar
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-red-600">
                                      Delete Accommodation
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                  </>
                ) : (
                  <div className="flex gap-6 h-96">
                    {/* Left side - Reservation Details */}
                    <div className="w-1/3 bg-white rounded-lg border border-slate-200 p-6 overflow-y-auto space-y-6">
                      <div className="flex justify-between items-center">
                        <h2 className="text-lg font-bold text-slate-800">Reservation Details</h2>
                        <button onClick={() => setIsEditPanelOpen(false)} className="p-2 hover:bg-slate-100 rounded">
                          <Icons.X size={20} />
                        </button>
                      </div>

                      {reservation?.rooms && reservation.rooms.length > 0 && reservation.rooms.map((room, idx) => (
                        <div key={idx} className="space-y-4 pb-6 border-b border-slate-200 last:border-0">
                          <div>
                            <p className="text-sm font-semibold text-slate-600">Room Type</p>
                            <p className="text-slate-800">{room.roomTypeName || "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-600">Room</p>
                            <p className="text-slate-800">{room.roomName || "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-600">Arrival - Departure</p>
                            <p className="text-slate-800">
                              {format(toDate(reservation.startDate) as Date, "dd MMM yyyy")} - {format(toDate(reservation.endDate) as Date, "dd MMM yyyy")}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-600">Guest Name</p>
                            <p className="text-slate-800">{reservation.guestName || "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-600">Guests</p>
                            <p className="text-slate-800">{(room.adults || 0) + (room.children || 0)}</p>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-600">Nights</p>
                            <p className="text-slate-800">{differenceInDays(toDate(reservation.endDate) as Date, toDate(reservation.startDate) as Date)}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Right side - Check Availability */}
                    <div className="flex-1 bg-white rounded-lg border border-slate-200 p-6 overflow-y-auto space-y-4">
                      <h2 className="text-lg font-bold text-slate-800">Check Availability</h2>

                      <div className="flex gap-4 items-end">
                        <div className="flex-1">
                          <Label className="text-sm font-semibold text-slate-700">Check-in Date</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-start text-left">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {editCheckInDate ? format(editCheckInDate, "dd MMM yyyy") : "Select date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent align="start">
                              <CalendarPicker mode="single" selected={editCheckInDate} onSelect={setEditCheckInDate} />
                            </PopoverContent>
                          </Popover>
                        </div>

                        <div className="flex-1">
                          <Label className="text-sm font-semibold text-slate-700">Check-out Date</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-start text-left">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {editCheckOutDate ? format(editCheckOutDate, "dd MMM yyyy") : "Select date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent align="start">
                              <CalendarPicker mode="single" selected={editCheckOutDate} onSelect={setEditCheckOutDate} />
                            </PopoverContent>
                          </Popover>
                        </div>

                        <div className="flex-1">
                          <Label className="text-sm font-semibold text-slate-700">Room Type</Label>
                          <Select value={editRoomTypeFilter} onValueChange={setEditRoomTypeFilter}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Room Types</SelectItem>
                              {isLoadingRoomTypes ? (
                                <div className="p-2 text-sm text-slate-500">Loading...</div>
                              ) : (
                                roomTypes.map(type => (
                                  <SelectItem key={type.id} value={type.id}>{type.name || type.roomType}</SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>

                        <Button 
                          onClick={checkAvailability}
                          className="bg-primary hover:bg-primary/90 text-white"
                        >
                          Check Availability
                        </Button>
                      </div>

                      {availabilityResults.length > 0 && (
                        <div className="mt-6">
                          <p className="text-sm font-semibold text-slate-700 mb-4">{availabilityResults.length} Available Room(s)</p>
                          <div className="border border-slate-200 rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-slate-100 border-b border-slate-200">
                                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Type</th>
                                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Room</th>
                                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Starting from</th>
                                  <th className="px-4 py-3 text-center font-semibold text-slate-700">Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {availabilityResults.map((room, idx) => (
                                  <tr key={room.id} className={`border-b border-slate-200 ${idx === availabilityResults.length - 1 ? '' : ''} hover:bg-slate-50 transition-colors`}>
                                    <td className="px-4 py-3 text-slate-800 font-medium">
                                      {room.roomTypeName || room.roomType || 'N/A'}
                                    </td>
                                    <td className="px-4 py-3 text-slate-800 font-medium">
                                      {room.name}
                                    </td>
                                    <td className="px-4 py-3 text-slate-800">
                                      {currencySymbol}{(room.defaultPrice || 0).toFixed(2)}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleUpdateReservation(room)}
                                        disabled={roomAssignmentLoading[room.id]}
                                        className="text-slate-700 border-slate-300"
                                      >
                                        {roomAssignmentLoading[room.id] ? 'Updating...' : 'Update'}
                                      </Button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>
              {/* Guest Details Tab */}
              <TabsContent value="guest-details" className="m-0">
                {(() => {
                  // Get the selected guest for display
                  const selectedGuest = guests.find(g => g.id === selectedGuestId) || guests[0];
                  const displayGuest = isGuestDetailsEditMode ? editGuestDetails : selectedGuest;
                  return (
                    <div className="flex gap-4 h-[600px]">
                      {/* Left Sidebar - Guests List */}
                      <div className="w-1/4 bg-white rounded-lg border border-slate-200 p-2 flex flex-col">
                    <p className="text-xs font-semibold text-slate-700 mb-2">GUESTS</p>
                    
                    {/* Scrollable Guests List */}
                    <div className="overflow-y-auto space-y-1">
                      {guests.map((guest, index) => (
                        <div
                          key={guest.id}
                          onClick={() => {
                            setSelectedGuestId(guest.id);
                            setEditGuestDetails(guest);
                          }}
                          className={`p-2 rounded-lg border-2 cursor-pointer transition-all flex-shrink-0 ${
                            selectedGuestId === guest.id
                              ? 'border-primary bg-blue-50'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <p className="text-xs font-medium text-slate-800">
                            {index === 0 ? 'Main Guest' : `Guest ${index}`}
                          </p>
                          <p className="text-xs text-slate-600 mt-0.5 truncate">
                            {guest.guestName || 'No name'}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Add Guest Button */}
                    {!isGuestDetailsEditMode && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full mt-2"
                        onClick={() => {
                          const newGuestId = `guest-${guests.length}`;
                          const newGuest: GuestInfo = {
                            id: newGuestId,
                            guestName: '',
                            guestEmail: '',
                            guestPhone: '',
                            guestCountry: '',
                            guestIdType: 'passport',
                            guestPassportOrId: '',
                            guestGender: '',
                            guestBirthDate: undefined,
                            guestProfileImage: '',
                          };
                          setGuests([...guests, newGuest]);
                          setSelectedGuestId(newGuestId);
                          setEditGuestDetails(newGuest);
                          setIsGuestDetailsEditMode(true);
                        }}
                      >
                        + Add Guest
                      </Button>
                    )}
                  </div>

                  {/* Right Panel - Guest Details */}
                  <div className="w-3/4 bg-white rounded-lg border border-slate-200 p-3 flex flex-col">
                    {/* Header with Edit/Save buttons */}
                    <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-200">
                      <h3 className="text-base font-bold text-slate-800">
                        {guests.find(g => g.id === selectedGuestId)?.guestName || 'Guest Details'}
                      </h3>
                      <div className="flex gap-2">
                        {!isGuestDetailsEditMode ? (
                          <>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={handlePrintRegistrationCard}
                              className="text-slate-700"
                            >
                              Print Card
                            </Button>
                            <Button 
                              size="sm" 
                              onClick={() => setIsGuestDetailsEditMode(true)}
                              className="bg-primary hover:bg-primary/90 text-white"
                            >
                              Edit
                            </Button>
                            {selectedGuestId !== 'main-guest' && (
                              <Button 
                                size="sm" 
                                variant="destructive"
                                disabled={isGuestDetailsSaving}
                                onClick={handleDeleteGuest}
                              >
                                Delete
                              </Button>
                            )}
                          </>
                        ) : (
                          <>
                            <Button 
                              size="sm" 
                              onClick={handleSaveGuestDetails}
                              disabled={isGuestDetailsSaving}
                              className="bg-primary hover:bg-primary/90 text-white"
                            >
                              {isGuestDetailsSaving ? 'Saving...' : 'Save'}
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                setIsGuestDetailsEditMode(false);
                                const selectedGuest = guests.find(g => g.id === selectedGuestId);
                                if (selectedGuest) {
                                  setEditGuestDetails(selectedGuest);
                                }
                              }}
                            >
                              Cancel
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Guest Content - scrollable with tabs */}
                    <div className="flex-1 overflow-hidden flex flex-col">
                      {/* Tabs */}
                      <div className="flex gap-1 mb-2 border-b border-slate-200">
                        <button
                          onClick={() => setGuestDetailsTab('infos')}
                          className={`px-3 py-1 text-xs font-medium rounded-t-lg transition-all ${
                            guestDetailsTab === 'infos'
                              ? 'bg-primary text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          Guest Infos
                        </button>
                        <button
                          onClick={() => setGuestDetailsTab('notes')}
                          className={`px-3 py-1 text-xs font-medium rounded-t-lg transition-all ${
                            guestDetailsTab === 'notes'
                              ? 'bg-primary text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          Guest Notes ({editGuestDetails.notes?.length || 0})
                        </button>
                      </div>

                      {/* Tab Content - scrollable */}
                      <div className="flex-1 overflow-y-auto">
                        {guestDetailsTab === 'infos' ? (
                          <div className="flex gap-3">
                            {/* Left Side - Profile Picture */}
                            <div className="flex-shrink-0">
                    <div className="w-32 h-32 bg-slate-100 rounded-lg border-2 border-slate-300 flex items-center justify-center overflow-hidden">
                      {displayGuest.guestProfileImage ? (
                        <img 
                          src={displayGuest.guestProfileImage} 
                          alt={displayGuest.guestName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-400">
                          <User size={32} className="mb-1" />
                          <p className="text-xs font-medium">No Photo</p>
                        </div>
                      )}
                    </div>
                    {isGuestDetailsEditMode && (
                      <div className="flex flex-col gap-1 mt-2 w-32">
                        <Button 
                          size="sm"
                          variant="outline"
                          className="w-full"
                          disabled={isPhotoUploading}
                          onClick={async () => {
                            try {
                              const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                              const video = document.createElement('video');
                              video.srcObject = stream;
                              video.play();

                              // Set up a simple camera capture interface
                              const cameraWindow = window.open('', '', 'width=600,height=500');
                              if (cameraWindow) {
                                cameraWindow.document.write(`
                                  <html>
                                    <head>
                                      <title>Take Photo</title>
                                      <style>
                                        body { margin: 0; padding: 20px; font-family: Arial; background: #f0f0f0; }
                                        video { width: 100%; max-width: 500px; border: 2px solid #333; border-radius: 8px; }
                                        canvas { display: none; }
                                        button { padding: 10px 20px; margin: 10px 5px; font-size: 14px; cursor: pointer; }
                                        .container { text-align: center; }
                                      </style>
                                    </head>
                                    <body>
                                      <div class="container">
                                        <h2>Take Photo</h2>
                                        <video id="video" autoplay></video>
                                        <canvas id="canvas" width="500" height="375"></canvas>
                                        <br>
                                        <button onclick="capturePhoto()">Capture</button>
                                        <button onclick="window.close()">Cancel</button>
                                      </div>
                                      <script>
                                        let stream = null;
                                        async function initCamera() {
                                          stream = await navigator.mediaDevices.getUserMedia({ video: true });
                                          document.getElementById('video').srcObject = stream;
                                        }
                                        function capturePhoto() {
                                          const video = document.getElementById('video');
                                          const canvas = document.getElementById('canvas');
                                          const context = canvas.getContext('2d');
                                          context.drawImage(video, 0, 0, 500, 375);
                                          const imageData = canvas.toDataURL('image/jpeg');
                                          window.opener.postMessage({ type: 'photo-captured', image: imageData }, '*');
                                          stream.getTracks().forEach(track => track.stop());
                                          window.close();
                                        }
                                        initCamera();
                                      </script>
                                    </body>
                                  </html>
                                `);
                              }
                            } catch (error) {
                              console.error('Camera access denied:', error);
                              toast({
                                title: 'Camera Error',
                                description: 'Unable to access camera. Please check permissions.',
                                variant: 'destructive',
                              });
                            }
                          }}
                        >
                          {isPhotoUploading ? 'Uploading...' : 'Take Photo'}
                        </Button>
                        <input
                          type="file"
                          id="photo-upload"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                const reader = new FileReader();
                                reader.onload = async (event) => {
                                  const imageData = event.target?.result as string;
                                  const downloadURL = await uploadPhotoToStorage(imageData);
                                  if (downloadURL) {
                                    setEditGuestDetails({ ...editGuestDetails, guestProfileImage: downloadURL });
                                    toast({
                                      title: 'Photo Uploaded',
                                      description: 'Photo will be saved when you click Save.',
                                    });
                                  }
                                };
                                reader.readAsDataURL(file);
                              } catch (error) {
                                console.error('Photo upload error:', error);
                                toast({
                                  title: 'Upload Error',
                                  description: 'Failed to upload photo.',
                                  variant: 'destructive',
                                });
                              }
                            }
                          }}
                        />
                        <Button 
                          size="sm"
                          variant="outline"
                          className="w-full"
                          disabled={isPhotoUploading}
                          onClick={() => {
                            document.getElementById('photo-upload')?.click();
                          }}
                        >
                          {isPhotoUploading ? 'Uploading...' : 'Upload Photo'}
                        </Button>
                        {editGuestDetails.guestProfileImage && (
                          <Button 
                            size="sm"
                            variant="destructive"
                            className="w-full"
                            disabled={isPhotoUploading}
                            onClick={deletePhotoFromStorage}
                          >
                            {isPhotoUploading ? 'Deleting...' : 'Delete Photo'}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                            {/* Right Side - Guest Details */}
                            <div className="flex-1 space-y-2">
                    {/* Full Name */}
                    <div>
                      <Label className="text-xs font-semibold text-slate-700 mb-0.5 block">Full Name</Label>
                      {isGuestDetailsEditMode ? (
                        <input
                          type="text"
                          value={editGuestDetails.guestName}
                          onChange={(e) => setEditGuestDetails({ ...editGuestDetails, guestName: e.target.value })}
                          className="w-full px-2 py-1 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      ) : (
                        <p className="text-slate-800">{displayGuest?.guestName || "N/A"}</p>
                      )}
                    </div>

                    {/* Email */}
                    <div>
                      <Label className="text-sm font-semibold text-slate-700 mb-1 block">Email</Label>
                      {isGuestDetailsEditMode ? (
                        <input
                          type="email"
                          value={editGuestDetails.guestEmail}
                          onChange={(e) => setEditGuestDetails({ ...editGuestDetails, guestEmail: e.target.value })}
                          className="w-full px-2 py-1 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      ) : (
                        <p className="text-xs text-slate-800">{displayGuest?.guestEmail || "N/A"}</p>
                      )}
                    </div>

                    {/* Phone */}
                    <div>
                      <Label className="text-xs font-semibold text-slate-700 mb-0.5 block">Phone</Label>
                      {isGuestDetailsEditMode ? (
                        <PhoneInput
                          value={editGuestDetails.guestPhone}
                          onChange={(value) => setEditGuestDetails({ ...editGuestDetails, guestPhone: value })}
                        />
                      ) : (
                        <p className="text-xs text-slate-800">{displayGuest?.guestPhone || "N/A"}</p>
                      )}
                    </div>

                    {/* Country */}
                    <div>
                      <Label className="text-xs font-semibold text-slate-700 mb-0.5 block">Country</Label>
                      {isGuestDetailsEditMode ? (
                        <Select value={editGuestDetails.guestCountry} onValueChange={(value) => setEditGuestDetails({ ...editGuestDetails, guestCountry: value })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select country" />
                          </SelectTrigger>
                          <SelectContent className="max-h-48">
                            {countries.map(country => (
                              <SelectItem key={country.code} value={country.name}>
                                {country.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="text-xs text-slate-800">{displayGuest?.guestCountry || "N/A"}</p>
                      )}
                    </div>

                    {/* City */}
                    <div>
                      <Label className="text-xs font-semibold text-slate-700 mb-0.5 block">City</Label>
                      {isGuestDetailsEditMode ? (
                        <input
                          type="text"
                          value={editGuestDetails.guestCity}
                          onChange={(e) => setEditGuestDetails({ ...editGuestDetails, guestCity: e.target.value })}
                          className="w-full px-2 py-1 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      ) : (
                        <p className="text-xs text-slate-800">{displayGuest?.guestCity || "N/A"}</p>
                      )}
                    </div>

                    {/* ZIP Code */}
                    <div>
                      <Label className="text-xs font-semibold text-slate-700 mb-0.5 block">ZIP Code</Label>
                      {isGuestDetailsEditMode ? (
                        <input
                          type="text"
                          value={editGuestDetails.guestZipCode}
                          onChange={(e) => setEditGuestDetails({ ...editGuestDetails, guestZipCode: e.target.value })}
                          className="w-full px-2 py-1 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      ) : (
                        <p className="text-xs text-slate-800">{displayGuest?.guestZipCode || "N/A"}</p>
                      )}
                    </div>

                    {/* Address */}
                    <div>
                      <Label className="text-xs font-semibold text-slate-700 mb-0.5 block">Address</Label>
                      {isGuestDetailsEditMode ? (
                        <input
                          type="text"
                          value={editGuestDetails.guestAddress}
                          onChange={(e) => setEditGuestDetails({ ...editGuestDetails, guestAddress: e.target.value })}
                          className="w-full px-2 py-1 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      ) : (
                        <p className="text-xs text-slate-800">{displayGuest?.guestAddress || "N/A"}</p>
                      )}
                    </div>

                    {/* ID Type */}
                    <div>
                      <Label className="text-xs font-semibold text-slate-700 mb-0.5 block">ID Type</Label>
                      {isGuestDetailsEditMode ? (
                        <Select value={editGuestDetails.guestIdType} onValueChange={(value) => setEditGuestDetails({ ...editGuestDetails, guestIdType: value })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="id-card">ID Card</SelectItem>
                            <SelectItem value="eu-card">EU Card</SelectItem>
                            <SelectItem value="passport">Passport</SelectItem>
                            <SelectItem value="drivers-licence">Driver's Licence</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="text-xs text-slate-800">
                          {displayGuest.guestIdType === 'id-card' ? 'ID Card' :
                           displayGuest.guestIdType === 'eu-card' ? 'EU Card' :
                           displayGuest.guestIdType === 'passport' ? 'Passport' :
                           displayGuest.guestIdType === 'drivers-licence' ? "Driver's Licence" : 'N/A'}
                        </p>
                      )}
                    </div>

                    {/* National ID */}
                    <div>
                      <Label className="text-xs font-semibold text-slate-700 mb-0.5 block">National ID</Label>
                      {isGuestDetailsEditMode ? (
                        <input
                          type="text"
                          value={editGuestDetails.guestPassportOrId}
                          onChange={(e) => setEditGuestDetails({ ...editGuestDetails, guestPassportOrId: e.target.value })}
                          className="w-full px-2 py-1 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      ) : (
                        <p className="text-xs text-slate-800">{displayGuest?.guestPassportOrId || "N/A"}</p>
                      )}
                    </div>

                    {/* Gender */}
                    <div>
                      <Label className="text-xs font-semibold text-slate-700 mb-0.5 block">Gender</Label>
                      {isGuestDetailsEditMode ? (
                        <Select value={editGuestDetails.guestGender} onValueChange={(value) => setEditGuestDetails({ ...editGuestDetails, guestGender: value })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="text-xs text-slate-800">
                          {displayGuest.guestGender === 'male' ? 'Male' :
                           displayGuest.guestGender === 'female' ? 'Female' : 'N/A'}
                        </p>
                      )}
                    </div>

                    {/* Birth Date */}
                    <div>
                      <Label className="text-xs font-semibold text-slate-700 mb-0.5 block">Birth Date</Label>
                      {isGuestDetailsEditMode ? (
                        <div className="space-y-1">
                          <div className="grid grid-cols-3 gap-1">
                            {/* Year Selector */}
                            <div>
                              <Label className="text-xs font-medium text-slate-600 mb-0.5 block">Year</Label>
                              <Select 
                                value={editGuestDetails.guestBirthDate ? format(toDate(editGuestDetails.guestBirthDate) as Date, "yyyy") : ""}
                                onValueChange={(year) => {
                                  const currentDate = editGuestDetails.guestBirthDate ? toDate(editGuestDetails.guestBirthDate) as Date : new Date();
                                  const newDate = new Date(parseInt(year), currentDate.getMonth(), currentDate.getDate());
                                  setEditGuestDetails({ ...editGuestDetails, guestBirthDate: newDate });
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Year" />
                                </SelectTrigger>
                                <SelectContent className="max-h-48">
                                  {Array.from({ length: 124 }, (_, i) => {
                                    const year = new Date().getFullYear() - i;
                                    return (
                                      <SelectItem key={year} value={String(year)}>
                                        {year}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Month Selector */}
                            <div>
                              <Label className="text-xs font-medium text-slate-600 mb-0.5 block">Month</Label>
                              <Select 
                                value={editGuestDetails.guestBirthDate ? String(toDate(editGuestDetails.guestBirthDate)?.getMonth() + 1).padStart(2, '0') : ""}
                                onValueChange={(month) => {
                                  const currentDate = editGuestDetails.guestBirthDate ? toDate(editGuestDetails.guestBirthDate) as Date : new Date();
                                  const newDate = new Date(currentDate.getFullYear(), parseInt(month) - 1, currentDate.getDate());
                                  setEditGuestDetails({ ...editGuestDetails, guestBirthDate: newDate });
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Month" />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 12 }, (_, i) => {
                                    const month = i + 1;
                                    const monthName = new Date(2000, i, 1).toLocaleDateString('en-US', { month: 'long' });
                                    return (
                                      <SelectItem key={month} value={String(month).padStart(2, '0')}>
                                        {String(month).padStart(2, '0')} - {monthName}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Day Selector */}
                            <div>
                              <Label className="text-xs font-medium text-slate-600 mb-0.5 block">Day</Label>
                              <Select 
                                value={editGuestDetails.guestBirthDate ? String(toDate(editGuestDetails.guestBirthDate)?.getDate()).padStart(2, '0') : ""}
                                onValueChange={(day) => {
                                  const currentDate = editGuestDetails.guestBirthDate ? toDate(editGuestDetails.guestBirthDate) as Date : new Date();
                                  const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), parseInt(day));
                                  setEditGuestDetails({ ...editGuestDetails, guestBirthDate: newDate });
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Day" />
                                </SelectTrigger>
                                <SelectContent className="max-h-48">
                                  {Array.from({ length: 31 }, (_, i) => {
                                    const day = i + 1;
                                    return (
                                      <SelectItem key={day} value={String(day).padStart(2, '0')}>
                                        {String(day).padStart(2, '0')}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          {editGuestDetails.guestBirthDate && (
                            <p className="text-xs text-slate-500 mt-2">
                              Selected: {format(toDate(editGuestDetails.guestBirthDate) as Date, "EEEE, MMMM dd, yyyy")}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-800">
                          {displayGuest.guestBirthDate 
                            ? format(toDate(displayGuest.guestBirthDate) as Date, "MMMM dd, yyyy")
                            : "N/A"
                          }
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                          ) : (
                          <div className="space-y-2">
                            {isGuestDetailsEditMode && (
                              <div className="space-y-2">
                                <textarea
                                  value={noteInput}
                                  onChange={(e) => setNoteInput(e.target.value)}
                                  placeholder="Add a note..."
                                  className="w-full px-2 py-1 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary resize-none h-20"
                                />
                                <Button
                                  size="sm"
                                  onClick={handleAddNote}
                                  disabled={!noteInput.trim()}
                                  className="w-full bg-primary hover:bg-primary/90 text-white"
                                >
                                  Add Note
                                </Button>
                              </div>
                            )}

                            {/* Notes List */}
                            <div className="space-y-2 mt-3">
                              {(editGuestDetails.notes || []).length === 0 ? (
                                <p className="text-xs text-slate-500 text-center py-4">No notes yet</p>
                              ) : (
                                (editGuestDetails.notes || []).map((note) => (
                                  <div key={note.id} className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                                    <div className="flex justify-between items-start gap-2">
                                      <div className="flex-1">
                                        <p className="text-xs text-slate-800">{note.content}</p>
                                        <p className="text-xs text-slate-500 mt-1">
                                          {(() => {
                                            try {
                                              const noteDate = note.createdAt instanceof Date ? note.createdAt : new Date(note.createdAt);
                                              if (!isNaN(noteDate.getTime())) {
                                                return format(noteDate, "PPp");
                                              }
                                              return '—';
                                            } catch {
                                              return '—';
                                            }
                                          })()}
                                        </p>
                                      </div>
                                      {isGuestDetailsEditMode && (
                                        <button
                                          onClick={() => handleDeleteNote(note.id)}
                                          className="flex-shrink-0 text-slate-400 hover:text-red-600 transition-colors"
                                          title="Delete note"
                                        >
                                          <X size={16} />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                  );
                })()}
              </TabsContent>

              {/* Folio Tab */}
              <TabsContent value="folio" className="m-0">
                {(() => {
                  const selectedFolio = folios.find(f => f.id === selectedFolioId) || folios[0];
                  
                  return (
                    <div className="flex gap-4 h-[600px]">
                      {/* Left Sidebar - Folios List */}
                      <div className="w-1/4 bg-white rounded-lg border border-slate-200 p-2 flex flex-col">
                        <p className="text-xs font-semibold text-slate-700 mb-2">FOLIOS</p>
                        
                        {/* Scrollable Folios List */}
                        <div className="overflow-y-auto space-y-1 flex-1">
                          {folios.map((folio) => (
                            <div
                              key={folio.id}
                              onClick={() => setSelectedFolioId(folio.id)}
                              className={`p-2 rounded-lg border-2 cursor-pointer transition-all flex-shrink-0 ${
                                selectedFolioId === folio.id
                                  ? 'border-primary bg-blue-50'
                                  : 'border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <p className="text-xs font-medium text-slate-800">
                                {folio.type === 'guest' ? 'Main Folio' : folio.type}
                              </p>
                              <p className="text-xs text-slate-600 mt-0.5 truncate">
                                {folio.name}
                              </p>
                            </div>
                          ))}
                        </div>

                        {/* Add Folio Button */}
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full mt-2"
                          onClick={() => {
                            setNewFolioName('');
                            setIsAddFolioModalOpen(true);
                          }}
                        >
                          + Add Folio
                        </Button>
                      </div>

                      {/* Right Panel - Folio Transactions */}
                      <div className="w-3/4 bg-white rounded-lg border border-slate-200 p-3 flex flex-col">
                        {/* Header with Folio Name and Action Buttons */}
                        <div className="flex justify-between items-center mb-3 pb-3 border-b border-slate-200">
                          <h3 className="text-base font-bold text-slate-800">
                            {selectedFolio?.name || 'Folio'} {selectedFolio?.type === 'guest' && '(Main)'}
                          </h3>
                          <div className="flex gap-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2" size="sm">
                                  <Icons.PlusCircle className="h-4 w-4" />
                                  Add/Refund Payment
                                  <Icons.DropdownArrow className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                <DropdownMenuItem 
                                  onClick={() => setIsAddPaymentModalOpen(true)}
                                >
                                  <Icons.PlusCircle className="h-4 w-4 mr-2" />
                                  Add Payment
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => setIsRefundPaymentModalOpen(true)}
                                >
                                  <Icons.Undo2 className="h-4 w-4 mr-2" />
                                  Refund
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button className="bg-green-600 hover:bg-green-700 text-white gap-2" size="sm">
                                  <Icons.PlusCircle className="h-4 w-4" />
                                  Add/Adjust Charge
                                  <Icons.DropdownArrow className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                <DropdownMenuItem 
                                  onClick={() => {
                                    const mainGuest = guests.find(g => g.id === 'main-guest');
                                    setChargeMode('add');
                                    setChargeFormData({ 
                                      ...chargeFormData, 
                                      folioId: selectedFolioId,
                                      guestId: mainGuest?.id || guests[0]?.id || '',
                                      chargeType: '',
                                      makeImmutable: false,
                                      useCurrentDateTime: false
                                    });
                                    setIsAddChargeModalOpen(true);
                                  }}
                                >
                                  <Icons.PlusCircle className="h-4 w-4 mr-2" />
                                  Add Charge
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => {
                                    const mainGuest = guests.find(g => g.id === 'main-guest');
                                    setChargeMode('adjust');
                                    setChargeFormData({ 
                                      ...chargeFormData, 
                                      folioId: selectedFolioId,
                                      guestId: mainGuest?.id || guests[0]?.id || '',
                                      chargeType: '',
                                      makeImmutable: false,
                                      useCurrentDateTime: false
                                    });
                                    setIsAddChargeModalOpen(true);
                                  }}
                                >
                                  <Icons.Edit className="h-4 w-4 mr-2" />
                                  Adjust Charge
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <Button className="bg-amber-600 hover:bg-amber-700 text-white gap-2" size="sm">
                              <Icons.ArrowRight className="h-4 w-4" />
                              Move transactions
                            </Button>
                          </div>
                        </div>

                        {/* Transactions Table */}
                        <div className="flex-1 overflow-auto">
                          {isLoadingLedger ? (
                            <div className="flex items-center justify-center h-full">
                              <div className="text-center">
                                <Icons.Spinner className="h-8 w-8 animate-spin mx-auto mb-2 text-slate-400" />
                                <p className="text-xs text-slate-500">Loading transactions...</p>
                              </div>
                            </div>
                          ) : (
                            <table className="w-full text-xs border-collapse">
                              <thead className="sticky top-0 bg-slate-50">
                                <tr className="border-b border-slate-200">
                                  <th className="px-2 py-1.5 text-left text-xs font-semibold text-slate-700 whitespace-nowrap">Date</th>
                                  <th className="px-2 py-1.5 text-left text-xs font-semibold text-slate-700 whitespace-nowrap">Type</th>
                                  <th className="px-2 py-1.5 text-left text-xs font-semibold text-slate-700 whitespace-nowrap">Description</th>
                                  <th className="px-2 py-1.5 text-right text-xs font-semibold text-red-600 whitespace-nowrap">Debits</th>
                                  <th className="px-2 py-1.5 text-right text-xs font-semibold text-green-600 whitespace-nowrap">Credits</th>
                                  <th className="px-2 py-1.5 text-right text-xs font-semibold text-slate-700 whitespace-nowrap">Balance</th>
                                  <th className="px-2 py-1.5 text-left text-xs font-semibold text-slate-700 whitespace-nowrap">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(() => {
                                  if (ledgerEntries.length === 0) {
                                    return (
                                      <tr>
                                        <td colSpan={7} className="px-2 py-1.5 text-xs text-center text-slate-500">
                                          No transactions recorded
                                        </td>
                                      </tr>
                                    );
                                  }

                                  // Calculate running balance
                                  let runningBalance = 0;
                                  const sortedEntries = [...ledgerEntries].sort((a, b) => {
                                    const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
                                    const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
                                    return dateA.getTime() - dateB.getTime(); // Oldest first
                                  });
                                  return sortedEntries.map((entry, index) => {
                                    if (entry.direction === 'DEBIT') {
                                      runningBalance += entry.amount;
                                    } else {
                                      runningBalance -= entry.amount;
                                    }

                                    const isCharge = entry.type === 'CHARGE';
                                    const bgColor = isCharge ? 'bg-blue-50' : 'bg-green-50';
                                    const typeColor = isCharge ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800';
                                    
                                    // Separate debit and credit values
                                    const debitAmount = entry.direction === 'DEBIT' ? entry.amount : null;
                                    const creditAmount = entry.direction === 'CREDIT' ? entry.amount : null;

                                    return (
                                      <tr key={entry.id} className={`border-b border-slate-200 hover:bg-slate-50 transition-colors ${bgColor}`}>
                                        <td className="px-2 py-1.5 text-xs whitespace-nowrap">
                                          <div className="font-medium text-slate-800">
                                            {entry.postingDate ? entry.postingDate.split('-').reverse().join('/') : '—'}
                                          </div>
                                          <div className="text-xs text-slate-500">
                                            {(() => {
                                              try {
                                                // Firestore timestamps are now stored directly
                                                const createdAtDate = entry.createdAt instanceof Date 
                                                  ? entry.createdAt 
                                                  : new Date(entry.createdAt);
                                                
                                                if (!isNaN(createdAtDate.getTime())) {
                                                  return format(createdAtDate, "HH:mm:ss");
                                                }
                                                return '—';
                                              } catch {
                                                return '—';
                                              }
                                            })()}
                                          </div>
                                        </td>
                                        <td className="px-2 py-1.5 text-xs">
                                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeColor}`}>
                                            {entry.type}
                                          </span>
                                        </td>
                                        <td className="px-2 py-1.5 text-xs text-slate-800 max-w-xs">
                                          <div className="truncate">{entry.description}</div>
                                          {entry.category && <div className="text-xs text-slate-500">{entry.category}</div>}
                                        </td>
                                        <td className="px-2 py-1.5 text-xs font-bold whitespace-nowrap text-right text-red-600">
                                          {debitAmount ? `${currencySymbol}${debitAmount.toFixed(2)}` : '-'}
                                        </td>
                                        <td className="px-2 py-1.5 text-xs font-bold whitespace-nowrap text-right text-green-600">
                                          {creditAmount ? `${currencySymbol}${creditAmount.toFixed(2)}` : '-'}
                                        </td>
                                        <td className="px-2 py-1.5 text-xs font-bold text-slate-800 whitespace-nowrap text-right">
                                          {currencySymbol}{runningBalance.toFixed(2)}
                                        </td>
                                        <td className="px-2 py-1.5 text-xs whitespace-nowrap">
                                          <div className="flex gap-1">
                                            {isCharge && !entry.deleted && (
                                              <>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    // Ensure all required data is available
                                                    if (!initialData?.propertyId || !initialData?.id || !selectedFolioId) {
                                                      toast({
                                                        title: "Error",
                                                        description: "Missing required reservation data. Please refresh and try again.",
                                                        variant: "destructive",
                                                      });
                                                      return;
                                                    }
                                                    setSelectedEntryForSplit(entry);
                                                    setIsSplitModalOpen(true);
                                                  }}
                                                  className="text-blue-500 hover:text-blue-700 transition-colors cursor-pointer"
                                                  title="Split transaction"
                                                >
                                                  <Icons.ArrowRight className="h-4 w-4" />
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setSelectedEntryForMove(entry);
                                                    setIsMoveModalOpen(true);
                                                  }}
                                                  className="text-purple-500 hover:text-purple-700 transition-colors cursor-pointer"
                                                  title="Move transaction"
                                                >
                                                  <Icons.ArrowRight className="h-4 w-4 rotate-180" />
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setSelectedEntryForVoid(entry);
                                                    setIsVoidModalOpen(true);
                                                  }}
                                                  className="text-amber-500 hover:text-amber-700 transition-colors cursor-pointer"
                                                  title="Void transaction"
                                                >
                                                  <Icons.X className="h-4 w-4" />
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => handleDeleteCharge(entry.id)}
                                                  className="text-red-500 hover:text-red-700 transition-colors cursor-pointer"
                                                  title="Delete charge"
                                                >
                                                  <Icons.Trash className="h-4 w-4" />
                                                </button>
                                              </>
                                            )}
                                            {entry.deleted && (
                                              <span className="text-xs text-slate-400 italic">Voided/Moved</span>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  });
                                })()}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </TabsContent>

              {/* Notes Tab */}
              <TabsContent value="notes" className="m-0 space-y-4">
                <h3 className="text-lg font-bold text-slate-800">Notes & Requests</h3>
                {internalNotes && (
                  <div className="bg-white rounded-lg border border-slate-200 p-6">
                    <h4 className="font-semibold text-slate-700 mb-2">Internal Notes</h4>
                    <p className="text-slate-600 whitespace-pre-wrap">{internalNotes}</p>
                  </div>
                )}
                {specialRequests && (
                  <div className="bg-white rounded-lg border border-slate-200 p-6">
                    <h4 className="font-semibold text-slate-700 mb-2">Special Requests</h4>
                    <p className="text-slate-600 whitespace-pre-wrap">{specialRequests}</p>
                  </div>
                )}
                {!internalNotes && !specialRequests && (
                  <p className="text-slate-500">No notes or requests</p>
                )}
              </TabsContent>

              {/* Documents Tab */}
              <TabsContent value="documents" className="m-0">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Documents</h3>
                {fetchedInvoice ? (
                  <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <FileText size={20} className="text-slate-600 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-slate-800 truncate">{fetchedInvoice.invoiceNumber}</p>
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-medium rounded whitespace-nowrap flex-shrink-0">Invoice</span>
                            </div>
                            <p className="text-xs text-slate-600">
                              {fetchedInvoice.guestOrCompany} • {fetchedInvoice.dateIssued} • {propertySettings?.currencySymbol || '$'}{fetchedInvoice.amount.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                      <Badge variant={
                        fetchedInvoice.paymentStatus === 'Paid' ? 'default' :
                        fetchedInvoice.paymentStatus === 'Pending' ? 'secondary' :
                        fetchedInvoice.paymentStatus === 'Overdue' ? 'destructive' :
                        'outline'
                      } className="ml-4 flex-shrink-0">
                        {fetchedInvoice.paymentStatus}
                      </Badge>
                      <div className="flex gap-2 ml-4 flex-shrink-0">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-slate-600 hover:text-slate-900"
                        >
                          View
                        </Button>
                        <Button 
                          variant="ghost"
                          size="sm"
                          onClick={handlePrint}
                          disabled={isProcessing}
                          className="text-slate-600 hover:text-slate-900"
                          title="Print invoice"
                        >
                          <Icons.Printer size={16} className="mr-1" />
                          Print
                        </Button>
                        <Button 
                          variant="ghost"
                          size="sm"
                          onClick={handleDownload}
                          disabled={isProcessing}
                          className="text-slate-600 hover:text-slate-900"
                        >
                          <FileText size={16} className="mr-1" />
                          Download
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 rounded-lg border border-slate-200 p-8 text-center">
                    <FileText size={32} className="mx-auto text-slate-400 mb-3" />
                    <p className="text-slate-600">No invoice available for this reservation yet</p>
                  </div>
                )}
              </TabsContent>

              {/* Activity Tab */}
              <TabsContent value="activity" className="m-0 space-y-4">
                <h3 className="text-lg font-bold text-slate-800">Activity Log</h3>
                <div className="space-y-2">
                  {/* Display custom activities combined with system events */}
                  {activities.length > 0 || reservation.actualCheckInTime || reservation.actualCheckOutTime || reservation.createdAt ? (
                    <div className="space-y-3">
                      {(() => {
                        // Build system events
                        const systemEvents: any[] = [];
                        
                        if (reservation.createdAt) {
                          systemEvents.push({
                            id: 'created',
                            timestamp: reservation.createdAt,
                            type: 'creation',
                            title: 'Reservation Created',
                            description: 'Reservation created in the system',
                            details: {}
                          });
                        }
                        
                        if (reservation.actualCheckInTime) {
                          systemEvents.push({
                            id: 'check-in',
                            timestamp: reservation.actualCheckInTime,
                            type: 'check-in',
                            title: 'Checked In',
                            description: 'Guest checked in to the property',
                            details: {}
                          });
                        }
                        
                        if (reservation.actualCheckOutTime) {
                          systemEvents.push({
                            id: 'check-out',
                            timestamp: reservation.actualCheckOutTime,
                            type: 'check-out',
                            title: 'Checked Out',
                            description: 'Guest checked out from the property',
                            details: {}
                          });
                        }
                        
                        // Combine and sort all events by timestamp (most recent first)
                        const allEvents = [...activities, ...systemEvents];
                        const sortedEvents = allEvents.sort((a, b) => {
                          const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : (a.timestamp?.toDate?.()?.getTime?.() || 0);
                          const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : (b.timestamp?.toDate?.()?.getTime?.() || 0);
                          return timeB - timeA; // Most recent first
                        });
                        
                        return sortedEvents;
                      })().map((activity) => {
                        let iconColor = 'text-slate-600';
                        let bgColor = 'bg-slate-100';
                        
                        switch (activity.type) {
                          case 'payment':
                            iconColor = 'text-green-600';
                            bgColor = 'bg-green-100';
                            break;
                          case 'refund':
                            iconColor = 'text-red-600';
                            bgColor = 'bg-red-100';
                            break;
                          case 'cancellation':
                            iconColor = 'text-red-700';
                            bgColor = 'bg-red-100';
                            break;
                          case 'check-in':
                            iconColor = 'text-green-600';
                            bgColor = 'bg-green-100';
                            break;
                          case 'check-out':
                            iconColor = 'text-blue-600';
                            bgColor = 'bg-blue-100';
                            break;
                          case 'room-assignment':
                            iconColor = 'text-purple-600';
                            bgColor = 'bg-purple-100';
                            break;
                          case 'guest-add':
                          case 'guest-update':
                            iconColor = 'text-indigo-600';
                            bgColor = 'bg-indigo-100';
                            break;
                          case 'note-add':
                            iconColor = 'text-yellow-600';
                            bgColor = 'bg-yellow-100';
                            break;
                          case 'status-change':
                            iconColor = 'text-orange-600';
                            bgColor = 'bg-orange-100';
                            break;
                        }

                        return (
                          <div key={activity.id} className="border border-slate-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow">
                            <div className="p-4">
                              <div className="flex gap-3">
                                <div className={`${bgColor} ${iconColor} w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold`}>
                                  {activity.type === 'payment' && '💳'}
                                  {activity.type === 'refund' && '↩️'}
                                  {activity.type === 'cancellation' && '❌'}
                                  {activity.type === 'check-in' && '✓'}
                                  {activity.type === 'check-out' && '🚪'}
                                  {activity.type === 'room-assignment' && '🏠'}
                                  {(activity.type === 'guest-add' || activity.type === 'guest-update') && '👤'}
                                  {activity.type === 'note-add' && '📝'}
                                  {activity.type === 'status-change' && '⚙️'}
                                  {activity.type === 'creation' && '✨'}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-slate-800 text-sm">{activity.title}</div>
                                  <div className="text-xs text-slate-600 mt-1">{activity.description}</div>
                                </div>
                              </div>
                              
                              {/* Display field-by-field changes */}
                              {Object.keys(activity.details).length > 0 && (
                                <div className="mt-3 pt-3 border-t border-slate-200">
                                  {Object.entries(activity.details).map(([key, value]: [string, any]) => {
                                    // Check if this is an edit action that should show before/after
                                    const isEditAction = activity.type === 'guest-update' || activity.type === 'room-assignment';
                                    // Check if value has oldValue/newValue structure
                                    const hasOldNewStructure = typeof value === 'object' && value !== null && (value.oldValue !== undefined || value.newValue !== undefined);
                                    
                                    if (isEditAction && hasOldNewStructure) {
                                      // Show before → after for edit actions
                                      return (
                                        <div key={key} className="flex items-center justify-between py-2 text-xs">
                                          <span className="font-medium text-slate-700 min-w-fit">{key}:</span>
                                          <div className="flex-1 ml-3 flex items-center gap-2 text-right">
                                            <span className="text-slate-600 bg-red-50 px-2 py-1 rounded border border-red-200">
                                              {convertTimestampToString(value.oldValue)}
                                            </span>
                                            <span className="text-slate-400">→</span>
                                            <span className="text-slate-600 bg-green-50 px-2 py-1 rounded border border-green-200">
                                              {convertTimestampToString(value.newValue)}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    } else {
                                      // Show just the value for creation/addition actions
                                      return (
                                        <div key={key} className="flex items-center justify-between py-2 text-xs">
                                          <span className="font-medium text-slate-700 min-w-fit">{key}:</span>
                                          <span className="text-slate-600 bg-blue-50 px-2 py-1 rounded border border-blue-200">
                                            {convertTimestampToString(value)}
                                          </span>
                                        </div>
                                      );
                                    }
                                  })}
                                </div>
                              )}
                              
                              <div className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-200">
                                {(() => {
                                  try {
                                    const activityDate = activity.timestamp instanceof Date ? activity.timestamp : new Date(activity.timestamp);
                                    if (!isNaN(activityDate.getTime())) {
                                      return format(activityDate, "PPp", { locale });
                                    }
                                    return '—';
                                  } catch {
                                    return '—';
                                  }
                                })()}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-600 text-center py-4">
                      No activity yet
                    </div>
                  )}
                </div>
              </TabsContent>
            </div>
          </Tabs>

          {/* FOOTER */}
          <div className="bg-white border-t border-slate-200 px-8 py-4 flex flex-wrap justify-between items-center gap-3 flex-shrink-0">
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleDownload} 
                disabled={isProcessing || !fetchedInvoice}
              >
                <Icons.Download className="mr-2 h-4 w-4" />
                Download
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={isProcessing}>
                    <Icons.Mail className="mr-2 h-4 w-4" /> 
                    Email 
                    <Icons.DropdownArrow className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={handleSendInvoiceEmail} disabled={!fetchedInvoice || !reservation.guestEmail}>
                    <Icons.FilePlus2 className="mr-2 h-4 w-4" /> Invoice
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleOpenSendEmailDialog} disabled={!reservation.guestEmail}>
                    <Icons.Mail className="mr-2 h-4 w-4" /> Other
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex flex-wrap gap-2">
              {onCheckIn && canManage && isCheckinDay && reservation.status === 'Confirmed' && !reservation.actualCheckInTime && (
                <Button 
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => onCheckIn(reservation.id)}
                >
                  <Icons.LogIn className="mr-2 h-4 w-4" /> Check In
                </Button>
              )}
              {onCheckOut && canManage && isCheckoutDay && reservation.status === 'Checked-in' && !reservation.actualCheckOutTime && (
                <Button 
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => onCheckOut(reservation)}
                >
                  <Icons.LogOut className="mr-2 h-4 w-4" /> Check Out
                </Button>
              )}
              {canManage && onEdit && (
                <Button 
                  size="sm"
                  variant="outline" 
                  onClick={() => { if (onEdit) { onEdit(reservation); } onClose(); }}
                >
                  <Icons.Edit className="mr-2 h-4 w-4" /> Edit
                </Button>
              )}
              {canManage && reservation.status !== 'Canceled' && reservation.status !== 'Completed' && (
                <Button 
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={handleCancelReservation}
                >
                  <Icons.X className="mr-2 h-4 w-4" /> Cancel
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={onClose}>Close</Button>
            </div>
          </div>
        </div>
      )}
      
      {isSendEmailModalOpen && reservation && (
        <SendEmailDialog
          isOpen={isSendEmailModalOpen}
          onClose={() => setIsSendEmailModalOpen(false)}
          reservation={reservation}
          propertySettings={propertySettings}
        />
      )}

      {/* Refund Dialog */}
      <AlertDialog open={isRefundDialogOpen} onOpenChange={setIsRefundDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancellation & Refund</AlertDialogTitle>
            <AlertDialogDescription>
              Guest: {refundDialogInfo?.reservation.guestName}
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 my-4">
            <div className="bg-slate-50 p-4 rounded-lg space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-medium">Total:</span>
                <span className="text-lg font-bold">{currencySymbol}{refundDialogInfo?.reservation.totalPrice?.toFixed(2)}</span>
              </div>
              
              <div className="border-t pt-3">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={refundDialogInfo?.shouldRefund ?? true}
                    onChange={(e) => {
                      if (refundDialogInfo) {
                        setRefundDialogInfo({
                          ...refundDialogInfo,
                          shouldRefund: e.target.checked,
                          refundAmount: e.target.checked ? refundDialogInfo.reservation.totalPrice || 0 : 0
                        });
                      }
                    }}
                    className="w-4 h-4"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Issue Refund</p>
                    <p className="text-xs text-slate-600">
                      {refundDialogInfo?.shouldRefund 
                        ? "Guest will receive a refund"
                        : "Guest will not receive a refund"
                      }
                    </p>
                  </div>
                </label>
              </div>

              {refundDialogInfo?.shouldRefund && (
                <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-3">
                  <label className="block text-sm font-medium mb-2 text-slate-700">
                    Refund Amount
                  </label>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">{currencySymbol}</span>
                    <input
                      type="number"
                      min="0"
                      max={refundDialogInfo?.reservation.totalPrice || 0}
                      step="0.01"
                      value={refundDialogInfo?.refundAmount.toFixed(2)}
                      onChange={(e) => {
                        if (refundDialogInfo) {
                          const amount = Math.min(Math.max(0, parseFloat(e.target.value) || 0), refundDialogInfo.reservation.totalPrice || 0);
                          setRefundDialogInfo({
                            ...refundDialogInfo,
                            refundAmount: amount
                          });
                        }
                      }}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <p className="text-xs text-slate-600 mt-2">
                    Max: {currencySymbol}{refundDialogInfo?.reservation.totalPrice?.toFixed(2)}
                  </p>
                </div>
              )}

              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mt-3">
                <p className="text-sm text-yellow-800">
                  <strong>Payment Status:</strong> {refundDialogInfo?.reservation.paymentStatus}
                </p>
              </div>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setIsRefundDialogOpen(false);
              setRefundDialogInfo(null);
            }}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRefundDialogConfirm} 
              disabled={isProcessing}
              className={refundDialogInfo?.shouldRefund ? "bg-orange-600 hover:bg-orange-700" : "bg-red-600 hover:bg-red-700"}
            >
              {isProcessing && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
              {refundDialogInfo?.shouldRefund ? "Confirm & Refund" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!viewFullPaymentNote} onOpenChange={() => setViewFullPaymentNote(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Payment Note</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="bg-slate-50 p-4 rounded border border-slate-200 max-h-96 overflow-y-auto">
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{viewFullPaymentNote}</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Payment Modal */}
      <Dialog open={isAddPaymentModalOpen} onOpenChange={setIsAddPaymentModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Payment</DialogTitle>
            <DialogDescription>
              Record a payment for {reservation?.guestName}
            </DialogDescription>
          </DialogHeader>
          {reservation && (
            <PaymentForm
              propertyId={reservation.propertyId}
              onClose={() => setIsAddPaymentModalOpen(false)}
              onSave={handleSavePayment}
              isSaving={isPaymentSaving}
              balanceDue={(() => {
                let remaining = reservation.totalPrice || 0;
                const totalPaid = payments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
                remaining = remaining - totalPaid;
                return remaining;
              })()}
              currencySymbol={currencySymbol}
              folios={folios}
              initialData={{
                amountReceived: (() => {
                  let remaining = reservation.totalPrice || 0;
                  const totalPaid = payments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
                  remaining = Math.max(0, remaining - totalPaid);
                  return remaining;
                })(),
                guestName: reservation.guestName,
                reservationNumber: reservation.reservationNumber,
                paymentDate: new Date().toISOString().split('T')[0],
                paymentMethod: 'Cash',
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Refund Payment Modal */}
      <Dialog open={isRefundPaymentModalOpen} onOpenChange={setIsRefundPaymentModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Refund Payment</DialogTitle>
            <DialogDescription>
              Process a refund for {reservation?.guestName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Select Payment */}
            <div>
              <Label htmlFor="payment-select" className="text-sm font-medium text-slate-700">
                Select Payment to Refund
              </Label>
              <Select 
                value={refundFormData.selectedPaymentId} 
                onValueChange={(value) => {
                  const selected = payments.find(p => p.id === value);
                  setRefundFormData({
                    ...refundFormData,
                    selectedPaymentId: value,
                    refundAmount: selected?.amountPaid || 0
                  });
                }}
              >
                <SelectTrigger id="payment-select" className="mt-1">
                  <SelectValue placeholder="Choose a payment" />
                </SelectTrigger>
                <SelectContent>
                  {payments.map((payment) => (
                    <SelectItem key={payment.id} value={payment.id}>
                      {format(toDate(payment.createdAt), "dd/MM/yy")} - {currencySymbol}{payment.amountPaid?.toFixed(2)} ({payment.paymentMethod})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Refund Amount */}
            <div>
              <Label htmlFor="refund-amount" className="text-sm font-medium text-slate-700">
                Refund Amount
              </Label>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-slate-700">{currencySymbol}</span>
                <input
                  id="refund-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={refundFormData.refundAmount}
                  onChange={(e) => {
                    const selected = payments.find(p => p.id === refundFormData.selectedPaymentId);
                    const maxAmount = selected?.amountPaid || 0;
                    const amount = Math.min(Math.max(0, parseFloat(e.target.value) || 0), maxAmount);
                    setRefundFormData({
                      ...refundFormData,
                      refundAmount: amount
                    });
                  }}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {refundFormData.selectedPaymentId && (
                <p className="text-xs text-slate-600 mt-1">
                  Max: {currencySymbol}{payments.find(p => p.id === refundFormData.selectedPaymentId)?.amountPaid?.toFixed(2)}
                </p>
              )}
            </div>

            {/* Reason */}
            <div>
              <Label htmlFor="refund-reason" className="text-sm font-medium text-slate-700">
                Reason (Optional)
              </Label>
              <textarea
                id="refund-reason"
                value={refundFormData.reason}
                onChange={(e) => setRefundFormData({ ...refundFormData, reason: e.target.value })}
                placeholder="Enter refund reason..."
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
              />
            </div>

            {/* Refund Method */}
            <div>
              <Label htmlFor="refund-method" className="text-sm font-medium text-slate-700">
                Refund Method
              </Label>
              <Select 
                value={refundFormData.refundMethod} 
                onValueChange={(value) => setRefundFormData({ ...refundFormData, refundMethod: value })}
              >
                <SelectTrigger id="refund-method" className="mt-1">
                  <SelectValue placeholder="Select refund method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Card">Card</SelectItem>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  <SelectItem value="Check">Check</SelectItem>
                  <SelectItem value="Mobile Payment">Mobile Payment</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 justify-end pt-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsRefundPaymentModalOpen(false);
                  setRefundFormData({ selectedPaymentId: '', refundAmount: 0, reason: '', refundMethod: 'Cash' });
                }}
                disabled={isPaymentSaving}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleRefundPayment}
                disabled={isPaymentSaving || !refundFormData.selectedPaymentId || refundFormData.refundAmount <= 0}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isPaymentSaving && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
                Process Refund
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Charge Modal */}
      <Dialog open={isAddChargeModalOpen} onOpenChange={setIsAddChargeModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Charge to Folio</DialogTitle>
            <DialogDescription className="text-xs">
              Create a new charge for {reservation?.guestName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">

            {/* ROW 1: ASSIGN TO GUEST & SELECT FOLIO */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="guest-assign" className="text-xs font-medium text-slate-700">Assign Charge To</Label>
                <Select 
                  value={chargeFormData.guestId || ''}
                  onValueChange={(value) => setChargeFormData({ ...chargeFormData, guestId: value })}
                >
                  <SelectTrigger id="guest-assign" className="mt-0.5 h-8 text-xs">
                    <SelectValue placeholder="Select guest" />
                  </SelectTrigger>
                  <SelectContent>
                    {guests.map((guest) => (
                      <SelectItem key={guest.id} value={guest.id}>
                        {guest.guestName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="charge-folio" className="text-xs font-medium text-slate-700">Select Folio</Label>
                <Select 
                  value={chargeFormData.folioId || ''}
                  onValueChange={(value) => setChargeFormData({ ...chargeFormData, folioId: value })}
                >
                  <SelectTrigger id="charge-folio" className="mt-0.5 h-8 text-xs">
                    <SelectValue placeholder="Select folio" />
                  </SelectTrigger>
                  <SelectContent>
                    {folios.map((folio) => (
                      <SelectItem key={folio.id} value={folio.id}>
                        {folio.type === 'guest' ? `Main - ${folio.name}` : folio.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* CHARGE TYPE */}
            <div>
              <Label htmlFor="charge-type" className="text-xs font-medium text-slate-700">Charge Type</Label>
              <Select 
                value={chargeFormData.chargeType || ''}
                onValueChange={(value) => setChargeFormData({ ...chargeFormData, chargeType: value as any })}
              >
                <SelectTrigger id="charge-type" className="mt-0.5 h-8 text-xs">
                  <SelectValue placeholder="Select Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="room">🏨 Room Accommodation</SelectItem>
                  <SelectItem value="extra">✨ Extra Service</SelectItem>
                  <SelectItem value="food">🍽️ Food & Beverage</SelectItem>
                  <SelectItem value="misc">📋 Miscellaneous</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* DESCRIPTION */}
            <div>
              <Label htmlFor="charge-description" className="text-xs font-medium text-slate-700">
                Description <span className="text-red-600">*</span>
              </Label>
              <Input
                id="charge-description"
                value={chargeFormData.description}
                onChange={(e) => setChargeFormData({ ...chargeFormData, description: e.target.value })}
                placeholder="e.g., Mini bar, Room service, Laundry"
                maxLength={255}
                className="mt-0.5 text-xs h-8"
              />
              <div className="text-xs text-slate-500 mt-0.5">{chargeFormData.description.length}/255</div>
            </div>

            {/* SIMPLE AMOUNT - DEFAULT VIEW */}
            <div>
              <Label htmlFor="charge-amount" className="text-xs font-medium text-slate-700">
                Amount <span className="text-red-600">*</span>
              </Label>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-slate-700 text-xs font-medium">{currencySymbol}</span>
                <Input
                  id="charge-amount"
                  type="number"
                  value={chargeFormData.amount || ''}
                  onChange={(e) => setChargeFormData({ ...chargeFormData, amount: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                  className="flex-1 text-xs h-8"
                />
              </div>
            </div>

            {/* ADVANCED PRICING TOGGLE */}
            <div className="flex items-center gap-2 p-2 bg-slate-50 rounded border border-slate-200">
              <Checkbox
                id="use-qty-price"
                checked={showAdvancedPricing}
                onCheckedChange={(checked) => setShowAdvancedPricing(checked as boolean)}
              />
              <Label htmlFor="use-qty-price" className="text-xs font-medium text-slate-700 cursor-pointer flex-1">
                Use Quantity × Unit Price
              </Label>
            </div>

            {/* QUANTITY × UNIT PRICE (Only if toggled) */}
            {showAdvancedPricing && (
              <div className="bg-blue-50 p-2 rounded border border-blue-200 space-y-2">
                <div className="flex gap-1">
                  <div className="flex-1">
                    <Label htmlFor="quantity" className="text-xs text-slate-600">Qty</Label>
                    <Input
                      id="quantity"
                      type="number"
                      value={chargeFormData.quantity || 1}
                      onChange={(e) => {
                        const qty = parseInt(e.target.value) || 1;
                        const newAmount = qty * chargeFormData.unitPrice;
                        setChargeFormData({ 
                          ...chargeFormData, 
                          quantity: qty,
                          amount: newAmount
                        });
                      }}
                      min="1"
                      step="1"
                      className="mt-0.5 text-xs h-7"
                      placeholder="1"
                    />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="unit-price" className="text-xs text-slate-600">Unit Price</Label>
                    <div className="flex items-center gap-0.5 mt-0.5">
                      <span className="text-slate-700 text-xs">{currencySymbol}</span>
                      <Input
                        id="unit-price"
                        type="number"
                        value={chargeFormData.unitPrice || 0}
                        onChange={(e) => {
                          const price = parseFloat(e.target.value) || 0;
                          const newAmount = chargeFormData.quantity * price;
                          setChargeFormData({ 
                            ...chargeFormData, 
                            unitPrice: price,
                            amount: newAmount
                          });
                        }}
                        placeholder="0.00"
                        min="0.01"
                        step="0.01"
                        className="flex-1 text-xs h-7"
                      />
                    </div>
                  </div>
                </div>
                <div className="bg-white p-1 rounded text-xs border border-blue-300">
                  <div className="text-slate-600">Calculated Total: <span className="font-semibold text-slate-900">{currencySymbol}{chargeFormData.amount.toFixed(2)}</span></div>
                </div>
              </div>
            )}

            {/* TAXES/FEES TOGGLE */}
            <div className="flex items-center gap-2 p-2 bg-slate-50 rounded border border-slate-200">
              <Checkbox
                id="add-taxes"
                checked={showTaxes}
                onCheckedChange={(checked) => setShowTaxes(checked as boolean)}
              />
              <Label htmlFor="add-taxes" className="text-xs font-medium text-slate-700 cursor-pointer flex-1">
                Add Taxes/Fees
              </Label>
            </div>

            {/* TAXES/FEES FIELDS (Only if toggled) */}
            {showTaxes && (
              <div className="bg-orange-50 p-2 rounded border border-orange-200 space-y-2">
                <div className="flex gap-1">
                  <div className="flex-1">
                    <Label htmlFor="tax-percent" className="text-xs text-slate-600">Tax Rate %</Label>
                    <Input
                      id="tax-percent"
                      type="number"
                      value={chargeFormData.taxRate || 0}
                      onChange={(e) => {
                        const rate = parseFloat(e.target.value) || 0;
                        const taxAmount = (chargeFormData.amount * rate) / 100;
                        setChargeFormData({ 
                          ...chargeFormData, 
                          taxRate: rate,
                          taxAmount
                        });
                      }}
                      placeholder="10"
                      min="0"
                      max="100"
                      step="0.01"
                      className="mt-0.5 text-xs h-7"
                    />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="tax-amount" className="text-xs text-slate-600">Tax Amount</Label>
                    <div className="flex items-center gap-0.5 mt-0.5">
                      <span className="text-slate-700 text-xs">{currencySymbol}</span>
                      <Input
                        id="tax-amount"
                        type="number"
                        value={chargeFormData.taxAmount || 0}
                        onChange={(e) => setChargeFormData({ ...chargeFormData, taxAmount: parseFloat(e.target.value) || 0 })}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        className="flex-1 text-xs h-7"
                      />
                    </div>
                  </div>
                </div>
                <div className="bg-white p-1 rounded text-xs border border-orange-300">
                  <div className="text-slate-600">Total with tax: <span className="font-bold text-orange-700">{currencySymbol}{(chargeFormData.amount + chargeFormData.taxAmount).toFixed(2)}</span></div>
                </div>
              </div>
            )}

            {/* ROW 3: DATE & TIME */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="use-current-dt"
                  checked={chargeFormData.useCurrentDateTime}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      const now = new Date();
                      setChargeFormData({ 
                        ...chargeFormData,
                        useCurrentDateTime: true,
                        postingDate: now.toISOString().split('T')[0],
                        postingTime: now.toTimeString().slice(0, 5)
                      });
                    } else {
                      setChargeFormData({ ...chargeFormData, useCurrentDateTime: false });
                    }
                  }}
                />
                <Label htmlFor="use-current-dt" className="text-xs font-medium text-slate-700 cursor-pointer">Use Current Date & Time</Label>
              </div>
              
              {!chargeFormData.useCurrentDateTime && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="posting-date" className="text-xs font-medium text-slate-700">Date</Label>
                  <Input
                    id="posting-date"
                    type="date"
                    value={chargeFormData.postingDate || ''}
                    onChange={(e) => setChargeFormData({ ...chargeFormData, postingDate: e.target.value })}
                    className="mt-0.5 text-xs h-8"
                  />
                </div>
                <div>
                  <Label htmlFor="posting-time" className="text-xs font-medium text-slate-700">Time</Label>
                  <Input
                    id="posting-time"
                    type="time"
                    value={chargeFormData.postingTime || ''}
                    onChange={(e) => setChargeFormData({ ...chargeFormData, postingTime: e.target.value })}
                    className="mt-0.5 text-xs h-8"
                  />
                </div>
              </div>
              )}
            </div>

            {/* NOTES */}
            <div>
              <Label htmlFor="notes" className="text-xs font-medium text-slate-700">Notes</Label>
              <textarea
                id="notes"
                value={chargeFormData.notes}
                onChange={(e) => setChargeFormData({ ...chargeFormData, notes: e.target.value })}
                placeholder="Staff notes..."
                rows={2}
                maxLength={500}
                className="mt-0.5 w-full px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* FLAGS */}
            <div className="flex gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={chargeFormData.makeImmutable}
                      onCheckedChange={(checked) => setChargeFormData({ ...chargeFormData, makeImmutable: checked as boolean })}
                    />
                    <span className="text-xs text-slate-700">Make Immutable</span>
                    <HelpCircle className="w-3 h-3 text-slate-400 hover:text-slate-600" />
                  </label>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  Prevent editing after creation (recommended for room charges)
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={chargeFormData.voidImmediately}
                      onCheckedChange={(checked) => setChargeFormData({ ...chargeFormData, voidImmediately: checked as boolean })}
                    />
                    <span className="text-xs text-slate-700">Void Immediately</span>
                    <HelpCircle className="w-3 h-3 text-slate-400 hover:text-slate-600" />
                  </label>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  Create but mark as void (for error corrections)
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsAddChargeModalOpen(false)}
              size="sm"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveCharge}
              disabled={isSavingCharge || !chargeFormData.description || chargeFormData.amount <= 0}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSavingCharge ? 'Creating...' : 'Create Charge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print Card Date Dialog */}
      <Dialog open={isPrintCardDateDialogOpen} onOpenChange={setIsPrintCardDateDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Select Date for Registration Card</DialogTitle>
            <DialogDescription>
              Choose the date to print on the registration card
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <input
                  type="radio"
                  id="today"
                  name="date-option"
                  value="today"
                  defaultChecked
                  onChange={() => setPrintCardDate(new Date())}
                  className="w-4 h-4"
                />
                <label htmlFor="today" className="flex-1 cursor-pointer">
                  <div className="font-medium text-sm">Today's Date (Default)</div>
                  <div className="text-xs text-slate-500">{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                </label>
              </div>
              
              <div className="flex items-center gap-4">
                <input
                  type="radio"
                  id="custom"
                  name="date-option"
                  value="custom"
                  onChange={() => {}}
                  className="w-4 h-4"
                />
                <label htmlFor="custom" className="flex-1 cursor-pointer">
                  <div className="font-medium text-sm">Custom Date</div>
                  <input
                    type="date"
                    value={printCardDate.toISOString().split('T')[0]}
                    onChange={(e) => {
                      setPrintCardDate(new Date(e.target.value + 'T00:00:00'));
                      document.getElementById('custom')?.click?.();
                    }}
                    className="mt-1 w-full px-2 py-1 border border-slate-300 rounded text-xs"
                  />
                </label>
              </div>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setIsPrintCardDateDialogOpen(false)}
              disabled={isPrintCardLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                setIsPrintCardLoading(true);
                try {
                  // Pre-load the property logo image to ensure it's ready
                  if (propertySettings?.bookingPageSettings?.logoUrl) {
                    await new Promise((resolve) => {
                      const img = new Image();
                      img.onload = resolve;
                      img.onerror = resolve; // Resolve even on error to not block printing
                      img.src = propertySettings.bookingPageSettings.logoUrl as string;
                    });
                  }
                  
                  // Brief delay to ensure all assets are ready
                  await new Promise(resolve => setTimeout(resolve, 300));
                  
                  // Generate and print
                  generateAndPrintRegistrationCard(printCardDate);
                  setIsPrintCardDateDialogOpen(false);
                } finally {
                  setIsPrintCardLoading(false);
                }
              }}
              disabled={isPrintCardLoading}
            >
              {isPrintCardLoading && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
              {isPrintCardLoading ? 'Loading...' : 'Generate & Print'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Split Transaction Modal */}
      <SplitTransactionModal
        isOpen={isSplitModalOpen}
        onClose={() => {
          setIsSplitModalOpen(false);
          setSelectedEntryForSplit(null);
        }}
        onSuccess={() => {
          // Refresh ledger after successful split
          if (selectedFolioId && reservation?.id && propertySettings?.id) {
            loadFolioLedger(propertySettings.id, reservation.id, selectedFolioId);
          }
        }}
        entry={selectedEntryForSplit}
        folios={folios}
        originalFolioId={selectedFolioId}
        propertyId={initialData?.propertyId || ''}
        reservationId={initialData?.id || ''}
      />

      {/* Void Transaction Modal */}
      <VoidTransactionModal
        isOpen={isVoidModalOpen}
        onClose={() => {
          setIsVoidModalOpen(false);
          setSelectedEntryForVoid(null);
        }}
        onSuccess={() => {
          // Refresh ledger after successful void
          if (selectedFolioId && initialData?.id && initialData?.propertyId) {
            loadFolioLedger(initialData.propertyId, initialData.id, selectedFolioId);
          }
        }}
        entry={selectedEntryForVoid}
        propertyId={initialData?.propertyId || ''}
        reservationId={initialData?.id || ''}
        folioId={selectedFolioId}
        currencySymbol={currencySymbol}
      />

      {/* Move Transaction Modal */}
      <MoveTransactionModal
        isOpen={isMoveModalOpen}
        onClose={() => {
          setIsMoveModalOpen(false);
          setSelectedEntryForMove(null);
        }}
        onSuccess={() => {
          // Refresh ledger after successful move
          if (selectedFolioId && initialData?.id && initialData?.propertyId) {
            loadFolioLedger(initialData.propertyId, initialData.id, selectedFolioId);
          }
        }}
        entry={selectedEntryForMove}
        folios={folios}
        currentFolioId={selectedFolioId}
        propertyId={initialData?.propertyId || ''}
        reservationId={initialData?.id || ''}
        currencySymbol={currencySymbol}
      />

      {/* Add Folio Modal */}
      <Dialog open={isAddFolioModalOpen} onOpenChange={setIsAddFolioModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Folio</DialogTitle>
            <DialogDescription>
              Enter a name for the new folio
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="folio-name" className="text-sm font-medium text-slate-700">
                Folio Name <span className="text-red-600">*</span>
              </Label>
              <Input
                id="folio-name"
                value={newFolioName}
                onChange={(e) => setNewFolioName(e.target.value)}
                placeholder="e.g., Bar, Restaurant, Spa, Parking"
                className="mt-1 text-sm"
                autoFocus
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsAddFolioModalOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={async () => {
                if (!newFolioName.trim()) {
                  toast({ title: "Error", description: "Please enter a folio name", variant: "destructive" });
                  return;
                }

                if (!reservation?.id || !initialData?.propertyId) {
                  toast({ title: "Error", description: "Missing reservation or property information", variant: "destructive" });
                  return;
                }

                try {
                  setIsCreatingFolio(true);
                  
                  // Create folio ID from name (lowercase, hyphenated)
                  const newFolioId = newFolioName.toLowerCase().replace(/\s+/g, '-');
                  
                  // Check if folio already exists
                  const existingFolio = folios.find(f => f.id.toLowerCase() === newFolioId.toLowerCase());
                  if (existingFolio) {
                    toast({ title: "Error", description: "A folio with this name already exists", variant: "destructive" });
                    return;
                  }

                  // Create in Firestore with setDoc
                  const folioRef = doc(db, `properties/${initialData.propertyId}/reservations/${reservation.id}/folios`, newFolioId);
                  await setDoc(folioRef, {
                    id: newFolioId,
                    name: newFolioName.trim(),
                    type: newFolioId,
                    createdAt: serverTimestamp(),
                  });
                  
                  // Update local state
                  setFolios([
                    ...folios,
                    {
                      id: newFolioId,
                      name: newFolioName.trim(),
                      type: newFolioId
                    }
                  ]);
                  setSelectedFolioId(newFolioId);
                  
                  toast({ title: "Success", description: `Folio "${newFolioName.trim()}" created`, variant: "default" });
                  setIsAddFolioModalOpen(false);
                  setNewFolioName('');
                } catch (error: any) {
                  console.error("Error creating folio:", error);
                  toast({ title: "Error", description: error.message || "Failed to create folio", variant: "destructive" });
                } finally {
                  setIsCreatingFolio(false);
                }
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={isCreatingFolio || !newFolioName.trim()}
            >
              {isCreatingFolio ? "Creating..." : "Create Folio"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
