// SQLite access layer.
// Driver choice: better-sqlite3 is tried first — it installs cleanly on this
// Linux VM (verified), ships Windows prebuilds, and electron-builder can
// rebuild it for Electron on Windows. If it is unavailable (e.g. a platform
// with no matching prebuild), we fall back to Node's built-in node:sqlite
// (Node >= 22.5, no native build at all). Both expose prepare/run/get/all
// with near-identical APIs; the small differences are normalised here.
import fs from 'fs';
import path from 'path';

export let driverName = 'none';

export function openDb(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  let db;
  try {
    // eslint-disable-next-line no-undef
    const Better = requireBetterSqlite3();
    db = new Better(dbPath);
    driverName = 'better-sqlite3';
  } catch (e1) {
    try {
      const { DatabaseSync } = globalThis.__nodeSqlite || (globalThis.__nodeSqlite = requireNodeSqlite());
      db = new DatabaseSync(dbPath);
      driverName = 'node:sqlite';
    } catch (e2) {
      throw new Error(`No SQLite driver available (better-sqlite3: ${e1.message}; node:sqlite: ${e2.message})`);
    }
  }
  const wrap = {
    raw: db,
    exec: (sql) => db.exec(sql),
    prepare: (sql) => db.prepare(sql),
    close: () => db.close(),
    checkpoint: () => { try { db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch {} },
    // Run fn inside a single SQLite transaction: every write inside fn
    // commits together or rolls back together. better-sqlite3 has a native
    // transaction() helper; node:sqlite gets the manual BEGIN/COMMIT form.
    tx: (fn) => {
      if (driverName === 'better-sqlite3') return db.transaction(fn)();
      db.exec('BEGIN IMMEDIATE');
      try {
        const out = fn();
        db.exec('COMMIT');
        return out;
      } catch (e) {
        try { db.exec('ROLLBACK'); } catch {}
        throw e;
      }
    },
  };
  wrap.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
  migrate(wrap);
  return wrap;
}

// createRequire shims so this ESM module can load CJS native modules.
import { createRequire } from 'module';
const require_ = createRequire(import.meta.url);
function requireBetterSqlite3() { return require_('better-sqlite3'); }
function requireNodeSqlite() { return require_('node:sqlite'); }

export const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS students (
     id TEXT PRIMARY KEY, name TEXT, family TEXT, family_id TEXT, class TEXT, section TEXT,
     status TEXT, phone TEXT, data TEXT NOT NULL, created_at TEXT, updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS staff (
     id TEXT PRIMARY KEY, name TEXT, role TEXT, category TEXT, department TEXT, status TEXT,
     phone TEXT, email TEXT, salary REAL, data TEXT NOT NULL, created_at TEXT, updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS classes (
     id TEXT PRIMARY KEY, name TEXT, fee REAL, students_count INTEGER, data TEXT NOT NULL,
     created_at TEXT, updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS attendance_records (
     id TEXT NOT NULL, entity_id TEXT, entity_type TEXT, date TEXT, status TEXT,
     data TEXT NOT NULL, created_at TEXT, updated_at TEXT, PRIMARY KEY (id, date))`,
  `CREATE TABLE IF NOT EXISTS holidays (
     id TEXT PRIMARY KEY, date TEXT, reason TEXT, data TEXT NOT NULL, created_at TEXT, updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS payments (
     id TEXT PRIMARY KEY, student_id TEXT, amount REAL, method TEXT, date TEXT,
     data TEXT NOT NULL, created_at TEXT, updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS ledger_entries (
     id TEXT PRIMARY KEY, type TEXT, amount REAL, date TEXT, description TEXT,
     data TEXT NOT NULL, created_at TEXT, updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS exams (
     id TEXT PRIMARY KEY, name TEXT, class TEXT, date TEXT, data TEXT NOT NULL,
     created_at TEXT, updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS exam_marks (
     id TEXT PRIMARY KEY, exam_id TEXT, student_id TEXT, subject TEXT, marks REAL,
     data TEXT NOT NULL, created_at TEXT, updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS collections (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(date)`,
  `CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id)`,
  `CREATE INDEX IF NOT EXISTS idx_marks_exam ON exam_marks(exam_id)`,
  // Pay Staff rebuild (PAYROLL_PLAN §3.1): real payroll tables. Money is
  // INTEGER rupees. Derived figures (due/paid/outstanding/status) are
  // computed from payroll_payments on every read, never stored.
  `CREATE TABLE IF NOT EXISTS payroll_periods (
     period_key TEXT PRIMARY KEY,
     year INTEGER NOT NULL, month INTEGER NOT NULL,
     label TEXT NOT NULL,
     created_at TEXT NOT NULL, created_by TEXT,
     UNIQUE(year, month))`,
  `CREATE TABLE IF NOT EXISTS payroll_records (
     id TEXT PRIMARY KEY,
     period_key TEXT NOT NULL REFERENCES payroll_periods(period_key),
     staff_id TEXT NOT NULL,
     staff_name TEXT NOT NULL,
     base_salary INTEGER NOT NULL,
     origin TEXT NOT NULL DEFAULT 'generated',
     created_at TEXT NOT NULL,
     UNIQUE(period_key, staff_id))`,
  `CREATE TABLE IF NOT EXISTS payroll_payments (
     id TEXT PRIMARY KEY,
     record_id TEXT NOT NULL REFERENCES payroll_records(id),
     staff_id TEXT NOT NULL, period_key TEXT NOT NULL,
     amount INTEGER NOT NULL,
     allowances INTEGER NOT NULL DEFAULT 0,
     bonus INTEGER NOT NULL DEFAULT 0,
     deductions INTEGER NOT NULL DEFAULT 0,
     method TEXT NOT NULL, paid_date TEXT NOT NULL,
     remarks TEXT, created_by TEXT,
     ledger_id TEXT,
     source TEXT NOT NULL DEFAULT 'ui',
     created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_payroll_payments_record ON payroll_payments(record_id)`,
  `CREATE INDEX IF NOT EXISTS idx_payroll_payments_staff ON payroll_payments(staff_id)`,
  `CREATE INDEX IF NOT EXISTS idx_payroll_records_staff ON payroll_records(staff_id)`,
];

function migrate(db) {
  for (const sql of MIGRATIONS) db.exec(sql);
  db.prepare('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (?, ?)')
    .run(1, new Date().toISOString());
}
