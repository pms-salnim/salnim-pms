
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Icons } from "@/components/icons";
import type { Guest, GuestTag } from '@/types/guest';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Phone, Globe, CalendarDays as CalendarIcon, Star, User as UserIcon, Heart, MessageSquare, FileText, TrendingUp, DollarSign, MessageCircle, ChevronDown } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import type { LoyaltyHistoryEntry, LoyaltyTier } from '@/types/loyalty';
import { getLoyaltyTier, defaultLoyaltyTiers } from '@/types/loyalty';
import { useTranslation } from 'react-i18next';
import type { Reservation } from '@/types/reservation';
import { countries } from '@/lib/countries';
import ReservationStatusBadge from '@/components/reservations/reservation-status-badge';
import { toast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from '@/contexts/auth-context';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteDoc } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { sendGuestMessage, deleteGuest, updateGuestNotes, updateGuestPreferences } from '@/lib/guestHelpers';
import ReservationDetailModal from '@/components/reservations/reservation-detail-modal';


interface GuestProfileProps {
  guest: Guest;
  allReservations: Reservation[];
  onGuestDeleted?: () => void;
  onReservationCreated?: (guestEmail: string, reservations: Reservation[]) => void;
}

const formatDateField = (dateField?: string | Date | Timestamp): string => {
    if (!dateField) return "N/A";
    if (typeof dateField === 'string') {
      try { return format(parseISO(dateField), 'PPP'); } catch { return dateField; }
    }
    if (dateField instanceof Date) {
      return format(dateField, 'PPP');
    }
    if (typeof (dateField as Timestamp).toDate === 'function') {
        return format((dateField as Timestamp).toDate(), 'PPP');
    }
    return 'N/A';
};


