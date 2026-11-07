import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ClassInfo, Student } from '../types';
import { DEFAULT_SCHOOL } from './pdfGenerator';

/**
 * Shared class-membership matching (Fix P0-1 + Fix P0-3) — the ONE rule every
 * screen, count and export must use so they can never disagree.
 *
 * A student belongs to a class when:
 *  - the student carries a `classId` (Fix P0-3) and it equals the class's id
 *    (the id wins outright — a class RENAME therefore cannot orphan anyone), or
 *  - the student has no `classId` (legacy record) and their `class` name
 *    string matches the class name, case-insensitive, trimmed.
 *
 * A student whose classId points at a class that no longer exists, or whose
 * legacy name matches no class, belongs to NO class — never silently
 * reassigned to another class.
 *
 * Counts are always computed live from the students array (Fix P0-1): never
 * read the legacy stored `ClassInfo.studentsCount` — it is written once at
 * class creation and never updated, which made PDF/CSV exports stale. 0 is a
 * valid count.
 */
export function normalizeClassName(name?: string | null): string {
  return (name || '').toLowerCase().trim();
}

export function findClassByName(classes: ClassInfo[], name?: string | null): ClassInfo | undefined {
  const target = normalizeClassName(name);
  if (!target) return undefined;
  return classes.find(c => normalizeClassName(c.name) === target);
}

export function studentBelongsToClass(student: Student, classInfo: ClassInfo): boolean {
  if (student.classId) {
    return student.classId === classInfo.id;
  }
  return !!student.class && normalizeClassName(student.class) === normalizeClassName(classInfo.name);
}

export function studentsInClass(students: Student[], classInfo: ClassInfo): Student[] {
  return students.filter(s => studentBelongsToClass(s, classInfo));
}

/**
 * Section comparison key: trimmed, case-insensitive (Fix P1-4). A section
 * is a real, exact value — 'A' is the name of one section, never a
 * wildcard for "all sections".
 */
export function normalizeSectionName(section?: string | null): string {
  return (section || '').trim().toLowerCase();
}

/**
 * Students of one class AND one section (Fix P1-4) — the ONE class+section
 * matching rule for exam exports, marks entry and any other flow that
 * needs a class roster narrowed to a section.
 *
 * Class membership: pass the ClassInfo record when you have it (the
 * classId-first rule of `studentBelongsToClass` applies, so renames are
 * safe); pass a class NAME string when no record is available and
 * matching falls back to the trimmed, case-insensitive name comparison.
 *
 * Section matching is EXACT after normalization. An exam (or caller) that
 * records NO section (undefined / empty / whitespace) represents a
 * whole-class exam, so the whole class matches — that is what the record
 * genuinely means: the creation flow (CreateExamModal) always writes one
 * exam per concrete section, so a section-less record can only be a
 * legacy whole-class exam. A RECORDED section — including 'A' — matches
 * only students of that exact section.
 */
export function studentsInClassSection(
  students: Student[],
  classRef: ClassInfo | string,
  section?: string | null
): Student[] {
  const inClass = typeof classRef === 'string'
    ? students.filter(s => !!s.class && normalizeClassName(s.class) === normalizeClassName(classRef))
    : studentsInClass(students, classRef);
  const target = normalizeSectionName(section);
  if (!target) return inClass;
  return inClass.filter(s => normalizeSectionName(s.section) === target);
}

/**
 * The class's real monthly fee, or `null` when no fee is set (Fix P1-8).
 *
 * `ClassInfo.fee` is optional: legacy/imported records may carry no fee
 * at all. A fee of exactly 0 is a REAL fee — the class is free — and is
 * returned as 0, never confused with "unset". Anything that is not a
 * finite, non-negative number (undefined, NaN, negative, a stray string
 * from an old import) is treated as unset. Callers must render `null`
 * explicitly as "Fee not set" and must never substitute an invented
 * number (the old code silently billed/displayed 4,800 PKR everywhere).
 */
export function resolveClassFee(classInfo?: ClassInfo | null): number | null {
  if (!classInfo) return null;
  const fee = classInfo.fee;
  if (typeof fee !== 'number' || !Number.isFinite(fee) || fee < 0) return null;
  return fee;
}

/**
 * Validate the raw text of a class-fee form input (Fix P1-8). Fee is a
 * REQUIRED field at class creation and edit: empty, non-numeric and
 * negative values are rejected with a user-visible message; 0 is valid
 * and means the class is free.
 */
export function validateClassFeeInput(raw: string): { fee: number } | { error: string } {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return { error: 'Fee is required. Enter the monthly fee per student (enter 0 if the class is free).' };
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return { error: 'Fee must be a number.' };
  if (value < 0) return { error: 'Fee cannot be negative.' };
  return { fee: value };
}

export function countStudentsInClass(students: Student[], classInfo: ClassInfo): number {
  return studentsInClass(students, classInfo).length;
}

