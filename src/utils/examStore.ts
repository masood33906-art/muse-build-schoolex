import { SchoolSettings, getSchoolSettings } from './settingsHelper';
import { DEMO, loadJSON, saveJSON } from './storage';

export interface ExamSubject {
  id: string;
  name: string;
  startDate?: string;
  totalMarks: number; // e.g. 100
  passingMarks: number; // e.g. 33
}

export interface StudentMarkEntry {
  studentId: string;
  studentName: string;
  rollNo?: string;
  fatherName?: string;
  marks: Record<string, number | null>; // subjectId -> obtained marks
  remarks?: string;
}

export interface ExamGradingTier {
  grade: string;
  minPercentage: number;
  color: string;
  bgColor: string;
  textColor: string;
}

export interface Exam {
  id: string;
  name: string;
  class: string;
  section: string;
  subjects: ExamSubject[];
  tags: string[];
  createdAt: string; // e.g. '15 Sep 2026'
  createdTimestamp: number;
  createdBy: string;
  resultsCount: number;
  studentMarks: Record<string, StudentMarkEntry>;
  gradingSchema: ExamGradingTier[];
}

export interface ExamFilterState {
  search: string;
  class: string;
  section: string;
  subject: string;
  tag: string;
  dateRange: string;
}

export const DEFAULT_GRADING_SCHEMA: ExamGradingTier[] = [
  { grade: 'A+', minPercentage: 90, color: '#10b981', bgColor: 'bg-emerald-500/10', textColor: 'text-emerald-400' },
  { grade: 'A', minPercentage: 80, color: '#22c55e', bgColor: 'bg-green-500/10', textColor: 'text-green-400' },
  { grade: 'B+', minPercentage: 70, color: '#3b82f6', bgColor: 'bg-blue-500/10', textColor: 'text-blue-400' },
  { grade: 'B', minPercentage: 60, color: '#06b6d4', bgColor: 'bg-cyan-500/10', textColor: 'text-cyan-400' },
  { grade: 'C+', minPercentage: 50, color: '#eab308', bgColor: 'bg-yellow-500/10', textColor: 'text-yellow-400' },
  { grade: 'C', minPercentage: 40, color: '#f59e0b', bgColor: 'bg-amber-500/10', textColor: 'text-amber-400' },
  { grade: 'D', minPercentage: 33, color: '#f97316', bgColor: 'bg-orange-500/10', textColor: 'text-orange-400' },
  { grade: 'E', minPercentage: 0, color: '#ef4444', bgColor: 'bg-red-500/10', textColor: 'text-red-400' }
];

export const INITIAL_EXAMS: Exam[] = [];

