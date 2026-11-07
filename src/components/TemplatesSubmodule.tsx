import React, { useState, useEffect } from 'react';
import { 
  Download, 
  Printer, 
  ExternalLink,
  Barcode, 
  QrCode, 
  CheckCircle2,
  Palette
} from 'lucide-react';
import { Student, StaffMember, ClassInfo, AttendanceRecord } from '../types';
import { 
  SchoolSettings, 
  getSchoolSettings, 
  saveSchoolSettings
} from '../utils/settingsHelper';
import { Exam, getStoredExams } from '../utils/examStore';
import { generateSingleIdCard, DEFAULT_SCHOOL } from '../utils/pdfGenerator';
import { rasterizeLogoForPdf } from '../utils/logoRaster';
import { generateSingleStaffIdCard, generateMonthlyIndividualSlipsCombinedPdf, getSalarySlipTheme } from '../utils/staffPdfGenerator';
import { generateSingleRollNumberSlipPDF, RollSlipData } from '../utils/rollSlipPdfGenerator';
import { generateFeeCardPdf, buildStudentFeeCardData, formatOrBlank } from '../utils/feeCardHelper';
import { generateWeeklyAttendancePdf, getWeekDays, calculateWeeklyAttendance, loadAttendance } from '../utils/attendanceHelper';
import { localISODate } from '../utils/dates';
import { code39Spans } from '../utils/barcode';
import { getStudentAvatar } from '../utils/studentAvatarHelper';

/** Renders a REAL Code 39 barcode (same encoder as the PDF) as flex bars. */
function Code39Bars({ value, className }: { value: string; className?: string }) {
  const { bars, totalUnits } = code39Spans(value || '');
  const total = totalUnits + 10; // quiet zones: 5 units on each side
  const segments: { bar: boolean; units: number }[] = [{ bar: false, units: 5 }];
  let cursor = 0;
  bars.forEach(b => {
    if (b.start > cursor) segments.push({ bar: false, units: b.start - cursor });
    segments.push({ bar: true, units: b.width });
    cursor = b.start + b.width;
  });
  if (totalUnits > cursor) segments.push({ bar: false, units: totalUnits - cursor });
  segments.push({ bar: false, units: 5 });
  return (
    <div className={`flex items-stretch ${className || ''}`} aria-label={`Barcode ${value}`}>
      {segments.map((s, i) => (
        <div key={i} style={{ width: `${(s.units / total) * 100}%` }} className={s.bar ? 'bg-black' : undefined} />
      ))}
    </div>
  );
}

/** Front detail rows for the Vertical Badge: same priority + 4-row cap as the PDF. */
function vbFrontRows(student: Student): { label: string; val: string }[] {
  const rows: { label: string; val: string }[] = [
    { label: 'CLASS', val: `${student.class} - ${student.section}` }
  ];
  if (student.family && student.family.trim()) rows.push({ label: 'GUARDIAN', val: student.family });
  if (student.dob) rows.push({ label: 'DOB', val: student.dob });
  if (student.rollNo) rows.push({ label: 'ROLL NO', val: String(student.rollNo) });
  if (student.phone) rows.push({ label: 'PHONE', val: student.phone });
  if (student.bloodGroup) rows.push({ label: 'BLOOD GROUP', val: student.bloodGroup });
  return rows.slice(0, 4);
}

// Modals for functional use
import { IdCardModal } from './IdCardModal';
import { StaffIdCardModal } from './StaffIdCardModal';
import { RollNumberSlipsModal, MinimalStreamSlipCard } from './RollNumberSlipsModal';
import { FeeChallanModal } from './FeeChallanModal';
import { FeeCardModal } from './FeeCardModal';
import { StaffSalarySlipsModal } from './StaffSalarySlipsModal';
import { ExamDetailExportModal } from './ExamDetailExportModal';
import { AttendanceSheetModal } from './AttendanceSheetModal';

interface TemplatesSubmoduleProps {
  schoolSettings?: SchoolSettings;
  onUpdateSchoolSettings?: (settings: SchoolSettings) => void;
  students?: Student[];
  classes?: ClassInfo[];
  staff?: StaffMember[];
  allAttendance?: Record<string, AttendanceRecord[]>;
  onShowToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

interface TemplateOption {
  id: string;
  label: string;
  description: string;
}

interface DocumentItem {
  id: string;
  name: string;
  format: string;
  settingKey: keyof SchoolSettings;
  templates: TemplateOption[];
}

const DOCUMENTS: DocumentItem[] = [
  { 
    id: 'roll-number-slip', 
    name: 'Roll Number Slip', 
    format: 'Scrollable Stream / A4 PDF',
    settingKey: 'rollNumberSlipTemplate',
    templates: [
      { id: 'minimal-stream', label: 'Minimal Stream', description: 'Clean modern card with dark header badge & streamlined schedule' },
      { id: 'classic-bordered', label: 'Classic Bordered', description: 'Traditional double-bordered academic admit card' },
      { id: 'minimal-professional', label: 'Minimal Professional', description: 'Strict black & white, compact professional layout, print-ready' }
    ]
  },
  { 
    id: 'student-id-card', 
    name: 'Student ID Card', 
    format: 'CR80 Standard (85.6 × 54 mm)',
    settingKey: 'studentIdCardTemplate',
    templates: [
      { id: 'modern-tech', label: 'Modern Tech', description: 'Dark slate & cyan accent identity card' },
      { id: 'classic-academic', label: 'Classic Academic', description: 'Clean ivory & royal blue crest card' },
      { id: 'vertical-badge', label: 'Vertical Badge', description: 'Vertical navy badge, side STUDENT ID strip, photo & barcode — no punch hole' }
    ]
  },
  { 
    id: 'staff-id-card', 
    name: 'Staff ID Card', 
    format: 'CR80 Standard (85.6 × 54 mm)',
    settingKey: 'staffIdCardTemplate',
    templates: [
      { id: 'modern-tech', label: 'Modern Tech', description: 'Dark indigo executive faculty card' },
      { id: 'classic-academic', label: 'Classic Academic', description: 'Traditional light academic faculty badge' }
    ]
  },
  { 
    id: 'fee-challan', 
    name: 'Fee Challan', 
    format: 'Multi-Part Voucher (A4 Landscape)',
    settingKey: 'feeChallanTemplate',
    templates: [
      { id: 'standard-3copy', label: '3-Copy Bank Voucher', description: 'Bank Copy, School Copy & Student/Parent Copy' },
      { id: 'compact-2copy', label: '2-Copy Compact Voucher', description: 'School Office Copy & Student/Parent Copy' },
      { id: 'minimal-professional', label: 'Minimal Professional', description: 'Strict black & white, compact professional layout, print-ready' }
    ]
  },
  { 
    id: 'student-fee-card', 
    name: 'Student Fee Card', 
    format: '12-Month Ledger (A4 Portrait)',
    settingKey: 'studentFeeCardTemplate',
    templates: [
      { id: 'classic-ledger', label: 'Classic Ledger', description: 'Double-framed navy & crimson 12-month fee card' },
      { id: 'minimal-modern', label: 'Minimal Modern', description: 'Monochrome clean-lined institutional ledger' },
      { id: 'minimal-professional', label: 'Minimal Professional', description: 'Strict black & white, compact professional layout, print-ready' }
    ]
  },
  { 
    id: 'staff-salary-slip', 
    name: 'Staff Salary Slip', 
    format: 'A4 Official Payslip',
    settingKey: 'staffSalarySlipTemplate',
    templates: [
      { id: 'executive-emerald', label: 'Executive Emerald', description: 'Modern dark header with emerald net-pay highlight' },
      { id: 'minimal-classic', label: 'Minimal Classic', description: 'High-contrast monochrome payroll voucher' },
      { id: 'minimal-professional', label: 'Minimal Professional', description: 'Strict black & white, compact professional layout, print-ready' }
    ]
  },
  { 
    id: 'exam-dmc', 
    name: 'Exam DMC / Report Card', 
    format: 'A4 Portrait Official',
    settingKey: 'examDmcTemplate',
    templates: [
      { id: 'official-crest', label: 'Official Crest', description: 'Royal blue header with summary metrics ribbon' },
      { id: 'minimal-classic', label: 'Minimal Classic', description: 'Crisp black-bordered academic transcript' },
      { id: 'minimal-professional', label: 'Minimal Professional', description: 'Strict black & white, compact professional layout, print-ready' }
    ]
  },
  { 
    id: 'attendance-register', 
    name: 'Attendance Register', 
    format: 'A4 Landscape Register',
    settingKey: 'attendanceRegisterTemplate',
    templates: [
      { id: 'official-weekly', label: 'Official Weekly', description: 'Color-coded status badges with dark header' },
      { id: 'compact-monochrome', label: 'Compact Monochrome', description: 'Ink-friendly monochrome print register' },
      { id: 'minimal-professional', label: 'Minimal Professional', description: 'Strict black & white, compact professional layout, print-ready' }
    ]
  },
];

export const TemplatesSubmodule: React.FC<TemplatesSubmoduleProps> = ({
  schoolSettings: propSchoolSettings,
  onUpdateSchoolSettings,
  students = [],
  classes = [],
  staff = [],
  allAttendance: propAllAttendance,
  onShowToast
}) => {
  const allAttendance = propAllAttendance || loadAttendance();
  const [liveSchool, setLiveSchool] = useState<SchoolSettings>(() => propSchoolSettings || getSchoolSettings());

  useEffect(() => {
    if (propSchoolSettings) {
      setLiveSchool(propSchoolSettings);
    }
  }, [propSchoolSettings]);

  useEffect(() => {
    const handleSettingsChange = () => {
      setLiveSchool(getSchoolSettings());
    };
    window.addEventListener('schoolSettingsUpdated', handleSettingsChange);
    return () => window.removeEventListener('schoolSettingsUpdated', handleSettingsChange);
  }, []);

  const school = liveSchool;
  const exams = getStoredExams();

  const [selectedDocId, setSelectedDocId] = useState<string>('roll-number-slip');

  // Modals state
  const [isStudentIdModalOpen, setIsStudentIdModalOpen] = useState(false);
  const [isStaffIdModalOpen, setIsStaffIdModalOpen] = useState(false);
  const [isRollSlipsModalOpen, setIsRollSlipsModalOpen] = useState(false);
  const [isFeeChallanModalOpen, setIsFeeChallanModalOpen] = useState(false);
  const [isFeeCardModalOpen, setIsFeeCardModalOpen] = useState(false);
  const [isSalarySlipModalOpen, setIsSalarySlipModalOpen] = useState(false);
  const [isExamExportModalOpen, setIsExamExportModalOpen] = useState(false);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);

