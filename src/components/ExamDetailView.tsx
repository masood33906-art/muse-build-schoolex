import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  FileSpreadsheet,
  Download, 
  Edit3, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  BarChart3, 
  GraduationCap, 
  Users, 
  Save, 
  Plus, 
  Trash2, 
  Award, 
  Layers, 
  Check, 
  ChevronRight, 
  Clock, 
  ChevronDown,
  ArrowDownWideNarrow,
  ArrowLeft,
  User,
  ArrowDown,
  X
} from 'lucide-react';
import { Exam, ExamSubject, ExamGradingTier, StudentMarkEntry, calculateGrade, saveStoredExams, getStoredExams } from '../utils/examStore';
import { Student, ClassInfo } from '../types';
import { compareStudentsByRoll } from '../utils/rollNumber';
import { SchoolSettings } from '../utils/settingsHelper';
import { findClassByName, studentsInClassSection } from '../utils/classExportHelper';
import { ExamDetailExportModal, ExamExportType } from './ExamDetailExportModal';
import { localISODate, parseSubjectStartDate } from '../utils/dates';
import { RollNumberSlipsModal } from './RollNumberSlipsModal';
import { BreadcrumbTrail } from './BreadcrumbTrail';

interface ExamDetailViewProps {
  exam: Exam;
  onBack: () => void;
  onBreadcrumbOverview?: () => void;
  onUpdateExam: (updated: Exam) => void;
  students: Student[];
  classes: ClassInfo[];
  schoolSettings?: SchoolSettings;
  onShowToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export const ExamDetailView: React.FC<ExamDetailViewProps> = ({
  exam,
  onBack,
  onBreadcrumbOverview,
  onUpdateExam,
  students,
  classes,
  schoolSettings,
  onShowToast
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'marks' | 'summary' | 'schedule'>('marks');
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const [activeExportType, setActiveExportType] = useState<ExamExportType | null>(null);
  const [isRollSlipsModalOpen, setIsRollSlipsModalOpen] = useState(false);
  const [hasUnsavedMarksChanges, setHasUnsavedMarksChanges] = useState<boolean>(false);

  // Modals for editing
  const [isEditingMarksModalOpen, setIsEditingMarksModalOpen] = useState(false);
  const [isEditingGradingModalOpen, setIsEditingGradingModalOpen] = useState(false);
  const [isEditExamModalOpen, setIsEditExamModalOpen] = useState(false);

  // Edit exam form state
  const [editExamName, setEditExamName] = useState(exam.name);
  const [editExamClass, setEditExamClass] = useState(exam.class);
  const [editExamSection, setEditExamSection] = useState(exam.section);
  const [editExamSubjects, setEditExamSubjects] = useState<ExamSubject[]>(exam.subjects);
  const [newSubName, setNewSubName] = useState('');

  const handleOpenEditModal = () => {
    setEditExamName(exam.name);
    setEditExamClass(exam.class);
    setEditExamSection(exam.section);
    setEditExamSubjects(exam.subjects);
    setIsEditExamModalOpen(true);
  };

  const handleSaveExamDetails = () => {
    const updated: Exam = {
      ...exam,
      name: editExamName.trim() || exam.name,
      class: editExamClass,
      section: editExamSection,
      subjects: editExamSubjects
    };
    onUpdateExam(updated);
    setIsEditExamModalOpen(false);
    if (onShowToast) {
      onShowToast(`Exam details updated successfully!`, 'success');
    }
  };

  // Subject total marks state for quick edit
  const [tempSubjectMarks, setTempSubjectMarks] = useState<Record<string, number>>(
    exam.subjects.reduce((acc, sub) => ({ ...acc, [sub.id]: sub.totalMarks || 100 }), {})
  );

  // Enrolled students for this exam — the shared class+section rule
  // (Fix P1-4): classId-first class matching (trimmed name fallback) and
  // EXACT section matching. The old inline predicate treated a recorded
  // section 'A' as a wildcard matching every section of the class.
  const examClassInfo = findClassByName(classes, exam.class);
  const enrolledStudents = studentsInClassSection(students || [], examClassInfo ?? exam.class, exam.section);

  // Student marks input state for Student Marks tab
  const [editableMarks, setEditableMarks] = useState<Record<string, Record<string, number | string>>>(() => {
    const initial: Record<string, Record<string, number | string>> = {};
    const relevantStudents = enrolledStudents;
    const list = relevantStudents.length > 0 
      ? relevantStudents 
      : (Object.values(exam.studentMarks) as any[]).map(sm => ({
          id: sm.studentId,
          name: sm.studentName,
          family: sm.fatherName || 'Guardian',
          class: exam.class,
          section: exam.section,
          status: 'Active' as const,
          rollNo: sm.rollNo
        }));

    list.forEach(st => {
      initial[st.id] = {};
      exam.subjects.forEach(sub => {
        const val = exam.studentMarks[st.id]?.marks[sub.id];
        initial[st.id][sub.id] = typeof val === 'number' ? val : '';
      });
    });
    return initial;
  });

  const activeStudentList = enrolledStudents.length > 0 
    ? enrolledStudents 
    : Object.keys(exam.studentMarks).length > 0
      ? (Object.values(exam.studentMarks) as any[]).map(sm => ({
          id: sm.studentId,
          name: sm.studentName,
          family: sm.fatherName || 'Guardian',
          familyId: 'F-001',
          class: exam.class,
          section: exam.section,
          status: 'Active' as const,
          rollNo: sm.rollNo
        }))
      : students.slice(0, 5);

  const hasAnyMissingMarks = exam.subjects.some(s => !s.totalMarks || s.totalMarks <= 0);

  // Check if any student marks have already been submitted/saved for this exam
  const hasSubmittedMarks = exam.resultsCount > 0 || (
    Boolean(exam.studentMarks) && 
    (Object.values(exam.studentMarks) as StudentMarkEntry[]).some(
      sm => sm?.marks && Object.values(sm.marks).some(m => typeof m === 'number')
    )
  );

  // Track custom ordered student IDs (always maintained in descending order of percentage)
  const [studentOrder, setStudentOrder] = useState<string[] | null>(() => {
    // If exam already has saved marks, initialize ordered descending by percentage
    if (exam.studentMarks && Object.keys(exam.studentMarks).length > 0) {
      const totalMax = exam.subjects.reduce((sum, s) => sum + (s.totalMarks || 100), 0);
      const list = activeStudentList.map(st => {
        const sm = exam.studentMarks[st.id];
        let totalObt = 0;
        let hasMarks = false;
        if (sm?.marks) {
          Object.values(sm.marks).forEach(val => {
            if (typeof val === 'number') {
              totalObt += val;
              hasMarks = true;
            }
          });
        }
        const pct = totalMax > 0 && hasMarks ? (totalObt / totalMax) * 100 : 0;
        return { id: st.id, pct, totalObt, hasMarks, rollNo: st.rollNo || '', name: st.name };
      });

      list.sort((a, b) => {
        if (a.hasMarks && !b.hasMarks) return -1;
        if (!a.hasMarks && b.hasMarks) return 1;
        if (b.pct !== a.pct) return b.pct - a.pct;
        if (b.totalObt !== a.totalObt) return b.totalObt - a.totalObt;
        // Tie-break by roll NUMERICALLY (2 before 10) — a plain string
        // compare of rolls ordered '10' before '2' (utils/rollNumber.ts).
        return compareStudentsByRoll(a, b);
      });

      return list.map(item => item.id);
    }
    return null;
  });

  const [isSortedByPercentage, setIsSortedByPercentage] = useState<boolean>(() => {
    return !!(exam.studentMarks && Object.keys(exam.studentMarks).length > 0);
  });

  // Helper to compute stats for a student based on current editableMarks
  const getStudentMarksStats = (studentId: string, currentMarks = editableMarks) => {
    let totalObt = 0;
    let hasInput = false;

    exam.subjects.forEach(sub => {
      const raw = currentMarks[studentId]?.[sub.id];
      if (raw !== undefined && raw !== '' && raw !== null) {
        const num = Number(raw);
        if (!isNaN(num)) {
          totalObt += num;
          hasInput = true;
        }
      }
    });

    const totalMax = exam.subjects.reduce((sum, s) => sum + (s.totalMarks || 100), 0);
    const percentage = totalMax > 0 && hasInput ? (totalObt / totalMax) * 100 : 0;
    return { totalObt, totalMax, percentage, hasInput };
  };

  // Reorganize students to descending order of percentage of total marks
  const sortStudentsByDescendingPercentage = (currentMarksState = editableMarks, customList?: typeof activeStudentList) => {
    const listToSort = customList || activeStudentList;
    const sorted = [...listToSort].sort((a, b) => {
      const statA = getStudentMarksStats(a.id, currentMarksState);
      const statB = getStudentMarksStats(b.id, currentMarksState);

      // 1. Students with entered marks appear before students with no marks entered yet
      if (statA.hasInput && !statB.hasInput) return -1;
      if (!statA.hasInput && statB.hasInput) return 1;

      // 2. Both have marks: sort descending by percentage of total marks
      if (statB.percentage !== statA.percentage) {
        return statB.percentage - statA.percentage;
      }

      // 3. Tie-breaker: sort descending by total marks obtained
      if (statB.totalObt !== statA.totalObt) {
        return statB.totalObt - statA.totalObt;
      }

      // 4. Secondary tie-breaker: sort by roll number (numeric — 2
      // before 10) or student name (utils/rollNumber.ts)
      return compareStudentsByRoll(a, b);
    });

    setStudentOrder(sorted.map(s => s.id));
    setIsSortedByPercentage(true);
    return sorted;
  };

  // Computed evaluation summary statistics matching reference Image
  const resultsSummaryData = useMemo(() => {
    const evaluated: {
      student: Student;
      totalObt: number;
      totalMax: number;
      percentage: number;
      grade: string;
      passed: boolean;
      subMarks: Record<string, number | null>;
    }[] = [];

    const totalExamMaxMarks = exam.subjects.reduce((sum, s) => sum + (s.totalMarks || 100), 0);

    activeStudentList.forEach(st => {
      let totalObt = 0;
      let hasMarks = false;
      let allPassed = true;
      const subMarks: Record<string, number | null> = {};

      exam.subjects.forEach(sub => {
        const raw = editableMarks[st.id]?.[sub.id];
        if (raw !== undefined && raw !== '' && raw !== null) {
          const num = Number(raw);
          if (!isNaN(num)) {
            totalObt += num;
            hasMarks = true;
            subMarks[sub.id] = num;
            const passing = sub.passingMarks || Math.round((sub.totalMarks || 100) * 0.33);
            if (num < passing) {
              allPassed = false;
            }
          } else {
            subMarks[sub.id] = null;
          }
        } else {
          subMarks[sub.id] = null;
        }
      });

      if (hasMarks) {
        const percentage = totalExamMaxMarks > 0 ? (totalObt / totalExamMaxMarks) * 100 : 0;
        const gradeObj = calculateGrade(percentage, exam.gradingSchema);
        evaluated.push({
          student: st,
          totalObt,
          totalMax: totalExamMaxMarks,
          percentage,
          grade: gradeObj.grade,
          passed: allPassed,
          subMarks
        });
      }
    });

    const studentsAppeared = evaluated.length;
    const classAverage = studentsAppeared > 0
      ? evaluated.reduce((sum, e) => sum + e.percentage, 0) / studentsAppeared
      : 0;

    const percentages = evaluated.map(e => e.percentage);
    const highestScore = percentages.length > 0 ? Math.max(...percentages) : 0;
    const lowestScore = percentages.length > 0 ? Math.min(...percentages) : 0;
    const passedCount = evaluated.filter(e => e.passed).length;
    const failedCount = evaluated.filter(e => !e.passed).length;

    // Grade tiers in exact order as shown in reference image:
    // Top row: Grade A+, Grade A, Grade B+, Grade B, Grade C+, Grade C
    // Bottom row: Grade D, Grade E
    const gradeTiers = [
      'Grade A+',
      'Grade A',
      'Grade B+',
      'Grade B',
      'Grade C+',
      'Grade C',
      'Grade D',
      'Grade E'
    ];
    const gradeCounts: Record<string, number> = {};
    gradeTiers.forEach(g => {
      gradeCounts[g] = 0;
    });

    evaluated.forEach(e => {
      const gName = e.grade.startsWith('Grade') ? e.grade : `Grade ${e.grade}`;
      if (gradeCounts[gName] !== undefined) {
        gradeCounts[gName]++;
      } else {
        gradeCounts[gName] = (gradeCounts[gName] || 0) + 1;
      }
    });

    // Subject-wise performance
    const subjectPerformance = exam.subjects.map(sub => {
      const marksList: number[] = [];
      evaluated.forEach(e => {
        const val = e.subMarks[sub.id];
        if (typeof val === 'number') {
          marksList.push(val);
        }
      });

      const appeared = marksList.length;
      const highest = appeared > 0 ? Math.max(...marksList) : 0;
      const lowest = appeared > 0 ? Math.min(...marksList) : 0;
      const average = appeared > 0 ? marksList.reduce((a, b) => a + b, 0) / appeared : 0;
      const maxMarks = sub.totalMarks || 100;
      const performancePct = maxMarks > 0 ? (average / maxMarks) * 100 : 0;

      return {
        id: sub.id,
        name: sub.name,
        totalMarks: maxMarks,
        appeared,
        highest,
        lowest,
        average,
        performancePct
      };
    });

    // Top performers sorted by percentage descending
    const topPerformers = [...evaluated].sort((a, b) => {
      if (b.percentage !== a.percentage) return b.percentage - a.percentage;
      return b.totalObt - a.totalObt;
    });

    return {
      studentsAppeared,
      classAverage,
      highestScore,
      lowestScore,
      passedCount,
      failedCount,
      gradeTiers,
      gradeCounts,
      subjectPerformance,
      topPerformers
    };
  }, [activeStudentList, editableMarks, exam.subjects, exam.gradingSchema]);

  // Handle student mark input with <= 100 constraint
  const handleStudentMarkChange = (studentId: string, subjectId: string, rawVal: string) => {
    let sanitized = rawVal;
    if (sanitized !== '') {
      const num = Number(sanitized);
      if (!isNaN(num)) {
        if (num > 100) {
          sanitized = '100';
        } else if (num < 0) {
          sanitized = '0';
        }
      }
    }

    setEditableMarks(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [subjectId]: sanitized
      }
    }));
    setHasUnsavedMarksChanges(true);
  };

  // Display list honoring studentOrder if set
  const displayStudentList = useMemo(() => {
    if (!studentOrder || studentOrder.length === 0) {
      return activeStudentList;
    }
    const studentMap = new Map(activeStudentList.map(s => [s.id, s]));
    const result: typeof activeStudentList = [];

    studentOrder.forEach(id => {
      const st = studentMap.get(id);
      if (st) {
        result.push(st);
        studentMap.delete(id);
      }
    });

    studentMap.forEach(st => {
      result.push(st);
    });

    return result;
  }, [activeStudentList, studentOrder]);

  const handleSaveMarks = () => {
    // 1. Reorganize students to descending order of percentage of total marks upon save
    const sortedList = sortStudentsByDescendingPercentage(editableMarks);

    const updatedStudentMarks: Record<string, any> = { ...exam.studentMarks };
    let filledCount = 0;

    sortedList.forEach((st, idx) => {
      const studentSubMarks: Record<string, number | null> = {};
      let hasAny = false;

      exam.subjects.forEach(sub => {
        const raw = editableMarks[st.id]?.[sub.id];
        if (raw !== undefined && raw !== '' && raw !== null) {
          const num = Number(raw);
          if (!isNaN(num)) {
            studentSubMarks[sub.id] = num;
            hasAny = true;
          } else {
            studentSubMarks[sub.id] = null;
          }
        } else {
          studentSubMarks[sub.id] = null;
        }
      });

      if (hasAny) {
        filledCount++;
      }

      updatedStudentMarks[st.id] = {
        studentId: st.id,
        studentName: st.name,
        rollNo: st.rollNo || String(idx + 1).padStart(2, '0'),
        fatherName: st.family,
        marks: studentSubMarks
      };
    });

    const updatedExam: Exam = {
      ...exam,
      studentMarks: updatedStudentMarks,
      resultsCount: filledCount
    };

    onUpdateExam(updatedExam);
    setHasUnsavedMarksChanges(false);
    if (onShowToast) {
      onShowToast(`Student marks saved and reordered successfully!`, 'success');
    }
  };

  const handleSaveSubjectTotalMarks = () => {
    const updatedSubjects = exam.subjects.map(s => {
      const newTotal = tempSubjectMarks[s.id] || 100;
      return {
        ...s,
        totalMarks: newTotal,
        passingMarks: Math.round(newTotal * 0.33)
      };
    });

    const updatedExam: Exam = {
      ...exam,
      subjects: updatedSubjects
    };

    onUpdateExam(updatedExam);
    setIsEditingMarksModalOpen(false);
    if (onShowToast) {
      onShowToast('Subject total marks updated!', 'success');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Breadcrumbs matching image 1: Overview • Exams • [Exam Name] */}
      <BreadcrumbTrail
        items={[
          { label: 'Overview', onClick: onBreadcrumbOverview },
          { label: 'Exams', onClick: onBack },
          { label: exam.name }
        ]}
      />

      {/* Top Banner matching reference image */}
      <div className="p-5 sm:p-6 bg-surface-8 border border-edge-21 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-inner">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">{exam.name}</h1>
            <p className="text-xs text-slate-300 font-medium mt-0.5">
              {exam.class} - {exam.section} • {exam.subjects.length} subjects
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Created on {exam.createdAt} by {exam.createdBy || schoolSettings?.schoolName || 'Demo school'}
            </p>
          </div>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2.5 self-end sm:self-auto flex-wrap">
          {/* Send Exam Details Button */}
          <button
            type="button"
            onClick={() => onShowToast?.(`Exam details notification sent to ${exam.class} - ${exam.section}!`, 'info')}
            className="px-3.5 py-2 bg-surface-33 hover:bg-[#1a2a44] border border-edge-36 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            <Send className="w-3.5 h-3.5 text-blue-400" />
            <span>Send Exam Details</span>
          </button>

          {/* Export Dropdown Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
              className="px-3.5 py-2 bg-surface-33 hover:bg-[#1a2a44] border border-edge-36 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span>Export</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {isExportDropdownOpen && (
              <div 
                className="absolute right-0 mt-2 w-56 bg-[#10192a] border border-[#243754] rounded-xl shadow-2xl py-1.5 z-30 animate-in fade-in slide-in-from-top-2 duration-150"
                onClick={() => setIsExportDropdownOpen(false)}
              >
                <button
                  type="button"
                  onClick={() => setActiveExportType('marks-sheet')}
                  className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-[#19263e] flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-blue-400" />
                  <span className="font-semibold">Marks Sheet (Blank)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveExportType('result-sheet')}
                  className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-[#19263e] flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold">Result Gazette</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveExportType('bulk-dmc')}
                  className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-[#19263e] flex items-center gap-2.5 transition-colors border-t border-[#1c2a40] mt-1 pt-1.5 cursor-pointer"
                >
                  <Award className="w-4 h-4 text-amber-400" />
                  <span className="font-semibold">Bulk DMC Report Cards</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsExportDropdownOpen(false);
                    setIsRollSlipsModalOpen(true);
                  }}
                  className="w-full text-left px-4 py-2 text-xs text-amber-300 hover:text-white hover:bg-[#19263e] flex items-center gap-2.5 transition-colors border-t border-[#1c2a40] mt-1 pt-1.5 cursor-pointer"
                >
                  <GraduationCap className="w-4 h-4 text-amber-400" />
                  <span className="font-semibold">Roll Number Slips</span>
                </button>
              </div>
            )}
          </div>

          {/* Edit Button (Available if marks are not yet submitted) */}
          <button
            type="button"
            onClick={() => {
              if (hasSubmittedMarks) {
                if (onShowToast) {
                  onShowToast('Exam details cannot be edited after student marks have been submitted.', 'info');
                }
                return;
              }
              handleOpenEditModal();
            }}
            disabled={hasSubmittedMarks}
            title={hasSubmittedMarks ? 'Cannot edit exam: student marks have already been submitted' : 'Edit exam details and subjects'}
            className={`px-3.5 py-2 border rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${
              hasSubmittedMarks
                ? 'bg-[#101928]/60 border-edge-12 text-slate-500 cursor-not-allowed opacity-60'
                : 'bg-surface-33 hover:bg-[#1a2a44] border-edge-36 text-slate-300 hover:text-white cursor-pointer'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-[#1b283e] pb-px">
        <button
          type="button"
          onClick={() => setActiveTab('details')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 cursor-pointer ${
            activeTab === 'details'
              ? 'text-blue-400 border-blue-500 bg-blue-500/10'
              : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-surface-33'
          }`}
        >
          <FileText className="w-4 h-4" />
          Exam Details
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('marks')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 cursor-pointer ${
            activeTab === 'marks'
              ? 'text-blue-400 border-blue-500 bg-blue-500/10'
              : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-surface-33'
          }`}
        >
          <Edit3 className="w-4 h-4" />
          Student Marks ({exam.resultsCount})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('summary')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 cursor-pointer ${
            activeTab === 'summary'
              ? 'text-blue-400 border-blue-500 bg-blue-500/10'
              : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-surface-33'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Results Summary
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('schedule')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 cursor-pointer ${
            activeTab === 'schedule'
              ? 'text-blue-400 border-blue-500 bg-blue-500/10'
              : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-surface-33'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Schedule
        </button>
      </div>

      {/* TAB 1: EXAM DETAILS (Exact match of image 1) */}
      {activeTab === 'details' && (
        <div className="space-y-5">
          
          {/* Card 1: Exam Information */}
          <div className="p-6 bg-surface-8 border border-edge-21 rounded-2xl shadow-lg">
            <h2 className="text-base font-bold text-white mb-4">Exam Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Basic Information</h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-[#18253a]">
                      <span className="text-slate-400">Exam Name:</span>
                      <span className="text-white font-semibold">{exam.name}</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-[#18253a]">
                      <span className="text-slate-400">Class:</span>
                      <span className="text-white font-semibold">{exam.class}</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-[#18253a]">
                      <span className="text-slate-400">Section:</span>
                      <span className="text-white font-semibold">{exam.section}</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-slate-400">Created:</span>
                      <span className="text-white font-semibold">{exam.createdAt}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Created By</h3>
                  <p className="text-sm font-semibold text-slate-200">{exam.createdBy}</p>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Subjects ({exam.subjects.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {exam.subjects.map(s => (
                      <span
                        key={s.id}
                        className="px-3 py-1.5 bg-[#17253d] border border-[#273d62] text-blue-300 font-bold text-xs rounded-xl uppercase tracking-wider shadow-sm"
                      >
                        {s.name}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Exam Status</h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-[#18253a]">
                      <span className="text-slate-400">Results Available:</span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" />
                        Yes
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-slate-400">Students with Results:</span>
                      <span className="text-white font-semibold">{exam.resultsCount}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Subject Total Marks (Image 1) */}
          <div className="p-6 bg-surface-8 border border-edge-21 rounded-2xl shadow-lg">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-white">Subject Total Marks</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Set the total marks for each subject in this exam. This will be used to calculate percentages and grades.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingMarksModalOpen(true)}
                className="px-4 py-2 bg-surface-33 hover:bg-[#1c2d48] border border-[#253956] text-slate-200 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                Edit Marks
              </button>
            </div>

            {/* Subject Boxes */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 my-4">
              {exam.subjects.map(s => (
                <div
                  key={s.id}
                  className="p-3.5 bg-surface-22 border border-edge-25 rounded-xl text-center flex flex-col items-center justify-center gap-1"
                >
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">{s.name}</span>
                  <span className="text-base font-extrabold text-white">
                    {s.totalMarks ? `${s.totalMarks}` : <span className="text-xs text-amber-400 font-normal">Not set</span>}
                  </span>
                  <span className="text-[10px] text-slate-500">Passing: {s.passingMarks || 33}</span>
                </div>
              ))}
            </div>

            {/* Warning banner if any subject has marks not set */}
            {hasAnyMissingMarks && (
              <div className="p-3 bg-cyan-950/40 border border-cyan-500/30 rounded-xl flex items-center gap-2.5 text-xs text-cyan-300">
                <AlertCircle className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Some subjects don't have total marks set. This may affect grading calculations.</span>
              </div>
            )}
          </div>

          {/* Card 3: Grading Schema (Image 1) */}
          <div className="p-6 bg-surface-8 border border-edge-21 rounded-2xl shadow-lg">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-white">Grading Schema</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  This grading schema is used to calculate grades for this exam. Changing it will recalculate all grades.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingGradingModalOpen(true)}
                className="px-4 py-2 bg-surface-33 hover:bg-[#1c2d48] border border-[#253956] text-slate-200 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                Edit Grading
              </button>
            </div>

            {/* Grading Badges Pills */}
            <div className="flex flex-wrap gap-2.5 my-2">
              {exam.gradingSchema.map(g => (
                <div
                  key={g.grade}
                  className={`px-3 py-1.5 rounded-xl border border-slate-700/60 ${g.bgColor} flex items-center gap-1.5 text-xs font-bold`}
                >
                  <span className={g.textColor}>{g.grade}</span>
                  <span className="text-slate-400 font-normal text-[11px]">&gt;= {g.minPercentage}%</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: STUDENT MARKS ENTRY */}
      {activeTab === 'marks' && (
        <div className="p-4 sm:p-5 bg-surface-8 border border-edge-21 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <h2 className="text-sm sm:text-base font-bold text-white">Student Marks</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-33 text-slate-400 border border-edge-32">
                {displayStudentList.length} Students
              </span>
            </div>

            {/* Save Marks ONLY appears when changes are made */}
            {hasUnsavedMarksChanges && (
              <button
                type="button"
                onClick={handleSaveMarks}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer active:scale-95 animate-in fade-in zoom-in-95 duration-150"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Marks</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto border border-edge-25 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-22 text-slate-300 font-semibold border-b border-edge-25">
                  <th className="p-3 border-r border-edge-25 w-12 text-center">#</th>
                  <th className="p-3 border-r border-edge-25 min-w-[150px]">Student Name</th>
                  {exam.subjects.map(s => (
                    <th key={s.id} className="p-3 border-r border-edge-25 text-center min-w-[85px]">
                      <span className="block font-bold text-white">{s.name}</span>
                      <span className="text-[10px] text-slate-400 font-normal">/ 100</span>
                    </th>
                  ))}
                  <th className="p-3 border-r border-edge-25 text-center min-w-[75px]">Total</th>
                  <th className="p-3 border-r border-edge-25 text-center min-w-[80px]">%</th>
                  <th className="p-3 border-r border-edge-25 text-center min-w-[65px]">Grade</th>
                  <th className="p-3 text-center min-w-[80px]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#18263c]">
                {displayStudentList.map((st, idx) => {
                  const stats = getStudentMarksStats(st.id);
                  const totalObt = stats.totalObt;
                  const hasInput = stats.hasInput;
                  const pct = stats.percentage;
                  const gradeObj = calculateGrade(pct, exam.gradingSchema);

                  return (
                    <tr key={st.id} className="hover:bg-[#142136] transition-colors">
                      <td className="p-3 text-center border-r border-edge-21">
                        {hasInput ? (
                          idx === 0 ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 text-[11px]">
                              1
                            </span>
                          ) : idx === 1 ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-300/20 text-slate-200 font-bold border border-slate-300/40 text-[11px]">
                              2
                            </span>
                          ) : idx === 2 ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-700/20 text-amber-400 font-bold border border-amber-700/40 text-[11px]">
                              3
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono text-xs">{idx + 1}</span>
                          )
                        ) : (
                          <span className="text-slate-500 font-mono text-xs">{idx + 1}</span>
                        )}
                      </td>
                      <td className="p-3 font-semibold text-white border-r border-edge-21">
                        {st.name}
                      </td>
                      {exam.subjects.map(sub => {
                        const rawVal = editableMarks[st.id]?.[sub.id];
                        const val = (rawVal === undefined || rawVal === null || rawVal === '') ? '' : rawVal;
                        return (
                          <td key={sub.id} className="p-2 border-r border-edge-21 text-center">
                            <input
                              id={`mark-input-${idx}-${sub.id}`}
                              type="number"
                              min="0"
                              max="100"
                              value={val}
                              onChange={e => handleStudentMarkChange(st.id, sub.id, e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter' || e.key === 'ArrowDown') {
                                  e.preventDefault();
                                  const nextInput = document.getElementById(`mark-input-${idx + 1}-${sub.id}`) as HTMLInputElement | null;
                                  if (nextInput) {
                                    nextInput.focus();
                                    nextInput.select();
                                  }
                                } else if (e.key === 'ArrowUp') {
                                  e.preventDefault();
                                  const prevInput = document.getElementById(`mark-input-${idx - 1}-${sub.id}`) as HTMLInputElement | null;
                                  if (prevInput) {
                                    prevInput.focus();
                                    prevInput.select();
                                  }
                                }
                              }}
                              onBlur={() => sortStudentsByDescendingPercentage(editableMarks)}
                              placeholder=""
                              className="w-16 px-2 py-1.5 bg-[#0a111c] border border-edge-36 rounded-lg text-white font-bold text-center focus:outline-none focus:border-blue-500 text-xs transition-colors"
                            />
                          </td>
                        );
                      })}
                      <td className="p-3 text-center font-bold text-blue-400 border-r border-edge-21">
                        {hasInput ? totalObt : '-'}
                      </td>
                      <td className="p-3 text-center font-bold text-slate-200 border-r border-edge-21">
                        {hasInput ? `${pct.toFixed(1)}%` : '-'}
                      </td>
                      <td className="p-3 text-center border-r border-edge-21">
                        {hasInput ? (
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${gradeObj.bgColor} ${gradeObj.textColor}`}>
                            {gradeObj.grade}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {hasInput ? (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            pct >= 33 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                          }`}>
                            {pct >= 33 ? 'Pass' : 'Fail'}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[10px]">Pending</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: RESULTS SUMMARY (Exact match of reference image) */}
      {activeTab === 'summary' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Top 6 KPI Metric Cards in a single row/grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {/* 1. Students Appeared */}
            <div className="p-4 bg-surface-8 border border-edge-21 rounded-2xl flex items-center gap-3.5 shadow-sm">
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {resultsSummaryData.studentsAppeared}
                </div>
                <div className="text-xs text-slate-400 font-medium mt-0.5">
                  Students Appeared
                </div>
              </div>
            </div>

            {/* 2. Class Average */}
            <div className="p-4 bg-surface-8 border border-edge-21 rounded-2xl flex items-center gap-3.5 shadow-sm">
              <div className="w-10 h-10 rounded-full bg-success flex items-center justify-center text-white shrink-0 shadow-sm">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {resultsSummaryData.classAverage.toFixed(0)}%
                </div>
                <div className="text-xs text-slate-400 font-medium mt-0.5">
                  Class Average
                </div>
              </div>
            </div>

            {/* 3. Highest Score */}
            <div className="p-4 bg-surface-8 border border-edge-21 rounded-2xl flex items-center gap-3.5 shadow-sm">
              <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-white shrink-0 shadow-sm">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {resultsSummaryData.highestScore.toFixed(0)}%
                </div>
                <div className="text-xs text-slate-400 font-medium mt-0.5">
                  Highest Score
                </div>
              </div>
            </div>

            {/* 4. Lowest Score */}
            <div className="p-4 bg-surface-8 border border-edge-21 rounded-2xl flex items-center gap-3.5 shadow-sm">
              <div className="w-10 h-10 rounded-full bg-rose-500 flex items-center justify-center text-white shrink-0 shadow-sm">
                <ArrowDown className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {resultsSummaryData.lowestScore.toFixed(0)}%
                </div>
                <div className="text-xs text-slate-400 font-medium mt-0.5">
                  Lowest Score
                </div>
              </div>
            </div>

            {/* 5. Passed */}
            <div className="p-4 bg-surface-8 border border-edge-21 rounded-2xl flex items-center gap-3.5 shadow-sm">
              <div className="w-10 h-10 rounded-full bg-success flex items-center justify-center text-white shrink-0 shadow-sm">
                <Check className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-emerald-400 tracking-tight">
                  {resultsSummaryData.passedCount}
                </div>
                <div className="text-xs text-slate-400 font-medium mt-0.5">
                  Passed
                </div>
              </div>
            </div>

            {/* 6. Failed */}
            <div className="p-4 bg-surface-8 border border-edge-21 rounded-2xl flex items-center gap-3.5 shadow-sm">
              <div className="w-10 h-10 rounded-full bg-rose-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                <X className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-rose-400 tracking-tight">
                  {resultsSummaryData.failedCount}
                </div>
                <div className="text-xs text-slate-400 font-medium mt-0.5">
                  Failed
                </div>
              </div>
            </div>
          </div>

          {/* Grade Distribution */}
          <div className="p-6 bg-surface-8 border border-edge-21 rounded-2xl shadow-sm space-y-6">
            <h2 className="text-base font-bold text-white tracking-tight">Grade Distribution</h2>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-y-7 gap-x-4">
              {resultsSummaryData.gradeTiers.map(tier => {
                const count = resultsSummaryData.gradeCounts[tier] || 0;
                return (
                  <div key={tier} className="text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{count}</div>
                    <div className="text-xs text-slate-400 mt-1.5 font-medium">{tier}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Subject-wise Performance */}
          <div className="p-6 bg-surface-8 border border-edge-21 rounded-2xl shadow-sm space-y-4">
            <h2 className="text-base font-bold text-white tracking-tight">Subject-wise Performance</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#1c2a40] text-slate-400 font-semibold bg-surface-22/60">
                    <th className="py-3 px-4">Subject</th>
                    <th className="py-3 px-4 text-center">Appeared</th>
                    <th className="py-3 px-4 text-center">Highest</th>
                    <th className="py-3 px-4 text-center">Lowest</th>
                    <th className="py-3 px-4 text-center">Average</th>
                    <th className="py-3 px-4 min-w-[200px]">Performance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#18263c]">
                  {resultsSummaryData.subjectPerformance.map(sub => (
                    <tr key={sub.id} className="hover:bg-surface-22/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-white uppercase block text-xs tracking-wide">{sub.name}</span>
                        <span className="text-[11px] text-slate-500 font-normal">Total {sub.totalMarks} marks</span>
                      </td>
                      <td className="py-3.5 px-4 text-center text-slate-300 font-medium">
                        {sub.appeared}
                      </td>
                      <td className="py-3.5 px-4 text-center text-slate-200 font-semibold">
                        {sub.appeared > 0 ? sub.highest : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center text-slate-200 font-semibold">
                        {sub.appeared > 0 ? sub.lowest : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center text-slate-200 font-semibold">
                        {sub.appeared > 0 ? sub.average.toFixed(1) : '-'}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-[#172439] rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, Math.max(0, sub.performancePct))}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono w-12 text-right">
                            {sub.performancePct.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top Performers */}
          <div className="p-6 bg-surface-8 border border-edge-21 rounded-2xl shadow-sm space-y-4">
            <h2 className="text-base font-bold text-white tracking-tight">Top Performers</h2>
            {resultsSummaryData.topPerformers.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs bg-[#10192a] border border-[#1c2a40] rounded-xl">
                No student marks evaluated yet. Enter and save marks in the Student Marks tab to view ranking.
              </div>
            ) : (
              <div className="space-y-3">
                {resultsSummaryData.topPerformers.slice(0, 5).map((perf, idx) => {
                  if (idx === 0) {
                    return (
                      <div 
                        key={perf.student.id} 
                        className="p-3.5 sm:p-4 rounded-xl bg-[#cbf7d4] text-slate-950 flex items-center justify-between shadow-sm transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-[#16a34a] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                            1
                          </div>
                          <div>
                            <div className="font-bold text-slate-950 text-xs sm:text-sm">
                              {perf.student.name} ({perf.student.rollNo || perf.student.id})
                            </div>
                            <div className="text-[11px] text-slate-700 font-mono">
                              ID: {perf.student.id}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs sm:text-sm font-bold text-slate-950">
                            {perf.percentage.toFixed(1)}%
                          </div>
                          <div className="text-[11px] text-slate-700 font-medium">
                            {perf.totalObt} marks
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (idx === 1) {
                    return (
                      <div 
                        key={perf.student.id} 
                        className="p-3.5 sm:p-4 rounded-xl bg-surface-22 border border-edge-21 text-white flex items-center justify-between shadow-sm hover:border-[#283e60] transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                            2
                          </div>
                          <div>
                            <div className="font-bold text-white text-xs sm:text-sm">
                              {perf.student.name} ({perf.student.rollNo || perf.student.id})
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              ID: {perf.student.id}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs sm:text-sm font-bold text-white">
                            {perf.percentage.toFixed(1)}%
                          </div>
                          <div className="text-[11px] text-slate-400 font-medium">
                            {perf.totalObt} marks
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div 
                      key={perf.student.id} 
                      className="p-3.5 sm:p-4 rounded-xl bg-surface-22 border border-edge-21 text-white flex items-center justify-between shadow-sm hover:border-[#283e60] transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-[#1c2c46] text-slate-300 border border-[#2b4164] flex items-center justify-center font-bold text-xs shrink-0">
                          {idx + 1}
                        </div>
                        <div>
                          <div className="font-bold text-white text-xs sm:text-sm">
                            {perf.student.name} ({perf.student.rollNo || perf.student.id})
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            ID: {perf.student.id}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs sm:text-sm font-bold text-white">
                          {perf.percentage.toFixed(1)}%
                        </div>
                        <div className="text-[11px] text-slate-400 font-medium">
                          {perf.totalObt} marks
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: SCHEDULE */}
      {activeTab === 'schedule' && (
        <div className="p-6 bg-surface-8 border border-edge-21 rounded-2xl shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white">Examination Timetable &amp; Schedule</h2>
              <p className="text-xs text-slate-400">Chronological calendar of subjects for {exam.name}</p>
            </div>
            <button
              type="button"
              onClick={() => setIsRollSlipsModalOpen(true)}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-600/30 transition-all self-start sm:self-auto active:scale-95"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Export Roll Number Slips</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {exam.subjects.map((sub, idx) => (
              <div
                key={sub.id}
                className="p-4 bg-surface-22 border border-edge-25 rounded-xl flex items-start gap-4 hover:border-blue-500/30 transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-sm shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-white text-sm uppercase">{sub.name}</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      Max: {sub.totalMarks || 100}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-slate-300 font-medium">Exam Date &amp; Time: {sub.startDate || 'Scheduled'}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Edit Marks */}
      {isEditingMarksModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface-8 border border-[#223350] rounded-2xl p-6 shadow-2xl space-y-5">
            <h3 className="text-base font-bold text-white">Edit Subject Total Marks</h3>
            <div className="space-y-3">
              {exam.subjects.map(s => (
                <div key={s.id} className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 uppercase">{s.name}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="10"
                      max="500"
                      value={tempSubjectMarks[s.id] || 100}
                      onChange={e => setTempSubjectMarks({ ...tempSubjectMarks, [s.id]: parseInt(e.target.value) || 100 })}
                      className="w-24 px-3 py-1.5 bg-surface-33 border border-edge-36 rounded-xl text-white text-xs font-bold text-center"
                    />
                    <span className="text-xs text-slate-400">Marks</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-edge-12">
              <button
                type="button"
                onClick={() => setIsEditingMarksModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSubjectTotalMarks}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Grading */}
      {isEditingGradingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface-8 border border-[#223350] rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Edit Grading Schema</h3>
            <p className="text-xs text-slate-400">Modify threshold minimum percentages for each letter grade</p>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {exam.gradingSchema.map((g, idx) => (
                <div key={g.grade} className="flex items-center justify-between p-2 bg-surface-22 rounded-xl border border-edge-25">
                  <span className="text-xs font-bold text-white">{g.grade}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">&gt;=</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={g.minPercentage}
                      onChange={e => {
                        const val = parseInt(e.target.value) || 0;
                        const newSchema = [...exam.gradingSchema];
                        newSchema[idx] = { ...g, minPercentage: val };
                        onUpdateExam({ ...exam, gradingSchema: newSchema });
                      }}
                      className="w-16 px-2 py-1 bg-[#0c1422] border border-edge-36 rounded-lg text-white text-xs font-bold text-center"
                    />
                    <span className="text-xs text-slate-400">%</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-3 border-t border-edge-12">
              <button
                type="button"
                onClick={() => setIsEditingGradingModalOpen(false)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Exam Details */}
      {isEditExamModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-surface-8 border border-[#223350] rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between pb-3 border-b border-edge-12">
              <h3 className="text-base font-bold text-white">Edit Examination</h3>
              <button
                type="button"
                onClick={() => setIsEditExamModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">Exam Name</label>
              <input
                type="text"
                value={editExamName}
                onChange={e => setEditExamName(e.target.value)}
                className="w-full px-3.5 py-2 bg-surface-33 border border-edge-36 rounded-xl text-white text-xs font-semibold focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">Class</label>
                <select
                  value={editExamClass}
                  onChange={e => setEditExamClass(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-33 border border-edge-36 rounded-xl text-white text-xs"
                >
                  {classes.map(c => (
                    <option key={c.id || c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">Section</label>
                <select
                  value={editExamSection}
                  onChange={e => setEditExamSection(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-33 border border-edge-36 rounded-xl text-white text-xs"
                >
                  <option value="A">Section A</option>
                  <option value="B">Section B</option>
                  <option value="C">Section C</option>
                </select>
              </div>
            </div>

            {/* Subjects in Exam */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">Subjects &amp; Schedule</label>
              <div className="space-y-2 mb-2 max-h-48 overflow-y-auto pr-1">
                {editExamSubjects.map(sub => (
                  <div key={sub.id} className="p-2.5 bg-surface-22 border border-edge-25 rounded-xl flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-white uppercase">{sub.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">Max: {sub.totalMarks}</span>
                      <button
                        type="button"
                        onClick={() => setEditExamSubjects(editExamSubjects.filter(s => s.id !== sub.id))}
                        className="text-slate-400 hover:text-rose-400 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add new subject input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="New subject name..."
                  value={newSubName}
                  onChange={e => setNewSubName(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-surface-33 border border-edge-36 rounded-xl text-white text-xs placeholder-slate-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    const trimmed = newSubName.trim();
                    if (!trimmed) return;
                    // Same add-time date rule as exam creation, in this
                    // editor's ISO format: first subject -> tomorrow, each
                    // next subject -> previous subject's date + 1 day.
                    const prevSub = editExamSubjects.length > 0
                      ? parseSubjectStartDate(editExamSubjects[editExamSubjects.length - 1].startDate)
                      : null;
                    const baseDate = prevSub ? prevSub.date : new Date();
                    baseDate.setDate(baseDate.getDate() + 1);
                    setEditExamSubjects([
                      ...editExamSubjects,
                      {
                        id: `SUB-${Date.now()}`,
                        name: trimmed.toUpperCase(),
                        totalMarks: 100,
                        passingMarks: 33,
                        startDate: localISODate(baseDate)
                      }
                    ]);
                    setNewSubName('');
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-edge-12">
              <button
                type="button"
                onClick={() => setIsEditExamModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveExamDetails}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Preview Modal */}
      {activeExportType && (
        <ExamDetailExportModal
          isOpen={true}
          onClose={() => setActiveExportType(null)}
          exportType={activeExportType}
          exam={exam}
          students={students}
          classes={classes}
          schoolSettings={schoolSettings}
        />
      )}

      {/* Export Roll Number Slips Modal */}
      <RollNumberSlipsModal
        isOpen={isRollSlipsModalOpen}
        onClose={() => setIsRollSlipsModalOpen(false)}
        students={students}
        classes={classes}
        exams={getStoredExams()}
        preSelectedExamId={exam.id}
        schoolSettings={schoolSettings}
        onShowToast={onShowToast}
      />
    </div>
  );
};
