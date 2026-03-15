"use client";

import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  Clock, 
  CheckCircle2, 
  CreditCard,
  Receipt,
  Wallet,
  TrendingUp,
  AlertCircle,
  Calendar,
  Sparkles,
  ArrowRight,
  DollarSign
} from 'lucide-react';
import { format } from 'date-fns';
import { GuestPortalData } from './types';
import { ledgerService } from '@/lib/ledgerService';

interface BillTabProps {
  data: GuestPortalData;
  colors: {
    primary: string;
    secondary: string;
  };
  triggerToast: (msg: string) => void;
}

const BillTab: React.FC<BillTabProps> = ({ data, colors, triggerToast }) => {
  const { property, reservation, summary, payments: initialPayments } = data;
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);

  // Load ledger entries on component mount and when reservation changes
  useEffect(() => {
    if (reservation?.id && data?.propertyInfo?.id) {
      loadLedgerData();
    }
  }, [reservation?.id, data?.propertyInfo?.id]);

  const loadLedgerData = async () => {
    try {
      setIsLoadingLedger(true);
      // Get main guest folio (guestName folio)
      const mainFolioId = 'main-guest-folio';
      
      const result = await ledgerService.getFolioBalance(
        data.propertyInfo.id,
        reservation.id,
        mainFolioId
      );

      if (result.success && result.entries) {
        // Filter only active entries (not deleted)
        const activeEntries = result.entries.filter((e: any) => !e.deleted);
        setLedgerEntries(activeEntries);
      }
    } catch (error) {
      console.error('Error loading ledger data:', error);
    } finally {
      setIsLoadingLedger(false);
    }
  };

  // Separate charges and payments from ledger
  const charges = ledgerEntries.filter((e: any) => e.type === 'CHARGE');
  const ledgerPayments = ledgerEntries.filter((e: any) => e.type === 'PAYMENT');

  // Use ledger data if available, otherwise fall back to initial data
  const displayPayments = ledgerPayments.length > 0 ? ledgerPayments : (initialPayments || []);

  // Calculate balance from ledger entries
  const totalDebits = charges.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
  const totalCredits = ledgerPayments.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
  const calculatedBalance = totalDebits - totalCredits;

  // Determine payment status based on actual data
  const isPaid = calculatedBalance <= 0;
  const isPartial = calculatedBalance > 0 && totalCredits > 0;
  const hasOutstanding = calculatedBalance > 0;
  
  // Use calculated balance or fall back to summary
  const totalAmount = totalDebits > 0 ? totalDebits : (summary?.totalAmount || reservation?.totalPrice || 0);
  const totalPaid = totalCredits > 0 ? totalCredits : (summary?.totalPaid || 0);
  const remainingBalance = Math.max(0, calculatedBalance > 0 ? calculatedBalance : (summary?.remainingBalance || 0));

  return (
    <section className="space-y-6 animate-in fade-in">
      {/* Floating Header Card */}
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-slate-900/5 border border-white/20 overflow-hidden">
        <div className="px-6 py-5 flex items-center justify-between border-b border-slate-200/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br from-emerald-600 to-emerald-500 shadow-lg shadow-emerald-500/30">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-base sm:text-lg bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent">
                Billing & Payments
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Your stay financial summary
              </p>
            </div>
          </div>
          <div className={`px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 ${
            isPaid 
              ? 'bg-emerald-100 text-emerald-700' 
              : isPartial 
                ? 'bg-amber-100 text-amber-700'
                : 'bg-rose-100 text-rose-700'
          }`}>
            {isPaid ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Fully Paid
              </>
            ) : isPartial ? (
              <>
                <Clock className="w-4 h-4" />
                Partially Paid
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4" />
                Pending
              </>
            )}
          </div>
        </div>
      </div>

      {/* Payment Summary - Hero Card */}
      <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-8 shadow-2xl shadow-slate-900/20 overflow-hidden">
        {/* Decorative Background */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-blue-500/20 to-purple-500/20 rounded-full blur-3xl" />
        
        <div className="relative z-10 space-y-6">
          {/* Total Amount Section */}
          <div className="text-center pb-6 border-b border-white/10">
            <p className="text-slate-400 text-xs sm:text-sm font-medium mb-2 uppercase tracking-wide">Total Bill Amount</p>
            <div className="flex items-baseline justify-center gap-2">
              <span className="text-white/60 text-lg sm:text-2xl">{property?.currency || 'MAD'}</span>
              <span className="text-4xl sm:text-6xl font-bold bg-gradient-to-r from-white via-slate-100 to-white bg-clip-text text-transparent">
                {totalAmount.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Payment Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Amount Paid */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/20">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-xl bg-emerald-500/20">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
                <span className="text-slate-300 text-xs sm:text-sm font-medium">Amount Paid</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-white/60 text-base sm:text-lg">{property?.currency || 'MAD'}</span>
                <span className="text-2xl sm:text-3xl font-bold text-emerald-400">
                  {totalPaid.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Outstanding Balance */}
            <div className={`backdrop-blur-sm rounded-2xl p-5 border ${
              hasOutstanding 
                ? 'bg-amber-500/10 border-amber-500/30' 
                : 'bg-emerald-500/10 border-emerald-500/30'
            }`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-xl ${hasOutstanding ? 'bg-amber-500/20' : 'bg-emerald-500/20'}`}>
                  <DollarSign className={`w-5 h-5 ${hasOutstanding ? 'text-amber-400' : 'text-emerald-400'}`} />
                </div>
                <span className="text-slate-300 text-xs sm:text-sm font-medium">Outstanding Balance</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-white/60 text-base sm:text-lg">{property?.currency || 'MAD'}</span>
                <span className={`text-2xl sm:text-3xl font-bold ${
                  hasOutstanding ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {remainingBalance.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Action Button */}
          {hasOutstanding && (
            <button
              onClick={() => triggerToast('Payment gateway opened!')}
              className="group w-full py-4 sm:py-5 rounded-2xl text-white font-bold text-sm sm:text-lg bg-gradient-to-r from-emerald-600 to-emerald-500 shadow-2xl shadow-emerald-600/30 hover:shadow-emerald-600/50 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
            >
              <CreditCard className="w-6 h-6" />
              Pay {property?.currency || 'MAD'} {remainingBalance.toFixed(2)} Now
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          )}
        </div>
      </div>

      {/* Charges Section */}
      {charges.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-red-100">
                <TrendingUp className="w-5 h-5 text-red-600" />
              </div>
              <h4 className="text-base sm:text-lg font-bold text-slate-900">Charges & Items</h4>
            </div>
            <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
              {charges.length} {charges.length === 1 ? 'item' : 'items'}
            </span>
          </div>

          <div className="space-y-3">
            {charges.map((charge: any, index: number) => {
              const amount = charge.amount || 0;
              const category = charge.category || 'Charge';
              
              return (
                <div 
                  key={charge.id || index} 
                  className="group bg-white rounded-2xl p-5 border border-slate-200 shadow-lg shadow-slate-900/5 hover:shadow-xl hover:shadow-slate-900/10 transition-all hover:-translate-y-0.5"
                >
                  <div className="flex items-center justify-between gap-4">
                    {/* Left Section */}
                    <div className="flex items-center gap-4 flex-1">
                      <div className="p-3 rounded-2xl bg-red-100">
                        <TrendingUp className="w-6 h-6 text-red-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-lg sm:text-2xl font-bold text-slate-900">
                            {property?.currency || 'MAD'} {amount.toFixed(2)}
                          </span>
                          <span className="text-xs font-bold uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                            {charge.type}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs sm:text-sm">
                          <span className="text-slate-600 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {charge.postingDate ? format(new Date(charge.postingDate), 'MMM dd, yyyy') : 'Date unavailable'}
                          </span>
                          <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold">
                            {category}
                          </span>
                        </div>
                        {charge.description && (
                          <p className="text-xs text-slate-500 mt-2">{charge.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Payment History */}
      {displayPayments && displayPayments.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-100">
                <Receipt className="w-5 h-5 text-blue-600" />
              </div>
              <h4 className="text-base sm:text-lg font-bold text-slate-900">Payment History</h4>
            </div>
            <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
              {displayPayments.length} {displayPayments.length === 1 ? 'transaction' : 'transactions'}
            </span>
          </div>

          <div className="space-y-3">
            {displayPayments.map((payment: any, index: number) => {
              // Get amount - handle both ledger format and legacy format
              const amount = payment.amount || payment.amountPaid || 0;
              
              // Get payment method/category from ledger
              const method = payment.category || payment.paymentMethod || payment.method || 'Payment';
              
              // For ledger entries, status is "PAYMENT" type, for legacy it's stored in status field
              const isCompleted = payment.type === 'PAYMENT' || (payment.status || '').toLowerCase() === 'completed' || (payment.status || '').toLowerCase() === 'paid';
              const isRefunded = (payment.status || '').toLowerCase() === 'refunded';
              
              // Get timestamp - handle Firestore Timestamp or Date
              const getPaymentDate = () => {
                if (!payment.createdAt) return 'Date unavailable';
                
                try {
                  const dateObj = payment.createdAt instanceof Date 
                    ? payment.createdAt 
                    : new Date(payment.createdAt);
                  
                  if (!isNaN(dateObj.getTime())) {
                    return format(dateObj, 'MMM dd, yyyy • HH:mm');
                  }
                } catch (e) {
                  console.error('Error formatting date:', payment.createdAt);
                }
                return 'Date unavailable';
              };
              
              return (
                <div 
                  key={payment.id || index} 
                  className="group bg-white rounded-2xl p-5 border border-slate-200 shadow-lg shadow-slate-900/5 hover:shadow-xl hover:shadow-slate-900/10 transition-all hover:-translate-y-0.5"
                >
                  <div className="flex items-center justify-between gap-4">
                    {/* Left Section */}
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`p-3 rounded-2xl ${
                        isCompleted ? 'bg-emerald-100' : isRefunded ? 'bg-blue-100' : 'bg-slate-100'
                      }`}>
                        {isCompleted ? (
                          <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                        ) : isRefunded ? (
                          <TrendingUp className="w-6 h-6 text-blue-600" />
                        ) : (
                          <Clock className="w-6 h-6 text-slate-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-lg sm:text-2xl font-bold text-slate-900">
                            {property?.currency || 'MAD'} {amount.toFixed(2)}
                          </span>
                          <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${
                            isCompleted ? 'bg-emerald-100 text-emerald-700' : 
                            isRefunded ? 'bg-blue-100 text-blue-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {isCompleted ? 'Received' : isRefunded ? 'Refunded' : 'Pending'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs sm:text-sm">
                          <span className="text-slate-600 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {getPaymentDate()}
                          </span>
                          <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold">
                            {method}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right Section - Download Receipt */}
                    <button
                      onClick={() => triggerToast('Receipt downloaded!')}
                      className="p-2.5 rounded-xl bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-600 transition-all hover:scale-110 active:scale-95"
                      title="Download receipt"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No Transactions Message */}
      {charges.length === 0 && displayPayments.length === 0 && !isLoadingLedger && (
        <div className="bg-slate-50 rounded-2xl p-8 text-center border border-slate-200">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">No charges or payments recorded yet</p>
          <p className="text-slate-500 text-sm mt-1">Your billing activity will appear here</p>
        </div>
      )}

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => triggerToast('Detailed bill requested!')}
          className="group relative bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-2xl p-6 border border-blue-200 shadow-lg shadow-blue-500/10 hover:shadow-xl hover:shadow-blue-500/20 transition-all hover:-translate-y-1 overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full blur-2xl" />
          <div className="relative flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-blue-500 shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 text-left">
              <h5 className="font-bold text-base sm:text-lg text-slate-900 mb-1">View Detailed Bill</h5>
              <p className="text-xs sm:text-sm text-slate-600">See complete itemized charges and breakdown</p>
            </div>
            <ArrowRight className="w-5 h-5 text-blue-600 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>
        
        <button
          onClick={() => triggerToast('Receipt downloaded!')}
          className="group relative bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-2xl p-6 border border-purple-200 shadow-lg shadow-purple-500/10 hover:shadow-xl hover:shadow-purple-500/20 transition-all hover:-translate-y-1 overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/10 to-transparent rounded-full blur-2xl" />
          <div className="relative flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-purple-500 shadow-lg shadow-purple-500/30 group-hover:scale-110 transition-transform">
              <Download className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 text-left">
              <h5 className="font-bold text-base sm:text-lg text-slate-900 mb-1">Download Receipt</h5>
              <p className="text-xs sm:text-sm text-slate-600">Get official receipt in PDF format</p>
            </div>
            <ArrowRight className="w-5 h-5 text-purple-600 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>
      </div>
    </section>
  );
};

export default BillTab;