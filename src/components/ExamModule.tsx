import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Download, 
  Calendar, 
  Layers, 
  MoreVertical, 
  FileText, 
  Award, 
  Clock, 
  CheckCircle2, 
  GraduationCap, 
  ChevronDown, 
  ChevronRight,
  Info, 
  FileSpreadsheet, 
  Eye, 
  Trash2, 
  Edit2
} from 'lucide-react';
import { 
  Exam, 
  getStoredExams, 
  saveStoredExams, 
  downloadCSV, 
  ExamFilterState 
} from '../utils/examStore';
import { ClassInfo, Student } from '../types';
import { SchoolSettings, getSchoolSettings } from '../utils/settingsHelper';
import { CreateExamModal } from './CreateExamModal';
import { ExamListExportModal } from './ExamListExportModal';
import { ExamDetailView } from './ExamDetailView';
import { RollNumberSlipsModal } from './RollNumberSlipsModal';
import { BreadcrumbTrail } from './BreadcrumbTrail';

interface ExamModuleProps {
  classes: ClassInfo[];
  students: Student[];
  schoolSettings?: SchoolSettings;
  onBreadcrumbOverview?: () => void;
  onShowToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export const ExamModule: React.FC<ExamModuleProps> = ({
  classes,
  students,
  schoolSettings,
  onBreadcrumbOverview,
  onShowToast
}) => {
  const [exams, setExams] = useState<Exam[]>(() => getStoredExams());
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const [isRollSlipsModalOpen, setIsRollSlipsModalOpen] = useState(false);
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);

  // Expandable Exam Rows state: Set of exam names that are currently expanded
  const [expandedExamNames, setExpandedExamNames] = useState<Set<string>>(() => {
    const initial = getStoredExams();
    if (initial.length > 0) {
      return new Set([initial[0].name]);
    }
    return new Set();
  });

  // Synchronize exams with localStorage
  useEffect(() => {
    const handleStorageUpdate = (e: any) => {
      if (e.detail) {
        setExams(e.detail);
      } else {
        setExams(getStoredExams());
      }
    };
    window.addEventListener('schoollee-exams-updated', handleStorageUpdate);
    return () => window.removeEventListener('schoollee-exams-updated', handleStorageUpdate);
  }, []);

  const school = schoolSettings || getSchoolSettings();

  // Handle Exam Creation (supports single or multiple created exams)
  const handleExamsCreated = (newExams: Exam[]) => {
    const updated = [...newExams, ...exams];
    setExams(updated);
    saveStoredExams(updated);
    if (newExams.length > 0) {
      // Auto-expand the newly created exam name so the user sees all its classes right away!
      setExpandedExamNames(prev => new Set([...prev, newExams[0].name]));
    }
    if (onShowToast) {
      if (newExams.length === 1) {
        onShowToast(`Examination "${newExams[0].name}" (${newExams[0].class} - Sec ${newExams[0].section}) created!`, 'success');
      } else {
        onShowToast(`Examination "${newExams[0].name}" created across ${newExams.length} classes & sections!`, 'success');
      }
    }
  };

  // Handle Exam Update
  const handleExamUpdated = (updatedExam: Exam) => {
    const updated = exams.map(e => e.id === updatedExam.id ? updatedExam : e);
    setExams(updated);
    saveStoredExams(updated);
    setSelectedExam(updatedExam);
  };

