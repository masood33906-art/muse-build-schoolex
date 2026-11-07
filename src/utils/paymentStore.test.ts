import { Student, StaffMember } from '../types';
import {
  FEE_PAYMENTS_KEY,
  listPayments,
  recordPayment,
  totalsOf,
  collectionInMonth,
  addCharge,
  voidPayment,
  getCreditForStudents
} from './paymentStore';
import {
  STUDENT_LEDGER_STORAGE_KEY,
  STUDENT_CREDIT_STORAGE_KEY,
  loadAllLedgerItems,
  saveAllLedgerItems,
  StudentFeeItem
} from './studentFeeLedgerHelper';
import { LEDGER_TX_KEY, getLedgerTransactions } from './ledgerStore';
import { migrateFeesV2 } from './migrations/migrateFeesV2';

// Simple in-memory localStorage mock with optional quota throw on a specific key
class MockLocalStorage {
  private store = new Map<string, string>();
  public failOnKey: string | null = null;

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
    this.failOnKey = null;
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    if (this.failOnKey && key === this.failOnKey) {
      throw new Error(`QuotaExceededError on ${key}`);
    }
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
}

const mockStorage = new MockLocalStorage();
(globalThis as any).localStorage = mockStorage;

function assert(cond: boolean, msg: string) {
  if (!cond) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

function makeStudent(id: string, familyId = 'F0001', name = 'Ali Khan'): Student {
  return {
    id,
    name,
    rollNo: id,
    class: 'Class 5',
    section: 'A',
    gender: 'Male',
    dob: '2015-01-01',
    admissionDate: '2026-01-01',
    family: 'Khan Family',
    familyId,
    phone: '03001234567',
    address: 'Lahore',
    status: 'Active'
  };
}

function seedTwoMonthsForStudent(studentId: string): StudentFeeItem[] {
  const items: StudentFeeItem[] = [
    {
      id: `FEE-${studentId}-2026-04`,
      studentId,
      month: 'April 2026',
      monthKey: '2026-04',
      type: 'Monthly Fee',
      reason: 'Tuition Fee',
      discount: 0,
      additionalDiscount: 0,
      classFeeRate: 3000,
      total: 3000,
      paidAmount: 0,
      status: 'Unpaid',
      generatedAt: '2026-04-01T00:00:00.000Z'
    },
    {
      id: `FEE-${studentId}-2026-05`,
      studentId,
      month: 'May 2026',
      monthKey: '2026-05',
      type: 'Monthly Fee',
      reason: 'Tuition Fee',
      discount: 0,
      additionalDiscount: 0,
      classFeeRate: 3000,
      total: 3000,
      paidAmount: 0,
      status: 'Unpaid',
      generatedAt: '2026-05-01T00:00:00.000Z'
    }
  ];
  saveAllLedgerItems({ [studentId]: items });
  return items;
}

// 1. Exact payment clears oldest month first
{
  mockStorage.clear();
  const s1 = makeStudent('S0001');
  seedTwoMonthsForStudent(s1.id);

  const p = recordPayment({
    students: [s1],
    amount: 3000,
    method: 'Cash',
    date: '2026-05-10',
    createdBy: 'Tester'
  });

  const items = loadAllLedgerItems()[s1.id];
  const apr = items.find(i => i.monthKey === '2026-04')!;
  const may = items.find(i => i.monthKey === '2026-05')!;
  assert(apr.paidAmount === 3000 && apr.status === 'Paid', 'Oldest month (April) should be cleared first');
  assert(may.paidAmount === 0 && may.status === 'Unpaid', 'Newer month (May) should remain unpaid');
  assert(p.receiptNo.startsWith('REC-'), 'Receipt number should be sequential REC-*');

  const totals = totalsOf(s1.id);
  assert(totals.totalFee === 6000 && totals.totalPaid === 3000 && totals.remainingDue === 3000 && totals.status === 'Partially Paid', 'Totals after 1st month payment');
  console.log('✓ Test 1 passed: exact payment clears oldest month first');
}

// 2. Partial payment -> Partially Paid
{
  mockStorage.clear();
  const s1 = makeStudent('S0001');
  seedTwoMonthsForStudent(s1.id);

  recordPayment({
    students: [s1],
    amount: 1200,
    method: 'Bank Transfer',
    date: '2026-05-12',
    createdBy: 'Tester'
  });

  const items = loadAllLedgerItems()[s1.id];
  const apr = items.find(i => i.monthKey === '2026-04')!;
  assert(apr.paidAmount === 1200 && apr.status === 'Partially Paid', 'Partial payment marks oldest item Partially Paid');
  const totals = totalsOf(s1.id);
  assert(totals.status === 'Partially Paid' && totals.remainingDue === 4800, 'Student status is Partially Paid');
  console.log('✓ Test 2 passed: partial payment -> Partially Paid');
}

// 3. Overpayment creates credit and useCredit consumes it
{
  mockStorage.clear();
  const s1 = makeStudent('S0001');
  seedTwoMonthsForStudent(s1.id); // total due = 6000

  const p1 = recordPayment({
    students: [s1],
    amount: 7500, // 1500 extra
    method: 'Cash',
    date: '2026-05-15',
    createdBy: 'Tester'
  });

  assert(p1.creditAdded === 1500, 'Overpayment of 1500 should be recorded in creditAdded');
  assert(getCreditForStudents([s1]) === 1500, 'Student credit balance should be 1500');
  assert(totalsOf(s1.id).remainingDue === 0, 'All items paid');

  // Add a new charge of 2000 and pay using credit + 500 cash
  addCharge(s1, { type: 'Fine', reason: 'Library Fine', amount: 2000, monthKey: '2026-05' });
  assert(totalsOf(s1.id).remainingDue === 2000, 'New charge increases remainingDue to 2000');

  const p2 = recordPayment({
    students: [s1],
    amount: 500,
    method: 'Cash',
    date: '2026-05-16',
    createdBy: 'Tester',
    useCredit: true
  });

  assert(p2.creditUsed === 1500 && p2.creditAdded === 0, '1500 credit should be consumed');
  assert(getCreditForStudents([s1]) === 0, 'Credit balance should now be 0');
  assert(totalsOf(s1.id).remainingDue === 0, 'Charge of 2000 should be fully cleared by 1500 credit + 500 cash');
  console.log('✓ Test 3 passed: overpayment creates credit and useCredit consumes it');
}

// 4. A thrown write error leaves ledger, credit, and payments unchanged (withRollback)
{
  mockStorage.clear();
  const s1 = makeStudent('S0001');
  seedTwoMonthsForStudent(s1.id);

  const beforeLedgerRaw = localStorage.getItem(STUDENT_LEDGER_STORAGE_KEY);
  const beforeCreditRaw = localStorage.getItem(STUDENT_CREDIT_STORAGE_KEY);
  const beforePaymentsRaw = localStorage.getItem(FEE_PAYMENTS_KEY);
  const beforeTxRaw = localStorage.getItem(LEDGER_TX_KEY);

  // Cause the final write in recordPayment (LEDGER_TX_KEY) to throw QuotaExceededError
  mockStorage.failOnKey = LEDGER_TX_KEY;
  let threw = false;
  try {
    recordPayment({
      students: [s1],
      amount: 7000,
      method: 'Cash',
      date: '2026-05-18',
      createdBy: 'Tester'
    });
  } catch {
    threw = true;
  } finally {
    mockStorage.failOnKey = null;
  }

  assert(threw, 'recordPayment should rethrow when a storage write fails');
  assert(localStorage.getItem(STUDENT_LEDGER_STORAGE_KEY) === beforeLedgerRaw, 'Student ledger items must be rolled back');
  assert(localStorage.getItem(STUDENT_CREDIT_STORAGE_KEY) === beforeCreditRaw, 'Student credit must be rolled back');
  assert(localStorage.getItem(FEE_PAYMENTS_KEY) === beforePaymentsRaw, 'Fee payments must be rolled back');
  assert(localStorage.getItem(LEDGER_TX_KEY) === beforeTxRaw, 'Ledger transactions must be rolled back');
  console.log('✓ Test 4 passed: thrown write error leaves ledger, credit, and payments unchanged');
}

// 5. voidPayment restores dues and collectionInMonth ignores voided and migrated payments
{
  mockStorage.clear();
  const s1 = makeStudent('S0001');
  seedTwoMonthsForStudent(s1.id);

  // Seed legacy override and run migrateFeesV2
  localStorage.setItem('schooliee_student_fees_override_clean_v1', JSON.stringify({
    [s1.id]: { totalPaid: 1000 }
  }));
  migrateFeesV2([s1]);

  // Migrated payment should NOT count toward collectionInMonth
  const migratedPayments = listPayments();
  assert(migratedPayments.length === 1 && migratedPayments[0].isMigrated === true, 'Legacy override migrated to opening payment');
  assert(collectionInMonth(migratedPayments, migratedPayments[0].date.slice(0, 7)) === 0, 'collectionInMonth ignores migrated payments');

  // Record a real payment in May 2026
  const realPay = recordPayment({
    students: [s1],
    amount: 2000,
    method: 'Cash',
    date: '2026-05-20',
    createdBy: 'Tester'
  });

  assert(
    collectionInMonth(listPayments(), '2026-05', new Set([s1.id])) === 2000,
    'collectionInMonth counts real non-voided payment in current month'
  );
  assert(totalsOf(s1.id).totalPaid === 3000, '1000 migrated + 2000 real = 3000 paid');

  // Void the real payment
  voidPayment(realPay.id, 'Entered on wrong student', 'Admin');

  assert(
    collectionInMonth(listPayments(), '2026-05', new Set([s1.id])) === 0,
    'collectionInMonth ignores voided payment'
  );
  assert(totalsOf(s1.id).totalPaid === 1000, 'voidPayment restores dues on ledger items');
  assert(totalsOf(s1.id).remainingDue === 5000, 'Remaining due restored to 5000');
  console.log('✓ Test 5 passed: voidPayment restores dues & collectionInMonth ignores voided and migrated payments');
}

// 6. RETIRED (PAYROLL_PLAN §5): staff payroll no longer lives in
// localStorage (disburseSalary). Payroll is server-side now; its behaviour —
// partial payments, derived status, one-transaction ledger writes, migration
// — is covered by scripts/payroll-test.mjs (`npm run test:payroll`).

console.log('ALL §7 MONEY RECORDS TESTS PASSED!');
