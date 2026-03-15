'use client';

import React, { useState, useMemo } from 'react';
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
import type { Folio, LedgerEntry } from '@/types/folio';

interface SplitTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  entry: LedgerEntry | null;
  folios: Folio[];
  originalFolioId: string;
  propertyId: string;
  reservationId: string;
}

interface SplitAllocation {
  folioId: string;
  folioName: string;
  amount: number;
  percentage: number;
}

export function SplitTransactionModal({
  isOpen,
  onClose,
  onSuccess,
  entry,
  folios,
  originalFolioId,
  propertyId,
  reservationId,
}: SplitTransactionModalProps) {
  const [allocations, setAllocations] = useState<SplitAllocation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [splitMode, setSplitMode] = useState<'percentage' | 'fixed'>('percentage');

  // Initialize allocations when modal opens
  React.useEffect(() => {
    if (isOpen && entry) {
      // Start with empty allocations
      setAllocations([]);
      setError(null);
    }
  }, [isOpen, entry]);

  // Calculate total allocated amount
  const totalAmount = useMemo(
    () => allocations.reduce((sum, a) => sum + a.amount, 0),
    [allocations]
  );

  const remainingAmount = entry ? entry.amount - totalAmount : 0;

  // Get available folios (exclude original folio)
  const availableFolios = useMemo(
    () => folios.filter(f => f.id !== originalFolioId),
    [folios, originalFolioId]
  );

  // Add allocation
  const handleAddAllocation = () => {
    if (allocations.length < availableFolios.length && entry) {
      const nextFolio = availableFolios.find(
        f => !allocations.some(a => a.folioId === f.id)
      );

      if (nextFolio) {
        if (splitMode === 'percentage') {
          // Default 50% for percentage mode
          const percentage = 50;
          const amount = Math.round((entry.amount * percentage / 100) * 100) / 100;
          
          setAllocations([
            ...allocations,
            {
              folioId: nextFolio.id,
              folioName: nextFolio.name,
              amount: amount,
              percentage: percentage,
            },
          ]);
        } else {
          // Default 50% (half amount) for fixed mode
          const amount = Math.round((entry.amount / 2) * 100) / 100;
          const percentage = 50;
          
          setAllocations([
            ...allocations,
            {
              folioId: nextFolio.id,
              folioName: nextFolio.name,
              amount: amount,
              percentage: percentage,
            },
          ]);
        }
      }
    }
  };

  // Update allocation amount
  const handleUpdateAmount = (index: number, newAmount: number) => {
    const updated = [...allocations];
    updated[index].amount = Math.max(0, newAmount);
    
    // Update percentage based on mode
    if (entry) {
      if (splitMode === 'percentage') {
        // User is entering amount, calculate percentage
        updated[index].percentage = newAmount > 0 ? Math.round((newAmount / entry.amount) * 100 * 100) / 100 : 0;
      } else {
        // User is entering amount directly
        updated[index].percentage = newAmount > 0 ? Math.round((newAmount / entry.amount) * 100 * 100) / 100 : 0;
      }
    }
    
    setAllocations(updated);
  };

  // Update allocation percentage
  const handleUpdatePercentage = (index: number, newPercentage: number) => {
    const updated = [...allocations];
    updated[index].percentage = Math.max(0, Math.min(100, newPercentage));
    
    // Calculate amount based on percentage
    if (entry) {
      updated[index].amount = Math.round((entry.amount * updated[index].percentage / 100) * 100) / 100;
    }
    
    setAllocations(updated);
  };

  // Change folio for allocation
  const handleChangeFolio = (index: number, newFolioId: string) => {
    const newFolio = availableFolios.find(f => f.id === newFolioId);
    if (newFolio && !allocations.some((a, i) => i !== index && a.folioId === newFolioId)) {
      const updated = [...allocations];
      updated[index].folioId = newFolioId;
      updated[index].folioName = newFolio.name;
      setAllocations(updated);
    }
  };

  // Remove allocation
  const handleRemoveAllocation = (index: number) => {
    setAllocations(allocations.filter((_, i) => i !== index));
  };

  // Submit split
  const handleSplit = async () => {
    if (!entry || allocations.length === 0) {
      setError('Please add at least one allocation');
      return;
    }

    if (totalAmount === 0) {
      setError('Allocations must be greater than 0');
      return;
    }

    if (totalAmount > entry.amount) {
      setError(`Total allocations (${totalAmount.toFixed(2)}) cannot exceed charge amount (${entry.amount.toFixed(2)})`);
      return;
    }

    // Validate all required fields are present
    if (!propertyId || !reservationId || !originalFolioId || !entry.id) {
      console.error('Missing required fields:', {
        propertyId,
        reservationId,
        originalFolioId,
        entryId: entry.id,
      });
      setError('Missing required information. Please close and try again.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Prepare allocations with correct structure
      const allocationsData = allocations.map(a => ({
        folioId: a.folioId,
        percentage: (a.amount / entry.amount) * 100,
      }));

      // Log for debugging
      console.log('Split transaction params:', {
        propertyId,
        reservationId,
        originalFolioId,
        originalEntryId: entry.id,
        allocations: allocationsData,
      });

      const result = await ledgerService.splitTransaction(
        propertyId,
        reservationId,
        originalFolioId,
        entry.id,
        allocationsData
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to split transaction');
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Split error:', err);
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!entry) return null;

  // Guard: ensure all required props are present
  if (!propertyId || !reservationId || !originalFolioId) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Split Transaction</DialogTitle>
          <DialogDescription>
            Allocate transaction amounts to multiple folios
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Original Entry Summary */}
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-slate-500 font-medium">Description</p>
                <p className="text-slate-800 font-medium truncate">{entry.description}</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium">Amount</p>
                <p className="text-slate-800 font-medium">{entry.amount.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium">Type</p>
                <p className="text-slate-800 font-medium">{entry.type}</p>
              </div>
            </div>
          </div>

          {/* Split Mode Toggle */}
          <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span className="text-xs font-semibold text-slate-700">Split Mode:</span>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="percentage"
                  checked={splitMode === 'percentage'}
                  onChange={(e) => setSplitMode('percentage')}
                  disabled={isLoading}
                  className="w-4 h-4"
                />
                <span className="text-xs text-slate-700">Percentage Split</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="fixed"
                  checked={splitMode === 'fixed'}
                  onChange={(e) => setSplitMode('fixed')}
                  disabled={isLoading}
                  className="w-4 h-4"
                />
                <span className="text-xs text-slate-700">Fixed Amount Split</span>
              </label>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Allocations */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-700">Allocate Across Folios</p>
            
            {allocations.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No allocations yet</p>
            ) : (
              <div className="space-y-2">
                {allocations.map((alloc, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                    {/* Folio Select */}
                    <select
                      value={alloc.folioId}
                      onChange={(e) => handleChangeFolio(idx, e.target.value)}
                      className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded bg-white"
                      disabled={isLoading}
                    >
                      {availableFolios.map(f => (
                        <option key={f.id} value={f.id}>
                          {f.name} ({f.type})
                        </option>
                      ))}
                    </select>

                    {/* Percentage Input or Display */}
                    {splitMode === 'percentage' ? (
                      <>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={alloc.percentage.toFixed(2)}
                          onChange={(e) => handleUpdatePercentage(idx, parseFloat(e.target.value) || 0)}
                          className="w-16 px-2 py-1 text-xs border border-slate-300 rounded text-right font-medium"
                          disabled={isLoading}
                          placeholder="0.00"
                        />
                        <span className="text-xs text-slate-500 whitespace-nowrap">%</span>
                        <span className="text-xs text-slate-600 font-medium">({alloc.amount.toFixed(2)} MAD)</span>
                      </>
                    ) : (
                      <>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={alloc.amount.toFixed(2)}
                          onChange={(e) => handleUpdateAmount(idx, parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 text-xs border border-slate-300 rounded text-right font-medium"
                          disabled={isLoading}
                          placeholder="0.00"
                        />
                        <span className="text-xs text-slate-500 whitespace-nowrap">MAD</span>
                        <span className="text-xs text-slate-600 font-medium">({alloc.percentage.toFixed(2)}%)</span>
                      </>
                    )}

                    {/* Remove Button */}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveAllocation(idx)}
                      disabled={isLoading}
                      className="h-6 w-6 p-0"
                    >
                      <Icons.Trash className="h-3 w-3 text-slate-400 hover:text-red-600" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Allocation Button */}
            {allocations.length < availableFolios.length && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddAllocation}
                disabled={isLoading}
                className="w-full text-xs"
              >
                <Icons.PlusCircle className="h-3 w-3 mr-1" />
                Add Allocation
              </Button>
            )}
          </div>

          {/* Amount Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-slate-700">Total Allocated</span>
              <span className={totalAmount > entry.amount ? 'text-red-600' : 'text-slate-700'}>
                {totalAmount.toFixed(2)} MAD
              </span>
            </div>
            <div className="flex justify-between text-xs text-slate-600 mt-1">
              <span>Original Charge</span>
              <span className="font-medium text-slate-700">{entry.amount.toFixed(2)} MAD</span>
            </div>
            {remainingAmount > 0 && (
              <div className="flex justify-between text-xs text-slate-600 mt-1">
                <span>Remains on Original Folio</span>
                <span className="font-medium text-slate-700">{remainingAmount.toFixed(2)} MAD</span>
              </div>
            )}
            {remainingAmount === 0 && totalAmount > 0 && (
              <div className="flex justify-between text-xs text-green-600 mt-1 font-medium">
                <span>All amount allocated</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSplit}
            disabled={isLoading || allocations.length === 0 || totalAmount === 0 || totalAmount > entry.amount}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading && <Icons.Spinner className="h-4 w-4 mr-2 animate-spin" />}
            Split Transaction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
