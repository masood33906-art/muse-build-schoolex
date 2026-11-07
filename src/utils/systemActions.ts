import { DEFAULT_SCHOOL_SETTINGS, saveSchoolSettings } from './settingsHelper';
import { clearAllFiles } from './blobStore';

// Client side of Settings → System (Load Dummy Data / Reset System).
// The server endpoints live in server/index.js:
//   POST /api/system/load-dummy-data — seeds the sample school into an
//     EMPTY system only (409 with a plain message when data exists).
//   POST /api/system/reset — wipes every data table (schema kept).
// A fresh install therefore boots empty; these actions are the only way
// sample data enters the system.

const APP_KEY_PREFIXES = ['schoollee_', 'schooliee_', 'schoolex_'];

export interface DummyDataResult {
  ok: true;
  loaded: { students: number; staff: number; classes: number };
  records: number;
  collectionsSeeded: number;
}

export async function loadDummyData(): Promise<DummyDataResult> {
  let res: Response;
  try {
    res = await fetch('/api/system/load-dummy-data', { method: 'POST' });
  } catch {
    throw new Error('Could not reach the SchoolEx app server. Dummy data can only be loaded when the app server is running.');
  }
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    throw new Error((data as any)?.error || `Could not load dummy data (HTTP ${res.status}).`);
  }
  return data as DummyDataResult;
}

/** Remove every app-owned localStorage key (collections, settings, the
 *  sync outbox, migration flags, corrupt-key quarantines). */
function clearClientState() {
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;
    if (APP_KEY_PREFIXES.some(p => k.startsWith(p))) toRemove.push(k);
  }
  toRemove.forEach(k => localStorage.removeItem(k));
}

/**
 * Full reset back to the empty first-run state: server wipe first (if it
 * fails, nothing local is touched, so no half-reset state), then local
 * collections/settings/outbox, the IndexedDB file store, and school
 * settings rewritten to factory defaults. Caller reloads the app.
 */
export async function resetSystem(): Promise<void> {
  let res: Response;
  try {
    res = await fetch('/api/system/reset', { method: 'POST' });
  } catch {
    throw new Error('Could not reach the SchoolEx app server, so the reset was not started. No data was changed.');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({} as any));
    throw new Error((data as any)?.error || `Server reset failed (HTTP ${res.status}). No data was changed.`);
  }
  clearClientState();
  try { await clearAllFiles(); } catch { /* IndexedDB unavailable — nothing stored there anyway */ }
  saveSchoolSettings(DEFAULT_SCHOOL_SETTINGS);
}