/** Id of the class whose NAME matches (case-insensitive, trimmed), if any. */
export function classIdForClassName(classes: ClassInfo[], className?: string | null): string | undefined {
  return findClassByName(classes, className)?.id;
}

/**
 * Copy of the student with `classId` resolved from their class NAME against
 * the current classes list — used at save time in every student write path.
 * If the name matches no class record, the copy carries no classId (the
 * student belongs to no known class; a stale id is never left behind
 * pointing at the wrong class). Returns the original object when the
 * resolved id already equals the stored one.
 */
export function withClassIdFromName(student: Student, classes: ClassInfo[]): Student {
  const resolved = classIdForClassName(classes, student.class);
  if (resolved === student.classId) return student;
  const next = { ...student };
  if (resolved) next.classId = resolved;
  else delete next.classId;
  return next;
}

/**
 * Migration/backfill (Fix P0-3): populate `classId` on legacy students that
 * don't have one yet, by matching their class name against the classes list.
 * Students whose name matches no class keep classId unset (they belong to no
 * class). Students already carrying a classId are never touched — in
 * particular a dangling id is NOT "repaired" by name, so nobody is silently
 * moved into a different class. Returns the ORIGINAL array reference when
 * nothing changed, so callers can use it in effects without render loops.
 */
/**
 * Rename cascade (Fix P0-3), shared by every class-rename handler
 * (ClassesModule edit modal and ClassDetailsPage edit modal): returns the
 * students array as it must look after `classInfo` is renamed to `newName`.
 * Students attached by classId keep their id and only have their display
 * name string synced; legacy name-only students of the OLD name are moved
 * to the new name and stamped with the classId. Unattached students are
 * returned untouched. Returns the original array reference when the name
 * did not change or no student is attached.
 */
export function studentsAfterClassRename(students: Student[], classInfo: ClassInfo, newName: string): Student[] {
  const trimmed = newName.trim();
  if (!trimmed || trimmed === classInfo.name) return students;
  const oldKey = normalizeClassName(classInfo.name);
  let changed = false;
  const next = students.map(s => {
    const attachedById = !!s.classId && s.classId === classInfo.id;
    const attachedByName = !s.classId && !!s.class && normalizeClassName(s.class) === oldKey;
    if (!attachedById && !attachedByName) return s;
    changed = true;
    return { ...s, class: trimmed, classId: classInfo.id };
  });
  return changed ? next : students;
}

export function backfillStudentClassIds(students: Student[], classes: ClassInfo[]): Student[] {
  if (classes.length === 0) return students;
  let changed = false;
  const next = students.map(s => {
    if (s.classId) return s;
    const resolved = classIdForClassName(classes, s.class);
    if (!resolved) return s;
    changed = true;
    return { ...s, classId: resolved };
  });
  return changed ? next : students;
}

export function exportClassesToCSV(classes: ClassInfo[], students: Student[], filename = 'classes_directory.csv') {
  const headers = ['Class ID', 'Class Name', 'Sections Count', 'Sections', 'Enrolled Students'];
  const rows = classes.map(c => [
    c.id,
    `"${c.name.replace(/"/g, '""')}"`,
    c.sectionsCount,
    `"${c.sections.join(', ')}"`,
    countStudentsInClass(students, c)
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportClassesToPDF(classes: ClassInfo[], students: Student[], school = DEFAULT_SCHOOL) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const margin = 14;

  // Header Banner
  doc.setFillColor(16, 22, 34); // #101622
  doc.roundedRect(margin, margin, pageWidth - (margin * 2), 26, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(school.name, margin + 8, margin + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(`Academic Directory: Classes & Sections Summary`, margin + 8, margin + 17);
  doc.text(`Generated on: ${new Date().toLocaleDateString('en-GB')}`, margin + 8, margin + 22);

  // Summary Metrics
  const totalClasses = classes.length;
  const totalSections = classes.reduce((sum, c) => sum + c.sectionsCount, 0);
  const totalStudents = classes.reduce((sum, c) => sum + countStudentsInClass(students, c), 0);

  const startY = margin + 32;

  // Table
  const tableData = classes.map((c, index) => [
    index + 1,
    c.name,
    c.sectionsCount,
    c.sections.join(', '),
    countStudentsInClass(students, c)
  ]);

  autoTable(doc, {
    startY,
    head: [['#', 'Class', 'Sections', 'Section Names', 'Students']],
    body: tableData,
    theme: 'plain',
    headStyles: {
      fillColor: [21, 28, 42],
      textColor: [241, 245, 249],
      fontSize: 8.5,
      fontStyle: 'bold',
      cellPadding: 3
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 55, fontStyle: 'bold' },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 45 },
      4: { cellWidth: 35, halign: 'center', fontStyle: 'bold' }
    },
    margin: { left: margin, right: margin },
    foot: [[
      'Total',
      `${totalClasses} Classes`,
      `${totalSections} Sections`,
      '—',
      `${totalStudents} Students`
    ]],
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8.5
    }
  });

  doc.save(`Classes_Directory_${new Date().toISOString().slice(0, 10)}.pdf`);
}
