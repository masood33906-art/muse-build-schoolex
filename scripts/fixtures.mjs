// TEST-ONLY fixtures for scripts/smoke-test.mjs and scripts/payroll-test.mjs.
//
// The shipped app contains NO built-in / sample data and no endpoint that
// inserts any (owner directive 2026-11-08: the dummy-data facility —
// server/seed-data.json + POST /api/system/load-dummy-data + the Settings
// button — was removed completely). Tests still need a school to work
// with, so they build one here, through the app's normal public API.
//
// This file lives under scripts/ ONLY. electron-builder's "files" list in
// package.json (dist/**, server/**, electron/**, package.json,
// node_modules/**) does not include scripts/, so these fixtures can never
// be packaged into the installed app.

export const FIXTURE_COUNTS = { students: 3, staff: 28, classes: 3 };

export const STUDENT_COLLECTION_KEY = 'schoollee_offline_students_clean_v1';
export const STAFF_COLLECTION_KEY = 'schoollee_offline_staff_clean_v1';
export const CLASS_COLLECTION_KEY = 'schoollee_classes_clean_v1';

export function fixtureStudents() {
  return [1, 2, 3].map((n) => ({
    id: `FIX-STU-00${n}`,
    name: `Fixture Student ${n}`,
    family: `Fixture Family ${n}`,
    familyId: `FIX-FAM-00${n}`,
    class: 'Class 6',
    section: 'A',
    status: 'Active',
    phone: `0300000000${n}`,
  }));
}

export function fixtureStaff() {
  // 28 members, all Active and joined well before the 2026 test periods,
  // so payroll period creation snapshots all 28 (salary is symbolic —
  // the payroll test reads each member's actual salary back).
  return Array.from({ length: FIXTURE_COUNTS.staff }, (_, i) => {
    const n = i + 1;
    const teacher = n <= 20;
    return {
      id: `FIX-STF-${String(n).padStart(3, '0')}`,
      name: `Fixture ${teacher ? 'Teacher' : 'Staff'} ${n}`,
      role: teacher ? 'Teacher' : 'Administrator',
      category: teacher ? 'Teaching' : 'Non-Teaching',
      department: 'Academics',
      qualification: 'M.A.',
      salary: 35000 + i * 1000,
      payStatus: 'Pending',
      status: 'Active',
      phone: `03000000${String(n).padStart(3, '0')}`,
      email: `fixture${n}@example.com`,
      joiningDate: '2021-03-01',
      paymentMethod: 'Bank Transfer',
    };
  });
}

export function fixtureClasses() {
  return [6, 7, 8].map((n, i) => ({
    id: `FIX-CLS-00${i + 1}`,
    name: `Class ${n}`,
    fee: 3000,
    studentsCount: 0,
  }));
}

const jsonHeaders = { 'Content-Type': 'application/json' };

// Insert the whole fixture school through the normal API: entity POSTs
// (relational tables) + collection PUTs under the app's exact storage
// keys (what frontend hydration reads). Returns the inserted counts.
export async function seedFixtures(base, fetchImpl = fetch) {
  const students = fixtureStudents();
  const staff = fixtureStaff();
  const classes = fixtureClasses();
  for (const s of students) {
    const r = await fetchImpl(`${base}/api/students`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(s) });
    if (!r.ok) throw new Error(`fixture student insert failed: HTTP ${r.status}`);
  }
  for (const s of staff) {
    const r = await fetchImpl(`${base}/api/staff`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(s) });
    if (!r.ok) throw new Error(`fixture staff insert failed: HTTP ${r.status}`);
  }
  for (const c of classes) {
    const r = await fetchImpl(`${base}/api/classes`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(c) });
    if (!r.ok) throw new Error(`fixture class insert failed: HTTP ${r.status}`);
  }
  const puts = [
    [STUDENT_COLLECTION_KEY, students],
    [STAFF_COLLECTION_KEY, staff],
    [CLASS_COLLECTION_KEY, classes],
  ];
  for (const [key, value] of puts) {
    const r = await fetchImpl(`${base}/api/collections/${key}`, { method: 'PUT', headers: jsonHeaders, body: JSON.stringify({ value }) });
    if (!r.ok) throw new Error(`fixture collection insert failed (${key}): HTTP ${r.status}`);
  }
  return { students: students.length, staff: staff.length, classes: classes.length };
}
