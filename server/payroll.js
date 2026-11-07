// SchoolEx payroll API — Pay Staff rebuild (PAYROLL_PLAN §3).
//
// Payroll state lives in real SQLite tables (payroll_periods /
// payroll_records / payroll_payments). Payments are written by these
// endpoints inside ONE SQLite transaction that also appends the ledger
// entry to the ledger *collection blob* (the store the Ledger UI reads)
// and refreshes the staff member's legacy fields in the staff collection
// blob — all four writes commit or roll back together (§3.2).
//
// Derived figures are computed from payroll_payments on every read:
//   adjustments = Σ(allowances + bonus − deductions)
//   due         = base_salary (snapshot) + adjustments
//   paid        = Σ(amount)
//   outstanding = due − paid
//   status      = paid = 0 → Unpaid · paid < due → Partial · paid ≥ due → Paid
import express from 'express';

export const STAFF_COLLECTION_KEY = 'schoollee_offline_staff_clean_v1';
export const LEDGER_COLLECTION_KEY = 'schoollee_ledger_transactions_clean_v1';
const MIGRATION_SETTING_KEY = 'payroll_migration_v1';
const PAYMENT_SEQ_KEY = 'payroll_payment_seq';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Online', 'JazzCash', 'EasyPaisa', 'Cheque'];

const nowISO = () => new Date().toISOString();
const todayLocalISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const bad = (msg) => new ApiError(400, msg);

export const periodKeyOf = (year, month) => `${year}-${String(month).padStart(2, '0')}`;
export const periodLabelOf = (year, month) => `${MONTH_NAMES[month - 1]} ${year}`;

/** 'September 2026' → { year: 2026, month: 9 } | null */
export function parsePeriodLabel(label) {
  const m = /^([A-Za-z]+)\s+(\d{4})$/.exec(String(label || '').trim());
  if (!m) return null;
  const month = MONTH_NAMES.findIndex(n => n.toLowerCase() === m[1].toLowerCase()) + 1;
  if (month < 1) return null;
  return { year: Number(m[2]), month };
}

const periodEndISO = (year, month) => {
  const d = new Date(year, month, 0); // last day of `month`
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Joining dates arrive as ISO ('2022-04-10') or display text ('23 Apr 2026'). */
function parseFlexibleDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t);
}

// ---------------------------------------------------------------------------
// Collection / settings access (the live frontend data stores)
// ---------------------------------------------------------------------------

