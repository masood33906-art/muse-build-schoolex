// Fixed port for the installed desktop app (owner directive 2026-11-08,
// Change 3). The Electron window loads http://127.0.0.1:<port>/, and the
// browser storage (localStorage / IndexedDB) is scoped to that origin —
// when the port changed on every launch, the origin changed with it and
// the app's local storage looked empty/unstable across restarts. Pinning
// the port keeps the origin (and therefore the storage) stable. The
// standalone `npm run server` flow does NOT use this: it keeps its
// existing SCHOOLEX_PORT / PORT env behaviour.
//
// Kept in its own module (no Electron imports) so the port-selection
// logic can be exercised headlessly by the persistence proof.
const DESKTOP_PORT = 47817;

// Start via startFn(preferredPort); if the fixed port is already taken
// (e.g. a stray process), fall back ONCE to an OS-assigned port (0) so
// the app still opens, and log it — that launch has an unstable origin,
// but it is a rare, visible degradation instead of a dead app.
async function startWithPortFallback(startFn, log = console) {
  try {
    return await startFn(DESKTOP_PORT);
  } catch (e) {
    if (e && e.code === 'EADDRINUSE') {
      log.warn(`[SchoolEx] Port ${DESKTOP_PORT} is already in use; falling back to an auto-assigned port for this launch only.`);
      return await startFn(0);
    }
    throw e;
  }
}

module.exports = { DESKTOP_PORT, startWithPortFallback };
