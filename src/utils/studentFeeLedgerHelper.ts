import { Student, ClassInfo } from '../types';
import { parseJoiningDate } from './salaryAccrualHelper';
import { localISODate, monthKeyOf, monthKeysBetween, monthLabelFromKey } from './dates';
import { loadJSON, saveJSON, mustSave } from './storage';

const isRecordObj = <T>(v: unknown): v is Record<string, T> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export interface StudentFeeItem {
  id: string;
  studentId: string;
  month: string; // e.g. 'April 2026', 'May 2026', 'September 2026'
  monthKey: string; // '2026-04', '2026-05', etc.
  type: 'Admission' | 'Security' | 'Fund' | 'Monthly Fee' | 'Fine' | 'Other';
  reason: string;
  discount: number;
  additionalDiscount: number;
  classFeeRate: number; // The frozen snapshot rate when this fee was generated
  total: number;
  paidAmount: number;
  status: 'Unpaid' | 'Partially Paid' | 'Paid';
  generatedAt: string;
  isAdvance?: boolean;
}

export interface StudentNote {
  id: string;
  studentId: string;
  familyId: string;
  author: string;
  note: string;
  date: string;
  isArchived: boolean;
}

export const STUDENT_LEDGER_STORAGE_KEY = 'schoollee_student_fee_ledger_clean_v1';
export const STUDENT_NOTES_STORAGE_KEY = 'schoollee_student_fee_notes_clean_v1';
export const STUDENT_CREDIT_STORAGE_KEY = 'schoollee_student_credit_balance_clean_v1';

const BILLING_START_KEY = 'schoollee_billing_start_month';
export function getBillingStartMonth(): string {
  let v = localStorage.getItem(BILLING_START_KEY);
  if (!v) { v = monthKeyOf(); localStorage.setItem(BILLING_START_KEY, v); }   // default: month the school starts using the app
  return v;
}
export const setBillingStartMonth = (key: string) => localStorage.setItem(BILLING_START_KEY, key);

// Load entire ledger from localStorage
export function loadAllLedgerItems(): Record<string, StudentFeeItem[]> {
  return loadJSON<Record<string, StudentFeeItem[]>>(STUDENT_LEDGER_STORAGE_KEY, {}, isRecordObj);
}

// Save entire ledger to localStorage
export function saveAllLedgerItems(ledger: Record<string, StudentFeeItem[]>): void {
  mustSave(STUDENT_LEDGER_STORAGE_KEY, ledger);
}

/** Pure: mutates `allLedgers` in memory, does NOT save. Caller saves once. */
export function ensureStudentLedgerGenerated(
  student: Student, classes: ClassInfo[],
  allLedgers: Record<string, StudentFeeItem[]>, now = new Date()
): StudentFeeItem[] {
  const existing = allLedgers[student.id] ?? [];
  if (student.status !== 'Active') return existing;

  const cls = classes.find(c => c.name.trim().toLowerCase() === (student.class || '').trim().toLowerCase());
  const rate = Number(cls?.fee) || 0;
  if (rate <= 0) return existing;                       // no class fee → do not bill; UI shows "Set class fee for {class}"

  const nowKey = monthKeyOf(now);
  const admissionKey = student.admissionDate
    ? localISODate(parseJoiningDate(student.admissionDate)).slice(0, 7) : nowKey;
  const startKey = [getBillingStartMonth(), admissionKey].sort().pop()!;   // the later one
  if (startKey > nowKey) return existing;

  const have = new Set(existing.filter(i => i.type === 'Monthly Fee').map(i => i.monthKey));
  const discount = Math.min(rate, parseInt(String(student.discount ?? '0'), 10) || 0);

  const created: StudentFeeItem[] = monthKeysBetween(startKey, nowKey)
    .filter(k => !have.has(k))
    .map(k => ({
      id: `LEDGER-${student.id}-${k}`, studentId: student.id,
      month: monthLabelFromKey(k), monthKey: k,
      type: 'Monthly Fee', reason: 'Monthly Tuition Fee',
      discount, additionalDiscount: 0,
      classFeeRate: rate,                                // frozen snapshot, old months never change
      total: rate - discount, paidAmount: 0, status: 'Unpaid',
      generatedAt: new Date().toISOString(),
    }));

  if (created.length === 0) return existing;
  allLedgers[student.id] = [...existing, ...created];
  return allLedgers[student.id];
}

/** Generate for everyone with ONE save. */
export function ensureAllLedgers(students: Student[], classes: ClassInfo[]) {
  const all = loadAllLedgerItems();
  let changed = false;
  for (const s of students) {
    const before = all[s.id]?.length ?? 0;
    if (ensureStudentLedgerGenerated(s, classes, all).length !== before) changed = true;
  }
  if (changed) saveAllLedgerItems(all);
}

// Update items for a student (e.g. after payment or note added)
export function updateStudentLedgerItems(studentId: string, items: StudentFeeItem[]): void {
  const allLedgers = loadAllLedgerItems();
  allLedgers[studentId] = items;
  saveAllLedgerItems(allLedgers);
}

// Student Notes Helper
export function getStudentNotes(studentId: string): StudentNote[] {
  const all = loadJSON<Record<string, StudentNote[]>>(STUDENT_NOTES_STORAGE_KEY, {}, isRecordObj);
  return all[studentId] || [];
}

