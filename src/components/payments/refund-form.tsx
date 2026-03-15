
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { Icons } from '../icons';
import type { Payment } from '@/app/(app)/payments/page';

interface RefundFormProps {
  payment: Payment;
  onConfirm: (reason: string, amount: number) => void;
  isProcessing: boolean;
  currencySymbol: string;
}

export default function RefundForm({ payment, onConfirm, isProcessing, currencySymbol }: RefundFormProps) {
  const { t } = useTranslation('pages/payments/process_refund');
  const [refundType, setRefundType] = useState<'full' | 'partial'>('full');
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState(payment.amountPaid);

  useEffect(() => {
    if (refundType === 'full') {
      setAmount(payment.amountPaid);
    }
  }, [refundType, payment.amountPaid]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0 || amount > payment.amountPaid) {
      toast({ title: t('validation.invalid_amount_title'), description: t('validation.invalid_amount_description', { amount: payment.amountPaid }), variant: "destructive" });
      return;
    }
    if (!reason.trim()) {
      toast({ title: t('validation.reason_required_title'), description: t('validation.reason_required_description'), variant: "destructive" });
      return;
    }
    onConfirm(reason, amount);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
      <div className="space-y-2">
        <Label>{t('type_label')}</Label>
        <RadioGroup value={refundType} onValueChange={(value) => setRefundType(value as 'full' | 'partial')} className="flex gap-4">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="full" id="refund-full" />
            <Label htmlFor="refund-full" className="cursor-pointer">{t('full_refund_label')}</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="partial" id="refund-partial" />
            <Label htmlFor="refund-partial" className="cursor-pointer">{t('partial_refund_label')}</Label>
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-1">
        <Label htmlFor="refund-amount">{t('amount_label')} ({currencySymbol})</Label>
        <Input 
          id="refund-amount" 
          type="number" 
          value={amount} 
          onChange={(e) => setAmount(Number(e.target.value))}
          max={payment.amountPaid}
          min="0.01"
          step="0.01"
          disabled={refundType === 'full'}
          readOnly={refundType === 'full'}
        />
      </div>
       <div className="space-y-1">
        <Label htmlFor="refund-reason">{t('reason_label')}</Label>
        <Textarea
          id="refund-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t('reason_placeholder')}
          required
        />
      </div>
      <DialogFooter>
        <DialogClose asChild><Button variant="outline">{t('buttons.cancel')}</Button></DialogClose>
        <Button type="submit" disabled={isProcessing}>
          {isProcessing && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
          {t('buttons.confirm')}
        </Button>
      </DialogFooter>
    </form>
  )
}
