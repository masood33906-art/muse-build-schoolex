import { Student } from '../../types';
import { loadAllLedgerItems, saveAllLedgerItems } from '../studentFeeLedgerHelper';
import { FEE_PAYMENTS_KEY, FeePayment, listPayments } from '../paymentStore';
import { mustSave } from '../storage';
import { legacyHashPaid } from './legacyFeeDefaults';

const DONE = 'schoollee_fees_migrated_v2';
const OLD_OVERRIDE_KEY = 'schooliee_student_fees_override_clean_v1';

export function migrateFeesV2(students: Student[]) {
  if (localStorage.getItem(DONE)) return;
  const raw = localStorage.getItem(OLD_OVERRIDE_KEY);
  if (!raw) { localStorage.setItem(DONE, '1'); return; }

  localStorage.setItem(`${OLD_OVERRIDE_KEY}__pre_v2`, raw);
  let overrides: Record<string, any> = {};
  try { overrides = JSON.parse(raw); } catch { return; }

  const ledgers = loadAllLedgerItems();
  const synth: FeePayment[] = [];

  for (const s of students) {
    const clean = s.id.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const ov = overrides[s.id] ?? overrides[clean];
    if (!ov || typeof ov.totalPaid !== 'number') continue;

    const items = (ledgers[s.id] ?? []).slice().sort((a, b) => a.monthKey.localeCompare(b.monthKey));
    const alreadyInLedger = items.reduce((sum, i) => sum + i.paidAmount, 0);
    // Recover only what the user actually added on top of the old hash-based default
    const userPaid = Math.max(0, ov.totalPaid - legacyHashPaid(s));
    let toApply = Math.max(0, userPaid - alreadyInLedger);
    if (toApply <= 0) continue;

    const allocations: FeePayment['allocations'] = [];
    for (const item of items) {
      if (toApply <= 0) break;
      const chunk = Math.min(item.total - item.paidAmount, toApply);
      if (chunk > 0) {
        item.paidAmount += chunk;
        item.status = item.paidAmount >= item.total ? 'Paid' : 'Partially Paid';
        allocations.push({ studentId: s.id, itemId: item.id, amount: chunk });
        toApply -= chunk;
      }
    }
    if (allocations.length) {
      synth.push({
        id: `MIG-${s.id}`,
        receiptNo: `MIG-${s.id}`,
        date: '1970-01-01',
        createdAt: new Date().toISOString(),
        familyId: s.familyId,
        studentIds: [s.id],
        amount: allocations.reduce((a, x) => a + x.amount, 0),
        method: 'Cash',
        allocations,
        creditUsed: 0,
        creditAdded: 0,
        createdBy: 'Migration',
        isMigrated: true,
      });
    }
  }
  saveAllLedgerItems(ledgers);
  if (synth.length) mustSave(FEE_PAYMENTS_KEY, [...listPayments(), ...synth]);
  localStorage.removeItem(OLD_OVERRIDE_KEY);
  localStorage.setItem(DONE, '1');
}