function getCollection(db, key) {
  const row = db.prepare('SELECT value FROM collections WHERE key = ?').get(key);
  if (!row) return [];
  try {
    const v = JSON.parse(row.value);
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

function setCollection(db, key, value) {
  db.prepare('INSERT INTO collections(key, value, updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at')
    .run(key, JSON.stringify(value), nowISO());
}

function getSetting(db, key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (!row) return null;
  try { return JSON.parse(row.value); } catch { return row.value; }
}

function setSetting(db, key, value) {
  db.prepare('INSERT INTO settings(key, value, updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at')
    .run(key, JSON.stringify(value), nowISO());
}

// ---------------------------------------------------------------------------
// Derived figures
// ---------------------------------------------------------------------------

function paymentAgg(db, recordId) {
  return db.prepare(
    'SELECT COALESCE(SUM(amount),0) AS paid, COALESCE(SUM(allowances + bonus - deductions),0) AS adj, COUNT(*) AS n FROM payroll_payments WHERE record_id = ?'
  ).get(recordId);
}

function enrichRecord(db, rec) {
  const agg = paymentAgg(db, rec.id);
  const due = rec.base_salary + agg.adj;
  const paid = agg.paid;
  const outstanding = Math.max(0, due - paid);
  const status = paid <= 0 ? 'Unpaid' : paid >= due ? 'Paid' : 'Partial';
  return {
    id: rec.id,
    periodKey: rec.period_key,
    staffId: rec.staff_id,
    staffName: rec.staff_name,
    baseSalary: rec.base_salary,
    origin: rec.origin,
    createdAt: rec.created_at,
    adjustments: agg.adj,
    due,
    paid,
    outstanding,
    status,
    paymentCount: agg.n,
  };
}

function enrichRecords(db, recs) {
  if (recs.length === 0) return [];
  const ids = recs.map(r => r.id);
  const rows = db.prepare(
    `SELECT record_id, COALESCE(SUM(amount),0) AS paid, COALESCE(SUM(allowances + bonus - deductions),0) AS adj, COUNT(*) AS n
     FROM payroll_payments WHERE record_id IN (${ids.map(() => '?').join(',')}) GROUP BY record_id`
  ).all(...ids);
  const byId = new Map(rows.map(r => [r.record_id, r]));
  return recs.map(rec => {
    const agg = byId.get(rec.id) || { paid: 0, adj: 0, n: 0 };
    const due = rec.base_salary + agg.adj;
    const paid = agg.paid;
    return {
      id: rec.id,
      periodKey: rec.period_key,
      staffId: rec.staff_id,
      staffName: rec.staff_name,
      baseSalary: rec.base_salary,
      origin: rec.origin,
      createdAt: rec.created_at,
      adjustments: agg.adj,
      due,
      paid,
      outstanding: Math.max(0, due - paid),
      status: paid <= 0 ? 'Unpaid' : paid >= due ? 'Paid' : 'Partial',
      paymentCount: agg.n,
    };
  });
}

function previousOutstanding(db, staffId, beforePeriodKey) {
  const recs = db.prepare('SELECT * FROM payroll_records WHERE staff_id = ? AND period_key < ?').all(staffId, beforePeriodKey);
  return enrichRecords(db, recs).reduce((sum, r) => sum + r.outstanding, 0);
}

function periodSummary(db, period) {
  const recs = db.prepare('SELECT * FROM payroll_records WHERE period_key = ? ORDER BY staff_name').all(period.period_key);
  const enriched = enrichRecords(db, recs);
  return {
    periodKey: period.period_key,
    year: period.year,
    month: period.month,
    label: period.label,
    createdAt: period.created_at,
    createdBy: period.created_by,
    staffCount: enriched.length,
    totalDue: enriched.reduce((s, r) => s + r.due, 0),
    totalPaid: enriched.reduce((s, r) => s + r.paid, 0),
    totalOutstanding: enriched.reduce((s, r) => s + r.outstanding, 0),
    paidCount: enriched.filter(r => r.status === 'Paid').length,
    unpaidCount: enriched.filter(r => r.status === 'Unpaid').length,
    partialCount: enriched.filter(r => r.status === 'Partial').length,
  };
}

// ---------------------------------------------------------------------------
// Payment writing (always inside the caller's transaction)
// ---------------------------------------------------------------------------

function nextPaymentId(db) {
  const cur = Number(getSetting(db, PAYMENT_SEQ_KEY) || 0);
  const next = cur + 1;
  setSetting(db, PAYMENT_SEQ_KEY, next);
  return `SAL-${String(next).padStart(6, '0')}`;
}

const money = (v, field) => {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n) || n < 0) throw bad(`${field} must be a non-negative amount`);
  return Math.round(n);
};

function validateMethod(method) {
  if (!PAYMENT_METHODS.includes(method)) throw bad(`Unknown payment method: ${method}`);
  return method;
}

function validatePaidDate(v) {
  const s = v || todayLocalISO();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw bad('paidDate must be YYYY-MM-DD');
  return s;
}

function getRecordOr404(db, recordId) {
  const rec = db.prepare('SELECT * FROM payroll_records WHERE id = ?').get(recordId);
  if (!rec) throw new ApiError(404, `Payroll record not found: ${recordId}`);
  return rec;
}

/**
 * Insert one payment row for `rec`, rejecting any payment that would push
 * paid above due (due includes this payment's own adjustments).
 * Returns the inserted payment (without ledger_id; stamped by the caller).
 */
