'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { ledgerService } from '@/lib/ledgerService';
import type { LedgerEntry } from '@/types/folio';
import { format } from 'date-fns';

interface VoidTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  entry: LedgerEntry | null;
  propertyId: string;
  reservationId: string;
  folioId: string;
  currencySymbol?: string;
}

export function VoidTransactionModal({
  isOpen,
  onClose,
  onSuccess,
  entry,
  propertyId,
  reservationId,
  folioId,
  currencySymbol = '₨',
}: VoidTransactionModalProps) {
  const [voidReason, setVoidReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      setVoidReason('');
      setError(null);
    }
  }, [isOpen]);

  const handleVoid = async () => {
    if (!entry || !voidReason.trim()) {
      setError('Please provide a reason for voiding');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await ledgerService.voidTransaction(
        propertyId,
        reservationId,
        folioId,
        entry.id,
        voidReason.trim()
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to void transaction');
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!entry) return null;

  const oppositeDirection = entry.direction === 'DEBIT' ? 'CREDIT' : 'DEBIT';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Void Transaction</DialogTitle>
          <DialogDescription>
            Void this transaction and create an offsetting entry
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Original Entry Summary */}
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <p className="text-xs font-semibold text-slate-700 mb-2">ORIGINAL ENTRY</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-slate-500 font-medium">Description</p>
                <p className="text-slate-800 font-medium truncate">{entry.description}</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium">Amount</p>
                <p className={`text-slate-800 font-bold ${entry.direction === 'DEBIT' ? 'text-red-600' : 'text-green-600'}`}>
                  {entry.direction === 'DEBIT' ? '+' : '-'}{currencySymbol}{entry.amount.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-slate-500 font-medium">Type</p>
                <p className="text-slate-800 font-medium">{entry.type}</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium">Date</p>
                <p className="text-slate-800 font-medium">
                  {entry.createdAt && new Date(entry.createdAt).getTime() > 0 
                    ? format(new Date(entry.createdAt), 'dd/MM/yy') 
                    : '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Compensating Entry Preview */}
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
            <p className="text-xs font-semibold text-blue-700 mb-2">COMPENSATING ENTRY (Will be created)</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-blue-600 font-medium">Description</p>
                <p className="text-blue-900 font-medium truncate">VOID: {entry.description}</p>
              </div>
              <div>
                <p className="text-blue-600 font-medium">Amount</p>
                <p className={`text-blue-900 font-bold ${oppositeDirection === 'DEBIT' ? 'text-red-600' : 'text-green-600'}`}>
                  {oppositeDirection === 'DEBIT' ? '+' : '-'}{currencySymbol}{entry.amount.toFixed(2)}
                </p>
              </div>
            </div>
            <p className="text-xs text-blue-600 mt-2">
              This reverse entry will zero out the original amount
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Void Reason */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">
              Reason for Voiding *
            </label>
            <textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="e.g., 'Duplicate charge', 'Guest dispute', 'Processing error', etc."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
              disabled={isLoading}
            />
            <p className="text-xs text-slate-500">
              Required for audit trail. This reason will be recorded with the void entry.
            </p>
          </div>

          {/* Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            <p className="font-semibold mb-1">⚠️ This action:</p>
            <ul className="list-disc list-inside space-y-0.5 text-amber-700">
              <li>Creates a reversing entry in the ledger</li>
              <li>Softly deletes the original entry (audit trail preserved)</li>
              <li>Updates running balance automatically</li>
              <li>Cannot be undone - make sure this is correct</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleVoid}
            disabled={isLoading || !voidReason.trim()}
            className="bg-red-600 hover:bg-red-700"
          >
            {isLoading && <Icons.Spinner className="h-4 w-4 mr-2 animate-spin" />}
            Void Transaction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
