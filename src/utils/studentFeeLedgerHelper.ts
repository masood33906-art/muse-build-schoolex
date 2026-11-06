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