function insertPayment(db, rec, p) {
  const agg = paymentAgg(db, rec.id);
  const netAdj = p.allowances + p.bonus - p.deductions;
  const newDue = rec.base_salary + agg.adj + netAdj;
  const newPaid = agg.paid + p.amount;
  if (newPaid > newDue) {
    throw bad(`Payment of ${p.amount} exceeds the amount due (${Math.max(0, newDue - agg.paid)}) for ${rec.staff_name} — ${periodLabelOf(Number(rec.period_key.slice(0, 4)), Number(rec.period_key.slice(5, 7)))}`);
  }
  const id = nextPaymentId(db);
  const row = {
    id,
    record_id: rec.id,
    staff_id: rec.staff_id,
    period_key: rec.period_key,
    amount: p.amount,
    allowances: p.allowances,
    bonus: p.bonus,
    deductions: p.deductions,
    method: p.method,
    paid_date: p.paidDate,
    remarks: p.remarks || null,
    created_by: p.createdBy || null,
    ledger_id: null,
    source: p.source || 'ui',
    created_at: nowISO(),
  };
  db.prepare(`INSERT INTO payroll_payments
    (id, record_id, staff_id, period_key, amount, allowances, bonus, deductions, method, paid_date, remarks, created_by, ledger_id, source, created_at)
    VALUES (@id, @record_id, @staff_id, @period_key, @amount, @allowances, @bonus, @deductions, @method, @paid_date, @remarks, @created_by, @ledger_id, @source, @created_at)`).run(row);
  return row;
}

function ledgerEntryFor(payment, staffName) {
  const d = new Date(`${payment.paid_date}T12:00:00`);
  const label = periodLabelOf(Number(payment.period_key.slice(0, 4)), Number(payment.period_key.slice(5, 7)));
  return {
    id: `TX-OUT-${Date.now().toString().slice(-6)}-${payment.id}`,
    date: `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`,
    rawDate: payment.paid_date,
    time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    timestamp: d.getTime() || Date.now(),
    amount: payment.amount,
    createdBy: payment.created_by || 'Accounts Office',
    paymentType: payment.method,
    type: 'Outgoing',
    category: 'Staff Salary',
    reason: `Staff Salary: ${staffName} (${payment.staff_id}) — ${label}`,
    note: payment.remarks || '',
  };
}

/**
 * §3.2 step 4: keep the staff member's legacy fields truthful for the old
 * readers (directory badges, CSV/PDF exports). payStatus is re-derived
 * across ALL of the staff member's payroll records; paidMonths is NOT
 * appended — the payroll tables are the source of truth from migration on.
 */
function refreshStaffLegacy(db, staffArr, staffId, method, paidDate) {
  const idx = staffArr.findIndex(s => s.id === staffId);
  if (idx < 0) return;
  const recs = db.prepare('SELECT * FROM payroll_records WHERE staff_id = ?').all(staffId);
  let payStatus = staffArr[idx].payStatus;
  if (recs.length > 0) {
    const anyOutstanding = enrichRecords(db, recs).some(r => r.outstanding > 0);
    payStatus = anyOutstanding ? 'Pending' : 'Paid';
  }
  staffArr[idx] = { ...staffArr[idx], payStatus, lastPaidDate: paidDate, paymentMethod: method };
}

/**
 * Shared transactional core for POST /payments and /payments/bulk.
 * `jobs` = [{ rec, amount, allowances, bonus, deductions, remarks }] — all
 * rows are inserted, then ledger entries + staff legacy fields are written
 * for every affected staff member, all inside the caller's tx().
 */