  // Handle Exam Deletion
  const handleDeleteExam = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = exams.filter(ex => ex.id !== id);
    setExams(updated);
    saveStoredExams(updated);
    setActiveActionMenuId(null);
    if (onShowToast) {
      onShowToast('Examination deleted', 'info');
    }
  };

  // CSV Export for main exams list
  const handleExportCSV = () => {
    let csv = `EXAM DIRECTORY - ${school.schoolName}\n`;
    csv += `Generated On: ${new Date().toLocaleDateString()}\n\n`;
    csv += `Exam Name,Class,Section,Subjects,Tags,Results Count,Created By,Created At\n`;

    exams.forEach(ex => {
      const subjectsStr = ex.subjects.map(s => s.name).join('; ');
      const tagsStr = ex.tags?.join('; ') || '-';
      csv += `"${ex.name}","${ex.class}","${ex.section}","${subjectsStr}","${tagsStr}","${ex.resultsCount}","${ex.createdBy}","${ex.createdAt}"\n`;
    });

    downloadCSV(`School_Exams_List_${new Date().toISOString().split('T')[0]}.csv`, csv);
    setIsExportDropdownOpen(false);
    if (onShowToast) {
      onShowToast('Exam list CSV downloaded', 'success');
    }
  };

  // Group exams by Exam Name
  const examGroups = useMemo(() => {
    const map = new Map<string, {
      name: string;
      entries: Exam[];
      totalResults: number;
      uniqueClasses: string[];
      allSubjects: string[];
      allTags: string[];
      createdBy: string;
      createdAt: string;
      latestTimestamp: number;
    }>();

    exams.forEach(ex => {
      const key = ex.name.trim();
      if (!map.has(key)) {
        map.set(key, {
          name: ex.name,
          entries: [],
          totalResults: 0,
          uniqueClasses: [],
          allSubjects: [],
          allTags: [],
          createdBy: ex.createdBy,
          createdAt: ex.createdAt,
          latestTimestamp: ex.createdTimestamp || 0
        });
      }
      const g = map.get(key)!;
      g.entries.push(ex);
      g.totalResults += (ex.resultsCount || 0);
      if (!g.uniqueClasses.includes(ex.class)) {
        g.uniqueClasses.push(ex.class);
      }
      ex.subjects.forEach(s => {
        const upper = s.name.toUpperCase();
        if (!g.allSubjects.includes(upper)) {
          g.allSubjects.push(upper);
        }
      });
      (ex.tags || []).forEach(t => {
        if (!g.allTags.includes(t)) {
          g.allTags.push(t);
        }
      });
      if (ex.createdTimestamp && ex.createdTimestamp > g.latestTimestamp) {
        g.latestTimestamp = ex.createdTimestamp;
        g.createdAt = ex.createdAt;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.latestTimestamp - a.latestTimestamp);
  }, [exams]);

  // Toggle expand/collapse for a specific exam row
  const toggleExpandExam = (examName: string) => {
    setExpandedExamNames(prev => {
      const next = new Set(prev);
      if (next.has(examName)) {
        next.delete(examName);
      } else {
        next.add(examName);
      }
      return next;
    });
  };

  // Stats
  const totalExamsCount = examGroups.length;
  const thisMonthExamsCount = examGroups.length;
  const totalResultsCount = exams.reduce((acc, e) => acc + (e.resultsCount || 0), 0);
  const classesCoveredCount = new Set(exams.map(e => e.class)).size;

  // If an exam is selected, render ExamDetailView!
  if (selectedExam) {
    return (
      <div className="w-full max-w-7xl mx-auto p-4 md:p-6">
        <ExamDetailView
          exam={selectedExam}
          onBack={() => setSelectedExam(null)}
          onBreadcrumbOverview={onBreadcrumbOverview}
          onUpdateExam={handleExamUpdated}
          students={students}
          classes={classes}
          schoolSettings={school}
          onShowToast={onShowToast}
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6 space-y-6 animate-in fade-in duration-200">
      
      {/* Top Header: "Exams" info icon, "Overview • Exams" breadcrumb, Export and Create Exam buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Exams</h1>
            <button
              type="button"
              className="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              title="Examinations & Marks Evaluation"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
          <BreadcrumbTrail
            items={[
              { label: 'Overview', onClick: onBreadcrumbOverview },
              { label: 'Exams' }
            ]}
          />
        </div>

        <div className="flex items-center gap-3">
          {/* Export Roll Number Slips Button */}
          <button
            type="button"
            onClick={() => setIsRollSlipsModalOpen(true)}
            className="px-4 py-2 bg-surface-22 hover:bg-[#19263c] border border-blue-500/30 text-blue-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm hover:border-blue-500/60"
            id="btn-export-roll-slips"
          >
            <FileText className="w-3.5 h-3.5 text-blue-400" />
            <span>Export Roll No Slips</span>
          </button>

          {/* Export Dropdown Button ("CSV, PDF and Roll Slips") */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
              className="px-4 py-2 bg-surface-22 hover:bg-[#19263c] border border-edge-36 text-slate-200 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
              id="btn-export-exams"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              Export
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {isExportDropdownOpen && (
              <div 
                className="absolute right-0 mt-2 w-48 bg-[#10192a] border border-[#243754] rounded-xl shadow-2xl py-1 z-30 animate-in fade-in slide-in-from-top-2 duration-150"
                onClick={() => setIsExportDropdownOpen(false)}
              >
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-[#18263e] flex items-center gap-2.5 transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>Download CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(true)}
                  className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-[#18263e] flex items-center gap-2.5 transition-colors"
                >
                  <FileText className="w-4 h-4 text-blue-400" />
                  <span>PDF Document</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsRollSlipsModalOpen(true)}
                  className="w-full text-left px-4 py-2 text-xs text-amber-300 hover:text-white hover:bg-[#18263e] flex items-center gap-2.5 transition-colors border-t border-edge-12 mt-1 pt-1.5"
                >
                  <GraduationCap className="w-4 h-4 text-amber-400" />
                  <span>Roll Number Slips</span>
                </button>
              </div>
            )}
          </div>

          {/* + Create Exam Button */}
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-blue-600/30 transition-all cursor-pointer active:scale-95"
            id="btn-create-exam"
          >
            <Plus className="w-4 h-4" />
            Create Exam
          </button>
        </div>
      </div>

      {/* 4 Stat Cards Matching Image 2 with pastel backgrounds */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Exams (Soft Blue) */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-[#12223b] to-[#0c1626] border border-blue-500/20 shadow-md flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/15 border border-blue-400/25 flex items-center justify-center text-blue-400 shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 block font-medium">Total Exams</span>
            <span className="text-2xl font-black text-white">{totalExamsCount}</span>
          </div>
        </div>

        {/* Card 2: This Month (Soft Purple) */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-[#231838] to-[#120d20] border border-purple-500/20 shadow-md flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/15 border border-purple-400/25 flex items-center justify-center text-purple-400 shrink-0">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 block font-medium">This Month</span>
            <span className="text-2xl font-black text-white">{thisMonthExamsCount}</span>
          </div>
        </div>

        {/* Card 3: Total Results (Soft Gold/Amber) */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-[#2b2513] to-[#161208] border border-amber-500/20 shadow-md flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-400/25 flex items-center justify-center text-amber-400 shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 block font-medium">Total Results</span>
            <span className="text-2xl font-black text-white">{totalResultsCount}</span>
          </div>
        </div>

        {/* Card 4: Classes Covered (Soft Peach/Rose) */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-[#2d1c1a] to-[#160d0c] border border-orange-500/20 shadow-md flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-500/15 border border-orange-400/25 flex items-center justify-center text-orange-400 shrink-0">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 block font-medium">Classes Covered</span>
            <span className="text-2xl font-black text-white">{classesCoveredCount}</span>
          </div>
        </div>
      </div>

      {/* Main Exams Directory: Minimal Expandable Exam Name Entries */}
      <div className="space-y-3" id="exams-accordion-container">
        {/* Minimal Exam Name Entries */}
        {examGroups.map((group) => {
          const isExpanded = expandedExamNames.has(group.name);
          return (
            <div 
              key={group.name}
              className="bg-surface-8 border border-[#1e2e46] rounded-2xl overflow-hidden shadow-md transition-all"
            >
              {/* Minimal Exam Entry Header: ONLY the Name of it with Down Arrow */}
              <button
                type="button"
                onClick={() => toggleExpandExam(group.name)}
                className={`w-full px-5 py-4 flex items-center justify-between text-left transition-colors cursor-pointer select-none group ${
                  isExpanded
                    ? 'bg-[#142238] border-b border-blue-500/30'
                    : 'hover:bg-surface-22'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-bold text-white text-base group-hover:text-blue-400 transition-colors">
                    {group.name}
                  </span>
                </div>

                {/* Down arrow indicating expandable */}
                <div 
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                    isExpanded 
                      ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40 shadow-sm rotate-180' 
                      : 'bg-[#152236] text-slate-400 group-hover:text-white group-hover:bg-[#1b2b44] border border-[#233652]'
                  }`}
                >
                  <ChevronDown className="w-4 h-4 transition-transform duration-200" />
                </div>
              </button>

              {/* Expanded Classes Section with all attributes like before */}
              {isExpanded && (
                <div className="p-3 sm:p-5 bg-surface-4 animate-in fade-in duration-150">
                  <div className="rounded-xl border border-[#1f304a] bg-[#0c1424] overflow-hidden shadow-inner">
                    {/* Inner Header Bar */}
                    <div className="px-4 py-2.5 bg-[#111c2f] border-b border-[#1e2e46] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-blue-400" />
                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                          Classes Enrolled in "{group.name}" ({group.entries.length} {group.entries.length === 1 ? 'class section' : 'class sections'})
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        Click any class to record marks, view report cards, and manage examination details
                      </span>
                    </div>

                    {/* Sub-table showing each class with attributes already existing like before */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-[#0e1728] text-slate-400 font-semibold border-b border-edge-15 text-[11px]">
                            <th className="p-3 pl-4 border-r border-edge-15 min-w-[140px]">Class</th>
                            <th className="p-3 border-r border-edge-15 min-w-[90px]">Section</th>
                            <th className="p-3 border-r border-edge-15 min-w-[200px]">Subjects</th>
                            <th className="p-3 border-r border-edge-15 min-w-[90px]">Tags</th>
                            <th className="p-3 border-r border-edge-15 min-w-[90px] text-center">Results</th>
                            <th className="p-3 border-r border-edge-15 min-w-[120px]">Created By</th>
                            <th className="p-3 border-r border-edge-15 min-w-[110px]">Created At</th>
                            <th className="p-3 w-28 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-edge-2">
                          {group.entries.map((exam) => (
                            <tr 
                              key={exam.id}
                              onClick={() => setSelectedExam(exam)}
                              className="hover:bg-[#132034] transition-colors cursor-pointer group"
                            >
                              {/* Class with icon */}
                              <td className="p-3.5 pl-4 border-r border-edge-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-md bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0">
                                    <GraduationCap className="w-3.5 h-3.5" />
                                  </div>
                                  <div>
                                    <span className="font-bold text-white group-hover:text-blue-400 transition-colors">
                                      {exam.class}
                                    </span>
                                    <div className="text-[10px] text-slate-400">
                                      {exam.name}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Section */}
                              <td className="p-3.5 text-slate-200 font-semibold border-r border-edge-2">
                                <span className="px-2 py-0.5 rounded bg-[#16243a] border border-edge-36 text-slate-300">
                                  Sec {exam.section}
                                </span>
                              </td>

                              {/* Subjects Chips */}
                              <td className="p-3.5 border-r border-edge-2">
                                <div className="flex flex-wrap gap-1.5">
                                  {exam.subjects.map(s => (
                                    <span
                                      key={s.id}
                                      className="px-2 py-0.5 bg-[#17253d] border border-[#273d62] text-blue-300 font-semibold text-[10px] rounded-lg tracking-wider uppercase"
                                    >
                                      {s.name} ({s.totalMarks})
                                    </span>
                                  ))}
                                </div>
                              </td>

                              {/* Tags */}
                              <td className="p-3.5 text-slate-400 border-r border-edge-2">
                                {exam.tags && exam.tags.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {exam.tags.map(t => (
                                      <span key={t} className="px-1.5 py-0.5 bg-surface-33 border border-edge-38 text-[10px] rounded text-slate-300">
                                        #{t}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span>-</span>
                                )}
                              </td>

                              {/* Results Count Pill */}
                              <td className="p-3.5 text-center border-r border-edge-2">
                                <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  {exam.resultsCount}
                                </span>
                              </td>

                              {/* Created By */}
                              <td className="p-3.5 text-slate-300 font-medium border-r border-edge-2">
                                {exam.createdBy}
                              </td>

                              {/* Created At */}
                              <td className="p-3.5 text-slate-400 whitespace-nowrap border-r border-edge-2">
                                {exam.createdAt}
                              </td>

                              {/* Actions */}
                              <td className="p-3.5 text-center" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedExam(exam)}
                                    className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 hover:text-white text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                    title="View Exam Details & Marks"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>View</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => handleDeleteExam(exam.id, e)}
                                    className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                    title="Delete Exam for this Class"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {examGroups.length === 0 && (
          <div className="p-8 text-center text-slate-400 bg-surface-8 border border-[#1e2e46] rounded-2xl">
            No examinations match the selected search or filter criteria.
          </div>
        )}
      </div>

      {/* Create Exam Modal */}
      <CreateExamModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onExamsCreated={handleExamsCreated}
        classes={classes}
        createdBy={school.schoolName || 'Demo school'}
      />

      {/* Export PDF Preview Modal for main exams list */}
      <ExamListExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        exams={exams}
        schoolSettings={school}
      />

      {/* Export Roll Number Slips Modal (Popup 1 Selection & Popup 2 Preview/Export) */}
      <RollNumberSlipsModal
        isOpen={isRollSlipsModalOpen}
        onClose={() => setIsRollSlipsModalOpen(false)}
        students={students}
        classes={classes}
        exams={exams}
        schoolSettings={school}
        onShowToast={onShowToast}
      />

    </div>
  );
};
