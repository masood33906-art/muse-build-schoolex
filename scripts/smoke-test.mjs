// SchoolEx backend smoke test.
// Boots the server on a temp DB and checks that a fresh install is EMPTY
// (no auto-seed, and NO dummy-data facility exists anywhere — the endpoint
// is gone), inserts a small fixture school through the normal API
// (scripts/fixtures.mjs — test-only, never shipped), verifies collections
// + CRUD + the data epoch, restarts on the same DB, verifies persistence,
// then exercises /api/system/reset: after a reset + restart the system
// must still be completely empty, with the epoch rotated.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { seedFixtures, FIXTURE_COUNTS, STUDENT_COLLECTION_KEY, STAFF_COLLECTION_KEY, CLASS_COLLECTION_KEY } from './fixtures.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'schoolex-smoke-'));
const dbPath = path.join(tmp, 'smoke.db');
process.env.SCHOOLEX_DB = dbPath;
const { startServer } = await import('../server/index.js');

let failures = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
  if (!cond) failures++;
};

let epoch1 = null;
let h = await startServer({ port: 0, dbPath });
const base = `http://127.0.0.1:${h.port}`;
try {
  const health = await (await fetch(`${base}/api/health`)).json();
  check('health ok', health.ok === true, `driver=${health.driver}`);
  epoch1 = health.epoch;
  check('health reports a data epoch', typeof epoch1 === 'string' && epoch1.length > 0, epoch1 || '');
  // Fresh installs start EMPTY: no auto-seed on server start.
  check('fresh install is empty (no auto-seed)',
    (health.counts?.students || 0) === 0 && (health.counts?.staff || 0) === 0 && (health.counts?.classes || 0) === 0,
    `students=${health.counts?.students} staff=${health.counts?.staff} classes=${health.counts?.classes}`);
  const emptyCols = await (await fetch(`${base}/api/collections`)).json();
  check('fresh install has no seeded collections',
    ![STUDENT_COLLECTION_KEY, STAFF_COLLECTION_KEY, CLASS_COLLECTION_KEY]
      .some(k => Array.isArray(emptyCols.collections?.[k]) && emptyCols.collections[k].length > 0));
  check('collections response carries the same epoch', emptyCols.epoch === epoch1);

  // There is NO dummy-data facility anymore: the endpoint must not exist.
  const dummy = await fetch(`${base}/api/system/load-dummy-data`, { method: 'POST' });
  check('load-dummy-data endpoint is gone (404)', dummy.status === 404, `status=${dummy.status}`);

  // Fixture school via the normal API (test-only data, scripts/fixtures.mjs).
  const seeded = await seedFixtures(base);
  check('fixture school inserted via the normal API',
    seeded.students === FIXTURE_COUNTS.students && seeded.staff === FIXTURE_COUNTS.staff && seeded.classes === FIXTURE_COUNTS.classes,
    JSON.stringify(seeded));
  const healthSeeded = await (await fetch(`${base}/api/health`)).json();
  check('entity counts match the fixtures',
    healthSeeded.counts?.students === FIXTURE_COUNTS.students && healthSeeded.counts?.staff === FIXTURE_COUNTS.staff && healthSeeded.counts?.classes === FIXTURE_COUNTS.classes,
    JSON.stringify(healthSeeded.counts));

  const student = { id: 'SMOKE-001', name: 'Smoke Test Student', family: 'Tester', familyId: 'F-SMOKE', class: 'Class 6', section: 'A', status: 'Active' };
  const created = await fetch(`${base}/api/students`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(student) });
  check('create student 201', created.status === 201);
  const got = await (await fetch(`${base}/api/students/SMOKE-001`)).json();
  check('read student back', got.name === student.name);

  const put = await fetch(`${base}/api/collections/schoollee_smoke_v1`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: [1, 2, 3] }) });
  check('collection PUT', put.ok);
  const col = await (await fetch(`${base}/api/collections/schoollee_smoke_v1`)).json();
  check('collection GET', JSON.stringify(col.value) === '[1,2,3]');

  // The fixtures must ALSO land in collections under the app's exact
  // storage keys, so frontend hydration shows the data.
  const allCols = await (await fetch(`${base}/api/collections`)).json();
  const seedCounts = {
    [STUDENT_COLLECTION_KEY]: FIXTURE_COUNTS.students,
    [STAFF_COLLECTION_KEY]: FIXTURE_COUNTS.staff,
    [CLASS_COLLECTION_KEY]: FIXTURE_COUNTS.classes,
  };
  for (const [key, want] of Object.entries(seedCounts)) {
    const v = allCols.collections?.[key];
    check(`fixture collection ${key}`, Array.isArray(v) && v.length === want, `len=${Array.isArray(v) ? v.length : 'missing'}`);
  }

  const home = await fetch(`${base}/`);
  check('frontend served', home.status === 200 && (await home.text()).includes('<div id="root">') || home.status === 200);

  const backup = await fetch(`${base}/api/backup`);
  const bytes = Buffer.from(await backup.arrayBuffer());
  check('backup endpoint returns SQLite file', backup.status === 200 && bytes.subarray(0, 15).toString() === 'SQLite format 3', `${bytes.length} bytes`);
  fs.writeFileSync(path.join(tmp, 'backup.db'), bytes);
} finally {
  await h.close();
}