export default function GuestProfile({ guest, allReservations, onGuestDeleted, onReservationCreated }: GuestProfileProps) {
  const { property, user } = useAuth();
  const { t } = useTranslation('pages/guests/all/content');
  const initial = guest.fullName?.charAt(0).toUpperCase() || "G";
  const [syncedGuest, setSyncedGuest] = useState<Guest>(guest);
  const [loyaltyHistory, setLoyaltyHistory] = useState<LoyaltyHistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [internalNotes, setInternalNotes] = useState(guest.internalNotes || '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  const [loyaltyCurrentPage, setLoyaltyCurrentPage] = useState(1);
  const [loyaltyItemsPerPage, setLoyaltyItemsPerPage] = useState(10);

  // Reservation details modal state
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [isReservationDetailsOpen, setIsReservationDetailsOpen] = useState(false);

  // Dialog states for action buttons
  const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  
  const [isAddNoteDialogOpen, setIsAddNoteDialogOpen] = useState(false);
  const [quickNote, setQuickNote] = useState('');
  const [isSavingQuickNote, setIsSavingQuickNote] = useState(false);
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeletingGuest, setIsDeletingGuest] = useState(false);
  
  const [roomPreferences, setRoomPreferences] = useState(guest.roomPreferences || '');
  const [dietaryRestrictions, setDietaryRestrictions] = useState(guest.dietaryRestrictions || '');
  const [specialOccasion, setSpecialOccasion] = useState(guest.specialOccasion || '');
  const [communicationPreference, setCommunicationPreference] = useState(guest.communicationPreference || '');
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);

  // Personal Information states
  const [fullName, setFullName] = useState(guest.fullName || '');
  const [email, setEmail] = useState(guest.email || '');
  const [phone, setPhone] = useState(guest.phone || '');
  const [nationality, setNationality] = useState(guest.nationality || guest.country || '');
  const [country, setCountry] = useState(guest.nationality || guest.country || '');
  const [gender, setGender] = useState(guest.gender || '');
  const [passportOrId, setPassportOrId] = useState(guest.passportOrId || '');
  const [phoneCode, setPhoneCode] = useState(() => {
    if (!country) return '';
    const countryData = countries.find(c => c.name === country);
    return countryData?.phone || '';
  });
  const [isSavingPersonalInfo, setIsSavingPersonalInfo] = useState(false);
  const [isEditingPersonal, setIsEditingPersonal] = useState(false);

  // Loyalty Points Adjustment
  const [adjustmentPoints, setAdjustmentPoints] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [isAdjustingPoints, setIsAdjustingPoints] = useState(false);

  const customTiers = property?.loyaltyProgramSettings?.tiers || defaultLoyaltyTiers;
  const guestTier = useMemo(
    () => getLoyaltyTier(syncedGuest.totalPointsEarned || 0, customTiers),
    [syncedGuest.totalPointsEarned, customTiers]
  );
  
  const guestReservations = useMemo(() => {
    if (!allReservations || !syncedGuest) return [];
    return allReservations.filter(res => {
      // Match by guestId (primary)
      if (res.guestId === syncedGuest.id) return true;
      // Match by email (fallback)
      if (res.guestEmail && syncedGuest.email && res.guestEmail.toLowerCase() === syncedGuest.email.toLowerCase()) return true;
      // Match by guestName if email isn't available
      if (res.guestName && syncedGuest.fullName && res.guestName.toLowerCase() === syncedGuest.fullName.toLowerCase()) return true;
      return false;
    });
  }, [allReservations, guest]);

  const guestStats = useMemo(() => {
    // Include all reservations for financial metrics, not just completed ones
    const relevantReservations = guestReservations.filter(r => r.status !== 'cancelled');
    const totalSpent = relevantReservations.reduce((sum, r) => sum + (r.totalPrice || 0), 0);
    const totalNights = relevantReservations.reduce((sum, r) => {
      const start = r.startDate instanceof Date ? r.startDate : new Date(r.startDate);
      const end = r.endDate instanceof Date ? r.endDate : new Date(r.endDate);
      const nights = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      return sum + nights;
    }, 0);
    
    return {
      totalVisits: relevantReservations.length,
      totalSpent,
      totalNights,
      avgSpentPerStay: relevantReservations.length > 0 ? totalSpent / relevantReservations.length : 0,
      avgNightsPerStay: relevantReservations.length > 0 ? totalNights / relevantReservations.length : 0,
    };
  }, [guestReservations]);

  const paginatedReservations = useMemo(() => {
    if (!guestReservations) return [];
    const startIndex = (currentPage - 1) * itemsPerPage;
    return guestReservations.slice(startIndex, startIndex + itemsPerPage);
  }, [guestReservations, currentPage, itemsPerPage]);

  const totalPages = Math.ceil((guestReservations || []).length / itemsPerPage);

  const paginatedLoyaltyHistory = useMemo(() => {
    const startIndex = (loyaltyCurrentPage - 1) * loyaltyItemsPerPage;
    return loyaltyHistory.slice(startIndex, startIndex + loyaltyItemsPerPage);
  }, [loyaltyHistory, loyaltyCurrentPage, loyaltyItemsPerPage]);

  const totalLoyaltyPages = Math.ceil(loyaltyHistory.length / loyaltyItemsPerPage);

  useEffect(() => {
    if (syncedGuest.loyaltyStatus === 'enrolled' && syncedGuest.id) {
        setIsLoadingHistory(true);
        const historyQuery = query(
            collection(db, "guests", syncedGuest.id, "loyaltyHistory"),
            orderBy("date", "desc")
        );
        const unsubHistory = onSnapshot(historyQuery, (snapshot) => {
            setLoyaltyHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LoyaltyHistoryEntry)));
            setIsLoadingHistory(false);
        }, (error) => {
            console.error("Error fetching loyalty history:", error);
            setIsLoadingHistory(false);
        });
        return () => unsubHistory();
    }
  }, [syncedGuest.id, syncedGuest.loyaltyStatus]);

  // Real-time sync of guest data to keep loyalty points and tier always up-to-date
  useEffect(() => {
    if (!syncedGuest.id) return;
    
    const guestRef = doc(db, "guests", syncedGuest.id);
    const unsubGuest = onSnapshot(guestRef, (snapshot) => {
      if (snapshot.exists()) {
        setSyncedGuest({ id: snapshot.id, ...snapshot.data() } as Guest);
      }
    }, (error) => {
      console.error("Error syncing guest data:", error);
    });
    
    return () => unsubGuest();
  }, [syncedGuest.id]);
  
  const handleAdjustLoyaltyPoints = async () => {
    if (!syncedGuest.id || !adjustmentPoints) {
      toast({ title: 'Error', description: 'Please enter a points amount', variant: "destructive" });
      return;
    }
    
    setIsAdjustingPoints(true);
    try {
      const points = parseFloat(adjustmentPoints);
      if (isNaN(points) || points === 0) {
        toast({ title: 'Error', description: 'Enter a valid points amount', variant: "destructive" });
        setIsAdjustingPoints(false);
        return;
      }

      // Call the cloud function to adjust loyalty points
      const adjustLoyaltyPointsFunction = httpsCallable(functions, 'adjustLoyaltyPoints');
      const response = await adjustLoyaltyPointsFunction({
        guestId: syncedGuest.id,
        propertyId: property?.id,
        pointsChange: points,
        reason: adjustmentReason,
      });

      const result = response.data as { success: boolean; message: string };
      
      if (result.success) {
        toast({ 
          title: 'Success', 
          description: result.message
        });

        // Reset form
        setAdjustmentPoints('');
        setAdjustmentReason('');
      } else {
        throw new Error('Adjustment failed');
      }
    } catch (error) {
      console.error('Error adjusting points:', error);
      const errorMessage = (error as any)?.message || 'Failed to adjust points';
      toast({ title: 'Error', description: errorMessage, variant: "destructive" });
    } finally {
      setIsAdjustingPoints(false);
    }
  };

  const handleResetPointsForm = () => {
    setAdjustmentPoints('');
    setAdjustmentReason('');
  };
  
  const handleSaveNotes = async () => {
    if (!syncedGuest.id) return;
    setIsSavingNotes(true);
    try {
      await updateGuestNotes(syncedGuest.id, internalNotes);
      toast({ title: 'Success', description: 'Notes saved successfully' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save notes', variant: "destructive" });
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !guest.email || !property?.id) return;
    setIsSendingMessage(true);
    try {
      await sendGuestMessage({
        guestId: guest.id,
        guestEmail: guest.email,
        guestName: guest.fullName,
        message: messageText,
        propertyId: property.id,
        messageType: 'email'
      });
      
      toast({ title: 'Success', description: 'Message sent successfully' });
      setMessageText('');
      setIsMessageDialogOpen(false);
    } catch (error) {
      console.error('Error sending message:', error);
      toast({ title: 'Error', description: 'Failed to send message', variant: "destructive" });
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleSaveQuickNote = async () => {
    if (!guest.id) return;
    setIsSavingQuickNote(true);
    try {
      const timestamp = new Date().toLocaleString();
      const newNote = `[${timestamp}] ${quickNote}`;
      const updatedNotes = internalNotes ? `${internalNotes}\n\n${newNote}` : newNote;
      
      await updateGuestNotes(guest.id, updatedNotes);
      
      setInternalNotes(updatedNotes);
      toast({ title: 'Success', description: 'Note added successfully' });
      setQuickNote('');
      setIsAddNoteDialogOpen(false);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to add note', variant: "destructive" });
    } finally {
      setIsSavingQuickNote(false);
    }
  };

  const handleDeleteGuest = async () => {
    if (!syncedGuest.id) return;
    setIsDeletingGuest(true);
    try {
      await deleteGuest(syncedGuest.id);
      
      toast({ title: 'Success', description: 'Guest deleted successfully' });
      setIsDeleteDialogOpen(false);
      onGuestDeleted?.();
    } catch (error) {
      console.error('Error deleting guest:', error);
      toast({ title: 'Error', description: 'Failed to delete guest', variant: "destructive" });
    } finally {
      setIsDeletingGuest(false);
    }
  };

  const handleSavePreferences = async () => {
    if (!guest.id) return;
    setIsSavingPreferences(true);
    try {
      await updateGuestPreferences({
        guestId: guest.id,
        roomPreferences,
        dietaryRestrictions,
        specialOccasion,
        communicationPreference
      });
      
      toast({ title: 'Success', description: 'Preferences saved successfully' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save preferences', variant: "destructive" });
    } finally {
      setIsSavingPreferences(false);
    }
  };

  // Contact dropdown handlers
  const handleGuestPortal = () => {
    // Navigate to guest portal for this guest
    const guestPortalUrl = `/guest-portal/${property?.slug}?email=${encodeURIComponent(guest.email)}`;
    window.open(guestPortalUrl, '_blank');
  };

  const handleWhatsApp = () => {
    if (guest.phone) {
      // Format phone number for WhatsApp (remove spaces, dashes, etc.)
      const phoneNumber = guest.phone.replace(/\D/g, '');
      const message = `Hello ${guest.fullName}, we'd like to get in touch with you regarding your reservation.`;
      const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
    } else {
      toast({ title: 'Error', description: 'No phone number available for WhatsApp', variant: "destructive" });
    }
  };

  const handleCall = () => {
    if (guest.phone) {
      window.location.href = `tel:${guest.phone}`;
    } else {
      toast({ title: 'Error', description: 'No phone number available', variant: "destructive" });
    }
  };

  const handleSavePersonalInfo = async () => {
    if (!syncedGuest.id) return;
    setIsSavingPersonalInfo(true);
    try {
      await updateGuestPreferences({
        guestId: guest.id,
      });
      
      // Update via separate function for personal info fields
      const guestRef = doc(db, "guests", syncedGuest.id);
      await updateDoc(guestRef, {
        fullName,
        email,
        phone,
        phoneCode,
        country,
        gender,
        passportOrId,
        updatedAt: serverTimestamp()
      });
      
      toast({ title: 'Success', description: 'Personal information saved successfully' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save personal information', variant: "destructive" });
    } finally {
      setIsSavingPersonalInfo(false);
    }
  };

  return (
    <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-2">
      {/* Profile Header */}
      <section className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-100">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Avatar className="h-24 w-24 text-2xl border-2 border-blue-200 shadow-md">
            <AvatarImage src={`https://avatar.vercel.sh/${syncedGuest.email}.png`} alt={syncedGuest.fullName} />
            <AvatarFallback className="bg-blue-100 text-blue-700">{initial}</AvatarFallback>
          </Avatar>
          
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-bold text-slate-900">{syncedGuest.fullName}</h2>
              {syncedGuest.loyaltyStatus === 'enrolled' && (
                <Badge className={`${guestTier.colorClass} text-white`}>
                  <Star className="mr-1 h-3 w-3" />
                  {guestTier.name}
                </Badge>
              )}
              {guestReservations.length >= 5 && (
                <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700">
                  <Heart className="mr-1 h-3 w-3" />
                  Loyal Guest
                </Badge>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-sm">
              <p className="text-slate-700 flex items-center">
                <Mail className="h-4 w-4 mr-1.5 text-blue-600" />
                <a href={'mailto:' + syncedGuest.email} className="text-blue-600 hover:underline">
                  {syncedGuest.email || "N/A"}
                </a>
              </p>
              <p className="text-slate-700 flex items-center">
                <Phone className="h-4 w-4 mr-1.5 text-blue-600" />
                <a href={'tel:' + syncedGuest.phone} className="text-blue-600 hover:underline">
                  {syncedGuest.phone || "Not provided"}
                </a>
              </p>
              <p className="text-slate-700 flex items-center">
                <Globe className="h-4 w-4 mr-1.5 text-cyan-600" />
                {syncedGuest.nationality || syncedGuest.country || "Not specified"}
              </p>
              <p className="text-slate-700 flex items-center">
                <UserIcon className="h-4 w-4 mr-1.5 text-emerald-600" />
                {syncedGuest.passportOrId || "Not provided"}
              </p>
            </div>
          </div>

          <div className="sm:ml-auto flex flex-col gap-3">
            <div className="bg-white rounded-lg p-3 border border-slate-200">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{guestStats.totalVisits}</p>
                <p className="text-xs text-slate-500 font-medium">Total Visits</p>
              </div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-slate-200">
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-600">${guestStats.totalSpent.toFixed(0)}</p>
                <p className="text-xs text-slate-500 font-medium">Total Spent</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Tabs defaultValue="personal" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="personal" className="text-xs">Personal</TabsTrigger>
          <TabsTrigger value="history" className="text-xs">History</TabsTrigger>
          <TabsTrigger value="financial" className="text-xs">Financial</TabsTrigger>
          <TabsTrigger value="loyalty" className="text-xs">Loyalty</TabsTrigger>
          <TabsTrigger value="notes" className="text-xs">Notes</TabsTrigger>
          <TabsTrigger value="preferences" className="text-xs">Preferences</TabsTrigger>
        </TabsList>

        {/* Personal Information Tab */}
        <TabsContent value="personal" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserIcon className="h-5 w-5 text-blue-600" />
                Personal Information
              </CardTitle>
              <CardDescription>Guest personal details and identification</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditingPersonal ? (
                // Edit Mode
                <>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Full Name</p>
                      <Input 
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Enter full name"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Email</p>
                      <Input 
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter email"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Phone Number</p>
                      <div className="flex gap-2 items-center">
                        <Select value={country} onValueChange={(value) => {
                          setCountry(value);
                          const countryData = countries.find(c => c.name === value);
                          const newPhoneCode = countryData?.phone || '';
                          setPhoneCode(newPhoneCode);
                          // Auto-prepend country code to phone field
                          setPhone(`+${newPhoneCode} `);
                        }}>
                          <SelectTrigger className="w-24 flex-shrink-0">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent className="max-h-60">
                            {countries.map((c) => (
                              <SelectItem key={c.code} value={c.name}>
                                {c.code} (+{c.phone})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input 
                          value={phone}
                          onChange={(e) => {
                            // If phone code exists, ensure the number starts with +code
                            const value = e.target.value;
                            if (phoneCode && !value.startsWith(`+${phoneCode}`)) {
                              // If user clears it or types something else, reset with code prefix
                              if (value.trim() === '' || !value.startsWith('+')) {
                                setPhone(`+${phoneCode} `);
                              } else {
                                setPhone(value);
                              }
                            } else {
                              setPhone(value);
                            }
                          }}
                          placeholder="+X XXX XXXX XXXX"
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Country</p>
                      <Select value={country} onValueChange={(value) => {
                        setCountry(value);
                        const countryData = countries.find(c => c.name === value);
                        const newPhoneCode = countryData?.phone || '';
                        setPhoneCode(newPhoneCode);
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {countries.map((c) => (
                            <SelectItem key={c.code} value={c.name}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Gender</p>
                      <Select value={gender} onValueChange={setGender}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                          <SelectItem value="Not specified">Not specified</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Passport/ID</p>
                      <Input 
                        value={passportOrId}
                        onChange={(e) => setPassportOrId(e.target.value)}
                        placeholder="Enter passport or ID number"
                      />
                    </div>
                  </div>

                  {guest.tags && guest.tags.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-slate-200">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Tags</p>
                      <div className="flex flex-wrap gap-2">
                        {guest.tags.map(tag => <GuestTagDisplay key={tag.id} tag={tag} />)}
                      </div>
                    </div>
                  )}

                  <div className="mt-6 pt-6 border-t border-slate-200 flex gap-2 justify-end">
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setIsEditingPersonal(false);
                        // Reset form to original values
                        setFullName(guest.fullName || '');
                        setEmail(guest.email || '');
                        setPhone(guest.phone || '');
                        setCountry(guest.nationality || guest.country || '');
                        setGender(guest.gender || '');
                        setPassportOrId(guest.passportOrId || '');
                      }}
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleSavePersonalInfo} 
                      disabled={isSavingPersonalInfo}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {isSavingPersonalInfo && <Icons.Spinner className="h-4 w-4 mr-2 animate-spin"/>}
                      Save Changes
                    </Button>
                  </div>
                </>
              ) : (
                // Read Mode
                <>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Full Name</p>
                      <p className="text-sm text-slate-800 font-medium">{fullName || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Email</p>
                      <p className="text-sm text-slate-800 font-medium">{email || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Phone Number</p>
                      <p className="text-sm text-slate-800 font-medium">{phone || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Country</p>
                      <p className="text-sm text-slate-800 font-medium">{country || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Gender</p>
                      <p className="text-sm text-slate-800 font-medium">{gender || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Passport/ID</p>
                      <p className="text-sm text-slate-800 font-medium">{passportOrId || 'N/A'}</p>
                    </div>
                  </div>

                  {guest.tags && guest.tags.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-slate-200">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Tags</p>
                      <div className="flex flex-wrap gap-2">
                        {guest.tags.map(tag => <GuestTagDisplay key={tag.id} tag={tag} />)}
                      </div>
                    </div>
                  )}

                  <div className="mt-6 pt-6 border-t border-slate-200 flex justify-end">
                    <button 
                      onClick={() => setIsEditingPersonal(true)}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reservation History Tab */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-blue-600" />
                Reservation History
              </CardTitle>
              <CardDescription>Complete list of all stays and reservations</CardDescription>
            </CardHeader>
            <CardContent>
              {guestReservations && guestReservations.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Res No.</TableHead>
                      <TableHead>Check-in</TableHead>
                      <TableHead>Check-out</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                     {(paginatedReservations || []).map(res => (
                        <TableRow 
                          key={res.id}
                          onClick={() => {
                            setSelectedReservation(res);
                            setIsReservationDetailsOpen(true);
                          }}
                          className="cursor-pointer hover:bg-blue-50 transition-colors"
                        >
                            <TableCell className="font-mono text-xs text-slate-600">{res.reservationNumber || res.id.substring(0,8)}</TableCell>
                            <TableCell className="text-sm">{format(res.startDate, 'MMM dd, yyyy')}</TableCell>
                            <TableCell className="text-sm">{format(res.endDate, 'MMM dd, yyyy')}</TableCell>
                            <TableCell className="text-sm">{res.rooms?.[0]?.roomName || 'N/A'}</TableCell>
                            <TableCell className="font-semibold text-emerald-600">${(res.totalPrice || 0).toFixed(2)}</TableCell>
                            <TableCell><ReservationStatusBadge status={res.status} /></TableCell>
                        </TableRow>
                     ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No reservation history</p>
              )}
            </CardContent>
            {totalPages > 1 && (
                <CardFooter className="flex items-center justify-end space-x-6 p-4 border-t">
                    <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium">Rows per page</p>
                        <Select
                            value={`${itemsPerPage}`}
                            onValueChange={(value) => {
                                setItemsPerPage(Number(value));
                                setCurrentPage(1);
                            }}
                        >
                            <SelectTrigger className="h-8 w-[70px]">
                                <SelectValue placeholder={`${itemsPerPage}`} />
                            </SelectTrigger>
                            <SelectContent side="top">
                                {[10, 25, 50].map((pageSize) => (
                                    <SelectItem key={pageSize} value={`${pageSize}`}>{pageSize}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <span className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages}
                    </span>
                    <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>Next</Button>
                    </div>
                </CardFooter>
            )}
          </Card>
        </TabsContent>

        {/* Financial Tab */}
        <TabsContent value="financial" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-emerald-500">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Spent</p>
                  <h3 className="text-2xl font-bold mt-1 text-slate-800">${guestStats.totalSpent.toFixed(2)}</h3>
                </div>
                <div className="p-2 rounded-lg bg-emerald-50">
                  <DollarSign size={18} className="text-emerald-600" />
                </div>
              </div>
              <div className="mt-2">
                <span className="text-[10px] font-medium text-emerald-600">Across {guestStats.totalVisits} visits</span>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-blue-500">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Avg Per Stay</p>
                  <h3 className="text-2xl font-bold mt-1 text-slate-800">${guestStats.avgSpentPerStay.toFixed(2)}</h3>
                </div>
                <div className="p-2 rounded-lg bg-blue-50">
                  <TrendingUp size={18} className="text-blue-600" />
                </div>
              </div>
              <div className="mt-2">
                <span className="text-[10px] font-medium text-blue-600">Average spending</span>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-cyan-500">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Nights</p>
                  <h3 className="text-2xl font-bold mt-1 text-slate-800">{guestStats.totalNights}</h3>
                </div>
                <div className="p-2 rounded-lg bg-cyan-50">
                  <CalendarIcon size={18} className="text-cyan-600" />
                </div>
              </div>
              <div className="mt-2">
                <span className="text-[10px] font-medium text-cyan-600">Nights stayed</span>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-amber-500">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Avg Per Night</p>
                  <h3 className="text-2xl font-bold mt-1 text-slate-800">${guestStats.totalNights > 0 ? (guestStats.totalSpent / guestStats.totalNights).toFixed(2) : '0.00'}</h3>
                </div>
                <div className="p-2 rounded-lg bg-amber-50">
                  <DollarSign size={18} className="text-amber-600" />
                </div>
              </div>
              <div className="mt-2">
                <span className="text-[10px] font-medium text-amber-600">Per night average</span>
              </div>
            </div>
          </div>

          {/* Reservations Breakdown */}
          {guestReservations.length > 0 && (
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="text-lg">Reservation Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left py-3 px-4 font-semibold text-slate-600">Room</th>
                        <th className="text-left py-3 px-4 font-semibold text-slate-600">Booked Date</th>
                        <th className="text-left py-3 px-4 font-semibold text-slate-600">Stay</th>
                        <th className="text-right py-3 px-4 font-semibold text-slate-600">Amount</th>
                        <th className="text-left py-3 px-4 font-semibold text-slate-600">Payment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {guestReservations.map((res) => {
                        // Safe date parsing with fallbacks
                        let start: Date, end: Date;
                        try {
                          start = res.startDate instanceof Date ? res.startDate : new Date(res.startDate);
                          end = res.endDate instanceof Date ? res.endDate : new Date(res.endDate);
                          // Validate dates
                          if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                            start = new Date();
                            end = new Date();
                          }
                        } catch {
                          start = new Date();
                          end = new Date();
                        }
                        
                        const nights = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                        
                        // Safe createdDate parsing
                        let createdDate: Date;
                        try {
                          if (res.createdAt instanceof Date) {
                            createdDate = res.createdAt;
                          } else if (res.createdAt) {
                            createdDate = new Date(res.createdAt);
                            if (isNaN(createdDate.getTime())) {
                              createdDate = start;
                            }
                          } else {
                            createdDate = start;
                          }
                        } catch {
                          createdDate = start;
                        }
                        
                        const roomNumber = res.rooms?.[0]?.roomName || 'N/A';
                        const roomType = res.rooms?.[0]?.roomTypeName || '';
                        const numGuests = (res.rooms?.[0]?.adults || 0) + (res.rooms?.[0]?.children || 0);
                        const paymentStatusColor = {
                          'Paid': 'bg-emerald-50 text-emerald-700',
                          'Partial': 'bg-amber-50 text-amber-700',
                          'Pending': 'bg-blue-50 text-blue-700',
                          'Refunded': 'bg-slate-50 text-slate-700',
                        }[res.paymentStatus || 'Pending'] || 'bg-slate-50 text-slate-700';
                        
                        return (
                          <tr key={res.id} className="border-b border-slate-100 hover:bg-slate-50">
                            {/* Room Column */}
                            <td className="py-4 px-4">
                              <div className="flex flex-col">
                                <span className="font-semibold text-slate-800">Room {roomNumber}</span>
                                {roomType && <span className="text-xs text-slate-500 mt-1">{roomType}</span>}
                              </div>
                            </td>
                            
                            {/* Booked Date Column */}
                            <td className="py-4 px-4">
                              <div className="flex flex-col">
                                <span className="font-medium text-slate-700">{format(createdDate, 'MMM d, yyyy')}</span>
                                <span className="text-xs text-slate-500 mt-1">{format(createdDate, 'p')}</span>
                              </div>
                            </td>
                            
                            {/* Stay Column */}
                            <td className="py-4 px-4">
                              <div className="flex flex-col">
                                <div className="flex gap-2 items-center">
                                  <CalendarIcon size={14} className="text-blue-500" />
                                  <span className="text-slate-700">{format(start, 'MMM d, yyyy')} - {format(end, 'MMM d, yyyy')}</span>
                                </div>
                                <div className="flex gap-3 mt-2 text-xs text-slate-600">
                                  {numGuests > 0 && (
                                    <div className="flex gap-1 items-center">
                                      <UserIcon size={12} className="text-slate-500" />
                                      <span>{numGuests} {numGuests === 1 ? 'guest' : 'guests'}</span>
                                    </div>
                                  )}
                                  <div className="flex gap-1 items-center">
                                    <CalendarIcon size={12} className="text-slate-500" />
                                    <span>{nights} {nights === 1 ? 'night' : 'nights'}</span>
                                  </div>
                                </div>
                              </div>
                            </td>
                            
                            {/* Amount Column */}
                            <td className="py-4 px-4 text-right">
                              <div className="font-semibold text-slate-800">
                                ${(res.totalPrice || 0).toFixed(2)}
                              </div>
                              {res.priceBeforeDiscount && res.priceBeforeDiscount > res.totalPrice && (
                                <div className="text-xs text-slate-500 line-through mt-1">
                                  ${(res.priceBeforeDiscount).toFixed(2)}
                                </div>
                              )}
                            </td>
                            
                            {/* Payment Column */}
                            <td className="py-4 px-4">
                              <div className="flex flex-col gap-2">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium w-fit capitalize ${paymentStatusColor}`}>
                                  {res.paymentStatus || 'Pending'}
                                </span>
                                {res.paymentMethod && (
                                  <span className="text-xs text-slate-600">{res.paymentMethod}</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Payment Method</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-700">{guest.paymentMethod || 'Not specified'}</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Loyalty Tab */}
        <TabsContent value="loyalty" className="mt-4">
           <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-amber-600" />
                Loyalty Program
              </CardTitle>
              <CardDescription>Loyalty points, tier status, and program details</CardDescription>
            </CardHeader>
            <CardContent>
              {syncedGuest.loyaltyStatus !== 'enrolled' ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground mb-4">Guest is not enrolled in the loyalty program</p>
                    <p className="text-xs text-slate-500 mb-4">Guests must be manually enrolled to earn loyalty points and unlock tier benefits.</p>
                    <Badge variant="outline" className="bg-slate-100 text-slate-600 border border-slate-300">Not Enrolled</Badge>
                  </div>
              ) : (
                <div className="space-y-6">
                  {/* Points and Tier Summary */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Current Tier</p>
                      <p className="text-lg font-bold text-amber-700 mt-2">{guestTier.name}</p>
                      <p className="text-xs text-slate-600 mt-1">{guestTier.minPoints}+ points</p>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Points</p>
                      <p className="text-lg font-bold text-amber-700 mt-2">{syncedGuest.totalPointsEarned || 0}</p>
                      <p className="text-xs text-slate-600 mt-1">All time</p>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Available Points</p>
                      <p className="text-lg font-bold text-amber-700 mt-2">{(syncedGuest.loyaltyPoints || 0)}</p>
                      <p className="text-xs text-slate-600 mt-1">To redeem</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Reservations</p>
                      <p className="text-lg font-bold text-blue-700 mt-2">{guestReservations.length}</p>
                      <p className="text-xs text-slate-600 mt-1">Total stays</p>
                    </div>
                  </div>

                  {/* Tier Progress */}
                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">Tier Progress</p>
                    
                    {/* Progress Bar Visualization */}
                    <div className="mb-4">
                      <div className="flex gap-1 h-8 mb-2">
                        {customTiers.map((tier, index) => {
                          const currentTierIndex = customTiers.findIndex(t => t.name === guestTier.name);
                          const isCurrentTier = tier.name === guestTier.name;
                          const isPastTier = index < currentTierIndex;
                          const isNextTier = index === currentTierIndex + 1;
                          
                          // Calculate the percentage for the next tier progress
                          let fillPercentage = 0;
                          if (isCurrentTier && isNextTier === false) {
                            // Current tier - show as complete
                            fillPercentage = 100;
                          } else if (isNextTier) {
                            // Next tier - show progress towards it
                            const currentMinPoints = tier.minPoints;
                            const prevTier = customTiers[index - 1];
                            const prevMinPoints = prevTier?.minPoints || 0;
                            const pointsInRange = currentMinPoints - prevMinPoints;
                            const pointsEarned = (syncedGuest.totalPointsEarned || 0) - prevMinPoints;
                            fillPercentage = Math.max(0, Math.min(100, (pointsEarned / pointsInRange) * 100));
                          } else if (isPastTier) {
                            // Past tier - show as complete
                            fillPercentage = 100;
                          }
                          
                          return (
                            <div key={tier.name} className="flex-1 relative group">
                              <div className={`h-full rounded transition-all ${isPastTier ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-slate-200'}`}>
                                {!isPastTier && (
                                  <div 
                                    className={`h-full rounded transition-all ${isCurrentTier || isNextTier ? 'bg-gradient-to-r from-amber-400 to-amber-500' : ''}`}
                                    style={{ width: `${fillPercentage}%` }}
                                  />
                                )}
                              </div>
                              
                              {/* Tier Label Tooltip */}
                              <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none">
                                {tier.name} ({tier.minPoints}+)
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Current Position Indicator */}
                      <div className="text-xs text-slate-600 text-center">
                        {(syncedGuest.totalPointsEarned || 0).toLocaleString()} total points earned
                      </div>
                    </div>

                    {/* Tier Cards */}
                    <div className="space-y-2">
                      {customTiers.map((tier, index) => {
                        const isCurrentTier = tier.name === guestTier.name;
                        const currentTierIndex = customTiers.findIndex(t => t.name === guestTier.name);
                        const isNextTier = index === currentTierIndex + 1;
                        const nextTier = isNextTier ? tier : null;
                        const pointsNeeded = nextTier ? Math.max(0, nextTier.minPoints - (syncedGuest.totalPointsEarned || 0)) : 0;
                        
                        return (
                          <div key={tier.name} className={`p-3 rounded-lg transition ${isCurrentTier ? 'bg-amber-100 border-2 border-amber-400' : 'bg-white border border-slate-200'}`}>
                            <div className="flex justify-between items-start">
                              <div>
                                <span className={`font-semibold text-sm ${isCurrentTier ? 'text-amber-900' : 'text-slate-700'}`}>{tier.name}</span>
                                {isCurrentTier && <span className="ml-2 text-xs bg-amber-500 text-white px-2 py-0.5 rounded">CURRENT</span>}
                              </div>
                              <span className="text-xs text-slate-600">{tier.minPoints}+ points</span>
                            </div>
                            
                            {/* Benefits if available */}
                            {tier.benefits && tier.benefits.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-slate-300">
                                <p className="text-xs font-semibold text-slate-600 mb-1">Benefits:</p>
                                <ul className="space-y-1">
                                  {tier.benefits.map((benefit, idx) => (
                                    <li key={idx} className="text-xs text-slate-700 flex items-start">
                                      <span className="mr-2">•</span>
                                      <span>{benefit}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {isCurrentTier && nextTier && (
                              <p className="text-xs font-medium text-amber-700 mt-2 pt-2 border-t border-slate-300">{pointsNeeded} points to {nextTier.name}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Quick Adjust Loyalty Points */}
                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-4">Quick Actions</p>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Points Amount</label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={adjustmentPoints}
                            onChange={(e) => setAdjustmentPoints(e.target.value)}
                            placeholder="Enter points (+ or -)"
                            className="flex-1 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleResetPointsForm}
                            disabled={isAdjustingPoints}
                            className="text-slate-600"
                          >
                            Reset
                          </Button>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Use + to add, - to remove points</p>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Reason (Optional)</label>
                        <input
                          type="text"
                          value={adjustmentReason}
                          onChange={(e) => setAdjustmentReason(e.target.value)}
                          placeholder="e.g., Compensation for service recovery"
                          className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>

                      <Button
                        onClick={handleAdjustLoyaltyPoints}
                        disabled={isAdjustingPoints || !adjustmentPoints}
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                      >
                        {isAdjustingPoints ? (
                          <>
                            <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />
                            Adjusting...
                          </>
                        ) : (
                          <>
                            <TrendingUp className="mr-2 h-4 w-4" />
                            Apply Adjustment
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Program Settings */}
                  {property?.loyaltyProgramSettings && (
                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">Program Settings</p>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-slate-500">Points per night</p>
                          <p className="font-semibold text-slate-700">{property.loyaltyProgramSettings.pointsPerNight || 0}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Points per dollar</p>
                          <p className="font-semibold text-slate-700">{property.loyaltyProgramSettings.pointsPerDollar || 0}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {isLoadingHistory ? (
                      <div className="flex items-center justify-center h-24"><Icons.Spinner className="h-6 w-6 animate-spin"/></div>
                  ) : loyaltyHistory.length > 0 ? (
                    <div>
                      <h4 className="font-semibold text-sm mb-3">Points Activity</h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead className="text-right">Points</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                           {paginatedLoyaltyHistory.map(entry => (
                              <TableRow key={entry.id}>
                                  <TableCell className="text-sm">{formatDateField(entry.date)}</TableCell>
                                  <TableCell className="text-sm text-slate-700">{entry.reason}</TableCell>
                                  <TableCell className={`text-right font-medium text-sm ${entry.change > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                      {entry.change > 0 ? '+' : ''}{entry.change}
                                  </TableCell>
                              </TableRow>
                           ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">No loyalty activity</p>
                  )}
                </div>
              )}
            </CardContent>
            {totalLoyaltyPages > 1 && loyaltyHistory.length > 0 && (
              <CardFooter className="flex items-center justify-end space-x-6 p-4 border-t">
                  <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium">Rows per page</p>
                      <Select
                          value={`${loyaltyItemsPerPage}`}
                          onValueChange={(value) => {
                              setLoyaltyItemsPerPage(Number(value));
                              setLoyaltyCurrentPage(1);
                          }}
                      >
                          <SelectTrigger className="h-8 w-[70px]">
                              <SelectValue placeholder={`${loyaltyItemsPerPage}`} />
                          </SelectTrigger>
                          <SelectContent side="top">
                              {[10, 25, 50].map((pageSize) => (
                                  <SelectItem key={pageSize} value={`${pageSize}`}>{pageSize}</SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                  </div>
                  <span className="text-sm text-muted-foreground">
                      Page {loyaltyCurrentPage} of {totalLoyaltyPages}
                  </span>
                  <div className="flex items-center space-x-2">
                      <Button variant="outline" size="sm" onClick={() => setLoyaltyCurrentPage(p => Math.max(1, p - 1))} disabled={loyaltyCurrentPage === 1}>Previous</Button>
                      <Button variant="outline" size="sm" onClick={() => setLoyaltyCurrentPage(p => Math.min(totalLoyaltyPages, p + 1))} disabled={loyaltyCurrentPage >= totalLoyaltyPages}>Next</Button>
                  </div>
              </CardFooter>
            )}
          </Card>
        </TabsContent>
        
        {/* Notes Tab */}
        <TabsContent value="notes" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                Internal Notes
              </CardTitle>
              <CardDescription>Private notes about this guest (visible to staff only)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea 
                placeholder="Add any important notes about this guest..." 
                rows={6}
                value={internalNotes}
                onChange={e => setInternalNotes(e.target.value)}
                className="border-slate-200"
              />
              <Button size="sm" onClick={handleSaveNotes} disabled={isSavingNotes} className="bg-blue-600 hover:bg-blue-700">
                {isSavingNotes && <Icons.Spinner className="h-4 w-4 mr-2 animate-spin"/>}
                Save Notes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-rose-600" />
                Guest Preferences
              </CardTitle>
              <CardDescription>Special requests and preferences for this guest</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Room Preferences</p>
                <Input 
                  placeholder="e.g., High floor, quiet room, near elevator"
                  value={roomPreferences}
                  onChange={(e) => setRoomPreferences(e.target.value)}
                  className="text-sm"
                />
              </div>
              <Separator />
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Dietary Restrictions</p>
                <Input 
                  placeholder="e.g., Vegetarian, Gluten-free, Shellfish allergy"
                  value={dietaryRestrictions}
                  onChange={(e) => setDietaryRestrictions(e.target.value)}
                  className="text-sm"
                />
              </div>
              <Separator />
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Special Occasions</p>
                <Input 
                  placeholder="e.g., Anniversary, Birthday, Honeymoon"
                  value={specialOccasion}
                  onChange={(e) => setSpecialOccasion(e.target.value)}
                  className="text-sm"
                />
              </div>
              <Separator />
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Communication Preferences</p>
                <Input 
                  placeholder="e.g., Email only, Prefer WhatsApp"
                  value={communicationPreference}
                  onChange={(e) => setCommunicationPreference(e.target.value)}
                  className="text-sm"
                />
              </div>
              <Button 
                size="sm" 
                onClick={handleSavePreferences} 
                disabled={isSavingPreferences}
                className="bg-blue-600 hover:bg-blue-700 mt-4"
              >
                {isSavingPreferences && <Icons.Spinner className="h-4 w-4 mr-2 animate-spin"/>}
                Save Preferences
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Footer */}
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-wrap gap-2">
        {/* Contact Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <MessageCircle className="h-4 w-4 mr-2" />
              Contact
              <ChevronDown className="h-4 w-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={handleGuestPortal}>
              <Globe className="h-4 w-4 mr-2 text-cyan-600" />
              <span>Guest Portal</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setIsMessageDialogOpen(true)}>
              <Mail className="h-4 w-4 mr-2 text-blue-600" />
              <span>Send Email</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleWhatsApp}>
              <MessageCircle className="h-4 w-4 mr-2 text-green-600" />
              <span>WhatsApp</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCall}>
              <Phone className="h-4 w-4 mr-2 text-emerald-600" />
              <span>Call</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Email Message Dialog */}
        <Dialog open={isMessageDialogOpen} onOpenChange={setIsMessageDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Send Email to {guest.fullName}</DialogTitle>
              <DialogDescription>
                Compose an email message
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <Textarea
                placeholder="Type your message here..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                rows={6}
                className="resize-none"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsMessageDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSendMessage} 
                disabled={isSendingMessage || !messageText.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSendingMessage && <Icons.Spinner className="h-4 w-4 mr-2 animate-spin"/>}
                Send Email
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* New Reservation Button - Link to Booking Flow */}
        <Button 
          className="bg-emerald-600 hover:bg-emerald-700"
          onClick={() => {
            // Store guest email and current reservations for sync on return
            if (typeof window !== 'undefined' && onReservationCreated) {
              sessionStorage.setItem('guestEmailForSync', guest.email || '');
              sessionStorage.setItem('guestReservationsForSync', JSON.stringify(allReservations.filter(r => r.guestEmail === guest.email)));
            }
            window.location.href = `/booking?guestEmail=${guest.email}&guestName=${encodeURIComponent(guest.fullName)}`;
          }}
        >
          <CalendarIcon className="h-4 w-4 mr-2" />
          New Reservation
        </Button>

        {/* Add Quick Note Dialog */}
        <Dialog open={isAddNoteDialogOpen} onOpenChange={setIsAddNoteDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <FileText className="h-4 w-4 mr-2" />
              Add Note
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add Quick Note</DialogTitle>
              <DialogDescription>
                Add a note to {guest.fullName}'s guest profile
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <Textarea
                placeholder="Type your note here..."
                value={quickNote}
                onChange={(e) => setQuickNote(e.target.value)}
                rows={5}
                className="resize-none"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddNoteDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSaveQuickNote} 
                disabled={isSavingQuickNote || !quickNote.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSavingQuickNote && <Icons.Spinner className="h-4 w-4 mr-2 animate-spin"/>}
                Add Note
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Guest Alert Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <Button 
            variant="outline" 
            className="ml-auto text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => setIsDeleteDialogOpen(true)}
          >
            <Icons.Trash className="h-4 w-4 mr-2" />
            Delete Guest
          </Button>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Guest</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {guest.fullName}? This action cannot be undone. All associated guest data will be permanently deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteGuest}
                disabled={isDeletingGuest}
                className="bg-red-600 hover:bg-red-700"
              >
                {isDeletingGuest && <Icons.Spinner className="h-4 w-4 mr-2 animate-spin"/>}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Reservation Details Modal */}
        <ReservationDetailModal
          isOpen={isReservationDetailsOpen}
          onClose={() => {
            setIsReservationDetailsOpen(false);
            setSelectedReservation(null);
          }}
          initialData={selectedReservation}
          propertySettings={property}
          canManage={true}
        />
      </div>
    </div>
  );
}

const GuestTagDisplay = ({ tag }: { tag: GuestTag }) => {
  const Icon = tag.icon ? Icons[tag.icon as keyof typeof Icons] : null;
  return (
    <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-700">
        {Icon && <Icon className="h-3 w-3 mr-1.5" />}
        {tag.label}
    </Badge>
  );
}
