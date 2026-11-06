import { Student, PaymentMethod } from '../types';
import {
  loadAllLedgerItems,
  saveAllLedgerItems,
  StudentFeeItem,
  STUDENT_LEDGER_STORAGE_KEY,
  STUDENT_CREDIT_STORAGE_KEY,
  getStudentCreditBalance,
  setStudentCreditBalance
} from './studentFeeLedgerHelper';
import { addLedgerTransaction, LEDGER_TX_KEY, getLedgerTransactions, saveLedgerTransactions } from './ledgerStore';
import { loadJSON, mustSave, withRollback } from './storage';
import { nextSequential } from './ids';
import { localISODate, monthKeyOf, monthLabelFromKey } from './dates';

export const FEE_PAYMENTS_KEY = 'schoollee_fee_payments_v1';

export interface FeePayment {
  id: string;
  receiptNo: string;
  date: string;
  createdAt: string;
  familyId: string;
  studentIds: string[];
  amount: number;                       // cash actually received
  method: PaymentMethod;
  allocations: { studentId: string; itemId: string; amount: number }[];
  creditUsed: number;
  creditAdded: number;                  // overpayment handling
  note?: string;
  createdBy: string;
  isMigrated?: boolean;                 // opening balance, excluded from "collected this month"
  voidedAt?: string;
  voidReason?: string;
}

export const listPayments = () =>
  loadJSON<FeePayment[]>(FEE_PAYMENTS_KEY, [], Array.isArray as (v: unknown) => v is FeePayment[]);

export const creditOwner = (students: Student[]) =>
  students.length === 1 ? students[0].id : `FAM-${students[0].familyId}`;

export function getCreditForStudents(students: Student[]): number {
  if (students.length === 0) return 0;
  return getStudentCreditBalance(creditOwner(students));
}

export function recordPayment(input: {
  students: Student[];                  // 1 = student payment, many = family payment
  amount: number;
  method: PaymentMethod;
  date?: string;
  note?: string;
  createdBy: string;
  useCredit?: boolean;
  manualAllocations?: { studentId: string; itemId: string; amount: number }[];
}): FeePayment {
  const { students, amount, method, note, createdBy } = input;
  if (students.length === 0) throw new Error('No student selected');
  const date = input.date || localISODate();

  return withRollback([STUDENT_LEDGER_STORAGE_KEY, STUDENT_CREDIT_STORAGE_KEY, FEE_PAYMENTS_KEY, LEDGER_TX_KEY], () => {
    const ledgers = loadAllLedgerItems();
    const owner = creditOwner(students);
    const creditAvail = input.useCredit ? getStudentCreditBalance(owner) : 0;

    // Collect unpaid items across target students, oldest month first, Admission before Monthly
    const pool = students.flatMap(s => (ledgers[s.id] ?? []).map(item => ({ s, item })))
      .filter(({ item }) => item.total - item.paidAmount > 0)
      .sort((a, b) => a.item.monthKey.localeCompare(b.item.monthKey)
                   || (a.item.type === 'Admission' ? -1 : 1));

    const totalNeed = pool.reduce((sum, { item }) => sum + (item.total - item.paidAmount), 0);
    const creditUsed = Math.min(creditAvail, totalNeed);
    let remaining = amount + creditUsed;
    if (remaining <= 0) throw new Error('Payment amount must be greater than zero');

    const allocations: FeePayment['allocations'] = [];
    const apply = (studentId: string, item: StudentFeeItem, pay: number) => {
      if (pay <= 0) return;
      item.paidAmount += pay;
      item.status = item.paidAmount >= item.total ? 'Paid' : 'Partially Paid';
      allocations.push({ studentId, itemId: item.id, amount: pay });
      remaining -= pay;
    };

    if (input.manualAllocations?.length) {
      for (const m of input.manualAllocations) {
        const item = (ledgers[m.studentId] ?? []).find(i => i.id === m.itemId);
        if (!item) continue;
        apply(m.studentId, item, Math.min(m.amount, item.total - item.paidAmount, remaining));
      }
    } else {
      for (const { s, item } of pool) {
        if (remaining <= 0) break;
        apply(s.id, item, Math.min(item.total - item.paidAmount, remaining));
      }
    }

    const creditAdded = Math.max(0, remaining);                 // overpayment -> credit, not lost
    setStudentCreditBalance(owner, getStudentCreditBalance(owner) - creditUsed + creditAdded);
    saveAllLedgerItems(ledgers);

    const payment: FeePayment = {
      id: nextSequential('PAY'),
      receiptNo: nextSequential(`REC-${date.slice(0, 4)}`),
      date,
      createdAt: new Date().toISOString(),
      familyId: students[0].familyId,
      studentIds: students.map(s => s.id),
      amount,
      method,
      allocations,
      creditUsed,
      creditAdded,
      note,
      createdBy,
    };
    mustSave(FEE_PAYMENTS_KEY, [payment, ...listPayments()]);

    if (amount > 0) {
      const label = students.length === 1
        ? `${students[0].name} - ${students[0].id}`
        : `${students[0].family} - ${students[0].familyId}`;
      addLedgerTransaction({
        date,
        rawDate: date,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        amount,
        createdBy,
        paymentType: method,
        type: 'Incoming',
        category: 'Monthly Fee',
        reason: `Fee Payment (${label})`,
        note: note || `Receipt #${payment.receiptNo}`,
      });
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('feeDataUpdated'));
    }
    return payment;
  });
}

