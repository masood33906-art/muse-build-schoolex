export const DEMO = import.meta.env?.VITE_DEMO === 'true';

type Listener = () => void;
const faulted = new Map<string, string>();         // key -> raw text that failed to load
const listeners = new Set<Listener>();
const emit = () => listeners.forEach(l => l());

export const subscribeFaults = (l: Listener) => { listeners.add(l); return () => listeners.delete(l); };
export const getFaults = () => Array.from(faulted.keys());
export const getFaultRaw = (k: string) => faulted.get(k) ?? '';
export function clearFault(key: string, removeKey = false) {
  faulted.delete(key); if (removeKey) localStorage.removeItem(key); emit();
}

export function loadJSON<T>(key: string, fallback: T, isValid: (v: unknown) => v is T = (_v): _v is T => true): T {
  let raw: string | null = null;
  try { raw = localStorage.getItem(key); } catch { return fallback; }
  if (raw === null) return fallback;                       // first run: key does not exist yet
  try {
    const v = JSON.parse(raw);
    if (!isValid(v)) throw new Error('unexpected shape');
    return v;
  } catch {
    try { localStorage.setItem(`${key}__corrupt_${Date.now()}`, raw); } catch { /* quota: original stays untouched */ }
    faulted.set(key, raw); emit();
    return fallback;
  }
}

/** Returns false (and raises a visible error) if the write did not happen. */
export function saveJSON(key: string, value: unknown): boolean {
  if (faulted.has(key)) return false;                      // NEVER overwrite a key we failed to read
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch (e) {
    window.dispatchEvent(new CustomEvent('storageError', { detail: { key, reason: (e as DOMException).name } }));
    return false;
  }
}
/** Same as saveJSON but throws; used inside multi-key transactions (§7). */
export function mustSave(key: string, value: unknown) { if (!saveJSON(key, value)) throw new Error(`Could not save ${key}`); }

/** Run fn; if it throws, restore all given keys to their previous raw value. */
export function withRollback<T>(keys: string[], fn: () => T): T {
  const snap = keys.map(k => [k, localStorage.getItem(k)] as const);
  try { return fn(); }
  catch (e) {
    snap.forEach(([k, v]) => v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v));
    throw e;
  }
}

export function storageUsageBytes(): number {
  let n = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;
    n += (k.length + (localStorage.getItem(k)?.length ?? 0)) * 2;
  }
  return n;
}


// ---------------------------------------------------------------------------
// SchoolEx backend sync shim (added for the offline standalone build).
// When the app is served by the local SchoolEx server (Electron / node
// server/), legacy localStorage keys are mirrored to SQLite through
// /api/collections. localStorage remains the synchronous cache/fallback, so
// all existing UI logic is untouched and the app still works purely in a
// browser with no backend. Changes are minimal and reversible: delete this
// block (and the storage import in main.tsx) to restore original behaviour.
// ---------------------------------------------------------------------------
const SYNC_PREFIXES = ['schoollee_', 'schooliee_', 'schoolex_'];
const shouldSync = (k: string) => SYNC_PREFIXES.some(p => k.startsWith(p));
let applyingRemote = false;
const pending = new Map<string, ReturnType<typeof setTimeout>>();

function putCollection(key: string, raw: string | null) {
  try {
    const url = `/api/collections/${encodeURIComponent(key)}`;
    if (raw === null) {
      fetch(url, { method: 'DELETE', keepalive: true }).catch(() => {});
    } else {
      let value: unknown = raw;
      try { value = JSON.parse(raw); } catch { /* store raw string */ }
      fetch(url, {
        method: 'PUT', keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      }).catch(() => { /* offline / browser-only: localStorage is the fallback */ });
    }
  } catch { /* never break the UI over sync */ }
}

function queueSync(key: string) {
  if (applyingRemote || !shouldSync(key) || typeof window === 'undefined') return;
  const old = pending.get(key); if (old) clearTimeout(old);
  pending.set(key, setTimeout(() => {
    pending.delete(key);
    try { putCollection(key, localStorage.getItem(key)); } catch { /* ignore */ }
  }, 250));
}

// Mirror every legacy write, including code that calls localStorage directly.
try {
  const proto = Storage.prototype as Storage & { __schoolexPatched?: boolean };
  if (!proto.__schoolexPatched) {
    proto.__schoolexPatched = true;
    const origSet = Storage.prototype.setItem;
    const origRemove = Storage.prototype.removeItem;
    Storage.prototype.setItem = function (k: string, v: string) {
      const r = origSet.call(this, k, v);
      if (this === window.localStorage) queueSync(k);
      return r;
    };
    Storage.prototype.removeItem = function (k: string) {
      const r = origRemove.call(this, k);
      if (this === window.localStorage) queueSync(k);
      return r;
    };
  }
} catch { /* non-browser environment */ }

// Hydrate the local cache from the backend on startup. On a first run the
// cache is empty and the server simply receives the app's subsequent saves;
// on later runs the server (SQLite) is the durable copy and refreshes the
// cache here, after which the app re-reads on its normal navigation/reload.
try {
  if (typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
    fetch('/api/collections')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!data?.collections) return;
        applyingRemote = true;
        try {
          for (const [k, v] of Object.entries(data.collections as Record<string, unknown>)) {
            if (!shouldSync(k)) continue;
            const raw = typeof v === 'string' ? v : JSON.stringify(v);
            if (localStorage.getItem(k) !== raw) localStorage.setItem(k, raw);
          }
        } finally { applyingRemote = false; }
        window.dispatchEvent(new CustomEvent('schoolex-hydrated'));
      })
      .catch(() => { /* browser-only mode */ });
  }
} catch { /* ignore */ }
