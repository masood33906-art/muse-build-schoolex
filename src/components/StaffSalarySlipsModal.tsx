import React, { useState, useMemo } from 'react';
import { 
  X, 
  Download, 
  ChevronDown 
} from 'lucide-react';
import { StaffMember } from '../types';
import { generateMonthlyIndividualSlipsCombinedPdf } from '../utils/staffPdfGenerator';
import { DEFAULT_SCHOOL } from '../utils/pdfGenerator';
import { getSchoolSettings } from '../utils/settingsHelper';

export type SalarySlipModalViewMode = 'overall' | 'individual';

interface StaffSalarySlipsModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffList: StaffMember[];
  initialMode?: SalarySlipModalViewMode;
  selectedStaffMember?: StaffMember | null;
}

const MONTHS_LIST = [
  'September 2026',
  'August 2026',
  'July 2026',
  'June 2026',
  'May 2026',
  'April 2026',
  'March 2026',
  'February 2026',
  'January 2026',
  'October 2026',
  'November 2026',
  'December 2026'
];

export const StaffSalarySlipsModal: React.FC<StaffSalarySlipsModalProps> = ({
  isOpen,
  onClose,
  staffList,
  selectedStaffMember = null
}) => {
  const [selectedMonth, setSelectedMonth] = useState<string>('September 2026');
  const schoolSettings = getSchoolSettings();
  const isMinimalClassic = schoolSettings.staffSalarySlipTemplate === 'minimal-classic';

  // List of staff to display in the PDF document preview
  const previewStaffList = useMemo(() => {
    if (selectedStaffMember) {
      return [selectedStaffMember];
    }
    return staffList.length > 0 ? staffList : [];
  }, [selectedStaffMember, staffList]);

  if (!isOpen) return null;

  // "Print and Save pdf" button handler
  const handlePrintAndSavePdf = () => {
    const targetId = selectedStaffMember ? selectedStaffMember.id : undefined;
    generateMonthlyIndividualSlipsCombinedPdf(staffList, selectedMonth, targetId, DEFAULT_SCHOOL);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-[#0b1019] border border-[#1e2a3c] rounded-2xl w-full max-w-5xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ================= MODAL HEADER: MONTHS DROPDOWN, PRINT & SAVE PDF, CLOSE ================= */}
        <div className="bg-[#111724] border-b border-[#1b2638] px-5 py-3.5 flex items-center justify-between gap-4">
          {/* Months Dropdown */}
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-[#172030] border border-[#24334a] text-slate-100 text-xs font-semibold rounded-lg px-3.5 py-2 pr-8 appearance-none cursor-pointer hover:border-slate-500 focus:outline-none focus:border-emerald-500 shadow-sm transition-colors"
              id="salary-slip-month-dropdown"
            >
              {MONTHS_LIST.map(m => (
                <option key={m} value={m} className="bg-[#111724] text-white">
                  {m}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Right Action Buttons: Print and Save pdf & Close */}
          <div className="flex items-center gap-3">
            {/* Print and Save pdf button */}
            <button
              type="button"
              onClick={handlePrintAndSavePdf}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-950/40 cursor-pointer transition-all active:scale-95"
              id="btn-print-save-pdf"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Print and Save pdf</span>
            </button>

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer transition-colors"
              title="Close"
              id="btn-close-slip-modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ================= MODAL BODY: PDF PREVIEWS OF THE DOC ================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#090d15] space-y-8">
          {previewStaffList.map(staff => {
            const base = staff.salary || 0;
            const allowances = Math.round(base * 0.10);
            const bonus = 0;
            const deductions = Math.round(base * 0.05);
            const gross = base + allowances + bonus;
            const net = gross - deductions;
            const monthShort = selectedMonth.substring(0, 3).toUpperCase();
            const yearPart = selectedMonth.split(' ')[1] || '2026';

            return (
              <div 
                key={staff.id}
                className={`bg-white text-slate-900 shadow-2xl p-6 sm:p-8 max-w-4xl mx-auto print:p-0 print:border-none print:shadow-none ${
                  isMinimalClassic ? 'border-2 border-black rounded-sm' : 'rounded-xl border border-slate-300'
                }`}
              >
                {/* Institutional Header */}
                <div className="border-b-2 border-slate-900 pb-4 mb-5 text-center relative">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-left">
                      <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500">Official Payslip</span>
                      <div className="text-xs font-mono font-semibold text-slate-700">
                        REF: SLP-{staff.id}-{monthShort}-{yearPart}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                        isMinimalClassic
                          ? 'bg-neutral-100 text-black border-black'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      }`}>
                        {staff.payStatus === 'Paid' ? '✓ DISBURSED / PAID' : '⚠ PENDING PAYMENT'}
                      </span>
                    </div>
                  </div>

                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-950 uppercase">
                    {DEFAULT_SCHOOL.name}
                  </h1>
                  <p className="text-xs text-slate-600 font-medium mt-0.5">
                    {DEFAULT_SCHOOL.campus} • {DEFAULT_SCHOOL.address} • Phone: {DEFAULT_SCHOOL.phone}
                  </p>
                  <div className={`mt-2 inline-block text-white text-xs font-bold px-4 py-1 uppercase tracking-wider ${
                    isMinimalClassic ? 'bg-black rounded-none' : 'bg-slate-900 rounded-full'
                  }`}>
                    Staff Salary Slip — {selectedMonth}
                  </div>
                </div>

                {/* Employee Details Grid */}
                <div className={`bg-slate-50 p-4 mb-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs ${
                  isMinimalClassic ? 'border border-black' : 'border border-slate-200 rounded-xl'
                }`}>
                  <div>
                    <span className="text-slate-500 block font-medium">Employee ID</span>
                    <strong className="text-slate-900 font-mono text-sm">{staff.id}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-medium">Employee Name</span>
                    <strong className="text-slate-900 text-sm">{staff.name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-medium">Designation / Role</span>
                    <strong className="text-slate-900">{staff.role}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-medium">Department</span>
                    <strong className="text-slate-900">{staff.department}</strong>
                  </div>

                  <div>
                    <span className="text-slate-500 block font-medium">Father / Guardian</span>
                    <span className="text-slate-800">{staff.fatherName || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-medium">CNIC Number</span>
                    <span className="text-slate-800 font-mono">{staff.cnic || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-medium">Payment Mode</span>
                    <span className="text-slate-800">{staff.paymentMethod || 'Bank Transfer'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-medium">Disbursement Date</span>
                    <span className="text-slate-800">{staff.lastPaidDate || `01 ${selectedMonth}`}</span>
                  </div>
                </div>

                {/* Earnings & Deductions Table */}
                <div className={`overflow-hidden mb-5 ${
                  isMinimalClassic ? 'border border-black' : 'border border-slate-300 rounded-xl'
                }`}>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className={`${isMinimalClassic ? 'bg-black' : 'bg-slate-900'} text-white font-bold`}>
                      <tr>
                        <th className="py-2.5 px-4 w-1/2">Earnings & Allowances</th>
                        <th className="py-2.5 px-4 text-right w-1/4">Amount</th>
                        <th className="py-2.5 px-4 w-1/2 border-l border-slate-700">Deductions</th>
                        <th className="py-2.5 px-4 text-right w-1/4">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      <tr>
                        <td className="py-2 px-4 text-slate-700">Basic Monthly Salary</td>
                        <td className="py-2 px-4 text-right font-mono font-medium text-slate-900">
                          Rs. {base.toLocaleString()}
                        </td>
                        <td className="py-2 px-4 text-slate-700 border-l border-slate-200">Income Tax Withholding</td>
                        <td className="py-2 px-4 text-right font-mono font-medium text-rose-700">
                          Rs. {deductions.toLocaleString()}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-4 text-slate-700">Medical & Transport Allowance</td>
                        <td className="py-2 px-4 text-right font-mono font-medium text-slate-900">
                          Rs. {allowances.toLocaleString()}
                        </td>
                        <td className="py-2 px-4 text-slate-700 border-l border-slate-200">Absence / Unpaid Leaves</td>
                        <td className="py-2 px-4 text-right font-mono font-medium text-slate-500">
                          Rs. 0
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-4 text-slate-700">Special Performance Bonus</td>
                        <td className="py-2 px-4 text-right font-mono font-medium text-slate-900">
                          Rs. {bonus.toLocaleString()}
                        </td>
                        <td className="py-2 px-4 text-slate-700 border-l border-slate-200">Provident Fund (PF)</td>
                        <td className="py-2 px-4 text-right font-mono font-medium text-slate-500">
                          Rs. 0
                        </td>
                      </tr>
                      <tr className="bg-slate-100 font-bold">
                        <td className="py-2.5 px-4 text-slate-900">Gross Monthly Earnings</td>
                        <td className="py-2.5 px-4 text-right font-mono text-slate-950">
                          Rs. {gross.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 text-slate-900 border-l border-slate-200">Total Deductions</td>
                        <td className="py-2.5 px-4 text-right font-mono text-rose-800">
                          Rs. {deductions.toLocaleString()}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Net Salary Banner */}
                  <div className={`p-3.5 flex items-center justify-between ${
                    isMinimalClassic
                      ? 'bg-neutral-100 text-black border-t-2 border-black'
                      : 'bg-emerald-600 text-white'
                  }`}>
                    <div className="font-bold uppercase tracking-wider text-xs">
                      NET SALARY PAYABLE:
                    </div>
                    <div className="text-xl sm:text-2xl font-black font-mono">
                      Rs. {net.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Bank & Payment Notes */}
                <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200 mb-8">
                  <p>
                    <strong>Disbursement Information:</strong> Disbursed via {staff.paymentMethod || 'Bank Transfer'}. Account: {staff.bankAccount || 'Verified on Payroll File'}.
                  </p>
                  <p className="mt-0.5 text-slate-500">
                    Remarks: Regular monthly salary disbursement for the billing cycle of {selectedMonth}.
                  </p>
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-2 gap-12 pt-6 border-t border-slate-300 text-center text-xs">
                  <div>
                    <div className="border-b border-slate-400 pb-1 mb-1 font-bold text-slate-800">
                      Accounts Incharge / Bursar
                    </div>
                    <span className="text-slate-500 text-[11px]">Authorized Institutional Signatory</span>
                  </div>
                  <div>
                    <div className="border-b border-slate-400 pb-1 mb-1 font-bold text-slate-800">
                      {staff.name}
                    </div>
                    <span className="text-slate-500 text-[11px]">Employee Signature / Acknowledgement</span>
                  </div>
                </div>

                <div className="mt-6 text-center text-[10px] text-slate-400 italic">
                  This is a computer-generated salary slip verified by Schoollee Academic Management System.
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
