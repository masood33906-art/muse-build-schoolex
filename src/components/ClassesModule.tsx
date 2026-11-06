import React, { useState, useMemo } from 'react';
import { 
  Video, 
  Download, 
  FileText, 
  FileSpreadsheet, 
  Plus, 
  Search, 
  Pencil, 
  BookOpen, 
  LayoutGrid, 
  ChevronDown, 
  Check, 
  X, 
  Trash2,
  ListOrdered,
  GripVertical,
  MoveVertical,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { ClassInfo, Student } from '../types';
import { exportClassesToCSV, exportClassesToPDF } from '../utils/classExportHelper';
import { DEFAULT_SCHOOL } from '../utils/pdfGenerator';
import { ClassDetailsPage } from './ClassDetailsPage';
import { BreadcrumbTrail } from './BreadcrumbTrail';
import { SecurityDeleteModal } from './SecurityDeleteModal';

interface ClassesModuleProps {
  classes: ClassInfo[];
  students?: Student[];
  onUpdateClasses: (updated: ClassInfo[]) => void;
  onUpdateStudents?: (updated: Student[]) => void;
  onNavigateToStudentsByClass?: (className: string, sectionName?: string) => void;
  onBreadcrumbOverview?: () => void;
  onSelectStudent?: (studentId: string) => void;
}

export const ClassesModule: React.FC<ClassesModuleProps> = ({
  classes,
  students = [],
  onUpdateClasses,
  onUpdateStudents,
  onNavigateToStudentsByClass,
  onBreadcrumbOverview,
  onSelectStudent
}) => {
  // Selected class for viewing full details page
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  // Search & Sorting state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'custom' | 'asc' | 'desc'>('custom');

  // Export dropdown state
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  // Edit Class Modal state
  const [editingClass, setEditingClass] = useState<ClassInfo | null>(null);
  const [editName, setEditName] = useState('');
  const [editSections, setEditSections] = useState<string[]>(['A']);
  const [editFee, setEditFee] = useState<number>(4800);
  const [editNewSectionInput, setEditNewSectionInput] = useState('');

  // Add Class Modal state
  const [isAddClassModalOpen, setIsAddClassModalOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newSections, setNewSections] = useState<string[]>(['A']);
  const [newSectionInput, setNewSectionInput] = useState('');
  const [newClassFee, setNewClassFee] = useState<number>(4800);

  // Organize Classes Modal state & Live Displacement Drag-and-Drop
  const [isReorganizeModalOpen, setIsReorganizeModalOpen] = useState(false);
  const [reorderedClasses, setReorderedClasses] = useState<ClassInfo[]>(classes);
  const [draggedClassIndex, setDraggedClassIndex] = useState<number | null>(null);

  // Live displacement: as a class is dragged to a place, all other classes displace toward the source position
  const handleLiveDisplace = (targetIndex: number) => {
    if (draggedClassIndex === null || draggedClassIndex === targetIndex) return;

    setReorderedClasses((prev) => {
      const next = [...prev];
      const [draggedItem] = next.splice(draggedClassIndex, 1);
      next.splice(targetIndex, 0, draggedItem);
      return next;
    });

    setDraggedClassIndex(targetIndex);
  };

  // High-Security Deletion state for Classes and Sections
  const [securityDeleteTarget, setSecurityDeleteTarget] = useState<{
    type: string;
    name: string;
    details?: string;
    warningNote?: string;
    onExecute: () => void;
  } | null>(null);

  const handlePromptDeleteClass = (cls: ClassInfo) => {
    const enrolled = students.filter(
      s => s.class && s.class.toLowerCase().trim() === cls.name.toLowerCase().trim()
    ).length;
    setSecurityDeleteTarget({
      type: 'Class',
      name: cls.name,
      details: `${cls.sectionsCount || cls.sections?.length || 1} Sections • ${enrolled} Students Enrolled`,
      warningNote: enrolled > 0 ? `${enrolled} currently enrolled students will have their class designation unassigned.` : undefined,
      onExecute: () => {
        onUpdateClasses(classes.filter(c => c.id !== cls.id));
        setEditingClass(null);
        if (selectedClassId === cls.id) {
          setSelectedClassId(null);
        }
      }
    });
  };

  const handlePromptDeleteSection = (sec: string) => {
    if (editSections.length <= 1) return;
    setSecurityDeleteTarget({
      type: 'Section',
      name: `Section ${sec}`,
      details: `Class: ${editingClass?.name || 'Class'}`,
      warningNote: 'This section will be permanently removed. Any enrolled students will be moved to the primary remaining section.',
      onExecute: () => {
        setEditSections(prev => prev.filter(s => s !== sec));
      }
    });
  };

  // Duplicate name checks (case-insensitive) - MUST be called unconditionally before any early return
  const isDuplicateNewClassName = useMemo(() => {
    const trimmed = newClassName.trim().toLowerCase();
    if (!trimmed) return false;
    return classes.some(c => c.name.trim().toLowerCase() === trimmed);
  }, [newClassName, classes]);

  const isDuplicateEditClassName = useMemo(() => {
    if (!editingClass) return false;
    const trimmed = editName.trim().toLowerCase();
    if (!trimmed) return false;
    return classes.some(
      c => c.id !== editingClass.id && c.name.trim().toLowerCase() === trimmed
    );
  }, [editName, editingClass, classes]);

  // If a class is selected, render the Class Details Page
  const selectedClass = classes.find(c => c.id === selectedClassId);
  if (selectedClass) {
    return (
      <ClassDetailsPage
        classInfo={selectedClass}
        allClasses={classes}
        students={students}
        onBackToClasses={() => setSelectedClassId(null)}
        onBreadcrumbOverview={onBreadcrumbOverview}
        onUpdateClass={(updated) => {
          const next = classes.map(c => c.id === updated.id ? updated : c);
          onUpdateClasses(next);
        }}
        onUpdateStudents={onUpdateStudents}
        onSelectStudent={onSelectStudent}
        onNavigateToStudents={(className, sectionName) => {
          if (onNavigateToStudentsByClass) {
            onNavigateToStudentsByClass(className, sectionName);
          }
        }}
      />
    );
  }

  // Metrics
  const totalClassesCount = classes.length;
  const totalSectionsCount = classes.reduce((sum, c) => sum + (c.sectionsCount || c.sections.length || 1), 0);

  // Filtered & Sorted Classes: respects user-defined sequence when sortOrder is 'custom'
  const filteredClasses = useMemo(() => {
    const list = classes.filter(
      c => !searchQuery.trim() || c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (sortOrder === 'asc') {
      return [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    }
    if (sortOrder === 'desc') {
      return [...list].sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' }));
    }
    // 'custom' order: exact sequence as organized
    return list;
  }, [classes, searchQuery, sortOrder]);

  // Handle Export CSV
  const handleExportCSV = () => {
    exportClassesToCSV(filteredClasses, `classes_directory_${new Date().toISOString().slice(0, 10)}.csv`);
    setIsExportMenuOpen(false);
  };

  // Handle Export PDF
  const handleExportPDF = () => {
    exportClassesToPDF(filteredClasses, DEFAULT_SCHOOL);
    setIsExportMenuOpen(false);
  };

  // Open Edit Modal
  const handleOpenEdit = (cls: ClassInfo) => {
    setEditingClass(cls);
    setEditName(cls.name);
    setEditSections(cls.sections && cls.sections.length > 0 ? [...cls.sections] : ['A']);
    setEditFee(cls.fee || 4800);
    setEditNewSectionInput('');
  };

  // Save Edited Class
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass || !editName.trim()) return;

    // Do not allow duplicate class name
    const trimmed = editName.trim();
    const alreadyExists = classes.some(
      c => c.id !== editingClass.id && c.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (alreadyExists) return;

    const sectionsArray = editSections.length > 0 ? editSections : ['A'];

    const updated = classes.map(c => {
      if (c.id === editingClass.id) {
        return {
          ...c,
          name: trimmed,
          sectionsCount: sectionsArray.length,
          sections: sectionsArray,
          fee: Number(editFee) || c.fee || 4800
        };
      }
      return c;
    });

    onUpdateClasses(updated);
    setEditingClass(null);
  };

  // Handle Add Class
  const handleSaveNewClass = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newClassName.trim();
    if (!trimmedName) return;

    // Do not allow duplicate class name
    const alreadyExists = classes.some(
      c => c.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (alreadyExists) return;

    const newId = `CLS-${Date.now().toString().slice(-4)}`;
    const sectionsToSave = newSections.length > 0 ? newSections : ['A'];

    const newClass: ClassInfo = {
      id: newId,
      name: trimmedName,
      sectionsCount: sectionsToSave.length,
      sections: sectionsToSave,
      studentsCount: 0,
      fee: Number(newClassFee) || 4800,
      createdAt: '08 Apr 2026',
      latestSession: 'Jul 2026',
      timeline: [
        {
          id: `TL-NEW-${Date.now()}`,
          type: 'class_created',
          title: `Class "${trimmedName}" created`,
          description: 'Created by Admin',
          date: '08 Apr 2026',
          badgeDate: '08 Apr',
          fee: Number(newClassFee) || 4800,
          author: 'Admin'
        }
      ]
    };

    onUpdateClasses([...classes, newClass]);
    setIsAddClassModalOpen(false);
    setNewClassName('');
    setNewSections(['A']);
    setNewSectionInput('');
  };

  // Helper to add section in Add Class modal
  const handleAddSectionToNewClass = () => {
    const trimmed = newSectionInput.trim().toUpperCase();
    if (!trimmed) return;
    if (newSections.includes(trimmed)) return;
    setNewSections([...newSections, trimmed]);
    setNewSectionInput('');
  };

  // Helper to add next letter (B, C, etc.)
  const handleAddNextLetterSection = () => {
    const nextCharCode = 65 + newSections.length;
    if (nextCharCode <= 90) {
      const nextChar = String.fromCharCode(nextCharCode);
      if (!newSections.includes(nextChar)) {
        setNewSections([...newSections, nextChar]);
      }
    }
  };

  // Helper to remove section in Add Class modal
  const handleRemoveSectionFromNewClass = (sec: string) => {
    if (newSections.length <= 1) return;
    setNewSections(newSections.filter(s => s !== sec));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200" id="classes-module-root">
      {/* ================= HEADER ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Classes
            </h1>
            <Video className="w-4 h-4 text-slate-400 inline" />
          </div>
          <BreadcrumbTrail
            items={[
              { label: 'Overview', onClick: onBreadcrumbOverview },
              { label: 'Classes' }
            ]}
          />
        </div>

        {/* Action Buttons: Export, Reorganize, Add Class */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* 1. Export Button with Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsExportMenuOpen(prev => !prev)}
              className="px-3.5 py-1.5 rounded-lg bg-[#141c2b] hover:bg-[#1a2538] border border-[#223046] text-xs font-semibold text-slate-200 hover:text-white flex items-center gap-2 transition-all cursor-pointer shadow-sm"
              id="btn-export-classes"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>Export</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {isExportMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-30" 
                  onClick={() => setIsExportMenuOpen(false)} 
                />
                <div className="absolute right-0 mt-1.5 z-40 w-44 bg-[#0e1420] border border-[#223046] rounded-xl shadow-2xl p-1.5 text-left animate-in fade-in slide-in-from-top-1">
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className="w-full px-3 py-2 rounded-lg hover:bg-[#172133] flex items-center gap-2 text-xs text-slate-200 hover:text-white transition-colors cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Download as CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportPDF}
                    className="w-full px-3 py-2 rounded-lg hover:bg-[#172133] flex items-center gap-2 text-xs text-slate-200 hover:text-white transition-colors cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-rose-400" />
                    <span>Download as PDF</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* 2. Organize Classes Button */}
          <button
            type="button"
            onClick={() => {
              setReorderedClasses([...classes]);
              setDraggedClassIndex(null);
              setIsReorganizeModalOpen(true);
            }}
            className="px-3.5 py-1.5 rounded-lg bg-[#141c2b] hover:bg-[#1a2538] border border-[#223046] text-xs font-semibold text-slate-200 hover:text-white flex items-center gap-2 transition-all cursor-pointer shadow-sm group"
            id="btn-organize-classes"
            title="Drag and drop to organize classes"
          >
            <ListOrdered className="w-3.5 h-3.5 text-purple-400 group-hover:text-purple-300 transition-colors" />
            <span>Organize Classes</span>
          </button>

          {/* 3. Add Class Button */}
          <button
            type="button"
            onClick={() => {
              setNewClassName('');
              setNewSections(['A']);
              setNewSectionInput('');
              setNewClassFee(4800);
              setIsAddClassModalOpen(true);
            }}
            className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-[#0c121e] text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md hover:shadow-lg"
            id="btn-add-class"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add Class</span>
          </button>
        </div>
      </div>

      {/* ================= TWO DATA DISPLAY CARDS ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Card 1: Classes Count */}
        <div 
          className="rounded-2xl p-5 border border-sky-400/20 shadow-md relative overflow-hidden bg-gradient-to-br from-[#cde7fe] via-[#dcedfc] to-[#bde0fe] text-slate-800"
          id="stat-card-classes"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-white/70 backdrop-blur-xs flex items-center justify-center text-sky-700 shadow-sm">
              <BookOpen className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="text-3xl font-black text-slate-900 tracking-tight">
              {totalClassesCount}
            </div>
          </div>
          <div className="mt-4">
            <div className="text-sm font-bold text-slate-800">
              Classes
            </div>
          </div>
        </div>

        {/* Card 2: Sections Count */}
        <div 
          className="rounded-2xl p-5 border border-purple-400/20 shadow-md relative overflow-hidden bg-gradient-to-br from-[#e5d4ff] via-[#eedeff] to-[#dfc8fe] text-slate-800"
          id="stat-card-sections"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-white/70 backdrop-blur-xs flex items-center justify-center text-purple-700 shadow-sm">
              <LayoutGrid className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="text-3xl font-black text-slate-900 tracking-tight">
              {totalSectionsCount}
            </div>
          </div>
          <div className="mt-4">
            <div className="text-sm font-bold text-slate-800">
              Sections
            </div>
          </div>
        </div>
      </div>

      {/* ================= ALL CLASSES TABLE ================= */}
      <div className="bg-[#101726] border border-[#1d273a] rounded-2xl overflow-hidden shadow-lg">
        {/* Table Header Controls */}
        <div className="px-6 py-4 border-b border-[#1b2638] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0d1320]">
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">
              All Classes
            </h2>
            <p className="text-[11px] text-slate-400">
              Click any class row to view fee, sections, student count, and timeline
            </p>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search classes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 rounded-xl bg-[#141c2c] border border-[#232f44] text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            {/* Header */}
            <thead className="bg-[#131b28] border-b border-[#1c2637] text-xs font-semibold text-slate-400">
              <tr>
                <th className="py-3.5 px-6">
                  <button
                    type="button"
                    onClick={() => setSortOrder(prev => prev === 'custom' ? 'asc' : prev === 'asc' ? 'desc' : 'custom')}
                    className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer group"
                    title="Sort order: Custom / Ascending / Descending"
                  >
                    <span>Class</span>
                    <span className="text-slate-400 group-hover:text-blue-400 font-bold">
                      {sortOrder === 'asc' ? '↑' : sortOrder === 'desc' ? '↓' : ''}
                    </span>
                  </button>
                </th>
                <th className="py-3.5 px-6 w-48">Sections</th>
                <th className="py-3.5 px-6 w-48">Students</th>
                <th className="py-3.5 px-6 w-36 text-right">Actions</th>
              </tr>
            </thead>

            {/* Body */}
            <tbody className="divide-y divide-[#182232] divide-dashed text-xs">
              {filteredClasses.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-500">
                    No classes found matching "{searchQuery}"
                  </td>
                </tr>
              ) : (
                filteredClasses.map((cls) => {
                  return (
                    <tr
                      key={cls.id}
                      onClick={() => setSelectedClassId(cls.id)}
                      className="hover:bg-[#141d2d] transition-colors group cursor-pointer"
                      title="Click to view detailed class page"
                    >
                      {/* Class Name */}
                      <td className="py-4 px-6">
                        <span className="font-semibold text-slate-100 group-hover:text-blue-400 transition-colors">
                          {cls.name}
                        </span>
                      </td>

                      {/* Sections Count */}
                      <td className="py-4 px-6 text-slate-300 font-mono">
                        {cls.sectionsCount || cls.sections?.length || 1}
                      </td>

                      {/* Students Count */}
                      <td className="py-4 px-6 text-slate-300 font-mono">
                        {(() => {
                          const enrolled = students.filter(
                            s => s.class && s.class.toLowerCase().trim() === cls.name.toLowerCase().trim()
                          ).length;
                          return enrolled > 0 ? enrolled : (cls.studentsCount || 0);
                        })()}
                      </td>

                      {/* Actions: Direct Edit and High-Security Delete Class buttons */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEdit(cls);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-[#162030] hover:bg-[#1e2c44] border border-[#24344d] hover:border-blue-500/50 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                            id={`btn-edit-class-${cls.id}`}
                            title="Edit Class"
                          >
                            <Pencil className="w-3 h-3 text-sky-400" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePromptDeleteClass(cls);
                            }}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer shadow-sm"
                            id={`btn-delete-class-${cls.id}`}
                            title={`Delete Class ${cls.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="bg-[#111724] border-t border-[#1b2638] px-6 py-3.5 flex items-center justify-between text-xs text-slate-400">
          <span>
            Showing <strong className="text-white">{filteredClasses.length}</strong> of {totalClassesCount} classes
          </span>
          <span className="font-mono text-slate-300">
            Total Sections: <strong className="text-purple-400">{totalSectionsCount}</strong>
          </span>
        </div>
      </div>

      {/* ================= EDIT CLASS MODAL ================= */}
      {editingClass && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
          onClick={() => setEditingClass(null)}
        >
          <div 
            className="bg-[#0f1523] border border-[#223046] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#141b2b] border-b border-[#1f2b3e] px-5 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Pencil className="w-4 h-4 text-sky-400" />
                <span>Edit Class — {editingClass.name}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingClass(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Class Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl bg-[#0a0e17] border text-white focus:outline-none transition-colors ${
                    isDuplicateEditClassName
                      ? 'border-rose-500 focus:border-rose-500 bg-rose-950/20 text-rose-100 ring-1 ring-rose-500/30'
                      : 'border-[#212d3f] focus:border-blue-500'
                  }`}
                />
                {isDuplicateEditClassName && (
                  <p className="text-xs text-rose-500 font-medium mt-1.5 flex items-center gap-1.5" id="error-duplicate-edit-name">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                    <span>Class name is already available. Please choose a different name.</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Fee per Student (PKR)
                </label>
                <input
                  type="number"
                  value={editFee}
                  onChange={(e) => setEditFee(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0a0e17] border border-[#212d3f] text-white focus:outline-none focus:border-blue-500"
                  min="0"
                  step="100"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">
                  Sections
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {editSections.map((sec) => (
                    <div
                      key={sec}
                      className="px-2.5 py-1 rounded-lg bg-[#141e30] border border-[#23334c] text-white text-xs font-bold flex items-center gap-1.5"
                    >
                      <span>{sec}</span>
                      {editSections.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handlePromptDeleteSection(sec)}
                          className="text-rose-400 hover:text-rose-300 cursor-pointer"
                          title={`Delete Section ${sec}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Append section */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editNewSectionInput}
                    onChange={(e) => setEditNewSectionInput(e.target.value)}
                    placeholder="New section name (e.g. B)"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-[#0a0e17] border border-[#212d3f] text-white text-xs uppercase"
                    maxLength={10}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const trimmed = editNewSectionInput.trim().toUpperCase();
                      if (trimmed && !editSections.includes(trimmed)) {
                        setEditSections([...editSections, trimmed]);
                        setEditNewSectionInput('');
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-between gap-2.5 border-t border-[#1f2b3e]">
                <button
                  type="button"
                  onClick={() => {
                    if (editingClass) {
                      handlePromptDeleteClass(editingClass);
                    }
                  }}
                  className="px-3.5 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 hover:text-rose-300 font-semibold transition-colors cursor-pointer text-xs flex items-center gap-1.5"
                  title="Permanently delete this class"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Class</span>
                </button>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditingClass(null)}
                    className="px-4 py-2 rounded-lg bg-[#141b29] hover:bg-[#1a2335] text-slate-300 font-semibold transition-colors cursor-pointer text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isDuplicateEditClassName || !editName.trim()}
                    className={`px-4 py-2 rounded-lg font-bold transition-all text-xs ${
                      isDuplicateEditClassName || !editName.trim()
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                        : 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-md shadow-blue-600/30'
                    }`}
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= ADD CLASS POP-UP MODAL ================= */}
      {/* Allows user to create class by given input of class name and option to create sections */}
      {isAddClassModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
          onClick={() => setIsAddClassModalOpen(false)}
        >
          <div 
            className="bg-[#0f1523] border border-[#223046] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#141b2b] border-b border-[#1f2b3e] px-5 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Create New Class</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddClassModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewClass} className="p-5 space-y-4 text-xs">
              {/* 1. Class Name Input */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">
                  Class Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Class 11, Prep Blue, Playgroup"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl bg-[#0a0e17] border text-xs focus:outline-none transition-all ${
                    isDuplicateNewClassName
                      ? 'border-rose-500 focus:border-rose-500 text-rose-100 bg-rose-950/20 ring-1 ring-rose-500/30'
                      : 'border-[#212d3f] text-white focus:border-blue-500'
                  }`}
                  id="input-new-class-name"
                />
                {isDuplicateNewClassName && (
                  <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-rose-400 animate-in fade-in slide-in-from-top-1 duration-150" id="error-duplicate-class-name">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                    <span>Class name is already available. Please choose a different name.</span>
                  </div>
                )}
              </div>

              {/* 2. Options to create sections */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-slate-300 font-semibold">
                    Sections for this Class ({newSections.length})
                  </label>
                  <button
                    type="button"
                    onClick={handleAddNextLetterSection}
                    className="text-blue-400 hover:text-blue-300 text-[11px] font-semibold flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Next Letter</span>
                  </button>
                </div>

                {/* Section badges */}
                <div className="flex flex-wrap gap-2 p-2.5 rounded-xl bg-[#0a0e17] border border-[#212d3f] min-h-[44px] items-center mb-2">
                  {newSections.map((sec) => (
                    <div
                      key={sec}
                      className="px-2.5 py-1 rounded-lg bg-[#162133] border border-[#263750] text-white text-xs font-bold flex items-center gap-1.5"
                    >
                      <span>Section {sec}</span>
                      {newSections.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSectionFromNewClass(sec)}
                          className="text-slate-400 hover:text-rose-400 cursor-pointer"
                          title={`Remove Section ${sec}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Custom section input */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newSectionInput}
                    onChange={(e) => setNewSectionInput(e.target.value)}
                    placeholder="Custom section (e.g. B, Rose)"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-[#0a0e17] border border-[#212d3f] text-white text-xs uppercase"
                    maxLength={10}
                  />
                  <button
                    type="button"
                    onClick={handleAddSectionToNewClass}
                    disabled={!newSectionInput.trim()}
                    className="px-3 py-1.5 rounded-lg bg-[#192437] hover:bg-[#202f48] disabled:opacity-40 text-slate-200 hover:text-white font-semibold transition-colors cursor-pointer"
                  >
                    Add Section
                  </button>
                </div>
              </div>

              {/* 3. Base Monthly Fee per Student */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">
                  Monthly Fee per Student (PKR)
                </label>
                <input
                  type="number"
                  value={newClassFee}
                  onChange={(e) => setNewClassFee(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0a0e17] border border-[#212d3f] text-white focus:outline-none focus:border-blue-500 text-xs"
                  min="0"
                  step="100"
                />
              </div>

              {/* Form Buttons */}
              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-[#1f2b3e]">
                <button
                  type="button"
                  onClick={() => setIsAddClassModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#141b29] hover:bg-[#1a2335] text-slate-300 font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDuplicateNewClassName || !newClassName.trim()}
                  className={`px-5 py-2 rounded-xl text-white font-bold transition-all shadow-md ${
                    isDuplicateNewClassName || !newClassName.trim()
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                      : 'bg-blue-600 hover:bg-blue-500 cursor-pointer shadow-blue-600/30'
                  }`}
                  id="btn-submit-create-class"
                >
                  Create Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= REORGANIZE MODAL ================= */}
      {isReorganizeModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
          onClick={() => setIsReorganizeModalOpen(false)}
        >
          <div 
            className="bg-[#0f1523] border border-[#223046] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#141b2b] border-b border-[#1f2b3e] px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ListOrdered className="w-4 h-4 text-purple-400" />
                  <span>Organize Classes</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Drag and drop to reposition. Rows displace dynamically in real time.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsReorganizeModalOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Minimal Draggable List: Only Drag Handle and Class Name */}
            <div className="p-4 flex-1 overflow-y-auto space-y-1.5 text-xs">
              {reorderedClasses.map((cls, idx) => {
                const isBeingDragged = draggedClassIndex === idx;

                return (
                  <div 
                    key={cls.id}
                    draggable
                    onDragStart={(e) => {
                      setDraggedClassIndex(idx);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', cls.id);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (draggedClassIndex !== null && draggedClassIndex !== idx) {
                        handleLiveDisplace(idx);
                      }
                    }}
                    onDragEnd={() => {
                      setDraggedClassIndex(null);
                    }}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition-all duration-150 select-none cursor-grab active:cursor-grabbing group ${
                      isBeingDragged
                        ? 'opacity-30 border-purple-500 bg-purple-950/30 scale-[0.98]'
                        : 'bg-[#131b2a] hover:bg-[#182338] border-[#202c40] hover:border-purple-500/50 shadow-sm'
                    }`}
                  >
                    {/* Dragging Handle */}
                    <div 
                      className="text-slate-500 group-hover:text-purple-400 transition-colors shrink-0 p-0.5"
                      title="Drag to reposition"
                    >
                      <GripVertical className="w-4 h-4" />
                    </div>

                    {/* Class Name */}
                    <span className="font-semibold text-white text-xs tracking-wide">
                      {cls.name}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="p-4 bg-[#141b2b] border-t border-[#1f2b3e] flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setReorderedClasses([...classes]);
                  setDraggedClassIndex(null);
                }}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white text-xs font-medium cursor-pointer transition-colors"
              >
                Reset Order
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsReorganizeModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#141b29] hover:bg-[#1a2335] text-slate-300 font-semibold transition-colors cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateClasses(reorderedClasses);
                    setSortOrder('custom');
                    setIsReorganizeModalOpen(false);
                  }}
                  className="px-6 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all cursor-pointer text-xs shadow-md shadow-purple-600/30 flex items-center gap-1.5"
                  id="btn-done-organize-classes"
                >
                  <span>Done</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* High-Security Deletion Modal for Classes & Sections */}
      {securityDeleteTarget && (
        <SecurityDeleteModal
          isOpen={!!securityDeleteTarget}
          entityType={securityDeleteTarget.type}
          entityName={securityDeleteTarget.name}
          details={securityDeleteTarget.details}
          warningNote={securityDeleteTarget.warningNote}
          onConfirm={securityDeleteTarget.onExecute}
          onClose={() => setSecurityDeleteTarget(null)}
        />
      )}
    </div>
  );
};
