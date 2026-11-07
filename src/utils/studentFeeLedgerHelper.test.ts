import { ensureStudentLedgerGenerated, setBillingStartMonth, StudentFeeItem } from './studentFeeLedgerHelper';
import { Student, ClassInfo } from '../types';

// Simple localStorage polyfill for Node environment if needed
if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; }
  };
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export function runBillingLedgerTests() {
  setBillingStartMonth('2026-09');

  const classes: ClassInfo[] = [
    { id: 'CLS-1', name: 'Class 5', sections: ['A'], sectionsCount: 1, fee: 4000 },
    { id: 'CLS-2', name: 'Class 6', sections: ['A'], sectionsCount: 1, fee: 0 }
  ];

  const activeStudent: Student = {
    id: 'S-TEST-1',
    name: 'Zaid Khan',
    family: 'Tariq Khan',
    familyId: 'F-TEST-1',
    class: 'Class 5',
    section: 'A',
    status: 'Active',
    admissionDate: '2026-04-01'
  };

  const noFeeStudent: Student = {
    id: 'S-TEST-2',
    name: 'Bilal Khan',
    family: 'Tariq Khan',
    familyId: 'F-TEST-1',
    class: 'Class 6',
    section: 'A',
    status: 'Active',
    admissionDate: '2026-04-01'
  };

  const allLedgers: Record<string, StudentFeeItem[]> = {};

  // 1. With now = 2026-10-25, billing start 2026-09, an active student with class fee 4000 gets Sept and Oct items, both Unpaid
  const octItems = ensureStudentLedgerGenerated(
    activeStudent,
    classes,
    allLedgers,
    new Date(2026, 9, 25) // 2026-10-25 local
  );

  assert(octItems.length === 2, `Expected 2 items for Oct 2026, got ${octItems.length}`);
  assert(octItems[0].monthKey === '2026-09' && octItems[0].status === 'Unpaid', 'Expected 2026-09 Unpaid');
  assert(octItems[1].monthKey === '2026-10' && octItems[1].status === 'Unpaid', 'Expected 2026-10 Unpaid');
  assert(octItems[0].classFeeRate === 4000 && octItems[1].classFeeRate === 4000, 'Expected classFeeRate = 4000');

  // 2. With now = 2026-11-02 (even if class fee changes to 4500), a November item appears and Sept/Oct classFeeRate is unchanged
  const updatedClasses: ClassInfo[] = [
    { id: 'CLS-1', name: 'Class 5', sections: ['A'], sectionsCount: 1, fee: 4500 },
    { id: 'CLS-2', name: 'Class 6', sections: ['A'], sectionsCount: 1, fee: 0 }
  ];

  const novItems = ensureStudentLedgerGenerated(
    activeStudent,
    updatedClasses,
    allLedgers,
    new Date(2026, 10, 2) // 2026-11-02 local
  );

  assert(novItems.length === 3, `Expected 3 items for Nov 2026, got ${novItems.length}`);
  const sept = novItems.find(i => i.monthKey === '2026-09')!;
  const oct = novItems.find(i => i.monthKey === '2026-10')!;
  const nov = novItems.find(i => i.monthKey === '2026-11')!;
  assert(sept.classFeeRate === 4000 && oct.classFeeRate === 4000, 'Expected Sept and Oct classFeeRate to remain 4000');
  assert(nov.classFeeRate === 4500 && nov.status === 'Unpaid', 'Expected Nov classFeeRate = 4500 and Unpaid');

  // 3. A student with no class fee gets none
  const noFeeItems = ensureStudentLedgerGenerated(
    noFeeStudent,
    updatedClasses,
    allLedgers,
    new Date(2026, 10, 2)
  );
  assert(noFeeItems.length === 0, `Expected 0 items for student with no class fee, got ${noFeeItems.length}`);
}

runBillingLedgerTests();
