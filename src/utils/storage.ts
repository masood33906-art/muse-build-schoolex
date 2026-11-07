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
    // The fault stays registered purely so StorageFaultScreen can surface
    // the quarantine (with a raw download) until dismissed — it no longer
    // blocks future saves to this key (Fix P1-6, see saveJSON).
    faulted.set(key, raw); emit();
    return fallback;
  }
}

/** Returns false (and raises a visible error) if the write did not happen. */
export function saveJSON(key: string, value: unknown): boolean {
  // Fix P1-6: a key whose stored value failed to parse stays WRITABLE. By
  // the time loadJSON faulted, the corrupt raw text was already quarantined
  // to `${key}__corrupt_<ts>` and the fault stays registered (so
  // StorageFaultScreen can still surface it, with the raw download, until
  // the user dismisses it there). Blocking every later save for the whole
  // session only turned recoverable corruption into silent data loss:
  // callers that ignore this return value appeared to save while nothing
  // persisted. Saving fresh, valid data over the corrupt value is safe —
  // the quarantined copy preserves the original.
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
// Persisted outbox of collections whose latest backend send failed
// (Fix P1-5). The key is excluded from sync itself, so the outbox is
// never mirrored to the backend.
export const SYNC_OUTBOX_KEY = 'schoolex_sync_outbox_v1';
const shouldSync = (k: string) => k !== SYNC_OUTBOX_KEY && SYNC_PREFIXES.some(p => k.startsWith(p));
let applyingRemote = false;
// Whether this session actually has a backend. The standalone app is
// served BY its backend, so a successful /api/collections response at
// startup is the signal; if that fails we assume browser-only mode (the
// shim's original fallback), where failed sends stay silent exactly as
// before and no outbox/fault machinery engages.
let syncArmed = false;
const pending = new Map<string, ReturnType<typeof setTimeout>>();

// ---------------------------------------------------------------------------
// Fix P1-1: deterministic startup hydration. The collections fetch below
// applies the backend's copy to localStorage; `hydrationPromise` resolves
// once that has happened (or once we know there is no backend to hydrate
// from — browser-only mode resolves immediately). main.tsx gates the
// first render on this promise (with a timeout), and App keeps its save
// effects disarmed until `isHydrated()` is true, so a stale first paint
// can never be persisted back over the server's fuller copy.
// ---------------------------------------------------------------------------
let hydratedFlag = false;
let resolveHydration: () => void = () => {};
export const hydrationPromise = new Promise<void>(res => { resolveHydration = res; });
export const isHydrated = () => hydratedFlag;
function markHydrated() {
  if (hydratedFlag) return;
  hydratedFlag = true;
  resolveHydration();
}

// ---------------------------------------------------------------------------
// Fix P1-5: sync-failure visibility. Consecutive failed sends per key are
// counted; once a key crosses the threshold its failure is "persistent"
// and is surfaced through the same external-store mechanism as data
// faults (subscribeFaults/emit above), rendered by StorageFaultScreen.
// The App `storageError` banner is NOT reused: its copy is specific to
// the localStorage-quota case ("Storage is full"), which a backend sync
// failure is not.
// ---------------------------------------------------------------------------
const SYNC_FAULT_THRESHOLD = 3;
const syncFailures = new Map<string, number>();    // key -> consecutive failed sends
export const getSyncFaults = () =>
  Array.from(syncFailures.entries()).filter(([, n]) => n >= SYNC_FAULT_THRESHOLD).map(([k]) => k);
function noteSyncFailure(key: string) {
  const n = (syncFailures.get(key) ?? 0) + 1;
  syncFailures.set(key, n);
  if (n === SYNC_FAULT_THRESHOLD) emit();
}
function noteSyncSuccess(key: string) {
  if (syncFailures.delete(key)) emit();
}

// One backend send. Resolves true only when the server accepted the write
// (a non-2xx response counts as failure, exactly like a network error).
// `keepalive` is ONLY for the beforeunload flush: browsers cap keepalive
// request bodies at 64 KiB, so a keepalive PUT of a large collection (e.g.
// the fee ledger) always fails in a real browser. Normal sends must not use
// it; the persisted outbox + startup flush cover the window-close case.
function sendCollection(key: string, raw: string | null, keepalive = false): Promise<boolean> {
  try {
    const url = `/api/collections/${encodeURIComponent(key)}`;
    if (raw === null) {
      return fetch(url, { method: 'DELETE', keepalive: true })
        .then(r => r.ok)
        .catch(() => false);
    }
    let value: unknown = raw;
    try { value = JSON.parse(raw); } catch { /* store raw string */ }
    return fetch(url, {
      method: 'PUT', keepalive,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    }).then(r => r.ok).catch(() => false);
  } catch { return Promise.resolve(false); }
}

// --- Persisted outbox -------------------------------------------------------
// An entry means "this key has state the backend has not accepted yet".
// The stored value is the snapshot that failed; retries always send the
// CURRENT localStorage value (the local cache is the source of truth and
// is at least as new), so a retry can never resurrect older data.
type OutboxEntry = { key: string; value: string | null; attempts: number; queuedAt: number };

function readOutbox(): OutboxEntry[] {
  try {
    const raw = localStorage.getItem(SYNC_OUTBOX_KEY);
    if (!raw) return [];
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter(e => e && typeof e.key === 'string') : [];
  } catch { return []; }
}
function writeOutbox(entries: OutboxEntry[]) {
  try {
    if (entries.length === 0) localStorage.removeItem(SYNC_OUTBOX_KEY);
    else localStorage.setItem(SYNC_OUTBOX_KEY, JSON.stringify(entries));
  } catch { /* quota: session-level retry below still applies; next write re-queues */ }
}
function addOutboxEntry(key: string, raw: string | null) {
  const entries = readOutbox();
  const ex = entries.find(e => e.key === key);
  if (ex) { ex.value = raw; ex.attempts += 1; }
  else entries.push({ key, value: raw, attempts: 1, queuedAt: Date.now() });
  writeOutbox(entries);
}
function clearOutboxEntry(key: string) {
  const entries = readOutbox();
  const next = entries.filter(e => e.key !== key);
  if (next.length !== entries.length) writeOutbox(next);
}

let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelayMs = 1000;
function scheduleOutboxRetry() {
  if (retryTimer || typeof window === 'undefined') return;
  const delay = retryDelayMs;
  retryDelayMs = Math.min(retryDelayMs * 2, 30000);
  retryTimer = setTimeout(() => { retryTimer = null; void flushSyncOutbox(); }, delay);
}

/** Send every queued outbox entry now. Safe to call at any time. */
export async function flushSyncOutbox(): Promise<void> {
  if (!syncArmed) return;
  const entries = readOutbox();
  if (entries.length === 0) return;
  for (const entry of entries) {
    let raw: string | null;
    try { raw = localStorage.getItem(entry.key); } catch { raw = entry.value; }
    const ok = await sendCollection(entry.key, raw);
    if (ok) { clearOutboxEntry(entry.key); noteSyncSuccess(entry.key); }
    else { addOutboxEntry(entry.key, raw); noteSyncFailure(entry.key); }
  }
  if (readOutbox().length === 0) retryDelayMs = 1000;
  else scheduleOutboxRetry();
}

// Deliver the current local value of one key; on failure, persist it in
// the outbox and arm the retry timer instead of dropping it (Fix P1-5).
async function deliverKey(key: string) {
  let raw: string | null = null;
  try { raw = localStorage.getItem(key); } catch { return; }
  const ok = await sendCollection(key, raw);
  if (ok) { clearOutboxEntry(key); noteSyncSuccess(key); }
  else if (syncArmed) { addOutboxEntry(key, raw); noteSyncFailure(key); scheduleOutboxRetry(); }
  // Not armed = browser-only mode: the local cache is the only store and a
  // failed send is expected, so it stays silent (pre-fix behaviour).
}

function queueSync(key: string) {
  if (applyingRemote || !shouldSync(key) || typeof window === 'undefined') return;
  const old = pending.get(key); if (old) clearTimeout(old);
  pending.set(key, setTimeout(() => {
    pending.delete(key);
    void deliverKey(key);
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

// Fix P1-5: retry triggers for the outbox — when the network returns, when
// the user comes back to the window, and one final best-effort flush as
// the window closes (that last flush passes keepalive=true, which lets the
// fetch outlive the page but is capped at 64 KiB by the browser; anything
// larger stays in the persisted outbox and is delivered by the startup
// flush on next launch instead).
try {
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function'
      && window.location.protocol.startsWith('http')) {
    window.addEventListener('online', () => { void flushSyncOutbox(); });
    window.addEventListener('beforeunload', () => {
      for (const entry of readOutbox()) {
        try { void sendCollection(entry.key, localStorage.getItem(entry.key), true); } catch { /* page is going away */ }
      }
    });
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void flushSyncOutbox();
      });
    }
  }
} catch { /* non-browser environment */ }

// Hydrate the local cache from the backend on startup. On a first run the
// cache is empty and the server simply receives the app's subsequent saves;
// on later runs the server (SQLite) is the durable copy and refreshes the
// cache here. Either way, hydrationPromise resolves when this finishes so
// the app can start from the hydrated cache deterministically (Fix P1-1);
// with no backend (browser-only mode) it resolves immediately and
// localStorage remains the only store.
try {
  if (typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
    const finishHydration = (backendOk: boolean) => {
      syncArmed = backendOk;
      markHydrated();
      // A previous session may have left unsent writes behind.
      if (backendOk && readOutbox().length > 0) void flushSyncOutbox();
    };
    fetch('/api/collections')
      .then((r): Promise<{ data: any; ok: boolean }> => (r.ok
        ? r.json().then(data => ({ data, ok: true }))
        : Promise.resolve({ data: null, ok: false })))
      .then(({ data, ok }) => {
        if (data?.collections) {
          applyingRemote = true;
          try {
            for (const [k, v] of Object.entries(data.collections as Record<string, unknown>)) {
              if (!shouldSync(k)) continue;
              const raw = typeof v === 'string' ? v : JSON.stringify(v);
              if (localStorage.getItem(k) !== raw) localStorage.setItem(k, raw);
            }
          } finally { applyingRemote = false; }
          window.dispatchEvent(new CustomEvent('schoolex-hydrated'));
        }
        finishHydration(ok);
      })
      .catch(() => finishHydration(false)); // backend unreachable: local cache is the fallback
  } else {
    markHydrated();
  }
} catch { markHydrated(); }