  // Sample data for rendering
  const sampleStudent: Student = students[0] || {
    id: 'S-0179',
    name: 'Muhammad Ali',
    family: 'Ahmad Khan',
    familyId: 'F-0010',
    rollNo: '01',
    fatherName: 'Ahmad Khan',
    class: 'Class 1',
    section: 'A',
    status: 'Active',
    bloodGroup: 'B+',
    phone: '+92 300 1234567',
    admissionDate: '2025-01-15'
  };

  const sampleStaff: StaffMember = staff[0] || {
    id: 'T-001',
    name: 'Prof. Muhammad Tariq',
    role: 'Senior Faculty',
    category: 'Teacher',
    qualification: 'M.Sc. Mathematics',
    department: 'Academics',
    phone: '+92 301 5550192',
    email: 'tariq@schoollee.pk',
    status: 'Active',
    payStatus: 'Paid',
    salary: 65000,
    joiningDate: '2023-08-01'
  };

  const sampleExam: Exam = exams[0] || {
    id: 'EXAM-001',
    name: '1st Term Examination',
    class: 'Class 1',
    section: 'A',
    subjects: [
      { id: 'sub-1', name: 'Mathematics', totalMarks: 100, passingMarks: 33, startDate: '2026-09-18' },
      { id: 'sub-2', name: 'English', totalMarks: 100, passingMarks: 33, startDate: '2026-09-19' },
      { id: 'sub-3', name: 'Science', totalMarks: 100, passingMarks: 33, startDate: '2026-09-20' },
      { id: 'sub-4', name: 'Urdu', totalMarks: 100, passingMarks: 33, startDate: '2026-09-21' },
      { id: 'sub-5', name: 'Islamiat', totalMarks: 50, passingMarks: 17, startDate: '2026-09-22' }
    ],
    tags: ['Midterm'],
    // Preview sample only — dated today so the sample never masquerades as a
    // fixed historical record (Fix P0-4).
    createdAt: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    createdTimestamp: Date.now(),
    createdBy: 'Administrator',
    resultsCount: 0,
    studentMarks: {},
    gradingSchema: []
  };

  const activeDoc = DOCUMENTS.find(d => d.id === selectedDocId) || DOCUMENTS[0];
  const currentTemplateValue = (school[activeDoc.settingKey] as string) || activeDoc.templates[0].id;

  const handleSelectTemplateStyle = (templateId: string) => {
    const updated: SchoolSettings = {
      ...school,
      [activeDoc.settingKey]: templateId
    };
    setLiveSchool(updated);
    saveSchoolSettings(updated);
    if (onUpdateSchoolSettings) {
      onUpdateSchoolSettings(updated);
    }
    const chosenOption = activeDoc.templates.find(t => t.id === templateId);
    onShowToast(`${activeDoc.name} template updated to "${chosenOption?.label || templateId}" across the system!`, 'success');
  };

  const handleOpenGenerator = () => {
    switch (selectedDocId) {
      case 'roll-number-slip':
        setIsRollSlipsModalOpen(true);
        break;
      case 'student-id-card':
        setIsStudentIdModalOpen(true);
        break;
      case 'staff-id-card':
        setIsStaffIdModalOpen(true);
        break;
      case 'fee-challan':
        setIsFeeChallanModalOpen(true);
        break;
      case 'student-fee-card':
        setIsFeeCardModalOpen(true);
        break;
      case 'staff-salary-slip':
        setIsSalarySlipModalOpen(true);
        break;
      case 'exam-dmc':
        setIsExamExportModalOpen(true);
        break;
      case 'attendance-register':
        setIsAttendanceModalOpen(true);
        break;
    }
  };

  const buildSampleRollSlipData = (): RollSlipData => ({
    student: sampleStudent,
    rollNo: sampleStudent.rollNo || '01',
    exams: [sampleExam],
    dateSheet: (sampleExam.subjects && sampleExam.subjects.length > 0 ? sampleExam.subjects : [
      { id: 's1', name: 'Mathematics', totalMarks: 100, passingMarks: 33, startDate: '2026-09-18' },
      { id: 's2', name: 'English', totalMarks: 100, passingMarks: 33, startDate: '2026-09-19' },
      { id: 's3', name: 'Science', totalMarks: 100, passingMarks: 33, startDate: '2026-09-20' },
      { id: 's4', name: 'Urdu', totalMarks: 100, passingMarks: 33, startDate: '2026-09-21' },
    ]).map((sub, idx) => ({
      examName: sampleExam.name,
      subjectName: sub.name,
      date: sub.startDate || '2026-09-18',
      time: '09:00 AM - 12:00 PM',
      totalMarks: sub.totalMarks || 100,
      passingMarks: sub.passingMarks || 33,
      room: `Hall ${String.fromCharCode(65 + (idx % 3))}`
    })),
    folderName: sampleExam.name || 'Examination'
  });

