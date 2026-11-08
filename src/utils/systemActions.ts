import { DEFAULT_SCHOOL_SETTINGS, saveSchoolSettings } from './settingsHelper';
import { clearAllFiles } from './blobStore';

// Client side of Settings → System (Reset System).
// The server endpoint lives in server/index.js:
//   POST /api/system/reset — wipes every data table (schema kept).
// A fresh install boots completely empty and there is NO built-in /
// sample data anywhere in the app (owner directive, 2026-11-08): the
// database only ever holds data the user entered. Reset is the only
// system action.

const APP_KEY_PREFIXES = ['schoollee_', 'schooliee_', 'schoolex_'];

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
