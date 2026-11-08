// SQLite access layer.
// Driver choice: better-sqlite3 is tried first — it installs cleanly on this
// Linux VM (verified), ships Windows prebuilds, and electron-builder can
// rebuild it for Electron on Windows. If it is unavailable (e.g. a platform
// with no matching prebuild), we fall back to Node's built-in node:sqlite
// (Node >= 22.5, no native build at all). Both expose prepare/run/get/all
// with near-identical APIs; the small differences are normalised here.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

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
    // Close ALWAYS checkpoints the WAL first (owner directive 2026-11-08:
    // data must persist exactly as left across close/reopen). Without this,
    // the newest writes can sit only in schoolex.db-wal and the main .db
    // file looks stale; after a TRUNCATE checkpoint the .db file itself
    // holds everything and the -wal file is empty/gone.
    close: () => { try { db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch {} db.close(); },
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
  // Server-internal bookkeeping (never user data): holds the data epoch
  // (see getDataEpoch below). Deliberately NOT one of the tables wiped by
  // POST /api/system/reset — reset ROTATES the epoch instead of deleting
  // the table, which is exactly how clients learn their cache is stale.
  `CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
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

// ---------------------------------------------------------------------------
// Read-only browsability views (owner-approved portability feature,
// 2026-11-08, Part B). The app's working data lives in the `collections`
// table as one JSON bundle per kind; these views explode those bundles
// into ordinary rows so the database can be inspected in ANY SQLite tool
// (one row per student, per class, per fee charge…) without SchoolEx
// running. They are pure SELECT objects: they store nothing, change
// nothing, and are re-asserted on every open (CREATE VIEW IF NOT EXISTS),
// so an EXISTING database gains them the next time the server starts —
// not only fresh databases. Names carry the _view suffix because the bare
// entity names are the (separately purposed) storage tables above.
// Verified against the bundled better-sqlite3 (SQLite 3.53.4): json_each
// works inside views, including chained json_each over the fee ledger's
// studentId -> items map. See proof-data-export.mts.
// ---------------------------------------------------------------------------
export const VIEWS = [
  `CREATE VIEW IF NOT EXISTS students_view AS
     SELECT json_extract(j.value, '$.id') AS id,
            json_extract(j.value, '$.name') AS name,
            json_extract(j.value, '$.gender') AS gender,
            json_extract(j.value, '$.dob') AS dob,
            json_extract(j.value, '$.class') AS class,
            json_extract(j.value, '$.section') AS section,
            json_extract(j.value, '$.rollNo') AS rollNo,
            json_extract(j.value, '$.status') AS status,
            json_extract(j.value, '$.admissionDate') AS admissionDate,
            json_extract(j.value, '$.phone') AS phone,
            json_extract(j.value, '$.familyId') AS familyId
     FROM collections AS c, json_each(c.value) AS j
     WHERE c.key = 'schoollee_offline_students_clean_v1'`,
  `CREATE VIEW IF NOT EXISTS classes_view AS
     SELECT json_extract(j.value, '$.id') AS id,
            json_extract(j.value, '$.name') AS name,
            json_extract(j.value, '$.fee') AS fee,
            json_extract(j.value, '$.sectionsCount') AS sectionsCount,
            json_extract(j.value, '$.sections') AS sections,
            json_extract(j.value, '$.createdAt') AS createdAt
     FROM collections AS c, json_each(c.value) AS j
     WHERE c.key = 'schoollee_classes_clean_v1'`,
  `CREATE VIEW IF NOT EXISTS staff_view AS
     SELECT json_extract(j.value, '$.id') AS id,
            json_extract(j.value, '$.name') AS name,
            json_extract(j.value, '$.role') AS role,
            json_extract(j.value, '$.category') AS category,
            json_extract(j.value, '$.department') AS department,
            json_extract(j.value, '$.status') AS status,
            json_extract(j.value, '$.phone') AS phone,
            json_extract(j.value, '$.email') AS email,
            json_extract(j.value, '$.salary') AS salary,
            json_extract(j.value, '$.joiningDate') AS joiningDate
     FROM collections AS c, json_each(c.value) AS j
     WHERE c.key = 'schoollee_offline_staff_clean_v1'`,
  `CREATE VIEW IF NOT EXISTS fee_ledger_view AS
     SELECT m.key AS studentId,
            json_extract(i.value, '$.id') AS itemId,
            json_extract(i.value, '$.month') AS month,
            json_extract(i.value, '$.monthKey') AS monthKey,
            json_extract(i.value, '$.type') AS type,
            json_extract(i.value, '$.reason') AS reason,
            json_extract(i.value, '$.total') AS charged,
            json_extract(i.value, '$.paidAmount') AS paidAmount,
            json_extract(i.value, '$.total') - json_extract(i.value, '$.paidAmount') AS balance,
            json_extract(i.value, '$.status') AS status
     FROM collections AS c, json_each(c.value) AS m, json_each(m.value) AS i
     WHERE c.key = 'schoollee_student_fee_ledger_clean_v1'`,
  `CREATE VIEW IF NOT EXISTS ledger_view AS
     SELECT json_extract(j.value, '$.id') AS id,
            json_extract(j.value, '$.date') AS date,
            json_extract(j.value, '$.rawDate') AS rawDate,
            json_extract(j.value, '$.type') AS type,
            json_extract(j.value, '$.category') AS category,
            json_extract(j.value, '$.amount') AS amount,
            json_extract(j.value, '$.paymentType') AS paymentType,
            json_extract(j.value, '$.reason') AS reason,
            json_extract(j.value, '$.note') AS note,
            json_extract(j.value, '$.createdBy') AS createdBy
     FROM collections AS c, json_each(c.value) AS j
     WHERE c.key = 'schoollee_ledger_transactions_clean_v1'`,
];

function migrate(db) {
  for (const sql of MIGRATIONS) db.exec(sql);
  for (const sql of VIEWS) db.exec(sql);
  db.prepare('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (?, ?)')
    .run(1, new Date().toISOString());
}

// ---------------------------------------------------------------------------
// Data epoch (owner directive 2026-11-08, Change 1): a random token that
// identifies the current GENERATION of this database's data. It is created
// the first time it is read, survives restarts unchanged, and is ROTATED
// by POST /api/system/reset (and implicitly differs on any brand-new
// database file). The client (src/utils/storage.ts) stores the epoch it
// last hydrated from; when the server's epoch does not match, the client's
// cached collections belong to a dead generation — e.g. a leftover demo
// dataset in browser storage — and are discarded instead of being synced
// back up into the (empty) server. This is what stops an old cache from
// resurrecting data into a fresh or reset database.
// ---------------------------------------------------------------------------
export function getDataEpoch(db) {
  const row = db.prepare("SELECT value FROM app_meta WHERE key = 'data_epoch'").get();
  if (row) return row.value;
  const epoch = crypto.randomUUID();
  db.prepare("INSERT OR IGNORE INTO app_meta(key, value) VALUES ('data_epoch', ?)").run(epoch);
  const again = db.prepare("SELECT value FROM app_meta WHERE key = 'data_epoch'").get();
  return again ? again.value : epoch;
}

export function rotateDataEpoch(db) {
  const epoch = crypto.randomUUID();
  db.prepare("INSERT INTO app_meta(key, value) VALUES ('data_epoch', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(epoch);
  return epoch;
}
