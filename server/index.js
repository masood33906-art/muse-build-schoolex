// SchoolEx local backend: Express + SQLite, 127.0.0.1 only, fully offline.
// Serves the built frontend (dist/) and the REST API under /api/.
import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { openDb, driverName, getDataEpoch, rotateDataEpoch } from './db.js';
import { registerPayrollRoutes } from './payroll.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(__dirname, '..');
const now = () => new Date().toISOString();
const parse = (s, fb = null) => { try { return JSON.parse(s); } catch { return fb; } };

// Entity config: table + how to extract relational columns from a record.
const ENTITIES = {
  students:   { table: 'students', cols: { name: r => r.name, family: r => r.family, family_id: r => r.familyId, class: r => r.class, section: r => r.section, status: r => r.status, phone: r => r.phone } },
  staff:      { table: 'staff', cols: { name: r => r.name, role: r => r.role, category: r => r.category, department: r => r.department, status: r => r.status, phone: r => r.phone, email: r => r.email, salary: r => num(r.salary) } },
  classes:    { table: 'classes', cols: { name: r => r.name, fee: r => num(r.fee), students_count: r => num(r.studentsCount) } },
  attendance: { table: 'attendance_records', cols: { entity_id: r => r.id, entity_type: r => r.type, date: r => r.date, status: r => r.status } },
  holidays:   { table: 'holidays', cols: { date: r => r.date, reason: r => r.reason } },
  payments:   { table: 'payments', cols: { student_id: r => r.studentId || r.student_id, amount: r => num(r.amount), method: r => r.method || r.paymentMethod, date: r => r.date || r.paidDate } },
  ledger:     { table: 'ledger_entries', cols: { type: r => r.type, amount: r => num(r.amount), date: r => r.date, description: r => r.description || r.title } },
  exams:      { table: 'exams', cols: { name: r => r.name || r.title, class: r => r.class, date: r => r.date || r.startDate } },
  'exam-marks': { table: 'exam_marks', cols: { exam_id: r => r.examId, student_id: r => r.studentId, subject: r => r.subject, marks: r => num(r.marks ?? r.obtainedMarks) } },
};
const num = (v) => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

// No built-in / sample data exists in this app — by design (owner
// directive, 2026-11-08). There is no seed file, no seeding at startup and
// no endpoint that inserts sample records: a database starts completely
// empty and only ever contains data the user entered (plus what
// Backup/Restore or the payroll migration legitimately writes from the
// user's own records). The only way all data leaves is POST
// /api/system/reset below.

function upsert(db, cfg, rec) {
  const id = String(rec.id ?? crypto.randomUUID());
  rec = { ...rec, id };
  const cols = Object.keys(cfg.cols);
  if (cfg.table === 'attendance_records') {
    const sql = `INSERT INTO attendance_records (id, ${cols.join(',')}, data, created_at, updated_at)
      VALUES (${['?', ...cols.map(() => '?'), '?', '?', '?'].join(',')})
      ON CONFLICT(id, date) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at, status=excluded.status`;
    db.prepare(sql).run(id, ...cols.map(c => cfg.cols[c](rec) ?? null), JSON.stringify(rec), now(), now());
    return rec;
  }
  const sql = `INSERT INTO ${cfg.table} (id, ${cols.join(',')}, data, created_at, updated_at)
    VALUES (${['?', ...cols.map(() => '?'), '?', '?', '?'].join(',')})
    ON CONFLICT(id) DO UPDATE SET ${cols.map(c => `${c}=excluded.${c}`).join(',')}, data=excluded.data, updated_at=excluded.updated_at`;
  db.prepare(sql).run(id, ...cols.map(c => cfg.cols[c](rec) ?? null), JSON.stringify(rec), now(), now());
  return rec;
}

