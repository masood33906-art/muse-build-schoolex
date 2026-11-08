// SchoolEx payroll test — PAYROLL_PLAN §5.
// Boots the server on a temp DB (fresh installs start empty and there is
// NO dummy-data facility in the app anymore; the 28-staff fixture school
// is inserted through the normal collections API from
// scripts/fixtures.mjs — test-only, never shipped), drives the payroll
// API with fetch, and checks the owner's 10 tests + the migration
// fixture + system reset.
// Run: npm run test:payroll  (or node scripts/payroll-test.mjs)
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fixtureStaff } from './fixtures.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'schoolex-payroll-'));
const dbPath = path.join(tmp, 'payroll.db');
process.env.SCHOOLEX_DB = dbPath;
const { startServer } = await import('../server/index.js');

let failures = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
  if (!cond) failures++;
};

let h = await startServer({ port: 0, dbPath });
let base = `http://127.0.0.1:${h.port}`;
const rebase = () => { base = `http://127.0.0.1:${h.port}`; };
const api = async (method, p, body) => {
  const res = await fetch(`${base}${p}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* raw (backup bytes etc.) */ }
  return { status: res.status, ok: res.ok, data, text };
};
const getCollection = async (key) => {
  const r = await api('GET', `/api/collections/${key}`);
  return r.status === 404 ? [] : r.data.value;
};
const STAFF_KEY = 'schoollee_offline_staff_clean_v1';
const LEDGER_KEY = 'schoollee_ledger_transactions_clean_v1';

const staffBeforeLoad = await getCollection(STAFF_KEY);
check('fresh install is empty before fixture insert (no auto-seed)', staffBeforeLoad.length === 0, `len=${staffBeforeLoad.length}`);
const staffFixture = fixtureStaff();
const fixturePut = await api('PUT', `/api/collections/${STAFF_KEY}`, { value: staffFixture });
check('test fixture inserted via the collections API', fixturePut.ok, fixturePut.data?.error || '');
const staffSeed = await getCollection(STAFF_KEY);
check('seed staff collection has 28 staff', staffSeed.length === 28, `len=${staffSeed.length}`);
const salaryOf = (id) => (staffSeed.find(s => s.id === id) || {}).salary || 0;

async function recordsOf(periodKey) {
  const r = await api('GET', `/api/payroll/periods/${periodKey}/records`);
  return r.data.records;
}
async function recordOf(periodKey, staffId) {
  return (await recordsOf(periodKey)).find(r => r.staffId === staffId);
}
const staffIds = staffSeed.map(s => s.id);
const [A, B, C, D, E] = staffIds;

// ---------------------------------------------------------------- Test 1
{
  const created = await api('POST', '/api/payroll/periods', { year: 2026, month: 9, createdBy: 'Test' });
  check('T1 period 2026-09 created with 28 records', created.ok && created.data.period.staffCount === 28, `staffCount=${created.data?.period?.staffCount}`);
  const rec = await recordOf('2026-09', A);
  const salary = salaryOf(A);
  check('T1 snapshot salary matches staff salary', rec.baseSalary === salary, `${rec.baseSalary} vs ${salary}`);
  const ledgerBefore = await getCollection(LEDGER_KEY);
  const pay = await api('POST', '/api/payroll/payments', { recordId: rec.id, amount: salary, method: 'Bank Transfer', paidDate: '2026-09-30', createdBy: 'Test' });
  check('T1 full payment accepted', pay.ok, pay.data?.error || '');
  const after = await recordOf('2026-09', A);
  check('T1 status Paid, outstanding 0', after.status === 'Paid' && after.outstanding === 0 && after.paid === salary);
  const ledgerAfter = await getCollection(LEDGER_KEY);
  const newEntries = ledgerAfter.filter(e => !ledgerBefore.some(b => b.id === e.id));
  check('T1 exactly one new ledger entry', newEntries.length === 1, `new=${newEntries.length}`);
  check('T1 ledger entry is Staff Salary with the payment amount',
    newEntries.length === 1 && newEntries[0].category === 'Staff Salary' && newEntries[0].type === 'Outgoing' && newEntries[0].amount === salary);
  check('T1 payment row links the ledger entry', pay.data.payments.length === 1 && pay.data.payments[0].ledgerId === (newEntries[0] || {}).id);
  const staffAfter = await getCollection(STAFF_KEY);
  check('T1 staff legacy payStatus maintained (Pending — other months unprepared records exist? no: only this period)',
    staffAfter.find(s => s.id === A).lastPaidDate === '2026-09-30');
}

// ---------------------------------------------------------------- Test 2
{
  const rec = await recordOf('2026-09', B);
  const salary = salaryOf(B);
  const first = Math.floor(salary * 0.4);
  const p1 = await api('POST', '/api/payroll/payments', { recordId: rec.id, amount: first, method: 'Cash', paidDate: '2026-09-15', createdBy: 'Test' });
  check('T2 partial payment accepted', p1.ok, p1.data?.error || '');
  const mid = await recordOf('2026-09', B);
  check('T2 status Partial with correct outstanding', mid.status === 'Partial' && mid.outstanding === mid.due - first, `outstanding=${mid.outstanding}`);
  const p2 = await api('POST', '/api/payroll/payments', { recordId: rec.id, amount: mid.outstanding, method: 'Cash', paidDate: '2026-09-28', createdBy: 'Test' });
  check('T2 remaining payment accepted', p2.ok, p2.data?.error || '');
  const done = await recordOf('2026-09', B);
  check('T2 status Paid and Σ payments == due', done.status === 'Paid' && done.paid === done.due && done.paymentCount === 2);
}

// ---------------------------------------------------------------- Test 3
{
  await api('POST', '/api/payroll/periods', { year: 2026, month: 7, createdBy: 'Test' });
  await api('POST', '/api/payroll/periods', { year: 2026, month: 8, createdBy: 'Test' });
  const salary = salaryOf(C);
  const sep = await recordOf('2026-09', C);
  check('T3 previousOutstanding on Sep record == 2 × salary', sep.previousOutstanding === 2 * salary, `prev=${sep.previousOutstanding}`);
  const pay = await api('POST', '/api/payroll/payments', {
    recordId: sep.id, amount: salary, arrearsAmount: salary, method: 'Bank Transfer', paidDate: '2026-09-30', createdBy: 'Test',
  });
  check('T3 payment with arrears accepted', pay.ok, pay.data?.error || '');
  const jul = await recordOf('2026-07', C);
  const aug = await recordOf('2026-08', C);
  const sepAfter = await recordOf('2026-09', C);
  check('T3 FIFO: July settled first', jul.status === 'Paid' && jul.outstanding === 0);
  check('T3 August still Unpaid', aug.status === 'Unpaid' && aug.outstanding === salary);
  check('T3 September Paid by its own payment', sepAfter.status === 'Paid');
}

// ---------------------------------------------------------------- Test 4
{
  const before = await recordOf('2026-09', D);
  const staffArr = await getCollection(STAFF_KEY);
  const idx = staffArr.findIndex(s => s.id === D);
  const newSalary = (staffArr[idx].salary || 0) + 5000;
  staffArr[idx] = { ...staffArr[idx], salary: newSalary };
  await api('PUT', `/api/collections/${STAFF_KEY}`, { value: staffArr });
  await api('POST', '/api/payroll/periods', { year: 2026, month: 10, createdBy: 'Test' });
  const oct = await recordOf('2026-10', D);
  const sep = await recordOf('2026-09', D);
  check('T4 existing snapshot unchanged after salary revision', sep.baseSalary === before.baseSalary, `${sep.baseSalary}`);
  check('T4 next period uses the new salary', oct.baseSalary === newSalary, `${oct.baseSalary} vs ${newSalary}`);
}

// ---------------------------------------------------------------- Test 5
{
  const rec = await recordOf('2026-10', E);
  const salary = salaryOf(E);
  const due = salary + 5500;
  const pay = await api('POST', '/api/payroll/payments', {
    recordId: rec.id, amount: due, allowances: 5000, bonus: 2000, deductions: 1500,
    method: 'Bank Transfer', paidDate: '2026-10-31', createdBy: 'Test',
  });
  check('T5 payment with adjustments accepted', pay.ok, pay.data?.error || '');
  const after = await recordOf('2026-10', E);
  check('T5 due == salary + 5500', after.due === due && after.status === 'Paid', `due=${after.due}`);
  const prow = pay.data.payments[0];
  check('T5 payment row carries the adjustments (slip breakdown source)',
    prow.allowances === 5000 && prow.bonus === 2000 && prow.deductions === 1500);
  const ledger = await getCollection(LEDGER_KEY);
  const entry = ledger.find(e => e.id === prow.ledgerId);
  check('T5 ledger amount == cash amount paid', !!entry && entry.amount === due);
}

// ---------------------------------------------------------------- Test 6
{
  const again = await api('POST', '/api/payroll/periods', { year: 2026, month: 9, createdBy: 'Test' });
  check('T6 re-preparing a period is idempotent (still 28 records)', again.ok && again.data.period.staffCount === 28 && again.data.created === 0, `created=${again.data?.created}`);
  const recA = await recordOf('2026-09', A);
  const countBefore = recA.paymentCount;
  const over = await api('POST', '/api/payroll/payments', { recordId: recA.id, amount: 100, method: 'Cash', paidDate: '2026-09-30', createdBy: 'Test' });
  check('T6 paying an already-Paid record is rejected', !over.ok && over.status >= 400, `status=${over.status}`);
  const recAAfter = await recordOf('2026-09', A);
  check('T6 payment count unchanged after rejection', recAAfter.paymentCount === countBefore);
}

// ---------------------------------------------------------------- Test 7
{
  const all = await api('GET', '/api/payroll/payments');
  const payments = all.data.payments;
  const ledger = await getCollection(LEDGER_KEY);
  const salaryEntries = ledger.filter(e => e.category === 'Staff Salary' && e.type === 'Outgoing');
  const sumPayments = payments.reduce((s, p) => s + p.amount, 0);
  const sumLedger = salaryEntries.reduce((s, e) => s + e.amount, 0);
  check('T7 Σ ledger Staff Salary == Σ payroll payments', sumLedger === sumPayments, `${sumLedger} vs ${sumPayments}`);
  const ledgerIds = new Set(ledger.map(e => e.id));
  check('T7 every non-migration payment has a ledger entry', payments.every(p => p.source === 'migration' || (p.ledgerId && ledgerIds.has(p.ledgerId))));
}

// ------------------------------------------------------------- snapshot for T8
const periodsSnapshot = JSON.stringify((await api('GET', '/api/payroll/periods')).data);
const recordsSnapshot = JSON.stringify((await api('GET', '/api/payroll/periods/2026-09/records')).data.records);
await h.close();

// ---------------------------------------------------------------- Test 8
h = await startServer({ port: 0, dbPath });
rebase();
{
  const p2 = await (await fetch(`${base}/api/payroll/periods`)).json();
  const r2 = await (await fetch(`${base}/api/payroll/periods/2026-09/records`)).json();
  check('T8 periods identical after restart', JSON.stringify(p2) === periodsSnapshot);
  check('T8 records + derived statuses identical after restart', JSON.stringify(r2.records) === recordsSnapshot);
}
await h.close();

// ---------------------------------------------------------------- Test 9
{
  // Raw .db backup → restore into a fresh server.
  h = await startServer({ port: 0, dbPath });
  rebase();
  const backupRes = await fetch(`${base}/api/backup`);
  const bytes = Buffer.from(await backupRes.arrayBuffer());
  check('T9 backup download is a SQLite file', backupRes.ok && bytes.subarray(0, 15).toString() === 'SQLite format 3');
  const countsBefore = (await api('GET', '/api/payroll/export')).data;
  await h.close();

  const dbPath2 = path.join(tmp, 'restored.db');
  h = await startServer({ port: 0, dbPath: dbPath2 });
  rebase();
  const restore = await fetch(`${base}/api/restore`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: bytes });
  check('T9 restore accepted', restore.ok);
  const countsAfter = await (await fetch(`${base}/api/payroll/export`)).json();
  check('T9 payroll rows survive backup/restore',
    countsAfter.periods.length === countsBefore.periods.length &&
    countsAfter.records.length === countsBefore.records.length &&
    countsAfter.payments.length === countsBefore.payments.length);
  const sumA = countsBefore.payments.reduce((s, p) => s + p.amount, 0);
  const sumB = countsAfter.payments.reduce((s, p) => s + p.amount, 0);
  check('T9 Σ payment amounts survive backup/restore', sumA === sumB, `${sumA} vs ${sumB}`);
  await h.close();

  // JSON path: export → import into another fresh server (twice = idempotent).
  const dbPath3 = path.join(tmp, 'json-import.db');
  h = await startServer({ port: 0, dbPath: dbPath3 });
  rebase();
  const imp = await fetch(`${base}/api/payroll/import`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(countsBefore) });
  check('T9 JSON import accepted', imp.ok);
  const exp3 = await (await fetch(`${base}/api/payroll/export`)).json();
  check('T9 JSON export/import round-trips payroll',
    exp3.periods.length === countsBefore.periods.length && exp3.payments.length === countsBefore.payments.length);
  await fetch(`${base}/api/payroll/import`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(countsBefore) });
  const exp3b = await (await fetch(`${base}/api/payroll/export`)).json();
  check('T9 JSON import is idempotent', exp3b.payments.length === countsBefore.payments.length);
  await h.close();

  h = await startServer({ port: 0, dbPath }); // back to main server for T10 + migration
  rebase();
}

// ---------------------------------------------------------------- Test 10
{
  const F = staffIds[5];
  const G = staffIds[6];
  const recF = await recordOf('2026-10', F);
  const recG = await recordOf('2026-10', G);
  const staffRawBefore = JSON.stringify((await api('GET', `/api/collections/${STAFF_KEY}`)).data.value);
  const ledgerRawBefore = JSON.stringify((await api('GET', `/api/collections/${LEDGER_KEY}`)).data.value);
  const paymentsBefore = (await api('GET', '/api/payroll/payments')).data.payments.length;

  const bulk = await api('POST', '/api/payroll/payments/bulk', {
    items: [{ recordId: recF.id, amount: 1000 }, { recordId: recG.id, amount: 999999999 }],
    method: 'Cash', paidDate: '2026-10-31', createdBy: 'Test',
  });
  check('T10 bulk with an over-due item fails', !bulk.ok, `status=${bulk.status}`);
  const paymentsAfter = (await api('GET', '/api/payroll/payments')).data.payments.length;
  check('T10 zero new payment rows after rollback', paymentsAfter === paymentsBefore);
  const staffRawAfter = JSON.stringify((await api('GET', `/api/collections/${STAFF_KEY}`)).data.value);
  const ledgerRawAfter = JSON.stringify((await api('GET', `/api/collections/${LEDGER_KEY}`)).data.value);
  check('T10 staff collection blob byte-identical after rollback', staffRawAfter === staffRawBefore);
  check('T10 ledger collection blob byte-identical after rollback', ledgerRawAfter === ledgerRawBefore);

  const bogus = await api('POST', '/api/payroll/payments/bulk', {
    items: [{ recordId: 'PREC-2099-01-NOPE', amount: 1000 }],
    method: 'Cash', paidDate: '2026-10-31', createdBy: 'Test',
  });
  check('T10 bulk with a nonexistent record fails', !bogus.ok && bogus.status === 404, `status=${bogus.status}`);
  check('T10 still zero new payments', (await api('GET', '/api/payroll/payments')).data.payments.length === paymentsBefore);
}

// ------------------------------------------------------- Migration fixture
{
  const fixtureStaff = [{
    id: 'LEG-001', name: 'Legacy Teacher', role: 'Teacher', category: 'Teacher',
    department: 'Academics', qualification: 'M.A.', salary: 40000,
    payStatus: 'Pending', status: 'Active', phone: '03000000000', email: 'legacy@example.com',
    joiningDate: '2020-01-01', lastPaidDate: '2026-09-05', paymentMethod: 'Bank Transfer',
    paidMonths: ['August 2026', 'September 2026'],
    transactions: [
      { id: 'SAL-LEGACY-1', createdBy: 'Admin', amount: 80000, reason: 'Salary: August 2026, September 2026', payment: 'Bank Transfer', type: 'Salary', createdAt: '2026-09-05T10:00:00.000Z' },
      { id: 'LOAN-LEGACY-1', createdBy: 'Admin', amount: 5000, reason: 'Staff loan', payment: 'Cash', type: 'Loan', createdAt: '2026-08-01T10:00:00.000Z' },
    ],
  }];
  await api('PUT', `/api/collections/${STAFF_KEY}`, { value: fixtureStaff });
  const ledgerFixture = [{
    id: 'TX-OUT-LEGACY-1', date: '05 Sep 2026', rawDate: '2026-09-05', time: '10:00 AM',
    timestamp: new Date('2026-09-05T10:00:00').getTime(), amount: 80000, createdBy: 'Admin',
    paymentType: 'Bank Transfer', type: 'Outgoing', category: 'Staff Salary',
    reason: 'Staff Salary: Legacy Teacher (LEG-001) — August 2026, September 2026', note: '2 month(s)',
  }];
  const ledgerBefore = await getCollection(LEDGER_KEY);
  const combinedLedger = [...ledgerFixture, ...ledgerBefore];
  await api('PUT', `/api/collections/${LEDGER_KEY}`, { value: combinedLedger });
  const ledgerSnapshot = JSON.stringify(combinedLedger);

  const mig = await api('POST', '/api/payroll/migrate', {});
  check('MIG migration runs', mig.ok, mig.data?.error || '');
  const rep = (mig.data.staff || []).find(r => r.staffId === 'LEG-001');
  check('MIG report: imported == salary transactions == ledger (difference 0)',
    !!rep && rep.imported === 80000 && rep.salaryTransactions === 80000 && rep.ledger === 80000 && rep.difference === 0,
    JSON.stringify(rep));
  const mine = await api('GET', '/api/payroll/staff/LEG-001');
  check('MIG 2 records created (Aug + Sep 2026)', mine.data.records.length === 2, `records=${mine.data.records.length}`);
  check('MIG 2 payments of 40,000 with ledger_id NULL',
    mine.data.payments.length === 2 && mine.data.payments.every(p => p.amount === 40000 && p.ledgerId === null && p.source === 'migration'));
  check('MIG both months show Paid from migrated payments', mine.data.records.every(r => r.status === 'Paid'));
  const ledgerAfterMig = JSON.stringify(await getCollection(LEDGER_KEY));
  check('MIG ledger collection unchanged (no double-count)', ledgerAfterMig === ledgerSnapshot);
  const mig2 = await api('POST', '/api/payroll/migrate', {});
  const mine2 = await api('GET', '/api/payroll/staff/LEG-001');
  check('MIG second run imports nothing new', mig2.ok && mine2.data.payments.length === 2);
}

// ------------------------------------------------------------- System reset
{
  const reset = await api('POST', '/api/system/reset');
  check('RESET system reset succeeds', reset.ok);
  const exp = await api('GET', '/api/payroll/export');
  check('RESET payroll tables are empty after reset',
    exp.data.periods.length === 0 && exp.data.records.length === 0 && exp.data.payments.length === 0,
    `periods=${exp.data.periods.length} records=${exp.data.records.length} payments=${exp.data.payments.length}`);
  const staffAfterReset = await getCollection(STAFF_KEY);
  check('RESET staff collection is gone after reset', staffAfterReset.length === 0, `len=${staffAfterReset.length}`);
  const healthRes = await (await fetch(`${base}/api/health`)).json();
  check('RESET all entity counts are 0 after reset',
    Object.values(healthRes.counts || {}).every(c => c === 0), JSON.stringify(healthRes.counts));
  const reload = await api('PUT', `/api/collections/${STAFF_KEY}`, { value: fixtureStaff() });
  const staffReloaded = await getCollection(STAFF_KEY);
  check('RESET fixtures insert again after reset', reload.ok && staffReloaded.length === 28, `len=${staffReloaded.length}`);
}

await h.close();
console.log(failures === 0 ? 'PAYROLL TEST: ALL PASS' : `PAYROLL TEST: ${failures} FAILURE(S)`);
console.log(`temp dir kept for inspection: ${tmp}`);
process.exit(failures ? 1 : 0);