function applyPayments(db, jobs, common) {
  const inserted = jobs.map(job => insertPayment(db, job.rec, job));

  // Ledger entries — one per payment row, prepended (collection is newest-first).
  const ledgerArr = getCollection(db, LEDGER_COLLECTION_KEY);
  const nameByRecord = new Map(jobs.map(j => [j.rec.id, j.rec.staff_name]));
  const entries = inserted.map(p => {
    const entry = ledgerEntryFor(p, nameByRecord.get(p.record_id));
    db.prepare('UPDATE payroll_payments SET ledger_id = ? WHERE id = ?').run(entry.id, p.id);
    p.ledger_id = entry.id;
    return entry;
  });
  const nextLedger = [...entries.reverse(), ...ledgerArr];
  setCollection(db, LEDGER_COLLECTION_KEY, nextLedger);

  // Staff legacy maintenance — once per affected staff member.
  const staffArr = getCollection(db, STAFF_COLLECTION_KEY);
  const staffIds = [...new Set(inserted.map(p => p.staff_id))];
  for (const sid of staffIds) refreshStaffLegacy(db, staffArr, sid, common.method, common.paidDate);
  setCollection(db, STAFF_COLLECTION_KEY, staffArr);

  const affectedRecords = [...new Map(jobs.map(j => [j.rec.id, j.rec])).values()]
    .map(rec => enrichRecord(db, rec));
  return { payments: inserted.map(paymentOut), records: affectedRecords, ledger: nextLedger, staff: staffArr };
}

