// SchoolEx backend smoke test.
// Boots the server on a temp DB and checks that a fresh install is EMPTY
// (no auto-seed), loads dummy data on demand (Settings → Load Dummy Data),
// verifies collections + CRUD, restarts on the same DB, verifies
// persistence, then exercises /api/system/reset and a second dummy load.
import fs from 'fs';
import os from 'os';
import path from 'path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'schoolex-smoke-'));
const dbPath = path.join(tmp, 'smoke.db');
process.env.SCHOOLEX_DB = dbPath;
const { startServer } = await import('../server/index.js');

let failures = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
  if (!cond) failures++;
};

let h = await startServer({ port: 0, dbPath });
const base = `http://127.0.0.1:${h.port}`;
try {
  const health = await (await fetch(`${base}/api/health`)).json();
  check('health ok', health.ok === true, `driver=${health.driver}`);
  // Fresh installs start EMPTY: no auto-seed on server start.
  check('fresh install is empty (no auto-seed)',
    (health.counts?.students || 0) === 0 && (health.counts?.staff || 0) === 0 && (health.counts?.classes || 0) === 0,
    `students=${health.counts?.students} staff=${health.counts?.staff} classes=${health.counts?.classes}`);
  const emptyCols = await (await fetch(`${base}/api/collections`)).json();
  check('fresh install has no seeded collections',
    !['schoollee_offline_students_clean_v1', 'schoollee_offline_staff_clean_v1', 'schoollee_classes_clean_v1']
      .some(k => Array.isArray(emptyCols.collections?.[k]) && emptyCols.collections[k].length > 0));

  // Dummy data loads on demand only (Settings → Load Dummy Data).
  const dummy = await fetch(`${base}/api/system/load-dummy-data`, { method: 'POST' });
  const dummyBody = await dummy.json();
  check('load-dummy-data succeeds on an empty system', dummy.ok && dummyBody.ok === true, dummyBody.error || '');
  check('dummy data counts are 117/28/19',
    dummyBody.loaded?.students === 117 && dummyBody.loaded?.staff === 28 && dummyBody.loaded?.classes === 19,
    JSON.stringify(dummyBody.loaded));
  const dummyAgain = await fetch(`${base}/api/system/load-dummy-data`, { method: 'POST' });
  check('load-dummy-data refuses when data exists (409)', dummyAgain.status === 409, `status=${dummyAgain.status}`);

  const student = { id: 'SMOKE-001', name: 'Smoke Test Student', family: 'Tester', familyId: 'F-SMOKE', class: 'Class 6', section: 'A', status: 'Active' };
  const created = await fetch(`${base}/api/students`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(student) });
  check('create student 201', created.status === 201);
  const got = await (await fetch(`${base}/api/students/SMOKE-001`)).json();
  check('read student back', got.name === student.name);

  const put = await fetch(`${base}/api/collections/schoollee_smoke_v1`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: [1, 2, 3] }) });
  check('collection PUT', put.ok);
  const col = await (await fetch(`${base}/api/collections/schoollee_smoke_v1`)).json();
  check('collection GET', JSON.stringify(col.value) === '[1,2,3]');

  // The dummy load must ALSO land in collections under the app's exact
  // storage keys, so frontend hydration shows the data.
  const allCols = await (await fetch(`${base}/api/collections`)).json();
  const seedCounts = {
    schoollee_offline_students_clean_v1: 117,
    schoollee_offline_staff_clean_v1: 28,
    schoollee_classes_clean_v1: 19,
  };
  for (const [key, want] of Object.entries(seedCounts)) {
    const v = allCols.collections?.[key];
    check(`seeded collection ${key}`, Array.isArray(v) && v.length === want, `len=${Array.isArray(v) ? v.length : 'missing'}`);
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

// Restart on the same DB file: the student must still be there.
h = await startServer({ port: 0, dbPath });
try {
  const base2 = `http://127.0.0.1:${h.port}`;
  const got = await (await fetch(`${base2}/api/students/SMOKE-001`)).json();
  check('student persists after restart (SQLite)', got.name === 'Smoke Test Student');
  const health = await (await fetch(`${base2}/api/health`)).json();
  check('health ok after restart', health.ok === true);
  // Restart must not re-seed or duplicate the collections.
  const allCols2 = await (await fetch(`${base2}/api/collections`)).json();
  const stu2 = allCols2.collections?.schoollee_offline_students_clean_v1;
  check('dummy collections unchanged after restart', Array.isArray(stu2) && stu2.length === 117, `len=${Array.isArray(stu2) ? stu2.length : 'missing'}`);

  // Reset System: everything goes back to the empty first-run state…
  const reset = await fetch(`${base2}/api/system/reset`, { method: 'POST' });
  check('system reset succeeds', reset.ok);
  const healthAfterReset = await (await fetch(`${base2}/api/health`)).json();
  check('all entity counts are 0 after reset',
    Object.values(healthAfterReset.counts || {}).every(c => c === 0),
    JSON.stringify(healthAfterReset.counts));
  const colsAfterReset = await (await fetch(`${base2}/api/collections`)).json();
  check('no collections remain after reset', (colsAfterReset.keys || []).length === 0, `keys=${(colsAfterReset.keys || []).length}`);
  // …and dummy data can be loaded again afterwards.
  const dummy2 = await fetch(`${base2}/api/system/load-dummy-data`, { method: 'POST' });
  const dummy2Body = await dummy2.json();
  check('load-dummy-data succeeds again after reset',
    dummy2.ok && dummy2Body.loaded?.students === 117 && dummy2Body.loaded?.staff === 28 && dummy2Body.loaded?.classes === 19,
    dummy2Body.error || '');
} finally {
  await h.close();
}

console.log(failures === 0 ? 'SMOKE TEST: ALL PASS' : `SMOKE TEST: ${failures} FAILURE(S)`);
console.log(`temp dir kept for inspection: ${tmp}`);
process.exit(failures ? 1 : 0);