export function saveStudentNote(studentId: string, note: StudentNote): StudentNote[] {
  const all = loadJSON<Record<string, StudentNote[]>>(STUDENT_NOTES_STORAGE_KEY, {}, isRecordObj);
  const list = all[studentId] || [];
  const updated = [note, ...list];
  all[studentId] = updated;
  saveJSON(STUDENT_NOTES_STORAGE_KEY, all);
  return updated;
}

export function toggleArchiveNote(studentId: string, noteId: string): StudentNote[] {
  const all = loadJSON<Record<string, StudentNote[]>>(STUDENT_NOTES_STORAGE_KEY, {}, isRecordObj);
  const list = all[studentId] || [];
  const updated = list.map(n => n.id === noteId ? { ...n, isArchived: !n.isArchived } : n);
  all[studentId] = updated;
  saveJSON(STUDENT_NOTES_STORAGE_KEY, all);
  return updated;
}

// Student Credit Balance
export function getStudentCreditBalance(studentId: string): number {
  const all = loadJSON<Record<string, number>>(STUDENT_CREDIT_STORAGE_KEY, {}, isRecordObj);
  return all[studentId] || 0;
}

export function setStudentCreditBalance(studentId: string, amount: number): void {
  const all = loadJSON<Record<string, number>>(STUDENT_CREDIT_STORAGE_KEY, {}, isRecordObj);
  all[studentId] = Math.max(0, amount);
  mustSave(STUDENT_CREDIT_STORAGE_KEY, all);
}

// ============================================================================
// FEE SUMMARIES — the ONE computation behind the Student / Family details
// pages' money figures (owner request, 2026-11-08): every rupee against a
// student, derived LIVE from the stored fee ledger — Total Billed (every
// head), Total Paid, Total Due (billed − paid), plus a per-head breakdown
// so no charge type is ever left out. These replace the hand-maintained
// Student.totalDue / totalPaid snapshot fields on those pages, which
// could drift away from the ledger. The source is the same stored ledger
// the pages' Fee Timelines render, so a page's summary and its timeline
// always agree. An empty ledger yields honest zeros — never invented
// figures.
// ============================================================================

export type FeeSummaryStatus = 'Paid' | 'Partially Paid' | 'Unpaid' | 'No Charges';

export interface FeeHeadSummary {
  type: StudentFeeItem['type'];
  label: string;
  billed: number;
  paid: number;
  due: number;
}

export interface StudentFeeSummary {
  billed: number;
  paid: number;
  due: number;
  status: FeeSummaryStatus;
  heads: FeeHeadSummary[];
}

/** Display label per fee head (type). 'Monthly Fee' is the tuition head. */
export const FEE_HEAD_LABELS: Record<StudentFeeItem['type'], string> = {
  Admission: 'Admission Fee',
  'Monthly Fee': 'Tuition Fee',
  Fund: 'Fund',
  Fine: 'Fine',
  Security: 'Security Fee',
  Other: 'Other Charges'
};

/** Stable display order for the per-head breakdown. */
const FEE_HEAD_ORDER: Array<StudentFeeItem['type']> = [
  'Admission', 'Monthly Fee', 'Fund', 'Fine', 'Security', 'Other'
];

/** Summarize a set of ledger items into billed / paid / due + per-head rows. */
export function summarizeFeeItems(items: StudentFeeItem[]): StudentFeeSummary {
  let billed = 0;
  let paid = 0;
  const byType = new Map<StudentFeeItem['type'], FeeHeadSummary>();
  items.forEach(item => {
    billed += item.total;
    paid += item.paidAmount;
    const head = byType.get(item.type) || {
      type: item.type,
      label: FEE_HEAD_LABELS[item.type],
      billed: 0,
      paid: 0,
      due: 0
    };
    head.billed += item.total;
    head.paid += item.paidAmount;
    head.due = head.billed - head.paid;
    byType.set(item.type, head);
  });
  const due = billed - paid;
  const heads = FEE_HEAD_ORDER
    .filter(t => byType.has(t))
    .map(t => byType.get(t)!);
  const status: FeeSummaryStatus =
    billed === 0 ? 'No Charges'
    : due <= 0 ? 'Paid'
    : paid > 0 ? 'Partially Paid'
    : 'Unpaid';
  return { billed, paid, due, status, heads };
}

/** Live fee summary for ONE student, from the stored ledger. */
export function summarizeStudentFees(studentId: string): StudentFeeSummary {
  return summarizeFeeItems(loadAllLedgerItems()[studentId] || []);
}

export interface FamilyChildFeeSummary extends StudentFeeSummary {
  studentId: string;
  name: string;
}

export interface FamilyFeeSummary extends StudentFeeSummary {
  perChild: FamilyChildFeeSummary[];
}

/**
 * Live fee summary for a whole family: the aggregate across ALL children
 * plus one summary per child (the Family details page's per-child lines).
 */
export function summarizeFamilyFees(
  children: Array<{ id: string; name: string }>
): FamilyFeeSummary {
  const ledgers = loadAllLedgerItems();
  const perChild = children.map(c => ({
    studentId: c.id,
    name: c.name,
    ...summarizeFeeItems(ledgers[c.id] || [])
  }));
  const aggregate = summarizeFeeItems(children.flatMap(c => ledgers[c.id] || []));
  return { ...aggregate, perChild };
}
