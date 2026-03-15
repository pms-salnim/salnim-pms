
"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { DialogFooter, DialogClose } from "@/components/ui/dialog";
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

interface BulkLoyaltyAdjustFormProps {
  onSave: (pointsChange: number, reason: string) => void;
  onClose: () => void;
}

export default function BulkLoyaltyAdjustForm({ onSave, onClose }: BulkLoyaltyAdjustFormProps) {
  const { t } = useTranslation('pages/guests/loyalty/content');
  const [action, setAction] = useState<'add' | 'deduct'>('add');
  const [points, setPoints] = useState<number | ''>('');
  const [reason, setReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (points === '' || points <= 0) {
      toast({ title: "Validation Error", description: t('adjust_form.validation.points_required'), variant: "destructive" });
      return;
    }
    if (!reason.trim()) {
        toast({ title: "Validation Error", description: t('adjust_form.validation.reason_required'), variant: "destructive" });
        return;
    }
    const pointsChange = action === 'add' ? points : -points;
    onSave(pointsChange, reason);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
      <RadioGroup value={action} onValueChange={(v) => setAction(v as any)} className="flex gap-4">
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="add" id="action-add-bulk" />
          <Label htmlFor="action-add-bulk" className="cursor-pointer">{t('adjust_form.action_add')}</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="deduct" id="action-deduct-bulk" />
          <Label htmlFor="action-deduct-bulk" className="cursor-pointer">{t('adjust_form.action_deduct')}</Label>
        </div>
      </RadioGroup>

      <div className="space-y-1">
        <Label htmlFor="points-change-bulk">{t('bulk_adjust_form.points_to_action_label', { action })}</Label>
        <Input 
          id="points-change-bulk" 
          type="number" 
          value={points} 
          onChange={(e) => setPoints(e.target.value === '' ? '' : parseInt(e.target.value, 10))} 
          placeholder={t('bulk_adjust_form.points_placeholder')}
          min="1"
          required 
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="reason-bulk">{t('bulk_adjust_form.reason_label')}</Label>
        <Textarea 
          id="reason-bulk" 
          value={reason} 
          onChange={(e) => setReason(e.target.value)} 
          placeholder={t('bulk_adjust_form.reason_placeholder')}
          required
        />
      </div>

      <DialogFooter className="pt-4 border-t">
        <DialogClose asChild><Button type="button" variant="outline" onClick={onClose}>{t('adjust_form.buttons.cancel')}</Button></DialogClose>
        <Button type="submit">{t('bulk_adjust_form.buttons.apply_to_all')}</Button>
      </DialogFooter>
    </form>
  );
}
