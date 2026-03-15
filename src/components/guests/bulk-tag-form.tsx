
"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Label } from '../ui/label';
import { toast } from '@/hooks/use-toast';
import type { GuestTag } from '@/types/guest';
import { guestTagsOptions } from '@/types/guest';
import { Icons } from '../icons';
import { useTranslation } from 'react-i18next';

interface BulkTagFormProps {
  onSave: (tag: GuestTag) => void;
  onClose: () => void;
}

export default function BulkTagForm({ onSave, onClose }: BulkTagFormProps) {
  const { t } = useTranslation('pages/guests/all/content');
  const [selectedTagId, setSelectedTagId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tagToApply = guestTagsOptions.find(t => t.id === selectedTagId);
    if (!tagToApply) {
      toast({ title: "Error", description: "Please select a valid tag to apply.", variant: "destructive" });
      return;
    }
    onSave(tagToApply);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4">
      <div className="space-y-1">
        <Label htmlFor="tag-select">{t('bulk_tag_modal.label')}</Label>
        <Select value={selectedTagId} onValueChange={setSelectedTagId}>
            <SelectTrigger id="tag-select">
                <SelectValue placeholder={t('bulk_tag_modal.placeholder')} />
            </SelectTrigger>
            <SelectContent>
                {guestTagsOptions.map(tag => {
                    const IconComponent = tag.icon ? Icons[tag.icon] : null;
                    return (
                        <SelectItem key={tag.id} value={tag.id}>
                            <div className="flex items-center gap-2">
                                {IconComponent && <IconComponent className="h-4 w-4" />}
                                {tag.label}
                            </div>
                        </SelectItem>
                    );
                })}
            </SelectContent>
        </Select>
      </div>

      <DialogFooter className="pt-4 border-t">
        <DialogClose asChild><Button type="button" variant="outline" onClick={onClose}>{t('bulk_tag_modal.buttons.cancel')}</Button></DialogClose>
        <Button type="submit">{t('bulk_tag_modal.buttons.apply')}</Button>
      </DialogFooter>
    </form>
  );
}
