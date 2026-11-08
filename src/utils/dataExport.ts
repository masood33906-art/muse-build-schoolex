// Data Export (owner-approved portability feature, 2026-11-08): one click
// in Settings downloads ONE ZIP of plain files so a school can read,
// migrate, or leave SchoolEx with ALL of its data — no proprietary format
// anywhere:
//   students.csv, staff.csv, classes.csv, fee-ledger.csv,
//   fee-payments.csv, ledger.csv, attendance.csv  (Excel-friendly CSVs)
//   schoolex-export.json                          (the LOSSLESS copy)
//   README.txt                                    (plain-English guide)
//
// Everything here reads through the SAME live sources the app itself uses
// (the storage/collections layer + the payroll API), so the export always
// equals what the system shows. This module is the single builder: the
// Settings button calls downloadDataExport(), and the proof
// (proof-data-export.mts) imports buildDataExportZip() — no second copy
// of the logic exists.
//
// CSV conventions: UTF-8 with BOM (so Excel renders non-English names
// correctly), CRLF line endings, RFC-4180 quoting (a field containing a
// comma, quote, or newline is wrapped in double quotes and its internal
// quotes are doubled). Values that are arrays/objects are JSON-encoded
// into their cell (documented per file in README.txt). Photos are NOT
// embedded in the CSVs (a base64 photo cell would be unusable in Excel);
// a hasPhoto column flags their presence and the JSON copy carries them
// verbatim.
import { zipSync, strToU8 } from 'fflate';
import { loadJSON } from './storage';
import { localISODate } from './dates';
import { SETTINGS_STORAGE_KEY } from './settingsHelper';
import { STUDENT_LEDGER_STORAGE_KEY } from './studentFeeLedgerHelper';
import type { StudentFeeItem } from './studentFeeLedgerHelper';
import { FEE_PAYMENTS_KEY } from './paymentStore';
import type { FeePayment } from './paymentStore';
import { LEDGER_TX_KEY } from './ledgerStore';
import type { LedgerTransaction } from './ledgerStore';
import { ATTENDANCE_STORAGE_KEY } from './attendanceHelper';
import { STAFF_STORAGE_KEY } from './payrollService';
import { exportPayroll } from './payrollApi';
import type { PayrollExport } from './payrollApi';
import type { Student, StaffMember, ClassInfo, AttendanceRecord } from '../types';

// Matches package.json "version".
export const APP_VERSION = '1.0.0';

// Storage keys for the two collections whose constants live privately in
// App.tsx (kept in sync with it — these key strings ARE the on-disk
// format, they never change).
export const STUDENT_STORAGE_KEY = 'schoollee_offline_students_clean_v1';
export const CLASSES_STORAGE_KEY = 'schoollee_classes_clean_v1';

const isRecordArray = (v: unknown): boolean => Array.isArray(v);
const isRecordMap = (v: unknown): boolean => typeof v === 'object' && v !== null && !Array.isArray(v);

// ---------------------------------------------------------------------------
// CSV stringifier — the ONE stringifier used by every CSV in the ZIP.
// ---------------------------------------------------------------------------
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s: string;
  if (typeof value === 'string') s = value;
  else if (typeof value === 'number' || typeof value === 'boolean') s = String(value);
  else s = JSON.stringify(value) ?? '';
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const lines = [columns.map(csvCell).join(',')];
  for (const row of rows) lines.push(columns.map(c => csvCell(row[c])).join(','));
  return '\uFEFF' + lines.join('\r\n') + '\r\n'; // \uFEFF = UTF-8 BOM, so Excel reads non-English names correctly
}

