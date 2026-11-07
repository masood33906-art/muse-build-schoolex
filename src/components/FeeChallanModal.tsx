import React, { useMemo } from 'react';
import {
  X,
  Printer,
  AlertCircle
} from 'lucide-react';
import { Student } from '../types';
import { getBankSettings, SchoolSettings } from '../utils/settingsHelper';
import { GeneratedChallan } from '../utils/challanStore';
import { loadAllLedgerItems } from '../utils/studentFeeLedgerHelper';
import {
  FeeChallanSheet,
  ChallanBreakdownRow,
  CHALLAN_BASE_HEAD_LABEL,
  challanRowsFromLedgerItems
} from './FeeChallanSheet';

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
  // Real per-head breakdown for the single-challan case, when the
  // caller knows it (Student Fee Details builds it from the selected
  // ledger items). Heads are the student's actual charges — the modal
  // never invents a split on its own.
  breakdown?: ChallanBreakdownRow[];
  // Students whose live ledger may evidence the breakdown when no
  // explicit one was supplied (Fees module family/student prints).
  studentIds?: string[];
}

interface ChallanRenderItem {
  challanNo: string;
  name: string;
  idNumber: string;
  className: string;
  section: string;
  totalFee: number;
  dueDate: string;
  rollNo?: string;
  studentIds: string[];
  feeBreakdown?: GeneratedChallan['feeBreakdown'];
}

/**
 * Guarantee the owner's challan rule on any row set: the base fee
 * entry (Tuition Fee) is ALWAYS the first printed row — carrying the
 * tuition portion when known, otherwise whatever of the challan
 * total the other heads don't explain — and optional heads appear
 * only with a real, positive amount.
 */
