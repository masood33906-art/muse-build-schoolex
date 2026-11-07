import React, { useState, useMemo } from 'react';
import {
  Printer,
  ArrowLeft,
  CloudDownload,
  Receipt,
  CheckCircle2,
  FileCheck,
  Scissors
} from 'lucide-react';
import { Student } from '../types';
import { FeeInvoiceData, generateFeeInvoicePdf, rebuildFeeInvoiceData } from '../utils/feeInvoicePdfGenerator';
import { BreadcrumbTrail } from './BreadcrumbTrail';

interface FeeInvoicePageProps {
  invoiceData: FeeInvoiceData;
  // When the caller passes the student records, the page rebuilds the
  // invoice from the LIVE ledger before showing/downloading it, so a
  // receipt re-opened after further payments shows the current
  // charges / paid-to-date / balance instead of the frozen snapshot
  // it was first issued with.
  students?: Student[];
  onBackToFamily: () => void;
  onBackToFees: () => void;
  onBreadcrumbOverview?: () => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const FeeInvoicePage: React.FC<FeeInvoicePageProps> = ({
  invoiceData: snapshotData,
  students,
  onBackToFamily,
  onBackToFees,
  onBreadcrumbOverview,
  onShowToast
}) => {
  const invoiceData = useMemo(
    () => (students && students.length > 0
      ? rebuildFeeInvoiceData(snapshotData, students) ?? snapshotData
      : snapshotData),
    [snapshotData, students]
  );
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [selectedPreviewCopy, setSelectedPreviewCopy] = useState<'all' | 'family' | 'school'>('all');

  // Direct PDF Download
  const handleDownloadPdf = () => {
    try {
      setIsGeneratingPdf(true);
      setTimeout(() => {
        generateFeeInvoicePdf(invoiceData);
        setIsGeneratingPdf(false);
        onShowToast('Invoice PDF downloaded successfully!', 'success');
      }, 150);
    } catch (err) {
      console.error('Failed to generate PDF', err);
      setIsGeneratingPdf(false);
      onShowToast('Failed to generate PDF', 'error');
    }
  };

  // Browser Print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-6 text-slate-100 animate-in fade-in duration-150" id="fee-invoice-view-root">
      
      {/* ================= 1. SCREEN VIEW HEADER & BREADCRUMBS ================= */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-2 border-b border-edge-3">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Invoice
          </h1>
          <BreadcrumbTrail
            items={[
              { label: 'Overview', onClick: onBreadcrumbOverview },
              { label: 'Fees', onClick: onBackToFees },
              { label: invoiceData.familyName || invoiceData.studentName || 'Family', onClick: onBackToFamily },
              { label: 'Invoice' }
            ]}
          />
        </div>

        {/* Action Buttons: Back, Download PDF, Print Invoice */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Back Button */}
          <button
            type="button"
            onClick={onBackToFamily}
            className="px-3 py-2 rounded-lg bg-surface-21 hover:bg-[#1c273c] border border-edge-26 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Return to Family Fee Ledger"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Fee Details</span>
          </button>

          {/* Download PDF Button */}
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="px-3.5 py-2 rounded-lg bg-surface-35 hover:bg-[#1b2b45] border border-[#253552] text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            title="Download PDF containing 1 Family Copy and 2 School Copies"
          >
            <CloudDownload className="w-4 h-4 text-sky-400" />
            <span>{isGeneratingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
          </button>

          {/* Print Invoice Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 rounded-lg bg-accent hover:bg-blue-600 active:bg-blue-700 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-900/30 transition-all cursor-pointer"
            id="btn-print-invoice"
          >
            <Printer className="w-4 h-4" />
            <span>Print Invoice</span>
          </button>
        </div>
      </div>

      {/* ================= 2. ON-SCREEN DARK INVOICE CONTAINER ================= */}
      <div className="print:hidden bg-[#0c1322] border border-surface-43 rounded-2xl overflow-hidden shadow-2xl mb-12">
        {/* Header section with Logo, School details and Invoice metadata */}
        <div className="p-6 sm:p-8 border-b border-edge-3">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
            {/* School Info with Logo */}
            <div className="flex items-start gap-4">
              {/* Circular leaf/V logo */}
              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-lg flex-shrink-0 p-1 mt-0.5">
                <svg viewBox="0 0 100 100" className="w-9 h-9">
                  <circle cx="50" cy="50" r="46" fill="#ffffff" />
                  <path
                    d="M 22 28 L 44 76 C 47 82, 53 82, 56 76 L 78 28 C 74 38, 62 62, 50 62 C 38 62, 26 38, 22 28 Z"
                    fill="#0f172a"
                  />
                  <path
                    d="M 46 22 C 58 22, 78 40, 78 68 C 66 68, 48 56, 44 42 Z"
                    fill="#22c55e"
                  />
                </svg>
              </div>

              <div>
                <h2 className="text-lg font-bold text-white tracking-tight leading-tight">
                  {invoiceData.school.name}
                </h2>
                <div className="text-xs text-slate-400 mt-1">
                  {invoiceData.school.address}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {invoiceData.school.phone}
                </div>
              </div>
            </div>

            {/* Right side: Paid Badge, Invoice Number, Timestamp */}
            <div className="sm:text-right flex flex-col sm:items-end">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                invoiceData.status === 'Paid'
                  ? 'bg-[#0e2e21] text-[#22c55e] border-[#164e35]'
                  : invoiceData.status === 'Partially Paid'
                    ? 'bg-[#2e240e] text-[#fbbf24] border-[#4d3d10]'
                    : 'bg-[#2e0e0e] text-[#f87171] border-[#4d1010]'
              }`}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{invoiceData.status}</span>
              </span>
              <div className="text-sm font-bold font-mono text-white tracking-wider mt-2">
                {invoiceData.invoiceNumber}
              </div>
              <div className="text-xs text-slate-400 mt-1 font-medium">
                {invoiceData.paymentDate}
              </div>
            </div>
          </div>

          {/* Invoice From & Invoice To details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-8 pt-6 border-t border-edge-3">
            {/* Invoice From */}
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1">
                Invoice From
              </span>
              <div className="text-sm font-semibold text-slate-200">
                {invoiceData.school.name}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {invoiceData.school.phone}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {invoiceData.school.address}
              </div>
            </div>

            {/* Invoice To */}
            <div className="sm:text-right">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1">
                Invoice To
              </span>
              <div className="text-sm font-semibold text-slate-200">
                {invoiceData.invoiceTo.guardianName} ({invoiceData.invoiceTo.familyId})
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {invoiceData.invoiceTo.phone}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {invoiceData.invoiceTo.address}
              </div>
            </div>
          </div>
        </div>

        {/* Student Fee Items Section */}
        <div className="p-6 sm:p-8 space-y-8">
          {invoiceData.students.map((stGroup) => (
            <div key={stGroup.studentId} className="space-y-3">
              {/* Teal Student Pill Badge */}
              <div>
                <span className="inline-flex items-center px-3 py-1 rounded-md text-xs font-semibold bg-[#0a272c] text-[#2dd4bf] border border-[#134e4a]">
                  {stGroup.studentName} ({stGroup.studentRollNo || stGroup.studentId})
                </span>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto rounded-lg border border-edge-3">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-10 border-b border-edge-3 text-slate-400">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Purpose</th>
                      <th className="py-3 px-4 font-semibold">Month</th>
                      <th className="py-3 px-4 font-semibold">Class</th>
                      <th className="py-3 px-4 font-semibold">Discount</th>
                      <th className="py-3 px-4 font-semibold text-right">Fee</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-32">
                    {stGroup.items.map((item) => (
                      <tr 
                        key={item.id} 
                        className="hover:bg-[#111928] transition-colors text-slate-300"
                      >
                        <td className="py-3 px-4 font-medium text-white">
                          {item.purpose}
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {item.month}
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {item.className}
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {item.discountDisplay}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-200">
                          {item.feeDisplay}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* Subtotal / Total Paid / Balance Due Summary — all three are
              derived from the same live ledger items, so they always
              agree: Subtotal − Total Paid = Balance Due. */}
          <div className="pt-4 border-t border-edge-3 flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-8 text-xs text-slate-400">
              <span className="font-semibold">Subtotal</span>
              <span className="font-medium text-slate-200 min-w-[100px] text-right">
                {invoiceData.subtotal.toLocaleString()} PKR
              </span>
            </div>
            <div className="flex items-center gap-8 text-sm">
              <span className="font-bold text-white">Total Paid</span>
              <span className="font-bold text-[#22c55e] min-w-[100px] text-right text-base">
                {invoiceData.paidAmount.toLocaleString()} PKR
              </span>
            </div>
            <div className="flex items-center gap-8 text-sm">
              <span className="font-bold text-white">Balance Due</span>
              <span className={`font-bold min-w-[100px] text-right text-base ${
                invoiceData.balanceDue > 0 ? 'text-[#f87171]' : 'text-slate-200'
              }`}>
                {invoiceData.balanceDue.toLocaleString()} PKR
              </span>
            </div>
          </div>
        </div>

        {/* Card Footer notice */}
        <div className="bg-[#090e1a] border-t border-edge-3 px-6 sm:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-emerald-500" />
            <span>Official Receipt generated with 1 Family Copy and 2 School Office Copies.</span>
          </div>
          <div>
            Payment Method: <strong className="text-slate-300">{invoiceData.paymentMethod}</strong>
          </div>
        </div>
      </div>

      {/* ================= 3. PRINT-ONLY FORMATTED INVOICE SLIPS ================= */}
      {/* Visible only when printing (Ctrl+P / window.print()) with 1 Family Copy + 2 School Copies */}
      <div className="hidden print:block text-black bg-white" id="invoice-printable-container">
        
        {/* SLIP 1: FAMILY COPY (PAID) */}
        <div className="invoice-slip p-4 mb-4 border border-slate-300 rounded-lg">
          <PrintSlipContent 
            invoiceData={invoiceData} 
            copyLabel="FAMILY COPY" 
          />
        </div>

        {/* Separator Cut Line */}
        <div className="my-6 border-b-2 border-dashed border-slate-400 relative text-center">
          <span className="bg-white px-3 text-xs text-slate-500 font-mono tracking-wider -top-2.5 relative inline-flex items-center gap-1">
            <Scissors className="w-3.5 h-3.5" />
            <span>CUT HERE</span>
          </span>
        </div>

        {/* SLIP 2: SCHOOL COPY (PAID) - 1st School Copy */}
        <div className="invoice-slip p-4 mb-4 border border-slate-300 rounded-lg">
          <PrintSlipContent 
            invoiceData={invoiceData} 
            copyLabel="SCHOOL COPY" 
          />
        </div>

        {/* Page break for the 2nd School Copy as requested ("two copies on school and one family copy") */}
        <div className="page-break" style={{ pageBreakBefore: 'always', breakBefore: 'page' }}></div>

        {/* SLIP 3: SCHOOL COPY (PAID) - 2nd School Copy / Office Archive */}
        <div className="invoice-slip p-4 mt-6 border border-slate-300 rounded-lg">
          <PrintSlipContent 
            invoiceData={invoiceData} 
            copyLabel="SCHOOL COPY (OFFICE)" 
          />
        </div>
      </div>
    </div>
  );
};

/**
 * Reusable Slip content component strictly matching Image 2 layout
 */
const PrintSlipContent: React.FC<{ invoiceData: FeeInvoiceData; copyLabel: string }> = ({
  invoiceData,
  copyLabel
}) => {
  return (
    <div className="space-y-3 font-sans text-slate-800 text-xs">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-4 pb-2">
        {/* Left: Logo + School Name + Address */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full border border-slate-400 bg-white flex items-center justify-center p-0.5 flex-shrink-0">
            <svg viewBox="0 0 100 100" className="w-6 h-6">
              <circle cx="50" cy="50" r="46" fill="#ffffff" />
              <path
                d="M 22 28 L 44 76 C 47 82, 53 82, 56 76 L 78 28 C 74 38, 62 62, 50 62 C 38 62, 26 38, 22 28 Z"
                fill="#000000"
              />
              <path
                d="M 46 22 C 58 22, 78 40, 78 68 C 66 68, 48 56, 44 42 Z"
                fill="#22c55e"
              />
            </svg>
          </div>
          <div>
            <div className="font-bold text-sm text-slate-900 leading-tight">
              {invoiceData.school.name}
            </div>
            <div className="text-[10px] text-slate-500">
              {invoiceData.school.address}
            </div>
          </div>
        </div>

        {/* Right: Phone & Email */}
        <div className="text-right text-[10px] text-slate-600">
          <div>Phone: {invoiceData.school.phone}</div>
          <div>Email: {invoiceData.school.email}</div>
        </div>
      </div>

      {/* Invoice To Bar */}
      <div className="bg-slate-100 border border-slate-300 px-3 py-1.5 flex items-center justify-between text-[11px]">
        <div>
          <span className="font-bold text-slate-700">INVOICE TO : </span>
          <span className="font-medium text-slate-900">
            {invoiceData.invoiceTo.guardianName} ({invoiceData.invoiceTo.familyId})
          </span>
        </div>
        <div className="flex items-center gap-4 text-right">
          <div>
            <span className="font-bold text-slate-700">PAYMENT DATE : </span>
            <span>{invoiceData.formattedDateOnly}</span>
          </div>
          <div>
            <span className="font-bold text-slate-700">Invoice No: </span>
            <span className="font-mono">{invoiceData.invoiceNumber}</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <table className="w-full border-collapse text-[10px] mt-1">
        <thead>
          <tr className="border-b border-slate-300 text-slate-600 uppercase text-[9px]">
            <th className="py-1 px-1.5 text-left font-bold w-[22%]">MONTH</th>
            <th className="py-1 px-1.5 text-left font-bold w-[38%]">PURPOSE</th>
            <th className="py-1 px-1.5 text-left font-bold w-[14%]">CLASS</th>
            <th className="py-1 px-1.5 text-center font-bold w-[13%]">DISCOUNT</th>
            <th className="py-1 px-1.5 text-right font-bold w-[13%]">FEE</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {invoiceData.students.map((stGroup) => (
            <React.Fragment key={stGroup.studentId}>
              {/* Student Header row spanning all columns */}
              <tr className="bg-slate-100/80">
                <td colSpan={5} className="py-1 px-1.5 font-bold text-slate-900">
                  STUDENT: {stGroup.studentName.toUpperCase()} ({stGroup.studentRollNo || stGroup.studentId})
                </td>
              </tr>
              {stGroup.items.map((item) => (
                <tr key={item.id} className="text-slate-800">
                  <td className="py-1 px-1.5">{item.month}</td>
                  <td className="py-1 px-1.5">{item.purpose}</td>
                  <td className="py-1 px-1.5">{item.className}</td>
                  <td className="py-1 px-1.5 text-center">{item.discountDisplay}</td>
                  <td className="py-1 px-1.5 text-right font-semibold">{item.feeDisplay}</td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>

      {/* Footer */}
      <div className="pt-2 flex items-start justify-between border-t border-slate-200">
        <div>
          <div className="font-bold text-xs tracking-wider text-slate-900">
            {copyLabel} ({invoiceData.status === 'Paid' ? 'PAID' : invoiceData.status === 'Partially Paid' ? 'PARTIALLY PAID' : 'UNPAID'})
          </div>
          <div className="text-[9px] text-slate-400">
            Generated by SchoolEx
          </div>
        </div>

        <div className="text-right text-[11px] text-slate-700 space-y-0.5">
          <div>
            Subtotal: &nbsp; {invoiceData.subtotal.toLocaleString()} PKR
          </div>
          <div className="font-bold text-xs text-slate-900">
            Total Paid: &nbsp; {invoiceData.paidAmount.toLocaleString()} PKR
          </div>
          <div className={`font-bold text-xs ${invoiceData.balanceDue > 0 ? 'text-red-700' : 'text-slate-900'}`}>
            Balance Due: &nbsp; {invoiceData.balanceDue.toLocaleString()} PKR
          </div>
        </div>
      </div>
    </div>
  );
};
