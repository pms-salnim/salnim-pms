
"use client";

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

import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import type { Expense, ExpenseCategory, ExpenseType } from '@/types/expense';
import { expenseCategories, expenseTypes } from '@/types/expense';
import { useTranslation } from 'react-i18next';

interface ExpenseFormProps {
  onClose: () => void;
  initialData: Expense | null;
}

export default function ExpenseForm({ onClose, initialData }: ExpenseFormProps) {
  const { user } = useAuth();
  const [expenseName, setExpenseName] = useState('');
  const [expenseType, setExpenseType] = useState<ExpenseType>('Variable');
  const [category, setCategory] = useState<ExpenseCategory>('Divers');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useTranslation('pages/revenue/expenses');

  useEffect(() => {
    if (initialData) {
      setExpenseName(initialData.expenseName);
      setExpenseType(initialData.expenseType);
      setCategory(initialData.category);
      setAmount(String(initialData.amount));
      setDate(new Date(initialData.date));
      setNotes(initialData.notes || '');
    } else {
      setExpenseName('');
      setExpenseType('Variable');
      setCategory('Divers');
      setAmount('');
      setDate(new Date());
      setNotes('');
    }
  }, [initialData]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.propertyId || !expenseName || !amount || !date) {
      toast({ title: t('toasts.validation_error_title'), description: t('toasts.validation_error_description'), variant: "destructive" });
      return;
    }
    setIsLoading(true);

    const expenseData = {
      propertyId: user.propertyId,
      expenseName,
      expenseType,
      category,
      amount: Number(amount),
      date: format(date, 'yyyy-MM-dd'),
      notes,
    };

    try {
      if (initialData) {
        const docRef = doc(db, 'expenses', initialData.id);
        await updateDoc(docRef, { ...expenseData, updatedAt: serverTimestamp() });
        toast({ title: t('toasts.update_success_title') });
      } else {
        await addDoc(collection(db, 'expenses'), { ...expenseData, createdAt: serverTimestamp() });
        toast({ title: t('toasts.create_success_title') });
      }
      onClose();
    } catch (error) {
      console.error("Error saving expense:", error);
      toast({ title: t('toasts.error_title'), description: t('toasts.save_error_description'), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
      <div className="space-y-1">
        <Label htmlFor="expenseName">{t('form.name_label')} <span className="text-destructive">*</span></Label>
        <Input id="expenseName" value={expenseName} onChange={e => setExpenseName(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="expenseType">{t('form.type_label')}</Label>
          <Select value={expenseType} onValueChange={(v) => setExpenseType(v as ExpenseType)}>
            <SelectTrigger id="expenseType"><SelectValue /></SelectTrigger>
            <SelectContent>
              {expenseTypes.map(type => <SelectItem key={type} value={type}>{t(`types.${type.toLowerCase()}`)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="category">{t('form.category_label')}</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
            <SelectTrigger id="category"><SelectValue /></SelectTrigger>
            <SelectContent>
              {expenseCategories.map(cat => <SelectItem key={cat} value={cat}>{t(`categories.${cat.toLowerCase()}`)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="amount">{t('form.amount_label')} <span className="text-destructive">*</span></Label>
          <Input id="amount" type="number" value={amount} onChange={e => setAmount(e.target.value)} required min="0" step="0.01" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="date">{t('form.date_label')} <span className="text-destructive">*</span></Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button id="date" variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                <Icons.CalendarDays className="mr-2 h-4 w-4" />
                {date ? format(date, "PPP") : <span>{t('form.date_placeholder')}</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={date} onSelect={setDate} initialFocus /></PopoverContent>
          </Popover>
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="notes">{t('form.notes_label')}</Label>
        <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('form.notes_placeholder')} />
      </div>
      <DialogFooter className="pt-4 border-t">
        <DialogClose asChild><Button type="button" variant="outline">{t('buttons.cancel')}</Button></DialogClose>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
          {t('buttons.save')}
        </Button>
      </DialogFooter>
    </form>
  );
}
