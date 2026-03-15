
"use client";

import React, { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DialogFooter, DialogClose } from "@/components/ui/dialog";
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation } from 'react-i18next';
import type { Guest } from '@/types/guest';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { cn } from '@/lib/utils';
import { Icons } from '../icons';

interface RedeemPointsFormProps {
  guest: Guest | null;
  onSave: (pointsChange: number, reason: string) => void;
  onClose: () => void;
}

export default function RedeemPointsForm({ guest, onSave, onClose }: RedeemPointsFormProps) {
  const { property } = useAuth();
  const { t } = useTranslation('pages/guests/loyalty/content');
  const [redeemType, setRedeemType] = useState<'amount' | 'points'>('amount');
  const [points, setPoints] = useState<number | ''>('');
  const [amount, setAmount] = useState<number | ''>('');
  const [reason, setReason] = useState(t('redeem_form.default_reason'));

  if (!guest) return null;

  const redemptionRate = property?.loyaltyProgramSettings?.redemptionRate || 0.01;
  const currencySymbol = property?.currency || '$';
  const availablePoints = (guest.totalPointsEarned || 0) - (guest.totalPointsRedeemed || 0);
  const maxRedeemableValue = availablePoints * redemptionRate;

  const handlePointsChange = (value: string) => {
    const numericValue = value === '' ? '' : parseFloat(value);
    setPoints(numericValue);
    if (redeemType === 'points' && numericValue !== '') {
        setAmount(parseFloat((Number(numericValue) * redemptionRate).toFixed(2)));
    }
  };

  const handleAmountChange = (value: string) => {
    const numericValue = value === '' ? '' : parseFloat(value);
    setAmount(numericValue);
    if (redeemType === 'amount' && numericValue !== '') {
        const requiredPoints = redemptionRate > 0 ? Number(numericValue) / redemptionRate : 0;
        setPoints(requiredPoints);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalPointsToRedeem = Number(points);

    if (!finalPointsToRedeem || finalPointsToRedeem <= 0) {
      toast({ title: "Validation Error", description: t('redeem_form.validation.points_required'), variant: "destructive" });
      return;
    }
    if (finalPointsToRedeem > availablePoints) {
      toast({ title: "Validation Error", description: t('redeem_form.validation.insufficient_points'), variant: "destructive" });
      return;
    }
    if (!reason.trim()) {
      toast({ title: "Validation Error", description: t('redeem_form.validation.reason_required'), variant: "destructive" });
      return;
    }
    
    onSave(finalPointsToRedeem, reason);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
      <div>
        <Label>{t('redeem_form.current_balance_label')}</Label>
        <p className="text-2xl font-bold">{availablePoints.toFixed(2)} {t('redeem_form.points_label')}
          <span className="text-lg font-normal text-muted-foreground ml-2">({currencySymbol}{maxRedeemableValue.toFixed(2)})</span>
        </p>
      </div>

       <RadioGroup value={redeemType} onValueChange={(v) => setRedeemType(v as any)} className="flex gap-4">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="amount" id="redeem-amount" />
            <Label htmlFor="redeem-amount" className="cursor-pointer">{t('redeem_form.redeem_by_amount_label')}</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="points" id="redeem-points" />
            <Label htmlFor="redeem-points" className="cursor-pointer">{t('redeem_form.redeem_by_points_label')}</Label>
          </div>
      </RadioGroup>
      
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
        <div className={cn("space-y-1", redeemType === 'amount' ? "md:col-span-3" : "md:col-span-2")}>
           <Label htmlFor="amount-to-redeem">{t('redeem_form.redeem_amount_label')} ({currencySymbol})</Label>
           <Input 
            id="amount-to-redeem" 
            type="number" 
            value={amount} 
            onChange={(e) => handleAmountChange(e.target.value)}
            placeholder="e.g., 50.00"
            min="0.01"
            max={maxRedeemableValue.toFixed(2)}
            step="0.01"
            readOnly={redeemType === 'points'}
          />
        </div>

        <div className="md:col-span-1 text-center font-semibold text-muted-foreground self-end pb-2">
          <Icons.ArrowRightLeft className="mx-auto h-5 w-5" />
        </div>
        
        <div className={cn("space-y-1", redeemType === 'points' ? "md:col-span-3" : "md:col-span-2")}>
          <Label htmlFor="points-to-redeem">{t('redeem_form.redeem_points_label')}</Label>
          <Input 
            id="points-to-redeem" 
            type="number" 
            value={points === '' ? '' : Number(points).toFixed(2)} 
            onChange={(e) => handlePointsChange(e.target.value)}
            placeholder="e.g., 1000.00"
            min="0.01"
            step="0.01"
            max={availablePoints}
            readOnly={redeemType === 'amount'}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="redeem-reason">{t('redeem_form.reason_label')}</Label>
        <Textarea 
          id="redeem-reason" 
          value={reason} 
          onChange={(e) => setReason(e.target.value)} 
          placeholder={t('redeem_form.reason_placeholder')}
          required
        />
      </div>

      <DialogFooter className="pt-4 border-t">
        <DialogClose asChild><Button type="button" variant="outline">{t('redeem_form.buttons.cancel')}</Button></DialogClose>
        <Button type="submit">{t('redeem_form.buttons.redeem')}</Button>
      </DialogFooter>
    </form>
  );
}