function paymentOut(p) {
  return {
    id: p.id,
    recordId: p.record_id,
    staffId: p.staff_id,
    periodKey: p.period_key,
    amount: p.amount,
    allowances: p.allowances,
    bonus: p.bonus,
    deductions: p.deductions,
    method: p.method,
    paidDate: p.paid_date,
    remarks: p.remarks || '',
    createdBy: p.created_by || '',
    ledgerId: p.ledger_id,
    source: p.source,
    createdAt: p.created_at,
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export function registerPayrollRoutes(app, getDb) {
  const route = (fn) => (req, res) => {
    try {
      fn(getDb(), req, res);
    } catch (e) {
      res.status(e.status || 500).json({ error: String(e.message || e) });
    }
  };
  const json = express.json({ limit: '25mb' });

  // Periods -----------------------------------------------------------------
  app.get('/api/payroll/periods', route((db, _req, res) => {
    const periods = db.prepare('SELECT * FROM payroll_periods ORDER BY period_key').all();
    res.json({ periods: periods.map(p => periodSummary(db, p)) });
  }));

  app.post('/api/payroll/periods', json, route((db, req, res) => {
    const year = Number(req.body?.year);
    const month = Number(req.body?.month);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) throw bad('year must be a 4-digit year');
    if (!Number.isInteger(month) || month < 1 || month > 12) throw bad('month must be 1..12');
    const createdBy = req.body?.createdBy || null;
    const out = db.tx(() => {
      const key = periodKeyOf(year, month);
      db.prepare('INSERT OR IGNORE INTO payroll_periods(period_key, year, month, label, created_at, created_by) VALUES (?,?,?,?,?,?)')
        .run(key, year, month, periodLabelOf(year, month), nowISO(), createdBy);
      // §3.4 eligibility: Active / On Leave, joined on or before the period's
      // last day (the old joining-month exclusion + 30-day accrual are dropped).
      const end = parseFlexibleDate(periodEndISO(year, month));
      const staffArr = getCollection(db, STAFF_COLLECTION_KEY);
      let created = 0;
      for (const s of staffArr) {
        if (!['Active', 'On Leave'].includes(s.status)) continue;
        const joined = parseFlexibleDate(s.joiningDate);
        if (joined && end && joined > end) continue; // unparseable dates stay eligible; the accountant can delete the record
        const info = db.prepare(`INSERT OR IGNORE INTO payroll_records
          (id, period_key, staff_id, staff_name, base_salary, origin, created_at) VALUES (?,?,?,?,?,'generated',?)`)
          .run(`PREC-${key}-${s.id}`, key, s.id, s.name || s.id, Math.round(Number(s.salary) || 0), nowISO());
        created += info.changes;
      }
      const period = db.prepare('SELECT * FROM payroll_periods WHERE period_key = ?').get(key);
      return { period: periodSummary(db, period), created };
    });
    res.status(201).json(out);
  }));

  app.get('/api/payroll/periods/:key/records', route((db, req, res) => {
    const period = db.prepare('SELECT * FROM payroll_periods WHERE period_key = ?').get(req.params.key);
    if (!period) throw new ApiError(404, `Payroll period not found: ${req.params.key}`);
    const recs = db.prepare('SELECT * FROM payroll_records WHERE period_key = ? ORDER BY staff_name').all(period.period_key);
    const records = enrichRecords(db, recs).map(r => ({
      ...r,
      previousOutstanding: previousOutstanding(db, r.staffId, r.periodKey),
    }));
    res.json({ period: periodSummary(db, period), records });
  }));

  // One employee -------------------------------------------------------------
  app.get('/api/payroll/staff/:staffId', route((db, req, res) => {
    const staffId = req.params.staffId;
    const recs = db.prepare('SELECT * FROM payroll_records WHERE staff_id = ? ORDER BY period_key').all(staffId);
    const payments = db.prepare('SELECT * FROM payroll_payments WHERE staff_id = ? ORDER BY paid_date, created_at').all(staffId);
    const byRecord = new Map();
    for (const p of payments) {
      if (!byRecord.has(p.record_id)) byRecord.set(p.record_id, []);
      byRecord.get(p.record_id).push(paymentOut(p));
    }
    const records = enrichRecords(db, recs).map(r => ({
      ...r,
      previousOutstanding: previousOutstanding(db, staffId, r.periodKey),
      payments: byRecord.get(r.id) || [],
    }));
    res.json({ staffId, records, payments: payments.map(paymentOut) });
  }));

  // Payments -----------------------------------------------------------------
  app.post('/api/payroll/payments', json, route((db, req, res) => {
    const body = req.body || {};
    const result = db.tx(() => {
      const rec = getRecordOr404(db, body.recordId);
      const method = validateMethod(body.method || 'Bank Transfer');
      const paidDate = validatePaidDate(body.paidDate);
      const common = { method, paidDate, createdBy: body.createdBy || null, source: 'ui' };
      const allowances = money(body.allowances, 'allowances');
      const bonus = money(body.bonus, 'bonus');
      const deductions = money(body.deductions, 'deductions');
      const amount = money(body.amount, 'amount');
      const arrearsAmount = money(body.arrearsAmount, 'arrearsAmount');

      const jobs = [];
      if (amount > 0 || allowances + bonus - deductions !== 0) {
        jobs.push({ rec, amount, allowances, bonus, deductions, remarks: body.remarks || null, ...common });
      }
      if (arrearsAmount > 0) {
        // §3.4: settle older obligations FIFO — never create new ones.
        let remaining = arrearsAmount;
        const older = db.prepare('SELECT * FROM payroll_records WHERE staff_id = ? AND period_key < ? ORDER BY period_key ASC')
          .all(rec.staff_id, rec.period_key);
        for (const old of older) {
          if (remaining <= 0) break;
          const e = enrichRecord(db, old);
          if (e.outstanding <= 0) continue;
          const alloc = Math.min(remaining, e.outstanding);
          jobs.push({
            rec: old, amount: alloc, allowances: 0, bonus: 0, deductions: 0,
            remarks: body.remarks ? `${body.remarks} (arrears)` : 'Arrears payment', ...common,
          });
          remaining -= alloc;
        }
        if (remaining > 0) throw bad(`Arrears amount exceeds the previous outstanding balance by ${remaining}`);
      }
      if (jobs.length === 0) throw bad('Nothing to pay: amount is 0 and there are no adjustments or arrears');
      return applyPayments(db, jobs, common);
    });
    res.status(201).json(result);
  }));

  app.post('/api/payroll/payments/bulk', json, route((db, req, res) => {
    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) throw bad('items must be a non-empty array');
    const result = db.tx(() => {
      const method = validateMethod(body.method || 'Bank Transfer');
      const paidDate = validatePaidDate(body.paidDate);
      const common = { method, paidDate, createdBy: body.createdBy || null, source: 'bulk' };
      const jobs = items.map(item => {
        const rec = getRecordOr404(db, item?.recordId);
        const allowances = money(item.allowances, 'allowances');
        const bonus = money(item.bonus, 'bonus');
        const deductions = money(item.deductions, 'deductions');
        let amount;
        if (item.amount === undefined || item.amount === null) {
          // Default: settle the record in full (outstanding + own adjustments).
          const e = enrichRecord(db, rec);
          amount = e.outstanding + (allowances + bonus - deductions);
          if (amount <= 0) throw bad(`Nothing outstanding for ${rec.staff_name}`);
        } else {
          amount = money(item.amount, 'amount');
          if (amount <= 0) throw bad('amount must be greater than 0');
        }
        return { rec, amount, allowances, bonus, deductions, remarks: item.remarks || null, ...common };
      });
      return applyPayments(db, jobs, common);
    });
    res.status(201).json(result);
  }));

  app.delete('/api/payroll/records/:id', route((db, req, res) => {
    const rec = getRecordOr404(db, req.params.id);
    const n = db.prepare('SELECT COUNT(*) AS c FROM payroll_payments WHERE record_id = ?').get(rec.id).c;
    if (n > 0) throw new ApiError(409, 'Record has payments and cannot be deleted');
    db.prepare('DELETE FROM payroll_records WHERE id = ?').run(rec.id);
    res.json({ ok: true });
  }));

  // Payment History feed -------------------------------------------------------
  app.get('/api/payroll/payments', route((db, req, res) => {
    const where = [];
    const args = [];
    if (req.query.staffId) { where.push('p.staff_id = ?'); args.push(req.query.staffId); }
    if (req.query.periodKey) { where.push('p.period_key = ?'); args.push(req.query.periodKey); }
    const rows = db.prepare(`SELECT p.*, r.staff_name AS rec_staff_name, per.label AS period_label
      FROM payroll_payments p
      JOIN payroll_records r ON r.id = p.record_id
      JOIN payroll_periods per ON per.period_key = p.period_key
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY p.paid_date DESC, p.created_at DESC`).all(...args);
    res.json({
      payments: rows.map(r => ({ ...paymentOut(r), staffName: r.rec_staff_name, periodLabel: r.period_label })),
    });
  }));

  // JSON backup support (§4) ---------------------------------------------------
  app.get('/api/payroll/export', route((db, _req, res) => {
    res.json({
      periods: db.prepare('SELECT * FROM payroll_periods ORDER BY period_key').all(),
      records: db.prepare('SELECT * FROM payroll_records ORDER BY period_key, staff_name').all(),
      payments: db.prepare('SELECT * FROM payroll_payments ORDER BY created_at').all(),
    });
  }));

  app.post('/api/payroll/import', json, route((db, req, res) => {
    const data = req.body || {};
    const counts = db.tx(() => {
      let periods = 0, records = 0, payments = 0;
      for (const p of data.periods || []) {
        periods += db.prepare('INSERT OR IGNORE INTO payroll_periods(period_key, year, month, label, created_at, created_by) VALUES (?,?,?,?,?,?)')
          .run(p.period_key, p.year, p.month, p.label, p.created_at, p.created_by ?? null).changes;
      }
      for (const r of data.records || []) {
        records += db.prepare(`INSERT OR IGNORE INTO payroll_records
          (id, period_key, staff_id, staff_name, base_salary, origin, created_at) VALUES (?,?,?,?,?,?,?)`)
          .run(r.id, r.period_key, r.staff_id, r.staff_name, r.base_salary, r.origin || 'generated', r.created_at).changes;
      }
      for (const p of data.payments || []) {
        payments += db.prepare(`INSERT OR IGNORE INTO payroll_payments
          (id, record_id, staff_id, period_key, amount, allowances, bonus, deductions, method, paid_date, remarks, created_by, ledger_id, source, created_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
          .run(p.id, p.record_id, p.staff_id, p.period_key, p.amount, p.allowances || 0, p.bonus || 0, p.deductions || 0,
            p.method, p.paid_date, p.remarks ?? null, p.created_by ?? null, p.ledger_id ?? null, p.source || 'ui', p.created_at).changes;
      }
      return { periods, records, payments };
    });
    res.json({ imported: counts });
  }));

  // Migration (§3.6) -----------------------------------------------------------
  app.post('/api/payroll/migrate', json, route((db, _req, res) => {
    const report = db.tx(() => migratePayroll(db));
    res.json(report);
  }));
}

// ---------------------------------------------------------------------------
// §3.6 migration — idempotent, report-first, never touches old fields,
// never writes ledger entries for migrated payments (no double-counting).
// ---------------------------------------------------------------------------

function extractMonthsFromReason(reason) {
  const out = [];
  const re = /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/g;
  let m;
  while ((m = re.exec(String(reason || ''))) !== null) {
    const label = `${m[1]} ${m[2]}`;
    if (!out.includes(label)) out.push(label);
  }
  return out;
}

function migratePayroll(db) {
  const staffArr = getCollection(db, STAFF_COLLECTION_KEY);
  const ledgerArr = getCollection(db, LEDGER_COLLECTION_KEY);
  const report = {
    ranAt: nowISO(),
    staff: [],
    totals: { imported: 0, salaryTransactions: 0, ledger: 0, monthsMigrated: 0, paymentsCreated: 0 },
    skipped: [],
    notes: [
      'Migrated records snapshot the CURRENT staff salary — historical salary is unknowable.',
      'Migrated payments have ledger_id NULL: the expense already exists in the ledger, re-writing it would double-count.',
      'Old fields (paidMonths, transactions, payStatus) are not modified by migration.',
    ],
  };

  const getOrCreatePeriod = (year, month) => {
    const key = periodKeyOf(year, month);
    db.prepare('INSERT OR IGNORE INTO payroll_periods(period_key, year, month, label, created_at, created_by) VALUES (?,?,?,?,?,?)')
      .run(key, year, month, periodLabelOf(year, month), nowISO(), 'migration');
    return key;
  };
  const getOrCreateRecord = (key, s) => {
    db.prepare(`INSERT OR IGNORE INTO payroll_records
      (id, period_key, staff_id, staff_name, base_salary, origin, created_at) VALUES (?,?,?,?,?,'migrated',?)`)
      .run(`PREC-${key}-${s.id}`, key, s.id, s.name || s.id, Math.round(Number(s.salary) || 0), nowISO());
    return db.prepare('SELECT * FROM payroll_records WHERE period_key = ? AND staff_id = ?').get(key, s.id);
  };

  for (const s of staffArr) {
    const txs = Array.isArray(s.transactions) ? s.transactions : [];
    const salaryTxs = txs.filter(t => t.type === 'Salary');
    const loanTxs = txs.filter(t => t.type === 'Loan' || t.type === 'Repayment');
    const standaloneAdj = txs.filter(t => t.type === 'Bonus' || t.type === 'Allowance');

    // Attribute Salary-transaction amounts to the months their reasons name.
    const attributed = new Map(); // label -> { amount, tx }
    let salaryTxTotal = 0;
    for (const t of salaryTxs) {
      const amt = Math.round(Number(t.amount) || 0);
      salaryTxTotal += amt;
      const labels = extractMonthsFromReason(t.reason);
      if (labels.length === 0) {
        report.skipped.push({ staffId: s.id, staffName: s.name, txId: t.id, amount: amt, reason: 'Salary transaction names no month — not imported' });
        continue;
      }
      const per = Math.floor(amt / labels.length);
      const remainder = amt - per * labels.length;
      if (remainder !== 0) {
        report.notes.push(`${s.id}: transaction ${t.id} amount ${amt} does not split evenly across ${labels.length} month(s); remainder ${remainder} assigned to ${labels[labels.length - 1]}.`);
      }
      labels.forEach((label, i) => {
        const prev = attributed.get(label) || { amount: 0, tx: t };
        prev.amount += per + (i === labels.length - 1 ? remainder : 0);
        prev.tx = t;
        attributed.set(label, prev);
      });
    }
    if (loanTxs.length) report.skipped.push({ staffId: s.id, staffName: s.name, amount: loanTxs.reduce((a, t) => a + (Number(t.amount) || 0), 0), reason: `${loanTxs.length} Loan/Repayment transaction(s) — stay in StaffDetailsView, not imported` });
    if (standaloneAdj.length) report.skipped.push({ staffId: s.id, staffName: s.name, amount: standaloneAdj.reduce((a, t) => a + (Number(t.amount) || 0), 0), reason: `${standaloneAdj.length} standalone Bonus/Allowance transaction(s) with no month attribution — not imported` });

    const candidateLabels = [...new Set([...(Array.isArray(s.paidMonths) ? s.paidMonths : []), ...attributed.keys()])];
    let imported = 0;
    let monthsMigrated = 0;
    for (const label of candidateLabels) {
      const parsed = parsePeriodLabel(label);
      if (!parsed) {
        report.skipped.push({ staffId: s.id, staffName: s.name, amount: 0, reason: `Unparseable paid month label "${label}" — not imported` });
        continue;
      }
      const key = periodKeyOf(parsed.year, parsed.month);
      const already = db.prepare("SELECT 1 AS x FROM payroll_payments WHERE staff_id = ? AND period_key = ? AND source = 'migration'").get(s.id, key);
      if (already) continue; // idempotent: this (staff, month) is already migrated
      const rec = getOrCreateRecord(getOrCreatePeriod(parsed.year, parsed.month), s);
      const attr = attributed.get(label);
      const amount = attr ? attr.amount : rec.base_salary;
      const txDate = attr?.tx?.createdAt ? String(attr.tx.createdAt).slice(0, 10) : '';
      const paidDate = /^\d{4}-\d{2}-\d{2}$/.test(txDate) ? txDate
        : /^\d{4}-\d{2}-\d{2}$/.test(String(s.lastPaidDate || '')) ? String(s.lastPaidDate)
        : periodEndISO(parsed.year, parsed.month);
      const id = nextPaymentId(db);
      db.prepare(`INSERT INTO payroll_payments
        (id, record_id, staff_id, period_key, amount, allowances, bonus, deductions, method, paid_date, remarks, created_by, ledger_id, source, created_at)
        VALUES (?,?,?,?,?,0,0,0,?,?,?,?,NULL,'migration',?)`)
        .run(id, rec.id, s.id, key, amount,
          (attr?.tx?.payment || s.paymentMethod || 'Bank Transfer'), paidDate,
          attr ? 'Migrated from staff salary transaction' : 'Migrated from paidMonths — no matching transaction',
          attr?.tx?.createdBy || 'migration', nowISO());
      imported += amount;
      monthsMigrated++;
      report.totals.paymentsCreated++;
    }

    const ledgerTotal = ledgerArr
      .filter(e => e && e.category === 'Staff Salary' && e.type === 'Outgoing' && typeof e.reason === 'string' && e.reason.includes(`(${s.id})`))
      .reduce((a, e) => a + (Number(e.amount) || 0), 0);

    report.staff.push({
      staffId: s.id,
      staffName: s.name,
      imported,
      salaryTransactions: salaryTxTotal,
      ledger: ledgerTotal,
      difference: salaryTxTotal - imported, // explained by skipped month-less transactions, itemized above
      monthsMigrated,
    });
    report.totals.imported += imported;
    report.totals.salaryTransactions += salaryTxTotal;
    report.totals.ledger += ledgerTotal;
    report.totals.monthsMigrated += monthsMigrated;
  }

  // Stored before any old data is touched — migration never touches it at all.
  setSetting(db, MIGRATION_SETTING_KEY, { ranAt: report.ranAt, report });
  return report;
}
