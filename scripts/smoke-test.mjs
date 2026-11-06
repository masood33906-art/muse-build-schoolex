// SchoolEx backend smoke test.
// Boots the server on a temp DB, checks /api/health, creates a student,
// verifies collections + settings, restarts the server on the same DB,
// verifies the student persisted in SQLite, and checks /api/backup.
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
  check('seeded students > 0', (health.counts?.students || 0) > 0, `students=${health.counts?.students}`);

  const student = { id: 'SMOKE-001', name: 'Smoke Test Student', family: 'Tester', familyId: 'F-SMOKE', class: 'Class 6', section: 'A', status: 'Active' };
  const created = await fetch(`${base}/api/students`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(student) });
  check('create student 201', created.status === 201);
  const got = await (await fetch(`${base}/api/students/SMOKE-001`)).json();
  check('read student back', got.name === student.name);

  const put = await fetch(`${base}/api/collections/schoollee_smoke_v1`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: [1, 2, 3] }) });
  check('collection PUT', put.ok);
  const col = await (await fetch(`${base}/api/collections/schoollee_smoke_v1`)).json();
  check('collection GET', JSON.stringify(col.value) === '[1,2,3]');

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
} finally {
  await h.close();
}

console.log(failures === 0 ? 'SMOKE TEST: ALL PASS' : `SMOKE TEST: ${failures} FAILURE(S)`);
console.log(`temp dir kept for inspection: ${tmp}`);
process.exit(failures ? 1 : 0);