export function createApp({ dbPath, distDir = path.join(APP_ROOT, 'dist') } = {}) {
  let db = openDb(dbPath);
  // Fresh installs start EMPTY — nothing is ever seeded here.
  const app = express();
  app.disable('x-powered-by');

  app.get('/api/health', (_req, res) => {
    const counts = {};
    for (const cfg of Object.values(ENTITIES)) {
      try { counts[cfg.table] = db.prepare(`SELECT COUNT(*) AS c FROM ${cfg.table}`).get().c; } catch {}
    }
    res.json({ ok: true, app: 'SchoolEx', driver: driverName, dbPath, counts, epoch: getDataEpoch(db), time: now() });
  });

  // Generic CRUD for core entities
  for (const [name, cfg] of Object.entries(ENTITIES)) {
    const base = `/api/${name}`;
    app.get(base, (_req, res) => {
      const rows = db.prepare(`SELECT data FROM ${cfg.table} ORDER BY rowid`).all();
      res.json(rows.map(r => parse(r.data, {})));
    });
    app.get(`${base}/:id`, (req, res) => {
      const row = db.prepare(`SELECT data FROM ${cfg.table} WHERE id = ?`).get(req.params.id);
      if (!row) return res.status(404).json({ error: 'not found' });
      res.json(parse(row.data, {}));
    });
    app.post(base, express.json({ limit: '25mb' }), (req, res) => {
      if (!req.body || typeof req.body !== 'object') return res.status(400).json({ error: 'JSON body required' });
      res.status(201).json(upsert(db, cfg, req.body));
    });
    app.put(`${base}/:id`, express.json({ limit: '25mb' }), (req, res) => {
      res.json(upsert(db, cfg, { ...req.body, id: req.params.id }));
    });
    app.delete(`${base}/:id`, (req, res) => {
      if (cfg.table === 'attendance_records' && req.query.date) {
        db.prepare('DELETE FROM attendance_records WHERE id = ? AND date = ?').run(req.params.id, req.query.date);
      } else {
        db.prepare(`DELETE FROM ${cfg.table} WHERE id = ?`).run(req.params.id);
      }
      res.json({ ok: true });
    });
  }

  // Settings
  app.get('/api/settings', (_req, res) => {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    res.json(Object.fromEntries(rows.map(r => [r.key, parse(r.value, r.value)])));
  });
  app.get('/api/settings/:key', (req, res) => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(req.params.key);
    if (!row) return res.status(404).json({ error: 'not found' });
    res.json({ key: req.params.key, value: parse(row.value, row.value) });
  });
  app.put('/api/settings/:key', express.json({ limit: '25mb' }), (req, res) => {
    const value = req.body && 'value' in req.body ? req.body.value : req.body;
    db.prepare('INSERT INTO settings(key, value, updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at')
      .run(req.params.key, JSON.stringify(value), now());
    res.json({ key: req.params.key, value });
  });

  // Collections: mirror of legacy localStorage keys (value stored as raw JSON text)
  app.get('/api/collections', (_req, res) => {
    const rows = db.prepare('SELECT key, value, updated_at FROM collections').all();
    // `epoch` rides along so the client's hydration (src/utils/storage.ts)
    // can validate its cache against this database's data generation
    // before applying or uploading anything.
    res.json({ keys: rows.map(r => r.key), collections: Object.fromEntries(rows.map(r => [r.key, parse(r.value, r.value)])), epoch: getDataEpoch(db) });
  });
  app.get('/api/collections/:key', (req, res) => {
    const row = db.prepare('SELECT value, updated_at FROM collections WHERE key = ?').get(req.params.key);
    if (!row) return res.status(404).json({ error: 'not found' });
    res.json({ key: req.params.key, value: parse(row.value, row.value), updated_at: row.updated_at });
  });
  app.put('/api/collections/:key', express.json({ limit: '50mb' }), (req, res) => {
    const raw = req.body && 'value' in req.body
      ? (typeof req.body.value === 'string' ? req.body.value : JSON.stringify(req.body.value))
      : JSON.stringify(req.body);
    db.prepare('INSERT INTO collections(key, value, updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at')
      .run(req.params.key, raw, now());
    res.json({ ok: true, key: req.params.key });
  });
  app.delete('/api/collections/:key', (req, res) => {
    db.prepare('DELETE FROM collections WHERE key = ?').run(req.params.key);
    res.json({ ok: true });
  });

  // Backup: download the SQLite file (checkpoint first so WAL data is included)
  app.get('/api/backup', (_req, res) => {
    db.checkpoint();
    res.download(dbPath, 'schoolex.db');
  });

  // Restore: POST the raw .db file bytes (Content-Type: application/octet-stream)
  app.post('/api/restore', express.raw({ type: 'application/octet-stream', limit: '500mb' }), (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length < 16 || req.body.subarray(0, 15).toString() !== 'SQLite format 3') {
      return res.status(400).json({ error: 'Not a SQLite database file' });
    }
    const backupPath = dbPath + '.pre-restore.bak';
    try {
      db.checkpoint(); db.close();
      fs.copyFileSync(dbPath, backupPath);
      fs.writeFileSync(dbPath, req.body);
      for (const suffix of ['-wal', '-shm']) { try { fs.unlinkSync(dbPath + suffix); } catch {} }
      db = openDb(dbPath);
      res.json({ ok: true, restoredBytes: req.body.length, safetyBackup: backupPath });
    } catch (e) {
      try { db = openDb(dbPath); } catch {}
      res.status(500).json({ error: String(e.message || e) });
    }
  });

  // Pay Staff payroll API (PAYROLL_PLAN §3.3). Handlers resolve the db via
  // the closure so /api/restore swapping the handle keeps payroll working.
  registerPayrollRoutes(app, () => db);

  // System: full reset only. There is deliberately NO endpoint that
  // inserts sample/built-in data — a fresh install starts empty and stays
  // that way until the user adds their own records. The handler references
  // the closure `db`, so /api/restore's handle swap is picked up
  // automatically.
  const SYSTEM_DATA_TABLES = [
    'payroll_payments', 'payroll_records', 'payroll_periods', // FK order: children first
    'attendance_records', 'exam_marks', 'exams', 'payments', 'ledger_entries',
    'holidays', 'students', 'staff', 'classes', 'collections', 'settings',
  ];

  app.post('/api/system/reset', (_req, res) => {
    const wiped = {};
    db.tx(() => {
      for (const table of SYSTEM_DATA_TABLES) {
        wiped[table] = db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c;
        db.prepare(`DELETE FROM ${table}`).run();
      }
    });
    // Rotating the epoch is part of the reset: any client still holding
    // pre-reset cached collections now fails its next hydration check and
    // discards them, so wiped data cannot come back from a stale cache.
    const epoch = rotateDataEpoch(db);
    res.json({ ok: true, wiped, epoch });
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'unknown API route' }));

  // Built frontend + SPA fallback
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }
  return { app, getDb: () => db, dbPath };
}

export function startServer(opts = {}) {
  const port = opts.port ?? (process.env.SCHOOLEX_PORT || process.env.PORT ? Number(process.env.SCHOOLEX_PORT || process.env.PORT) : 0);
  const dbPath = opts.dbPath || process.env.SCHOOLEX_DB || path.join(APP_ROOT, 'data', 'schoolex.db');
  const { app, getDb } = createApp({ dbPath, distDir: opts.distDir });
  return new Promise((resolve, reject) => {
    const server = app.listen(port, '127.0.0.1', () => {
      server.removeListener('error', onListenError);
      const actual = server.address().port;
      console.log(`SchoolEx server http://127.0.0.1:${actual} db=${dbPath} driver=${driverName}`);
      resolve({ server, port: actual, dbPath, getDb, close: () => new Promise(r => server.close(() => { try { getDb().close(); } catch {} r(); })) });
    });
    // Reject on listen failure (e.g. EADDRINUSE for a preferred fixed port)
    // so callers can fall back to another port instead of hanging forever.
    // Removed again once listening succeeds.
    const onListenError = (err) => { try { getDb().close(); } catch {} reject(err); };
    server.once('error', onListenError);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer();
}
