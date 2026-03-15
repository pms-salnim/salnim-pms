"use client";
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Tag, Check } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const PREDEFINED_LABELS = [
  { name: 'Important', color: 'bg-red-100 text-red-800 border-red-200' },
  { name: 'Work', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { name: 'Personal', color: 'bg-green-100 text-green-800 border-green-200' },
  { name: 'Follow Up', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  { name: 'Urgent', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  { name: 'Guest', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { name: 'Booking', color: 'bg-pink-100 text-pink-800 border-pink-200' },
  { name: 'Payment', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
];

interface LabelManagerProps {
  open: boolean;
  onClose: () => void;
  currentLabels?: string[];
  onApplyLabels?: (labels: string[]) => void;
}

export default function LabelManager({ open, onClose, currentLabels = [], onApplyLabels }: LabelManagerProps) {
  const [selectedLabels, setSelectedLabels] = useState<string[]>(currentLabels);
  const [newLabel, setNewLabel] = useState('');
  const [customLabels, setCustomLabels] = useState<string[]>([]);

  const allLabels = [...PREDEFINED_LABELS.map(l => l.name), ...customLabels];

  const toggleLabel = (label: string) => {
    if (selectedLabels.includes(label)) {
      setSelectedLabels(selectedLabels.filter(l => l !== label));
    } else {
      setSelectedLabels([...selectedLabels, label]);
    }
  };

  const addCustomLabel = () => {
    if (newLabel.trim() && !allLabels.includes(newLabel.trim())) {
      setCustomLabels([...customLabels, newLabel.trim()]);
      setSelectedLabels([...selectedLabels, newLabel.trim()]);
      setNewLabel('');
    }
  };

  const handleApply = () => {
    onApplyLabels?.(selectedLabels);
    onClose();
  };

  const getLabelColor = (labelName: string) => {
    const predefined = PREDEFINED_LABELS.find(l => l.name === labelName);
    return predefined?.color || 'bg-slate-100 text-slate-800 border-slate-200';
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Manage Labels
          </DialogTitle>
          <DialogDescription>
            Add or remove labels to organize your emails
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Create New Label */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Create New Label</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter label name..."
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomLabel()}
                className="flex-1"
              />
              <Button 
                type="button" 
                size="sm" 
                onClick={addCustomLabel}
                disabled={!newLabel.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Available Labels */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Available Labels</Label>
            <ScrollArea className="h-[280px] border rounded-lg p-3">
              <div className="space-y-2">
                {PREDEFINED_LABELS.map((label) => (
                  <div
                    key={label.name}
                    onClick={() => toggleLabel(label.name)}
                    className={cn(
                      "flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors hover:bg-slate-50",
                      selectedLabels.includes(label.name) && "bg-blue-50"
                    )}
                  >
                    <Badge variant="outline" className={cn("text-xs", label.color)}>
                      {label.name}
                    </Badge>
                    {selectedLabels.includes(label.name) && (
                      <Check className="h-4 w-4 text-blue-600" />
                    )}
                  </div>
                ))}

                {customLabels.length > 0 && (
                  <>
                    <div className="pt-2 mt-2 border-t">
                      <p className="text-xs font-semibold text-slate-500 mb-2">Custom Labels</p>
                    </div>
                    {customLabels.map((label) => (
                      <div
                        key={label}
                        onClick={() => toggleLabel(label)}
                        className={cn(
                          "flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors hover:bg-slate-50",
                          selectedLabels.includes(label) && "bg-blue-50"
                        )}
                      >
                        <Badge variant="outline" className="text-xs bg-slate-100 text-slate-800 border-slate-200">
                          {label}
                        </Badge>
                        {selectedLabels.includes(label) && (
                          <Check className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Selected Labels Preview */}
          {selectedLabels.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Selected ({selectedLabels.length})</Label>
              <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 rounded-md border">
                {selectedLabels.map((label) => (
                  <Badge 
                    key={label} 
                    variant="outline" 
                    className={cn("text-xs", getLabelColor(label))}
                  >
                    {label}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLabel(label);
                      }}
                      className="ml-1 hover:bg-black/10 rounded-full p-0.5"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleApply}>
            Apply Labels
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
