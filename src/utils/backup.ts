import { localISODate } from './dates';
import { clearFault, getFaults } from './storage';
import { listFileIds, getFile, putFile, blobToDataURL, dataURLToBlob } from './blobStore';
import { exportPayroll, importPayroll } from './payrollApi';

const PREFIXES = ['schoollee_', 'schooliee_'];
const isAppKey = (k: string) =>
  PREFIXES.some(p => k.startsWith(p)) && !k.includes('__corrupt_') && !k.includes('__pre');

export async function buildBackup() {
  const keys: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;
    if (isAppKey(k)) keys[k] = localStorage.getItem(k) ?? '';
  }
  const files: Record<string, string> = {};
  try {
    const ids = await listFileIds();
    for (const rawId of ids) {
      const id = String(rawId);
      const blob = await getFile(id);
      if (blob) {
        files[id] = await blobToDataURL(blob);
      }
    }
  } catch {
    // IndexedDB unavailable or empty
  }
  // Payroll (PAYROLL_PLAN §4): server-side tables are not in localStorage, so
  // include the payroll export when the app server is reachable. Additive —
  // schemaVersion stays 1 and older backups (without `payroll`) still restore.
  let payroll: Awaited<ReturnType<typeof exportPayroll>> | undefined;
  try {
    payroll = await exportPayroll();
  } catch {
    payroll = undefined;
  }
  return { app: 'schoolex', schemaVersion: 1, exportedAt: new Date().toISOString(), keys, files, ...(payroll ? { payroll } : {}) };
}

export async function downloadBackup(tag = '') {
  const payload = await buildBackup();
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `schoolex-backup-${localISODate()}${tag}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function restoreBackup(file: File) {
  const data = JSON.parse(await file.text());
  if (data?.app !== 'schoolex' || typeof data.keys !== 'object') throw new Error('Not a SchoolEx backup file');
  if (data.schemaVersion > 1) throw new Error('Backup is from a newer app version');
  await downloadBackup('-before-restore'); // safety copy of current data
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;
    if (isAppKey(k)) toRemove.push(k);
  }
  toRemove.forEach(k => localStorage.removeItem(k));
  Object.entries<string>(data.keys).forEach(([k, v]) => {
    if (isAppKey(k)) localStorage.setItem(k, v);
  });
  if (data.files && typeof data.files === 'object') {
    for (const [id, dataUrl] of Object.entries<string>(data.files)) {
      if (typeof dataUrl === 'string') {
        try {
          await putFile(id, dataURLToBlob(dataUrl));
        } catch {
          // ignore if IndexedDB is unavailable
        }
      }
    }
  }
  // Restore payroll tables (additive: only when the backup carries a payroll
  // section and the app server is reachable).
  if (data.payroll && typeof data.payroll === 'object') {
    try {
      await importPayroll(data.payroll);
    } catch (e) {
      console.warn('[backup] payroll import failed:', e);
    }
  }
  getFaults().forEach(k => clearFault(k));
  if (typeof location !== 'undefined' && typeof location.reload === 'function') {
    location.reload();
  }
}
