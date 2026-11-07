import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  ArrowLeft, 
  Check, 
  Calendar, 
  Plus,
  Search
} from 'lucide-react';
import { Student, ClassInfo } from '../types';
import { Exam, getStoredExams } from '../utils/examStore';
import { SchoolSettings, getSchoolSettings } from '../utils/settingsHelper';
import { 
  RollSlipData, 
  RollSlipDateSheetItem,
  generateBulkA4RollNumberSlipsPDF 
} from '../utils/rollSlipPdfGenerator';
import { getStudentAvatar } from '../utils/studentAvatarHelper';

interface RollNumberSlipsModalProps {
  isOpen: boolean;
  onClose: () => void;
  students?: Student[];
  classes?: ClassInfo[];
  exams?: Exam[];
  preSelectedExamId?: string;
  schoolSettings?: SchoolSettings;
  onShowToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
}

type TargetSelectionMode = 'classes' | 'individual';

export const RollNumberSlipsModal: React.FC<RollNumberSlipsModalProps> = ({
  isOpen,
  onClose,
  students: propStudents = [],
  classes: propClasses = [],
  exams: propExams = [],
  preSelectedExamId,
  schoolSettings,
  onShowToast
}) => {
  const students = useMemo(() => (Array.isArray(propStudents) ? propStudents : []), [propStudents]);
  const classes = useMemo(() => (Array.isArray(propClasses) ? propClasses : []), [propClasses]);
  const exams = useMemo(() => {
    if (Array.isArray(propExams) && propExams.length > 0) return propExams;
    try {
      const stored = getStoredExams();
      if (Array.isArray(stored) && stored.length > 0) return stored;
    } catch {
      // ignore
    }
    return Array.isArray(propExams) ? propExams : [];
  }, [propExams]);

  // Stage 1 = Minimal Inputs, Stage 2 = Scrollable Single-Stream PDF Preview
  const [stage, setStage] = useState<1 | 2>(1);

  // 1) Select Classes or Add Individual
  const [selectionMode, setSelectionMode] = useState<TargetSelectionMode>('classes');
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [individualStudentIds, setIndividualStudentIds] = useState<string[]>([]);
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('');

  // 2) Select ONLY ONE Upcoming Exam (represented in boxes)
  const [selectedExamId, setSelectedExamId] = useState<string>('');

  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [liveSchool, setLiveSchool] = useState<SchoolSettings>(() => schoolSettings || getSchoolSettings());

  useEffect(() => {
    setLiveSchool(schoolSettings || getSchoolSettings());
  }, [schoolSettings, isOpen]);

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<SchoolSettings>;
      if (custom.detail) {
        setLiveSchool(custom.detail);
      } else {
        setLiveSchool(getSchoolSettings());
      }
    };
    window.addEventListener('schoolSettingsUpdated', handler);
    return () => window.removeEventListener('schoolSettingsUpdated', handler);
  }, []);

  const school = liveSchool;

  // Unique sorted classes
  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    classes.forEach(c => {
      if (c.name && c.name.trim()) set.add(c.name.trim());
    });
    students.forEach(s => {
      if (s.class && s.class.trim()) set.add(s.class.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [classes, students]);

  // Upcoming exams from current date (with fallback to scheduled exams sorted by date so boxes are always available)
  const upcomingExams = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];

    const getExamEarliestDate = (exam: Exam): string => {
      const subDates = exam.subjects
        .map(s => (s.startDate ? s.startDate.split('T')[0] : ''))
        .filter(Boolean)
        .sort();
      return subDates[0] || '';
    };

    const futureOnes = exams.filter(ex => {
      const earliest = getExamEarliestDate(ex);
      return !earliest || earliest >= todayStr;
    });

    const pool = futureOnes.length > 0 ? futureOnes : exams;
    return [...pool].sort((a, b) => {
      const dA = getExamEarliestDate(a);
      const dB = getExamEarliestDate(b);
      if (dA && dB) return dA.localeCompare(dB);
      return (b.createdTimestamp || 0) - (a.createdTimestamp || 0);
    });
  }, [exams]);

  // Initialize state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStage(1);
      setIsExportingPdf(false);
      setStudentSearchQuery('');

      // Default class selection strictly from available classes
      const firstClass = availableClasses[0] || '';
      setSelectedClasses(firstClass ? [firstClass] : []);

      // Default individual student
      if (students.length > 0) {
        setIndividualStudentIds([students[0].id]);
      }

      // Default single upcoming exam selection
      const initialExam = (preSelectedExamId && upcomingExams.find(e => e.id === preSelectedExamId))
        || upcomingExams[0];

      if (initialExam) {
        setSelectedExamId(initialExam.id);
        if (initialExam.class && availableClasses.includes(initialExam.class)) {
          setSelectedClasses([initialExam.class]);
        }
      } else {
        setSelectedExamId('');
      }
    }
  }, [isOpen, preSelectedExamId, availableClasses, students, upcomingExams]);

  // Toggle a class in 'classes' mode
  const handleToggleClass = (clsName: string) => {
    setSelectedClasses(prev => {
      if (prev.includes(clsName)) {
        if (prev.length === 1) return prev;
        return prev.filter(c => c !== clsName);
      }
      return [...prev, clsName];
    });
  };

  const handleSelectAllClasses = () => {
    if (selectedClasses.length === availableClasses.length) {
      setSelectedClasses(availableClasses.slice(0, 1));
    } else {
      setSelectedClasses([...availableClasses]);
    }
  };

  // Add/Remove individual student
  const handleToggleIndividualStudent = (id: string) => {
    setIndividualStudentIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Select a single upcoming exam box
  const handleSelectExamBox = (exam: Exam) => {
    setSelectedExamId(exam.id);
  };

  // Filtered students for individual search
  const filteredSearchStudents = useMemo(() => {
    const q = studentSearchQuery.trim().toLowerCase();
    if (!q) return students.slice(0, 30);
    return students
      .filter(
        s =>
          s.name.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q) ||
          (s.class || '').toLowerCase().includes(q) ||
          (s.rollNo || '').toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [students, studentSearchQuery]);

  // Matched students according to mode
  const matchedStudents = useMemo(() => {
    if (selectionMode === 'classes') {
      const lowerSet = new Set(selectedClasses.map(c => c.toLowerCase()));
      return students.filter(s => s.class && lowerSet.has(s.class.toLowerCase()));
    } else {
      const idSet = new Set(individualStudentIds);
      return students.filter(s => idSet.has(s.id));
    }
  }, [selectionMode, selectedClasses, individualStudentIds, students]);

  // Selected single exam
  const chosenExam = useMemo(() => {
    return exams.find(e => e.id === selectedExamId) || upcomingExams[0] || null;
  }, [exams, upcomingExams, selectedExamId]);

  const effectiveExamTitle = chosenExam?.name || 'Examination';

  // Prepare RollSlipData for each matched student
  const preparedSlipsData = useMemo<RollSlipData[]>(() => {
    return matchedStudents.map((student, idx) => {
      const dateSheetEntries: RollSlipDateSheetItem[] = [];

      if (chosenExam && chosenExam.subjects.length > 0) {
        chosenExam.subjects.forEach((sub, sIdx) => {
          let examDate = sub.startDate || 'Scheduled';
          let examTime = '09:00 AM - 12:00 PM';
          if (sub.startDate && sub.startDate.includes('T')) {
            try {
              const dt = new Date(sub.startDate);
              examDate = dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
              examTime = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - 12:00 PM';
            } catch {
              // ignore
            }
          }

          dateSheetEntries.push({
            examName: effectiveExamTitle,
            subjectName: sub.name,
            date: examDate,
            time: examTime,
            totalMarks: sub.totalMarks || 100,
            passingMarks: sub.passingMarks || 33,
            room: `Hall ${String.fromCharCode(65 + (sIdx % 3))}`
          });
        });
      } else {
        dateSheetEntries.push(
          {
            examName: effectiveExamTitle,
            subjectName: 'ENGLISH',
            date: '18 Sep 2026',
            time: '09:00 AM - 12:00 PM',
            totalMarks: 100,
            passingMarks: 33,
            room: 'Hall A'
          },
          {
            examName: effectiveExamTitle,
            subjectName: 'MATHEMATICS',
            date: '19 Sep 2026',
            time: '09:00 AM - 12:00 PM',
            totalMarks: 100,
            passingMarks: 33,
            room: 'Hall A'
          }
        );
      }

      const assignedRollNo = student.rollNo || String(idx + 1).padStart(2, '0');

      return {
        student,
        rollNo: assignedRollNo,
        exams: chosenExam ? [chosenExam] : [],
        dateSheet: dateSheetEntries,
        folderName: effectiveExamTitle
      };
    });
  }, [matchedStudents, chosenExam, effectiveExamTitle]);

  const handleContinue = () => {
    if (matchedStudents.length === 0) {
      onShowToast?.('Please select at least one class or student.', 'error');
      return;
    }
    if (!chosenExam && upcomingExams.length > 0) {
      onShowToast?.('Please select an upcoming exam.', 'error');
      return;
    }
    setStage(2);
  };

  const handleDownloadPdf = async () => {
    if (preparedSlipsData.length === 0) return;
    setIsExportingPdf(true);
    try {
      await generateBulkA4RollNumberSlipsPDF(preparedSlipsData, school);
      onShowToast?.(`Downloaded Roll Number Slips PDF (${preparedSlipsData.length} slips)`, 'success');
    } catch (err) {
      console.error(err);
      onShowToast?.('Failed to export PDF.', 'error');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #scrollable-roll-slips-stream, #scrollable-roll-slips-stream * {
            visibility: visible !important;
          }
          #scrollable-roll-slips-stream {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .stream-slip-sheet {
            page-break-after: always !important;
            break-after: page !important;
            box-shadow: none !important;
            margin: 0 auto 12mm auto !important;
          }
        }
      `}</style>

      <div 
        className={`relative w-full ${
          stage === 1 ? 'max-w-xl' : 'max-w-4xl'
        } bg-[#0c1424] border border-edge-21 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-150`}
        onClick={e => e.stopPropagation()}
      >
        {/* ========================================================================= */}
        {/* STAGE 1: MINIMAL INPUTS                                                   */}
        {/* ========================================================================= */}
        {stage === 1 && (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Minimal Header */}
            <div className="px-6 py-4 border-b border-edge-11 flex items-center justify-between">
              <h2 className="text-base font-bold text-white tracking-tight">
                Generate Roll Number Slips
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#1a2942] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Minimal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* 1) Select Classes or Add Individual */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-300">
                    1. Select Classes or Individual
                  </label>
                  <div className="inline-flex rounded-lg bg-surface-22 p-0.5 border border-edge-36">
                    <button
                      type="button"
                      onClick={() => setSelectionMode('classes')}
                      className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                        selectionMode === 'classes'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Classes
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectionMode('individual')}
                      className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                        selectionMode === 'individual'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Individual
                    </button>
                  </div>
                </div>

                {selectionMode === 'classes' ? (
                  <div className="p-3 bg-[#101929] border border-[#1e2e46] rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>{selectedClasses.length} selected ({matchedStudents.length} students)</span>
                      <button
                        type="button"
                        onClick={handleSelectAllClasses}
                        className="text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                      >
                        {selectedClasses.length === availableClasses.length ? 'Reset' : 'Select All'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {availableClasses.map(cls => {
                        const active = selectedClasses.includes(cls);
                        return (
                          <button
                            key={cls}
                            type="button"
                            onClick={() => handleToggleClass(cls)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                              active
                                ? 'bg-blue-600/20 border-blue-500 text-white'
                                : 'bg-surface-33 border-edge-36 text-slate-400 hover:text-white'
                            }`}
                          >
                            {active && <Check className="w-3 h-3 text-blue-400" />}
                            <span>{cls}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-[#101929] border border-[#1e2e46] rounded-xl space-y-2.5">
                    {/* Selected Individual Student Chips */}
                    {individualStudentIds.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pb-1">
                        {individualStudentIds.map(id => {
                          const st = students.find(s => s.id === id);
                          if (!st) return null;
                          return (
                            <span
                              key={id}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-200 text-[11px] font-semibold"
                            >
                              <span>{st.name} ({st.class})</span>
                              <button
                                type="button"
                                onClick={() => handleToggleIndividualStudent(id)}
                                className="hover:text-white cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Minimal Search to Add Individual Students */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={studentSearchQuery}
                        onChange={e => setStudentSearchQuery(e.target.value)}
                        placeholder="Search student by name, roll no, or class..."
                        className="w-full pl-8 pr-3 py-2 bg-surface-33 border border-edge-36 rounded-lg text-white text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="max-h-36 overflow-y-auto divide-y divide-[#18263e] rounded-lg border border-[#1b2b44] bg-[#0d1524]">
                      {filteredSearchStudents.map(st => {
                        const isAdded = individualStudentIds.includes(st.id);
                        return (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => handleToggleIndividualStudent(st.id)}
                            className="w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-edge-2 transition-colors cursor-pointer"
                          >
                            <div>
                              <span className="font-semibold text-white">{st.name}</span>
                              <span className="text-slate-400 ml-2 text-[11px]">
                                {st.class} ({st.section || 'A'}) • Roll #{st.rollNo || '-'}
                              </span>
                            </div>
                            <span className={`text-[11px] font-bold flex items-center gap-1 ${
                              isAdded ? 'text-emerald-400' : 'text-blue-400'
                            }`}>
                              {isAdded ? (
                                <>
                                  <Check className="w-3 h-3" /> Added
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3 h-3" /> Add
                                </>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 2) Select from Upcoming Exams from Current Date (Boxes, Single Choice) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-300">
                    2. Upcoming Exams (Choose One)
                  </label>
                  <span className="text-[11px] text-slate-400">
                    From {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>

                {upcomingExams.length === 0 ? (
                  <div className="p-4 bg-[#101929] border border-[#1e2e46] rounded-xl text-xs text-slate-400 text-center">
                    No upcoming exams found.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto pr-0.5">
                    {upcomingExams.map(exam => {
                      const isSelected = selectedExamId === exam.id;
                      const firstDate = exam.subjects[0]?.startDate
                        ? exam.subjects[0].startDate.split('T')[0]
                        : exam.createdAt;
                      return (
                        <button
                          key={exam.id}
                          type="button"
                          onClick={() => handleSelectExamBox(exam)}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                            isSelected
                              ? 'bg-blue-600/20 border-blue-500 text-white shadow-md shadow-blue-950/40'
                              : 'bg-[#101929] border-[#1f2f48] text-slate-300 hover:border-slate-500'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1.5 w-full">
                            <span className="font-bold text-xs text-white line-clamp-1">
                              {exam.name}
                            </span>
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                              isSelected ? 'border-blue-400 bg-blue-600 text-white' : 'border-slate-600'
                            }`}>
                              {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <span className="inline-block px-1.5 py-0.5 rounded bg-[#17253d] text-blue-300 text-[10px] font-semibold">
                              {exam.class} ({exam.section})
                            </span>
                            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                              <Calendar className="w-3 h-3 text-slate-500 shrink-0" />
                              <span className="truncate">{firstDate}</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Minimal Footer */}
            <div className="px-6 py-3.5 border-t border-edge-11 bg-[#101b2f] flex items-center justify-between">
              <span className="text-xs text-slate-400">
                <strong className="text-white">{matchedStudents.length}</strong> slip{matchedStudents.length !== 1 ? 's' : ''} ready
              </span>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-edge-36 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleContinue}
                  disabled={matchedStudents.length === 0}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                  id="btn-continue-roll-slips"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STAGE 2: SCROLLABLE SINGLE STREAM PDF PREVIEW                             */}
        {/* ========================================================================= */}
        {stage === 2 && (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Minimal Preview Header */}
            <div className="px-5 py-3 border-b border-edge-11 bg-[#101b2f] flex items-center justify-between gap-3 print:hidden">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStage(1)}
                  className="px-3 py-1.5 rounded-lg border border-edge-36 bg-surface-33 hover:bg-[#1a2a44] text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
                <span className="text-xs font-bold text-white">
                  {effectiveExamTitle} — {preparedSlipsData.length} Roll Number Slip{preparedSlipsData.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3 py-1.5 bg-surface-33 hover:bg-[#1a2a44] border border-edge-36 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Printer className="w-3.5 h-3.5 text-blue-400" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isExportingPdf}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isExportingPdf ? 'Generating...' : 'Download PDF'}</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-[#1a2942] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Continuous Scrollable One-Stream of Slips */}
            <div 
              id="scrollable-roll-slips-stream"
              className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#080d17] space-y-5 flex flex-col items-center"
            >
              {preparedSlipsData.map((slip, index) => (
                <div
                  key={`${slip.student.id}-${index}`}
                  className="stream-slip-sheet w-full max-w-[620px] bg-white text-black p-5 rounded shadow-xl border border-black/80 font-sans select-text shrink-0"
                >
                  <MinimalStreamSlipCard 
                    slip={slip} 
                    school={school} 
                    examTitle={effectiveExamTitle}
                    index={index + 1}
                    total={preparedSlipsData.length}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Shared Roll Number Slip Card used identically in Settings -> Templates and RollNumberSlipsModal
 */
export function MinimalStreamSlipCard({
  slip,
  school,
  examTitle,
  index,
  total
}: {
  slip: RollSlipData;
  school: SchoolSettings;
  examTitle: string;
  index: number;
  total: number;
}) {
  const activeTemplate = school.rollNumberSlipTemplate || 'minimal-stream';
  const isMinimalProfessional = activeTemplate === 'minimal-professional';

  if (isMinimalProfessional) {
    return (
      <div className="border border-black p-4 space-y-3 text-black bg-white font-sans">
        {/* Header */}
        <div className="text-center border-b border-black pb-2.5">
          <div className="flex items-center justify-between text-[9px] font-mono font-bold text-black mb-1">
            <span>SLIP #{index} OF {total}</span>
            <span>SESSION: {school.session || '2025 - 2026'}</span>
          </div>
          <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-black">
            {school.schoolName || 'DEMO SCHOOL SYSTEM'}
          </h3>
          <p className="text-[10px] font-medium text-black">
            {school.campusName || 'Main Campus'} • {school.schoolAddress || 'Official Examination Center'}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-wider border border-black text-black bg-white inline-block px-3.5 py-0.5 mt-1.5">
            Roll Number Slip — {examTitle}
          </p>
        </div>

        {/* Student Info + Photo */}
        <div className="grid grid-cols-12 gap-3 items-center border-b border-black pb-3 text-xs">
          <div className="col-span-9 grid grid-cols-2 gap-y-2 gap-x-3">
            <div>
              <span className="text-[10px] font-bold uppercase text-black block">Student Name</span>
              <span className="font-black uppercase text-xs">{slip.student.name}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-black block">Father / Guardian</span>
              <span className="font-bold uppercase text-xs">
                {slip.student.fatherName || slip.student.family || '-'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-black block">Class &amp; Section</span>
              <span className="font-bold text-xs">
                {slip.student.class} ({slip.student.section || 'A'})
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-black block">Roll Number &amp; ID</span>
              <span className="font-mono font-black text-xs">
                {slip.rollNo} • {slip.student.id}
              </span>
            </div>
          </div>

          <div className="col-span-3 flex justify-end">
            <div className="w-16 h-20 border border-black overflow-hidden bg-white flex items-center justify-center">
              <img
                src={getStudentAvatar(slip.student)}
                alt={slip.student.name}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* 6-Column Schedule Table */}
        <div>
          <table className="w-full text-left text-[11px] border-collapse border border-black">
            <thead>
              <tr className="bg-white border-b border-black font-bold text-[10px] uppercase">
                <th className="py-1 px-2 border-r border-black w-8 text-center">Sr</th>
                <th className="py-1 px-2 border-r border-black">Subject</th>
                <th className="py-1 px-2 border-r border-black text-center">Date</th>
                <th className="py-1 px-2 border-r border-black text-center">Time</th>
                <th className="py-1 px-2 border-r border-black text-center">Room</th>
                <th className="py-1 px-2 text-center w-14">Marks</th>
              </tr>
            </thead>
            <tbody>
              {slip.dateSheet.map((item, idx) => (
                <tr key={idx} className="border-b border-black/30 last:border-b-0">
                  <td className="py-1 px-2 border-r border-black/30 text-center font-mono">
                    {idx + 1}
                  </td>
                  <td className="py-1 px-2 border-r border-black/30 font-bold uppercase">
                    {item.subjectName}
                  </td>
                  <td className="py-1 px-2 border-r border-black/30 text-center font-mono text-[10px]">
                    {item.date}
                  </td>
                  <td className="py-1 px-2 border-r border-black/30 text-center text-[10px]">
                    {item.time}
                  </td>
                  <td className="py-1 px-2 border-r border-black/30 text-center font-mono text-[10px]">
                    {item.room || 'Hall A'}
                  </td>
                  <td className="py-1 px-2 text-center font-mono">
                    {item.totalMarks}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Candidate Instructions */}
        <div className="bg-white border border-black p-2 text-[9.5px] leading-snug text-black">
          <p className="font-bold">
            INSTRUCTIONS: 1. Arrive 20 minutes before exam time. 2. Keep this admit card on your desk during all papers.
          </p>
          <p>
            3. Mobile phones, smartwatches, and unauthorized study material are strictly prohibited in the examination hall.
          </p>
        </div>

        {/* Footer Signatures + ID */}
        <div className="pt-4 flex items-end justify-between text-[10px] font-bold uppercase">
          <div className="border-t border-black pt-1 w-36 text-center">
            Candidate Signature
          </div>
          <div className="text-[9px] font-mono font-normal text-black">
            ID: {slip.student.id}
          </div>
          <div className="border-t border-black pt-1 w-44 text-center">
            Controller of Examinations
          </div>
        </div>
      </div>
    );
  }

  if (activeTemplate === 'classic-bordered') {
    return (
      <div className="border-2 border-black p-1 text-black font-sans">
        <div className="border border-black p-4 space-y-3">
          {/* Header */}
          <div className="text-center border-b-2 border-black pb-2.5">
            <div className="flex items-center justify-between text-[9px] font-mono font-bold text-black/70 mb-1">
              <span>ADMIT CARD #{index} OF {total}</span>
              <span>SESSION: {school.session || '2025 - 2026'}</span>
            </div>
            <h3 className="text-base sm:text-lg font-serif font-black uppercase tracking-tight text-black">
              {school.schoolName || 'DEMO SCHOOL SYSTEM'}
            </h3>
            <p className="text-[10px] font-medium text-neutral-700">
              {school.campusName || 'Main Campus'} • {school.schoolAddress || 'Official Examination Center'}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wider bg-slate-900 text-white inline-block px-3.5 py-0.5 mt-1.5">
              Roll Number Slip — {examTitle}
            </p>
          </div>

          {/* Candidate Info + Photo */}
          <div className="grid grid-cols-12 gap-3 items-center border-b border-black pb-3 text-xs">
            <div className="col-span-9 grid grid-cols-2 gap-y-2 gap-x-3">
              <div>
                <span className="text-[10px] font-bold uppercase text-black/60 block">Candidate Name</span>
                <span className="font-black uppercase text-xs">{slip.student.name}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-black/60 block">Father / Guardian</span>
                <span className="font-bold uppercase text-xs">
                  {slip.student.fatherName || slip.student.family || '-'}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-black/60 block">Class &amp; Section</span>
                <span className="font-bold text-xs">
                  {slip.student.class} ({slip.student.section || 'A'})
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-black/60 block">Roll Number &amp; ID</span>
                <span className="font-mono font-black text-xs">
                  {slip.rollNo} • {slip.student.id}
                </span>
              </div>
            </div>

            <div className="col-span-3 flex justify-end">
              <div className="w-16 h-20 border border-black overflow-hidden bg-slate-50 flex items-center justify-center">
                <img
                  src={getStudentAvatar(slip.student)}
                  alt={slip.student.name}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* 6-Column Schedule Table */}
          <div>
            <table className="w-full text-left text-[11px] border-collapse border border-black">
              <thead>
                <tr className="bg-slate-200 border-b border-black font-bold text-[10px] uppercase">
                  <th className="py-1 px-2 border-r border-black w-8 text-center">Sr</th>
                  <th className="py-1 px-2 border-r border-black">Subject</th>
                  <th className="py-1 px-2 border-r border-black text-center">Date</th>
                  <th className="py-1 px-2 border-r border-black text-center">Time</th>
                  <th className="py-1 px-2 border-r border-black text-center">Room</th>
                  <th className="py-1 px-2 text-center w-14">Marks</th>
                </tr>
              </thead>
              <tbody>
                {slip.dateSheet.map((item, idx) => (
                  <tr key={idx} className="border-b border-black/30 last:border-b-0">
                    <td className="py-1 px-2 border-r border-black/30 text-center font-mono">
                      {idx + 1}
                    </td>
                    <td className="py-1 px-2 border-r border-black/30 font-bold uppercase">
                      {item.subjectName}
                    </td>
                    <td className="py-1 px-2 border-r border-black/30 text-center font-mono text-[10px]">
                      {item.date}
                    </td>
                    <td className="py-1 px-2 border-r border-black/30 text-center text-[10px]">
                      {item.time}
                    </td>
                    <td className="py-1 px-2 border-r border-black/30 text-center font-mono text-[10px]">
                      {item.room || 'Hall A'}
                    </td>
                    <td className="py-1 px-2 text-center font-mono">
                      {item.totalMarks}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Candidate Instructions */}
          <div className="bg-slate-50 border border-black/40 p-2 text-[9.5px] leading-snug text-black/80">
            <p className="font-bold">
              INSTRUCTIONS: 1. Arrive 20 minutes before exam time. 2. Keep this admit card on your desk during all papers.
            </p>
            <p>
              3. Mobile phones, smartwatches, and unauthorized study material are strictly prohibited in the examination hall.
            </p>
          </div>

          {/* Footer Signatures */}
          <div className="pt-4 flex items-end justify-between text-[10px] font-bold uppercase">
            <div className="border-t border-black pt-1 w-36 text-center">
              Candidate Signature
            </div>
            <div className="border-t border-black pt-1 w-44 text-center">
              Controller of Examinations
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-black p-4 space-y-3 text-black">
      {/* School Header */}
      <div className="text-center border-b border-black pb-2">
        <div className="flex items-center justify-between text-[9px] font-mono text-black/60 mb-0.5">
          <span>SLIP #{index} OF {total}</span>
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
      <div className="grid grid-cols-12 gap-3 items-center border-b border-black pb-3 text-xs">
        <div className="col-span-9 grid grid-cols-2 gap-y-1.5 gap-x-3">
          <div>
            <span className="text-[10px] font-bold uppercase text-black/60 block">Student Name</span>
            <span className="font-black uppercase text-xs">{slip.student.name}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-black/60 block">Father / Guardian</span>
            <span className="font-bold uppercase text-xs">
              {slip.student.fatherName || slip.student.family || '-'}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-black/60 block">Class &amp; Section</span>
            <span className="font-bold text-xs">
              {slip.student.class} ({slip.student.section || 'A'})
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-black/60 block">Roll Number</span>
            <span className="inline-block px-2 py-0.5 bg-black text-white font-mono font-black text-xs">
              {slip.rollNo}
            </span>
          </div>
        </div>

        <div className="col-span-3 flex justify-end">
          <div className="w-16 h-20 border border-black overflow-hidden bg-slate-50 flex items-center justify-center">
            <img
              src={getStudentAvatar(slip.student)}
              alt={slip.student.name}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>

      {/* Minimal Schedule Table */}
      <div>
        <table className="w-full text-left text-[11px] border-collapse border border-black">
          <thead>
            <tr className="bg-slate-100 border-b border-black font-bold text-[10px] uppercase">
              <th className="py-1 px-2 border-r border-black w-8 text-center">#</th>
              <th className="py-1 px-2 border-r border-black">Subject</th>
              <th className="py-1 px-2 border-r border-black text-center">Date</th>
              <th className="py-1 px-2 border-r border-black text-center">Time</th>
              <th className="py-1 px-2 text-center w-14">Marks</th>
            </tr>
          </thead>
          <tbody>
            {slip.dateSheet.map((item, idx) => (
              <tr key={idx} className="border-b border-black/30 last:border-b-0">
                <td className="py-1 px-2 border-r border-black/30 text-center font-mono">
                  {idx + 1}
                </td>
                <td className="py-1 px-2 border-r border-black/30 font-bold uppercase">
                  {item.subjectName}
                </td>
                <td className="py-1 px-2 border-r border-black/30 text-center font-mono text-[10px]">
                  {item.date}
                </td>
                <td className="py-1 px-2 border-r border-black/30 text-center text-[10px]">
                  {item.time}
                </td>
                <td className="py-1 px-2 text-center font-mono">
                  {item.totalMarks}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Minimal Footer Signatures */}
      <div className="pt-4 flex items-end justify-between text-[10px] font-bold uppercase">
        <div className="border-t border-black pt-1 w-32 text-center">
          Candidate Sign
        </div>
        <div className="text-[9px] font-mono text-black/60">
          ID: {slip.student.id}
        </div>
        <div className="border-t border-black pt-1 w-36 text-center">
          Controller of Exams
        </div>
      </div>
    </div>
  );
}
