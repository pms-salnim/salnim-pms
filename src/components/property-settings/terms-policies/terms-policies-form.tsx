'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertCircle, Plus, X } from 'lucide-react';

interface RefundPolicy {
  id: string;
  daysBeforeCancellation: number;
  refundPercentage: number;
}

interface TermsPoliciesData {
  // Cancellation Policy
  cancellationPolicyType: 'strict' | 'moderate' | 'flexible';
  refundPolicies: RefundPolicy[];
  nonRefundableDeposit: boolean;
  agesPolicy: string;
  childAgeThreshold: number;
  petsPolicy: string;

  // Booking Rules
  minimumStayNights: number;
  maximumStayNights: number;
  sameDayBookingsAllowed: boolean;
  sameDayTurnoverAllowed: boolean;
  advanceBookingRequirementDays: number;
  bookingWindowDays: number;
}

interface TermsPoliciesFormProps {
  initialData?: Partial<TermsPoliciesData>;
  onSave?: (data: TermsPoliciesData) => Promise<void>;
  isLoading?: boolean;
}

const defaultData: TermsPoliciesData = {
  cancellationPolicyType: 'moderate',
  refundPolicies: [],
  nonRefundableDeposit: false,
  agesPolicy: '',
  childAgeThreshold: 12,
  petsPolicy: '',
  minimumStayNights: 1,
  maximumStayNights: 365,
  sameDayBookingsAllowed: false,
  sameDayTurnoverAllowed: false,
  advanceBookingRequirementDays: 0,
  bookingWindowDays: 365,
};

