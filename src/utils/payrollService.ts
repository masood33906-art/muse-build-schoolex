import { StaffMember, PaymentMethod, StaffTransaction } from '../types';
import { getStaffSalaryAccrualInfo } from './salaryAccrualHelper';
import { addLedgerTransaction, LEDGER_TX_KEY } from './ledgerStore';
import { mustSave, withRollback } from './storage';
import { nextSequential } from './ids';
import { localISODate } from './dates';

export const STAFF_STORAGE_KEY = 'schoollee_offline_staff_clean_v1';
export const STAFF_PAYSTATUS_MIGRATED_KEY = 'schoollee_staff_paystatus_migrated_v1';
export const STAFF_PAYSTATUS_REVIEW_KEY = 'schoollee_staff_paystatus_review_v1';

export function owedMonthsOf(s: StaffMember, now = new Date()): string[] {
  if (s.status !== 'Active') return [];
  const info = getStaffSalaryAccrualInfo(s, now);
  return info.hasCompletedOneFullMonth ? info.owedMonths : [];
}

export function derivePayStatus(s: StaffMember, now = new Date()): 'Paid' | 'Pending' {
  return owedMonthsOf(s, now).length === 0 ? 'Paid' : 'Pending';
}

/**
 * One-time migration for staff previously flagged payStatus === 'Paid' without paidMonths
 * (e.g. by the old bulk "Pay All" handler). Re-derives payStatus from owedMonthsOf and
 * records affected staff names/IDs for manual review.
 */
export function migrateStaffPayStatusV1(staff: StaffMember[], now = new Date()): {
  staff: StaffMember[];
  flagged: { id: string; name: string; owedMonths: string[] }[];
} {
  if (typeof localStorage !== 'undefined' && localStorage.getItem(STAFF_PAYSTATUS_MIGRATED_KEY)) {
    return { staff, flagged: [] };
  }
  const flagged: { id: string; name: string; owedMonths: string[] }[] = [];
  const nextStaff = staff.map(s => {
    const owed = owedMonthsOf(s, now);
    const derived: 'Paid' | 'Pending' = owed.length === 0 ? 'Paid' : 'Pending';
    if (s.payStatus === 'Paid' && (!s.paidMonths || s.paidMonths.length === 0) && owed.length > 0) {
      flagged.push({ id: s.id, name: s.name, owedMonths: owed });
    }
    if (s.payStatus !== derived) {
      return { ...s, payStatus: derived };
    }
    return s;
  });
  if (typeof localStorage !== 'undefined') {
    if (flagged.length > 0) {
      try {
        localStorage.setItem(STAFF_PAYSTATUS_REVIEW_KEY, JSON.stringify(flagged));
      } catch {
        // ignore quota error on review log
      }
    }
    localStorage.setItem(STAFF_PAYSTATUS_MIGRATED_KEY, '1');
  }
  return { staff: nextStaff, flagged };
}

export function disburseSalary(
  staff: StaffMember[],
  monthsByStaffId: Map<string, string[]>,     // explicit: which months are being paid
  opts: {
    method: PaymentMethod;
    date?: string;
    paidBy: string;
    now?: Date;
    adjustments?: Map<string, {
      allowances?: number;
      bonus?: number;
      deduction?: number;
      deductions?: number;
      loanDeduction?: number;
      note?: string;
    }>;
  }
): StaffMember[] {
  const date = opts.date ?? localISODate();
  const refNow = opts.now ?? new Date();

  return withRollback([STAFF_STORAGE_KEY, LEDGER_TX_KEY], () => {
    const next = staff.map(s => {
      const owed = new Set(owedMonthsOf(s, refNow));
      const months = (monthsByStaffId.get(s.id) ?? []).filter(m => owed.has(m));
      if (months.length === 0) return s;

      const adj = opts.adjustments?.get(s.id) ?? {};
      const gross = months.length * (Number(s.salary) || 0) + (adj.allowances ?? 0) + (adj.bonus ?? 0);
      const ded = (adj.deduction ?? 0) + (adj.deductions ?? 0);
      const net = Math.max(0, gross - ded - (adj.loanDeduction ?? 0));
      const paidMonths = Array.from(new Set([...(s.paidMonths ?? []), ...months]));
      const stillOwed = [...owed].filter(m => !paidMonths.includes(m));

      const tx: StaffTransaction = {
        id: nextSequential('SAL'),
        createdBy: opts.paidBy,
        amount: net,
        reason: `Salary: ${months.join(', ')}${adj.note ? ` (${adj.note})` : ''}`,
        payment: opts.method,
        type: 'Salary',
        createdAt: new Date().toISOString(),
      };
      addLedgerTransaction({
        date,
        rawDate: date,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        amount: net,
        createdBy: opts.paidBy,
        paymentType: opts.method,
        type: 'Outgoing',
        category: 'Staff Salary',
        reason: `Staff Salary: ${s.name} (${s.id}) — ${months.join(', ')}`,
        note: adj.note ?? `${months.length} month(s)`,
      });
      return {
        ...s,
        paidMonths,
        lastPaidDate: date,
        paymentMethod: opts.method,
        payStatus: stillOwed.length === 0 ? ('Paid' as const) : ('Pending' as const),
        loanBalance: Math.max(0, (s.loanBalance ?? 0) - (adj.loanDeduction ?? 0)),
        transactions: [tx, ...(s.transactions ?? [])],
      };
    });
    mustSave(STAFF_STORAGE_KEY, next);
    return next;
  });
}
