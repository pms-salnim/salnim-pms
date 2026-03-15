
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as ShadcnCalendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription as DialogDesc, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Icons } from "@/components/icons";
import { cn } from "@/lib/utils";
import { format, startOfDay, parseISO, addDays, subDays, isValid } from "date-fns";
import { enUS, fr } from 'date-fns/locale';
import type { DateRange } from "react-day-picker";
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, serverTimestamp, writeBatch, getDocs, Timestamp, orderBy, limit, deleteDoc, updateDoc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import type { RoomType } from '@/types/roomType';
import type { Room as FirestoreRoom } from '@/types/room';
import type { Reservation as FirestoreReservation } from '@/components/calendar/types';
import type { AvailabilitySetting } from '@/types/availabilityOverride';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Separator } from '@/components/ui/separator';
import { ChevronsUpDown, MoreHorizontal } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useTranslation } from 'react-i18next';


const bulkUpdateSchema = z.object({
  roomTypeId: z.string({ required_error: "Please select a room type." }).min(1, "Room type is required."),
  roomIds: z.array(z.string()).optional(),
  dateRange: z.object({
    from: z.date({ required_error: "A start date is required." }),
    to: z.date().optional(),
  }).refine((data) => data.from, {
    message: "A start date is required.",
    path: ["from"],
  }).refine((data) => !data.to || data.to >= data.from, {
    message: "End date cannot be before start date.",
    path: ["to"],
  }),
  actionType: z.enum(['block', 'available']),
  notes: z.string().optional(),
});

type BulkUpdateFormValues = z.infer<typeof bulkUpdateSchema>;

