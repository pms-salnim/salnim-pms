
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PlusCircle, Calendar as CalendarIcon } from "lucide-react";
import { useAuth } from '@/contexts/auth-context';
import { db, app } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import type { Expense } from '@/types/expense';
import { Icons } from '@/components/icons';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useTranslation } from 'react-i18next';
import ExpenseStats from '@/components/revenue/expense-stats';
import ExpenseForm from '@/components/revenue/expense-form';
import ExpenseList from '@/components/revenue/expense-list';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { addDays, format, startOfDay, endOfDay, startOfMonth, endOfMonth, isWithinInterval, subDays, startOfWeek, endOfWeek } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { enUS, fr } from 'date-fns/locale';

export default function ExpensesPage() {
  const { user, property, isLoadingAuth } = useAuth();
  const { t, i18n } = useTranslation('pages/revenue/expenses');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  const locale = i18n.language === 'fr' ? fr : enUS;

  useEffect(() => {
    if (!user?.propertyId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const expensesQuery = query(collection(db, "expenses"), where("propertyId", "==", user.propertyId), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(expensesQuery, (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense)));
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching expenses:", error);
      toast({ title: t('toasts.error_fetching'), variant: "destructive" });
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [user?.propertyId, t]);

  const filteredExpenses = useMemo(() => {
    if (!dateRange?.from) return expenses;
    const fromDate = startOfDay(dateRange.from);
    const toDate = dateRange.to ? endOfDay(dateRange.to) : fromDate;

    return expenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      return isWithinInterval(expenseDate, { start: fromDate, end: toDate });
    });
  }, [expenses, dateRange]);


  const handleOpenModal = (expense: Expense | null = null) => {
    setEditingExpense(expense);
    setIsModalOpen(true);
  };
  
  const handleCloseModal = () => {
      setIsModalOpen(false);
      setEditingExpense(null);
  }

  const { totalExpenses, fixedExpenses, variableExpenses } = useMemo(() => {
    const total = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const fixed = filteredExpenses.filter(exp => exp.expenseType === 'Fixe').reduce((sum, exp) => sum + exp.amount, 0);
    const variable = total - fixed;
    return { totalExpenses: total, fixedExpenses: fixed, variableExpenses: variable };
  }, [filteredExpenses]);
  
  const setPresetDateRange = (preset: "this_month") => {
    const today = new Date();
    if (preset === "this_month") {
      setDateRange({ from: startOfMonth(today), to: endOfMonth(today) });
    }
  };


  if (isLoadingAuth) {
    return <div className="flex h-full items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>;
  }

  if (!user?.permissions?.finance) {
    return (
      <Alert variant="destructive">
        <Icons.AlertCircle className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>
          You do not have permission to view this page.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground font-headline">{t('title')}</h1>
            <p className="text-muted-foreground">{t('description')}</p>
            </div>
             <div className="flex items-center gap-2">
                <Dialog open={isModalOpen} onOpenChange={(isOpen) => { setIsModalOpen(isOpen); if (!isOpen) handleCloseModal(); }}>
                    <DialogTrigger asChild>
                        <Button onClick={() => handleOpenModal()}>
                            <PlusCircle className="mr-2 h-4 w-4" /> {t('add_expense_button')}
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingExpense ? t('form.edit_title') : t('form.add_title')}</DialogTitle>
                            <DialogDescription>
                                {editingExpense ? t('form.edit_description') : t('form.add_description')}
                            </DialogDescription>
                        </DialogHeader>
                        <ExpenseForm onClose={handleCloseModal} initialData={editingExpense} />
                    </DialogContent>
                </Dialog>
            </div>
        </div>
        
        <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="dateRangePicker"
                  variant={"outline"}
                  className={cn(
                    "w-[300px] justify-start text-left font-normal",
                    !dateRange && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 flex" align="start">
                <div className="flex flex-col space-y-1 border-r p-2">
                    <Button variant="ghost" size="sm" className="justify-start" onClick={() => setPresetDateRange("this_month")}>This Month</Button>
                </div>
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={1}
                  locale={locale}
                />
              </PopoverContent>
            </Popover>
        </div>

        <ExpenseStats 
            total={totalExpenses} 
            fixed={fixedExpenses} 
            variable={variableExpenses} 
            currency={property?.currency || '$'} 
        />

        <ExpenseList expenses={filteredExpenses} isLoading={isLoading} onEdit={handleOpenModal} />
    </div>
  );
}
