// Self-contained test for §5 & §6 (storageUsageBytes, buildBackup, restoreBackup)
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => store.set(k, String(v)),
  removeItem: (k: string) => store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => Array.from(store.keys())[i] ?? null,
  get length() {
    return store.size;
  },
};
(globalThis as any).window = {
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {},
};
(globalThis as any).CustomEvent = class {
  detail: any;
  constructor(_type: string, init?: { detail?: any }) {
    this.detail = init?.detail;
  }
};
(globalThis as any).URL = {
  createObjectURL: () => 'blob:mock',
  revokeObjectURL: () => {},
};
(globalThis as any).document = {
  createElement: () => ({ click: () => {}, href: '', download: '' }),
};
(globalThis as any).location = {
  reload: () => {},
};

import { storageUsageBytes, loadJSON, getFaults } from './storage';
import { buildBackup, restoreBackup } from './backup';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

async function runTests() {
  store.clear();
  localStorage.setItem('schoollee_students', JSON.stringify([{ id: 'ST-0001', name: 'Ali' }]));
  localStorage.setItem('schooliee_legacy_typo', JSON.stringify({ ok: true }));
  localStorage.setItem('schoollee_students__corrupt_123', '{bad');
  localStorage.setItem('schoollee_att__pre_purge', '{}');
  localStorage.setItem('other_unrelated_key', 'ignore_me');

  // 1. Test storageUsageBytes
  const bytes = storageUsageBytes();
  assert(bytes > 0, 'storageUsageBytes should return > 0 when keys exist');

  // 2. Test buildBackup filters prefixes and excludes __corrupt_ and __pre
  const backup = await buildBackup();
  assert(backup.app === 'schoolex', 'backup.app should be schoolex');
  assert(backup.schemaVersion === 1, 'backup.schemaVersion should be 1');
  assert('schoollee_students' in backup.keys, 'should include schoollee_ key');
  assert('schooliee_legacy_typo' in backup.keys, 'should include schooliee_ key');
  assert(!('schoollee_students__corrupt_123' in backup.keys), 'should exclude __corrupt_ key');
  assert(!('schoollee_att__pre_purge' in backup.keys), 'should exclude __pre key');
  assert(!('other_unrelated_key' in backup.keys), 'should exclude unrelated prefix');

  // 3. Clear localStorage, trigger a fault, and restore from backup
  store.clear();
  localStorage.setItem('schoollee_students', '{corrupt_json');
  loadJSON('schoollee_students', []);
  assert(getFaults().includes('schoollee_students'), 'fault should be recorded before restore');

  const backupJson = JSON.stringify(backup);
  const mockFile = {
    text: async () => backupJson,
  } as unknown as File;

  await restoreBackup(mockFile);

  assert(
    localStorage.getItem('schoollee_students') === JSON.stringify([{ id: 'ST-0001', name: 'Ali' }]),
    'restored student data should match backup'
  );
  assert(
    localStorage.getItem('schooliee_legacy_typo') === JSON.stringify({ ok: true }),
    'restored schooliee_ key should match backup'
  );
  assert(getFaults().length === 0, 'faults should be cleared after restoreBackup');

  console.log('All §5 & §6 backup and storage tests passed!');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
