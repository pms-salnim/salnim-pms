'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { ledgerService } from '@/lib/ledgerService';
import { format } from 'date-fns';

interface LedgerReportProps {
  propertyId: string;
  reservationId: string;
  folios: Array<{ id: string; name: string; type: string }>;
  currencySymbol?: string;
}

interface FolioSummary {
  folioId: string;
  folioName: string;
  folioType: string;
  totalDebits: number;
  totalCredits: number;
  balance: number;
  entryCount: number;
  taxByType: Record<string, number>;
}

interface DailySummary {
  date: string;
  totalDebits: number;
  totalCredits: number;
  totalTax: number;
  transactionCount: number;
}

interface TaxSummary {
  taxName: string;
  totalAmount: number;
  rate?: number;
}

export function LedgerReport({
  propertyId,
  reservationId,
  folios,
  currencySymbol = '₨',
}: LedgerReportProps) {
  const [reportType, setReportType] = useState<'settlement' | 'analytics' | 'full_export'>('settlement');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('summary');

  const handleGenerateReport = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await ledgerService.generateLedgerReport(
        propertyId,
        reservationId,
        reportType
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to generate report');
      }

      setReport(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportPDF = () => {
    if (!report) return;

    // Generate simple text-based PDF export (would use jsPDF in production)
    const reportContent = generateReportContent();
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(reportContent));
    element.setAttribute('download', `ledger-report-${new Date().toISOString().split('T')[0]}.txt`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const generateReportContent = () => {
    if (!report) return '';

    let content = `LEDGER REPORT\n`;
    content += `Generated: ${format(new Date(report.generatedAt), 'PPP p')}\n`;
    content += `Report Type: ${report.reportType}\n\n`;

    if (report.folioSummaries) {
      content += `FOLIO SUMMARIES\n`;
      content += `${'='.repeat(80)}\n`;
      for (const folio of report.folioSummaries) {
        content += `\n${folio.folioName} (${folio.folioType})\n`;
        content += `  Debits: ${currencySymbol}${folio.totalDebits.toFixed(2)}\n`;
        content += `  Credits: ${currencySymbol}${folio.totalCredits.toFixed(2)}\n`;
        content += `  Balance: ${currencySymbol}${folio.balance.toFixed(2)}\n`;
        content += `  Entries: ${folio.entryCount}\n`;
      }
      content += `\nTotal Debits: ${currencySymbol}${report.totalDebits.toFixed(2)}\n`;
      content += `Total Credits: ${currencySymbol}${report.totalCredits.toFixed(2)}\n`;
      content += `Net Balance: ${currencySymbol}${report.netBalance.toFixed(2)}\n`;
    }

    if (report.taxSummaries) {
      content += `\n\nTAX SUMMARY\n`;
      content += `${'='.repeat(80)}\n`;
      for (const tax of report.taxSummaries) {
        content += `${tax.taxName}: ${currencySymbol}${tax.totalAmount.toFixed(2)}\n`;
      }
      content += `Total Tax: ${currencySymbol}${report.totalTaxCollected.toFixed(2)}\n`;
    }

    return content;
  };

  if (!report) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Generate Ledger Report</h3>
          
          <div className="space-y-4">
            {/* Report Type Selection */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Report Type</label>
              <div className="grid grid-cols-3 gap-2">
                {(['settlement', 'analytics', 'full_export'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setReportType(type)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      reportType === type
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {type === 'settlement' && 'Settlement'}
                    {type === 'analytics' && 'Analytics'}
                    {type === 'full_export' && 'Full Export'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500">
                {reportType === 'settlement' && 'Folio-by-folio summary with balances'}
                {reportType === 'analytics' && 'Daily trends and tax breakdown'}
                {reportType === 'full_export' && 'Complete ledger with all entries'}
              </p>
            </div>

            {/* Error message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Generate Button */}
            <Button
              onClick={handleGenerateReport}
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {isLoading && <Icons.Spinner className="h-4 w-4 mr-2 animate-spin" />}
              {isLoading ? 'Generating...' : 'Generate Report'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Report Display
  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="flex gap-0 border-b border-slate-200">
          {(report.folioSummaries ? ['summary', 'folios'] : []).concat(report.dailySummaries ? 'daily' : []).concat('raw').map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              {tab === 'summary' && 'Summary'}
              {tab === 'folios' && 'Folios'}
              {tab === 'daily' && 'Daily Trends'}
              {tab === 'raw' && 'Raw Data'}
            </button>
          ))}
        </div>

        <div className="p-4">
          {/* Summary Tab */}
          {activeTab === 'summary' && (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-xs text-slate-600 font-medium">Total Debits</p>
                  <p className="text-lg font-bold text-red-600">
                    {currencySymbol}{report.totalDebits?.toFixed(2) || '0.00'}
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-xs text-slate-600 font-medium">Total Credits</p>
                  <p className="text-lg font-bold text-green-600">
                    {currencySymbol}{report.totalCredits?.toFixed(2) || '0.00'}
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-xs text-slate-600 font-medium">Net Balance</p>
                  <p className={`text-lg font-bold ${report.netBalance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {currencySymbol}{report.netBalance?.toFixed(2) || '0.00'}
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-xs text-slate-600 font-medium">Total Tax</p>
                  <p className="text-lg font-bold text-blue-600">
                    {currencySymbol}{report.totalTaxCollected?.toFixed(2) || '0.00'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Folios Tab */}
          {activeTab === 'folios' && report.folioSummaries && (
            <div className="space-y-2">
              {report.folioSummaries.map((folio: FolioSummary) => (
                <div key={folio.folioId} className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-slate-800">{folio.folioName}</p>
                      <p className="text-xs text-slate-500">{folio.folioType}</p>
                    </div>
                    <p className={`text-sm font-bold ${folio.balance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {folio.balance >= 0 ? '+' : ''}{currencySymbol}{folio.balance.toFixed(2)}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div><span className="text-slate-600">Debits:</span> <span className="font-medium">{currencySymbol}{folio.totalDebits.toFixed(2)}</span></div>
                    <div><span className="text-slate-600">Credits:</span> <span className="font-medium">{currencySymbol}{folio.totalCredits.toFixed(2)}</span></div>
                    <div><span className="text-slate-600">Entries:</span> <span className="font-medium">{folio.entryCount}</span></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Daily Tab */}
          {activeTab === 'daily' && report.dailySummaries && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {report.dailySummaries.map((day: DailySummary) => (
                <div key={day.date} className="bg-slate-50 p-2 rounded border border-slate-200 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-slate-800">{format(new Date(day.date), 'MMM dd')}</span>
                    <div className="flex gap-3">
                      <span className="text-red-600">{currencySymbol}{day.totalDebits.toFixed(2)}</span>
                      <span className="text-green-600">{currencySymbol}{day.totalCredits.toFixed(2)}</span>
                      <span className="text-blue-600">{currencySymbol}{day.totalTax.toFixed(2)}</span>
                      <span className="text-slate-600">{day.transactionCount} txn</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Raw Data Tab */}
          {activeTab === 'raw' && (
            <pre className="bg-slate-900 text-slate-100 p-3 rounded text-xs overflow-auto max-h-96">
              {JSON.stringify(report, null, 2)}
            </pre>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={handleExportPDF}
          variant="outline"
          className="flex-1"
        >
          <Icons.FileText className="h-4 w-4 mr-2" />
          Export Report
        </Button>
        <Button
          onClick={() => setReport(null)}
          variant="outline"
          className="flex-1"
        >
          Generate New
        </Button>
      </div>
    </div>
  );
}