// ---------------------------------------------------------------------------
// Column sets + row builders (sources: src/types.ts models, enumerated in
// full; nested lists are JSON-encoded into their cell).
// ---------------------------------------------------------------------------
export const STUDENT_COLUMNS = [
  'id', 'name', 'gender', 'dob', 'class', 'classId', 'section', 'rollNo', 'status',
  'admissionDate', 'isNewAdmission', 'phone', 'emergencyContact', 'whatsapp', 'email',
  'address', 'bloodGroup', 'religion', 'caste', 'cnic',
  'family', 'familyId', 'fatherName', 'guardianCnic', 'guardianOccupation',
  'motherName', 'motherCnic', 'motherOccupation',
  'previousSchool', 'previousClass', 'previousResult', 'reference',
  'discount', 'admissionFee', 'classFee', 'note', 'avatarColor', 'hasPhoto',
  'totalDue', 'totalPaid', 'finesList', 'documentsList', 'observationsList', 'achievementsList',
];

export function studentRow(s: Student): Record<string, unknown> {
  return {
    id: s.id, name: s.name, gender: s.gender, dob: s.dob, class: s.class, classId: s.classId,
    section: s.section, rollNo: s.rollNo, status: s.status, admissionDate: s.admissionDate,
    isNewAdmission: s.isNewAdmission, phone: s.phone, emergencyContact: s.emergencyContact,
    whatsapp: s.whatsapp, email: s.email, address: s.address, bloodGroup: s.bloodGroup,
    religion: s.religion, caste: s.caste, cnic: s.cnic,
    family: s.family, familyId: s.familyId, fatherName: s.fatherName,
    guardianCnic: s.guardianCnic, guardianOccupation: s.guardianOccupation,
    motherName: s.motherName, motherCnic: s.motherCnic, motherOccupation: s.motherOccupation,
    previousSchool: s.previousSchool, previousClass: s.previousClass, previousResult: s.previousResult,
    reference: s.reference, discount: s.discount, admissionFee: s.admissionFee, classFee: s.classFee,
    note: s.note, avatarColor: s.avatarColor, hasPhoto: s.photo ? 'yes' : '',
    totalDue: s.totalDue, totalPaid: s.totalPaid,
    finesList: s.finesList, documentsList: s.documentsList,
    observationsList: s.observationsList, achievementsList: s.achievementsList,
  };
}

export const STAFF_COLUMNS = [
  'id', 'name', 'cnic', 'fatherName', 'role', 'category', 'department', 'qualification',
  'salary', 'payStatus', 'lastPaidDate', 'paymentMethod', 'status',
  'phone', 'whatsapp', 'email', 'joiningDate', 'gender', 'bloodGroup',
  'emergencyContact', 'address', 'bankAccount', 'notes', 'loanBalance',
  'avatarColor', 'hasPhoto', 'paidMonths', 'documents', 'activities', 'transactions',
];

export function staffRow(s: StaffMember): Record<string, unknown> {
  return {
    id: s.id, name: s.name, cnic: s.cnic, fatherName: s.fatherName,
    role: s.role, category: s.category, department: s.department, qualification: s.qualification,
    salary: s.salary, payStatus: s.payStatus, lastPaidDate: s.lastPaidDate,
    paymentMethod: s.paymentMethod, status: s.status, phone: s.phone, whatsapp: s.whatsapp,
    email: s.email, joiningDate: s.joiningDate, gender: s.gender, bloodGroup: s.bloodGroup,
    emergencyContact: s.emergencyContact, address: s.address, bankAccount: s.bankAccount,
    notes: s.notes, loanBalance: s.loanBalance, avatarColor: s.avatarColor,
    hasPhoto: s.photo ? 'yes' : '',
    paidMonths: s.paidMonths, documents: s.documents, activities: s.activities, transactions: s.transactions,
  };
}

export const CLASS_COLUMNS = ['id', 'name', 'sectionsCount', 'sections', 'fee', 'studentsCount', 'createdAt', 'latestSession', 'timeline'];

