
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Icons } from "@/components/icons";
import { cn } from "@/lib/utils";
import { format, addDays, parseISO } from "date-fns";
import { enUS, fr } from 'date-fns/locale';
import { DialogFooter, DialogClose } from "@/components/ui/dialog";
import type { Invoice, InvoiceLineItem } from '@/app/(app)/payments/page';
import type { Guest } from '@/types/guest'; // Assuming Guest type path
import type { Reservation } from '@/components/calendar/types';
import { Trash2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useAuth } from '@/contexts/auth-context';
import type { Property } from '@/types/property';
import { useTranslation } from 'react-i18next';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';

interface InvoiceFormProps {
  onClose: () => void;
  initialData: Invoice | null;
  onSave: (invoiceData: Omit<Invoice, 'id' | 'propertyId' | 'createdAt' | 'updatedAt'>) => void;
  propertySettings: Property | null;
}

export default function InvoiceForm({ onClose, initialData, onSave, propertySettings }: InvoiceFormProps) {
  const { user } = useAuth();
  const [propertyId] = useState(user?.propertyId || null);
  const currencySymbol = propertySettings?.currency || '$';
  const { t, i18n } = useTranslation('pages/payments/invoices/content');
  const locale = i18n.language === 'fr' ? fr : enUS;

  const [guestOrCompany, setGuestOrCompany] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [reservationId, setReservationId] = useState('');
  const [reservationNumberInput, setReservationNumberInput] = useState('');
  const [invoiceDate, setInvoiceDate] = useState<Date | undefined>(new Date());
  const [dueDate, setDueDate] = useState<Date | undefined>(addDays(new Date(), 30));
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([
    { id: Date.now().toString(), description: '', quantity: 1, unitPrice: 0, total: 0 }
  ]);
  const [paymentTerms, setPaymentTerms] = useState('Net 30');
  const [notes, setNotes] = useState(''); // For general invoice notes
  const [paymentStatus, setPaymentStatus] = useState<Invoice['paymentStatus']>('Draft'); // Default for new

  const [taxRate, setTaxRate] = useState(initialData?.taxAmount ? (initialData.taxAmount / (initialData.subtotal || 1)) * 100 : (propertySettings?.taxSettings?.rate || 0));
  
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [discountValue, setDiscountValue] = useState<number>(0);


  const [guests, setGuests] = useState<Guest[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [guestSuggestions, setGuestSuggestions] = useState<Guest[]>([]);
  const [reservationSuggestions, setReservationSuggestions] = useState<Reservation[]>([]);

  useEffect(() => {
    if (initialData) {
      setInvoiceNumber(initialData.invoiceNumber);
      setGuestOrCompany(initialData.guestOrCompany);
      setGuestEmail(initialData.guestEmail || '');
      setGuestPhone(initialData.guestPhone || '');
      setReservationId(initialData.reservationId || '');
      if (initialData.reservationId) {
          const linkedReservation = reservations.find(r => r.id === initialData.reservationId);
          setReservationNumberInput(linkedReservation?.reservationNumber || initialData.reservationId);
      } else {
          setReservationNumberInput('');
      }
      setInvoiceDate(initialData.dateIssued ? parseISO(initialData.dateIssued) : new Date());
      setDueDate(initialData.dueDate ? parseISO(initialData.dueDate) : addDays(new Date(), 30));
      setLineItems(initialData.lineItems.map(item => ({...item, id: Math.random().toString() })));
      setNotes(initialData.notes || '');
      setPaymentStatus(initialData.paymentStatus || 'Draft');
      setSelectedGuestId(initialData.guestId || null);
      
      const subtotal = initialData.subtotal || initialData.lineItems.reduce((sum, i) => sum + i.total, 0);
      const taxAmount = initialData.taxAmount || 0;
      setTaxRate(subtotal > 0 ? (taxAmount / subtotal) * 100 : 0);
      setDiscountType(initialData.discountType || 'fixed');
      setDiscountValue(initialData.discountValue || 0);

    } else {
      const prefix = propertySettings?.invoiceCustomization?.prefix || "INV-";
      const lastNumber = propertySettings?.lastInvoiceNumber || 0;
      const nextNumber = lastNumber + 1;
      const newInvoiceNumber = `${prefix}${String(nextNumber).padStart(5, "0")}`;
      setInvoiceNumber(newInvoiceNumber);

      setGuestOrCompany('');
      setGuestEmail('');
      setGuestPhone('');
      setReservationId('');
      setReservationNumberInput('');
      setInvoiceDate(new Date());
      setDueDate(addDays(new Date(), 30));
      setLineItems([{ id: Date.now().toString(), description: '', quantity: 1, unitPrice: 0, total: 0 }]);
      setNotes('');
      setPaymentStatus('Draft');
      setTaxRate(propertySettings?.taxSettings?.rate || 0);
      setSelectedGuestId(null);
      setDiscountType('fixed');
      setDiscountValue(0);
    }
  }, [initialData, propertySettings, reservations]);

  useEffect(() => {
    if (!propertyId) return;

    const guestsColRef = collection(db, "guests");
    const gq = query(guestsColRef, where("propertyId", "==", propertyId));
    const unsubGuests = onSnapshot(gq, (snapshot) => {
      const fetchedGuests = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Guest));
      setGuests(fetchedGuests);
    }, (err) => {
      console.error("Error fetching guests:", err);
    });

    const reservationsColRef = collection(db, "reservations");
    const rq = query(reservationsColRef, where("propertyId", "==", propertyId));
    const unsubReservations = onSnapshot(rq, (snapshot) => {
      const fetchedReservations = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Reservation));
      setReservations(fetchedReservations);
    }, (err) => {
      console.error("Error fetching reservations:", err);
    });

    return () => { unsubGuests(); unsubReservations(); };
  }, [propertyId]);

  const filterGuestSuggestions = (inputValue: string) => {
    if (!inputValue) {
      setGuestSuggestions([]);
      return;
    }
    const filtered = guests.filter(guest =>
      guest.fullName.toLowerCase().includes(inputValue.toLowerCase()) ||
      guest.email.toLowerCase().includes(inputValue.toLowerCase())
    );
    setGuestSuggestions(filtered);
  };

  const filterReservationSuggestions = (inputValue: string) => {
    if (!inputValue) {
      setReservationSuggestions([]);
      return;
    }
    const filtered = reservations.filter(reservation =>
      reservation.reservationNumber?.toLowerCase().includes(inputValue.toLowerCase())
    );
    setReservationSuggestions(filtered);
  };

  const handleGuestSelect = (guest: Guest) => {
    setGuestOrCompany(guest.fullName);
    setGuestEmail(guest.email || '');
    setGuestPhone(guest.phone || '');
    setSelectedGuestId(guest.id);
    setGuestSuggestions([]);
  };

  const handleReservationSelect = (reservation: Reservation) => {
    setReservationId(reservation.id);
    setReservationNumberInput(reservation.reservationNumber || reservation.id);
    setReservationSuggestions([]);

    if (reservation.guestId) {
      const guest = guests.find(g => g.id === reservation.guestId);
      if (guest) {
        handleGuestSelect(guest);
      }
    } else {
        setGuestOrCompany(reservation.guestName || '');
        setGuestEmail(reservation.guestEmail || '');
        setGuestPhone(reservation.guestPhone || '');
    }
  };

  const handleLineItemChange = (index: number, field: keyof Omit<InvoiceLineItem, 'id' | 'total'>, value: string | number) => {
    const newLineItems = [...lineItems];
    const item = newLineItems[index];
    
    if (field === 'quantity' || field === 'unitPrice') {
        (item[field] as number) = Number(value) || 0;
    } else if (field === 'description') {
        (item[field] as string) = String(value);
    }
    item.total = item.quantity * item.unitPrice;
    setLineItems(newLineItems);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { id: Date.now().toString(), description: '', quantity: 1, unitPrice: 0, total: 0 }]);
  };

  const removeLineItem = (index: number) => {
    const newLineItems = lineItems.filter((_, i) => i !== index);
    setLineItems(newLineItems);
  };

  const calculateSubtotal = () => lineItems.reduce((sum, item) => sum + item.total, 0);
  
  const calculateDiscountAmount = () => {
    const subtotal = calculateSubtotal();
    if (discountType === 'percentage') {
      return subtotal * (discountValue / 100);
    }
    return discountValue;
  };

  const calculateTax = () => (calculateSubtotal() - calculateDiscountAmount()) * (taxRate / 100);
  const calculateGrandTotal = () => calculateSubtotal() - calculateDiscountAmount() + calculateTax();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    
    const finalSubtotal = calculateSubtotal();
    const finalDiscountAmount = calculateDiscountAmount();
    const finalTax = calculateTax();
    const finalGrandTotal = calculateGrandTotal();

    const invoiceData: any = {
      invoiceNumber,
      dateIssued: invoiceDate ? format(invoiceDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      guestOrCompany,
      guestEmail,
      guestPhone,
      amount: finalGrandTotal,
      dueDate: dueDate ? format(dueDate, "yyyy-MM-dd") : format(addDays(new Date(), 30), "yyyy-MM-dd"),
      lineItems: lineItems.map(({id, ...rest}) => rest),
      paymentStatus: paymentStatus,
      subtotal: finalSubtotal,
      taxAmount: finalTax,
      discountType,
      discountValue,
      discountAmount: finalDiscountAmount,
    };

    if (selectedGuestId) {
        invoiceData.guestId = selectedGuestId;
    }
    if (reservationId) {
        invoiceData.reservationId = reservationId;
    }
    if (notes) {
        invoiceData.notes = notes;
    }
    
    onSave(invoiceData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 py-4 max-h-[80vh] overflow-y-auto pr-2">
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1">
          <Label htmlFor="invoiceNumber">{t('form.invoice_number_label')}</Label>
          <Input id="invoiceNumber" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder={t('form.invoice_number_placeholder')} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="invoiceDate">{t('form.invoice_date_label')}</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !invoiceDate && "text-muted-foreground")}>
                <Icons.CalendarDays className="mr-2 h-4 w-4" />
                {invoiceDate ? format(invoiceDate, "PPP", { locale }) : <span>{t('form.pick_a_date_placeholder')}</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={invoiceDate} onSelect={setInvoiceDate} initialFocus locale={locale} /></PopoverContent>
          </Popover>
        </div>
        <div className="space-y-1">
          <Label htmlFor="dueDate">{t('form.due_date_label')}</Label>
           <Popover>
            <PopoverTrigger asChild>
              <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !dueDate && "text-muted-foreground")}>
                <Icons.CalendarDays className="mr-2 h-4 w-4" />
                {dueDate ? format(dueDate, "PPP", { locale }) : <span>{t('form.pick_a_date_placeholder')}</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus locale={locale} /></PopoverContent>
          </Popover>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-lg font-semibold text-foreground border-b pb-1 mb-2">{t('form.bill_to_heading')}</h3>
        <div className="space-y-1 relative">
            <Label htmlFor="guestOrCompany">{t('form.guest_company_label')}</Label>
            <Input
              id="guestOrCompany"
              value={guestOrCompany}
              onChange={(e) => {
                setGuestOrCompany(e.target.value);
                filterGuestSuggestions(e.target.value);
              }}
              placeholder={t('form.guest_company_placeholder')}
              autoComplete="off"
            />
            {guestSuggestions.length > 0 && (
              <div className="border rounded-md max-h-[150px] overflow-y-auto absolute z-10 bg-background shadow-lg w-full">
                {guestSuggestions.map(guest => (
                  <div
                    key={guest.id}
                    className="px-4 py-2 cursor-pointer hover:bg-accent"
                    onMouseDown={(e) => { e.preventDefault(); handleGuestSelect(guest); }}
                  >
                    {guest.fullName} ({guest.email})
                  </div>
                ))}
              </div>
            )}
          </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="guestEmail">{t('form.guest_email_label')}</Label>
            <Input id="guestEmail" type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} placeholder={t('form.email_placeholder')} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="guestPhone">{t('form.guest_phone_label')}</Label>
            <Input id="guestPhone" type="tel" value={guestPhone} onChange={e => setGuestPhone(e.target.value)} placeholder={t('form.phone_placeholder')} />
          </div>
        </div>
        <div className="space-y-1 relative">
            <Label htmlFor="reservationNumber">{t('form.reservation_number_label')}</Label>
            <Input
              id="reservationNumber"
              value={reservationNumberInput}
              onChange={(e) => {
                setReservationNumberInput(e.target.value);
                filterReservationSuggestions(e.target.value);
              }}
              placeholder={t('form.reservation_number_placeholder')}
              autoComplete="off"
            />
             {reservationSuggestions.length > 0 && (
              <div className="border rounded-md max-h-[150px] overflow-y-auto absolute z-10 bg-background shadow-lg w-full">
                 {reservationSuggestions.map(reservation => (
                  <div
                    key={reservation.id}
                    className="px-4 py-2 cursor-pointer hover:bg-accent"
                    onMouseDown={(e) => { e.preventDefault(); handleReservationSelect(reservation); }}
                  >
                    {reservation.reservationNumber} - {reservation.guestName}
                  </div>
                 ))}
              </div>
            )}
          </div>
      </section>
      
      <section className="space-y-2">
        <h3 className="text-lg font-semibold text-foreground border-b pb-1 mb-2">{t('form.line_items_heading')}</h3>
        <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
            <div className="col-span-5">{t('form.line_items.description')}</div>
            <div className="col-span-2">{t('form.line_items.quantity')}</div>
            <div className="col-span-2">{t('form.line_items.unit_price')}</div>
            <div className="col-span-2">{t('form.line_items.total')}</div>
        </div>
        {lineItems.map((item, index) => (
          <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
            <Input className="col-span-5" placeholder={t('form.description_placeholder')} value={item.description} onChange={(e) => handleLineItemChange(index, 'description', e.target.value)} />
            <Input className="col-span-2" type="number" placeholder={t('form.qty_placeholder')} value={item.quantity} onChange={(e) => handleLineItemChange(index, 'quantity', e.target.value)} min="0"/>
            <Input className="col-span-2" type="number" placeholder={t('form.unit_price_placeholder')} value={item.unitPrice} onChange={(e) => handleLineItemChange(index, 'unitPrice', e.target.value)} step="0.01" min="0"/>
            <Input className="col-span-2" type="number" placeholder={t('form.total_placeholder')} value={item.total.toFixed(2)} disabled />
            <Button type="button" variant="ghost" size="icon" onClick={() => removeLineItem(index)} className="col-span-1 text-destructive hover:text-destructive-foreground hover:bg-destructive/90">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={addLineItem} className="mt-2">
          <Icons.PlusCircle className="mr-2 h-4 w-4" /> {t('form.add_line_item_button')}
        </Button>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 pt-4 border-t mt-4">
        <div className="space-y-3">
             <div className="space-y-1">
                <Label htmlFor="paymentStatus">{t('form.payment_status_label')}</Label>
                 <Select value={paymentStatus} onValueChange={(value) => setPaymentStatus(value as Invoice['paymentStatus'])}>
                    <SelectTrigger id="paymentStatus"><SelectValue placeholder={t('form.payment_status_placeholder')} /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Draft">{t('form.status_options.draft')}</SelectItem>
                        <SelectItem value="Pending">{t('form.status_options.pending')}</SelectItem>
                        <SelectItem value="Paid">{t('form.status_options.paid')}</SelectItem>
                        <SelectItem value="Overdue">{t('form.status_options.overdue')}</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-1">
                <Label htmlFor="paymentTerms">{t('form.payment_terms_label')}</Label>
                <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                    <SelectTrigger id="paymentTerms"><SelectValue placeholder={t('form.payment_terms_placeholder')} /></SelectTrigger>
                    <SelectContent>
                    <SelectItem value="Due on receipt">{t('form.terms_options.due_on_receipt')}</SelectItem>
                    <SelectItem value="Net 15">{t('form.terms_options.net_15')}</SelectItem>
                    <SelectItem value="Net 30">{t('form.terms_options.net_30')}</SelectItem>
                    <SelectItem value="Net 60">{t('form.terms_options.net_60')}</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-1">
                <Label htmlFor="notes">{t('form.notes_label')}</Label>
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('form.notes_placeholder')} />
            </div>
        </div>
        <div className="space-y-2 md:pl-8">
            <div className="flex justify-between items-center">
                <Label>{t('form.subtotal_label')}:</Label>
                <span>{currencySymbol}{calculateSubtotal().toFixed(2)}</span>
            </div>
             <div className="space-y-2">
                <Label>{t('form.discount_label')}</Label>
                <div className="flex items-center gap-2">
                    <RadioGroup value={discountType} onValueChange={(v) => setDiscountType(v as any)} className="flex gap-2">
                        <div className="flex items-center space-x-1"><RadioGroupItem value="fixed" id="dt_fixed" /><Label htmlFor="dt_fixed" className="text-xs font-normal">{t('form.discount_type_fixed')}</Label></div>
                        <div className="flex items-center space-x-1"><RadioGroupItem value="percentage" id="dt_percent" /><Label htmlFor="dt_percent" className="text-xs font-normal">{t('form.discount_type_percentage')}</Label></div>
                    </RadioGroup>
                    <div className="relative flex-grow flex items-center">
                        <Input id="discountValue" type="number" value={discountValue} onChange={(e) => setDiscountValue(Number(e.target.value))} className={cn("w-full text-right", discountType === 'fixed' ? 'pl-7' : 'pr-7')} step="0.01" min="0"/>
                        <span className={cn("absolute text-xs text-muted-foreground pointer-events-none", discountType === 'fixed' ? "left-2.5" : "right-2.5")}>
                            {discountType === 'fixed' ? currencySymbol : '%'}
                        </span>
                    </div>
                </div>
                 {discountValue > 0 && (
                    <div className="text-right text-xs text-muted-foreground">
                        {t('form.discount_amount_label')}: -{currencySymbol}{calculateDiscountAmount().toFixed(2)}
                    </div>
                )}
            </div>
             <div className="flex justify-between items-center">
                <Label htmlFor="taxRate" className="flex-shrink-0 mr-2">{t('form.tax_rate_label')}:</Label>
                <Input id="taxRate" type="number" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} className="w-20 h-8 text-right" step="0.01" min="0"/>
            </div>
            <div className="flex justify-between items-center">
                <Label>{t('form.tax_amount_label')}:</Label>
                <span>{currencySymbol}{calculateTax().toFixed(2)}</span>
            </div>
            <div className="border-t my-1"></div>
            <div className="flex justify-between items-center font-semibold text-lg">
                <Label>{t('form.grand_total_label')}:</Label>
                <span>{currencySymbol}{calculateGrandTotal().toFixed(2)}</span>
            </div>
        </div>
      </section>

      <DialogFooter className="pt-6">
        <DialogClose asChild>
          <Button type="button" variant="outline" onClick={onClose}>{t('form.buttons.cancel')}</Button>
        </DialogClose>
        <Button type="submit">{initialData ? t('form.buttons.save_changes') : t('form.buttons.create_invoice')}</Button>
      </DialogFooter>
    </form>
  );
}