export const ARCHIVED_INITIAL_EXAMS: Exam[] = [
  {
    id: 'EXAM-001',
    name: '1st Term',
    class: 'Class 1',
    section: 'A',
    subjects: [
      { id: 'SUB-1', name: 'MATH', startDate: '2026-09-18', totalMarks: 100, passingMarks: 33 },
      { id: 'SUB-2', name: 'ENGLISH', startDate: '2026-09-19', totalMarks: 100, passingMarks: 33 }
    ],
    tags: [],
    createdAt: '15 Sep 2026',
    createdTimestamp: new Date('2026-09-15').getTime(),
    createdBy: 'Demo school',
    resultsCount: 2,
    gradingSchema: DEFAULT_GRADING_SCHEMA,
    studentMarks: {
      'S-0179': {
        studentId: 'S-0179',
        studentName: 'Ali',
        rollNo: '01',
        fatherName: 'Ahsan',
        marks: { 'SUB-1': 88, 'SUB-2': 92 },
        remarks: 'Excellent performance'
      },
      'S-0082': {
        studentId: 'S-0082',
        studentName: 'numan',
        rollNo: '02',
        fatherName: 'Ahmad Khan',
        marks: { 'SUB-1': 74, 'SUB-2': 81 },
        remarks: 'Good effort'
      }
    }
  },
  {
    id: 'EXAM-002',
    name: 'final',
    class: 'Prep',
    section: 'A',
    subjects: [
      { id: 'SUB-201', name: 'english', startDate: '2026-09-20', totalMarks: 100, passingMarks: 33 },
      { id: 'SUB-202', name: 'urdu', startDate: '2026-09-21', totalMarks: 100, passingMarks: 33 },
      { id: 'SUB-203', name: 'ist', startDate: '2026-09-22', totalMarks: 50, passingMarks: 17 }
    ],
    tags: [],
    createdAt: '14 Sep 2026',
    createdTimestamp: new Date('2026-09-14').getTime(),
    createdBy: 'Demo school',
    resultsCount: 2,
    gradingSchema: DEFAULT_GRADING_SCHEMA,
    studentMarks: {
      'S0087': {
        studentId: 'S0087',
        studentName: 'Amna',
        rollNo: '01',
        fatherName: 'Tariq Ali',
        marks: { 'SUB-201': 94, 'SUB-202': 88, 'SUB-203': 46 },
        remarks: 'Outstanding'
      },
      'S0076': {
        studentId: 'S0076',
        studentName: 'Fiza',
        rollNo: '02',
        fatherName: 'Ali Raza',
        marks: { 'SUB-201': 78, 'SUB-202': 82, 'SUB-203': 39 },
        remarks: 'Keep it up'
      }
    }
  },
  {
    id: 'EXAM-003',
    name: 'first exam',
    class: 'Prep',
    section: 'A',
    subjects: [
      { id: 'SUB-301', name: 'english', startDate: '2026-09-10', totalMarks: 100, passingMarks: 33 },
      { id: 'SUB-302', name: 'urdu', startDate: '2026-09-11', totalMarks: 100, passingMarks: 33 }
    ],
    tags: [],
    createdAt: '08 Sep 2026',
    createdTimestamp: new Date('2026-09-08').getTime(),
    createdBy: 'Demo school',
    resultsCount: 1,
    gradingSchema: DEFAULT_GRADING_SCHEMA,
    studentMarks: {
      'S0087': {
        studentId: 'S0087',
        studentName: 'Amna',
        rollNo: '01',
        fatherName: 'Tariq Ali',
        marks: { 'SUB-301': 89, 'SUB-302': 91 }
      }
    }
  },
  {
    id: 'EXAM-004',
    name: 'new exam',
    class: 'Class 1',
    section: 'A',
    subjects: [
      { id: 'SUB-401', name: 'english', startDate: '2026-09-12', totalMarks: 100, passingMarks: 33 },
      { id: 'SUB-402', name: 'urdu', startDate: '2026-09-13', totalMarks: 100, passingMarks: 33 }
    ],
    tags: [],
    createdAt: '08 Sep 2026',
    createdTimestamp: new Date('2026-09-08').getTime(),
    createdBy: 'Demo school',
    resultsCount: 1,
    gradingSchema: DEFAULT_GRADING_SCHEMA,
    studentMarks: {
      'S-0179': {
        studentId: 'S-0179',
        studentName: 'Ali',
        rollNo: '01',
        fatherName: 'Ahsan',
        marks: { 'SUB-401': 85, 'SUB-402': 80 }
      }
    }
  }
];

const EXAMS_STORAGE_KEY = 'schoollee_exams_clean_v1';

export function getStoredExams(): Exam[] {
  let raw: string | null = null;
  try { raw = localStorage.getItem(EXAMS_STORAGE_KEY); } catch { /* ignore */ }
  if (!raw) {
    if (DEMO) {
      saveJSON(EXAMS_STORAGE_KEY, INITIAL_EXAMS);
      return INITIAL_EXAMS;
    }
    return [];
  }
  return loadJSON<Exam[]>(
    EXAMS_STORAGE_KEY,
    DEMO ? INITIAL_EXAMS : [],
    Array.isArray as (v: unknown) => v is Exam[]
  );
}

export function saveStoredExams(exams: Exam[]): void {
  if (saveJSON(EXAMS_STORAGE_KEY, exams)) {
    window.dispatchEvent(new CustomEvent('schoollee-exams-updated', { detail: exams }));
  }
}

export function calculateGrade(percentage: number, schema: ExamGradingTier[] = DEFAULT_GRADING_SCHEMA): ExamGradingTier {
  for (const tier of schema) {
    if (percentage >= tier.minPercentage) {
      return tier;
    }
  }
  return schema[schema.length - 1] || {
    grade: 'F',
    minPercentage: 0,
    color: '#ef4444',
    bgColor: 'bg-red-500/10',
    textColor: 'text-red-400'
  };
}

export function downloadCSV(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
