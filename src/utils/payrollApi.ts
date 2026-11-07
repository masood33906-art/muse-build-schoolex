/**
 * Payroll API client (Pay Staff rebuild, PAYROLL_PLAN §3.5).
 *
 * Payroll writes live on the SchoolEx app server: POSTing a payment runs a
 * single SQLite transaction that writes the payroll tables, the ledger
 * collection and the staff collection together (server/payroll.js). The
 * payment responses carry the full updated ledger + staff arrays; callers
 * pass them to applyPayrollSync() so localStorage == server and React state
 * can be replaced with the same arrays.
 *
 * When the API is unreachable (pure-browser / DEMO mode) every call throws
 * PayrollUnavailableError and the payroll screens show a clear
 * "Payroll requires the SchoolEx app server" state — there is deliberately
 * NO silent localStorage fallback for payroll.
 */
import { PaymentMethod, StaffMember } from '../types';
import { LedgerTransaction, saveLedgerTransactions } from './ledgerStore';
import { saveJSON } from './storage';
import { STAFF_STORAGE_KEY } from './payrollService';
import type { SalarySlipBreakdown } from './staffPdfGenerator';

export type PayrollStatus = 'Paid' | 'Partial' | 'Unpaid';

export interface PayrollPeriodSummary {
  periodKey: string;
  year: number;
  month: number;
  label: string;
  createdAt: string;
  createdBy?: string | null;
  staffCount: number;
  totalDue: number;
  totalPaid: number;
  totalOutstanding: number;
  paidCount: number;
  unpaidCount: number;
  partialCount: number;
}

export interface PayrollRecord {
  id: string;
  periodKey: string;
  staffId: string;
  staffName: string;
  baseSalary: number;
  origin: 'generated' | 'migrated';
  createdAt: string;
  adjustments: number;
  due: number;
  paid: number;
  outstanding: number;
  status: PayrollStatus;
  paymentCount: number;
  previousOutstanding?: number;
  payments?: PayrollPayment[];
}

export interface PayrollPayment {
  id: string;
  recordId: string;
  staffId: string;
  periodKey: string;
  staffName?: string;
  periodLabel?: string;
  amount: number;
  allowances: number;
  bonus: number;
  deductions: number;
  method: PaymentMethod;
  paidDate: string;
  remarks: string;
  createdBy: string;
  ledgerId: string | null;
  source: 'ui' | 'bulk' | 'migration';
  createdAt: string;
}

export interface PayrollSync {
  ledger: LedgerTransaction[];
  staff: StaffMember[];
}

export interface PayrollPaymentResult extends PayrollSync {
  payments: PayrollPayment[];
  records: PayrollRecord[];
}

export interface PayrollMigrationReport {
  ranAt: string;
  staff: Array<{
    staffId: string;
    staffName: string;
    imported: number;
    salaryTransactions: number;
    ledger: number;
    difference: number;
    monthsMigrated: number;
  }>;
  totals: { imported: number; salaryTransactions: number; ledger: number; monthsMigrated: number; paymentsCreated: number };
  skipped: Array<{ staffId: string; staffName?: string; txId?: string; amount: number; reason: string }>;
  notes: string[];
}