export function classRow(c: ClassInfo): Record<string, unknown> {
  return {
    id: c.id, name: c.name, sectionsCount: c.sectionsCount,
    sections: Array.isArray(c.sections) ? c.sections.join('; ') : '',
    fee: c.fee, studentsCount: c.studentsCount, createdAt: c.createdAt,
    latestSession: c.latestSession, timeline: c.timeline,
  };
}

// StudentFeeItem carries no dueDate in the model — nothing to export there.
export const FEE_LEDGER_COLUMNS = [
  'studentId', 'studentName', 'itemId', 'month', 'monthKey', 'type', 'reason',
  'classFeeRate', 'discount', 'additionalDiscount', 'charged', 'paidAmount', 'balance',
  'status', 'isAdvance', 'generatedAt',
];

export function feeLedgerRows(
  ledger: Record<string, StudentFeeItem[]>, studentsById: Map<string, Student>,
): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  for (const [studentId, items] of Object.entries(ledger)) {
    for (const it of items ?? []) {
      rows.push({
        studentId, studentName: studentsById.get(studentId)?.name ?? '',
        itemId: it.id, month: it.month, monthKey: it.monthKey, type: it.type, reason: it.reason,
        classFeeRate: it.classFeeRate, discount: it.discount, additionalDiscount: it.additionalDiscount,
        charged: it.total, paidAmount: it.paidAmount, balance: it.total - it.paidAmount,
        status: it.status, isAdvance: it.isAdvance, generatedAt: it.generatedAt,
      });
    }
  }
  return rows;
}

export const FEE_PAYMENT_COLUMNS = [
  'id', 'receiptNo', 'date', 'createdAt', 'familyId', 'studentIds', 'amount', 'method',
  'creditUsed', 'creditAdded', 'note', 'createdBy', 'isMigrated', 'voidedAt', 'voidReason', 'allocations',
];

export function feePaymentRow(p: FeePayment): Record<string, unknown> {
  return {
    id: p.id, receiptNo: p.receiptNo, date: p.date, createdAt: p.createdAt, familyId: p.familyId,
    studentIds: p.studentIds, amount: p.amount, method: p.method,
    creditUsed: p.creditUsed, creditAdded: p.creditAdded, note: p.note, createdBy: p.createdBy,
    isMigrated: p.isMigrated, voidedAt: p.voidedAt, voidReason: p.voidReason, allocations: p.allocations,
  };
}

export const LEDGER_COLUMNS = [
  'id', 'date', 'rawDate', 'time', 'timestamp', 'type', 'category', 'amount',
  'paymentType', 'reason', 'note', 'createdBy', 'document',
];

export function ledgerRow(t: LedgerTransaction): Record<string, unknown> {
  return {
    id: t.id, date: t.date, rawDate: t.rawDate, time: t.time, timestamp: t.timestamp,
    type: t.type, category: t.category, amount: t.amount, paymentType: t.paymentType,
    reason: t.reason, note: t.note, createdBy: t.createdBy, document: t.document,
  };
}

export const ATTENDANCE_COLUMNS = [
  'date', 'id', 'name', 'type', 'status', 'checkInTime', 'remarks', 'class', 'section', 'department', 'role', 'isManual',
];

