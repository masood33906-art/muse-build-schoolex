import React, { useState, useMemo, useEffect } from 'react';
import { 
  MoreVertical, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  IdCard, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  XCircle,
  GraduationCap,
  ArrowRight,
  X,
  AlertTriangle,
  School,
  ChevronDown
} from 'lucide-react';
import { Student, ClassInfo } from '../types';
import { getAvatarColor } from '../data/initialStudents';
import { getStudentAvatar } from '../utils/studentAvatarHelper';

interface StudentTableProps {
  students: Student[];
  classes?: ClassInfo[];
  existingClasses?: string[];
  onOpenIdCardModal: (student: Student) => void;
  onEditStudent: (student: Student) => void;
  onDeleteStudent: (studentId: string) => void;
  onBulkDeleteStudents?: (studentIds: string[]) => void;
  onUpgradeStudentsClass?: (studentIds: string[], targetClass: string, targetSection: string) => void;
  onNavigateToClasses?: () => void;
  onToggleStatus: (studentId: string) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: (allIds: string[]) => void;
  onClearSelection: () => void;
  onBulkDownloadCards?: (selectedStudents: Student[]) => void;
  onSelectStudent?: (student: Student) => void;
  onSelectFamily?: (familyId: string, familyName: string) => void;
}

type SortField = 'name' | 'family' | 'class' | 'section' | 'status';
type SortOrder = 'asc' | 'desc';

