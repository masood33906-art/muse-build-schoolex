import { ClassInfo, Student } from '../types';
import { findClassByName, studentBelongsToClass } from './classExportHelper';

/**
 * Roll numbers are a DERIVED, per-class sequence (owner's spec,
 * 2026-11-08).
 *
 * Every class counts its OWN students 1, 2, 3, …: the first student
 * admitted to ANY class gets roll 1 in that class — per the owner's
 * worked example, Class 2's first student is roll 1, not 101. Class
 * membership is the shared `studentBelongsToClass` rule (the student's
 * stable `classId`, legacy name match otherwise). Sections live inside
 * a ClassInfo record rather than being separate class entries, so one
 * class entry — across all of its sections — has ONE sequence; two
 * different class entries always sequence independently.
 *
 * The sequence is capped at 100 per class (the owner's "range of 100
 * digits", read through his worked example). The sequence is fully
 * independent of the registration / admission ID (`Student.id`) — a
 * roll is computed from the class's existing rolls only, never from
 * any ID.
 *
 * Assignment rule: next = (highest numeric roll already in the class)
 * + 1. MAX+1, never count+1, so gaps left by removed or hand-numbered
 * students are never reused and an auto roll can never duplicate an
 * existing one. Rolls are stored as strings on the student record and
 * may be blank, zero-padded ('09') or non-numeric (a hand-typed '—');
 * only pure digit strings take part in the sequence.
 */

export const ROLL_NUMBER_CAP = 100;

/**
 * Parse a stored roll value into a sequence number. Returns the integer
 * for pure digit strings ('7' → 7, '09' → 9) and `null` for anything else
 * (blank, undefined, '—', 'A1', '3.5', …) — non-numeric rolls are ignored
 * by the sequence, never treated as 0-and-counted or as an error.
 */
export function parseRollNumber(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (!/^\d+$/.test(text)) return null;
  const value = parseInt(text, 10);
  return Number.isSafeInteger(value) ? value : null;
}

/**
 * The class reference a roll sequence belongs to. Resolves the real
 * ClassInfo by name when one exists; otherwise returns a name-only
 * reference (legacy class names that exist only on student records), for
 * which `studentBelongsToClass` matches by name exactly as it does for
 * classId-less legacy students.
 */
export function classRefForName(classes: ClassInfo[], className?: string | null): ClassInfo {
  const found = findClassByName(classes, className);
  if (found) return found;
  return {
    id: '',
    name: (className || '').trim(),
    sectionsCount: 0,
    sections: []
  };
}

/** Highest numeric roll currently held in the class (0 when none). */
export function maxRollNumberInClass(students: Student[], classInfo: ClassInfo): number {
  let max = 0;
  for (const s of students) {
    if (!studentBelongsToClass(s, classInfo)) continue;
    const parsed = parseRollNumber(s.rollNo);
    if (parsed !== null && parsed > max) max = parsed;
  }
  return max;
}

/**
 * The roll the NEXT student admitted to this class should get:
 * max existing roll in the class + 1 (1 for an empty class). Returns
 * `null` when the class sequence is exhausted (max ≥ ROLL_NUMBER_CAP) —
 * auto-assignment then stops and the roll must be set by hand; `null` is
 * never a licence to emit 101 as an "auto" value.
 */
export function nextRollNumber(students: Student[], classInfo: ClassInfo): number | null {
  const next = maxRollNumberInClass(students, classInfo) + 1;
  return next > ROLL_NUMBER_CAP ? null : next;
}

/**
 * Ordering for lists that present students by roll (exam rosters and the
 * like): numeric rolls ascending (2 before 10 — a plain string sort gets
 * this wrong), students without a numeric roll after them, ties and
 * roll-less students ordered by name.
 */
export function compareStudentsByRoll(
  a: { rollNo?: string | null; name?: string | null },
  b: { rollNo?: string | null; name?: string | null }
): number {
  const ra = parseRollNumber(a.rollNo);
  const rb = parseRollNumber(b.rollNo);
  if (ra !== null && rb !== null && ra !== rb) return ra - rb;
  if (ra !== null && rb === null) return -1;
  if (ra === null && rb !== null) return 1;
  return (a.name || '').localeCompare(b.name || '');
}

/**
 * Bulk-import assignment (BulkUploadModal's import step). Walks the
 * incoming students IN FILE ORDER against a pool that starts as the
 * existing registry and grows with every processed row. Sequencing is
 * per class:
 *  - a row that already carries a roll (from the file) keeps it verbatim,
 *    and that roll counts toward its class's sequence for later rows of
 *    the same class;
 *  - a roll-less row gets `nextRollNumber(pool, its class)`; when that
 *    class is at the cap the row is left roll-less (never a fake 101).
 * Brand-new classes (present in `classes`, absent from the registry)
 * naturally start their sequence at 1. Inputs are not mutated.
 */
export function assignMissingRollNumbers(
  incoming: Student[],
  existing: Student[],
  classes: ClassInfo[]
): Student[] {
  const pool: Student[] = [...existing];
  const classRefForStudent = (student: Student): ClassInfo | null => {
    if (student.classId) {
      const byId = classes.find(c => c.id === student.classId);
      if (byId) return byId;
    }
    if ((student.class || '').trim()) return classRefForName(classes, student.class);
    return null;
  };

  return incoming.map(student => {
    let result = student;
    // Only a BLANK roll is auto-assigned; any value the file carries —
    // numeric or not — is the admin's own and is kept verbatim.
    if (!(student.rollNo || '').trim()) {
      const classInfo = classRefForStudent(student);
      if (classInfo) {
        const next = nextRollNumber(pool, classInfo);
        if (next !== null) {
          result = { ...student, rollNo: String(next) };
        }
      }
    }
    pool.push(result);
    return result;
  });
}