// Attendance is stored as a map: date (YYYY-MM-DD) -> that day's records.
// Exploded faithfully: one output row per stored record.
export function attendanceRows(map: Record<string, AttendanceRecord[]>): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  for (const [date, records] of Object.entries(map)) {
    for (const r of records ?? []) {
      rows.push({
        date: r.date ?? date, id: r.id, name: r.name, type: r.type, status: r.status,
        checkInTime: r.checkInTime, remarks: r.remarks, class: r.class, section: r.section,
        department: r.department, role: r.role, isManual: r.isManual,
      });
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Loaders — the app's own live sources, nothing else.
// ---------------------------------------------------------------------------
export function loadExportSources() {
  const students = loadJSON<Student[]>(STUDENT_STORAGE_KEY, [], isRecordArray as (v: unknown) => v is Student[]);
  const staff = loadJSON<StaffMember[]>(STAFF_STORAGE_KEY, [], isRecordArray as (v: unknown) => v is StaffMember[]);
  const classes = loadJSON<ClassInfo[]>(CLASSES_STORAGE_KEY, [], isRecordArray as (v: unknown) => v is ClassInfo[]);
  const feeLedger = loadJSON<Record<string, StudentFeeItem[]>>(STUDENT_LEDGER_STORAGE_KEY, {}, isRecordMap as (v: unknown) => v is Record<string, StudentFeeItem[]>);
  const feePayments = loadJSON<FeePayment[]>(FEE_PAYMENTS_KEY, [], isRecordArray as (v: unknown) => v is FeePayment[]);
  const ledger = loadJSON<LedgerTransaction[]>(LEDGER_TX_KEY, [], isRecordArray as (v: unknown) => v is LedgerTransaction[]);
  const attendance = loadJSON<Record<string, AttendanceRecord[]>>(ATTENDANCE_STORAGE_KEY, {}, isRecordMap as (v: unknown) => v is Record<string, AttendanceRecord[]>);
  return { students, staff, classes, feeLedger, feePayments, ledger, attendance };
}

// Every collection exactly as stored (the lossless layer): all app
// localStorage keys, parsed. Quarantined corrupt copies (__corrupt_) and
// pre-purge safety copies (__pre) are not live data and are excluded —
// the same rule the backup builder uses.
const COLLECTION_PREFIXES = ['schoollee_', 'schooliee_'];
export function loadAllCollectionsVerbatim(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (!COLLECTION_PREFIXES.some(p => k.startsWith(p))) continue;
      if (k.includes('__corrupt_') || k.includes('__pre')) continue;
      const raw = localStorage.getItem(k);
      if (raw === null) continue;
      try { out[k] = JSON.parse(raw); } catch { out[k] = raw; }
    }
  } catch { /* storage unavailable: empty export rather than a crash */ }
  return out;
}

function loadStoredSettings(): unknown {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw === null) return null;
    try { return JSON.parse(raw); } catch { return raw; }
  } catch { return null; }
}

export const EXPORT_FILE_NAMES = [
  'students.csv', 'staff.csv', 'classes.csv', 'fee-ledger.csv', 'fee-payments.csv',
  'ledger.csv', 'attendance.csv', 'schoolex-export.json', 'README.txt',
] as const;

export function buildReadme(exportedAt: string): string {
  return [
    'SchoolEx — Complete Data Export',
    `Exported: ${exportedAt}`,
    '',
    'This ZIP contains your whole school\'s data in plain, open formats.',
    'Nothing here needs SchoolEx to open:',
    '',
    '  students.csv       One row per student (name, class, roll number, contacts,',
    '                     guardian details, and more).',
    '  staff.csv          One row per staff member.',
    '  classes.csv        One row per class (sections are joined with "; ").',
    '  fee-ledger.csv     Every fee charge, flattened: one row per charge with the',
    '                     amount charged, the amount paid, and the balance.',
    '  fee-payments.csv   Every fee payment received, with its allocations.',
    '  ledger.csv         Every income/expense entry from the Ledger screen.',
    '  attendance.csv     Attendance flattened: one row per person per day.',
    '  schoolex-export.json  THE COMPLETE COPY. Every collection exactly as the',
    '                     system stores it, plus payroll and settings. This is',
    '                     the file to hand to a developer or another software',
    '                     vendor for a full migration — it loses nothing.',
    '',
    'HOW TO OPEN THE CSV FILES',
    '  Double-click them — they open in Microsoft Excel, Google Sheets, or',
    '  LibreOffice Calc. Each file\'s first row is the column headings.',
    '',
    'NOTES',
    '  - Some CSV cells contain JSON text (for example a student\'s fines list',
    '    or a payment\'s allocations). That is deliberate: those lists do not',
    '    fit a single row/column shape, and the JSON keeps them complete.',
    '  - Photos are not embedded in the CSV files (a photo cell would be',
    '    unusable in a spreadsheet). The hasPhoto column tells you which',
    '    records have one, and schoolex-export.json carries every photo',
    '    exactly as stored.',
    '  - This export is a READ-ONLY copy. Editing these files does not change',
    '    anything inside SchoolEx.',
    '',
    'FULL BACKUP / RESTORE',
    '  For a complete backup you can restore from, use Settings ->',
    '  "Download full backup" inside SchoolEx, or copy the schoolex.db file',
    '  (Settings -> Backup / GET /api/backup) — that file restores the',
    '  entire system exactly as it was. This ZIP is for reading, sharing,',
    '  and migrating your data outside SchoolEx.',
    '',
  ].join('\n');
}

