import React, { useMemo } from 'react';
import {
  X,
  Printer,
  Download,
  AlertCircle
} from 'lucide-react';
import { Student } from '../types';
import { formatPKR, numberToWordsPKR } from '../utils/feeHelper';
import { getBankSettings, SchoolSettings } from '../utils/settingsHelper';
import { GeneratedChallan } from '../utils/challanStore';
import { localISODate, monthKeyOf, monthLabelFromKey } from '../utils/dates';

// Fix P0-4: the fee period printed on a challan is the challan's own
// month/year — taken from its feeRange when that already names a month,
// otherwise derived from its issue date, otherwise the current month.
// Never a forced fixed month.
const MONTH_YEAR_RE = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}/i;
function feePeriodOf(feeRange: string, issueDate: string): string {
  if (feeRange && MONTH_YEAR_RE.test(feeRange)) return feeRange;
  const d = new Date(issueDate);
  if (!Number.isNaN(d.getTime())) return monthLabelFromKey(localISODate(d).slice(0, 7));
  return monthLabelFromKey(monthKeyOf());
}

interface FeeChallanModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  student?: Student;
  schoolSettings?: SchoolSettings;
  name?: string;
  idNumber?: string;
  className?: string;
  section?: string;
  phone?: string;
  family?: string;
  totalFee?: number;
  totalPaid?: number;
  remainingDue?: number;
  challanNumber?: string;
  issueDate?: string;
  dueDate?: string;
  validityDate?: string;
  feeRange?: string;
  multipleChallans?: GeneratedChallan[];
}