export function TermsPoliciesForm({
  onSave,
  initialData,
  isLoading = false,
}: TermsPoliciesFormProps) {
  const [formData, setFormData] = useState<TermsPoliciesData>(() => ({
    ...defaultData,
    ...(initialData || {}),
  }));

  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({
    type: null,
    message: '',
  });
  const [hasChanges, setHasChanges] = useState(false);

  // Refund Policy Form State
  const [showRefundPolicyForm, setShowRefundPolicyForm] = useState(false);
  const [refundPolicyForm, setRefundPolicyForm] = useState({
    daysBeforeCancellation: '',
    refundPercentage: '',
  });

  const originalData = {
    ...defaultData,
    ...(initialData || {}),
  };

  const handleChange = (field: keyof TermsPoliciesData, value: any) => {
    const newData = {
      ...formData,
      [field]: value,
    };
    setFormData(newData);
    setHasChanges(JSON.stringify(newData) !== JSON.stringify(originalData));
  };

  const handleSave = async () => {
    if (!onSave) {
      console.log('No onSave handler provided');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(formData);
      setSaveStatus({
        type: 'success',
        message: 'Terms & policies saved successfully',
      });
      setHasChanges(false);
      setTimeout(() => setSaveStatus({ type: null, message: '' }), 3000);
    } catch (error) {
      setSaveStatus({
        type: 'error',
        message: 'Failed to save terms & policies. Please try again.',
      });
      setTimeout(() => setSaveStatus({ type: null, message: '' }), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setFormData(originalData);
    setHasChanges(false);
    setSaveStatus({ type: null, message: '' });
  };

  const addRefundPolicy = () => {
    if (!refundPolicyForm.daysBeforeCancellation || !refundPolicyForm.refundPercentage) {
      setSaveStatus({
        type: 'error',
        message: 'Please fill in all refund policy fields',
      });
      setTimeout(() => setSaveStatus({ type: null, message: '' }), 2000);
      return;
    }

    const newPolicy: RefundPolicy = {
      id: Math.random().toString(36).substr(2, 9),
      daysBeforeCancellation: Number(refundPolicyForm.daysBeforeCancellation),
      refundPercentage: Number(refundPolicyForm.refundPercentage),
    };

    handleChange('refundPolicies', [
      ...(formData.refundPolicies || []),
      newPolicy,
    ]);

    setRefundPolicyForm({ daysBeforeCancellation: '', refundPercentage: '' });
    setShowRefundPolicyForm(false);
  };

  const removeRefundPolicy = (policyId: string) => {
    const updatedPolicies = formData.refundPolicies?.filter((p) => p.id !== policyId) || [];
    handleChange('refundPolicies', updatedPolicies);
  };

  return (
    <form className="space-y-8">
      {/* Status Messages */}
      {saveStatus.type && (
        <div
          className={`flex items-center gap-3 p-4 rounded-lg ${
            saveStatus.type === 'success'
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          {saveStatus.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          )}
          <span
            className={
              saveStatus.type === 'success' ? 'text-green-800' : 'text-red-800'
            }
          >
            {saveStatus.message}
          </span>
        </div>
      )}

      {/* Cancellation Policy Container */}
      <div className="bg-white rounded-lg p-6 md:p-8">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          ❌ Cancellation Policy
        </h2>
        <div className="space-y-4">
          {/* Policy Type */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-3">
              Cancellation Policy Type
            </label>
            <div className="space-y-2">
              {['strict', 'moderate', 'flexible'].map((type) => (
                <div key={type} className="flex items-center gap-2">
                  <input
                    type="radio"
                    id={`policy-${type}`}
                    name="cancellationPolicyType"
                    value={type}
                    checked={formData.cancellationPolicyType === type}
                    onChange={(e) => handleChange('cancellationPolicyType', e.target.value as any)}
                    className="w-4 h-4"
                  />
                  <label htmlFor={`policy-${type}`} className="text-sm text-slate-900 cursor-pointer capitalize">
                    {type}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Refund Policies */}
          <div className="pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-900">Refund Policies</h3>
              <Button
                type="button"
                onClick={() => setShowRefundPolicyForm(!showRefundPolicyForm)}
                className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-md text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Refund Policy
              </Button>
            </div>

            {/* Add Refund Policy Form */}
            {showRefundPolicyForm && (
              <div className="mb-4 p-4 border border-blue-200 bg-blue-50 rounded-lg space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-2">
                      Days Before Cancellation <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={refundPolicyForm.daysBeforeCancellation}
                      onChange={(e) =>
                        setRefundPolicyForm({
                          ...refundPolicyForm,
                          daysBeforeCancellation: e.target.value,
                        })
                      }
                      placeholder="e.g., 30, 14, 7, 2"
                      min="0"
                      step="1"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-2">
                      Refund Percentage <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={refundPolicyForm.refundPercentage}
                      onChange={(e) =>
                        setRefundPolicyForm({
                          ...refundPolicyForm,
                          refundPercentage: e.target.value,
                        })
                      }
                      placeholder="0-100"
                      min="0"
                      max="100"
                      step="1"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    onClick={() => {
                      setShowRefundPolicyForm(false);
                      setRefundPolicyForm({ daysBeforeCancellation: '', refundPercentage: '' });
                    }}
                    className="px-4 py-2 bg-white border border-slate-300 text-slate-900 rounded-md hover:bg-slate-50"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={addRefundPolicy}
                    className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-900 rounded-md border border-blue-300"
                  >
                    Add Policy
                  </Button>
                </div>
              </div>
            )}

            {/* Refund Policies Table */}
            {formData.refundPolicies && formData.refundPolicies.length > 0 ? (
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-300 bg-slate-50">
                      <th className="px-4 py-3 text-left font-semibold text-slate-900">Days Before</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-900">Refund %</th>
                      <th className="px-4 py-3 text-center font-semibold text-slate-900">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.refundPolicies.map((policy) => (
                      <tr key={policy.id} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-900">{policy.daysBeforeCancellation}+ days</td>
                        <td className="px-4 py-3 text-slate-900">{policy.refundPercentage}%</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => removeRefundPolicy(policy.id)}
                            className="text-red-500 hover:bg-red-50 p-1 rounded transition-colors"
                            title="Remove policy"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : !showRefundPolicyForm ? (
              <div className="p-4 text-center border border-dashed border-slate-300 rounded-lg">
                <p className="text-slate-500 text-sm">No refund policies added yet</p>
              </div>
            ) : null}
          </div>

          {/* Non-refundable Deposit */}
          <div className="flex items-center gap-3 p-3 border border-slate-300 rounded-md">
            <input
              type="checkbox"
              id="nonRefundableDeposit"
              checked={formData.nonRefundableDeposit}
              onChange={(e) => handleChange('nonRefundableDeposit', e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="nonRefundableDeposit" className="text-sm font-medium text-slate-900 cursor-pointer">
              Non-refundable Deposit Required
            </label>
          </div>
        </div>
      </div>

      {/* Guest Policies Container */}
      <div className="bg-white rounded-lg p-6 md:p-8">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          � Booking Rules
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Minimum Stay */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Minimum Stay Requirement (nights)
            </label>
            <input
              type="number"
              value={formData.minimumStayNights}
              onChange={(e) => handleChange('minimumStayNights', Number(e.target.value))}
              placeholder="1"
              min="1"
              step="1"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Maximum Stay */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Maximum Stay Limit (nights)
            </label>
            <input
              type="number"
              value={formData.maximumStayNights}
              onChange={(e) => handleChange('maximumStayNights', Number(e.target.value))}
              placeholder="365"
              min="1"
              step="1"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Same-day Bookings */}
          <div className="flex items-center gap-3 p-3 border border-slate-300 rounded-md">
            <input
              type="checkbox"
              id="sameDayBookingsAllowed"
              checked={formData.sameDayBookingsAllowed}
              onChange={(e) => handleChange('sameDayBookingsAllowed', e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="sameDayBookingsAllowed" className="text-sm font-medium text-slate-900 cursor-pointer">
              Allow Same-day Bookings
            </label>
          </div>

          {/* Same-day Turnover */}
          <div className="flex items-center gap-3 p-3 border border-slate-300 rounded-md">
            <input
              type="checkbox"
              id="sameDayTurnoverAllowed"
              checked={formData.sameDayTurnoverAllowed}
              onChange={(e) => handleChange('sameDayTurnoverAllowed', e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="sameDayTurnoverAllowed" className="text-sm font-medium text-slate-900 cursor-pointer">
              Allow Same-day Turnover
            </label>
          </div>

          {/* Advance Booking Requirement */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Advance Booking Requirement (days)
            </label>
            <input
              type="number"
              value={formData.advanceBookingRequirementDays}
              onChange={(e) => handleChange('advanceBookingRequirementDays', Number(e.target.value))}
              placeholder="0"
              min="0"
              step="1"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Booking Window */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Booking Window (days in advance)
            </label>
            <input
              type="number"
              value={formData.bookingWindowDays}
              onChange={(e) => handleChange('bookingWindowDays', Number(e.target.value))}
              placeholder="365"
              min="1"
              step="1"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Guest Policies Container */}
      <div className="bg-white rounded-lg p-6 md:p-8">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          �👥 Guest Policies
        </h2>
        <div className="space-y-4">
          {/* Child Age Threshold */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Child Age Threshold (years)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={formData.childAgeThreshold}
                onChange={(e) => handleChange('childAgeThreshold', Number(e.target.value))}
                placeholder="12"
                min="0"
                max="18"
                step="1"
                className="w-20 px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-600">Guests under this age are considered children</span>
            </div>
          </div>

          {/* Ages Policy */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Ages Policy
            </label>
            <textarea
              value={formData.agesPolicy}
              onChange={(e) => handleChange('agesPolicy', e.target.value)}
              placeholder="e.g., Children under 2 stay free, Children 2-12 half price, Adults $30 per person"
              rows={4}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <p className="text-xs text-slate-500 mt-1">Define pricing and policies for different age groups</p>
          </div>

          {/* Pets Policy */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Pets Policy
            </label>
            <textarea
              value={formData.petsPolicy}
              onChange={(e) => handleChange('petsPolicy', e.target.value)}
              placeholder="e.g., Pets allowed: $25 per pet per night. Maximum 2 pets. Must be house-trained."
              rows={4}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <p className="text-xs text-slate-500 mt-1">Define pet policies, fees, and restrictions</p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-start gap-3">
        <Button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges || isSaving || isLoading}
          className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
        <Button
          type="button"
          onClick={handleReset}
          disabled={!hasChanges}
          className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-md disabled:opacity-50"
        >
          Reset
        </Button>
      </div>
    </form>
  );
}
