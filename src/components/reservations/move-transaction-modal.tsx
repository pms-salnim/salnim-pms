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
import type { LedgerEntry, Folio } from '@/types/folio';
import { format } from 'date-fns';

interface MoveTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  entry: LedgerEntry | null;
  folios: Folio[];
  currentFolioId: string;
  propertyId: string;
  reservationId: string;
  currencySymbol?: string;
}

export function MoveTransactionModal({
  isOpen,
  onClose,
  onSuccess,
  entry,
  folios,
  currentFolioId,
  propertyId,
  reservationId,
  currencySymbol = '₨',
}: MoveTransactionModalProps) {
  const [targetFolioId, setTargetFolioId] = useState('');
  const [moveReason, setMoveReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens
  React.useEffect(() => {
    if (isOpen && entry) {
      setTargetFolioId('');
      setMoveReason('');
      setError(null);
    }
  }, [isOpen, entry]);

  // Available folios (exclude current folio)
  const availableFolios = folios.filter(f => f.id !== currentFolioId);

  const handleMove = async () => {
    if (!entry || !targetFolioId || !moveReason.trim()) {
      setError('Please select target folio and provide a reason');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await ledgerService.moveTransaction(
        propertyId,
        reservationId,
        currentFolioId,
        targetFolioId,
        entry.id,
        moveReason.trim()
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to move transaction');
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

  const targetFolio = folios.find(f => f.id === targetFolioId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Move Transaction</DialogTitle>
          <DialogDescription>
            Move transaction to a different folio
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Location */}
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
            <p className="text-xs font-semibold text-blue-700 mb-2">CURRENT LOCATION</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-blue-600 font-medium">Folio</p>
                <p className="text-blue-900 font-medium">
                  {folios.find(f => f.id === currentFolioId)?.name || currentFolioId}
                </p>
              </div>
              <div>
                <p className="text-blue-600 font-medium">Amount</p>
                <p className={`text-blue-900 font-bold ${entry.direction === 'DEBIT' ? 'text-red-600' : 'text-green-600'}`}>
                  {entry.direction === 'DEBIT' ? '+' : '-'}{currencySymbol}{entry.amount.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* Entry Details */}
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <p className="text-xs font-semibold text-slate-700 mb-2">ENTRY DETAILS</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-slate-500 font-medium">Description</p>
                <p className="text-slate-800 font-medium truncate">{entry.description}</p>
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
              {entry.category && (
                <div>
                  <p className="text-slate-500 font-medium">Category</p>
                  <p className="text-slate-800 font-medium">{entry.category}</p>
                </div>
              )}
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Target Folio Selection */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">
              Move to Folio *
            </label>
            <select
              value={targetFolioId}
              onChange={(e) => setTargetFolioId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            >
              <option value="">-- Select target folio --</option>
              {availableFolios.map(folio => (
                <option key={folio.id} value={folio.id}>
                  {folio.name} ({folio.type})
                </option>
              ))}
            </select>
            {availableFolios.length === 0 && (
              <p className="text-xs text-red-600">No other folios available</p>
            )}
          </div>

          {/* New Location Preview */}
          {targetFolio && (
            <div className="bg-green-50 p-3 rounded-lg border border-green-200">
              <p className="text-xs font-semibold text-green-700 mb-2">NEW LOCATION</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-green-600 font-medium">Folio</p>
                  <p className="text-green-900 font-medium">{targetFolio.name}</p>
                </div>
                <div>
                  <p className="text-green-600 font-medium">Amount</p>
                  <p className={`text-green-900 font-bold ${entry.direction === 'DEBIT' ? 'text-red-600' : 'text-green-600'}`}>
                    {entry.direction === 'DEBIT' ? '+' : '-'}{currencySymbol}{entry.amount.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Move Reason */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">
              Reason for Moving *
            </label>
            <textarea
              value={moveReason}
              onChange={(e) => setMoveReason(e.target.value)}
              placeholder="e.g., 'Guest requested transfer', 'Accounting correction', 'Folio consolidation', etc."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
              disabled={isLoading}
            />
            <p className="text-xs text-slate-500">
              Required for audit trail.
            </p>
          </div>

          {/* Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            <p className="font-semibold mb-1">⚠️ This action:</p>
            <ul className="list-disc list-inside space-y-0.5 text-amber-700">
              <li>Creates new entry in target folio with same amount</li>
              <li>Softly deletes entry from current folio</li>
              <li>Updates running balance in both folios automatically</li>
              <li>Cannot be undone - verify target folio is correct</li>
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
            onClick={handleMove}
            disabled={isLoading || !targetFolioId || !moveReason.trim()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading && <Icons.Spinner className="h-4 w-4 mr-2 animate-spin" />}
            Move Transaction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