export function totalsOf(studentId: string, ledgers = loadAllLedgerItems()) {
  const items = ledgers[studentId] ?? [];
  const totalFee = items.reduce((s, i) => s + i.total, 0);
  const totalPaid = items.reduce((s, i) => s + i.paidAmount, 0);
  const remainingDue = Math.max(0, totalFee - totalPaid);
  const status: 'Paid' | 'Partially Paid' | 'Unpaid' =
    totalFee > 0 && remainingDue === 0 ? 'Paid' : totalPaid > 0 ? 'Partially Paid' : 'Unpaid';
  return { totalFee, totalPaid, remainingDue, status };
}

export function collectionInMonth(payments: FeePayment[], monthKey = monthKeyOf(), studentIds?: Set<string>): number {
  return payments
    .filter(p => !p.voidedAt && !p.isMigrated && p.date.slice(0, 7) === monthKey &&
                 (!studentIds || p.studentIds.some(id => studentIds.has(id))))
    .reduce((s, p) => s + (studentIds
      ? p.allocations.filter(a => studentIds.has(a.studentId)).reduce((a, x) => a + x.amount, 0)
      : p.amount), 0);
}

export function addCharge(student: Student, charge: {
  type: StudentFeeItem['type'];
  reason: string;
  amount: number;
  monthKey?: string;
  discount?: number;
}): StudentFeeItem {
  const mk = charge.monthKey ?? monthKeyOf();
  const disc = charge.discount ?? 0;
  const item: StudentFeeItem = {
    id: nextSequential('FEE'),
    studentId: student.id,
    month: monthLabelFromKey(mk),
    monthKey: mk,
    type: charge.type,
    reason: charge.reason,
    discount: disc,
    additionalDiscount: 0,
    classFeeRate: charge.amount,
    total: Math.max(0, charge.amount - disc),
    paidAmount: 0,
    status: 'Unpaid',
    generatedAt: localISODate(),
  };
  const all = loadAllLedgerItems();
  all[student.id] = [item, ...(all[student.id] ?? [])];
  saveAllLedgerItems(all);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('feeDataUpdated'));
  }
  return item;
}

export function voidPayment(paymentId: string, reason: string, by: string) {
  withRollback([STUDENT_LEDGER_STORAGE_KEY, STUDENT_CREDIT_STORAGE_KEY, FEE_PAYMENTS_KEY, LEDGER_TX_KEY], () => {
    const payments = listPayments();
    const p = payments.find(x => x.id === paymentId && !x.voidedAt);
    if (!p) throw new Error('Payment not found');
    const ledgers = loadAllLedgerItems();
    for (const a of p.allocations) {
      const item = (ledgers[a.studentId] ?? []).find(i => i.id === a.itemId);
      if (item) {
        item.paidAmount = Math.max(0, item.paidAmount - a.amount);
        item.status = item.paidAmount === 0 ? 'Unpaid' : item.paidAmount >= item.total ? 'Paid' : 'Partially Paid';
      }
    }
    const owner = p.studentIds.length === 1 ? p.studentIds[0] : `FAM-${p.familyId}`;
    setStudentCreditBalance(owner, Math.max(0, getStudentCreditBalance(owner) + p.creditUsed - p.creditAdded));
    p.voidedAt = new Date().toISOString();
    p.voidReason = reason;
    saveAllLedgerItems(ledgers);
    mustSave(FEE_PAYMENTS_KEY, payments);
    if (p.amount > 0) {
      addLedgerTransaction({
        date: localISODate(),
        rawDate: localISODate(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        amount: p.amount,
        createdBy: by,
        paymentType: p.method,
        type: 'Outgoing',
        category: 'Fee Reversal',
        reason: `Void ${p.receiptNo}: ${reason}`,
        note: p.id,
      });
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('feeDataUpdated'));
    }
  });
}
