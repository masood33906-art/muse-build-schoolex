import React, { useState } from 'react';
import { X, Printer, Download, Award, FileSpreadsheet, FileText, CheckCircle2, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { Exam, calculateGrade, downloadCSV } from '../utils/examStore';
import { SchoolSettings, getSchoolSettings } from '../utils/settingsHelper';
import { findClassByName, studentsInClassSection } from '../utils/classExportHelper';
import { ClassInfo, Student } from '../types';

export type ExamExportType = 'marks-sheet' | 'result-sheet' | 'bulk-dmc';

interface ExamDetailExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  exportType: ExamExportType;
  exam: Exam;
  students: Student[];
  // Class records, when the caller has them: lets enrollment matching use
  // the stable classId (Fix P0-3) instead of the class name alone.
  classes?: ClassInfo[];
  schoolSettings?: SchoolSettings;
}

export const ExamDetailExportModal: React.FC<ExamDetailExportModalProps> = ({
  isOpen,
  onClose,
  exportType,
  exam,
  students,
  classes,
  schoolSettings
}) => {
  const [selectedStudentIndex, setSelectedStudentIndex] = useState<number>(0);
  const [bulkPrintMode, setBulkPrintMode] = useState<boolean>(true);

  const [liveSchool, setLiveSchool] = useState<SchoolSettings>(() => schoolSettings || getSchoolSettings());
  React.useEffect(() => {
    if (schoolSettings) setLiveSchool(schoolSettings);
  }, [schoolSettings]);
  React.useEffect(() => {
    const handleSettingsChange = () => setLiveSchool(getSchoolSettings());
    window.addEventListener('schoolSettingsUpdated', handleSettingsChange);
    return () => window.removeEventListener('schoolSettingsUpdated', handleSettingsChange);
  }, []);

  if (!isOpen) return null;

  const school = liveSchool;
  const isMinimalDmc = school.examDmcTemplate === 'minimal-classic';
  // 'minimal-professional': strict black & white DMC. It takes the B&W side
  // of every isMinimalDmc branch, but NOT blindly: minimal-classic still
  // renders slate-* (blue-tinted, R!=G!=B), blue/emerald/rose status and
  // total colors, a blue summary ribbon and black header/badge fills in
  // places. Wherever that happens below, isMinimalProfessional gets its own
  // override using only black / white / neutral-* (true grayscale), a white
  // background with no fills, and black text/borders — density and hierarchy
  // come from padding, font weight/size and alignment only.
  const isMinimalProfessional = school.examDmcTemplate === 'minimal-professional';
  const currentDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  // Filter students for this class and section — the shared
  // studentsInClassSection rule (Fix P1-4, extending the Fix P0-3 class
  // matching): when the class records are available, the exam's class NAME
  // is resolved to its record and students are matched by stable classId
  // (legacy name fallback inside the helper), so a renamed class still
  // finds its students; if the exam's class matches no record, the helper
  // falls back to the trimmed, case-insensitive name match.
  // Section matching is EXACT: a recorded section — including 'A' — now
  // matches only that section. The old predicate treated section 'A' as a
  // wildcard and exported DMCs for every section of the class. An exam
  // with NO recorded section is a whole-class exam and matches the whole
  // class (the creation flow always records a concrete section, so this
  // only occurs on legacy records).
  const examClassInfo = classes ? findClassByName(classes, exam.class) : undefined;
  const enrolledStudents = studentsInClassSection(students, examClassInfo ?? exam.class, exam.section);

  // Fix P0-3: NO substitute data, ever. Previously, when no enrolled
  // students matched, this export fabricated a roster from exam.studentMarks
  // with invented fields, or fell back to the first six students in the
  // whole school — printing official DMCs for the wrong children. An empty
  // match now produces NO document: the modal shows a clear "No students
  // found for this class/section" message instead (see render below).
  const activeStudentList = enrolledStudents;
  const noStudentsFound = activeStudentList.length === 0;

  const totalMaxMarks = exam.subjects.reduce((sum, s) => sum + (s.totalMarks || 100), 0);

  // Calculate results for all students in list
  const evaluatedStudents = activeStudentList.map((st, idx) => {
    const entry = exam.studentMarks[st.id];
    let totalObt = 0;
    let hasMarks = false;

    const subjectMarksDetail = exam.subjects.map(sub => {
      const mark = entry?.marks[sub.id];
      if (typeof mark === 'number') {
        hasMarks = true;
        totalObt += mark;
        const subPct = (mark / (sub.totalMarks || 100)) * 100;
        return {
          subId: sub.id,
          name: sub.name,
          max: sub.totalMarks || 100,
          pass: sub.passingMarks || 33,
          obt: mark,
          percentage: subPct,
          grade: calculateGrade(subPct, exam.gradingSchema).grade,
          isPass: mark >= (sub.passingMarks || 33)
        };
      }
      return {
        subId: sub.id,
        name: sub.name,
        max: sub.totalMarks || 100,
        pass: sub.passingMarks || 33,
        obt: null,
        percentage: 0,
        grade: '-',
        isPass: false
      };
    });

    const percentage = totalMaxMarks > 0 ? (totalObt / totalMaxMarks) * 100 : 0;
    const gradeObj = calculateGrade(percentage, exam.gradingSchema);
    const allPassed = subjectMarksDetail.every(s => s.obt !== null ? s.isPass : true);

    return {
      student: st,
      rollNo: entry?.rollNo || st.rollNo || String(idx + 1).padStart(2, '0'),
      hasMarks,
      totalObtained: totalObt,
      percentage: Number(percentage.toFixed(1)),
      grade: gradeObj.grade,
      status: allPassed && hasMarks ? 'PASSED' : hasMarks ? 'NEEDS IMPROVEMENT' : 'PENDING',
      subjectMarks: subjectMarksDetail
    };
  });

  // Sort by total obtained descending to compute rank
  const rankedStudents = [...evaluatedStudents].sort((a, b) => b.totalObtained - a.totalObtained);
  const studentRanks = new Map<string, number>();
  rankedStudents.forEach((st, idx) => {
    studentRanks.set(st.student.id, idx + 1);
  });

  const handlePrint = () => {
    if (noStudentsFound) return; // Fix P0-3: never print an empty/fabricated roster
    window.print();
  };

  const handleDownloadMarksSheetCSV = () => {
    if (noStudentsFound) return; // Fix P0-3: no document when no students match
    let csv = `EXAM: ${exam.name},CLASS: ${exam.class} - ${exam.section},DATE: ${currentDate}\n\n`;
    csv += `Roll No,Student ID,Student Name,Father Name,${exam.subjects.map(s => `${s.name} (Max ${s.totalMarks})`).join(',')},Total Marks,Teacher Signature\n`;

    activeStudentList.forEach((st, idx) => {
      const roll = st.rollNo || String(idx + 1).padStart(2, '0');
      const blanks = exam.subjects.map(() => '').join(',');
      csv += `"${roll}","${st.id}","${st.name}","${st.family}",${blanks},,\n`;
    });

    downloadCSV(`${exam.name}_${exam.class}_Marks_Sheet.csv`, csv);
  };

  const currentStudentData = evaluatedStudents[selectedStudentIndex] || evaluatedStudents[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-5xl bg-[#0d1524] border border-[#223450] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Controls Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-47 bg-[#121c30] print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              {exportType === 'marks-sheet' && <FileSpreadsheet className="w-5 h-5" />}
              {exportType === 'result-sheet' && <FileText className="w-5 h-5" />}
              {exportType === 'bulk-dmc' && <Award className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                {exportType === 'marks-sheet' && 'Marks Entry Sheet (Teacher Roster)'}
                {exportType === 'result-sheet' && 'Consolidated Result Sheet'}
                {exportType === 'bulk-dmc' && 'Detailed Marks Certificate (DMC / Result Cards)'}
              </h2>
              <p className="text-xs text-slate-400">
                {exam.name} • {exam.class} - {exam.section} • {exam.subjects.length} Subjects
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {exportType === 'marks-sheet' && !noStudentsFound && (
              <button
                type="button"
                onClick={handleDownloadMarksSheetCSV}
                className="px-3.5 py-1.5 bg-[#17253b] hover:bg-[#203350] border border-[#2b4163] text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-blue-400" />
                Download CSV
              </button>
            )}

            {exportType === 'bulk-dmc' && !noStudentsFound && (
              <div className="flex items-center bg-edge-2 border border-[#243754] rounded-xl p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setBulkPrintMode(true)}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                    bulkPrintMode ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All DMCs (Bulk)
                </button>
                <button
                  type="button"
                  onClick={() => setBulkPrintMode(false)}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                    !bulkPrintMode ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Single View
                </button>
              </div>
            )}

            {!noStudentsFound && (
              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Print / Save PDF
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#1c2940] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Viewer (Scrollable) */}
        <div className="p-6 md:p-8 overflow-y-auto flex-1 bg-slate-100 text-slate-900 custom-scrollbar print:p-0 print:bg-white print:overflow-visible">

          {/* Fix P0-3: honest empty state — no document is produced when no
              enrolled student matches this exam's class/section. */}
          {noStudentsFound && (
            <div className="max-w-xl mx-auto bg-white p-8 rounded-xl shadow-md border border-slate-200 text-center print:hidden" role="alert">
              <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-900">No students found for this class/section</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                {exam.name} is recorded for {exam.class}{exam.section ? ` — Section ${exam.section}` : ''},
                but no enrolled students match it, so no document was generated.
                Check that students are assigned to this class and section, then try again.
              </p>
            </div>
          )}

          {/* ========================================================= */}
          {/* 1. MARKS ENTRY SHEET (TEACHER BLANK ROSTER)              */}
          {/* ========================================================= */}
          {exportType === 'marks-sheet' && !noStudentsFound && (
            <div className="max-w-4xl mx-auto bg-white p-8 md:p-10 rounded-xl shadow-md border border-slate-200 print:border-0 print:shadow-none print:p-4">
              {/* Header */}
              <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4 mb-4">
                <div className="flex items-start gap-4">
                  {school.schoolLogo && (
                    <img
                      src={school.schoolLogo}
                      alt={school.schoolName}
                      className="w-14 h-14 object-contain rounded-lg border border-slate-200 p-1"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div>
                    <h1 className="text-xl font-black uppercase tracking-tight text-slate-900">
                      {school.schoolName}
                    </h1>
                    <p className="text-xs text-slate-600">{school.schoolTagline || 'Student Evaluation Roster'}</p>
                    <p className="text-[11px] text-slate-500">{school.schoolAddress}</p>
                  </div>
                </div>
                <div className="text-right text-xs">
                  <span className="inline-block px-2.5 py-0.5 bg-blue-100 text-blue-900 font-bold rounded uppercase tracking-wider text-[10px]">
                    Marks Entry Sheet
                  </span>
                  <p className="font-semibold text-slate-700 mt-1.5">Session: {school.session || '2025-2026'}</p>
                  <p className="text-slate-500 text-[11px]">Date: {currentDate}</p>
                </div>
              </div>

              {/* Exam Info Banner */}
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-xs grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Exam Name</span>
                  <span className="font-bold text-slate-800">{exam.name}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Class &amp; Section</span>
                  <span className="font-bold text-slate-800">{exam.class} - {exam.section}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Total Subjects</span>
                  <span className="font-bold text-slate-800">{exam.subjects.length} Subjects</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Max Marks</span>
                  <span className="font-bold text-slate-800">{totalMaxMarks}</span>
                </div>
              </div>

              {/* Roster Table with ready blank cells for entering marks */}
              <div className="overflow-x-auto border border-slate-300 rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 text-[11px]">
                      <th className="p-2.5 border-r border-slate-300 w-12 text-center">Roll #</th>
                      <th className="p-2.5 border-r border-slate-300 w-24">ID</th>
                      <th className="p-2.5 border-r border-slate-300">Student Name</th>
                      <th className="p-2.5 border-r border-slate-300">Father Name</th>
                      {exam.subjects.map(s => (
                        <th key={s.id} className="p-2 border-r border-slate-300 text-center min-w-[75px]">
                          <span className="block font-bold">{s.name}</span>
                          <span className="text-[10px] text-slate-500 font-normal">Max: {s.totalMarks || 100}</span>
                        </th>
                      ))}
                      <th className="p-2.5 border-r border-slate-300 text-center min-w-[70px]">Total ({totalMaxMarks})</th>
                      <th className="p-2.5 text-center min-w-[100px]">Signature / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {activeStudentList.map((st, idx) => {
                      const roll = st.rollNo || String(idx + 1).padStart(2, '0');
                      return (
                        <tr key={st.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="p-2.5 font-bold text-slate-800 text-center border-r border-slate-200">{roll}</td>
                          <td className="p-2.5 font-mono text-[11px] text-slate-600 border-r border-slate-200">{st.id}</td>
                          <td className="p-2.5 font-semibold text-slate-900 border-r border-slate-200">{st.name}</td>
                          <td className="p-2.5 text-slate-600 border-r border-slate-200">{st.family}</td>
                          {exam.subjects.map(s => (
                            <td key={s.id} className="p-2 border-r border-slate-200 text-center h-11">
                              <div className="w-full h-8 border border-slate-300 rounded bg-white"></div>
                            </td>
                          ))}
                          <td className="p-2 border-r border-slate-200 text-center">
                            <div className="w-full h-8 border border-slate-300 rounded bg-white"></div>
                          </td>
                          <td className="p-2 text-center">
                            <div className="w-full h-8 border-b border-slate-300"></div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Instructions and Teacher Signatures */}
              <div className="mt-8 pt-6 border-t border-slate-200 grid grid-cols-2 gap-8 text-xs text-slate-600">
                <div>
                  <p className="font-bold text-slate-800 mb-1">Instructions for Examiners:</p>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-slate-500">
                    <li>Mark each paper strictly in accordance with the standard marking key.</li>
                    <li>Avoid overwriting or ambiguous numbers. Any corrections must be countersigned.</li>
                    <li>Return the completed marks roster within 48 hours of examination completion.</li>
                  </ul>
                </div>
                <div className="flex items-end justify-between pt-4">
                  <div className="text-center border-t border-slate-400 pt-1 w-36">
                    <p className="font-semibold text-slate-800">Subject Teacher</p>
                    <p className="text-[10px] text-slate-500">Signature</p>
                  </div>
                  <div className="text-center border-t border-slate-400 pt-1 w-36">
                    <p className="font-semibold text-slate-800">Head of Department</p>
                    <p className="text-[10px] text-slate-500">Signature &amp; Date</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 2. RESULT SHEET (CONSOLIDATED GAZETTE)                     */}
          {/* ========================================================= */}
          {exportType === 'result-sheet' && !noStudentsFound && (
            <div className="max-w-4xl mx-auto bg-white p-8 md:p-10 rounded-xl shadow-md border border-slate-200 print:border-0 print:shadow-none print:p-4">
              {/* School Header */}
              <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4 mb-4">
                <div className="flex items-start gap-4">
                  {school.schoolLogo && (
                    <img
                      src={school.schoolLogo}
                      alt={school.schoolName}
                      className="w-16 h-16 object-contain rounded-lg border border-slate-200 p-1"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div>
                    <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight text-slate-900">
                      {school.schoolName}
                    </h1>
                    <p className="text-xs text-slate-600">{school.campusName && `${school.campusName} • `}{school.schoolTagline}</p>
                    <p className="text-[11px] text-slate-500">{school.schoolAddress}</p>
                  </div>
                </div>
                <div className="text-right text-xs">
                  <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-900 font-bold rounded uppercase tracking-wider text-[11px]">
                    Result Gazette
                  </span>
                  <p className="font-semibold text-slate-700 mt-2">Session: {school.session || '2025-2026'}</p>
                  <p className="text-slate-500 text-[11px]">Generated: {currentDate}</p>
                </div>
              </div>

              {/* Title and metadata banner */}
              <div className="text-center mb-5">
                <h2 className="text-base font-black uppercase text-slate-900 tracking-wider">
                  {exam.name} - Consolidated Result Sheet
                </h2>
                <p className="text-xs text-slate-500">
                  Class: <span className="font-semibold text-slate-800">{exam.class}</span> | Section: <span className="font-semibold text-slate-800">{exam.section}</span> | Total Max Marks: <span className="font-semibold text-slate-800">{totalMaxMarks}</span>
                </p>
              </div>

              {/* Full Results Table with Subject Marks */}
              <div className="overflow-x-auto border border-slate-300 rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 text-[11px]">
                      <th className="p-2 border-r border-slate-300 w-10 text-center">Pos</th>
                      <th className="p-2 border-r border-slate-300 w-12 text-center">Roll</th>
                      <th className="p-2 border-r border-slate-300">Student Name</th>
                      <th className="p-2 border-r border-slate-300">Father Name</th>
                      {exam.subjects.map(s => (
                        <th key={s.id} className="p-2 border-r border-slate-300 text-center">
                          <span className="block font-bold">{s.name}</span>
                          <span className="text-[9px] text-slate-500">({s.totalMarks || 100})</span>
                        </th>
                      ))}
                      <th className="p-2 border-r border-slate-300 text-center font-bold">Total</th>
                      <th className="p-2 border-r border-slate-300 text-center font-bold">%</th>
                      <th className="p-2 border-r border-slate-300 text-center font-bold">Grade</th>
                      <th className="p-2 text-center font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {rankedStudents.map((item, idx) => (
                      <tr key={item.student.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="p-2 text-center font-bold text-blue-700 border-r border-slate-200">
                          {idx + 1}
                        </td>
                        <td className="p-2 text-center font-semibold text-slate-700 border-r border-slate-200">
                          {item.rollNo}
                        </td>
                        <td className="p-2 font-bold text-slate-900 border-r border-slate-200">
                          {item.student.name}
                        </td>
                        <td className="p-2 text-slate-600 border-r border-slate-200">
                          {item.student.family}
                        </td>
                        {item.subjectMarks.map(sub => (
                          <td key={sub.subId} className="p-2 text-center border-r border-slate-200">
                            {sub.obt !== null ? (
                              <span className={`font-semibold ${sub.isPass ? 'text-slate-800' : 'text-rose-600'}`}>
                                {sub.obt}
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                        ))}
                        <td className="p-2 text-center font-bold text-slate-900 border-r border-slate-200">
                          {item.hasMarks ? item.totalObtained : '-'}
                        </td>
                        <td className="p-2 text-center font-semibold text-slate-800 border-r border-slate-200">
                          {item.hasMarks ? `${item.percentage}%` : '-'}
                        </td>
                        <td className="p-2 text-center border-r border-slate-200">
                          {item.hasMarks ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
                              {item.grade}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="p-2 text-center">
                          {item.hasMarks ? (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.status === 'PASSED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              {item.status}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">Pending</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary Statistics */}
              <div className="grid grid-cols-4 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs my-6">
                <div>
                  <span className="text-slate-500 block text-[11px]">Total Students</span>
                  <span className="text-base font-bold text-slate-800">{rankedStudents.length}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Results Submitted</span>
                  <span className="text-base font-bold text-blue-700">{rankedStudents.filter(s => s.hasMarks).length}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Passed</span>
                  <span className="text-base font-bold text-emerald-700">
                    {rankedStudents.filter(s => s.status === 'PASSED').length}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Class Pass Rate</span>
                  <span className="text-base font-bold text-slate-800">
                    {rankedStudents.filter(s => s.hasMarks).length > 0
                      ? `${Math.round((rankedStudents.filter(s => s.status === 'PASSED').length / rankedStudents.filter(s => s.hasMarks).length) * 100)}%`
                      : '0%'}
                  </span>
                </div>
              </div>

              {/* Signatures */}
              <div className="pt-8 mt-6 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                <div className="text-center w-40 border-t border-slate-400 pt-1">
                  <p className="font-semibold text-slate-800">Class Teacher</p>
                  <p className="text-[10px] text-slate-500">Signature</p>
                </div>
                <div className="text-center w-40 border-t border-slate-400 pt-1">
                  <p className="font-semibold text-slate-800">Controller of Exams</p>
                  <p className="text-[10px] text-slate-500">Signature</p>
                </div>
                <div className="text-center w-40 border-t border-slate-400 pt-1">
                  <p className="font-semibold text-slate-800">{school.principalName || 'Principal'}</p>
                  <p className="text-[10px] text-slate-500">Stamp &amp; Seal</p>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 3. BULK INDIVIDUAL RESULTS (DMC / REPORT CARDS)            */}
          {/* ========================================================= */}
          {exportType === 'bulk-dmc' && !noStudentsFound && (
            <div className="space-y-8">
              {!bulkPrintMode && (
                <div className="max-w-2xl mx-auto flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-sm print:hidden">
                  <button
                    type="button"
                    disabled={selectedStudentIndex === 0}
                    onClick={() => setSelectedStudentIndex(prev => Math.max(0, prev - 1))}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 text-xs font-semibold"
                  >
                    <ChevronLeft className="w-4 h-4" /> Previous
                  </button>
                  <span className="text-xs font-bold text-slate-800">
                    Student {selectedStudentIndex + 1} of {evaluatedStudents.length}: {currentStudentData?.student.name}
                  </span>
                  <button
                    type="button"
                    disabled={selectedStudentIndex === evaluatedStudents.length - 1}
                    onClick={() => setSelectedStudentIndex(prev => Math.min(evaluatedStudents.length - 1, prev + 1))}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 text-xs font-semibold"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Render DMC Cards */}
              {(bulkPrintMode ? evaluatedStudents : [currentStudentData]).map((stData, dmcIdx) => (
                <div
                  key={stData.student.id}
                  className={`max-w-2xl mx-auto bg-white print:shadow-none print:break-after-page mb-8 ${
                    isMinimalProfessional
                      ? 'rounded-none border border-black print:border-black p-6 md:p-7 shadow-none text-black'
                      : isMinimalDmc
                        ? 'rounded-none border border-black print:border-black p-8 md:p-10 shadow-lg'
                        : 'rounded-2xl border-2 border-slate-300 print:border-slate-800 p-8 md:p-10 shadow-lg'
                  }`}
                >
                  {/* DMC Header with School Logo & Crest */}
                  <div className={`flex items-center justify-between pb-4 ${isMinimalProfessional ? 'border-b-2 border-black mb-4' : isMinimalDmc ? 'border-b-2 border-black mb-5' : 'border-b-2 border-blue-900 mb-5'}`}>
                    <div className="flex items-center gap-4">
                      {school.schoolLogo ? (
                        <img
                          src={school.schoolLogo}
                          alt={school.schoolName}
                          className={isMinimalProfessional ? 'w-16 h-16 object-contain rounded-none border border-black p-1 bg-white' : 'w-16 h-16 object-contain rounded-xl border border-slate-200 p-1 bg-white shadow-sm'}
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className={isMinimalProfessional ? 'w-16 h-16 rounded-none bg-white text-black border border-black flex items-center justify-center font-bold text-2xl' : `w-16 h-16 rounded-xl text-white flex items-center justify-center font-bold text-2xl shadow-sm ${isMinimalDmc ? 'bg-black' : 'bg-blue-900'}`}>
                          {school.schoolName.charAt(0)}
                        </div>
                      )}
                      <div>
                        <h1 className={`text-lg md:text-xl font-black uppercase tracking-tight ${(isMinimalDmc || isMinimalProfessional) ? 'text-black' : 'text-blue-950'}`}>
                          {school.schoolName}
                        </h1>
                        <p className={`text-xs font-medium ${isMinimalProfessional ? 'text-neutral-600' : 'text-slate-600'}`}>
                          {school.campusName && `${school.campusName} • `}{school.schoolTagline || 'Excellence in Learning'}
                        </p>
                        <p className={`text-[10px] ${isMinimalProfessional ? 'text-neutral-500' : 'text-slate-500'}`}>
                          {school.schoolAddress}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={isMinimalProfessional ? 'inline-block px-3 py-1 bg-white text-black border border-black font-black text-[11px] rounded-none tracking-wider uppercase' : `inline-block px-3 py-1 text-white font-black text-[11px] rounded tracking-wider uppercase ${isMinimalDmc ? 'bg-black' : 'bg-blue-900'}`}>
                        D.M.C
                      </div>
                      <p className={`text-[10px] mt-1 ${isMinimalProfessional ? 'text-neutral-500' : 'text-slate-500'}`}>Session {school.session || '2025-2026'}</p>
                    </div>
                  </div>

                  {/* Title Banner */}
                  <div className={`text-center ${isMinimalProfessional ? 'my-2' : 'my-3'}`}>
                    <h2 className={`text-base font-extrabold uppercase tracking-widest ${isMinimalProfessional ? 'text-black' : 'text-slate-900'}`}>
                      DETAILED MARKS CERTIFICATE
                    </h2>
                    <p className={`text-xs font-semibold uppercase tracking-wide ${isMinimalProfessional ? 'text-black' : isMinimalDmc ? 'text-neutral-700' : 'text-blue-800'}`}>
                      {exam.name}
                    </p>
                  </div>

                  {/* Student Details Box */}
                  <div className={`grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs ${isMinimalProfessional ? 'bg-white border border-black rounded-none p-3 my-3' : isMinimalDmc ? 'bg-white border border-black p-4 my-4' : 'bg-slate-50 border border-slate-200 rounded-xl p-4 my-4'}`}>
                    <div>
                      <span className={`block text-[10px] uppercase ${isMinimalProfessional ? 'text-neutral-500' : 'text-slate-500'}`}>Student Name</span>
                      <span className={`font-bold text-sm ${isMinimalProfessional ? 'text-black' : 'text-slate-900'}`}>{stData.student.name}</span>
                    </div>
                    <div>
                      <span className={`block text-[10px] uppercase ${isMinimalProfessional ? 'text-neutral-500' : 'text-slate-500'}`}>Father / Guardian</span>
                      <span className={`font-bold text-sm ${isMinimalProfessional ? 'text-black' : 'text-slate-900'}`}>{stData.student.family}</span>
                    </div>
                    <div>
                      <span className={`block text-[10px] uppercase ${isMinimalProfessional ? 'text-neutral-500' : 'text-slate-500'}`}>Roll No / Student ID</span>
                      <span className={`font-mono font-semibold ${isMinimalProfessional ? 'text-black' : 'text-slate-800'}`}>{stData.rollNo} / {stData.student.id}</span>
                    </div>
                    <div>
                      <span className={`block text-[10px] uppercase ${isMinimalProfessional ? 'text-neutral-500' : 'text-slate-500'}`}>Class &amp; Section</span>
                      <span className={`font-bold ${isMinimalProfessional ? 'text-black' : 'text-slate-800'}`}>{exam.class} - {exam.section}</span>
                    </div>
                  </div>

                  {/* Subjects Marks Table */}
                  <div className={`overflow-hidden ${isMinimalProfessional ? 'border border-black rounded-none my-3' : isMinimalDmc ? 'border border-black my-4' : 'border border-slate-300 rounded-xl my-4'}`}>
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className={isMinimalProfessional ? 'bg-white text-black font-bold text-[11px] uppercase border-b-2 border-black' : `text-white font-bold text-[11px] uppercase ${isMinimalDmc ? 'bg-black' : 'bg-blue-900'}`}>
                          <th className={`p-2.5 border-r ${isMinimalProfessional ? 'border-neutral-300' : isMinimalDmc ? 'border-neutral-700' : 'border-blue-800'}`}>Subject</th>
                          <th className={`p-2.5 border-r text-center w-20 ${isMinimalProfessional ? 'border-neutral-300' : isMinimalDmc ? 'border-neutral-700' : 'border-blue-800'}`}>Total Marks</th>
                          <th className={`p-2.5 border-r text-center w-20 ${isMinimalProfessional ? 'border-neutral-300' : isMinimalDmc ? 'border-neutral-700' : 'border-blue-800'}`}>Passing</th>
                          <th className={`p-2.5 border-r text-center w-24 ${isMinimalProfessional ? 'border-neutral-300' : isMinimalDmc ? 'border-neutral-700' : 'border-blue-800'}`}>Marks Obtained</th>
                          <th className={`p-2.5 border-r text-center w-16 ${isMinimalProfessional ? 'border-neutral-300' : isMinimalDmc ? 'border-neutral-700' : 'border-blue-800'}`}>Grade</th>
                          <th className="p-2.5 text-center w-20">Status</th>
                        </tr>
                      </thead>
                      <tbody className={isMinimalProfessional ? 'divide-y divide-neutral-200 text-neutral-700' : 'divide-y divide-slate-200 text-slate-700'}>
                        {stData.subjectMarks.map(sub => (
                          <tr key={sub.subId} className={isMinimalProfessional ? '' : 'hover:bg-slate-50'}>
                            <td className={`p-2.5 font-bold border-r ${isMinimalProfessional ? 'text-black border-neutral-200' : 'text-slate-900 border-slate-200'}`}>
                              {sub.name}
                            </td>
                            <td className={`p-2.5 text-center font-medium border-r ${isMinimalProfessional ? 'border-neutral-200' : 'border-slate-200'}`}>
                              {sub.max}
                            </td>
                            <td className={`p-2.5 text-center border-r ${isMinimalProfessional ? 'text-neutral-500 border-neutral-200' : 'text-slate-500 border-slate-200'}`}>
                              {sub.pass}
                            </td>
                            <td className={`p-2.5 text-center font-bold border-r ${isMinimalProfessional ? 'text-black border-neutral-200' : 'text-slate-900 border-slate-200'}`}>
                              {sub.obt !== null ? sub.obt : '-'}
                            </td>
                            <td className={`p-2.5 text-center font-bold border-r ${isMinimalProfessional ? 'text-black border-neutral-200' : 'border-slate-200'}`}>
                              {sub.grade}
                            </td>
                            <td className="p-2.5 text-center">
                              {sub.obt !== null ? (
                                <span className={`text-[10px] font-bold uppercase ${
                                  isMinimalProfessional ? 'text-black' : sub.isPass ? 'text-emerald-700' : 'text-rose-600'
                                }`}>
                                  {sub.isPass ? 'Pass' : 'Fail'}
                                </span>
                              ) : (
                                '-'
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className={isMinimalProfessional ? 'bg-white font-bold text-black border-t-2 border-black' : 'bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300'}>
                          <td className={`p-2.5 border-r uppercase tracking-wide ${isMinimalProfessional ? 'border-neutral-300' : 'border-slate-300'}`}>
                            Grand Total
                          </td>
                          <td className={`p-2.5 text-center border-r font-extrabold ${isMinimalProfessional ? 'border-neutral-300' : 'border-slate-300'}`}>
                            {totalMaxMarks}
                          </td>
                          <td className={`p-2.5 text-center border-r ${isMinimalProfessional ? 'border-neutral-300 text-neutral-500' : 'border-slate-300 text-slate-500'}`}>
                            -
                          </td>
                          <td className={`p-2.5 text-center border-r font-extrabold text-sm ${isMinimalProfessional ? 'border-neutral-300 text-black' : 'border-slate-300 text-blue-900'}`}>
                            {stData.hasMarks ? stData.totalObtained : '-'}
                          </td>
                          <td className={`p-2.5 text-center border-r font-extrabold text-sm ${isMinimalProfessional ? 'border-neutral-300 text-black' : 'border-slate-300 text-blue-900'}`}>
                            {stData.hasMarks ? stData.grade : '-'}
                          </td>
                          <td className={`p-2.5 text-center font-extrabold text-xs ${isMinimalProfessional ? 'text-black' : 'text-emerald-700'}`}>
                            {stData.status}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Summary Metric Ribbon */}
                  <div className={isMinimalProfessional ? 'grid grid-cols-4 gap-2 bg-white border border-black rounded-none p-2.5 my-3 text-center' : 'grid grid-cols-4 gap-2 bg-blue-50/70 border border-blue-200 rounded-xl p-3 my-4 text-center'}>
                    <div>
                      <span className={`text-[10px] uppercase font-semibold block ${isMinimalProfessional ? 'text-neutral-600' : 'text-blue-800'}`}>Percentage</span>
                      <span className={`text-base font-black ${isMinimalProfessional ? 'text-black' : 'text-blue-950'}`}>
                        {stData.hasMarks ? `${stData.percentage}%` : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className={`text-[10px] uppercase font-semibold block ${isMinimalProfessional ? 'text-neutral-600' : 'text-blue-800'}`}>Overall Grade</span>
                      <span className={`text-base font-black ${isMinimalProfessional ? 'text-black' : 'text-blue-950'}`}>
                        {stData.hasMarks ? stData.grade : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className={`text-[10px] uppercase font-semibold block ${isMinimalProfessional ? 'text-neutral-600' : 'text-blue-800'}`}>Class Rank</span>
                      <span className={`text-base font-black ${isMinimalProfessional ? 'text-black' : 'text-blue-950'}`}>
                        #{studentRanks.get(stData.student.id) || 1}
                      </span>
                    </div>
                    <div>
                      <span className={`text-[10px] uppercase font-semibold block ${isMinimalProfessional ? 'text-neutral-600' : 'text-blue-800'}`}>Result</span>
                      <span className={`text-base font-black ${isMinimalProfessional ? 'text-black' : stData.status === 'PASSED' ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {stData.status}
                      </span>
                    </div>
                  </div>

                  {/* Grading Key Legend */}
                  <div className={`my-3 pt-2 border-t ${isMinimalProfessional ? 'border-neutral-300' : 'border-slate-200'}`}>
                    <p className={`text-[10px] font-bold mb-1 ${isMinimalProfessional ? 'text-black' : 'text-slate-600'}`}>Grading Scale:</p>
                    <div className={`flex flex-wrap gap-1.5 text-[9px] ${isMinimalProfessional ? 'text-neutral-600' : 'text-slate-500'}`}>
                      {exam.gradingSchema.map(g => (
                        <span key={g.grade} className={isMinimalProfessional ? 'px-1.5 py-0.5 bg-white rounded-none border border-neutral-400' : 'px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200'}>
                          <strong>{g.grade}:</strong> &gt;={g.minPercentage}%
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* DMC Signatures Footer */}
                  <div className={`flex items-end justify-between text-xs ${isMinimalProfessional ? 'pt-6 mt-4 border-t border-neutral-300 text-neutral-700' : 'pt-8 mt-6 border-t border-slate-200 text-slate-600'}`}>
                    <div className={`text-center w-36 border-t pt-1 ${isMinimalProfessional ? 'border-black' : 'border-slate-400'}`}>
                      <p className={`font-semibold ${isMinimalProfessional ? 'text-black' : 'text-slate-800'}`}>Class Incharge</p>
                      <p className={`text-[10px] ${isMinimalProfessional ? 'text-neutral-500' : 'text-slate-500'}`}>Signature</p>
                    </div>
                    <div className={`text-center w-36 border-t pt-1 ${isMinimalProfessional ? 'border-black' : 'border-slate-400'}`}>
                      <p className={`font-semibold ${isMinimalProfessional ? 'text-black' : 'text-slate-800'}`}>Exam Controller</p>
                      <p className={`text-[10px] ${isMinimalProfessional ? 'text-neutral-500' : 'text-slate-500'}`}>Signature</p>
                    </div>
                    <div className={`text-center w-36 border-t pt-1 ${isMinimalProfessional ? 'border-black' : 'border-slate-400'}`}>
                      <p className={`font-semibold ${isMinimalProfessional ? 'text-black' : 'text-slate-800'}`}>{school.principalName || 'Principal'}</p>
                      <p className={`text-[10px] ${isMinimalProfessional ? 'text-neutral-500' : 'text-slate-500'}`}>Official Seal</p>
                    </div>
                  </div>

                  <div className={`text-center mt-4 text-[9px] ${isMinimalProfessional ? 'text-neutral-500' : 'text-slate-400'}`}>
                    This document is computer generated by {school.schoolName}. Issued on {currentDate}.
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Bottom Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-surface-47 bg-[#121c30] print:hidden">
          <p className="text-xs text-slate-400">
            {exportType === 'bulk-dmc'
              ? `Displaying ${bulkPrintMode ? evaluatedStudents.length : 1} student result certificate(s)`
              : `Ready to print or save as PDF`}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl border border-edge-38 text-slate-300 hover:text-white hover:bg-edge-12 text-xs font-semibold transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Print / Save PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
