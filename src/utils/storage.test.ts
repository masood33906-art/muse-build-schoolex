// Simple localStorage polyfill for Node environment if needed
if (typeof globalThis.localStorage === 'undefined' || typeof globalThis.localStorage.getItem !== 'function') {
  const store: Record<string, string> = {};
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => { store[k] = String(v); },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { Object.keys(store).forEach(k => delete store[k]); },
      key: (i: number) => Object.keys(store)[i] ?? null,
      get length() { return Object.keys(store).length; }
    },
    configurable: true,
    writable: true
  });
}

import {
  DEMO,
  loadJSON,
  saveJSON,
  mustSave,
  withRollback,
  getFaults,
  getFaultRaw,
  clearFault
} from './storage';
import { ATTENDANCE_STORAGE_KEY, loadAttendance } from './attendanceHelper';
import { purgeSeedAttendance } from '../App';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function resetStorage() {
  localStorage.clear();
  for (const k of getFaults()) {
    clearFault(k, true);
  }
}

export function runStorageAndAttendanceTests() {
  resetStorage();

  // 1. DEMO is false by default when VITE_DEMO is not set
  assert(DEMO === false, 'Expected DEMO to be false by default');

  // 2. loadAttendance returns empty object on fresh install
  assert(Object.keys(loadAttendance()).length === 0, 'Expected loadAttendance() to return {} on fresh install');

  // 3. purgeSeedAttendance drops seeded rows (no isManual) on SEED_DATES while keeping user-marked rows
  const rawData = {
    '2026-09-07': [
      { id: 'S-1', name: 'Seeded Student', type: 'student', date: '2026-09-07', status: 'present' },
      { id: 'S-2', name: 'Manual Student', type: 'student', date: '2026-09-07', status: 'absent', isManual: true }
    ],
    '2026-09-08': [
      { id: 'S-1', name: 'Seeded Only', type: 'student', date: '2026-09-08', status: 'present' }
    ],
    '2026-10-01': [
      { id: 'S-1', name: 'Other Date', type: 'student', date: '2026-10-01', status: 'present', isManual: false }
    ]
  };
  localStorage.setItem(ATTENDANCE_STORAGE_KEY, JSON.stringify(rawData));

  purgeSeedAttendance();

  assert(localStorage.getItem('schoollee_att_seed_purged_v1') === '1', 'Expected purge flag to be set');
  assert(
    localStorage.getItem(`${ATTENDANCE_STORAGE_KEY}__pre_purge`) === JSON.stringify(rawData),
    'Expected pre_purge backup to match original raw data'
  );

  const cleaned = loadAttendance();
  assert(cleaned['2026-09-07']?.length === 1 && cleaned['2026-09-07'][0].id === 'S-2', 'Expected only manual row on 2026-09-07');
  assert(cleaned['2026-09-08'] === undefined, 'Expected 2026-09-08 to be deleted when all seeded rows removed');
  assert(cleaned['2026-10-01']?.length === 1, 'Expected non-seed date 2026-10-01 to be untouched');

  // 4. loadJSON preserves corrupt JSON, creates __corrupt_ backup, records fault;
  //    the quarantined key stays writable via saveJSON (Fix P1-6)
  resetStorage();
  const key = 'schoollee_offline_students_clean_v1';
  localStorage.setItem(key, '{bad json');

  const res = loadJSON(key, [], Array.isArray);
  assert(Array.isArray(res) && res.length === 0, 'Expected fallback [] on corrupt JSON');
  assert(getFaults().includes(key), 'Expected key to be in getFaults()');
  assert(getFaultRaw(key) === '{bad json', 'Expected getFaultRaw to return original corrupt string');
  assert(localStorage.getItem(key) === '{bad json', 'Expected original key to still hold {bad json');

  let corruptBackupFound = false;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(`${key}__corrupt_`)) {
      corruptBackupFound = localStorage.getItem(k) === '{bad json';
    }
  }
  assert(corruptBackupFound, 'Expected __corrupt_<timestamp> backup key to exist with raw data');

  // Fix P1-6: after quarantine the key accepts saves again — the __corrupt_
  // copy preserves the corrupt data, and the fault stays registered (for
  // StorageFaultScreen) until the user dismisses it.
  const saved = saveJSON(key, [{ id: 'DEMO-1' }]);
  assert(saved === true, 'Expected saveJSON to succeed for a quarantined key (Fix P1-6)');
  assert(localStorage.getItem(key) === JSON.stringify([{ id: 'DEMO-1' }]), 'Expected quarantined key to be overwritten by saveJSON');
  assert(getFaults().includes(key), 'Expected fault to stay registered until dismissed');

  // Clearing fault with removeKey=true removes the corrupt key
  clearFault(key, true);
  assert(!getFaults().includes(key), 'Expected fault to be cleared');
  assert(localStorage.getItem(key) === null, 'Expected key to be removed when clearFault(key, true) is called');

  // 5. loadJSON accepts empty array [] for staff and does not fall back to demo data
  resetStorage();
  const staffKey = 'schoollee_offline_staff_clean_v1';
  saveJSON(staffKey, []);
  const loadedStaff = loadJSON(staffKey, [{ id: 'DEMO-STAFF' }], Array.isArray);
  assert(Array.isArray(loadedStaff) && loadedStaff.length === 0, 'Expected empty staff list [] to stay empty');

  // 6. withRollback restores previous values when transaction throws
  resetStorage();
  const k1 = 'key_one';
  const k2 = 'key_two';
  localStorage.setItem(k1, '"initial_1"');

  let threw = false;
  try {
    withRollback([k1, k2], () => {
      mustSave(k1, 'updated_1');
      mustSave(k2, 'updated_2');
      throw new Error('simulated failure');
    });
  } catch {
    threw = true;
  }
  assert(threw, 'Expected withRollback to rethrow error');
  assert(localStorage.getItem(k1) === '"initial_1"', 'Expected k1 to be rolled back');
  assert(localStorage.getItem(k2) === null, 'Expected k2 to be rolled back to null');
}

runStorageAndAttendanceTests();
