import { Student, FamilyData, ClassInfo } from '../types';
import { getSchoolSettings } from './settingsHelper';

export interface CSVPrerequisiteIssue {
  rowNumber: number;
  studentName: string;
  studentId: string;
  type: 'missing_class' | 'missing_section' | 'missing_required_field' | 'duplicate_id';
  targetClass?: string;
  targetSection?: string;
  availableSectionsForClass?: string[];
  message: string;
}

export interface CSVParseResult {
  students: Student[];
  /** CSV row number (header = row 1) for each entry in `students`, same order. */
  rowNumbers: number[];
  /** True when the file carries a Date of Birth column (per-row DOB is then required). */
  hasDobColumn: boolean;
  errors: string[];
  totalRows: number;
  prerequisitePassed: boolean;
  prerequisiteIssues: CSVPrerequisiteIssue[];
  missingClasses: string[];
  missingSectionsByClass: Record<string, string[]>;
  duplicateIdsInFile: string[];
  existingStudentIdConflicts: { rowNumber: number; studentName: string; studentId: string; existingStudentName: string }[];
}

export function exportStudentsToCSV(students: Student[], filename = 'student_records_backup.csv') {
  const headers = ['Student ID', 'Student Name', 'Family / Guardian', 'Family ID', 'Class', 'Section', 'Status', 'Blood Group', 'Contact Phone', 'Admission Date'];
  
  const escapeCell = (val: string | undefined | null) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = students.map(s => [
    escapeCell(s.id),
    escapeCell(s.name),
    escapeCell(s.family),
    escapeCell(s.familyId),
    escapeCell(s.class),
    escapeCell(s.section),
    escapeCell(s.status),
    escapeCell(s.bloodGroup || ''),
    escapeCell(s.phone || ''),
    escapeCell(s.admissionDate || '')
  ].join(','));

  const csvContent = [headers.map(h => `"${h}"`).join(','), ...rows].join('\r\n');
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

export function exportFamiliesToCSV(families: FamilyData[], filename?: string) {
  const headers = [
    'Family ID',
    'Family / Guardian Name',
    'Phone Number',
    'WhatsApp',
    'CNIC',
    'Guardian Occupation',
    'Email',
    'Residential Address',
    'Mother Name',
    'Mother CNIC',
    'Religion',
    'Enrolled Students Count',
    'Enrolled Students'
  ];

  const escapeCell = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = families.map(fam => [
    escapeCell(fam.familyId),
    escapeCell(fam.familyName),
    escapeCell(fam.phone),
    escapeCell(fam.whatsapp || fam.phone),
    escapeCell(fam.guardianCnic),
    escapeCell(fam.guardianOccupation),
    escapeCell(fam.email),
    escapeCell(fam.address),
    escapeCell(fam.motherName),
    escapeCell(fam.motherCnic),
    escapeCell(fam.religion),
    escapeCell(fam.students.length),
    escapeCell(fam.students.map(s => `${s.name} (${s.id}, ${s.class}-${s.section})`).join('; '))
  ].join(','));

  const csvContent = [headers.map(h => `"${h}"`).join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const dateStr = new Date().toISOString().slice(0, 10);
  link.setAttribute('download', filename || `families_records_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadSampleCSVTemplate(availableClasses: ClassInfo[] = []) {
  const sampleHeaders = 'Student ID,Roll No,Student Name,Family Name,Family ID,Class,Section,Status,Blood Group,Contact Phone,Admission Date,Date of Birth';
  
  const getClassAndSec = (index: number, fallbackClass: string, fallbackSec: string) => {
    if (availableClasses.length > 0) {
      const cls = availableClasses[index % availableClasses.length];
      const sec = cls.sections && cls.sections.length > 0 ? cls.sections[0] : 'A';
      return { className: cls.name, sectionName: sec };
    }
    return { className: fallbackClass, sectionName: fallbackSec };
  };

  const c1 = getClassAndSec(0, 'Class 5', 'A');
  const c2 = getClassAndSec(1, 'Prep', 'A');
  const c3 = getClassAndSec(2, 'Class 9', 'B');
  const c4 = getClassAndSec(3, 'Class 2', 'A');

  const sampleRows = [
    `S-00301,1,Muhammad Rayan,Tariq Mahmood,F-0210,${c1.className},${c1.sectionName},Active,B+,+92 300 1122334,2025-01-10,2016-04-12`,
    `S-00302,2,Areeba Noor,Zahid Hussain,F-0211,${c2.className},${c2.sectionName},Active,O+,+92 301 2233445,2025-02-15,2018-08-23`,
    `S-00303,3,Hamza Farooq,Farooq Azam,F-0212,${c3.className},${c3.sectionName},Active,A+,+92 302 3344556,2024-09-01,2013-11-05`,
    `,,Zainab Bilal,Bilal Ahmed,F-0213,${c4.className},${c4.sectionName},Active,AB+,+92 303 4455667,2025-01-05,2019-02-17`
  ];

  const csvContent = [sampleHeaders, ...sampleRows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'students_bulk_upload_sample.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function parseCSVToStudents(
  csvText: string,
  currentStudentCount: number,
  availableClasses: ClassInfo[] = [],
  existingStudents: Student[] = []
): CSVParseResult {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) {
    return {
      students: [],
      rowNumbers: [],
      hasDobColumn: false,
      errors: ['The CSV file is empty or missing data rows.'],
      totalRows: 0,
      prerequisitePassed: false,
      prerequisiteIssues: [],
      missingClasses: [],
      missingSectionsByClass: {},
      duplicateIdsInFile: [],
      existingStudentIdConflicts: []
    };
  }

  // Parse CSV line handling quotes
  const parseLine = (text: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        if (inQuotes && text[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headerRow = parseLine(lines[0]).map(h => h.toLowerCase().replace(/[\s/_-]+/g, ''));

  // Roll No column: a dedicated roll column feeds the student's rollNo —
  // but ONLY when the file also has its own Student ID column. Historically
  // a lone "Roll No" column was read as the student ID (the import had no
  // roll field), and files built that way must keep parsing identically:
  // in that case the column stays the ID source and rolls are left to the
  // per-class auto-assignment at import time (utils/rollNumber.ts).
  const idColumnIndex = headerRow.findIndex(h => h.includes('studentid') || h === 'id');
  const rollColumnIndex = headerRow.findIndex(h => h === 'rollno' || h === 'rollnumber' || h === 'roll');
  const effectiveIdIndex = idColumnIndex !== -1 ? idColumnIndex : rollColumnIndex;

  // Determine column indexes
  const colIndex = {
    id: effectiveIdIndex,
    rollNo: rollColumnIndex !== -1 && rollColumnIndex !== effectiveIdIndex ? rollColumnIndex : -1,
    name: headerRow.findIndex(h => h.includes('studentname') || h === 'name' || h.includes('fullname')),
    family: headerRow.findIndex(h => h.includes('family') || h.includes('guardian') || h.includes('father')),
    familyId: headerRow.findIndex(h => h.includes('familyid') || h.includes('fcode') || h.includes('fid')),
    class: headerRow.findIndex(h => h.includes('class') || h.includes('grade')),
    section: headerRow.findIndex(h => h.includes('section') || h.includes('sec')),
    status: headerRow.findIndex(h => h.includes('status')),
    bloodGroup: headerRow.findIndex(h => h.includes('blood') || h.includes('bg')),
    phone: headerRow.findIndex(h => h.includes('phone') || h.includes('contact') || h.includes('mobile')),
    // 'admissiondate' itself contains 'date', so match the admission column
    // before the DOB column ('dateofbirth' / 'dob') claims the generic terms.
    admissionDate: headerRow.findIndex(h => h.includes('admission')),
    dob: headerRow.findIndex(h => h === 'dob' || h.includes('dateofbirth') || h.includes('birthdate') || h.includes('birth'))
  };
  const hasDobColumn = colIndex.dob !== -1;
  if (colIndex.admissionDate === -1) {
    colIndex.admissionDate = headerRow.findIndex((h, idx) => idx !== colIndex.dob && h.includes('date'));
  }

  // Build map of existing system classes (lowercase -> ClassInfo)
  const classLookup = new Map<string, ClassInfo>();
  availableClasses.forEach(cls => {
    classLookup.set(cls.name.trim().toLowerCase(), cls);
  });

  // Build map of existing student IDs in system
  const existingIdMap = new Map<string, string>();
  existingStudents.forEach(s => {
    existingIdMap.set(s.id.trim().toLowerCase(), s.name);
  });

  const parsedStudents: Student[] = [];
  const parsedRowNumbers: number[] = [];
  const errors: string[] = [];
  const prerequisiteIssues: CSVPrerequisiteIssue[] = [];
  const missingClassesSet = new Set<string>();
  const missingSectionsByClass: Record<string, string[]> = {};
  const seenIdsInFile = new Map<string, number>();
  const duplicateIdsSet = new Set<string>();
  const existingStudentIdConflicts: { rowNumber: number; studentName: string; studentId: string; existingStudentName: string }[] = [];

  let autoIdCounter = currentStudentCount + 101;

  for (let i = 1; i < lines.length; i++) {
    const rowNumber = i + 1;
    const cells = parseLine(lines[i]);
    if (cells.length === 0 || (cells.length === 1 && !cells[0])) continue;

    const rawName = (colIndex.name !== -1 ? cells[colIndex.name] : cells[1] || cells[0]) || '';
    const name = rawName.trim();
    if (!name) {
      errors.push(`Row ${rowNumber}: Student Name is empty.`);
      prerequisiteIssues.push({
        rowNumber,
        studentName: '(Empty Name)',
        studentId: (colIndex.id !== -1 ? cells[colIndex.id] : cells[0])?.trim() || 'N/A',
        type: 'missing_required_field',
        message: `Row ${rowNumber}: Required field "Student Name" is missing.`
      });
      continue;
    }

    let id = colIndex.id !== -1 ? cells[colIndex.id] : cells[0];
    if (!id || !id.trim()) {
      let candId = `S-${String(autoIdCounter++).padStart(5, '0')}`;
      while (existingIdMap.has(candId.toLowerCase()) || seenIdsInFile.has(candId.toLowerCase())) {
        candId = `S-${String(autoIdCounter++).padStart(5, '0')}`;
      }
      id = candId;
    } else {
      id = id.trim();
    }

    // Check duplicate ID within the uploaded CSV itself
    const idLower = id.toLowerCase();
    if (seenIdsInFile.has(idLower)) {
      const prevRow = seenIdsInFile.get(idLower)!;
      duplicateIdsSet.add(id);
      prerequisiteIssues.push({
        rowNumber,
        studentName: name,
        studentId: id,
        type: 'duplicate_id',
        message: `Row ${rowNumber}: Student "${name}" has duplicate Student ID "${id}" (already used in Row ${prevRow} of this CSV).`
      });
    } else {
      seenIdsInFile.set(idLower, rowNumber);
    }

    // Check if ID conflicts with an already-enrolled student in the system
    if (existingIdMap.has(idLower)) {
      existingStudentIdConflicts.push({
        rowNumber,
        studentName: name,
        studentId: id,
        existingStudentName: existingIdMap.get(idLower)!
      });
    }

    const rawClass = (colIndex.class !== -1 ? cells[colIndex.class] : cells[4]) || '';
    const studentClassInput = rawClass.trim();

    const rawSection = (colIndex.section !== -1 ? cells[colIndex.section] : cells[5]) || '';
    const studentSectionInput = rawSection.trim();

    if (!studentClassInput) {
      prerequisiteIssues.push({
        rowNumber,
        studentName: name,
        studentId: id,
        type: 'missing_required_field',
        message: `Row ${rowNumber}: Student "${name}" is missing a Class value in the CSV file.`
      });
    } else {
      const matchedClass = classLookup.get(studentClassInput.toLowerCase());
      if (!matchedClass) {
        missingClassesSet.add(studentClassInput);
        if (studentSectionInput) {
          const secUpper = studentSectionInput.toUpperCase();
          if (!missingSectionsByClass[studentClassInput]) {
            missingSectionsByClass[studentClassInput] = [];
          }
          if (!missingSectionsByClass[studentClassInput].includes(secUpper)) {
            missingSectionsByClass[studentClassInput].push(secUpper);
          }
        }
        prerequisiteIssues.push({
          rowNumber,
          studentName: name,
          studentId: id,
          type: 'missing_class',
          targetClass: studentClassInput,
          targetSection: studentSectionInput || 'A',
          message: `Row ${rowNumber}: Student "${name}" belongs to Class "${studentClassInput}", but Class "${studentClassInput}" does not exist in the system.`
        });
      } else {
        // Class exists! Validate that the section also exists in this class
        const classSections = matchedClass.sections || [];
        const targetSec = studentSectionInput || (classSections[0] || '');
        if (!targetSec) {
          prerequisiteIssues.push({
            rowNumber,
            studentName: name,
            studentId: id,
            type: 'missing_section',
            targetClass: matchedClass.name,
            targetSection: '(None)',
            availableSectionsForClass: classSections,
            message: `Row ${rowNumber}: Student "${name}" belongs to Class "${matchedClass.name}", which has no sections configured.`
          });
        } else {
          const matchedSec = classSections.find(
            s => s.trim().toLowerCase() === targetSec.toLowerCase()
          );
          if (!matchedSec) {
            if (!missingSectionsByClass[matchedClass.name]) {
              missingSectionsByClass[matchedClass.name] = [];
            }
            const secUpper = targetSec.toUpperCase();
            if (!missingSectionsByClass[matchedClass.name].includes(secUpper)) {
              missingSectionsByClass[matchedClass.name].push(secUpper);
            }
            prerequisiteIssues.push({
              rowNumber,
              studentName: name,
              studentId: id,
              type: 'missing_section',
              targetClass: matchedClass.name,
              targetSection: secUpper,
              availableSectionsForClass: classSections,
              message: `Row ${rowNumber}: Student "${name}" is assigned to "${matchedClass.name}" - Section "${secUpper}", but Section "${secUpper}" does not exist in "${matchedClass.name}" (Available: ${classSections.length > 0 ? classSections.join(', ') : 'None'}).`
            });
          }
        }
      }
    }

    const matchedClassObj = classLookup.get(studentClassInput.toLowerCase());
    const finalClassName = matchedClassObj ? matchedClassObj.name : studentClassInput;
    const matchedSectionName = matchedClassObj?.sections?.find(
      s => s.trim().toLowerCase() === (studentSectionInput || matchedClassObj.sections[0] || '').toLowerCase()
    ) || studentSectionInput.toUpperCase() || 'A';

    // Blank in → blank stored (owner rule, 2026-11-08): a row with no
    // guardian/family cell imports with an EMPTY family name — the old
    // `|| 'Guardian'` stored the literal word 'Guardian' as the father's
    // name on every such student.
    const family = (colIndex.family !== -1 ? cells[colIndex.family] : cells[2]) || '';
    const familyId = (colIndex.familyId !== -1 ? cells[colIndex.familyId] : (cells[3] || `F-${String(autoIdCounter).padStart(4, '0')}`)) || `F-${String(autoIdCounter).padStart(4, '0')}`;

    const rawStatus = colIndex.status !== -1 ? cells[colIndex.status] : (cells[6] || 'Active');
    const status = (rawStatus || '').toLowerCase().includes('inact') ? 'Inactive' : 'Active';

    const bloodGroup = colIndex.bloodGroup !== -1 ? cells[colIndex.bloodGroup] : cells[7];
    const phone = colIndex.phone !== -1 ? cells[colIndex.phone] : cells[8];
    const admissionDate = colIndex.admissionDate !== -1 ? cells[colIndex.admissionDate] : cells[9];
    // The file's own roll for this student (kept verbatim at import); a
    // blank cell stays unset and the import auto-assigns the class's next
    // roll instead (utils/rollNumber.ts).
    const rollNo = colIndex.rollNo !== -1 ? (cells[colIndex.rollNo] || '').trim() : '';

    // Date of Birth: only enforced when the file actually has a DOB column
    // (files built from the sample template do). A blank or unreadable DOB
    // is a plain per-row problem — the import plan skips the row, it never
    // invents a date.
    let dob: string | undefined;
    if (hasDobColumn) {
      const rawDob = (cells[colIndex.dob] || '').trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(rawDob)) {
        dob = rawDob;
      } else if (rawDob && !Number.isNaN(Date.parse(rawDob))) {
        dob = new Date(Date.parse(rawDob)).toISOString().slice(0, 10);
      }
      if (!dob) {
        prerequisiteIssues.push({
          rowNumber,
          studentName: name,
          studentId: id,
          type: 'missing_required_field',
          message: `Row ${rowNumber}: Student "${name}" is missing a valid Date of Birth.`
        });
      }
    }

    parsedStudents.push({
      id,
      name,
      family: family.trim(),
      familyId: familyId.trim(),
      class: finalClassName,
      section: matchedSectionName,
      status,
      // No invented default: a blank blood group stays blank (the add-student
      // form rework removed the same fabricated 'B+' pre-fill there).
      bloodGroup: bloodGroup?.trim() || undefined,
      phone: phone?.trim() || '',
      admissionDate: admissionDate?.trim() || new Date().toISOString().slice(0, 10),
      ...(dob ? { dob } : {}),
      ...(rollNo ? { rollNo } : {}),
      isNewAdmission: true
    });
    parsedRowNumbers.push(rowNumber);
  }

  const missingClasses = Array.from(missingClassesSet);
  const duplicateIdsInFile = Array.from(duplicateIdsSet);
  const prerequisitePassed = prerequisiteIssues.length === 0 && parsedStudents.length > 0;

  return {
    students: parsedStudents,
    rowNumbers: parsedRowNumbers,
    hasDobColumn,
    errors,
    totalRows: lines.length - 1,
    prerequisitePassed,
    prerequisiteIssues,
    missingClasses,
    missingSectionsByClass,
    duplicateIdsInFile,
    existingStudentIdConflicts
  };
}

// ============================================================================
// Guided import plan (BulkUploadModal review step)
//
// Turns a raw CSVParseResult into three plain buckets the review screen can
// explain to a non-technical admin:
//   • importableStudents — rows that will be imported. Rows held back ONLY by
//     a missing class/section stay importable: the "Add anyway" path creates
//     those prerequisites first.
//   • skippedRows — rows that will NOT be imported, each with a plain-words
//     reason (blank name, missing class value, missing DOB when the file has
//     a DOB column, duplicate ID inside the file, or — in append mode — an ID
//     that already belongs to an enrolled student). "Add anyway" never forces
//     these in.
//   • prerequisites — the class/section creations the importable rows need:
//     brand-new classes (with the sections the file names for them) and extra
//     sections for classes that already exist.
// Prerequisites are recomputed from the importable rows only, so a class
// named solely by a skipped row is never created for nothing.
// ============================================================================

export interface ImportSkippedRow {
  rowNumber: number;
  studentName: string;
  studentId: string;
  reason: string;
}

export interface StudentImportPlan {
  totalRows: number;
  hasDobColumn: boolean;
  importableStudents: Student[];
  /** CSV row number for each entry in `importableStudents`, same order. */
  importableRowNumbers: number[];
  skippedRows: ImportSkippedRow[];
  /** Names of classes that must be created (file order). */
  missingClassNames: string[];
  /** Sections each new class should be created with, keyed by class name. */
  sectionsForNewClasses: Record<string, string[]>;
  /** Extra sections to add to classes that already exist. */
  sectionsToAdd: { className: string; sections: string[] }[];
}

const plainReasonForIssue = (issue: CSVPrerequisiteIssue): string => {
  if (issue.type === 'duplicate_id') {
    return issue.message.replace(/^Row \d+:\s*/, '') + ' This row will be skipped — give the student a different ID in the file.';
  }
  if (/student name/i.test(issue.message)) return 'The student name is blank in this row.';
  if (/class value/i.test(issue.message)) return 'No class is written for this student in the file.';
  if (/date of birth/i.test(issue.message)) return 'Date of Birth is missing or unreadable.';
  return issue.message.replace(/^Row \d+:\s*/, '');
};

export function buildStudentImportPlan(
  result: CSVParseResult,
  availableClasses: ClassInfo[] = [],
  mode: 'append' | 'replace' = 'append'
): StudentImportPlan {
  // 1. Rows that can never be imported, with a plain reason each.
  const skippedByRow = new Map<number, ImportSkippedRow>();
  const addSkip = (row: ImportSkippedRow) => {
    if (!skippedByRow.has(row.rowNumber)) skippedByRow.set(row.rowNumber, row);
  };

  result.prerequisiteIssues.forEach(issue => {
    if (issue.type === 'missing_required_field' || issue.type === 'duplicate_id') {
      addSkip({
        rowNumber: issue.rowNumber,
        studentName: issue.studentName,
        studentId: issue.studentId,
        reason: plainReasonForIssue(issue)
      });
    }
  });

  // An ID that already belongs to an enrolled student only blocks the row
  // when appending — in replace mode the old registry is being replaced.
  if (mode === 'append') {
    result.existingStudentIdConflicts.forEach(conf => {
      addSkip({
        rowNumber: conf.rowNumber,
        studentName: conf.studentName,
        studentId: conf.studentId,
        reason: `Student ID "${conf.studentId}" already belongs to ${conf.existingStudentName} in the system, so this row will be skipped. Give the student a different ID in the file, or use "Replace all records".`
      });
    });
  }

  // 2. Everything else is importable (missing class/section rows included —
  //    those are prerequisites, not row faults).
  const importableStudents: Student[] = [];
  const importableRowNumbers: number[] = [];
  result.students.forEach((student, idx) => {
    const rowNumber = result.rowNumbers[idx];
    if (rowNumber !== undefined && skippedByRow.has(rowNumber)) return;
    importableStudents.push(student);
    importableRowNumbers.push(rowNumber ?? idx + 2);
  });

  // 3. Prerequisites the importable rows need.
  const classLookup = new Map<string, ClassInfo>();
  availableClasses.forEach(cls => classLookup.set(cls.name.trim().toLowerCase(), cls));

  const missingClassNames: string[] = [];
  const sectionsForNewClasses: Record<string, string[]> = {};
  const sectionsToAddMap = new Map<string, { className: string; sections: string[] }>();

  const noteSection = (record: Record<string, string[]>, key: string, section: string) => {
    if (!section) return;
    if (!record[key]) record[key] = [];
    if (!record[key].some(s => s.toLowerCase() === section.toLowerCase())) record[key].push(section);
  };

  importableStudents.forEach(student => {
    const className = (student.class || '').trim();
    if (!className) return; // class-less rows were already skipped above
    const section = (student.section || '').trim();
    const existing = classLookup.get(className.toLowerCase());
    if (!existing) {
      if (!missingClassNames.some(n => n.toLowerCase() === className.toLowerCase())) {
        missingClassNames.push(className);
      }
      noteSection(sectionsForNewClasses, className, section);
    } else if (section && !(existing.sections || []).some(s => s.trim().toLowerCase() === section.toLowerCase())) {
      const key = existing.name.toLowerCase();
      if (!sectionsToAddMap.has(key)) sectionsToAddMap.set(key, { className: existing.name, sections: [] });
      const entry = sectionsToAddMap.get(key)!;
      if (!entry.sections.some(s => s.toLowerCase() === section.toLowerCase())) entry.sections.push(section);
    }
  });

  return {
    totalRows: result.totalRows,
    hasDobColumn: result.hasDobColumn,
    importableStudents,
    importableRowNumbers,
    skippedRows: Array.from(skippedByRow.values()).sort((a, b) => a.rowNumber - b.rowNumber),
    missingClassNames,
    sectionsForNewClasses,
    sectionsToAdd: Array.from(sectionsToAddMap.values())
  };
}

/**
 * Builds a ClassInfo record for a class the CSV import auto-creates on the
 * "Add anyway" path. Mirrors the manual Add Class path in ClassesModule
 * (same ID style, real creation date, current session from settings) with
 * one deliberate difference: `fee` is left UNSET. The manual form requires
 * the admin to type a fee; an automatic creation must never invent one —
 * everywhere in the app an unset fee reads honestly as "Fee not set"
 * (see resolveClassFee) until the admin sets it in the Classes section.
 */
export function createClassRecordForImport(name: string, sections: string[] = [], batchIndex = 0): ClassInfo {
  const trimmedName = name.trim();
  const sectionsToSave = sections.length > 0 ? sections : ['A'];
  const createdNow = new Date();
  const createdAtStr = createdNow.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return {
    id: `CLS-${Date.now().toString().slice(-4)}${batchIndex > 0 ? `-${batchIndex}` : ''}`,
    name: trimmedName,
    sectionsCount: sectionsToSave.length,
    sections: sectionsToSave,
    // fee: intentionally omitted — "Fee not set" (see docblock above).
    // No studentsCount (Fix P0-1): enrollment is computed live everywhere.
    createdAt: createdAtStr,
    latestSession: getSchoolSettings().session
  };
}

/** Returns a copy of an existing class with extra sections appended. */
export function withSectionsAddedToClass(cls: ClassInfo, sectionsToAdd: string[]): ClassInfo {
  const merged = [...(cls.sections || [])];
  sectionsToAdd.forEach(sec => {
    if (sec && !merged.some(s => s.trim().toLowerCase() === sec.trim().toLowerCase())) merged.push(sec);
  });
  return { ...cls, sections: merged, sectionsCount: merged.length };
}