// Restart on the same DB file: data and epoch must be exactly as left.
let epochAfterReset = null;
h = await startServer({ port: 0, dbPath });
const base2 = `http://127.0.0.1:${h.port}`;
try {
  const got = await (await fetch(`${base2}/api/students/SMOKE-001`)).json();
  check('student persists after restart (SQLite)', got.name === 'Smoke Test Student');
  const health = await (await fetch(`${base2}/api/health`)).json();
  check('health ok after restart', health.ok === true);
  check('epoch is stable across a restart', health.epoch === epoch1, `${health.epoch} vs ${epoch1}`);
  // Restart must not re-seed or duplicate the collections.
  const allCols2 = await (await fetch(`${base2}/api/collections`)).json();
  const stu2 = allCols2.collections?.[STUDENT_COLLECTION_KEY];
  check('fixture collections unchanged after restart', Array.isArray(stu2) && stu2.length === FIXTURE_COUNTS.students, `len=${Array.isArray(stu2) ? stu2.length : 'missing'}`);

  // Reset System: everything goes back to the empty first-run state…
  const reset = await fetch(`${base2}/api/system/reset`, { method: 'POST' });
  const resetBody = await reset.json();
  check('system reset succeeds', reset.ok && resetBody.ok === true);
  epochAfterReset = resetBody.epoch;
  check('reset rotates the data epoch', typeof epochAfterReset === 'string' && epochAfterReset.length > 0 && epochAfterReset !== epoch1);
  const healthAfterReset = await (await fetch(`${base2}/api/health`)).json();
  check('all entity counts are 0 after reset',
    Object.values(healthAfterReset.counts || {}).every(c => c === 0),
    JSON.stringify(healthAfterReset.counts));
  check('health epoch matches the rotated epoch', healthAfterReset.epoch === epochAfterReset);
  const colsAfterReset = await (await fetch(`${base2}/api/collections`)).json();
  check('no collections remain after reset', (colsAfterReset.keys || []).length === 0, `keys=${(colsAfterReset.keys || []).length}`);
} finally {
  await h.close();
}

// Restart after the reset: still completely empty (nothing resurrects),
// the rotated epoch persists, and the system accepts new data again.
h = await startServer({ port: 0, dbPath });
const base3 = `http://127.0.0.1:${h.port}`;
try {
  const health = await (await fetch(`${base3}/api/health`)).json();
  check('still empty after reset + restart',
    Object.values(health.counts || {}).every(c => c === 0),
    JSON.stringify(health.counts));
  check('rotated epoch persists across the restart', health.epoch === epochAfterReset);
  const cols = await (await fetch(`${base3}/api/collections`)).json();
  check('no collections after reset + restart', (cols.keys || []).length === 0, `keys=${(cols.keys || []).length}`);
  const dummy = await fetch(`${base3}/api/system/load-dummy-data`, { method: 'POST' });
  check('load-dummy-data still gone after reset (404)', dummy.status === 404, `status=${dummy.status}`);
  const seeded = await seedFixtures(base3);
  check('fixtures insert cleanly into the reset system',
    seeded.students === FIXTURE_COUNTS.students && seeded.staff === FIXTURE_COUNTS.staff && seeded.classes === FIXTURE_COUNTS.classes,
    JSON.stringify(seeded));
} finally {
  await h.close();
}

console.log(failures === 0 ? 'SMOKE TEST: ALL PASS' : `SMOKE TEST: ${failures} FAILURE(S)`);
console.log(`temp dir kept for inspection: ${tmp}`);
process.exit(failures ? 1 : 0);
