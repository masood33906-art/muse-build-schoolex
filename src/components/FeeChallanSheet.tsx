import React from 'react';
import { SchoolSettings } from '../utils/settingsHelper';
import { StudentFeeItem } from '../utils/studentFeeLedgerHelper';

/**
 * The ONE fee challan design (fee challan convergence fix).
 *
 * The Templates screen preview and the downloaded/printed challan
 * used to be two separately hand-written implementations that looked
 * nothing alike: the owner picked the "3-Copy Bank Voucher" in
 * Templates but every download path (Fees → Print Challan, the
 * Generate-Challan wizard, Student Fee Details → Print Challan)
 * rendered FeeChallanModal's different design instead, which also
 * split the total into an invented "Fine - Pending Dues" row taken
 * from settings. Both surfaces now render THIS component — the
 * Templates preview design — fed with real data, so what the owner
 * selects is exactly what prints, for all three template values
 * ('standard-3copy' = 3-Copy Bank Voucher, 'compact-2copy',
 * 'minimal-professional').
 */

export interface ChallanBreakdownRow {
  label: string;
  amount: number;
}

export const CHALLAN_BASE_HEAD_LABEL = 'Tuition Fee';

/** The printed head name for a real ledger charge. */
export function challanHeadLabel(item: StudentFeeItem): string {
  switch (item.type) {
    case 'Monthly Fee': return CHALLAN_BASE_HEAD_LABEL;
    case 'Admission': return 'Admission Fee';
    case 'Security': return 'Security Fee';
    case 'Fine': return item.reason?.trim() ? item.reason : 'Fine';
    case 'Fund': return item.reason?.trim() ? item.reason : 'Fund';
    default: return item.reason?.trim() ? item.reason : 'Other Charges';
  }
}

/**
 * Group {label, amount} pairs into challan rows: amounts summed per
 * head, the base head (Tuition Fee) first, remaining heads in
 * first-seen order. Heads with no positive amount are dropped —
 * optional heads print ONLY when a real charge exists.
 */
export function groupChallanRows(
  pairs: { label: string; amount: number }[]
): ChallanBreakdownRow[] {
  const order: string[] = [];
  const sums = new Map<string, number>();
  pairs.forEach(({ label, amount }) => {
    if (!sums.has(label)) order.push(label);
    sums.set(label, (sums.get(label) ?? 0) + amount);
  });
  const rows = order
    .map(label => ({ label, amount: sums.get(label) ?? 0 }))
    .filter(r => r.amount > 0);
  rows.sort((a, b) =>
    a.label === CHALLAN_BASE_HEAD_LABEL ? -1 : b.label === CHALLAN_BASE_HEAD_LABEL ? 1 : 0
  );
  return rows;
}

/** Breakdown rows from real ledger items, priced by `amountOf`. */
export function challanRowsFromLedgerItems(
  items: StudentFeeItem[],
  amountOf: (item: StudentFeeItem) => number
): ChallanBreakdownRow[] {
  return groupChallanRows(
    items.map(item => ({ label: challanHeadLabel(item), amount: amountOf(item) }))
  );
}

export interface FeeChallanSheetProps {
  school: SchoolSettings;
  challanNo: string;
  dueDate: string;
  studentName: string;
  classLabel: string;
  rollNo?: string;
  rows: ChallanBreakdownRow[];
  /** true = Templates preview frame (max width + shadow); false = full-width print sheet. */
  framed?: boolean;
}