export default function SetAvailabilityPage() {
    const { user, isLoadingAuth } = useAuth();
    const [propertyId, setPropertyId] = useState<string | null>(null);
    const [canManage, setCanManage] = useState(false);
    const [isOpenEnded, setIsOpenEnded] = useState(false);

    const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
    const [allRooms, setAllRooms] = useState<FirestoreRoom[]>([]);
    const [reservations, setReservations] = useState<FirestoreReservation[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    
    const [editingSetting, setEditingSetting] = useState<AvailabilitySetting | null>(null);

    const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
    const [confirmedActionData, setConfirmedActionData] = useState<BulkUpdateFormValues | null>(null);
    
    const [availabilityLog, setAvailabilityLog] = useState<AvailabilitySetting[]>([]);
    const [isLoadingLog, setIsLoadingLog] = useState(true);
    
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const { t, i18n } = useTranslation('pages/calendar-availability/set-availability/content');
    const locale = i18n.language === 'fr' ? fr : enUS;

    const form = useForm<BulkUpdateFormValues>({
        resolver: zodResolver(bulkUpdateSchema),
        defaultValues: {
            roomTypeId: '',
            roomIds: [],
            dateRange: { from: undefined, to: undefined },
            actionType: 'available',
            notes: '',
        },
    });
    
    const selectedRoomTypeId = form.watch('roomTypeId');

    useEffect(() => {
        if (user?.propertyId) {
            setPropertyId(user.propertyId);
            setCanManage(true); 
        }
    }, [user]);

    useEffect(() => {
        if (!propertyId) {
            setRoomTypes([]);
            setAllRooms([]);
            setIsLoadingData(true);
            return;
        }

        setIsLoadingData(true);
        const rtUnsub = onSnapshot(query(collection(db, "roomTypes"), where("propertyId", "==", propertyId)), (snap) => {
            setRoomTypes(snap.docs.map(d => ({ id: d.id, ...d.data() } as RoomType)));
        });
        
        const roomsUnsub = onSnapshot(query(collection(db, "rooms"), where("propertyId", "==", propertyId)), (snap) => {
            setAllRooms(snap.docs.map(d => ({ id: d.id, ...d.data() } as FirestoreRoom)));
        });

        const resUnsub = onSnapshot(query(collection(db, "reservations"), where("propertyId", "==", propertyId)), (snap) => {
          setReservations(snap.docs.map(d => {
            const data = d.data();
            return { 
              ...data, 
              id: d.id, 
              startDate: (data.startDate as Timestamp).toDate(), 
              endDate: (data.endDate as Timestamp).toDate(),
            } as FirestoreReservation;
          }));
        });
        
        setIsLoadingData(false);

        return () => { rtUnsub(); roomsUnsub(); resUnsub(); };
    }, [propertyId]);
    
    useEffect(() => {
        if (!propertyId) {
          setAvailabilityLog([]);
          setIsLoadingLog(false);
          return;
        }
        setIsLoadingLog(true);
        const availQuery = query(
            collection(db, "availability"), 
            where("propertyId", "==", propertyId),
            orderBy("createdAt", "desc"),
            limit(50)
        );
        const unsubLog = onSnapshot(availQuery, (snapshot) => {
            const settings = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt ? (data.createdAt as Timestamp).toDate() : new Date(),
                } as AvailabilitySetting;
            });
            setAvailabilityLog(settings);
            setIsLoadingLog(false);
        }, (error) => {
            console.error("Error fetching availability log:", error);
            toast({ title: t('toasts.log_load_error_title'), description: t('toasts.log_load_error_description'), variant: "destructive" });
            setIsLoadingLog(false);
        });

        return () => unsubLog();
    }, [propertyId, t]);

    useEffect(() => {
        if (!editingSetting) {
            form.setValue('roomIds', []);
        }
    }, [selectedRoomTypeId, form, editingSetting]);
    
    useEffect(() => {
        if (isOpenEnded) {
            const currentFrom = form.getValues('dateRange.from');
            form.setValue('dateRange', { from: currentFrom, to: undefined }, { shouldValidate: true });
        }
    }, [isOpenEnded, form]);

    const onPreviewSubmit = (data: BulkUpdateFormValues) => {
        if (!isOpenEnded && !data.dateRange?.to) {
            form.setError("dateRange", { message: t('form.validation.end_date_required') });
            return;
        }
        setConfirmedActionData(data);
        setIsConfirmationModalOpen(true);
    };

    const getNotePayload = (actionType: 'block' | 'available', notes: string | undefined) => {
        if (notes && notes.trim() !== '') return notes.trim();
        return {
            key: `form.notes.${actionType}_default`,
            params: {
                name: user?.name || 'System',
                date: new Date().toISOString(), // Store as ISO string
            }
        };
    };

    const handleConfirmAction = async () => {
        if (!confirmedActionData || !propertyId || !user?.id) return;
        setIsProcessing(true);

        const { roomTypeId, roomIds = [], dateRange, actionType, notes } = confirmedActionData;
        const newStartDate = startOfDay(dateRange.from!);
        const newEndDate = dateRange.to ? startOfDay(dateRange.to) : new Date('9999-12-31');
        
        const handleOverlap = (docSnap: any, newStart: Date, newEnd: Date, batchInstance: any) => {
            const existingSetting = { id: docSnap.id, ...docSnap.data() } as AvailabilitySetting;
            const oldStart = startOfDay(parseISO(existingSetting.startDate));
            const oldEnd = startOfDay(parseISO(existingSetting.endDate));

            const overlaps = newStart <= oldEnd && newEnd >= oldStart;
            if (!overlaps) return;
            
            batchInstance.delete(docSnap.ref); 

            if (newStart <= oldStart && newEnd >= oldEnd) {
                return; 
            }

            if (oldStart < newStart) {
                const beforeRef = doc(collection(db, "availability"));
                batchInstance.set(beforeRef, { ...existingSetting, id: beforeRef.id, endDate: format(subDays(newStart, 1), 'yyyy-MM-dd'), createdAt: serverTimestamp(), createdBy: user.id });
            }
            if (oldEnd > newEnd) {
                const afterRef = doc(collection(db, "availability"));
                batchInstance.set(afterRef, { ...existingSetting, id: afterRef.id, startDate: format(addDays(newEnd, 1), 'yyyy-MM-dd'), createdAt: serverTimestamp(), createdBy: user.id });
            }
        };

        try {
            const batch = writeBatch(db);
            const availabilityRef = collection(db, "availability");
            
            if (roomIds.length > 0) {
                const roomTypeOverrideQuery = query(availabilityRef, where("propertyId", "==", propertyId), where("roomTypeId", "==", roomTypeId), where("roomId", "==", null));
                const specificRoomsQuery = query(availabilityRef, where("propertyId", "==", propertyId), where("roomId", "in", roomIds));
                
                const [roomTypeOverridesSnap, specificRoomsOverridesSnap] = await Promise.all([getDocs(roomTypeOverrideQuery), getDocs(specificRoomsQuery)]);
                
                const combinedDocs = [...roomTypeOverridesSnap.docs, ...specificRoomsOverridesSnap.docs];
                const uniqueDocs = Array.from(new Map(combinedDocs.map(doc => [doc.id, doc])).values());

                for (const docSnap of uniqueDocs) {
                   handleOverlap(docSnap, newStartDate, newEndDate, batch);
                }

            } else {
                const roomTypeOverrideQuery = query(availabilityRef, where("propertyId", "==", propertyId), where("roomTypeId", "==", roomTypeId));
                const existingSettingsSnap = await getDocs(roomTypeOverrideQuery);
                for (const docSnap of existingSettingsSnap.docs) {
                    handleOverlap(docSnap, newStartDate, newEndDate, batch);
                }
            }
            
            const commonData = {
                propertyId, roomTypeId,
                startDate: format(newStartDate, 'yyyy-MM-dd'),
                endDate: format(newEndDate, 'yyyy-MM-dd'),
                status: actionType, createdBy: user.id,
                notes: getNotePayload(actionType, notes),
                createdAt: serverTimestamp(),
            };

            if (roomIds.length > 0) {
                roomIds.forEach(roomId => {
                    const newDocRef = doc(availabilityRef);
                    batch.set(newDocRef, { ...commonData, roomId });
                });
            } else {
                const newDocRef = doc(availabilityRef);
                batch.set(newDocRef, { ...commonData, roomId: null });
            }

            await batch.commit();
            toast({ title: t('toasts.success_title'), description: t('toasts.success_description', { roomTypeName: roomTypes.find(rt => rt.id === roomTypeId)?.name || 'selected room type' }) });
            form.reset();
            setIsOpenEnded(false);

        } catch (error) {
            console.error("Error updating availability:", error);
            toast({ title: t('toasts.save_error_title'), description: t('toasts.save_error_description', { message: error instanceof Error ? error.message : '' }), variant: "destructive" });
        } finally {
            setIsProcessing(false);
            setIsConfirmationModalOpen(false);
            setConfirmedActionData(null);
        }
    };


    const handleDeleteSetting = async (settingId: string) => {
        if (!confirm(t('log_table.delete_confirm'))) return;
        try {
            await deleteDoc(doc(db, "availability", settingId));
            toast({ title: t('toasts.delete_success_title'), description: t('toasts.delete_success_description') });
        } catch (error) {
            console.error("Error deleting setting:", error);
            toast({ title: t('toasts.delete_error_title'), description: t('toasts.delete_error_description'), variant: "destructive" });
        }
    };
    
    const handleEditSetting = (setting: AvailabilitySetting) => {
        const isEditOpenEnded = setting.endDate === '9999-12-31';
        setIsOpenEnded(isEditOpenEnded);
        setEditingSetting(setting);
        let noteValue = '';
        if (typeof setting.notes === 'string') {
            noteValue = setting.notes;
        }
        
        form.reset({
            roomTypeId: setting.roomTypeId,
            roomIds: setting.roomId ? [setting.roomId] : [],
            dateRange: {
                from: parseISO(setting.startDate),
                to: isEditOpenEnded ? undefined : parseISO(setting.endDate),
            },
            actionType: setting.status as 'block' | 'available',
            notes: noteValue,
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setEditingSetting(null);
        setIsOpenEnded(false);
        form.reset();
    };
    
    const roomTypeName = roomTypes.find(rt => rt.id === confirmedActionData?.roomTypeId)?.name || t('confirmation.selected_room_type');

    const paginatedLog = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return availabilityLog.slice(startIndex, startIndex + itemsPerPage);
    }, [availabilityLog, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(availabilityLog.length / itemsPerPage);

    const LogTable = ({ settings, rooms, roomTypes, isLoading, onEdit, onDelete }: { settings: AvailabilitySetting[], rooms: FirestoreRoom[], roomTypes: RoomType[], isLoading: boolean, onEdit: (setting: AvailabilitySetting) => void, onDelete: (id: string) => void }) => {
        const { t, i18n } = useTranslation('pages/calendar-availability/set-availability/content');
        const locale = i18n.language === 'fr' ? fr : enUS;
        
        const getAppliesToName = (setting: AvailabilitySetting) => {
            if (setting.roomId) {
                const room = rooms.find(r => r.id === setting.roomId);
                const roomType = roomTypes.find(rt => rt.id === setting.roomTypeId);
                return room ? `${room.name} (${roomType?.name || 'N/A'})` : t('log_table.unknown_room');
            }
            const roomType = roomTypes.find(rt => rt.id === setting.roomTypeId);
            return roomType ? `${roomType.name} (${t('log_table.type')})` : t('log_table.unknown_room_type');
        };

        const getNoteDisplay = (notes: any): string => {
            if (!notes) return "-";
            if (typeof notes === 'string') {
              return t(notes, { defaultValue: notes });
            }
            if (typeof notes === 'object' && notes.key && notes.params) {
              const dateParam = notes.params.date;
              // Check if date is a string (from Firestore) or already a Date object
              const dateToFormat = typeof dateParam === 'string' ? parseISO(dateParam) : dateParam;
        
              // Validate the date object before formatting
              if (!dateToFormat || !isValid(dateToFormat)) {
                return "-"; // or return a fallback string
              }
        
              const interpolationParams = {
                  ...notes.params,
                  date: format(dateToFormat, 'PPp', { locale }),
              };
              return t(notes.key, interpolationParams);
            }
            return "-";
        };
        
        const formatEndDateForDisplay = (endDate: string) => {
            if (endDate === '9999-12-31') {
                return t('log_table.open_ended');
            }
            return format(parseISO(endDate), 'PP', { locale });
        };

        if (isLoading) {
            return <div className="flex items-center justify-center py-8"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>;
        }

        if (settings.length === 0) {
            return <p className="text-sm text-muted-foreground text-center py-8">{t('log_table.no_records')}</p>;
        }

        return (
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t('log_table.header.applies_to')}</TableHead>
                            <TableHead>{t('log_table.header.start_date')}</TableHead>
                            <TableHead>{t('log_table.header.end_date')}</TableHead>
                            <TableHead>{t('log_table.header.notes')}</TableHead>
                            <TableHead className="text-right">{t('log_table.header.actions')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {settings.map((setting) => (
                            <TableRow key={setting.id}>
                                <TableCell className="font-medium">{getAppliesToName(setting)}</TableCell>
                                <TableCell>{format(parseISO(setting.startDate), 'PP', { locale })}</TableCell>
                                <TableCell>{formatEndDateForDisplay(setting.endDate)}</TableCell>
                                <TableCell className="max-w-sm truncate" title={getNoteDisplay(setting.notes)}>{getNoteDisplay(setting.notes)}</TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => onEdit(setting)}><Icons.Edit className="mr-2 h-4 w-4" /> {t('log_table.actions.edit')}</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => onDelete(setting.id)} className="text-destructive"><Icons.Trash className="mr-2 h-4 w-4" /> {t('log_table.actions.delete')}</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        );
    };

    if (isLoadingAuth) {
      return <div className="flex h-full items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>;
    }

    if (!user?.permissions?.availability) {
      return (
        <Alert variant="destructive">
          <Icons.AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('access_denied.title')}</AlertTitle>
          <AlertDescription>
            {t('access_denied.description')}
          </AlertDescription>
        </Alert>
      );
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>{editingSetting ? t('card_header.edit_title') : t('card_header.title')}</CardTitle>
                    <CardDescription>
                        {editingSetting 
                            ? t('card_header.edit_description', { id: editingSetting.id.substring(0,8) })
                            : t('card_header.description')}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onPreviewSubmit)} className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <FormField
                                        control={form.control}
                                        name="roomTypeId"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('form.room_type.label')}</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value} disabled={!canManage || isLoadingData}>
                                                    <FormControl>
                                                        <SelectTrigger><SelectValue placeholder={isLoadingData ? t('form.room_type.loading') : t('form.room_type.placeholder')} /></SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {roomTypes.length > 0 ? roomTypes.map(rt => (
                                                            <SelectItem key={rt.id} value={rt.id}>{rt.name}</SelectItem>
                                                        )) : <SelectItem value="none" disabled>{t('form.room_type.not_found')}</SelectItem>}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                     <FormField
                                        control={form.control}
                                        name="roomIds"
                                        render={({ field }) => {
                                            const roomsOfSelectedType = allRooms.filter(r => r.roomTypeId === selectedRoomTypeId);
                                            return (
                                                <FormItem>
                                                    <FormLabel>{t('form.rooms.label')}</FormLabel>
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <FormControl>
                                                                <Button
                                                                    variant="outline"
                                                                    role="combobox"
                                                                    className={cn("w-full justify-between font-normal", !field.value?.length && "text-muted-foreground")}
                                                                    disabled={!selectedRoomTypeId || roomsOfSelectedType.length === 0}
                                                                >
                                                                    {field.value?.length
                                                                        ? t('form.rooms.selected_rooms', { count: field.value.length, total: roomsOfSelectedType.length })
                                                                        : (selectedRoomTypeId && roomsOfSelectedType.length > 0 ? t('form.rooms.all_in_type') : t('form.rooms.select_type_first'))}
                                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                                </Button>
                                                            </FormControl>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                                           <div className="p-2 border-b">
                                                               <Button variant="ghost" size="sm" className="w-full justify-start h-8 text-xs" onClick={() => field.onChange([])}>
                                                                   {t('form.rooms.clear_selection')}
                                                               </Button>
                                                           </div>
                                                           <ScrollArea className="h-48">
                                                              {roomsOfSelectedType.map(room => (
                                                                  <div key={room.id} className="flex items-center px-2 py-1.5 cursor-pointer hover:bg-accent"
                                                                    onClick={() => {
                                                                      const isChecked = field.value?.includes(room.id);
                                                                      let newValue;
                                                                      if (editingSetting) { // If editing, only allow one selection
                                                                         newValue = isChecked ? [] : [room.id];
                                                                      } else {
                                                                         newValue = isChecked
                                                                          ? field.value?.filter(value => value !== room.id)
                                                                          : [...(field.value || []), room.id];
                                                                      }
                                                                      field.onChange(newValue);
                                                                    }}
                                                                  >
                                                                      <Checkbox
                                                                          id={`room-${room.id}`}
                                                                          checked={field.value?.includes(room.id)}
                                                                          className="mr-2"
                                                                      />
                                                                      <Label htmlFor={`room-${room.id}`} className="text-sm font-normal cursor-pointer w-full">
                                                                          {room.name}
                                                                      </Label>
                                                                  </div>
                                                              ))}
                                                           </ScrollArea>
                                                        </PopoverContent>
                                                    </Popover>
                                                    <FormDescription>
                                                        {editingSetting 
                                                            ? t('form.rooms.edit_description')
                                                            : t('form.rooms.description')
                                                        }
                                                    </FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            );
                                        }}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="actionType"
                                        render={({ field }) => (
                                            <FormItem className="space-y-3">
                                                <FormLabel>{t('form.action.label')}</FormLabel>
                                                <FormControl>
                                                    <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4 pt-2">
                                                        <FormItem className="flex items-center space-x-3 space-y-0">
                                                            <FormControl><RadioGroupItem value="available" /></FormControl>
                                                            <FormLabel className="font-normal flex items-center gap-2"><Icons.CheckCircle2 className="h-4 w-4 text-green-600"/> {t('form.action.available')}</FormLabel>
                                                        </FormItem>
                                                        <FormItem className="flex items-center space-x-3 space-y-0">
                                                            <FormControl><RadioGroupItem value="block" /></FormControl>
                                                            <FormLabel className="font-normal flex items-center gap-2"><Icons.XCircle className="h-4 w-4 text-destructive"/> {t('form.action.block')}</FormLabel>
                                                        </FormItem>
                                                    </RadioGroup>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="notes"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('form.notes.label')}</FormLabel>
                                                <FormControl><Textarea placeholder={t('form.notes.placeholder')} {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <div className="space-y-6">
                                    <FormField
                                        control={form.control}
                                        name="dateRange"
                                        render={({ field }) => (
                                          <FormItem className="flex flex-col">
                                            <FormLabel>{t('form.date_range.label')}</FormLabel>
                                            <Popover>
                                              <PopoverTrigger asChild>
                                                <FormControl>
                                                  <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value?.from && "text-muted-foreground")}>
                                                    {field.value?.from ? (
                                                      field.value.to ? (<>{format(field.value.from, "PP", { locale })} - {format(field.value.to, "PP", { locale })}</>) 
                                                      : isOpenEnded ? (<>{format(field.value.from, "PP", { locale })} - {t('form.date_range.open_ended')}</>) 
                                                      : (format(field.value.from, "PP", { locale }))
                                                    ) : (<span>{t('form.date_range.placeholder')}</span>)}
                                                    <Icons.CalendarDays className="ml-auto h-4 w-4 opacity-50" />
                                                  </Button>
                                                </FormControl>
                                              </PopoverTrigger>
                                              <PopoverContent className="w-auto p-0" align="start">
                                                <ShadcnCalendar
                                                    mode={isOpenEnded ? "single" : "range"}
                                                    selected={isOpenEnded ? field.value?.from : field.value}
                                                    onSelect={(date) => {
                                                        if (isOpenEnded) {
                                                            field.onChange({ from: date as Date, to: undefined });
                                                        } else {
                                                            field.onChange(date as DateRange);
                                                        }
                                                    }}
                                                    disabled={(date) => date < startOfDay(new Date())}
                                                    initialFocus
                                                    numberOfMonths={2}
                                                    locale={locale}
                                                />
                                              </PopoverContent>
                                            </Popover>
                                            <div className="flex items-center space-x-2 pt-2">
                                                <Checkbox
                                                    id="open-ended-checkbox"
                                                    checked={isOpenEnded}
                                                    onCheckedChange={(checked) => setIsOpenEnded(checked as boolean)}
                                                />
                                                <Label htmlFor="open-ended-checkbox" className="text-sm font-normal cursor-pointer">
                                                    {t('form.date_range.open_ended_checkbox')}
                                                </Label>
                                                <TooltipProvider delayDuration={100}>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <button type="button" className="p-1 -m-1 inline-flex items-center justify-center rounded-full" aria-label="More info">
                                                                <Icons.HelpCircle className="h-4 w-4 text-muted-foreground" />
                                                            </button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>{t('form.date_range.open_ended_tooltip')}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </div>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                    />
                                    <Alert>
                                        <Icons.AlertCircle className="h-4 w-4" />
                                        <AlertTitle>{t('alert.title')}</AlertTitle>
                                        <AlertDescription>
                                            {t('alert.description')}
                                        </AlertDescription>
                                    </Alert>
                                </div>
                            </div>
                            <div className="flex justify-end pt-4 gap-2">
                                {editingSetting && (
                                    <Button type="button" variant="outline" onClick={handleCancelEdit}>{t('buttons.cancel_edit')}</Button>
                                )}
                                <Button type="submit" disabled={!canManage || isProcessing}>
                                    {isProcessing && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
                                    {editingSetting ? t('buttons.preview_edit') : t('buttons.preview_update')}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            <Card className="mt-8">
                <CardHeader>
                    <CardTitle>{t('log.title')}</CardTitle>
                    <CardDescription>{t('log.description')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="all" className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="all">{t('log.tabs.all')}</TabsTrigger>
                            <TabsTrigger value="blocked">{t('log.tabs.blocked')}</TabsTrigger>
                            <TabsTrigger value="available">{t('log.tabs.available')}</TabsTrigger>
                        </TabsList>
                         <TabsContent value="all" className="mt-4">
                            <LogTable
                                settings={paginatedLog}
                                rooms={allRooms}
                                roomTypes={roomTypes}
                                isLoading={isLoadingLog}
                                onEdit={handleEditSetting}
                                onDelete={handleDeleteSetting}
                            />
                        </TabsContent>
                        <TabsContent value="blocked" className="mt-4">
                            <LogTable
                                settings={paginatedLog.filter(s => s.status === 'blocked')}
                                rooms={allRooms}
                                roomTypes={roomTypes}
                                isLoading={isLoadingLog}
                                onEdit={handleEditSetting}
                                onDelete={handleDeleteSetting}
                            />
                        </TabsContent>
                        <TabsContent value="available" className="mt-4">
                            <LogTable
                                settings={paginatedLog.filter(s => s.status === 'available')}
                                rooms={allRooms}
                                roomTypes={roomTypes}
                                isLoading={isLoadingLog}
                                onEdit={handleEditSetting}
                                onDelete={handleDeleteSetting}
                            />
                        </TabsContent>
                    </Tabs>
                </CardContent>
                {totalPages > 1 && (
                    <CardFooter className="flex items-center justify-end space-x-6 p-4 border-t">
                        <div className="flex items-center space-x-2">
                            <p className="text-sm font-medium">{t('log_table.pagination.rows_per_page')}</p>
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
                            {t('log_table.pagination.page_of', { currentPage: currentPage, totalPages: totalPages })}
                        </span>
                        <div className="flex items-center space-x-2">
                            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>{t('log_table.pagination.previous_button')}</Button>
                            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>{t('log_table.pagination.next_button')}</Button>
                        </div>
                    </CardFooter>
                )}
            </Card>

            <Dialog open={isConfirmationModalOpen} onOpenChange={setIsConfirmationModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('confirmation.title')}</DialogTitle>
                        <DialogDesc>{t('confirmation.description')}</DialogDesc>
                    </DialogHeader>
                    {confirmedActionData && confirmedActionData.dateRange?.from && (
                        <div className="py-4 space-y-4">
                            <div className="flex justify-between items-center bg-muted p-3 rounded-lg">
                                <span className="font-semibold text-foreground">{t('confirmation.action_label')}</span>
                                <span className={cn("font-bold text-lg", confirmedActionData.actionType === 'block' ? 'text-destructive' : 'text-green-600' )}>{t(`confirmation.action_type.${confirmedActionData.actionType}`)}</span>
                            </div>
                            <Separator />
                            <div className="grid grid-cols-3 gap-x-2 gap-y-3 text-sm">
                                <span className="font-medium text-muted-foreground">{t('confirmation.room_type_label')}</span>
                                <span className="col-span-2 text-foreground">{roomTypeName}</span>
                                
                                {confirmedActionData.roomIds && confirmedActionData.roomIds.length > 0 && (
                                    <>
                                        <span className="font-medium text-muted-foreground">{t('confirmation.rooms_label')}</span>
                                        <p className="col-span-2 text-foreground text-xs leading-5">
                                            {confirmedActionData.roomIds.map(id => allRooms.find(r => r.id === id)?.name).join(', ')}
                                        </p>
                                    </>
                                )}

                                <span className="font-medium text-muted-foreground">{t('confirmation.from_label')}</span>
                                <span className="col-span-2 text-foreground">{format(confirmedActionData.dateRange.from, "PPP", { locale })}</span>
                                
                                <span className="font-medium text-muted-foreground">{t('confirmation.to_label')}</span>
                                <span className="col-span-2 text-foreground">
                                  {confirmedActionData.dateRange.to
                                    ? format(confirmedActionData.dateRange.to, "PPP", { locale })
                                    : t('confirmation.open_ended')}
                                </span>
                                
                                {confirmedActionData.notes && <>
                                  <span className="font-medium text-muted-foreground mt-2">{t('confirmation.notes_label')}</span>
                                  <p className="col-span-2 text-foreground text-xs bg-muted/50 p-2 rounded-md mt-2">{confirmedActionData.notes}</p>
                                </>}
                            </div>
                            <Separator />
                            <Alert variant={confirmedActionData.actionType === 'block' ? 'destructive' : 'default'} className={cn(confirmedActionData.actionType === 'available' && 'bg-green-500/5 border-green-500/20')}>
                                <Icons.AlertCircle className="h-4 w-4"/>
                                <AlertTitle>{t(`confirmation.alert_title_${confirmedActionData.actionType}`)}</AlertTitle>
                                <AlertDescription>
                                    {t(`confirmation.alert_description_${confirmedActionData.actionType}`)}
                                </AlertDescription>
                            </Alert>
                        </div>
                    )}
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline" onClick={() => setIsConfirmationModalOpen(false)}>{t('buttons.cancel')}</Button></DialogClose>
                        <Button onClick={handleConfirmAction} disabled={isProcessing} className={cn(confirmedActionData?.actionType === 'block' ? 'bg-destructive hover:bg-destructive/90' : 'bg-green-600 hover:bg-green-700')}>
                            {isProcessing && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
                            {confirmedActionData?.actionType === 'block' ? t('buttons.confirm_block') : t('buttons.confirm_update')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
