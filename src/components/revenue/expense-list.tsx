
"use client";

import React, { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { Icons } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { format, parseISO } from 'date-fns';
import { useAuth } from '@/contexts/auth-context';
import type { Expense } from '@/types/expense';
import { useTranslation } from 'react-i18next';
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
import { toast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { deleteDoc, doc } from 'firebase/firestore';


interface ExpenseListProps {
  expenses: Expense[];
  isLoading: boolean;
  onEdit: (expense: Expense) => void;
}

export default function ExpenseList({ expenses, isLoading, onEdit }: ExpenseListProps) {
  const { property } = useAuth();
  const currencySymbol = property?.currency || '$';
  const { t } = useTranslation('pages/revenue/expenses');

  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Pagination state - can be re-enabled if needed
  // const [currentPage, setCurrentPage] = useState(1);
  // const [itemsPerPage, setItemsPerPage] = useState(10);
  // const paginatedExpenses = useMemo(() => {
  //   const startIndex = (currentPage - 1) * itemsPerPage;
  //   return expenses.slice(startIndex, startIndex + itemsPerPage);
  // }, [expenses, currentPage, itemsPerPage]);
  // const totalPages = Math.ceil(expenses.length / itemsPerPage);

  const totalDisplayedAmount = useMemo(() => {
    return expenses.reduce((sum, exp) => sum + exp.amount, 0);
  }, [expenses]);

  const handleDelete = async () => {
    if (!expenseToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'expenses', expenseToDelete.id));
      toast({ title: t('toasts.delete_success_title') });
      setExpenseToDelete(null);
    } catch (error) {
      console.error("Error deleting expense:", error);
      toast({ title: t('toasts.delete_error_title'), variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('list.headers.date')}</TableHead>
                <TableHead>{t('list.headers.name')}</TableHead>
                <TableHead>{t('list.headers.type')}</TableHead>
                <TableHead>{t('list.headers.category')}</TableHead>
                <TableHead className="text-right">{t('list.headers.amount')}</TableHead>
                <TableHead>{t('list.headers.notes')}</TableHead>
                <TableHead className="text-right">{t('list.headers.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center"><Icons.Spinner className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
              ) : expenses.length > 0 ? (
                expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>{format(parseISO(expense.date), 'PP')}</TableCell>
                    <TableCell className="font-medium">{expense.expenseName}</TableCell>
                    <TableCell>
                      <Badge variant={expense.expenseType === 'Fixe' ? 'secondary' : 'outline'}>{t(`types.${expense.expenseType.toLowerCase()}`)}</Badge>
                    </TableCell>
                    <TableCell>{t(`categories.${expense.category.toLowerCase()}`)}</TableCell>
                    <TableCell className="text-right">{currencySymbol}{expense.amount.toFixed(2)}</TableCell>
                    <TableCell className="max-w-xs truncate" title={expense.notes}>{expense.notes || '–'}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEdit(expense)}><Edit className="mr-2 h-4 w-4" /> {t('list.actions.edit')}</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setExpenseToDelete(expense)}><Trash2 className="mr-2 h-4 w-4" /> {t('list.actions.delete')}</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={7} className="h-24 text-center">{t('list.empty_state')}</TableCell></TableRow>
              )}
            </TableBody>
            <TableFooter>
                <TableRow>
                    <TableCell colSpan={4} className="font-semibold">{t('list.total')}</TableCell>
                    <TableCell className="text-right font-bold">{currencySymbol}{totalDisplayedAmount.toFixed(2)}</TableCell>
                    <TableCell colSpan={2}></TableCell>
                </TableRow>
            </TableFooter>
          </Table>
        </div>
        
        <AlertDialog open={!!expenseToDelete} onOpenChange={(open) => !open && setExpenseToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{t('confirm_delete_title')}</AlertDialogTitle>
                    <AlertDialogDescription>{t('confirm_delete_description', { name: expenseToDelete?.expenseName })}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>{t('delete_dialog.cancel_button')}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
                        {isDeleting && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin"/>}
                        {t('delete_dialog.continue_button')}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

    </div>
  );
}