export const StudentTable: React.FC<StudentTableProps> = ({
  students,
  classes = [],
  existingClasses = [],
  onOpenIdCardModal,
  onEditStudent,
  onDeleteStudent,
  onBulkDeleteStudents,
  onUpgradeStudentsClass,
  onNavigateToClasses,
  onToggleStatus,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onBulkDownloadCards,
  onSelectStudent,
  onSelectFamily
}) => {
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Upgrade Class Modal State
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [upgradeTargetIds, setUpgradeTargetIds] = useState<string[]>([]);
  const [targetClass, setTargetClass] = useState<string>('');
  const [targetSection, setTargetSection] = useState<string>('');

  // Compute strictly available classes and their sections from system data
  const availableClassMap = useMemo(() => {
    const map = new Map<string, string[]>();
    classes.forEach(c => {
      const name = c.name.trim();
      if (name) {
        map.set(name, c.sections && c.sections.length > 0 ? [...c.sections] : []);
      }
    });
    existingClasses.forEach(cName => {
      const trimmed = cName.trim();
      if (trimmed && !map.has(trimmed)) {
        const secsSet = new Set<string>();
        students.forEach(s => {
          if (s.class.trim().toLowerCase() === trimmed.toLowerCase() && s.section?.trim()) {
            secsSet.add(s.section.trim());
          }
        });
        map.set(trimmed, Array.from(secsSet));
      }
    });
    return map;
  }, [classes, existingClasses, students]);

  const availableClassNames = useMemo(() => {
    return Array.from(availableClassMap.keys());
  }, [availableClassMap]);

  const availableSectionsForTargetClass = useMemo(() => {
    if (!targetClass) return [];
    return availableClassMap.get(targetClass) || [];
  }, [targetClass, availableClassMap]);

  // Selected Student Objects
  const selectedStudentsList = useMemo(() => {
    return students.filter(s => selectedIds.has(s.id));
  }, [students, selectedIds]);

  const upgradeTargetStudents = useMemo(() => {
    const idSet = new Set(upgradeTargetIds);
    return students.filter(s => idSet.has(s.id));
  }, [students, upgradeTargetIds]);

  // Suggest next logical class when opening the Upgrade Class modal
  const openUpgradeModalForIds = (ids: string[]) => {
    setUpgradeTargetIds(ids);
    const targetStuds = students.filter(s => ids.includes(s.id));
    let initialClass = availableClassNames[0] || '';
    if (targetStuds.length > 0 && availableClassNames.length > 0) {
      const currentCls = targetStuds[0].class;
      const idx = availableClassNames.findIndex(c => c.toLowerCase() === currentCls.toLowerCase());
      if (idx !== -1 && idx + 1 < availableClassNames.length) {
        initialClass = availableClassNames[idx + 1];
      } else if (idx !== -1) {
        initialClass = availableClassNames[idx];
      }
    }
    const secs = initialClass ? (availableClassMap.get(initialClass) || []) : [];
    setTargetClass(initialClass);
    setTargetSection(secs[0] || '');
    setIsUpgradeModalOpen(true);
  };

  useEffect(() => {
    if (targetClass) {
      const secs = availableClassMap.get(targetClass) || [];
      if (!secs.includes(targetSection)) {
        setTargetSection(secs[0] || '');
      }
    } else {
      setTargetSection('');
    }
  }, [targetClass, availableClassMap, targetSection]);

  const handleConfirmUpgrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetClass || upgradeTargetIds.length === 0) return;
    if (onUpgradeStudentsClass) {
      onUpgradeStudentsClass(upgradeTargetIds, targetClass, targetSection);
    }
    setIsUpgradeModalOpen(false);
    setUpgradeTargetIds([]);
  };

  const handleTriggerRemoveSelected = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (onBulkDeleteStudents) {
      onBulkDeleteStudents(ids);
    } else if (ids.length === 1) {
      onDeleteStudent(ids[0]);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => {
      let aVal = a[sortField] || '';
      let bVal = b[sortField] || '';
      const comparison = aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' });
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [students, sortField, sortOrder]);

  const allVisibleIds = useMemo(() => students.map(s => s.id), [students]);
  const isAllSelected = allVisibleIds.length > 0 && allVisibleIds.every(id => selectedIds.has(id));
  const isSomeSelected = selectedIds.size > 0 && !isAllSelected;

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 opacity-60 group-hover:opacity-100" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-blue-400" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-blue-400" />
    );
  };

  return (
    <div className="bg-surface-12 border border-[#20293d] rounded-xl overflow-hidden shadow-xl flex flex-col">
      {/* ========================================================================= */}
      {/* SELECTED ENTRIES TOP BAR (Appears when 1 or more students are selected)   */}
      {/* ========================================================================= */}
      {selectedIds.size > 0 && (
        <div 
          className="bg-edge-2 border-b border-blue-500/40 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-150"
          id="student-entry-selection-topbar"
        >
          {/* Left: Selection Count & Details */}
          <div className="flex items-center flex-wrap gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-bold shadow-sm">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                {selectedIds.size} {selectedIds.size === 1 ? 'Student' : 'Students'} Selected
              </span>
            </span>

            {selectedStudentsList.length === 1 ? (
              <span className="text-xs text-slate-200 font-medium">
                {selectedStudentsList[0].name}{' '}
                <span className="text-slate-400">
                  ({selectedStudentsList[0].class}
                  {selectedStudentsList[0].section ? ` - Sec ${selectedStudentsList[0].section}` : ''})
                </span>
              </span>
            ) : (
              <span className="text-xs text-slate-300">
                Current Class:{' '}
                <strong className="text-white">
                  {Array.from(new Set(selectedStudentsList.map(s => s.class))).join(', ')}
                </strong>
              </span>
            )}

            <button
              type="button"
              onClick={onClearSelection}
              className="text-xs text-slate-400 hover:text-white underline cursor-pointer ml-1"
              id="btn-clear-student-selection"
            >
              Clear selection
            </button>
          </div>

          {/* Right: Upgrade Class & Remove Students Actions */}
          <div className="flex items-center flex-wrap gap-2">
            {/* Option 1: Upgrade Class */}
            <button
              type="button"
              onClick={() => openUpgradeModalForIds(Array.from(selectedIds))}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-md shadow-emerald-900/30"
              id="btn-upgrade-selected-students-class"
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Upgrade Class</span>
            </button>

            {/* Option 2: Remove Selected Students */}
            <button
              type="button"
              onClick={handleTriggerRemoveSelected}
              className="px-3.5 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600 border border-rose-500/40 text-rose-300 hover:text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
              id="btn-remove-selected-students"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>
                Remove {selectedIds.size === 1 ? 'Student' : `Students (${selectedIds.size})`}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Main Table with Optimized Horizontal and Vertical Scrolling Container */}
      <div 
        className="overflow-x-auto overflow-y-auto max-h-[640px] relative scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900"
        id="students-table-scroll-container"
      >
        <table className="w-full text-left border-collapse min-w-[760px]">
          {/* Sticky Table Header */}
          <thead className="sticky top-0 z-20 bg-[#161c2b] border-b border-edge-22 text-xs font-semibold text-slate-400 tracking-wider select-none shadow-sm">
            <tr>
              <th className="py-3.5 pl-4 pr-2 w-10">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  ref={el => {
                    if (el) el.indeterminate = isSomeSelected;
                  }}
                  onChange={() => {
                    if (isAllSelected) {
                      onClearSelection();
                    } else {
                      onSelectAll(allVisibleIds);
                    }
                  }}
                  aria-label="Select all students"
                  className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4"
                />
              </th>

              <th 
                className="py-3.5 px-4 cursor-pointer group hover:text-slate-200 transition-colors"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-1.5">
                  <span>Name</span>
                  {renderSortIcon('name')}
                </div>
              </th>

              <th 
                className="py-3.5 px-4 cursor-pointer group hover:text-slate-200 transition-colors"
                onClick={() => handleSort('family')}
              >
                <div className="flex items-center gap-1.5">
                  <span>Family</span>
                  {renderSortIcon('family')}
                </div>
              </th>

              <th 
                className="py-3.5 px-4 cursor-pointer group hover:text-slate-200 transition-colors"
                onClick={() => handleSort('class')}
              >
                <div className="flex items-center gap-1.5">
                  <span>Class</span>
                  {renderSortIcon('class')}
                </div>
              </th>

              <th 
                className="py-3.5 px-4 cursor-pointer group hover:text-slate-200 transition-colors"
                onClick={() => handleSort('section')}
              >
                <div className="flex items-center gap-1.5">
                  <span>Section</span>
                  {renderSortIcon('section')}
                </div>
              </th>

              <th 
                className="py-3.5 px-4 cursor-pointer group hover:text-slate-200 transition-colors"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center gap-1.5">
                  <span>Status</span>
                  {renderSortIcon('status')}
                </div>
              </th>

              <th className="py-3.5 pr-4 pl-2 text-right w-16">
                <span>Actions</span>
              </th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-[#1e2638] text-sm font-normal">
            {sortedStudents.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-14 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <p className="text-sm font-medium text-slate-300">No students found</p>
                    <p className="text-xs text-slate-500">
                      Try adjusting your search or filters
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              sortedStudents.map((student) => {
                const isSelected = selectedIds.has(student.id);
                const isMenuOpen = activeMenuId === student.id;
                const avatarBg = student.avatarColor || getAvatarColor(student.name);

                return (
                  <tr
                    key={student.id}
                    onClick={() => onSelectStudent && onSelectStudent(student)}
                    className={`group transition-colors duration-150 cursor-pointer ${
                      isSelected ? 'bg-blue-950/25' : 'hover:bg-[#161e2c]'
                    }`}
                  >
                    {/* Row Checkbox */}
                    <td 
                      className="py-3 pl-4 pr-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect(student.id)}
                        aria-label={`Select student ${student.name}`}
                        className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4"
                      />
                    </td>

                    {/* Name + Avatar + Student ID */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={getStudentAvatar(student)}
                          alt={student.name}
                          className="w-9 h-9 rounded-full object-cover border border-white/20 shrink-0 shadow-sm bg-surface-7"
                        />
                        <div className="flex flex-col">
                          <button
                            type="button"
                            onClick={() => onSelectStudent && onSelectStudent(student)}
                            className="font-semibold text-slate-100 hover:text-blue-400 group-hover:text-white hover:underline capitalize leading-snug text-left cursor-pointer transition-colors"
                            title="View student profile"
                          >
                            {student.name}
                          </button>
                          <span className="text-xs text-sky-400 font-mono tracking-tight">
                            {student.id}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Family Name + Family ID */}
                    <td 
                      className="py-3 px-4"
                      onClick={(e) => {
                        if (onSelectFamily) {
                          e.stopPropagation();
                          onSelectFamily(student.familyId, student.family);
                        }
                      }}
                    >
                      <div className="flex flex-col">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectFamily && onSelectFamily(student.familyId, student.family);
                          }}
                          className="text-slate-200 hover:text-purple-400 hover:underline text-sm capitalize text-left cursor-pointer transition-colors"
                          title="View family details"
                        >
                          {student.family}
                        </button>
                        <span className="text-xs text-purple-400/80 font-mono">
                          {student.familyId}
                        </span>
                      </div>
                    </td>

                    {/* Class */}
                    <td className="py-3 px-4">
                      <span className="text-slate-300 font-medium">
                        {student.class}
                      </span>
                    </td>

                    {/* Section */}
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-[#1f293d] text-slate-300 font-semibold text-xs border border-[#2b3954]">
                        {student.section}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-4">
                      {student.status === 'Active' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                          Inactive
                        </span>
                      )}
                    </td>

                    {/* Action Dropdown Menu */}
                    <td 
                      className="py-3 pr-4 pl-2 text-right relative"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(isMenuOpen ? null : student.id);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Actions"
                        id={`btn-action-${student.id}`}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {isMenuOpen && (
                        <>
                          <div 
                            className="fixed inset-0 z-30"
                            onClick={() => setActiveMenuId(null)}
                          />
                          <div className="absolute right-4 top-12 z-40 w-48 bg-surface-40 border border-edge-37 rounded-xl shadow-2xl py-1 text-xs text-slate-300 text-left animate-in fade-in zoom-in-95 duration-100">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                onOpenIdCardModal(student);
                              }}
                              className="w-full px-3.5 py-2 flex items-center gap-2 hover:bg-blue-600/20 hover:text-blue-300 transition-colors cursor-pointer"
                            >
                              <IdCard className="w-4 h-4 text-blue-400" />
                              <span>View / Print ID Card</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                openUpgradeModalForIds([student.id]);
                              }}
                              className="w-full px-3.5 py-2 flex items-center gap-2 hover:bg-emerald-600/20 hover:text-emerald-300 transition-colors cursor-pointer"
                            >
                              <GraduationCap className="w-4 h-4 text-emerald-400" />
                              <span>Upgrade Class</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                onEditStudent(student);
                              }}
                              className="w-full px-3.5 py-2 flex items-center gap-2 hover:bg-slate-700/40 hover:text-white transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4 text-slate-400" />
                              <span>Edit Details</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                onToggleStatus(student.id);
                              }}
                              className="w-full px-3.5 py-2 flex items-center gap-2 hover:bg-slate-700/40 hover:text-white transition-colors cursor-pointer"
                            >
                              {student.status === 'Active' ? (
                                <>
                                  <XCircle className="w-4 h-4 text-rose-400" />
                                  <span>Mark as Inactive</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                  <span>Mark as Active</span>
                                </>
                              )}
                            </button>

                            <div className="border-t border-edge-37 my-1" />

                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                onDeleteStudent(student.id);
                              }}
                              className="w-full px-3.5 py-2 flex items-center gap-2 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4 text-rose-400" />
                              <span>Delete Record</span>
                            </button>
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ========================================================================= */}
      {/* UPGRADE STUDENT CLASS MODAL                                               */}
      {/* ========================================================================= */}
      {isUpgradeModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
          id="modal-upgrade-student-class"
        >
          <div className="bg-[#121826] border border-[#24324b] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl text-slate-100">
            {/* Header */}
            <div className="px-5 py-4 border-b border-[#1f2b40] bg-[#161f30] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Upgrade / Promote Student Class
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {upgradeTargetStudents.length === 1
                      ? `Upgrading class for ${upgradeTargetStudents[0].name}`
                      : `Upgrading class for ${upgradeTargetStudents.length} selected students`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsUpgradeModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleConfirmUpgrade} className="p-5 space-y-4 text-xs">
              {/* Selected Students Preview */}
              <div className="bg-surface-7 border border-[#1f2b40] rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
                  <span>Selected Students ({upgradeTargetStudents.length})</span>
                  <span>Current → Upgraded</span>
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                  {upgradeTargetStudents.map(st => (
                    <div
                      key={st.id}
                      className="flex items-center justify-between gap-2 py-1 px-2 rounded-lg bg-surface-23 border border-[#1f2b42]"
                    >
                      <div className="truncate">
                        <span className="font-semibold text-white">{st.name}</span>
                        <span className="text-[10px] text-sky-400 font-mono ml-1.5">({st.id})</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 font-semibold">
                        <span className="text-slate-400">
                          {st.class} ({st.section})
                        </span>
                        <ArrowRight className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">
                          {targetClass || '—'} {targetSection ? `(${targetSection})` : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {availableClassNames.length === 0 ? (
                <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 space-y-2.5 text-amber-200">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      <strong>No classes available in the system.</strong> Please create target classes in the Classes module before upgrading student classes.
                    </span>
                  </div>
                  {onNavigateToClasses && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsUpgradeModalOpen(false);
                        onNavigateToClasses();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <School className="w-3.5 h-3.5" />
                      <span>Open Classes Module</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Target Class Dropdown */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1.5">
                      New / Upgraded Class <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={targetClass}
                        onChange={(e) => {
                          const nextCls = e.target.value;
                          setTargetClass(nextCls);
                          const secs = availableClassMap.get(nextCls) || [];
                          setTargetSection(secs[0] || '');
                        }}
                        className="w-full appearance-none bg-[#172133] border border-[#283954] rounded-lg px-3 py-2.5 pr-8 text-white font-semibold focus:outline-none focus:border-blue-500 cursor-pointer"
                        id="select-upgrade-target-class"
                      >
                        {availableClassNames.map(clsName => (
                          <option key={clsName} value={clsName}>
                            {clsName}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  {/* Target Section Dropdown */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1.5">
                      New Section <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={targetSection}
                        onChange={(e) => setTargetSection(e.target.value)}
                        className="w-full appearance-none bg-[#172133] border border-[#283954] rounded-lg px-3 py-2.5 pr-8 text-white font-semibold focus:outline-none focus:border-blue-500 cursor-pointer"
                        id="select-upgrade-target-section"
                      >
                        {availableSectionsForTargetClass.length === 0 ? (
                          <option value="">-- No sections available --</option>
                        ) : (
                          availableSectionsForTargetClass.map(sec => (
                            <option key={sec} value={sec}>
                              Section {sec}
                            </option>
                          ))
                        )}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="pt-3 border-t border-[#1f2b40] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsUpgradeModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-surface-41 hover:bg-edge-19 text-slate-300 font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!targetClass || availableClassNames.length === 0}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:pointer-events-none text-white font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-md shadow-emerald-900/30"
                  id="btn-confirm-class-upgrade"
                >
                  <GraduationCap className="w-4 h-4" />
                  <span>Confirm Upgrade</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