export const FeeChallanModal: React.FC<FeeChallanModalProps> = ({
  isOpen,
  onClose,
  title,
  student,
  schoolSettings,
  name: propName,
  idNumber: propIdNumber,
  className: propClassName,
  section: propSection,
  phone: propPhone,
  family: propFamily,
  totalFee: propTotalFee,
  totalPaid: propTotalPaid = 0,
  remainingDue: propRemainingDue,
  challanNumber,
  issueDate: propIssueDate,
  dueDate: propDueDate,
  validityDate: propValidityDate,
  feeRange,
  multipleChallans
}) => {
  if (!isOpen) return null;

  const bankSettings = useMemo(() => schoolSettings || getBankSettings(), [isOpen, schoolSettings]);
  const isCompact2Copy = bankSettings.feeChallanTemplate === 'compact-2copy';
  // 'minimal-professional' keeps the STANDARD 3-copy structure — it is
  // deliberately NOT compact (never the 2-copy branch) — but renders
  // with strict black & white styling only (see the dedicated branch
  // inside the challan-sheet map below).
  const isMinimalProfessional = bankSettings.feeChallanTemplate === 'minimal-professional';

  const name = propName || student?.name || 'Student';
  const idNumber = propIdNumber || student?.id || 'S-0101';
  const className = propClassName || student?.class || 'Class 1';
  const section = propSection || student?.section || 'A';
  const phone = propPhone || student?.phone || '-';
  const family = propFamily || student?.family || student?.fatherName || 'Guardian';
  // Fix P1-8: a single challan opened WITHOUT an explicit amount has NO
  // fee — the old code silently invented 4,800 PKR. Bulk challans carry
  // their own explicit per-challan amounts and are unaffected. When the
  // fee is not set, no document is produced: the modal shows a clear
  // "Fee not set" notice and printing is blocked (same pattern as the
  // Fees module's "Set the class fee … to start billing" warning).
  const hasBulkChallans = !!(multipleChallans && multipleChallans.length > 0);
  const feeNotSet = !hasBulkChallans && propTotalFee === undefined;
  const totalFee = propTotalFee ?? 0;
  const remainingDue = propRemainingDue ?? (totalFee - propTotalPaid);

  const activeChallanNo = challanNumber || `SN7-0000${idNumber.replace(/[^0-9]/g, '').slice(-4) || '1326'}`;
  // Fix P0-4: a challan printed without explicit dates is dated TODAY (its
  // generation date), and its fee period is the current month — never fixed
  // Sep-2026 constants.
  const todayFormatted = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const currentFeePeriod = monthLabelFromKey(monthKeyOf());
  const activeIssueDate = propIssueDate || todayFormatted;
  const activeDueDate = propDueDate || todayFormatted;
  const activeValidityDate = propValidityDate || todayFormatted;

  const handlePrint = () => {
    if (feeNotSet) return; // Fix P1-8: never print a challan with no real fee
    window.print();
  };

  // Copy count: only 'compact-2copy' gets 2 copies. Both 'standard-3copy'
  // and 'minimal-professional' get the full 3 copies (School / Bank /
  // Student) — minimal-professional changes presentation only, never
  // the copy structure.
  const copyLabels = isCompact2Copy
    ? ['SCHOOL/COLLEGE COPY', 'STUDENT COPY']
    : ['SCHOOL/COLLEGE COPY', 'BANK COPY', 'STUDENT COPY'];

  const singleChallanItem = {
    challanNo: activeChallanNo,
    name,
    idNumber: idNumber.startsWith('S') ? idNumber : `S${idNumber.replace(/[^0-9]/g, '').padStart(4, '0') || '0099'}`,
    className: className.toLowerCase().replace('class', '').trim() || 'one',
    section: section || 'A',
    phone: phone && phone !== '-' ? phone : '-',
    family: family || `F-00${idNumber.replace(/[^0-9]/g, '').slice(-2) || '25'}`,
    fatherName: student?.fatherName || family || '-',
    totalFee: remainingDue > 0 ? remainingDue : totalFee,
    issueDate: activeIssueDate,
    dueDate: activeDueDate,
    validityDate: activeValidityDate,
    feeRange: feeRange || currentFeePeriod
  };

  const itemsToRender = multipleChallans && multipleChallans.length > 0 
    ? multipleChallans.map(c => ({
        challanNo: c.challanNumber || `SN7-0000${c.targetId.replace(/[^0-9]/g, '').slice(-4) || '1326'}`,
        name: c.targetName,
        idNumber: c.targetId.startsWith('S') ? c.targetId : `S${c.targetId.replace(/[^0-9]/g, '').padStart(4, '0') || '0099'}`,
        className: (c.className || 'one').toLowerCase().replace('class', '').trim(),
        section: c.section || 'A',
        phone: c.phone || '-',
        family: c.familyId || `F-00${c.targetId.replace(/[^0-9]/g, '').slice(-2) || '25'}`,
        fatherName: c.targetName || '-',
        totalFee: c.amount,
        issueDate: c.issueDate || activeIssueDate,
        dueDate: c.dueDate || activeDueDate,
        validityDate: c.validityDate || activeValidityDate,
        feeRange: c.feeRange || currentFeePeriod
      }))
    : [singleChallanItem];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-[1400px] bg-[#0c121d] border border-[#1e2e46] rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[96vh] animate-in zoom-in-95 duration-200"
        id="modal-fee-challan"
      >
        {/* Header - Screen Only */}
        <div className="px-6 py-3.5 bg-[#121a28] border-b border-[#1f2d44] flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Fee Challan Slip ({isCompact2Copy ? '2-Copy Voucher' : isMinimalProfessional ? '3-Copy Minimal Professional Voucher' : '3-Copy Bank Voucher'})
                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  {itemsToRender.length > 1 ? `${itemsToRender.length} Challans` : activeChallanNo}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                {isCompact2Copy
                  ? 'School & Student copies side-by-side on 1 sheet of paper'
                  : isMinimalProfessional
                    ? 'School, Bank & Student copies side-by-side on 1 sheet of paper — black & white, no colour'
                    : 'School, Bank & Student copies side-by-side on 1 sheet of paper'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              disabled={feeNotSet}
              title={feeNotSet ? 'Fee not set — set the class fee before printing this challan' : undefined}
              className={`px-4 py-2 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md ${
                feeNotSet
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/25 cursor-pointer'
              }`}
              id="btn-print-modal-challan"
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-edge-17 transition-colors cursor-pointer"
              id="btn-close-modal-challan"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Challan Sheet Scroll Area */}
        <div className="p-3 sm:p-6 overflow-y-auto bg-slate-100 font-sans print:p-0 print:bg-white flex-1 space-y-8">
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              @page {
                size: landscape;
                margin: 4mm;
              }
              body {
                background: white !important;
                color: black !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .no-print {
                display: none !important;
              }
              .page-break-challan {
                page-break-after: always;
                break-after: page;
              }
            }
          `}} />

          {/* Fix P1-8: no amount was provided for this challan, so NO
              challan sheet is rendered at all — only this explicit
              notice. A document with an invented amount must never
              reach paper. */}
          {feeNotSet && (
            <div className="max-w-xl mx-auto bg-white p-8 rounded-xl shadow-md border border-amber-300 text-center no-print" role="alert">
              <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-900">Fee not set</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                No fee amount was provided for {name}&apos;s challan, so no amount has been
                filled in and this challan cannot be printed. Set the class fee first
                (Classes → Edit Class / Change Fee), then generate the challan again.
              </p>
            </div>
          )}

          {!feeNotSet && itemsToRender.map((item, itemIdx) => {
            // Fix #7b: `??` keeps the settings default (500) when the
            // value is absent, but a late fine DELIBERATELY set to 0 in
            // settings is a real 0 and must not be overridden to 500.
            const fineAmount = bankSettings.lateFineAmount ?? 500;
            const tuitionAmount = item.totalFee > fineAmount ? (item.totalFee - fineAmount) : item.totalFee;
            const totalWithinDue = item.totalFee;
            const lateFine = bankSettings.lateFineAmount ?? 500;
            const totalAfterDue = totalWithinDue + lateFine;
            const inWords = numberToWordsPKR(totalWithinDue);

            // ── minimal-professional template ──────────────────────────
            // Same 3-copy structure and EVERY field as the standard
            // challan above/below — presentation only: strict black &
            // white (black text, thin black borders/dividers, white
            // background; no coloured fills, no background fills, no
            // gradients, no icons/decoration), hierarchy via font
            // weight/size/alignment only. The only non-black/white
            // values used here are Tailwind's neutral `gray-*` shades.
            if (isMinimalProfessional) {
              return (
                <div
                  key={item.challanNo + '-' + itemIdx}
                  className="bg-white text-black border border-black shadow-md p-2 print:shadow-none print:border-none print:p-0 page-break-challan"
                >
                  {/* 3 Copies Side-by-Side on 1 Sheet of Paper */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[10px] leading-tight font-sans">
                    {copyLabels.map((copyLabel, idx) => (
                      <div
                        key={copyLabel}
                        className={`relative border border-black p-2.5 flex flex-col justify-between bg-white ${
                          idx < copyLabels.length - 1 ? 'border-r-black' : ''
                        }`}
                      >
                        <div>
                          {/* Copy Label Tag — outlined, no fill */}
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-[7.5px] font-black uppercase tracking-wider px-1.5 py-0.5 border border-black text-black">
                              {copyLabel}
                            </span>
                          </div>

                          {/* School & Bank Header — text only, no crest/icon */}
                          <div className="flex items-start justify-between gap-2 pb-1 border-b border-black">
                            {/* School logo, when the school has one,
                                rendered in grayscale to stay B&W */}
                            {bankSettings.schoolLogo && (
                              <div className="w-8 h-8 flex items-center justify-center shrink-0 overflow-hidden">
                                <img src={bankSettings.schoolLogo} alt="Logo" className="w-full h-full object-contain grayscale" />
                              </div>
                            )}

                            {/* School Details */}
                            <div className="text-center flex-1">
                              <h3 className="font-extrabold text-[10.5px] uppercase tracking-tight text-black leading-none">
                                {bankSettings.schoolName || 'DEMO SCHOOL SCHOOLIEE PAKISTAN'}
                              </h3>
                              {bankSettings.schoolPhone && (
                                <p className="text-[8px] text-black font-semibold mt-0.5">
                                  Phone Number : {bankSettings.schoolPhone}
                                </p>
                              )}
                              <p className="text-[7.5px] text-gray-600">
                                {bankSettings.schoolAddress || 'Faisalabad, Punjab, Pakistan'}
                              </p>
                            </div>

                            {/* Bank Name */}
                            <div className="text-right shrink-0">
                              <div className="inline-flex items-center text-black font-bold text-[10px] tracking-tight uppercase">
                                {bankSettings.bankName || 'Meezan Bank'}
                              </div>
                            </div>
                          </div>

                          {/* Bank Account Info Strip */}
                          <div className="pt-1 pb-1 text-[7.5px] text-black border-b border-gray-400 leading-tight">
                            <p className="font-bold text-black">
                              {bankSettings.bankName || 'Meezan Bank'} — Branch: {bankSettings.branchCode || '0214'}
                            </p>
                            <p className="text-gray-600 truncate">
                              {bankSettings.branchName || 'Main Boulevard Branch, Lahore'}
                            </p>
                            <p className="font-bold text-black">
                              Account No: <span className="font-mono text-[8px]">{bankSettings.accountNumber || '0214-0103492811'}</span>
                            </p>
                          </div>

                          {/* Particulars 2-Column Key-Value Table */}
                          <table className="w-full text-left text-[8px] border-collapse my-1">
                            <tbody>
                              <tr className="border-b border-gray-300">
                                <td className="py-0.5 text-gray-700 font-medium w-[45%]">Challan Form No</td>
                                <td className="py-0.5 font-bold font-mono text-black">{item.challanNo}</td>
                              </tr>
                              <tr className="border-b border-gray-300">
                                <td className="py-0.5 text-gray-700 font-medium">Due Date</td>
                                <td className="py-0.5 font-bold text-black">{item.dueDate}</td>
                              </tr>
                              <tr className="border-b border-gray-300">
                                <td className="py-0.5 text-gray-700 font-medium">Voucher Validity</td>
                                <td className="py-0.5 font-bold text-black">{item.validityDate}</td>
                              </tr>
                              <tr className="border-b border-gray-300">
                                <td className="py-0.5 text-gray-700 font-medium">Student Reg No</td>
                                <td className="py-0.5 font-bold font-mono text-black">{item.idNumber}</td>
                              </tr>
                              <tr className="border-b border-gray-300">
                                <td className="py-0.5 text-gray-700 font-medium">Student Name</td>
                                <td className="py-0.5 font-bold text-black">{item.name} ({item.idNumber})</td>
                              </tr>
                              <tr className="border-b border-gray-300">
                                <td className="py-0.5 text-gray-700 font-medium">Father Name</td>
                                <td className="py-0.5 font-bold text-black">{item.fatherName}</td>
                              </tr>
                              <tr className="border-b border-gray-300">
                                <td className="py-0.5 text-gray-700 font-medium">Class</td>
                                <td className="py-0.5 font-bold text-black">{item.className} - {item.section}</td>
                              </tr>
                              <tr className="border-b border-gray-300">
                                <td className="py-0.5 text-gray-700 font-medium">Family Number</td>
                                <td className="py-0.5 font-bold font-mono text-black">{item.family}</td>
                              </tr>
                              <tr className="border-b border-gray-300">
                                <td className="py-0.5 text-gray-700 font-medium">Depositor NIC Number</td>
                                <td className="py-0.5 text-gray-700">-</td>
                              </tr>
                              <tr className="border-b border-gray-300">
                                <td className="py-0.5 text-gray-700 font-medium">Depositor Phone Number</td>
                                <td className="py-0.5 text-gray-700">{item.phone}</td>
                              </tr>
                            </tbody>
                          </table>

                          {/* Description & Amount Table — bordered, no header fill */}
                          <table className="w-full text-left text-[8px] border border-black border-collapse mt-1">
                            <thead>
                              <tr className="border-b border-black text-[8px] font-bold uppercase text-black">
                                <th className="py-1 px-1.5 border-r border-black">DESCRIPTION</th>
                                <th className="py-1 px-1.5 text-right">AMOUNT</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-300">
                              <tr>
                                <td className="py-0.5 px-1.5 border-r border-black text-black">
                                  {feePeriodOf(item.feeRange, item.issueDate)} Fee
                                </td>
                                <td className="py-0.5 px-1.5 text-right font-medium text-black">
                                  {tuitionAmount.toLocaleString()} PKR
                                </td>
                              </tr>
                              <tr>
                                <td className="py-0.5 px-1.5 border-r border-black text-black">
                                  Fine - Pending Dues
                                </td>
                                <td className="py-0.5 px-1.5 text-right font-medium text-black">
                                  {fineAmount.toLocaleString()} PKR
                                </td>
                              </tr>

                              {/* Summary Rows */}
                              <tr className="border-t border-black font-bold">
                                <td className="py-1 px-1.5 border-r border-black text-black">
                                  Fee Within Due Date ( Till {item.dueDate} )
                                </td>
                                <td className="py-1 px-1.5 text-right text-black font-black">
                                  {totalWithinDue.toLocaleString()} PKR
                                </td>
                              </tr>
                              <tr className="font-bold text-black">
                                <td className="py-1 px-1.5 border-r border-black">
                                  Fee After Due Date ( From 16-Sep-2026 )
                                </td>
                                <td className="py-1 px-1.5 text-right font-black">
                                  {totalAfterDue.toLocaleString()} PKR
                                </td>
                              </tr>
                              <tr className="font-bold text-black">
                                <td className="py-0.5 px-1.5 border-r border-black">
                                  Voucher Validity
                                </td>
                                <td className="py-0.5 px-1.5 text-right">
                                  {item.validityDate}
                                </td>
                              </tr>
                            </tbody>
                          </table>

                          {/* Amount in words */}
                          <div className="mt-1.5 text-[7.5px] text-black">
                            <p>
                              <span className="font-bold">Amount in words :</span>{' '}
                              <span className="italic">{inWords}</span>
                            </p>
                            <p className="text-black font-bold mt-0.5 text-[7px]">
                              Note: Please do not accept this voucher after its validity expires.
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            return (
              <div 
                key={item.challanNo + '-' + itemIdx}
                className="bg-white text-slate-900 border border-slate-300 shadow-md p-2 print:shadow-none print:border-none print:p-0 page-break-challan"
              >
                {/* Columns Side-by-Side on 1 Sheet of Paper */}
                <div className={`grid grid-cols-1 ${isCompact2Copy ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-2 text-[10px] leading-tight font-sans`}>
                  {copyLabels.map((copyLabel, idx) => (
                    <div 
                      key={copyLabel}
                      className={`relative border border-slate-300 p-2.5 flex flex-col justify-between bg-white ${
                        idx < copyLabels.length - 1 ? 'border-r-slate-400' : ''
                      }`}
                    >
                      <div>
                        {/* Copy Label Tag (Top-left pill) */}
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-[7.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-900 text-white border border-slate-700">
                            {copyLabel}
                          </span>
                        </div>

                        {/* School & Bank Header Bar */}
                        <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-200">
                          {/* School Crest Logo */}
                          <div className="w-8 h-8 rounded flex items-center justify-center shrink-0 overflow-hidden">
                            {bankSettings.schoolLogo ? (
                              <img src={bankSettings.schoolLogo} alt="Logo" className="w-full h-full object-contain" />
                            ) : (
                              <svg className="w-8 h-8 text-emerald-700" viewBox="0 0 48 48" fill="currentColor">
                                <path d="M12 28l6 6 18-18-4-4-14 14-4-4-2 6z" />
                                <path d="M24 4C12.95 4 4 12.95 4 24s8.95 20 20 20 20-8.95 20-20S35.05 4 24 4zm0 36c-8.82 0-16-7.18-16-16S15.18 8 24 8s16 7.18 16 16-7.18 16-16 16z" opacity="0.2"/>
                              </svg>
                            )}
                          </div>

                          {/* School Details */}
                          <div className="text-center flex-1">
                            <h3 className="font-extrabold text-[10.5px] uppercase tracking-tight text-slate-950 leading-none">
                              {bankSettings.schoolName || 'DEMO SCHOOL SCHOOLIEE PAKISTAN'}
                            </h3>
                            {bankSettings.schoolPhone && (
                              <p className="text-[8px] text-slate-800 font-semibold mt-0.5">
                                Phone Number : {bankSettings.schoolPhone}
                              </p>
                            )}
                            <p className="text-[7.5px] text-slate-600">
                              {bankSettings.schoolAddress || 'Faisalabad, Punjab, Pakistan'}
                            </p>
                          </div>

                          {/* Bank Name Badge */}
                          <div className="text-right shrink-0">
                            <div className="inline-flex items-center text-teal-700 font-bold text-[10px] tracking-tight uppercase">
                              {bankSettings.bankName || 'Meezan Bank'}
                            </div>
                          </div>
                        </div>

                        {/* Bank Account Info Strip */}
                        <div className="pt-1 pb-1 text-[7.5px] text-slate-800 border-b border-slate-300 leading-tight">
                          <p className="font-bold text-slate-900">
                            {bankSettings.bankName || 'Meezan Bank'} — Branch: {bankSettings.branchCode || '0214'}
                          </p>
                          <p className="text-slate-600 truncate">
                            {bankSettings.branchName || 'Main Boulevard Branch, Lahore'}
                          </p>
                          <p className="font-bold text-slate-900">
                            Account No: <span className="font-mono text-[8px]">{bankSettings.accountNumber || '0214-0103492811'}</span>
                          </p>
                        </div>

                        {/* Particulars 2-Column Key-Value Table */}
                        <table className="w-full text-left text-[8px] border-collapse my-1">
                          <tbody>
                            <tr className="border-b border-slate-200">
                              <td className="py-0.5 text-slate-700 font-medium w-[45%]">Challan Form No</td>
                              <td className="py-0.5 font-bold font-mono text-slate-950">{item.challanNo}</td>
                            </tr>
                            <tr className="border-b border-slate-200">
                              <td className="py-0.5 text-slate-700 font-medium">Due Date</td>
                              <td className="py-0.5 font-bold text-slate-950">{item.dueDate}</td>
                            </tr>
                            <tr className="border-b border-slate-200">
                              <td className="py-0.5 text-slate-700 font-medium">Voucher Validity</td>
                              <td className="py-0.5 font-bold text-slate-950">{item.validityDate}</td>
                            </tr>
                            <tr className="border-b border-slate-200">
                              <td className="py-0.5 text-slate-700 font-medium">Student Reg No</td>
                              <td className="py-0.5 font-bold font-mono text-slate-950">{item.idNumber}</td>
                            </tr>
                            <tr className="border-b border-slate-200">
                              <td className="py-0.5 text-slate-700 font-medium">Student Name</td>
                              <td className="py-0.5 font-bold text-slate-950">{item.name} ({item.idNumber})</td>
                            </tr>
                            <tr className="border-b border-slate-200">
                              <td className="py-0.5 text-slate-700 font-medium">Father Name</td>
                              <td className="py-0.5 font-bold text-slate-950">{item.fatherName}</td>
                            </tr>
                            <tr className="border-b border-slate-200">
                              <td className="py-0.5 text-slate-700 font-medium">Class</td>
                              <td className="py-0.5 font-bold text-slate-950">{item.className} - {item.section}</td>
                            </tr>
                            <tr className="border-b border-slate-200">
                              <td className="py-0.5 text-slate-700 font-medium">Family Number</td>
                              <td className="py-0.5 font-bold font-mono text-slate-950">{item.family}</td>
                            </tr>
                            <tr className="border-b border-slate-200">
                              <td className="py-0.5 text-slate-700 font-medium">Depositor NIC Number</td>
                              <td className="py-0.5 text-slate-700">-</td>
                            </tr>
                            <tr className="border-b border-slate-200">
                              <td className="py-0.5 text-slate-700 font-medium">Depositor Phone Number</td>
                              <td className="py-0.5 text-slate-700">{item.phone}</td>
                            </tr>
                          </tbody>
                        </table>

                        {/* Description & Amount Table */}
                        <table className="w-full text-left text-[8px] border border-slate-300 border-collapse mt-1">
                          <thead>
                            <tr className="bg-slate-100 border-b border-slate-300 text-[8px] font-bold uppercase text-slate-800">
                              <th className="py-1 px-1.5 border-r border-slate-300">DESCRIPTION</th>
                              <th className="py-1 px-1.5 text-right">AMOUNT</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            <tr>
                              <td className="py-0.5 px-1.5 border-r border-slate-300 text-slate-800">
                                {feePeriodOf(item.feeRange, item.issueDate)} Fee
                              </td>
                              <td className="py-0.5 px-1.5 text-right font-medium text-slate-900">
                                {tuitionAmount.toLocaleString()} PKR
                              </td>
                            </tr>
                            <tr>
                              <td className="py-0.5 px-1.5 border-r border-slate-300 text-slate-800">
                                Fine - Pending Dues
                              </td>
                              <td className="py-0.5 px-1.5 text-right font-medium text-slate-900">
                                {fineAmount.toLocaleString()} PKR
                              </td>
                            </tr>

                            {/* Summary Rows */}
                            <tr className="border-t border-slate-300 font-bold bg-slate-50/50">
                              <td className="py-1 px-1.5 border-r border-slate-300 text-slate-950">
                                Fee Within Due Date ( Till {item.dueDate} )
                              </td>
                              <td className="py-1 px-1.5 text-right text-slate-950 font-black">
                                {totalWithinDue.toLocaleString()} PKR
                              </td>
                            </tr>
                            <tr className="font-bold text-red-600 bg-red-50/30">
                              <td className="py-1 px-1.5 border-r border-slate-300">
                                Fee After Due Date ( From 16-Sep-2026 )
                              </td>
                              <td className="py-1 px-1.5 text-right font-black">
                                {totalAfterDue.toLocaleString()} PKR
                              </td>
                            </tr>
                            <tr className="font-bold text-red-600">
                              <td className="py-0.5 px-1.5 border-r border-slate-300">
                                Voucher Validity
                              </td>
                              <td className="py-0.5 px-1.5 text-right">
                                {item.validityDate}
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        {/* Amount in words */}
                        <div className="mt-1.5 text-[7.5px] text-slate-800">
                          <p>
                            <span className="font-bold">Amount in words :</span>{' '}
                            <span className="italic">{inWords}</span>
                          </p>
                          <p className="text-red-600 font-bold mt-0.5 text-[7px]">
                            Note: Please do not accept this voucher after its validity expires.
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
