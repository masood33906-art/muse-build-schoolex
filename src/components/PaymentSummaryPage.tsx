import React, { useState } from 'react';
import { 
  CloudDownload, 
  Printer, 
  ArrowLeft, 
  Wallet, 
  Users, 
  Calendar,
  CheckCircle2,
  FileText,
  Building2,
  Share2
} from 'lucide-react';
import { StaffMember } from '../types';
import { DEFAULT_SCHOOL } from '../utils/pdfGenerator';
import { generatePaymentSummaryReceiptPdf } from '../utils/staffPdfGenerator';
import { BreadcrumbTrail } from './BreadcrumbTrail';

export interface PaymentSummaryData {
  month: string;
  year: string;
  monthNumber: string;
  paymentDate: string;
  paymentMethod: string;
  note?: string;
  paidStaff: StaffMember[];
  totalSalaryPaid: number;
  staffPaidCount: number;
}

interface PaymentSummaryPageProps {
  summaryData: PaymentSummaryData;
  onBackToStaff: () => void;
  onBackToPayStaff: () => void;
  onNavigateOverview?: () => void;
  onOpenSalarySlip?: (staff: StaffMember) => void;
}

export const PaymentSummaryPage: React.FC<PaymentSummaryPageProps> = ({
  summaryData,
  onBackToStaff,
  onBackToPayStaff,
  onNavigateOverview,
  onOpenSalarySlip
}) => {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Format payment date (e.g., '11 Sep 2026')
  const formattedPaymentDate = React.useMemo(() => {
    try {
      if (!summaryData.paymentDate) return '11 Sep 2026';
      const d = new Date(summaryData.paymentDate);
      if (isNaN(d.getTime())) return summaryData.paymentDate;
      const day = d.getDate();
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[d.getMonth()];
      const year = d.getFullYear();
      return `${day} ${month} ${year}`;
    } catch {
      return '11 Sep 2026';
    }
  }, [summaryData.paymentDate]);

  // Subtitle (e.g. Salary Slip — 09 2026)
  const salarySlipSubtitle = `Salary Slip — ${summaryData.monthNumber || '09'} ${summaryData.year || '2026'}`;

  // Handle Download Receipt (Save PDF)
  const handleDownloadReceipt = () => {
    setIsGeneratingPdf(true);
    setTimeout(() => {
      generatePaymentSummaryReceiptPdf(
        summaryData.paidStaff,
        summaryData.month,
        summaryData.year,
        summaryData.monthNumber,
        formattedPaymentDate,
        summaryData.paymentMethod,
        summaryData.totalSalaryPaid,
        DEFAULT_SCHOOL
      );
      setIsGeneratingPdf(false);
    }, 150);
  };

  // Handle Browser Print
  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-6 text-slate-100 animate-in fade-in duration-200">
      {/* ================= TOP HEADER & BREADCRUMBS ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Payment Summary
          </h1>
          <BreadcrumbTrail
            items={[
              { label: 'Overview', onClick: onNavigateOverview },
              { label: 'Staff', onClick: onBackToStaff },
              { label: 'Pay Staff', onClick: onBackToPayStaff },
              { label: 'Payment Summary' }
            ]}
          />
        </div>

        {/* Action Buttons: Download Receipt (Primary Blue) + Print */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBackToPayStaff}
            className="px-3 py-2 rounded-lg bg-surface-21 hover:bg-[#1c273c] border border-edge-26 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Pay Staff</span>
          </button>

          {/* Quick Print Button */}
          <button
            type="button"
            onClick={handlePrintReceipt}
            className="p-2 rounded-lg bg-surface-21 hover:bg-[#1c273c] border border-edge-26 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Print Receipt"
            id="btn-print-receipt"
          >
            <Printer className="w-4 h-4" />
          </button>

          {/* Download Receipt Button (Exact blue matching reference image) */}
          <button
            type="button"
            onClick={handleDownloadReceipt}
            disabled={isGeneratingPdf}
            className="px-4 py-2 rounded-lg bg-accent hover:bg-blue-600 active:bg-blue-700 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-900/30 cursor-pointer transition-all disabled:opacity-50"
            id="btn-download-receipt"
          >
            <CloudDownload className="w-4 h-4" />
            <span>{isGeneratingPdf ? 'Generating PDF...' : 'Download Receipt'}</span>
          </button>
        </div>
      </div>

      {/* ================= 3 TOP METRIC CARDS ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {/* Card 1: Total Salary Paid */}
        <div className="bg-surface-13 border border-edge-4 rounded-xl p-4 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-[#0e2a1e] border border-[#164e35] flex items-center justify-center text-success flex-shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-400">
              Total Salary Paid
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-0.5 font-mono">
              {summaryData.totalSalaryPaid.toLocaleString()} PKR
            </div>
          </div>
        </div>

        {/* Card 2: Staff Paid */}
        <div className="bg-surface-13 border border-edge-4 rounded-xl p-4 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-[#0c2340] border border-[#1a3f6d] flex items-center justify-center text-[#38bdf8] flex-shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-400">
              Staff Paid
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-0.5 font-mono">
              {summaryData.staffPaidCount}
            </div>
          </div>
        </div>

        {/* Card 3: Payment Date */}
        <div className="bg-surface-13 border border-edge-4 rounded-xl p-4 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-[#092b30] border border-[#125059] flex items-center justify-center text-[#06b6d4] flex-shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-400">
              Payment Date
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-0.5">
              {formattedPaymentDate}
            </div>
          </div>
        </div>
      </div>

      {/* ================= MAIN CONTAINER CARD WITH LOGO, HEADER & TABLE ================= */}
      <div className="bg-[#101622] border border-[#1b2536] rounded-2xl overflow-hidden shadow-xl print:border-none print:shadow-none print:bg-white print:text-black">
        {/* Card Header */}
        <div className="bg-surface-18 border-b border-edge-6 px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {/* Circular leaf/V logo */}
            <div className="w-11 h-11 rounded-full bg-white flex items-center justify-center shadow-md flex-shrink-0 p-1">
              <svg viewBox="0 0 100 100" className="w-8 h-8">
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
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight leading-tight">
                Demo School Schooliee Pakistan
              </h2>
              <div className="text-xs text-slate-400 mt-0.5 font-medium">
                {salarySlipSubtitle}
              </div>
            </div>
          </div>

          {/* Right side: Paid pill badge & date */}
          <div className="text-right">
            <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-bold bg-[#0e2e21] text-[#22c55e] border border-[#164e35]">
              Paid
            </span>
            <div className="text-xs text-slate-400 mt-1 font-medium">
              {formattedPaymentDate}
            </div>
          </div>
        </div>

        {/* ================= TABLE ================= */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            {/* Header */}
            <thead className="bg-[#151c2a] border-b border-[#1c2637] text-xs font-semibold text-slate-400">
              <tr>
                <th className="py-3.5 px-5 w-24">ID</th>
                <th className="py-3.5 px-5 w-60">Name</th>
                <th className="py-3.5 px-5 w-36">Role</th>
                <th className="py-3.5 px-5 w-36">Salary</th>
                <th className="py-3.5 px-5 w-36">Paid</th>
                <th className="py-3.5 px-5 w-32">Payment</th>
                <th className="py-3.5 px-5 w-24 text-center">Receipt</th>
                <th className="py-3.5 px-5 w-24 text-center">Note</th>
              </tr>
            </thead>

            {/* Body */}
            <tbody className="divide-y divide-[#1b2536] divide-dashed text-xs">
              {summaryData.paidStaff.map((staff) => {
                const salary = staff.salary || 0;
                const paidAmount = salary;
                const paymentType = staff.paymentMethod || summaryData.paymentMethod || 'Cash';

                return (
                  <tr 
                    key={staff.id}
                    className="hover:bg-surface-26 transition-colors group"
                  >
                    {/* ID */}
                    <td className="py-3.5 px-5 text-slate-400 font-mono">
                      {staff.id}
                    </td>

                    {/* Name */}
                    <td className="py-3.5 px-5">
                      <span className="font-bold text-slate-100 group-hover:text-white transition-colors">
                        {staff.name}
                      </span>
                    </td>

                    {/* Role */}
                    <td className="py-3.5 px-5 text-slate-300">
                      {staff.role}
                    </td>

                    {/* Salary */}
                    <td className="py-3.5 px-5 font-mono text-slate-300 font-medium">
                      {salary.toLocaleString()} PKR
                    </td>

                    {/* Paid */}
                    <td className="py-3.5 px-5 font-mono">
                      <span className="inline-block px-2.5 py-0.5 rounded-md bg-[#0e2e21] text-[#22c55e] border border-[#164e35] font-semibold text-xs">
                        {paidAmount.toLocaleString()} PKR
                      </span>
                    </td>

                    {/* Payment (Amber badge for Cash/Bank) */}
                    <td className="py-3.5 px-5">
                      <span className="inline-block px-2.5 py-0.5 rounded-md bg-[#332200] text-warning border border-[#593e0b] font-semibold text-xs">
                        {paymentType}
                      </span>
                    </td>

                    {/* Receipt */}
                    <td className="py-3.5 px-5 text-center text-slate-500">
                      {onOpenSalarySlip ? (
                        <button
                          type="button"
                          onClick={() => onOpenSalarySlip(staff)}
                          className="hover:text-sky-400 transition-colors cursor-pointer text-slate-400 text-xs inline-flex items-center gap-1 font-mono"
                          title="View Individual Slip"
                        >
                          —
                        </button>
                      ) : (
                        <span>—</span>
                      )}
                    </td>

                    {/* Note */}
                    <td className="py-3.5 px-5 text-center text-slate-500">
                      <span>—</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer info bar */}
        <div className="bg-surface-12 border-t border-edge-6 px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div>
            Showing <strong className="text-white">{summaryData.paidStaff.length}</strong> paid staff records for {summaryData.month} {summaryData.year}
          </div>
          <div className="flex items-center gap-3">
            <span className="font-medium text-slate-300">
              Total Disbursed: <strong className="text-[#22c55e] font-mono">{summaryData.totalSalaryPaid.toLocaleString()} PKR</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