export class PayrollUnavailableError extends Error {
  constructor() {
    super('Payroll requires the SchoolEx app server');
    this.name = 'PayrollUnavailableError';
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: init?.body ? { 'Content-Type': 'application/json', ...(init.headers || {}) } : init?.headers,
    });
  } catch {
    throw new PayrollUnavailableError();
  }
  if (!res.ok) {
    let message = `Payroll request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch { /* keep the status message */ }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

/** True when the SchoolEx app server answers the payroll API. */
export async function probePayrollApi(): Promise<boolean> {
  try {
    await api('/api/payroll/periods');
    return true;
  } catch {
    return false;
  }
}

export async function listPayrollPeriods(): Promise<PayrollPeriodSummary[]> {
  const r = await api<{ periods: PayrollPeriodSummary[] }>('/api/payroll/periods');
  return r.periods;
}

export async function createPayrollPeriod(year: number, month: number, createdBy?: string): Promise<{ period: PayrollPeriodSummary; created: number }> {
  return api('/api/payroll/periods', { method: 'POST', body: JSON.stringify({ year, month, createdBy }) });
}

export async function listPayrollRecords(periodKey: string): Promise<{ period: PayrollPeriodSummary; records: PayrollRecord[] }> {
  return api(`/api/payroll/periods/${periodKey}/records`);
}

export async function getStaffPayroll(staffId: string): Promise<{ staffId: string; records: PayrollRecord[]; payments: PayrollPayment[] }> {
  return api(`/api/payroll/staff/${staffId}`);
}

export interface CreatePaymentInput {
  recordId: string;
  amount: number;
  allowances?: number;
  bonus?: number;
  deductions?: number;
  arrearsAmount?: number;
  method: PaymentMethod;
  paidDate: string;
  remarks?: string;
  createdBy?: string;
}

export async function createPayrollPayment(input: CreatePaymentInput): Promise<PayrollPaymentResult> {
  return api('/api/payroll/payments', { method: 'POST', body: JSON.stringify(input) });
}

export interface BulkPaymentItem {
  recordId: string;
  amount?: number;
  allowances?: number;
  bonus?: number;
  deductions?: number;
  remarks?: string;
}

export async function createBulkPayrollPayments(input: {
  items: BulkPaymentItem[];
  method: PaymentMethod;
  paidDate: string;
  createdBy?: string;
}): Promise<PayrollPaymentResult> {
  return api('/api/payroll/payments/bulk', { method: 'POST', body: JSON.stringify(input) });
}

export async function deletePayrollRecord(recordId: string): Promise<void> {
  await api(`/api/payroll/records/${recordId}`, { method: 'DELETE' });
}

export async function listPayrollPayments(filter: { staffId?: string; periodKey?: string } = {}): Promise<PayrollPayment[]> {
  const qs = new URLSearchParams();
  if (filter.staffId) qs.set('staffId', filter.staffId);
  if (filter.periodKey) qs.set('periodKey', filter.periodKey);
  const r = await api<{ payments: PayrollPayment[] }>(`/api/payroll/payments${qs.toString() ? `?${qs}` : ''}`);
  return r.payments;
}

export async function runPayrollMigration(): Promise<PayrollMigrationReport> {
  return api('/api/payroll/migrate', { method: 'POST', body: JSON.stringify({}) });
}

export interface PayrollExport {
  periods: unknown[];
  records: unknown[];
  payments: unknown[];
}

export async function exportPayroll(): Promise<PayrollExport> {
  return api('/api/payroll/export');
}

export async function importPayroll(data: PayrollExport): Promise<void> {
  await api('/api/payroll/import', { method: 'POST', body: JSON.stringify(data) });
}

/**
 * Write a payment response's ledger + staff arrays into localStorage so the
 * synchronous cache matches the server exactly (the follow-up mirror PUT
 * then carries identical values — no clobber race). React state updates are
 * the caller's job (setStaff(result.staff)).
 */
export function applyPayrollSync(sync: PayrollSync): void {
  if (Array.isArray(sync.ledger)) saveLedgerTransactions(sync.ledger);
  if (Array.isArray(sync.staff)) saveJSON(STAFF_STORAGE_KEY, sync.staff);
}

/**
 * Build the real salary-slip figures for one payroll record from its actual
 * payments — the replacement for the old invented 10% / 5% slip numbers.
 */
export function buildSlipBreakdown(
  record: Pick<PayrollRecord, 'id' | 'staffId' | 'periodKey' | 'baseSalary'>,
  periodLabel: string,
  payments: PayrollPayment[]
): SalarySlipBreakdown {
  const own = payments.filter(p => p.recordId === record.id || (p.staffId === record.staffId && p.periodKey === record.periodKey));
  const allowances = own.reduce((s, p) => s + (p.allowances || 0), 0);
  const bonus = own.reduce((s, p) => s + (p.bonus || 0), 0);
  const deductions = own.reduce((s, p) => s + (p.deductions || 0), 0);
  const totalPaid = own.reduce((s, p) => s + (p.amount || 0), 0);
  const gross = record.baseSalary + allowances + bonus;
  const netPayable = gross - deductions;
  const latest = [...own].sort((a, b) => (a.paidDate < b.paidDate ? 1 : -1))[0];
  return {
    staffId: record.staffId,
    monthLabel: periodLabel,
    baseSalary: record.baseSalary,
    allowances,
    bonus,
    deductions,
    gross,
    netPayable,
    totalPaid,
    outstanding: Math.max(0, netPayable - totalPaid),
    isPaid: own.length > 0 && totalPaid >= netPayable,
    lastPaidDate: latest?.paidDate,
    paymentMethod: latest?.method,
    referenceNo: latest?.id,
  };
}
