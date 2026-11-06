import { Student, FamilyData, ClassInfo } from '../types';

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
  const sampleHeaders = 'Student ID,Student Name,Family Name,Family ID,Class,Section,Status,Blood Group,Contact Phone,Admission Date';
  
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
    `S-00301,Muhammad Rayan,Tariq Mahmood,F-0210,${c1.className},${c1.sectionName},Active,B+,+92 300 1122334,2025-01-10`,
    `S-00302,Areeba Noor,Zahid Hussain,F-0211,${c2.className},${c2.sectionName},Active,O+,+92 301 2233445,2025-02-15`,
    `S-00303,Hamza Farooq,Farooq Azam,F-0212,${c3.className},${c3.sectionName},Active,A+,+92 302 3344556,2024-09-01`,
    `,Zainab Bilal,Bilal Ahmed,F-0213,${c4.className},${c4.sectionName},Active,AB+,+92 303 4455667,2025-01-05`
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

  // Determine column indexes
  const colIndex = {
    id: headerRow.findIndex(h => h.includes('studentid') || h === 'id' || h === 'rollno'),
    name: headerRow.findIndex(h => h.includes('studentname') || h === 'name' || h.includes('fullname')),
    family: headerRow.findIndex(h => h.includes('family') || h.includes('guardian') || h.includes('father')),
    familyId: headerRow.findIndex(h => h.includes('familyid') || h.includes('fcode') || h.includes('fid')),
    class: headerRow.findIndex(h => h.includes('class') || h.includes('grade')),
    section: headerRow.findIndex(h => h.includes('section') || h.includes('sec')),
    status: headerRow.findIndex(h => h.includes('status')),
    bloodGroup: headerRow.findIndex(h => h.includes('blood') || h.includes('bg')),
    phone: headerRow.findIndex(h => h.includes('phone') || h.includes('contact') || h.includes('mobile')),
    admissionDate: headerRow.findIndex(h => h.includes('admission') || h.includes('date'))
  };

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

    const family = (colIndex.family !== -1 ? cells[colIndex.family] : (cells[2] || 'Guardian')) || 'Guardian';
    const familyId = (colIndex.familyId !== -1 ? cells[colIndex.familyId] : (cells[3] || `F-${String(autoIdCounter).padStart(4, '0')}`)) || `F-${String(autoIdCounter).padStart(4, '0')}`;

    const rawStatus = colIndex.status !== -1 ? cells[colIndex.status] : (cells[6] || 'Active');
    const status = (rawStatus || '').toLowerCase().includes('inact') ? 'Inactive' : 'Active';

    const bloodGroup = colIndex.bloodGroup !== -1 ? cells[colIndex.bloodGroup] : cells[7];
    const phone = colIndex.phone !== -1 ? cells[colIndex.phone] : cells[8];
    const admissionDate = colIndex.admissionDate !== -1 ? cells[colIndex.admissionDate] : cells[9];

    parsedStudents.push({
      id,
      name,
      family: family.trim(),
      familyId: familyId.trim(),
      class: finalClassName,
      section: matchedSectionName,
      status,
      bloodGroup: bloodGroup?.trim() || 'B+',
      phone: phone?.trim() || '',
      admissionDate: admissionDate?.trim() || new Date().toISOString().slice(0, 10),
      isNewAdmission: true
    });
  }

  const missingClasses = Array.from(missingClassesSet);
  const duplicateIdsInFile = Array.from(duplicateIdsSet);
  const prerequisitePassed = prerequisiteIssues.length === 0 && parsedStudents.length > 0;

  return {
    students: parsedStudents,
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
