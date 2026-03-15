
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { format } from "date-fns";
import { DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

import { collection, onSnapshot, query, where } from 'firebase/firestore';
import type { Guest } from '@/types/guest';
import type { Reservation } from '@/components/calendar/types';
import type { Invoice } from '@/app/(app)/payments/page';
import { db } from '@/lib/firebase';
import { useTranslation } from 'react-i18next';

export interface ManualPaymentData {
  id?: string;
  amountReceived: number;
  paymentMethod: string;
  paymentDate: string;
  guestName?: string;
  folioId?: string;
  notes?: string;
  collectPayment?: 'charge' | 'pre-authorize' | 'paid-previously';
  useCurrentDate?: boolean;
  creditCardNumber?: string;
  creditCardType?: string;
  creditCardToken?: string; // Tokenized card (for backend)
  creditCardLast4?: string; // Last 4 digits
  allocatePayment?: boolean;
  folioIds?: string[]; // For allocation
  amounts?: number[]; // For allocation amounts
}

interface PaymentFormProps {
  propertyId: string;
  onClose?: () => void;
  onSave: (paymentData: ManualPaymentData) => void;
  initialData?: Partial<ManualPaymentData>;
  isSaving: boolean;
  balanceDue?: number;
  currencySymbol?: string;
  folios?: Array<{ id: string; name: string; type: string }>;
}

const paymentMethods = ["Cash", "Credit Card", "Bank Transfer", "Online Payment", "Other"];
const creditCardTypes = ["Visa", "Mastercard", "American Express", "Discover", "Other"];
const collectPaymentOptions = [
  { value: 'charge', label: 'Charge' },
  { value: 'pre-authorize', label: 'Pre-authorize' },
  { value: 'paid-previously', label: 'Paid Previously (do not charge)' }
];

export default function PaymentForm({ propertyId, onClose, onSave, initialData, isSaving, balanceDue = 0, currencySymbol = '$', folios = [] }: PaymentFormProps) {
  const { t } = useTranslation('pages/payments/list/payment-form');
  const [amountReceived, setAmountReceived] = useState(initialData?.amountReceived || 0);
  const [paymentMethod, setPaymentMethod] = useState(initialData?.paymentMethod || "Cash");
  const [paymentDate, setPaymentDate] = useState<Date | undefined>(initialData?.paymentDate ? new Date(initialData.paymentDate) : new Date());
  const [useCurrentDate, setUseCurrentDate] = useState(initialData?.useCurrentDate !== false);
  
  const [amountError, setAmountError] = useState('');
  const [methodError, setMethodError] = useState('');
  const [dateError, setDateError] = useState('');

  const [notes, setNotes] = useState(initialData?.notes || "");
  const [guestInput, setGuestInput] = useState(initialData?.guestName || '');
  const [folioId, setFolioId] = useState(initialData?.folioId || '');
  
  const [collectPayment, setCollectPayment] = useState<'charge' | 'pre-authorize' | 'paid-previously'>(initialData?.collectPayment || 'charge');
  const [creditCardNumber, setCreditCardNumber] = useState(initialData?.creditCardNumber || '');
  const [creditCardType, setCreditCardType] = useState(initialData?.creditCardType || '');
  const [allocatePayment, setAllocatePayment] = useState(initialData?.allocatePayment || false);

  useEffect(() => {
    if (initialData) {
      setAmountReceived(initialData.amountReceived || 0);
      setGuestInput(initialData.guestName || '');
      setFolioId(initialData.folioId || '');
    }
  }, [initialData]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    setAmountError('');
    setMethodError('');
    setDateError('');

    let isValid = true;
    if (amountReceived <= 0) {
      setAmountError(t('validation.amount_required'));
      isValid = false;
    }
    if (!paymentMethod) {
      setMethodError(t('validation.method_required'));
      isValid = false;
    }
    if (!useCurrentDate && !paymentDate) {
      setDateError(t('validation.date_required'));
      isValid = false;
    }

    if (!isValid) return;

    // Extract last 4 digits from credit card if provided
    let creditCardLast4: string | undefined;
    let creditCardToken: string | undefined;
    
    if (creditCardNumber && paymentMethod === 'Credit Card') {
      // Get last 4 digits
      creditCardLast4 = creditCardNumber.slice(-4);
      // TODO: In production, tokenize card via Stripe/payment processor
      // For now, create a placeholder token
      creditCardToken = `tok_${creditCardNumber.slice(-4)}_${Date.now()}`;
    }

    const paymentData: ManualPaymentData = {
      amountReceived,
      paymentMethod,
      paymentDate: useCurrentDate ? format(new Date(), "yyyy-MM-dd") : format(paymentDate || new Date(), "yyyy-MM-dd"),
      guestName: guestInput || undefined,
      folioId: folioId || undefined,
      notes: notes || undefined,
      collectPayment,
      useCurrentDate,
      creditCardNumber: creditCardNumber || undefined,
      creditCardType: creditCardType || undefined,
      creditCardToken: creditCardToken,
      creditCardLast4: creditCardLast4,
      allocatePayment,
      id: initialData?.id,
    };
    onSave(paymentData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4">
      {/* Assign to and Select Folio */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="assignTo" className="font-medium text-slate-700">Assign to</Label>
          <Input
            id="assignTo"
            value={guestInput}
            onChange={(e) => setGuestInput(e.target.value)}
            placeholder="Guest name"
            className="text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="folio" className="font-medium text-slate-700">Select Folio</Label>
          <Select value={folioId} onValueChange={setFolioId}>
            <SelectTrigger id="folio" className="text-sm">
              <SelectValue placeholder="Select folio" />
            </SelectTrigger>
            <SelectContent>
              {folios.length > 0 ? (
                folios.map((folio) => (
                  <SelectItem key={folio.id} value={folio.id}>
                    {folio.type === 'guest' ? `Main Folio - ${folio.name}` : folio.name}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="no-folios" disabled>No folios available</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Amount and Payment Type */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="amountReceived" className="font-medium text-slate-700">Amount <span className="text-red-600">*</span></Label>
          <div className="flex items-center gap-2">
            <span className="text-slate-700">{currencySymbol}</span>
            <Input
              id="amountReceived"
              type="number"
              value={amountReceived}
              onChange={(e) => setAmountReceived(Number(e.target.value))}
              placeholder="0.00"
              min="0.01"
              step="0.01"
              required
              className="text-sm flex-1"
            />
          </div>
          {amountError && <p className="text-sm text-destructive">{amountError}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="paymentMethod" className="font-medium text-slate-700">Payment Type <span className="text-red-600">*</span></Label>
          <Select value={paymentMethod} onValueChange={setPaymentMethod} required>
            <SelectTrigger id="paymentMethod" className="text-sm">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {paymentMethods.map((method) => (
                <SelectItem key={method} value={method}>{method}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {methodError && <p className="text-sm text-destructive">{methodError}</p>}
        </div>
      </div>

      {/* Collect Payment */}
      <div className="space-y-2 border-t border-slate-200 pt-4">
        <Label className="font-medium text-slate-700">Collect Payment</Label>
        <div className="space-y-2">
          {collectPaymentOptions.map((option) => (
            <div key={option.value} className="flex items-center gap-2">
              <input
                type="radio"
                id={`collect-${option.value}`}
                name="collectPayment"
                value={option.value}
                checked={collectPayment === option.value}
                onChange={(e) => setCollectPayment(e.target.value as 'charge' | 'pre-authorize' | 'paid-previously')}
                className="w-4 h-4"
              />
              <Label htmlFor={`collect-${option.value}`} className="text-sm text-slate-700 cursor-pointer">{option.label}</Label>
            </div>
          ))}
        </div>
      </div>

      {/* Post Date */}
      <div className="space-y-2 border-t border-slate-200 pt-4">
        <div className="flex items-center gap-2 mb-2">
          <Checkbox
            id="useCurrentDate"
            checked={useCurrentDate}
            onCheckedChange={(checked) => setUseCurrentDate(checked as boolean)}
          />
          <Label htmlFor="useCurrentDate" className="text-sm text-slate-700 cursor-pointer">Post with current date</Label>
        </div>
        
        {!useCurrentDate && (
          <div className="space-y-1">
            <Label htmlFor="paymentDate" className="font-medium text-slate-700">Select Custom Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal text-sm",
                    !paymentDate && "text-muted-foreground"
                  )}
                >
                  <Icons.Calendar className="mr-2 h-4 w-4" />
                  {paymentDate ? format(paymentDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={paymentDate}
                  onSelect={setPaymentDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {dateError && <p className="text-sm text-destructive">{dateError}</p>}
          </div>
        )}
      </div>

      {/* Credit Card Details */}
      <div className="space-y-3 border-t border-slate-200 pt-4">
        <div className="space-y-1">
          <Label htmlFor="creditCardNumber" className="font-medium text-slate-700">Enter and Store Credit Card Details</Label>
          <Input
            id="creditCardNumber"
            type="password"
            value={creditCardNumber}
            onChange={(e) => setCreditCardNumber(e.target.value)}
            placeholder="Card number (stored securely)"
            className="text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="creditCardType" className="font-medium text-slate-700">Credit Card Type</Label>
          <Select value={creditCardType} onValueChange={setCreditCardType}>
            <SelectTrigger id="creditCardType" className="text-sm">
              <SelectValue placeholder="Select card type" />
            </SelectTrigger>
            <SelectContent>
              {creditCardTypes.map((type) => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1 border-t border-slate-200 pt-4">
        <Label htmlFor="notes" className="font-medium text-slate-700">Notes</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Enter payment notes..."
          className="text-sm resize-none"
          rows={3}
        />
      </div>

      {/* Allocate Payment checkbox */}
      <div className="flex items-center gap-2 border-t border-slate-200 pt-4">
        <Checkbox
          id="allocatePayment"
          checked={allocatePayment}
          onCheckedChange={(checked) => setAllocatePayment(checked as boolean)}
        />
        <Label htmlFor="allocatePayment" className="text-sm text-slate-700 cursor-pointer">Allocate Payment</Label>
      </div>

      <DialogFooter className="pt-6">
        {onClose && (
          <DialogClose asChild>
            <Button type="button" variant="outline">Cancel</Button>
          </DialogClose>
        )}
        <Button type="submit" disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white">
          {isSaving && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
          Continue
        </Button>
      </DialogFooter>
    </form>
  );
}