function ensureBaseRow(rows: ChallanBreakdownRow[], totalFee: number): ChallanBreakdownRow[] {
  const optional = rows.filter(r => r.label !== CHALLAN_BASE_HEAD_LABEL && r.amount > 0);
  const explicitBase = rows.find(r => r.label === CHALLAN_BASE_HEAD_LABEL);
  const optionalSum = optional.reduce((s, r) => s + r.amount, 0);
  const baseAmount = explicitBase
    ? explicitBase.amount
    : Math.max(0, totalFee - optionalSum);
  return [{ label: CHALLAN_BASE_HEAD_LABEL, amount: baseAmount }, ...optional];
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
  multipleChallans,
  breakdown,
  studentIds
}) => {
  if (!isOpen) return null;

  const bankSettings = useMemo(() => schoolSettings || getBankSettings(), [isOpen, schoolSettings]);
  const isCompact2Copy = bankSettings.feeChallanTemplate === 'compact-2copy';
  const isMinimalProfessional = bankSettings.feeChallanTemplate === 'minimal-professional';

  const name = propName || student?.name || 'Student';
  const idNumber = propIdNumber || student?.id || 'S-0101';
  const className = propClassName || student?.class || 'Class 1';
  const section = propSection || student?.section || 'A';
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
  // generation date) — never fixed Sep-2026 constants.
  const todayFormatted = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const activeDueDate = propDueDate || todayFormatted;

  const handlePrint = () => {
    if (feeNotSet) return; // Fix P1-8: never print a challan with no real fee
    window.print();
  };

  const singleChallanItem: ChallanRenderItem = {
    challanNo: activeChallanNo,
    name,
    idNumber,
    className,
    section,
    totalFee: remainingDue > 0 ? remainingDue : totalFee,
    dueDate: activeDueDate,
    rollNo: student?.rollNo,
    studentIds: studentIds ?? (student ? [student.id] : [idNumber]),
    feeBreakdown: undefined
  };

  const itemsToRender: ChallanRenderItem[] = hasBulkChallans
    ? multipleChallans!.map(c => ({
        challanNo: c.challanNumber || `SN7-0000${c.targetId.replace(/[^0-9]/g, '').slice(-4) || '1326'}`,
        name: c.targetName,
        idNumber: c.targetId,
        className: c.className || 'Class 1',
        section: c.section || 'A',
        totalFee: c.amount,
        dueDate: c.dueDate || activeDueDate,
        rollNo: undefined,
        studentIds: c.studentIds || [],
        feeBreakdown: c.feeBreakdown
      }))
    : [singleChallanItem];

  /**
   * Resolve the printed breakdown rows for one challan, from the most
   * authoritative real source available (fee challan convergence fix):
   *  1. an explicit breakdown supplied by the caller (Student Fee
   *     Details' selected items; the Templates sample);
   *  2. the feeBreakdown stored on the generated challan itself;
   *  3. the student's LIVE ledger heads — but only when they sum to
   *     this challan's amount, i.e. they genuinely are what this
   *     challan bills (an issued challan whose amount no longer
   *     matches the live dues keeps its own total, unexplained);
   *  4. the single base entry carrying the full amount.
   * The old modal instead SPLIT any total into tuition + a "Fine -
   * Pending Dues" row priced from the settings late-fine value —
   * an invented head the student may never have been charged.
   */
  const resolveRows = (item: ChallanRenderItem, isSingle: boolean): ChallanBreakdownRow[] => {
    if (isSingle && breakdown && breakdown.length > 0) {
      return ensureBaseRow(breakdown, item.totalFee);
    }
    const fb = item.feeBreakdown;
    if (fb) {
      const rows: ChallanBreakdownRow[] = [
        { label: CHALLAN_BASE_HEAD_LABEL, amount: fb.tuitionFee || 0 },
        { label: 'Exam Fund', amount: fb.examFee || 0 },
        { label: 'Lab Fee', amount: fb.labFee || 0 },
        { label: 'Arrears', amount: fb.arrears || 0 },
        ...(fb.advanceAmount ? [{ label: 'Advance Fee', amount: fb.advanceAmount }] : [])
      ];
      return ensureBaseRow(rows, fb.totalAmount || item.totalFee);
    }
    if (item.studentIds.length > 0) {
      const ledgers = loadAllLedgerItems();
      const ledgerItems = item.studentIds.flatMap(id => ledgers[id] ?? []);
      const rows = challanRowsFromLedgerItems(
        ledgerItems,
        i => Math.max(0, i.total - i.paidAmount)
      );
      const sum = rows.reduce((s, r) => s + r.amount, 0);
      if (rows.length > 0 && Math.abs(sum - item.totalFee) < 1) {
        return ensureBaseRow(rows, item.totalFee);
      }
    }
    return [{ label: CHALLAN_BASE_HEAD_LABEL, amount: item.totalFee }];
  };

  const classLabelOf = (item: ChallanRenderItem): string => {
    // Wizard-generated class strings already carry the section
    // ("Class 4 - A"); plain class names get " (Section)" appended.
    if (item.className.includes('-') || item.className.includes(',')) return item.className;
    return `${item.className} (${item.section})`;
  };

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
                {title || `Fee Challan Slip (${isCompact2Copy ? '2-Copy Voucher' : isMinimalProfessional ? '3-Copy Minimal Professional Voucher' : '3-Copy Bank Voucher'})`}
                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  {itemsToRender.length > 1 ? `${itemsToRender.length} Challans` : activeChallanNo}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                {isCompact2Copy
                  ? 'School & Student copies side-by-side on 1 sheet of paper'
                  : isMinimalProfessional
                    ? 'Bank, School & Student copies side-by-side on 1 sheet of paper — black & white, no colour'
                    : 'Bank, School & Student copies side-by-side on 1 sheet of paper'}
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

          {/* The sheet itself is the shared FeeChallanSheet — the exact
              design the Templates screen previews for the selected
              feeChallanTemplate, fed with this challan's real data. */}
          {!feeNotSet && itemsToRender.map((item, itemIdx) => (
            <div key={item.challanNo + '-' + itemIdx} className="page-break-challan flex justify-center print:block">
              <FeeChallanSheet
                school={bankSettings}
                challanNo={item.challanNo}
                dueDate={item.dueDate}
                studentName={item.name}
                classLabel={classLabelOf(item)}
                rollNo={item.rollNo}
                rows={resolveRows(item, !hasBulkChallans)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
