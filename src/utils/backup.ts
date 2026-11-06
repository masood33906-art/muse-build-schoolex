import { localISODate } from './dates';
import { clearFault, getFaults } from './storage';
import { listFileIds, getFile, putFile, blobToDataURL, dataURLToBlob } from './blobStore';

const PREFIXES = ['schoollee_', 'schooliee_'];
const LAST_BACKUP_KEY = 'schoollee_last_backup_at';
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
  return { app: 'schoolex', schemaVersion: 1, exportedAt: new Date().toISOString(), keys, files };
}

export async function downloadBackup(tag = '') {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
  } catch {
    // ignore if storage is completely full
  }
  const payload = await buildBackup();
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `schoolex-backup-${localISODate()}${tag}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  try {
    window.dispatchEvent(new CustomEvent('backupCompleted'));
  } catch {
    // ignore
  }
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
  if (!localStorage.getItem(LAST_BACKUP_KEY)) {
    localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
  }
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
  getFaults().forEach(k => clearFault(k));
  if (typeof location !== 'undefined' && typeof location.reload === 'function') {
    location.reload();
  }
}

export const daysSinceBackup = (): number => {
  const t = localStorage.getItem(LAST_BACKUP_KEY);
  if (!t) return Infinity;
  const ms = Date.now() - new Date(t).getTime();
  return Number.isNaN(ms) ? Infinity : Math.max(0, Math.floor(ms / 86_400_000));
};