  const handleDownloadPdf = async () => {
    try {
      switch (selectedDocId) {
        case 'roll-number-slip': {
          const sampleSlipData = buildSampleRollSlipData();
          generateSingleRollNumberSlipPDF(sampleSlipData, school);
          onShowToast(`Roll Number Slip PDF downloaded for ${sampleStudent.name}!`, 'success');
          break;
        }

        case 'student-id-card': {
          // Preset logos are SVG, which jsPDF cannot embed — rasterize to
          // PNG first so the printed card shows the real school logo.
          const pdfLogo = await rasterizeLogoForPdf(school.schoolLogo || '');
          generateSingleIdCard(
            sampleStudent,
            school.studentIdCardTemplate || 'modern-tech',
            DEFAULT_SCHOOL,
            pdfLogo
          );
          onShowToast(`Student ID Card PDF downloaded for ${sampleStudent.name}!`, 'success');
          break;
        }

        case 'staff-id-card':
          generateSingleStaffIdCard(
            sampleStaff,
            school.staffIdCardTemplate || 'modern-tech',
            DEFAULT_SCHOOL
          );
          onShowToast(`Staff ID Card PDF downloaded for ${sampleStaff.name}!`, 'success');
          break;

        case 'fee-challan':
          setIsFeeChallanModalOpen(true);
          break;

        case 'student-fee-card':
          generateFeeCardPdf(
            students.length > 0 ? students.slice(0, 5) : [sampleStudent],
            classes,
            school
          );
          onShowToast(`Student Fee Card PDF downloaded!`, 'success');
          break;

        case 'staff-salary-slip':
          generateMonthlyIndividualSlipsCombinedPdf(
            staff.length > 0 ? staff : [sampleStaff],
            'September 2026',
            sampleStaff.id,
            DEFAULT_SCHOOL
          );
          onShowToast(`Staff Salary Slip PDF downloaded!`, 'success');
          break;

        case 'exam-dmc':
          setIsExamExportModalOpen(true);
          break;

        case 'attendance-register': {
          const weekDays = getWeekDays(localISODate());
          const targetStudents = students.length > 0 ? students.slice(0, 15) : [sampleStudent];
          const { memberSummaries, totals } = calculateWeeklyAttendance(targetStudents, 'student', weekDays, allAttendance);
          generateWeeklyAttendancePdf(
            memberSummaries,
            totals,
            weekDays,
            `Class ${sampleStudent.class} - Section ${sampleStudent.section || 'A'}`,
            'Students',
            DEFAULT_SCHOOL
          );
          onShowToast(`Attendance Register PDF downloaded!`, 'success');
          break;
        }
      }
    } catch (err) {
      console.error(err);
      handleOpenGenerator();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Clear-Cut 2-Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        
        {/* ========================================================================= */}
        {/* LEFT SIDE: Name of each document                                          */}
        {/* ========================================================================= */}
        <div className="md:col-span-4 lg:col-span-3 space-y-2 bg-surface-10 border border-edge-21 rounded-2xl p-3 shadow-lg">
          <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-[#1c293d]">
            Documents
          </div>
          <div className="space-y-1">
            {DOCUMENTS.map((doc) => {
              const isSelected = selectedDocId === doc.id;
              const activeTplId = (school[doc.settingKey] as string) || doc.templates[0].id;
              const activeTpl = doc.templates.find(t => t.id === activeTplId) || doc.templates[0];
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => setSelectedDocId(doc.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-300 hover:text-white hover:bg-surface-33'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <span className="block truncate">{doc.name}</span>
                    <span className={`block text-[10px] font-normal truncate mt-0.5 ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                      {activeTpl.label}
                    </span>
                  </div>
                  {isSelected && <span className="w-2 h-2 rounded-full bg-white shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT SIDE: Template Selector & Live Document Preview                     */}
        {/* ========================================================================= */}
        <div className="md:col-span-8 lg:col-span-9 bg-surface-10 border border-edge-21 rounded-2xl p-5 shadow-lg space-y-5">
          
          {/* Top Bar of the Preview Pane */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#1c293d]">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">{activeDoc.name}</h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">{activeDoc.format}</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="px-3.5 py-2 rounded-xl bg-surface-33 hover:bg-[#1a2c47] border border-edge-36 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                title="Print Document"
              >
                <Printer className="w-3.5 h-3.5 text-slate-400" />
                <span>Print</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                className="px-3.5 py-2 rounded-xl bg-surface-33 hover:bg-[#1a2c47] border border-edge-36 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                title="Download PDF"
              >
                <Download className="w-3.5 h-3.5 text-slate-400" />
                <span>Download PDF</span>
              </button>

              <button
                type="button"
                onClick={handleOpenGenerator}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-600/30 transition-all cursor-pointer"
              >
                <span>Use / Export</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Template Style Switcher (Changes reflect across the entire system) */}
          <div className="bg-surface-22 border border-[#1f314d] rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                <Palette className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">Active System Template</div>
                <div className="text-[11px] text-slate-400">
                  {activeDoc.templates.find(t => t.id === currentTemplateValue)?.description}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {activeDoc.templates.map((tpl) => {
                const isActive = currentTemplateValue === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handleSelectTemplateStyle(tpl.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                      isActive
                        ? 'bg-blue-600/20 border-blue-500 text-white shadow-sm'
                        : 'bg-[#0b121e] border-edge-21 text-slate-400 hover:text-white hover:border-slate-600'
                    }`}
                  >
                    {isActive && <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />}
                    <span>{tpl.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preview truthfulness note (Fix P1-3): previews are illustrative
              approximations rendered as web markup, not the PDFs themselves */}
          <p className="text-[11px] leading-relaxed text-slate-500">
            Preview is an illustrative approximation of the printed document — layout and spacing in the final PDF may differ slightly. Use <span className="font-semibold text-slate-400">Download PDF</span> to see the exact output.
          </p>

          {/* Document Preview Box - Big, Readable */}
          <div className="p-4 sm:p-8 bg-[#070b13] border border-[#1a2638] rounded-xl overflow-x-auto flex justify-center">
            {selectedDocId === 'roll-number-slip' && (
              <RollNumberSlipPreview 
                school={school} 
                slip={buildSampleRollSlipData()} 
                examTitle={sampleExam.name || '1st Term Examination'} 
              />
            )}

            {selectedDocId === 'student-id-card' && (
              <StudentIdCardPreview 
                school={school} 
                student={sampleStudent} 
              />
            )}

            {selectedDocId === 'staff-id-card' && (
              <StaffIdCardPreview 
                school={school} 
                staff={sampleStaff} 
              />
            )}

            {selectedDocId === 'fee-challan' && (
              <FeeChallanPreview 
                school={school} 
                student={sampleStudent} 
              />
            )}

            {selectedDocId === 'student-fee-card' && (
              <StudentFeeCardPreview 
                school={school} 
                student={sampleStudent}
                classes={classes}
              />
            )}

            {selectedDocId === 'staff-salary-slip' && (
              <StaffSalarySlipPreview 
                school={school} 
                staff={sampleStaff} 
              />
            )}

            {selectedDocId === 'exam-dmc' && (
              <ExamDmcPreview 
                school={school} 
                student={sampleStudent} 
                exam={sampleExam} 
              />
            )}

            {selectedDocId === 'attendance-register' && (
              <AttendanceRegisterPreview 
                school={school} 
                student={sampleStudent} 
              />
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Interactive Functional Modals triggered from "Use / Export"               */}
      {/* ========================================================================= */}
      <RollNumberSlipsModal
        isOpen={isRollSlipsModalOpen}
        onClose={() => setIsRollSlipsModalOpen(false)}
        students={students.length > 0 ? students : [sampleStudent]}
        classes={classes}
        exams={exams.length > 0 ? exams : [sampleExam]}
        schoolSettings={school}
        onShowToast={onShowToast}
      />

      <IdCardModal
        isOpen={isStudentIdModalOpen}
        onClose={() => setIsStudentIdModalOpen(false)}
        student={sampleStudent}
        allStudents={students.length > 0 ? students : [sampleStudent]}
        onSelectStudent={() => {}}
      />

      <StaffIdCardModal
        isOpen={isStaffIdModalOpen}
        onClose={() => setIsStaffIdModalOpen(false)}
        staff={sampleStaff}
        allStaff={staff.length > 0 ? staff : [sampleStaff]}
        onSelectStaff={() => {}}
      />

      <FeeChallanModal
        isOpen={isFeeChallanModalOpen}
        onClose={() => setIsFeeChallanModalOpen(false)}
        student={sampleStudent}
        schoolSettings={school}
        challanNumber="CH-2026-0891"
        feeRange="Monthly Tuition Fee"
        // Fix P1-8: explicit SAMPLE amount for this template preview
        // (matches the static preview breakdown: 4,500 tuition + 300
        // exam fund). Demo data only — FeeChallanModal no longer invents
        // an amount when a caller provides none.
        totalFee={4800}
      />

      <FeeCardModal
        isOpen={isFeeCardModalOpen}
        onClose={() => setIsFeeCardModalOpen(false)}
        students={students.length > 0 ? students : [sampleStudent]}
        classes={classes}
        initialSelectedStudentId={sampleStudent.id}
        schoolSettings={school}
        onShowToast={onShowToast}
      />

      <StaffSalarySlipsModal
        isOpen={isSalarySlipModalOpen}
        onClose={() => setIsSalarySlipModalOpen(false)}
        staffList={staff.length > 0 ? staff : [sampleStaff]}
        selectedStaffMember={sampleStaff}
      />

      <ExamDetailExportModal
        isOpen={isExamExportModalOpen}
        onClose={() => setIsExamExportModalOpen(false)}
        exportType="bulk-dmc"
        exam={sampleExam}
        students={students.length > 0 ? students : [sampleStudent]}
        classes={classes}
        schoolSettings={school}
      />

      <AttendanceSheetModal
        isOpen={isAttendanceModalOpen}
        onClose={() => setIsAttendanceModalOpen(false)}
        classes={classes}
        allStudents={students.length > 0 ? students : [sampleStudent]}
        allStaff={staff.length > 0 ? staff : [sampleStaff]}
        allAttendance={allAttendance}
      />
    </div>
  );
};

/* ========================================================================= */
/* LARGE READABLE DOCUMENT PREVIEW COMPONENTS                                */
/* NOTE (Fix P1-3): these are hand-built approximations of the printed PDFs  */
/* (except the roll-number slip, which shares its real card component). The  */
/* salary-slip preview resolves its design through the shared                */
/* getSalarySlipTheme mapping (Fix P1-2); the rest branch on their template  */
/* setting directly. The Templates pane labels previews as approximations.   */
/* ========================================================================= */

/**
 * 1. Roll Number Slip — Uses the shared MinimalStreamSlipCard from RollNumberSlipsModal
 * so the template in Settings -> Templates matches the generated Roll Number Slips 100%.
 */
function RollNumberSlipPreview({
  school,
  slip,
  examTitle
}: {
  school: SchoolSettings;
  slip: RollSlipData;
  examTitle: string;
}) {
  // 'minimal-professional' is not handled by the shared MinimalStreamSlipCard
  // (it lives in RollNumberSlipsModal and only branches classic / stream), so
  // this preview renders the strict B&W variant locally with the same fields.
  const isMinimalProfessional = school.rollNumberSlipTemplate === 'minimal-professional';

  if (isMinimalProfessional) {
    return (
      <div className="w-full max-w-3xl bg-white text-black p-3 font-sans shadow-2xl border border-black">
        <div className="border border-black p-3 space-y-2">
          {/* Header */}
          <div className="text-center border-b border-black pb-2">
            <div className="flex items-center justify-between text-[9px] font-mono text-[#666] mb-0.5">
              <span>SLIP #1 OF 1</span>
              <span>SESSION: {school.session || '2025 - 2026'}</span>
            </div>
            <h3 className="text-base font-black uppercase tracking-tight text-black">
              {school.schoolName || 'DEMO SCHOOL SYSTEM'}
            </h3>
            <p className="text-[10px] font-bold uppercase tracking-wider bg-black text-white inline-block px-3 py-0.5 mt-1">
              {examTitle} — Roll Number Slip
            </p>
          </div>

          {/* Student Info + Photo */}
          <div className="grid grid-cols-12 gap-3 items-center border-b border-black pb-2 text-[11px]">
            <div className="col-span-9 grid grid-cols-2 gap-y-1 gap-x-3">
              <div>
                <span className="text-[9px] font-bold uppercase text-[#666] block">Student Name</span>
                <span className="font-black uppercase text-[11px] text-black">{slip.student.name}</span>
              </div>
              <div>
                <span className="text-[9px] font-bold uppercase text-[#666] block">Father / Guardian</span>
                <span className="font-bold uppercase text-[11px] text-black">
                  {slip.student.fatherName || slip.student.family || '-'}
                </span>
              </div>
              <div>
                <span className="text-[9px] font-bold uppercase text-[#666] block">Class &amp; Section</span>
                <span className="font-bold text-[11px] text-black">
                  {slip.student.class} ({slip.student.section || 'A'})
                </span>
              </div>
              <div>
                <span className="text-[9px] font-bold uppercase text-[#666] block">Roll Number</span>
                <span className="inline-block px-2 py-0.5 bg-black text-white font-mono font-black text-[11px]">
                  {slip.rollNo}
                </span>
              </div>
            </div>
            <div className="col-span-3 flex justify-end">
              <div className="w-14 h-[72px] border border-black bg-white flex items-center justify-center text-lg font-black text-black">
                {slip.student.name.charAt(0)}
              </div>
            </div>
          </div>

          {/* Compact Schedule Table */}
          <table className="w-full text-left text-[10px] border-collapse border border-black">
            <thead>
              <tr className="bg-white border-b border-black font-bold text-[9px] uppercase text-black">
                <th className="py-1 px-2 border-r border-black w-8 text-center">#</th>
                <th className="py-1 px-2 border-r border-black">Subject</th>
                <th className="py-1 px-2 border-r border-black text-center">Date</th>
                <th className="py-1 px-2 border-r border-black text-center">Time</th>
                <th className="py-1 px-2 text-center w-14">Marks</th>
              </tr>
            </thead>
            <tbody>
              {slip.dateSheet.map((item, idx) => (
                <tr key={idx} className="border-b border-[#999] last:border-b-0 text-black">
                  <td className="py-0.5 px-2 border-r border-[#999] text-center font-mono">{idx + 1}</td>
                  <td className="py-0.5 px-2 border-r border-[#999] font-bold uppercase">{item.subjectName}</td>
                  <td className="py-0.5 px-2 border-r border-[#999] text-center font-mono text-[10px]">{item.date}</td>
                  <td className="py-0.5 px-2 border-r border-[#999] text-center text-[10px]">{item.time}</td>
                  <td className="py-0.5 px-2 text-center font-mono">{item.totalMarks}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Footer Signatures */}
          <div className="pt-3 flex items-end justify-between text-[9px] font-bold uppercase text-black">
            <div className="border-t border-black pt-1 w-32 text-center">Candidate Sign</div>
            <div className="text-[9px] font-mono text-[#666]">ID: {slip.student.id}</div>
            <div className="border-t border-black pt-1 w-36 text-center">Controller of Exams</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl">
      <MinimalStreamSlipCard
        slip={slip}
        school={school}
        examTitle={examTitle}
        index={0}
        total={1}
      />
    </div>
  );
}

/**
 * 2. Student ID Card (Front & Back) — Respects school.studentIdCardTemplate
 */
function StudentIdCardPreview({
  school,
  student
}: {
  school: SchoolSettings;
  student: Student;
}) {
  const isClassic = school.studentIdCardTemplate === 'classic-academic';
  const isVerticalBadge = school.studentIdCardTemplate === 'vertical-badge';

  if (isVerticalBadge) {
    return (
      <div className="flex flex-col sm:flex-row items-center gap-6 justify-center">
        {/* Vertical Badge Front — redesigned 2026-11-07 to mirror the PDF: 8mm strip
            stopping at a full-width 12mm band, Ø10mm logo, 23mm cover photo, larger
            type, priority detail rows, REAL Code39 barcode. NO punch hole. */}
        <div className="w-72 h-[420px] rounded-2xl text-white shadow-2xl relative overflow-hidden font-sans" style={{ backgroundColor: '#0D2742' }}>
          {/* Left steel-blue strip (8mm) with vertical STUDENT ID text (bottom-to-top) */}
          <div className="absolute left-0 top-0 bottom-[59px] w-[43px] flex items-center justify-center" style={{ backgroundColor: '#8DB4C8' }}>
            <span className="text-[#0D2742] font-black tracking-[0.18em] text-[14px] whitespace-nowrap [writing-mode:vertical-rl] rotate-180">
              STUDENT ID
            </span>
          </div>

          {/* Bottom steel-blue band (12mm, full width): white Code39 strip + ID line */}
          <div className="absolute left-0 right-0 bottom-0 h-[59px] flex flex-col items-center justify-center" style={{ backgroundColor: '#8DB4C8' }}>
            <div className="bg-white rounded-[3px] w-[224px] h-[27px] px-[6px] py-[4px] overflow-hidden">
              <Code39Bars value={student.id} className="w-full h-full" />
            </div>
            <span className="text-[12px] font-black text-[#0D2742] tracking-wide leading-none mt-[5px]">
              ID: {student.id}
            </span>
          </div>

          {/* Content zone: right of the strip, above the band */}
          <div className="absolute left-[43px] right-0 top-0 bottom-[59px] flex flex-col items-center px-2 text-center">
            {school.schoolLogo ? (
              <img
                src={school.schoolLogo}
                alt={school.schoolName}
                className="w-[52px] h-[52px] mt-[20px] rounded-[10px] object-cover shrink-0"
                style={{ backgroundColor: '#8DB4C8' }}
              />
            ) : (
              <div className="w-[52px] h-[52px] mt-[20px] rounded-full flex items-center justify-center text-[13px] font-black text-[#0D2742] shrink-0" style={{ backgroundColor: '#8DB4C8' }}>
                {(school.schoolName || 'S').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('')}
              </div>
            )}
            <h2 className="text-[15px] font-extrabold text-white mt-[3px] leading-[18px]">
              {school.schoolName || 'DEMO SCHOOL'}
            </h2>
            <span className="text-[11px] font-semibold mt-[1px]" style={{ color: '#BED7E4' }}>
              {school.campusName || 'Main Campus'} • {school.session || '2025 - 2026'}
            </span>

            {/* Photo frame (23mm, cover-fit like the PDF) */}
            <div className="w-[122px] h-[112px] mt-[11px] p-[4px] shrink-0 rounded-[10px]" style={{ backgroundColor: '#8DB4C8' }}>
              <img
                src={getStudentAvatar(student)}
                alt={student.name}
                className="w-full h-full object-cover rounded-[7px]"
                style={{ backgroundColor: '#1B3654' }}
              />
            </div>

            <h3 className="text-[20px] font-bold leading-[24px] mt-[9px] text-center" style={{ color: '#E2F0F8' }}>{student.name}</h3>

            {/* Detail rows — same priority set + 4-row cap as the PDF, spread to fill */}
            <div className="w-full flex-1 flex flex-col justify-around text-left pl-[16px] pr-[8px] py-1">
              {vbFrontRows(student).map(row => (
                <div key={row.label} className="flex items-baseline">
                  <span className="font-bold text-[11px] w-[78px] shrink-0" style={{ color: '#BED7E4' }}>{row.label}</span>
                  <span className="text-[12px] text-white truncate">{row.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Vertical Badge Back — mirrors the PDF back page (page 2 of the download):
            school identity, student identity, contact rows, school contact block,
            signature + seal, and the return-to-school band. Same field order as
            renderVerticalBadgeBack in pdfGenerator.ts. */}
        <div className="w-72 h-[420px] rounded-2xl text-white shadow-2xl relative overflow-hidden font-sans" style={{ backgroundColor: '#0D2742' }}>
          {/* School identity */}
          <div className="flex flex-col items-center text-center px-4 pt-[24px]">
            {school.schoolLogo ? (
              <img
                src={school.schoolLogo}
                alt={school.schoolName}
                className="w-[60px] h-[56px] rounded-[10px] object-cover"
                style={{ backgroundColor: '#8DB4C8' }}
              />
            ) : (
              <div className="w-[60px] h-[56px] rounded-full flex items-center justify-center text-sm font-black text-[#0D2742]" style={{ backgroundColor: '#8DB4C8' }}>
                {(school.schoolName || 'S').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('')}
              </div>
            )}
            <h2 className="text-[15px] font-extrabold mt-[8px] leading-[18px]">
              {school.schoolName || 'DEMO SCHOOL'}
            </h2>
            <span className="text-[11px] font-semibold mt-[1px]" style={{ color: '#BED7E4' }}>
              {school.campusName || 'Main Campus'}
            </span>
            <div className="w-[202px] border-t-2 mt-[10px]" style={{ borderColor: '#8DB4C8' }} />
          </div>

          {/* Student identity */}
          <div className="text-center mt-[12px] px-4">
            <span className="text-[11px] font-bold tracking-[0.2em]" style={{ color: '#8DB4C8' }}>STUDENT</span>
            <p className="text-[18px] font-bold leading-[22px] mt-[3px] text-white">{student.name}</p>
            <p className="text-[12px] mt-[2px]" style={{ color: '#CBE1EE' }}>
              {student.id} • {student.class} – {student.section || 'A'}
            </p>
          </div>

          {/* Contact rows — same fields/order as the PDF back */}
          <div className="px-[30px] mt-[20px] space-y-[9px] text-left">
            {student.family && (
              <div className="flex items-baseline">
                <span className="font-bold text-[11px] w-[86px] shrink-0" style={{ color: '#BED7E4' }}>GUARDIAN</span>
                <span className="text-[12px] text-white">{student.family}</span>
              </div>
            )}
            {student.phone && (
              <div className="flex items-baseline">
                <span className="font-bold text-[11px] w-[86px] shrink-0" style={{ color: '#BED7E4' }}>PHONE</span>
                <span className="text-[12px] text-white">{student.phone}</span>
              </div>
            )}
            {student.emergencyContact && student.emergencyContact !== student.phone && (
              <div className="flex items-baseline">
                <span className="font-bold text-[11px] w-[86px] shrink-0" style={{ color: '#BED7E4' }}>EMERGENCY</span>
                <span className="text-[12px] text-white">{student.emergencyContact}</span>
              </div>
            )}
            {student.address && (
              <div className="flex items-baseline">
                <span className="font-bold text-[11px] w-[86px] shrink-0" style={{ color: '#BED7E4' }}>ADDRESS</span>
                <span className="text-[12px] text-white leading-snug">{student.address}</span>
              </div>
            )}
          </div>

          {/* School contact block (centered) */}
          <div className="text-center px-4 mt-[16px] space-y-[3px]" style={{ color: '#CBE1EE' }}>
            {school.schoolAddress && <p className="text-[12px] leading-snug">{school.schoolAddress}</p>}
            {school.schoolPhone && <p className="text-[12px]">{school.schoolPhone}</p>}
            {school.schoolEmail && <p className="text-[12px]">{school.schoolEmail}</p>}
            {school.schoolWebsite && <p className="text-[12px]">{school.schoolWebsite}</p>}
          </div>

          {/* Seal (left) + principal signature (right) */}
          <div className="absolute left-0 right-0 bottom-[38px] flex items-end justify-between px-[30px]">
            <div className="w-[26px] h-[26px] rounded-full border flex items-center justify-center text-[5px] font-bold" style={{ borderColor: '#8DB4C8', color: '#8DB4C8' }}>
              VERIFIED
            </div>
            <div className="text-center">
              <div className="w-[90px] border-b" style={{ borderColor: '#BED7E4' }} />
              <span className="text-[8px]" style={{ color: '#BED7E4' }}>Principal Signature</span>
            </div>
          </div>

          {/* Bottom band */}
          <div className="absolute left-0 right-0 bottom-0 h-[29px] flex items-center justify-center" style={{ backgroundColor: '#8DB4C8' }}>
            <span className="text-[11px] font-bold text-[#0D2742]">If found, please return to the school office.</span>
          </div>
        </div>
      </div>
    );
  }

  if (isClassic) {
    return (
      <div className="flex flex-col sm:flex-row items-center gap-6 justify-center">
        {/* Classic Front */}
        <div className="w-72 h-[420px] rounded-2xl bg-[#f8fafc] text-slate-900 border-2 border-accent-deep shadow-2xl flex flex-col justify-between overflow-hidden font-sans">
          <div className="bg-accent-deep text-white px-4 py-3 text-center border-b-4 border-amber-500">
            <h2 className="text-xs font-black uppercase tracking-wider">
              {school.schoolName || 'DEMO SCHOOL'}
            </h2>
            <span className="text-[9px] font-semibold text-blue-200 tracking-widest block uppercase mt-0.5">
              STUDENT IDENTITY CARD
            </span>
          </div>

          <div className="flex flex-col items-center my-auto px-4">
            <div className="w-24 h-24 rounded-full bg-blue-50 border-2 border-accent-deep p-1 flex items-center justify-center shadow-md">
              <div className="w-full h-full rounded-full bg-accent-deep flex items-center justify-center text-white text-3xl font-black">
                {student.name.charAt(0)}
              </div>
            </div>
            <h3 className="text-base font-black text-slate-900 mt-3 text-center">{student.name}</h3>
            <span className="text-xs font-bold text-accent-deep bg-blue-100 px-3 py-0.5 rounded-full mt-1 border border-blue-300">
              {student.class} — Section {student.section || 'A'}
            </span>
          </div>

          <div className="px-5 space-y-1.5 text-xs border-t border-slate-200 pt-3">
            <div className="flex justify-between">
              <span className="text-slate-500 font-semibold">Roll No:</span>
              <span className="font-bold text-slate-900">{student.rollNo || '01'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-semibold">Father Name:</span>
              <span className="font-bold text-slate-900">{student.fatherName || 'Ahmad Khan'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-semibold">Blood Group:</span>
              <span className="font-bold text-rose-600">{student.bloodGroup || 'B+'}</span>
            </div>
          </div>

          <div className="px-5 py-2.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
            <span className="text-[9px] font-mono font-bold text-slate-600">ID: {student.id}</span>
            <Barcode className="w-16 h-5 text-accent-deep" />
          </div>
        </div>

        {/* Classic Back */}
        <div className="w-72 h-[420px] rounded-2xl bg-[#f8fafc] text-slate-900 p-5 border-2 border-accent-deep shadow-2xl flex flex-col justify-between font-sans">
          <div className="text-center border-b-2 border-accent-deep pb-2">
            <span className="text-[10px] font-black text-accent-deep uppercase tracking-widest">TERMS &amp; CONDITIONS</span>
          </div>

          <div className="space-y-2 text-[10px] text-slate-700 leading-relaxed my-auto">
            <p>• This card is the property of {school.schoolName} and must be returned upon withdrawal.</p>
            <p>• Loss of card must be reported immediately to the administrative office.</p>
            <p>• Students must wear this card on campus and during official assessments.</p>
            <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-center space-y-0.5 mt-3">
              <span className="text-[9px] text-slate-500 font-bold block uppercase">Emergency Contact</span>
              <p className="font-mono text-xs font-bold text-accent-deep">{school.schoolPhone || '+92 42 35889012'}</p>
              <p className="text-[9px] text-slate-600">{school.schoolAddress || 'Main Campus'}</p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-300 flex items-end justify-between">
            <div className="text-center">
              <div className="w-20 border-b border-slate-500 mb-1" />
              <span className="text-[9px] text-slate-600 font-bold">Principal Sign</span>
            </div>
            <div className="w-12 h-12 rounded-full border border-accent-deep flex items-center justify-center text-[8px] text-accent-deep font-bold">
              SEAL
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 justify-center">
      {/* Modern Tech Front */}
      <div className="w-72 h-[420px] rounded-2xl bg-gradient-to-b from-slate-900 via-slate-800 to-slate-950 text-white p-5 border-2 border-cyan-500/50 shadow-2xl flex flex-col justify-between relative overflow-hidden font-sans">
        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="text-center border-b border-cyan-500/30 pb-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-cyan-400">
            {school.schoolName || 'SCHOOLLEE GRAMMAR SCHOOL'}
          </h2>
          <span className="text-[9px] font-bold text-slate-300 tracking-widest block uppercase mt-0.5">
            STUDENT IDENTITY CARD
          </span>
        </div>

        <div className="flex flex-col items-center my-auto">
          <div className="w-24 h-24 rounded-2xl bg-cyan-600/20 border-2 border-cyan-400 p-1 flex items-center justify-center shadow-lg shadow-cyan-900/40">
            <div className="w-full h-full rounded-xl bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center text-white text-3xl font-black">
              {student.name.charAt(0)}
            </div>
          </div>
          <h3 className="text-base font-black text-white mt-3 text-center">{student.name}</h3>
          <span className="text-xs font-bold text-cyan-400 bg-cyan-500/10 px-3 py-0.5 rounded-full mt-1 border border-cyan-500/20">
            {student.class} — Section {student.section || 'A'}
          </span>
        </div>

        <div className="space-y-1.5 text-xs border-t border-slate-700/80 pt-3">
          <div className="flex justify-between text-slate-300">
            <span className="text-slate-400">Roll No:</span>
            <span className="font-bold text-white">{student.rollNo || '01'}</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span className="text-slate-400">Father Name:</span>
            <span className="font-bold text-white">{student.fatherName || 'Ahmad Khan'}</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span className="text-slate-400">Blood Group:</span>
            <span className="font-bold text-rose-400">{student.bloodGroup || 'B+'}</span>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[9px] font-mono text-slate-400">ID: {student.id}</span>
          <Barcode className="w-16 h-5 text-cyan-400" />
        </div>
      </div>

      {/* Modern Tech Back */}
      <div className="w-72 h-[420px] rounded-2xl bg-slate-900 text-white p-5 border border-slate-700 shadow-2xl flex flex-col justify-between font-sans">
        <div className="text-center border-b border-slate-800 pb-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TERMS &amp; CONDITIONS</span>
        </div>

        <div className="space-y-2 text-[10px] text-slate-300 leading-relaxed my-auto">
          <p>• This card is the property of the school and must be returned upon withdrawal or completion.</p>
          <p>• Loss of card must be reported immediately to the administrative office for reissue.</p>
          <p>• Students must display this card on campus and during official assessments.</p>
          <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-center space-y-0.5 mt-3">
            <span className="text-[9px] text-slate-400 font-bold block uppercase">Emergency Contact</span>
            <p className="font-mono text-xs font-bold text-cyan-300">{school.schoolPhone || '+92 42 35889012'}</p>
            <p className="text-[9px] text-slate-400">{school.schoolAddress || 'Lahore, Pakistan'}</p>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-800 flex items-end justify-between">
          <div className="text-center">
            <div className="w-20 border-b border-slate-600 mb-1" />
            <span className="text-[9px] text-slate-400 font-bold">Principal Sign</span>
          </div>
          <div className="w-12 h-12 rounded-full border border-slate-700 flex items-center justify-center text-[8px] text-slate-400 font-bold">
            SEAL
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 3. Staff ID Card — Respects school.staffIdCardTemplate
 */
function StaffIdCardPreview({
  school,
  staff
}: {
  school: SchoolSettings;
  staff: StaffMember;
}) {
  const isClassic = school.staffIdCardTemplate === 'classic-academic';

  if (isClassic) {
    return (
      <div className="flex flex-col sm:flex-row items-center gap-6 justify-center">
        <div className="w-72 h-[420px] rounded-2xl bg-[#f8fafc] text-slate-900 border-2 border-edge-13 shadow-2xl flex flex-col justify-between overflow-hidden font-sans">
          <div className="bg-edge-13 text-white px-4 py-3 text-center border-b-4 border-amber-500">
            <h2 className="text-xs font-black uppercase tracking-wider">
              {school.schoolName || 'DEMO SCHOOL'}
            </h2>
            <span className="text-[9px] font-semibold text-slate-300 tracking-widest block uppercase mt-0.5">
              FACULTY &amp; STAFF IDENTITY CARD
            </span>
          </div>

          <div className="flex flex-col items-center my-auto px-4">
            <div className="w-24 h-24 rounded-full bg-slate-100 border-2 border-edge-13 p-1 flex items-center justify-center shadow-md">
              <div className="w-full h-full rounded-full bg-edge-13 flex items-center justify-center text-white text-3xl font-black">
                {staff.name.charAt(0)}
              </div>
            </div>
            <h3 className="text-base font-black text-slate-900 mt-3 text-center">{staff.name}</h3>
            <span className="text-xs font-bold text-slate-800 bg-slate-200 px-3 py-0.5 rounded-full mt-1 border border-slate-300">
              {staff.role}
            </span>
          </div>

          <div className="px-5 space-y-1.5 text-xs border-t border-slate-200 pt-3">
            <div className="flex justify-between">
              <span className="text-slate-500 font-semibold">Department:</span>
              <span className="font-bold text-slate-900">{staff.department || 'Academics'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-semibold">Qualification:</span>
              <span className="font-bold text-slate-900">{staff.qualification || 'M.Sc.'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-semibold">Phone:</span>
              <span className="font-mono font-bold text-slate-900">{staff.phone}</span>
            </div>
          </div>

          <div className="px-5 py-2.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
            <span className="text-[9px] font-mono font-bold text-slate-600">EMP: {staff.id}</span>
            <QrCode className="w-7 h-7 text-slate-800" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 justify-center">
      <div className="w-72 h-[420px] rounded-2xl bg-gradient-to-b from-[#0e1726] to-[#0a0f18] text-white p-5 border-2 border-indigo-500/50 shadow-2xl flex flex-col justify-between font-sans relative">
        <div className="text-center border-b border-indigo-500/30 pb-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-indigo-400">
            {school.schoolName || 'SCHOOLLEE GRAMMAR SCHOOL'}
          </h2>
          <span className="text-[9px] font-bold text-slate-300 tracking-widest block uppercase mt-0.5">
            FACULTY &amp; STAFF IDENTITY CARD
          </span>
        </div>

        <div className="flex flex-col items-center my-auto">
          <div className="w-24 h-24 rounded-2xl bg-indigo-600/20 border-2 border-indigo-400 p-1 flex items-center justify-center shadow-lg shadow-indigo-900/40">
            <div className="w-full h-full rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center text-white text-3xl font-black">
              {staff.name.charAt(0)}
            </div>
          </div>
          <h3 className="text-base font-black text-white mt-3 text-center">{staff.name}</h3>
          <span className="text-xs font-bold text-indigo-300 bg-indigo-500/10 px-3 py-0.5 rounded-full mt-1 border border-indigo-500/20">
            {staff.role}
          </span>
        </div>

        <div className="space-y-1.5 text-xs border-t border-slate-800 pt-3">
          <div className="flex justify-between text-slate-300">
            <span className="text-slate-400">Department:</span>
            <span className="font-bold text-white">{staff.department || 'Academics'}</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span className="text-slate-400">Qualification:</span>
            <span className="font-bold text-white">{staff.qualification || 'M.Sc.'}</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span className="text-slate-400">Phone:</span>
            <span className="font-mono text-white">{staff.phone}</span>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[9px] font-mono text-slate-400">EMP: {staff.id}</span>
          <QrCode className="w-8 h-8 text-indigo-400" />
        </div>
      </div>
    </div>
  );
}

/**
 * 4. Fee Challan — Respects school.feeChallanTemplate ('standard-3copy' vs 'compact-2copy')
 */
function FeeChallanPreview({
  school,
  student
}: {
  school: SchoolSettings;
  student: Student;
}) {
  const isMinimalProfessional = school.feeChallanTemplate === 'minimal-professional';
  const isCompact2Copy = !isMinimalProfessional && school.feeChallanTemplate === 'compact-2copy';
  // Minimal Professional always uses the full 3-copy structure, in B&W.
  const copies = isCompact2Copy
    ? ['School Copy', 'Student / Parent Copy']
    : ['Bank Copy', 'School Copy', 'Student / Parent Copy'];

  return (
    <div className={`w-full max-w-4xl bg-white text-black font-sans shadow-2xl border-2 border-black rounded-sm space-y-3 ${isMinimalProfessional ? 'p-3' : 'p-4'}`}>
      <div className={`grid grid-cols-1 ${isCompact2Copy ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-3`}>
        {copies.map((copyName, idx) => (
          <div 
            key={copyName}
            className={`p-3 flex flex-col justify-between border border-black space-y-2 text-xs ${
              idx < copies.length - 1 ? 'md:border-r-2 md:border-dashed md:border-black' : ''
            }`}
          >
            {/* Header */}
            <div className="text-center border-b border-black pb-2 space-y-0.5">
              <span className={`font-bold text-[10px] uppercase block truncate ${isMinimalProfessional ? 'text-black' : 'text-blue-900'}`}>
                {school.bankName || 'Faysal Bank Limited'}
              </span>
              <span className={`font-mono text-[9px] block ${isMinimalProfessional ? 'text-[#666]' : 'text-neutral-600'}`}>
                A/C: {school.accountNumber || '301829300000192'}
              </span>
              <h4 className="font-black text-xs uppercase truncate">
                {school.schoolName || 'Demo School'}
              </h4>
              <span className={`inline-block px-2 py-0.5 text-[9px] font-black uppercase mt-1 ${isMinimalProfessional ? 'bg-white text-black border border-black' : 'bg-neutral-200 text-black'}`}>
                {copyName}
              </span>
            </div>

            {/* Meta */}
            <div className="space-y-1 text-[10px] border-b border-black pb-2">
              <div className="flex justify-between">
                <span>Challan No:</span>
                <span className="font-mono font-bold">CH-2026-0891</span>
              </div>
              <div className="flex justify-between">
                <span>Due Date:</span>
                <span className={`font-bold ${isMinimalProfessional ? 'text-black' : 'text-red-600'}`}>10 Sep 2026</span>
              </div>
              <div className="flex justify-between">
                <span>Student:</span>
                <span className="font-bold truncate max-w-[110px]">{student.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Class:</span>
                <span className="font-bold">{student.class} ({student.section || 'A'})</span>
              </div>
              <div className="flex justify-between">
                <span>Roll No:</span>
                <span className="font-mono font-bold">{student.rollNo || '01'}</span>
              </div>
            </div>

            {/* Breakdown */}
            <table className="w-full text-[10px] border border-black border-collapse">
              <thead>
                <tr className={`${isMinimalProfessional ? 'bg-white text-black' : 'bg-neutral-100'} border-b border-black font-bold`}>
                  <th className="p-1 text-left">Description</th>
                  <th className="p-1 text-right">PKR</th>
                </tr>
              </thead>
              <tbody>
                <tr className={`border-b ${isMinimalProfessional ? 'border-[#999]' : 'border-neutral-300'}`}>
                  <td className="p-1">Tuition Fee</td>
                  <td className="p-1 text-right font-mono">4,500</td>
                </tr>
                <tr className={`border-b ${isMinimalProfessional ? 'border-[#999]' : 'border-neutral-300'}`}>
                  <td className="p-1">Exam Fund</td>
                  <td className="p-1 text-right font-mono">300</td>
                </tr>
                <tr className={`${isMinimalProfessional ? 'bg-white text-black' : 'bg-neutral-200'} font-black border-t border-black`}>
                  <td className="p-1">Payable Within Due Date</td>
                  <td className="p-1 text-right font-mono">4,800</td>
                </tr>
                <tr className={`text-[9px] ${isMinimalProfessional ? 'text-[#333]' : 'text-neutral-700'}`}>
                  <td className="p-1">After Due Date (+{school.lateFineAmount || 300})</td>
                  <td className="p-1 text-right font-mono">{(4800 + (school.lateFineAmount || 300)).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>

            {/* Signatures */}
            <div className={`pt-3 flex justify-between text-[8px] border-t border-black ${isMinimalProfessional ? 'text-[#666]' : 'text-neutral-600'}`}>
              <span>Cashier Sign</span>
              <span>Bank Stamp</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 5. Student Fee Card (12-Month Ledger Preview) — Matches FeeCardModal & school.studentFeeCardTemplate
 */
function StudentFeeCardPreview({
  school,
  student,
  classes
}: {
  school: SchoolSettings;
  student: Student;
  classes: ClassInfo[];
}) {
  const cardData = buildStudentFeeCardData(student, classes, school);
  const isMinimalProfessional = school.studentFeeCardTemplate === 'minimal-professional';
  const isMinimalTemplate = school.studentFeeCardTemplate === 'minimal-modern';

  if (isMinimalProfessional) {
    return (
      <div className="w-full max-w-3xl bg-white text-black p-3 font-sans shadow-2xl overflow-x-auto border border-black">
        <div className="border border-black p-3">
          {/* Top Header Row */}
          <div className="flex items-center justify-between text-[10px] font-bold mb-1 text-black">
            <span>School NO- {cardData.schoolNo}</span>
            <div className="bg-black text-white px-4 py-0.5 text-[11px] font-black tracking-wider uppercase">
              FEE CARD
            </div>
            <span>Affiliation No- {cardData.affiliationNo}</span>
          </div>

          {/* UDISE */}
          <div className="text-center text-[9px] font-bold mb-1 text-[#666]">
            UDISE- {cardData.udiseNo}
          </div>

          {/* School Name */}
          <div className="text-center mb-1 leading-tight">
            <h1 className="text-xl font-black tracking-tight uppercase text-black font-sans">
              {cardData.schoolName}
            </h1>
            <p className="text-[10px] text-[#666] font-sans">
              {cardData.trustName}
            </p>
          </div>

          <div className="text-center text-[9px] font-bold text-[#333]">
            {cardData.schoolAddress}
          </div>

          {/* Session */}
          <div className="flex justify-center my-1.5">
            <div className="px-4 py-0.5 border border-black text-[9px] font-bold text-black">
              Session : {cardData.academicSession}
            </div>
          </div>

          {/* Member Info */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] text-black my-2 font-medium">
            <div className="flex items-baseline">
              <span className="font-bold shrink-0 mr-2 text-black">Name:</span>
              <span className="border-b border-[#999] flex-1 font-bold text-black px-1">{cardData.student.name}</span>
            </div>
            <div className="flex items-baseline">
              <span className="font-bold shrink-0 mr-2 text-black">Father&apos;s Name:</span>
              <span className="border-b border-[#999] flex-1 text-black px-1">{cardData.fatherName}</span>
            </div>
            <div className="flex items-baseline">
              <span className="font-bold shrink-0 mr-2 text-black">Class &amp; Sec:</span>
              <span className="border-b border-[#999] flex-1 text-black px-1">{cardData.className} - {cardData.section}</span>
            </div>
            <div className="flex items-baseline">
              <span className="font-bold shrink-0 mr-2 text-black">Roll No / A/c:</span>
              <span className="border-b border-[#999] flex-1 font-mono text-black px-1">{cardData.rollNo} / {cardData.accountNo}</span>
            </div>
          </div>

          {/* 12-Month Table (first 6 months shown, as in the other previews) */}
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-[9px] border-collapse border border-black text-black">
              <thead className="bg-white text-black font-bold uppercase text-[8px]">
                <tr>
                  <th className="p-1 border border-black">MONTH</th>
                  <th className="p-1 border border-black text-center">ADMISSION</th>
                  <th className="p-1 border border-black text-center">ANNUAL</th>
                  <th className="p-1 border border-black text-center">TUITION</th>
                  <th className="p-1 border border-black text-center">TOTAL PAYABLE</th>
                  <th className="p-1 border border-black text-center">PAID</th>
                  <th className="p-1 border border-black text-center">DUES</th>
                  <th className="p-1 border border-black text-center">REC. NO.</th>
                </tr>
              </thead>
              <tbody>
                {cardData.months.slice(0, 6).map((row) => (
                  <tr key={row.month}>
                    <td className="p-0.5 font-bold border border-[#999]">{row.month}</td>
                    <td className="p-0.5 text-right font-mono border border-[#999]">{formatOrBlank(row.admissionFee)}</td>
                    <td className="p-0.5 text-right font-mono border border-[#999]">{formatOrBlank(row.annualFee)}</td>
                    <td className="p-0.5 text-right font-mono border border-[#999]">{formatOrBlank(row.tuitionFee)}</td>
                    <td className="p-0.5 text-right font-mono font-bold border border-[#999]">{formatOrBlank(row.totalPayable)}</td>
                    <td className="p-0.5 text-right font-mono font-bold border border-[#999]">{formatOrBlank(row.amountPaid)}</td>
                    <td className="p-0.5 text-right font-mono border border-[#999]">{formatOrBlank(row.dues)}</td>
                    <td className="p-0.5 text-center font-mono border border-[#999]">{row.receiptNo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl bg-white text-slate-900 rounded-xl p-5 shadow-2xl overflow-x-auto border border-slate-300">
      <div className={isMinimalTemplate ? "border border-slate-900 p-4 relative" : "border-2 border-doc-deep p-3.5 relative"}>
        <div className={isMinimalTemplate ? "p-1" : "border border-doc-deep p-3.5"}>
          {/* Top Header Row */}
          <div className={`flex items-center justify-between text-[11px] font-bold mb-1 ${isMinimalTemplate ? 'text-slate-900' : 'text-doc-deep'}`}>
            <span>School NO- {cardData.schoolNo}</span>
            <div className={`${isMinimalTemplate ? 'bg-slate-900' : 'bg-[#dc2626]'} text-white px-5 py-0.5 rounded-full text-xs font-black tracking-wider uppercase`}>
              FEE CARD
            </div>
            <span>Affiliation No- {cardData.affiliationNo}</span>
          </div>

          {/* UDISE */}
          <div className={`text-center text-[10px] font-bold mb-1 ${isMinimalTemplate ? 'text-slate-600' : 'text-doc-deep'}`}>
            UDISE- {cardData.udiseNo}
          </div>

          {/* School Name */}
          <div className="text-center mb-1 leading-tight">
            <h1 className={`text-2xl font-black tracking-tight uppercase ${isMinimalTemplate ? 'text-slate-950 font-sans' : 'text-[#be1818] font-serif'}`}>
              {cardData.schoolName}
            </h1>
            <p className={`text-[11px] italic ${isMinimalTemplate ? 'text-slate-600 font-sans' : 'text-[#991b1b] font-serif'}`}>
              {cardData.trustName}
            </p>
          </div>

          <div className="text-center text-[10px] font-bold text-slate-800">
            {cardData.schoolAddress}
          </div>

          {/* Session Pill */}
          <div className="flex justify-center my-2">
            <div className={`px-6 py-0.5 border rounded-full text-[10px] font-bold ${isMinimalTemplate ? 'border-slate-900 text-slate-900' : 'border-doc-deep text-doc-deep'}`}>
              Session : {cardData.academicSession}
            </div>
          </div>

          {/* Member Info */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-slate-800 my-3 font-medium">
            <div className="flex items-baseline">
              <span className="font-bold shrink-0 mr-2 text-slate-900">Name:</span>
              <span className="border-b border-slate-400 flex-1 font-bold text-slate-900 px-1">{cardData.student.name}</span>
            </div>
            <div className="flex items-baseline">
              <span className="font-bold shrink-0 mr-2 text-slate-900">Father&apos;s Name:</span>
              <span className="border-b border-slate-400 flex-1 text-slate-900 px-1">{cardData.fatherName}</span>
            </div>
            <div className="flex items-baseline">
              <span className="font-bold shrink-0 mr-2 text-slate-900">Class &amp; Sec:</span>
              <span className="border-b border-slate-400 flex-1 text-slate-900 px-1">{cardData.className} - {cardData.section}</span>
            </div>
            <div className="flex items-baseline">
              <span className="font-bold shrink-0 mr-2 text-slate-900">Roll No / A/c:</span>
              <span className="border-b border-slate-400 flex-1 font-mono text-slate-900 px-1">{cardData.rollNo} / {cardData.accountNo}</span>
            </div>
          </div>

          {/* 12-Month Table */}
          <div className="mt-3 overflow-x-auto">
            <table className={`w-full text-left text-[10px] border-collapse border ${isMinimalTemplate ? 'border-slate-900' : 'border-[#2b5b84]'}`}>
              <thead className={`${isMinimalTemplate ? 'bg-slate-100 text-slate-900' : 'bg-[#d6e6f5] text-doc-deep'} font-bold uppercase text-[9px]`}>
                <tr>
                  <th className="p-1.5 border border-slate-400">MONTH</th>
                  <th className="p-1.5 border border-slate-400 text-center">ADMISSION</th>
                  <th className="p-1.5 border border-slate-400 text-center">ANNUAL</th>
                  <th className="p-1.5 border border-slate-400 text-center">TUITION</th>
                  <th className="p-1.5 border border-slate-400 text-center">TOTAL PAYABLE</th>
                  <th className="p-1.5 border border-slate-400 text-center">PAID</th>
                  <th className="p-1.5 border border-slate-400 text-center">DUES</th>
                  <th className="p-1.5 border border-slate-400 text-center">REC. NO.</th>
                </tr>
              </thead>
              <tbody>
                {cardData.months.slice(0, 6).map((row) => (
                  <tr key={row.month}>
                    <td className="p-1 font-bold border border-slate-300">{row.month}</td>
                    <td className="p-1 text-right font-mono border border-slate-300">{formatOrBlank(row.admissionFee)}</td>
                    <td className="p-1 text-right font-mono border border-slate-300">{formatOrBlank(row.annualFee)}</td>
                    <td className="p-1 text-right font-mono border border-slate-300">{formatOrBlank(row.tuitionFee)}</td>
                    <td className="p-1 text-right font-mono font-bold border border-slate-300">{formatOrBlank(row.totalPayable)}</td>
                    <td className="p-1 text-right font-mono font-bold border border-slate-300">{formatOrBlank(row.amountPaid)}</td>
                    <td className="p-1 text-right font-mono border border-slate-300">{formatOrBlank(row.dues)}</td>
                    <td className="p-1 text-center font-mono border border-slate-300">{row.receiptNo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 6. Staff Salary Slip — Respects school.staffSalarySlipTemplate
 */
function StaffSalarySlipPreview({
  school,
  staff
}: {
  school: SchoolSettings;
  staff: StaffMember;
}) {
  // Template interpretation comes from the shared salary-slip theme
  // (Fix P1-2) — the same mapping both PDF generators consume.
  const salaryTheme = getSalarySlipTheme(school.staffSalarySlipTemplate);
  const isMinimalClassic = salaryTheme.isMinimalClassic;
  // Explicit check on the template value itself, so this preview renders
  // strict B&W for 'minimal-professional' regardless of how the shared
  // theme flags it; the theme is still consumed the same way as the other
  // templates (its template id is honoured when it resolves to this value).
  const isMinimalProfessional =
    school.staffSalarySlipTemplate === 'minimal-professional' ||
    salaryTheme.template === 'minimal-professional';

  if (isMinimalProfessional) {
    return (
      <div className="w-full max-w-2xl bg-white text-black p-4 font-sans shadow-2xl space-y-3 border border-black">
        <div className="text-center border-b border-black pb-2 space-y-1">
          <h2 className="text-base font-black uppercase text-black">{school.schoolName || 'DEMO SCHOOL'}</h2>
          <p className="text-[10px] text-[#666]">{school.schoolAddress}</p>
          <span className="inline-block border border-black px-3 py-0.5 text-[11px] font-black uppercase text-black">
            OFFICIAL SALARY PAYSLIP — SEPTEMBER 2026
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px] border-b border-black pb-2 text-black">
          <div>Employee Name: <strong>{staff.name}</strong></div>
          <div>Designation: <strong>{staff.role}</strong></div>
          <div>Employee ID: <strong className="font-mono">{staff.id}</strong></div>
          <div>Department: <strong>{staff.department || 'Academics'}</strong></div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-[11px] text-black">
          <div className="border border-black p-2 space-y-1">
            <span className="font-bold border-b border-black block pb-1 uppercase text-[9px] text-black">Earnings</span>
            <div className="flex justify-between"><span>Basic Salary</span><span className="font-mono font-bold">Rs {staff.salary ? staff.salary.toLocaleString() : '65,000'}</span></div>
            <div className="flex justify-between"><span>Allowances</span><span className="font-mono">Rs 0</span></div>
            <div className="flex justify-between font-bold border-t border-black pt-1">
              <span>Gross Salary</span><span className="font-mono">Rs {staff.salary ? staff.salary.toLocaleString() : '65,000'}</span>
            </div>
          </div>

          <div className="border border-black p-2 space-y-1">
            <span className="font-bold border-b border-black block pb-1 uppercase text-[9px] text-black">Deductions</span>
            <div className="flex justify-between"><span>Tax / Provident</span><span className="font-mono">Rs 0</span></div>
            <div className="flex justify-between"><span>Leave Deduction</span><span className="font-mono">Rs 0</span></div>
            <div className="flex justify-between font-bold border-t border-black pt-1">
              <span>Total Deductions</span><span className="font-mono">Rs 0</span>
            </div>
          </div>
        </div>

        <div className="p-2 flex justify-between items-center text-[13px] font-black bg-white border border-black text-black">
          <span>NET SALARY PAYABLE:</span>
          <span className="text-sm font-mono">PKR {staff.salary ? staff.salary.toLocaleString() : '65,000'}/-</span>
        </div>

        <div className="pt-3 flex justify-between text-[11px] font-bold border-t border-black text-[#333]">
          <span>Accountant / Bursar Sign</span>
          <span>Recipient Signature</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full max-w-2xl bg-white text-black p-6 font-sans shadow-2xl space-y-4 ${
      isMinimalClassic ? 'border-2 border-black rounded-none' : 'border border-slate-300 rounded-xl'
    }`}>
      {isMinimalClassic ? (
        <div className="text-center border-b-2 border-black pb-3 space-y-1">
          <h2 className="text-lg font-black uppercase">{school.schoolName || 'DEMO SCHOOL'}</h2>
          <p className="text-[11px] text-neutral-600">{school.schoolAddress}</p>
          <span className="inline-block border border-black px-3 py-0.5 text-xs font-black uppercase">
            OFFICIAL SALARY PAYSLIP — SEPTEMBER 2026
          </span>
        </div>
      ) : (
        <div className="bg-slate-900 text-white p-4 rounded-xl flex items-center justify-between">
          <div>
            <h2 className="text-base font-black uppercase tracking-tight">{school.schoolName || 'DEMO SCHOOL'}</h2>
            <p className="text-[11px] text-slate-300">{school.campusName || 'Main Campus'} • {school.schoolAddress}</p>
          </div>
          <div className="text-right">
            <span className="inline-block bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 px-3 py-1 rounded-lg text-[10px] font-black uppercase">
              SALARY SLIP
            </span>
            <p className="text-[10px] text-slate-400 mt-1">September 2026</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 text-xs border-b border-slate-300 pb-3">
        <div>Employee Name: <strong>{staff.name}</strong></div>
        <div>Designation: <strong>{staff.role}</strong></div>
        <div>Employee ID: <strong className="font-mono">{staff.id}</strong></div>
        <div>Department: <strong>{staff.department || 'Academics'}</strong></div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-xs">
        <div className="border border-slate-300 rounded-lg p-3 space-y-1.5">
          <span className="font-bold border-b border-slate-200 block pb-1 uppercase text-[10px] text-slate-500">Earnings</span>
          <div className="flex justify-between"><span>Basic Salary</span><span className="font-mono font-bold">Rs {staff.salary ? staff.salary.toLocaleString() : '65,000'}</span></div>
          <div className="flex justify-between"><span>Allowances</span><span className="font-mono">Rs 0</span></div>
          <div className="flex justify-between font-bold border-t border-slate-200 pt-1">
            <span>Gross Salary</span><span className="font-mono">Rs {staff.salary ? staff.salary.toLocaleString() : '65,000'}</span>
          </div>
        </div>

        <div className="border border-slate-300 rounded-lg p-3 space-y-1.5">
          <span className="font-bold border-b border-slate-200 block pb-1 uppercase text-[10px] text-slate-500">Deductions</span>
          <div className="flex justify-between"><span>Tax / Provident</span><span className="font-mono">Rs 0</span></div>
          <div className="flex justify-between"><span>Leave Deduction</span><span className="font-mono">Rs 0</span></div>
          <div className="flex justify-between font-bold border-t border-slate-200 pt-1">
            <span>Total Deductions</span><span className="font-mono">Rs 0</span>
          </div>
        </div>
      </div>

      <div className={`p-3 flex justify-between items-center text-sm font-black ${
        isMinimalClassic
          ? 'bg-neutral-100 border-2 border-black text-black'
          : 'bg-emerald-50 border border-emerald-300 text-emerald-950 rounded-xl'
      }`}>
        <span>NET SALARY PAYABLE:</span>
        <span className="text-base font-mono">PKR {staff.salary ? staff.salary.toLocaleString() : '65,000'}/-</span>
      </div>

      <div className="pt-4 flex justify-between text-xs font-bold border-t border-slate-300 text-slate-600">
        <span>Accountant / Bursar Sign</span>
        <span>Recipient Signature</span>
      </div>
    </div>
  );
}

/**
 * 7. Exam DMC / Report Card — Respects school.examDmcTemplate
 */
function ExamDmcPreview({
  school,
  student,
  exam
}: {
  school: SchoolSettings;
  student: Student;
  exam: Exam;
}) {
  const isMinimalProfessional = school.examDmcTemplate === 'minimal-professional';
  const isMinimalDmc = school.examDmcTemplate === 'minimal-classic';

  if (isMinimalProfessional) {
    return (
      <div className="w-full max-w-2xl bg-white text-black p-4 font-sans shadow-2xl space-y-3 border border-black">
        <div className="flex items-center justify-between pb-2 border-b border-black">
          <div>
            <h2 className="text-base font-black uppercase text-black">
              {school.schoolName || 'DEMO SCHOOL'}
            </h2>
            <p className="text-[10px] font-semibold text-[#666]">{exam.name || 'Annual Examination 2026'}</p>
          </div>
          <span className="inline-block bg-black text-white px-3 py-1 text-[11px] font-black uppercase">
            D.M.C
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px] p-2 border border-black bg-white text-black">
          <div>Student: <strong>{student.name}</strong></div>
          <div>Father Name: <strong>{student.fatherName || 'Ahmad Khan'}</strong></div>
          <div>Class: <strong>{student.class} - {student.section || 'A'}</strong></div>
          <div>Roll Number: <strong className="font-mono">{student.rollNo || '01'}</strong></div>
        </div>

        <table className="w-full text-[11px] border border-black border-collapse text-black">
          <thead>
            <tr className="bg-black text-white font-bold text-[10px] uppercase">
              <th className="p-1.5 border-r border-[#666] text-left">Subject</th>
              <th className="p-1.5 border-r border-[#666] text-center">Max Marks</th>
              <th className="p-1.5 border-r border-[#666] text-center">Passing</th>
              <th className="p-1.5 border-r border-[#666] text-center">Obtained</th>
              <th className="p-1.5 text-center">Grade</th>
            </tr>
          </thead>
          <tbody>
            {[
              { name: 'Mathematics', max: 100, pass: 33, obt: 92, grade: 'A+' },
              { name: 'English', max: 100, pass: 33, obt: 88, grade: 'A' },
              { name: 'General Science', max: 100, pass: 33, obt: 94, grade: 'A+' },
              { name: 'Urdu', max: 100, pass: 33, obt: 85, grade: 'A' },
              { name: 'Islamiat', max: 50, pass: 17, obt: 47, grade: 'A+' },
            ].map((row, i) => (
              <tr key={i} className="border-b border-[#999] text-[10px] text-black">
                <td className="p-1 border-r border-[#999] font-bold">{row.name}</td>
                <td className="p-1 border-r border-[#999] text-center font-mono">{row.max}</td>
                <td className="p-1 border-r border-[#999] text-center font-mono">{row.pass}</td>
                <td className="p-1 border-r border-[#999] text-center font-mono font-bold">{row.obt}</td>
                <td className="p-1 text-center font-black text-black">{row.grade}</td>
              </tr>
            ))}
            <tr className="bg-white font-black border-t border-black text-black">
              <td className="p-1 border-r border-[#999]">Grand Total</td>
              <td className="p-1 border-r border-[#999] text-center font-mono">450</td>
              <td className="p-1 border-r border-[#999] text-center font-mono">—</td>
              <td className="p-1 border-r border-[#999] text-center font-mono">406</td>
              <td className="p-1 text-center text-black">90.2% (A+)</td>
            </tr>
          </tbody>
        </table>

        <div className="pt-3 flex justify-between text-[11px] font-bold border-t border-black text-black">
          <span>Class Incharge</span>
          <span>Exam Controller</span>
          <span>{school.principalName || 'Principal'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full max-w-2xl bg-white text-black p-6 font-sans shadow-2xl space-y-4 ${
      isMinimalDmc ? 'border border-black rounded-none' : 'border-2 border-slate-300 rounded-2xl'
    }`}>
      <div className={`flex items-center justify-between pb-3 ${isMinimalDmc ? 'border-b-2 border-black' : 'border-b-2 border-blue-900'}`}>
        <div>
          <h2 className={`text-base font-black uppercase ${isMinimalDmc ? 'text-black' : 'text-blue-950'}`}>
            {school.schoolName || 'DEMO SCHOOL'}
          </h2>
          <p className="text-[11px] font-semibold text-neutral-600">{exam.name || 'Annual Examination 2026'}</p>
        </div>
        <span className={`inline-block text-white px-3 py-1 text-xs font-black uppercase rounded ${isMinimalDmc ? 'bg-black' : 'bg-blue-900'}`}>
          D.M.C
        </span>
      </div>

      <div className={`grid grid-cols-2 gap-3 text-xs p-3 ${isMinimalDmc ? 'border border-black bg-white' : 'bg-slate-50 border border-slate-200 rounded-xl'}`}>
        <div>Student: <strong>{student.name}</strong></div>
        <div>Father Name: <strong>{student.fatherName || 'Ahmad Khan'}</strong></div>
        <div>Class: <strong>{student.class} - {student.section || 'A'}</strong></div>
        <div>Roll Number: <strong className="font-mono">{student.rollNo || '01'}</strong></div>
      </div>

      <table className="w-full text-xs border border-black border-collapse">
        <thead>
          <tr className={`text-white font-bold text-[11px] uppercase ${isMinimalDmc ? 'bg-black' : 'bg-blue-900'}`}>
            <th className="p-2 border-r border-slate-600 text-left">Subject</th>
            <th className="p-2 border-r border-slate-600 text-center">Max Marks</th>
            <th className="p-2 border-r border-slate-600 text-center">Passing</th>
            <th className="p-2 border-r border-slate-600 text-center">Obtained</th>
            <th className="p-2 text-center">Grade</th>
          </tr>
        </thead>
        <tbody>
          {[
            { name: 'Mathematics', max: 100, pass: 33, obt: 92, grade: 'A+' },
            { name: 'English', max: 100, pass: 33, obt: 88, grade: 'A' },
            { name: 'General Science', max: 100, pass: 33, obt: 94, grade: 'A+' },
            { name: 'Urdu', max: 100, pass: 33, obt: 85, grade: 'A' },
            { name: 'Islamiat', max: 50, pass: 17, obt: 47, grade: 'A+' },
          ].map((row, i) => (
            <tr key={i} className="border-b border-neutral-300 text-[11px]">
              <td className="p-1.5 border-r border-neutral-300 font-bold">{row.name}</td>
              <td className="p-1.5 border-r border-neutral-300 text-center font-mono">{row.max}</td>
              <td className="p-1.5 border-r border-neutral-300 text-center font-mono">{row.pass}</td>
              <td className="p-1.5 border-r border-neutral-300 text-center font-mono font-bold">{row.obt}</td>
              <td className="p-1.5 text-center font-black text-blue-900">{row.grade}</td>
            </tr>
          ))}
          <tr className="bg-neutral-100 font-black border-t-2 border-black">
            <td className="p-1.5 border-r border-neutral-300">Grand Total</td>
            <td className="p-1.5 border-r border-neutral-300 text-center font-mono">450</td>
            <td className="p-1.5 border-r border-neutral-300 text-center font-mono">—</td>
            <td className="p-1.5 border-r border-neutral-300 text-center font-mono">406</td>
            <td className="p-1.5 text-center text-emerald-800">90.2% (A+)</td>
          </tr>
        </tbody>
      </table>

      <div className="pt-4 flex justify-between text-xs font-bold border-t border-slate-300">
        <span>Class Incharge</span>
        <span>Exam Controller</span>
        <span>{school.principalName || 'Principal'}</span>
      </div>
    </div>
  );
}

/**
 * 8. Attendance Register — Respects school.attendanceRegisterTemplate
 */
function AttendanceRegisterPreview({
  school,
  student
}: {
  school: SchoolSettings;
  student: Student;
}) {
  const isMinimalProfessional = school.attendanceRegisterTemplate === 'minimal-professional';
  const isCompactMono = school.attendanceRegisterTemplate === 'compact-monochrome';
  const days = ['Mon (07)', 'Tue (08)', 'Wed (09)', 'Thu (10)', 'Fri (11)', 'Sat (12)', 'Sun (13)'];

  if (isMinimalProfessional) {
    return (
      <div className="w-full max-w-4xl bg-white text-black p-4 font-sans shadow-2xl space-y-3 border border-black">
        <div className="text-center border-b border-black pb-2 space-y-1">
          <h2 className="text-base font-black uppercase text-black">{school.schoolName || 'DEMO SCHOOL'}</h2>
          <div className="flex items-center justify-center gap-2">
            <span className="inline-block px-3 py-0.5 text-[11px] font-black uppercase border border-black text-black bg-white">
              OFFICIAL WEEKLY ATTENDANCE REGISTER (STUDENTS)
            </span>
            <span className="px-2 py-0.5 bg-white border border-black text-[9px] font-bold text-black">
              SESSION {school.session || '2025-2026'}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[10px] border border-black border-collapse text-black">
            <thead>
              <tr className="bg-white text-black font-bold border-b border-black">
                <th className="p-1.5 border-r border-black text-left">Student Name</th>
                <th className="p-1.5 border-r border-black text-center">Class</th>
                {days.map((d) => (
                  <th key={d} className="p-1.5 border-r border-black text-center font-mono text-[9px]">
                    {d}
                  </th>
                ))}
                <th className="p-1.5 text-center font-bold">Att %</th>
              </tr>
            </thead>
            <tbody>
              {[student.name, 'Zainab Bibi', 'Ahmed Raza', 'Fatima Zahra'].map((name, sIdx) => (
                <tr key={name} className="border-b border-[#999]">
                  <td className="p-1.5 border-r border-[#999] font-bold">{name}</td>
                  <td className="p-1.5 border-r border-[#999] text-center">{student.class} ({student.section || 'A'})</td>
                  {days.map((d, i) => {
                    const isSun = i === 6;
                    const isAbs = !isSun && (i + sIdx) % 5 === 0;
                    return (
                      <td key={d} className="p-1 border-r border-[#999] text-center font-mono font-bold text-black">
                        {isSun ? '-' : isAbs ? 'A' : 'P'}
                      </td>
                    );
                  })}
                  <td className="p-1.5 text-center font-black">{sIdx % 2 === 0 ? '100%' : '83%'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pt-3 flex justify-between text-[11px] font-bold border-t border-black text-[#333]">
          <span>Class Teacher Signature: ____________</span>
          <span>Principal / Administrator: ____________</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full max-w-4xl bg-white text-black p-6 font-sans shadow-2xl space-y-4 ${
      isCompactMono ? 'border border-black rounded-none' : 'border border-slate-300 rounded-xl'
    }`}>
      <div className="text-center border-b-2 border-slate-900 pb-3 space-y-1">
        <h2 className="text-lg font-black uppercase">{school.schoolName || 'DEMO SCHOOL'}</h2>
        <div className="flex items-center justify-center gap-2">
          <span className={`inline-block px-3 py-0.5 text-xs font-black uppercase rounded ${
            isCompactMono ? 'border-2 border-black text-black bg-white' : 'bg-slate-900 text-white'
          }`}>
            OFFICIAL WEEKLY ATTENDANCE REGISTER (STUDENTS)
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-300 text-[10px] font-bold text-slate-700">
            SESSION {school.session || '2025-2026'}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[11px] border border-slate-300 border-collapse">
          <thead>
            <tr className={isCompactMono ? 'bg-neutral-200 text-black font-bold border-b border-black' : 'bg-slate-900 text-white font-semibold'}>
              <th className="p-2 border-r border-slate-600 text-left">Student Name</th>
              <th className="p-2 border-r border-slate-600 text-center">Class</th>
              {days.map((d) => (
                <th key={d} className="p-2 border-r border-slate-600 text-center font-mono text-[10px]">
                  {d}
                </th>
              ))}
              <th className="p-2 text-center font-bold">Att %</th>
            </tr>
          </thead>
          <tbody>
            {[student.name, 'Zainab Bibi', 'Ahmed Raza', 'Fatima Zahra'].map((name, sIdx) => (
              <tr key={name} className="border-b border-slate-200">
                <td className="p-2 border-r border-slate-200 font-bold">{name}</td>
                <td className="p-2 border-r border-slate-200 text-center">{student.class} ({student.section || 'A'})</td>
                {days.map((d, i) => {
                  const isSun = i === 6;
                  const isAbs = !isSun && (i + sIdx) % 5 === 0;
                  return (
                    <td key={d} className="p-1.5 border-r border-slate-200 text-center font-mono font-bold">
                      <span className={`inline-block w-6 py-0.5 rounded text-[10px] ${
                        isSun
                          ? 'bg-slate-100 text-slate-400'
                          : isAbs
                            ? 'bg-red-100 text-red-800 border border-red-300'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      }`}>
                        {isSun ? '-' : isAbs ? 'A' : 'P'}
                      </span>
                    </td>
                  );
                })}
                <td className="p-2 text-center font-black">{sIdx % 2 === 0 ? '100%' : '83%'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pt-4 flex justify-between text-xs font-bold border-t border-slate-300 text-slate-600">
        <span>Class Teacher Signature: ____________</span>
        <span>Principal / Administrator: ____________</span>
      </div>
    </div>
  );
}