export const FeeChallanSheet: React.FC<FeeChallanSheetProps> = ({
  school,
  challanNo,
  dueDate,
  studentName,
  classLabel,
  rollNo,
  rows,
  framed = false
}) => {
  const isMinimalProfessional = school.feeChallanTemplate === 'minimal-professional';
  const isCompact2Copy = !isMinimalProfessional && school.feeChallanTemplate === 'compact-2copy';
  // Minimal Professional always uses the full 3-copy structure, in B&W.
  const copies = isCompact2Copy
    ? ['School Copy', 'Student / Parent Copy']
    : ['Bank Copy', 'School Copy', 'Student / Parent Copy'];

  const withinDue = rows.reduce((sum, r) => sum + r.amount, 0);
  // The after-due figure exists only when the school actually
  // configured a late fine — a 0/unset fine prints no such row
  // (previously a fallback silently invented 300).
  const lateFine = school.lateFineAmount ?? 0;

  return (
    <div className={`w-full ${framed ? 'max-w-4xl shadow-2xl' : ''} bg-white text-black font-sans border-2 border-black rounded-sm space-y-3 ${isMinimalProfessional ? 'p-3' : 'p-4'}`}>
      <div className={`grid grid-cols-1 ${isCompact2Copy ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-3`}>
        {copies.map((copyName, idx) => (
          <div
            key={copyName}
            className={`p-3 flex flex-col justify-between border border-black space-y-2 text-xs ${
              idx < copies.length - 1 ? 'md:border-r-2 md:border-dashed md:border-black' : ''
            }`}
          >
            {/* Header */}
            <div className="text-center border-b border-black pb-2 space-y-0.5">
              <span className={`font-bold text-[10px] uppercase block truncate ${isMinimalProfessional ? 'text-black' : 'text-blue-900'}`}>
                {school.bankName || 'Faysal Bank Limited'}
              </span>
              <span className={`font-mono text-[9px] block ${isMinimalProfessional ? 'text-[#666]' : 'text-neutral-600'}`}>
                A/C: {school.accountNumber || '301829300000192'}
              </span>
              <h4 className="font-black text-xs uppercase truncate">
                {school.schoolName || 'Demo School'}
              </h4>
              <span className={`inline-block px-2 py-0.5 text-[9px] font-black uppercase mt-1 ${isMinimalProfessional ? 'bg-white text-black border border-black' : 'bg-neutral-200 text-black'}`}>
                {copyName}
              </span>
            </div>

            {/* Meta */}
            <div className="space-y-1 text-[10px] border-b border-black pb-2">
              <div className="flex justify-between">
                <span>Challan No:</span>
                <span className="font-mono font-bold">{challanNo}</span>
              </div>
              <div className="flex justify-between">
                <span>Due Date:</span>
                <span className={`font-bold ${isMinimalProfessional ? 'text-black' : 'text-red-600'}`}>{dueDate}</span>
              </div>
              <div className="flex justify-between">
                <span>Student:</span>
                <span className="font-bold truncate max-w-[110px]">{studentName}</span>
              </div>
              <div className="flex justify-between">
                <span>Class:</span>
                <span className="font-bold">{classLabel}</span>
              </div>
              {rollNo && (
                <div className="flex justify-between">
                  <span>Roll No:</span>
                  <span className="font-mono font-bold">{rollNo}</span>
                </div>
              )}
            </div>

            {/* Breakdown */}
            <table className="w-full text-[10px] border border-black border-collapse">
              <thead>
                <tr className={`${isMinimalProfessional ? 'bg-white text-black' : 'bg-neutral-100'} border-b border-black font-bold`}>
                  <th className="p-1 text-left">Description</th>
                  <th className="p-1 text-right">PKR</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.label} className={`border-b ${isMinimalProfessional ? 'border-[#999]' : 'border-neutral-300'}`}>
                    <td className="p-1">{row.label}</td>
                    <td className="p-1 text-right font-mono">{row.amount.toLocaleString()}</td>
                  </tr>
                ))}
                <tr className={`${isMinimalProfessional ? 'bg-white text-black' : 'bg-neutral-200'} font-black border-t border-black`}>
                  <td className="p-1">Payable Within Due Date</td>
                  <td className="p-1 text-right font-mono">{withinDue.toLocaleString()}</td>
                </tr>
                {lateFine > 0 && (
                  <tr className={`text-[9px] ${isMinimalProfessional ? 'text-[#333]' : 'text-neutral-700'}`}>
                    <td className="p-1">After Due Date (+{lateFine.toLocaleString()})</td>
                    <td className="p-1 text-right font-mono">{(withinDue + lateFine).toLocaleString()}</td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Signatures */}
            <div className={`pt-3 flex justify-between text-[8px] border-t border-black ${isMinimalProfessional ? 'text-[#666]' : 'text-neutral-600'}`}>
              <span>Cashier Sign</span>
              <span>Bank Stamp</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