export interface DataExportBundle {
  files: Record<string, string>;
  counts: Record<string, number>;
  exportedAt: string;
}

/** Build every export file (no ZIP yet) from the live sources. */
export async function buildDataExportFiles(): Promise<DataExportBundle> {
  const exportedAt = new Date().toISOString();
  const src = loadExportSources();
  const studentsById = new Map(src.students.map(s => [s.id, s]));
  const feeLedgerCsvRows = feeLedgerRows(src.feeLedger, studentsById);
  const attendanceCsvRows = attendanceRows(src.attendance);

  let payroll: PayrollExport | null = null;
  try { payroll = await exportPayroll(); } catch { payroll = null; }

  const jsonDoc = {
    meta: {
      app: 'schoolex',
      format: 'schoolex-export',
      formatVersion: 1,
      appVersion: APP_VERSION,
      exportedAt,
    },
    collections: loadAllCollectionsVerbatim(),
    payroll,
    settings: loadStoredSettings(),
  };

  const files: Record<string, string> = {
    'students.csv': toCsv(STUDENT_COLUMNS, src.students.map(studentRow)),
    'staff.csv': toCsv(STAFF_COLUMNS, src.staff.map(staffRow)),
    'classes.csv': toCsv(CLASS_COLUMNS, src.classes.map(classRow)),
    'fee-ledger.csv': toCsv(FEE_LEDGER_COLUMNS, feeLedgerCsvRows),
    'fee-payments.csv': toCsv(FEE_PAYMENT_COLUMNS, src.feePayments.map(feePaymentRow)),
    'ledger.csv': toCsv(LEDGER_COLUMNS, src.ledger.map(ledgerRow)),
    'attendance.csv': toCsv(ATTENDANCE_COLUMNS, attendanceCsvRows),
    'schoolex-export.json': JSON.stringify(jsonDoc, null, 2),
    'README.txt': buildReadme(exportedAt),
  };

  return {
    files,
    counts: {
      students: src.students.length,
      staff: src.staff.length,
      classes: src.classes.length,
      feeLedgerItems: feeLedgerCsvRows.length,
      feePayments: src.feePayments.length,
      ledgerTransactions: src.ledger.length,
      attendanceRecords: attendanceCsvRows.length,
    },
    exportedAt,
  };
}

/** Build the ZIP the Settings button downloads. */
export async function buildDataExportZip(): Promise<{ bytes: Uint8Array; bundle: DataExportBundle }> {
  const bundle = await buildDataExportFiles();
  const entries: Record<string, Uint8Array> = {};
  for (const [name, text] of Object.entries(bundle.files)) entries[name] = strToU8(text);
  return { bytes: zipSync(entries), bundle };
}

/** Settings action: build the ZIP and download it as one file. */
export async function downloadDataExport(): Promise<DataExportBundle> {
  const { bytes, bundle } = await buildDataExportZip();
  const blob = new Blob([bytes as BlobPart], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `schoolex-data-export-${localISODate()}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return bundle;
}
