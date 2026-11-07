import React, { useState } from 'react';
import { 
  Video, 
  Pencil, 
  Coins, 
  Calendar, 
  Layers, 
  Users, 
  Clock,
  GraduationCap,
  Sparkles,
  AlertCircle,
  X,
  Plus,
  Trash2
} from 'lucide-react';
import { ClassInfo, ClassTimelineEvent, Student } from '../types';
import { resolveClassFee, studentBelongsToClass, studentsAfterClassRename, studentsInClass, validateClassFeeInput } from '../utils/classExportHelper';
import { SectionDetailsPage } from './SectionDetailsPage';
import { BreadcrumbTrail } from './BreadcrumbTrail';
import { SecurityDeleteModal } from './SecurityDeleteModal';

interface ClassDetailsPageProps {
  classInfo: ClassInfo;
  allClasses?: ClassInfo[];
  students: Student[];
  onBackToClasses: () => void;
  onBreadcrumbOverview?: () => void;
  onUpdateClass: (updated: ClassInfo) => void;
  onUpdateStudents?: (updatedStudents: Student[]) => void;
  onNavigateToStudents?: (className: string, sectionName?: string) => void;
  onSelectStudent?: (studentId: string) => void;
}

export const ClassDetailsPage: React.FC<ClassDetailsPageProps> = ({
  classInfo,
  allClasses = [],
  students,
  onBackToClasses,
  onBreadcrumbOverview,
  onUpdateClass,
  onUpdateStudents,
  onSelectStudent
}) => {
  // Navigation state to section page matching reference image
  const [selectedSection, setSelectedSection] = useState<string | null>(null);

  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isChangeFeeOpen, setIsChangeFeeOpen] = useState(false);
  const [isMergeSectionsOpen, setIsMergeSectionsOpen] = useState(false);
  const [isManageSectionsOpen, setIsManageSectionsOpen] = useState(false);
  const [manageSectionsList, setManageSectionsList] = useState<string[]>(classInfo.sections || ['A']);
  const [manageSectionInput, setManageSectionInput] = useState('');
  const [manageSectionError, setManageSectionError] = useState('');

  // High-Security Deletion interception modal state
  const [securityDeleteTarget, setSecurityDeleteTarget] = useState<{
    type: string;
    name: string;
    details?: string;
    warningNote?: string;
    onExecute: () => void;
  } | null>(null);

  // Form states for class edit and fee change.
  // Fix P1-8: fee state is raw text and starts from the class's REAL fee
  // (empty when no fee is set) — never an invented default. 0 is a real
  // fee (free class) and round-trips as "0".
  const resolvedFee = resolveClassFee(classInfo);
  const feeInputString = resolvedFee === null ? '' : String(resolvedFee);
  const [editName, setEditName] = useState(classInfo.name);
  const [editFee, setEditFee] = useState(feeInputString);
  const [editFeeError, setEditFeeError] = useState('');
  const [feeChangeValue, setFeeChangeValue] = useState(feeInputString);
  const [feeChangeError, setFeeChangeError] = useState('');

  // Centralized filter: students belonging to this class — the shared
  // classId-first rule (Fix P0-3), so this roster always agrees with the
  // classes table, attendance and exports.
  const classStudents = studentsInClass(students || [], classInfo);

  // Duplicate name check for editing class name
  const isDuplicateEditName = Boolean(
    editName.trim() &&
    allClasses.some(
      c => c.id !== classInfo.id && c.name.trim().toLowerCase() === editName.trim().toLowerCase()
    )
  );

  // Live count only (Fix P0-1): 0 is a valid total; never fall back to the
  // legacy stored studentsCount, which is never updated.
  const totalClassStudents = classStudents.length;

  // If a section is clicked, render the Section Details Page (Matching image.png)
  if (selectedSection) {
    return (
      <SectionDetailsPage
        classInfo={classInfo}
        sectionName={selectedSection}
        students={students}
        onBackToClass={() => setSelectedSection(null)}
        onBackToClasses={onBackToClasses}
        onBreadcrumbOverview={onBreadcrumbOverview}
        onUpdateClass={onUpdateClass}
        onUpdateStudents={onUpdateStudents || (() => {})}
        onSelectStudent={onSelectStudent}
      />
    );
  }

  // Get student avatars preview for section cards
  const studentInitials = classStudents.map(s => {
    const parts = s.name.trim().split(' ');
    if (parts.length > 1) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (s.name.slice(0, 2)).toUpperCase();
  });

  // Fix P0-4: avatar bubbles show ONLY real students' initials. A class
  // with fewer than 3 students shows just those students — never invented
  // placeholder initials.
  const displayAvatars = studentInitials.slice(0, 3);

  const extraStudentsCount = Math.max(0, totalClassStudents - displayAvatars.length);

  // Get centralized count of students in a given section.
  // Each section gets its OWN live count (Fix P0-1): the previous code assigned
  // the whole stored class count to section "A" whenever the live count was 0.
  const getSectionStudentCount = (sectionName: string): number => {
    return classStudents.filter(
      s => (s.section || 'A').toUpperCase() === sectionName.toUpperCase()
    ).length;
  };

  // Fix P0-4: the timeline shows ONLY events recorded on this class. The
  // previous hardcoded "default timeline" (session starts, fee changes and
  // dates in Oct 2025 – Aug 2026) was identical fabricated history for every
  // class. When a class has no recorded events, the only honest derived
  // entry is its creation, from its own recorded createdAt; with neither,
  // the timeline is empty and the UI shows an empty state.
  const derivedTimeline: ClassTimelineEvent[] = classInfo.createdAt
    ? [
        {
          id: 'TL-CREATED',
          type: 'class_created',
          title: `Class "${classInfo.name}" created`,
          description: 'Created by Admin',
          date: classInfo.createdAt,
          badgeDate: classInfo.createdAt.split(' ').slice(0, 2).join(' '),
          fee: classInfo.fee,
          author: 'Admin'
        }
      ]
    : [];

  const timelineEvents: ClassTimelineEvent[] = classInfo.timeline && classInfo.timeline.length > 0
    ? classInfo.timeline
    : derivedTimeline;

  // Handler: Save Class Name / Base Details
  const handleSaveEditClass = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = editName.trim();
    if (!trimmed) return;
    if (isDuplicateEditName) return;

    // Fix P1-8: fee is required and validated at edit — invalid input
    // blocks the save with a visible message instead of silently keeping
    // or inventing a fee.
    const feeCheck = validateClassFeeInput(editFee);
    if ('error' in feeCheck) {
      setEditFeeError(feeCheck.error);
      return;
    }
    setEditFeeError('');

    const updated: ClassInfo = {
      ...classInfo,
      name: trimmed,
      fee: feeCheck.fee
    };
    // Fix P0-3: renaming from this page must not orphan students either —
    // same shared rename cascade as the ClassesModule edit modal.
    if (onUpdateStudents && trimmed !== classInfo.name) {
      const roster = students || [];
      const nextStudents = studentsAfterClassRename(roster, classInfo, trimmed);
      if (nextStudents !== roster) onUpdateStudents(nextStudents);
    }
    onUpdateClass(updated);
    setIsEditModalOpen(false);
  };

  // Handler: Change Fee and immediately record checkpoint in timeline with accurate timestamp
  const handleSaveFeeChange = (e: React.FormEvent) => {
    e.preventDefault();
    // Fix P1-8: validated like every other fee entry — empty, non-numeric
    // or negative input blocks with a visible message. 0 is accepted:
    // it makes the class free (the old guard silently rejected it).
    const feeCheck = validateClassFeeInput(feeChangeValue);
    if ('error' in feeCheck) {
      setFeeChangeError(feeCheck.error);
      return;
    }
    setFeeChangeError('');
    const newFeeNumber = feeCheck.fee;

    const now = new Date();
    const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateFormatted = `${now.getDate().toString().padStart(2, '0')} ${now.toLocaleString('default', { month: 'short' })} ${now.getFullYear()}`;
    const badgeFormatted = `${now.getDate().toString().padStart(2, '0')} ${now.toLocaleString('default', { month: 'short' })}`;

    const newEvent: ClassTimelineEvent = {
      id: `TL-FEE-${Date.now()}`,
      type: 'fee_changed',
      title: `Fee changed to ${newFeeNumber.toLocaleString()} PKR`,
      description: `Effective from ${dateFormatted} at ${timeFormatted}`,
      date: `${dateFormatted}, ${timeFormatted}`,
      badgeDate: badgeFormatted,
      time: timeFormatted,
      fee: newFeeNumber,
      author: 'Admin'
    };

    const currentTimeline = classInfo.timeline && classInfo.timeline.length > 0
      ? classInfo.timeline
      : timelineEvents;

    const updatedTimeline = [newEvent, ...currentTimeline];

    const updated: ClassInfo = {
      ...classInfo,
      fee: newFeeNumber,
      timeline: updatedTimeline
    };

    onUpdateClass(updated);
    setIsChangeFeeOpen(false);
  };

  // Handlers for Manage Sections (Add/Remove)
  const handleOpenManageSections = () => {
    setManageSectionsList([...(classInfo.sections || ['A'])]);
    setManageSectionInput('');
    setManageSectionError('');
    setIsManageSectionsOpen(true);
  };

  const handleAddManageSection = (customName?: string) => {
    const raw = (customName || manageSectionInput).trim();
    if (!raw) return;
    const clean = raw.toUpperCase();
    if (manageSectionsList.some(s => s.toUpperCase() === clean)) {
      setManageSectionError(`Section "${clean}" already exists in this class.`);
      return;
    }
    setManageSectionsList(prev => [...prev, clean]);
    setManageSectionInput('');
    setManageSectionError('');
  };

  const handleRemoveManageSection = (secName: string) => {
    if (manageSectionsList.length <= 1) {
      setManageSectionError('A class must have at least one section.');
      return;
    }

    const enrolled = (students || []).filter(
      s => studentBelongsToClass(s, classInfo) &&
           s.section && s.section.toLowerCase().trim() === secName.toLowerCase().trim()
    ).length;

    const remainingSection = manageSectionsList.find(s => s !== secName) || 'A';

    setSecurityDeleteTarget({
      type: 'Section',
      name: `Section ${secName}`,
      details: `Class: ${classInfo.name} • ${enrolled} Students Enrolled`,
      warningNote: enrolled > 0 
        ? `${enrolled} currently enrolled student(s) will be transferred to Section ${remainingSection}.`
        : 'This section will be permanently deleted from the class structure.',
      onExecute: () => {
        setManageSectionsList(prev => prev.filter(s => s !== secName));
        setManageSectionError('');
        setSecurityDeleteTarget(null);
      }
    });
  };

  const handleSaveManageSections = () => {
    if (manageSectionsList.length === 0) {
      setManageSectionError('A class must have at least one section.');
      return;
    }

    const removedSections = (classInfo.sections || []).filter(
      s => !manageSectionsList.includes(s)
    );
    const fallbackSection = manageSectionsList[0];

    const updated: ClassInfo = {
      ...classInfo,
      sections: manageSectionsList,
      sectionsCount: manageSectionsList.length
    };
    onUpdateClass(updated);

    // If any students were in a removed section, reassign them to fallbackSection
    if (onUpdateStudents && removedSections.length > 0) {
      const updatedStudents = students.map(s => {
        if (
          studentBelongsToClass(s, classInfo) &&
          s.section &&
          removedSections.some(rs => rs.toLowerCase() === s.section.toLowerCase())
        ) {
          return { ...s, section: fallbackSection };
        }
        return s;
      });
      onUpdateStudents(updatedStudents);
    }

    setIsManageSectionsOpen(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200" id="class-details-page">
      {/* 1. TOP HEADER & ACTION BUTTONS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {classInfo.name}
            </h1>
            <div className="w-6 h-6 rounded-md bg-surface-32 flex items-center justify-center text-slate-400">
              <Video className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Breadcrumbs */}
          <BreadcrumbTrail
            items={[
              { label: 'Overview', onClick: onBreadcrumbOverview },
              { label: 'Classes', onClick: onBackToClasses },
              { label: classInfo.name }
            ]}
          />
        </div>

        {/* Top Action Buttons */}
        <div className="flex items-center flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => setIsMergeSectionsOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-surface-21 hover:bg-surface-43 border border-edge-24 text-xs font-semibold text-slate-200 hover:text-white transition-all cursor-pointer shadow-sm"
            id="btn-merge-sections"
          >
            Merge Sections
          </button>

          <button
            type="button"
            onClick={handleOpenManageSections}
            className="px-3.5 py-1.5 rounded-lg bg-surface-21 hover:bg-surface-43 border border-edge-24 text-xs font-semibold text-slate-200 hover:text-white transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
            id="btn-manage-sections"
          >
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span>Manage Sections</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setFeeChangeValue(feeInputString);
              setFeeChangeError('');
              setIsChangeFeeOpen(true);
            }}
            className="px-3.5 py-1.5 rounded-lg bg-surface-21 hover:bg-surface-43 border border-edge-24 text-xs font-semibold text-slate-200 hover:text-white transition-all cursor-pointer shadow-sm"
            id="btn-change-fee"
          >
            Change Fee
          </button>

          {/* Edit Class */}
          <button
            type="button"
            onClick={() => {
              setEditName(classInfo.name);
              setEditFee(feeInputString);
              setEditFeeError('');
              setIsEditModalOpen(true);
            }}
            className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-surface-6 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md hover:shadow-lg"
            id="btn-edit-class-header"
          >
            <Pencil className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Edit Class</span>
          </button>
        </div>
      </div>

      {/* 2. THREE DATA CARDS (fee per student, created at, latest session) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Fee */}
        <div className="bg-surface-17 border border-edge-9 rounded-xl p-5 relative overflow-hidden flex items-center justify-between shadow-md">
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {resolvedFee !== null ? (
                <>{resolvedFee.toLocaleString()} PKR</>
              ) : (
                <span className="text-amber-400">Fee not set</span>
              )}
            </div>
            <div className="text-xs text-slate-400 font-medium mt-1">
              Fee
            </div>
          </div>

          <div className="w-12 h-12 rounded-xl bg-[#2a2215] border border-[#523e1c] flex items-center justify-center text-warning shrink-0 shadow-inner">
            <Coins className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Created At */}
        <div className="bg-surface-17 border border-edge-9 rounded-xl p-5 relative overflow-hidden flex items-center justify-between shadow-md">
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {classInfo.createdAt || 'Not recorded'}
            </div>
            <div className="text-xs text-slate-400 font-medium mt-1">
              Created At
            </div>
          </div>

          <div className="w-12 h-12 rounded-xl bg-[#142820] border border-[#1d4d38] flex items-center justify-center text-success shrink-0 shadow-inner">
            <Calendar className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Latest Session */}
        <div className="bg-surface-17 border border-edge-9 rounded-xl p-5 relative overflow-hidden flex items-center justify-between shadow-md">
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {classInfo.latestSession || 'Not recorded'}
            </div>
            <div className="text-xs text-slate-400 font-medium mt-1">
              Latest Session
            </div>
          </div>

          <div className="w-12 h-12 rounded-xl bg-[#132738] border border-[#1a4463] flex items-center justify-center text-[#0ea5e9] shrink-0 shadow-inner">
            <Layers className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 3. SECTION CONTAINER(S) WITHOUT EXTRA MANAGE BUTTON */}
      {/* Clicking each container opens the Section Details view matching the reference image */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Class Sections ({classInfo.sections.length})
          </h2>
          <span className="text-[11px] text-slate-500">
            Click a section to view student directory & edit section
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classInfo.sections.map((sectionName) => {
            const sectionCount = getSectionStudentCount(sectionName);

            return (
              <div
                key={sectionName}
                onClick={() => setSelectedSection(sectionName)}
                className="bg-surface-17 hover:bg-surface-35 border border-edge-9 hover:border-blue-500/50 rounded-xl p-5 flex items-center justify-between transition-all cursor-pointer shadow-md group relative"
                title={`Click to view Section ${sectionName} students`}
                id={`section-card-${sectionName}`}
              >
                <div>
                  <div className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
                    Section {sectionName}
                  </div>

                  <div className="text-xs text-slate-300 font-medium mt-1 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                    <span>Total Students: <strong className="text-white font-bold">{sectionCount}</strong></span>
                  </div>

                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Session: {classInfo.createdAt || 'Not recorded'}
                  </div>
                </div>

                {/* Right side avatar bubbles */}
                <div className="flex items-center -space-x-2 shrink-0">
                  {displayAvatars.map((initials, idx) => {
                    const colors = [
                      'bg-cyan-500 text-cyan-950',
                      'bg-sky-400 text-sky-950',
                      'bg-rose-500 text-white',
                      'bg-amber-500 text-amber-950',
                      'bg-emerald-500 text-emerald-950'
                    ];
                    return (
                      <div
                        key={idx}
                        className={`w-7 h-7 rounded-full ${colors[idx % colors.length]} flex items-center justify-center text-[10px] font-bold ring-2 ring-surface-17 shadow-sm`}
                      >
                        {initials}
                      </div>
                    );
                  })}
                  {extraStudentsCount > 0 && (
                    <div className="w-7 h-7 rounded-full bg-edge-11 text-blue-300 border border-[#2b3e5c] flex items-center justify-center text-[10px] font-bold ring-2 ring-surface-17">
                      +{extraStudentsCount}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. FEES PROPAGATION TIMELINE / CHECKPOINTS WITH ACCURATE TIME */}
      <div className="bg-surface-17 border border-edge-9 rounded-xl p-5 shadow-md">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">
              Fees Propagation Timeline
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Accurate chronological checkpoints of sessions, fee modifications, and upgrades
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setFeeChangeValue(feeInputString);
              setFeeChangeError('');
              setIsChangeFeeOpen(true);
            }}
            className="px-3 py-1.5 rounded-lg bg-surface-32 hover:bg-[#1e2c44] border border-edge-34 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            id="btn-update-fee-timeline"
          >
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span>Update Fee</span>
          </button>
        </div>

        {/* Timeline Checkpoints */}
        <div className="space-y-4">
          {timelineEvents.length === 0 && (
            <div className="bg-[#0e1422] border border-edge-4 rounded-xl p-6 text-center">
              <p className="text-xs font-semibold text-slate-300">No activity recorded yet</p>
              <p className="text-[11px] text-slate-500 mt-1">Events such as fee changes will appear here once they happen for this class.</p>
            </div>
          )}
          {timelineEvents.map((item, index) => {
            const isClassCreated = item.type === 'class_created';
            const isSession = item.type === 'session_started';
            const isFeeChanged = item.type === 'fee_changed';
            const isSectionUpgraded = item.type === 'section_upgraded';

            const iconBg = isClassCreated
              ? 'bg-blue-600 text-white'
              : isSession
              ? 'bg-emerald-600 text-white'
              : isSectionUpgraded
              ? 'bg-purple-600 text-white'
              : 'bg-amber-600 text-white';

            return (
              <div
                key={item.id || index}
                className="bg-[#0e1422] border border-edge-4 rounded-xl p-4 flex items-start justify-between gap-4 hover:border-[#2b3a52] transition-colors"
              >
                <div className="flex items-start gap-3.5">
                  {/* Node Icon */}
                  <div className={`w-8 h-8 rounded-full ${iconBg} flex items-center justify-center shrink-0 mt-0.5 shadow-md`}>
                    {isClassCreated && <GraduationCap className="w-4 h-4" />}
                    {isSession && <Calendar className="w-4 h-4" />}
                    {isFeeChanged && <Coins className="w-4 h-4" />}
                    {isSectionUpgraded && <Sparkles className="w-4 h-4" />}
                  </div>

                  <div>
                    {/* Event Title */}
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <span>{item.title}</span>
                    </div>

                    {/* Accurate Description */}
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {item.description}
                    </div>

                    {/* Fee & Author */}
                    <div className="flex items-center gap-3 mt-2 text-[11px]">
                      <span className={`font-semibold ${isFeeChanged ? 'text-amber-400' : isSectionUpgraded ? 'text-purple-400' : 'text-emerald-400'}`}>
                        {typeof item.fee === 'number' ? `Fee: ${item.fee.toLocaleString()} PKR` : 'Fee not set'}
                      </span>

                      {item.author && (
                        <span className="text-slate-400 flex items-center gap-1">
                          <span>👤</span>
                          <span>{item.author}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Badge Date & Accurate Time of Execution */}
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <div className="px-2.5 py-1 rounded-md bg-[#162133] border border-[#22324b] text-[11px] font-semibold text-amber-300">
                    {item.badgeDate || item.date}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-slate-300 font-mono bg-surface-17 px-2 py-0.5 rounded border border-edge-9">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{item.time || '10:00 AM'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Timeline Legend */}
        <div className="mt-6 pt-4 border-t border-[#1a2436] flex items-center gap-5 text-xs text-slate-400 flex-wrap">
          <span className="text-slate-500 font-medium">Legend</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
            <span>Class Created</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            <span>Session</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
            <span>Fee Changed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block" />
            <span>Section Upgraded</span>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* MODALS: EDIT CLASS, CHANGE FEE, MERGE SECTIONS                 */}
      {/* ============================================================== */}

      {/* 1. Edit Class Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-13 border border-edge-24 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-edge-6 flex items-center justify-between">
              <h3 className="font-bold text-sm text-white">Edit Class: {classInfo.name}</h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditClass} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Class Name *
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl bg-surface-26 border text-xs focus:outline-none transition-all ${
                    isDuplicateEditName
                      ? 'border-rose-500 focus:border-rose-500 text-rose-100 bg-rose-950/20 ring-1 ring-rose-500/30'
                      : 'border-edge-26 text-white focus:border-blue-500'
                  }`}
                  required
                />
                {isDuplicateEditName && (
                  <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-rose-400 animate-in fade-in slide-in-from-top-1 duration-150">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                    <span>Class name is already available. Please choose a different name.</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Fee per Student (PKR) *
                </label>
                <input
                  type="number"
                  value={editFee}
                  onChange={(e) => { setEditFee(e.target.value); setEditFeeError(''); }}
                  className={`w-full px-3.5 py-2.5 rounded-xl bg-surface-26 border text-white text-xs focus:outline-none ${
                    editFeeError
                      ? 'border-rose-500 focus:border-rose-500 text-rose-100 bg-rose-950/20 ring-1 ring-rose-500/30'
                      : 'border-edge-26 focus:border-blue-500'
                  }`}
                  min="0"
                  step="100"
                  required
                />
                {editFeeError && (
                  <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-rose-400 animate-in fade-in slide-in-from-top-1 duration-150" id="error-edit-fee-details">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                    <span>{editFeeError}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-edge-6">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-surface-26 border border-edge-31 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDuplicateEditName || !editName.trim()}
                  className={`px-4 py-2 rounded-xl font-semibold text-xs shadow-md transition-all ${
                    isDuplicateEditName || !editName.trim()
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                      : 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-blue-600/30'
                  }`}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Change Fee Modal */}
      {isChangeFeeOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-13 border border-edge-24 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-edge-6 flex items-center justify-between">
              <h3 className="font-bold text-sm text-white">Change Fee - {classInfo.name}</h3>
              <button
                type="button"
                onClick={() => setIsChangeFeeOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveFeeChange} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  New Monthly Fee per Student (PKR) *
                </label>
                <input
                  type="number"
                  value={feeChangeValue}
                  onChange={(e) => { setFeeChangeValue(e.target.value); setFeeChangeError(''); }}
                  className={`w-full px-3.5 py-2.5 rounded-xl bg-surface-26 border text-white text-xs focus:outline-none ${
                    feeChangeError
                      ? 'border-rose-500 focus:border-rose-500 text-rose-100 bg-rose-950/20 ring-1 ring-rose-500/30'
                      : 'border-edge-26 focus:border-blue-500'
                  }`}
                  min="0"
                  step="100"
                  required
                />
                {feeChangeError && (
                  <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-rose-400 animate-in fade-in slide-in-from-top-1 duration-150" id="error-change-fee">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                    <span>{feeChangeError}</span>
                  </div>
                )}
                <p className="text-[11px] text-slate-500 mt-1.5">Enter 0 to make this class free.</p>
              </div>

              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/25 text-[11px] text-blue-300 space-y-1">
                <div className="font-semibold text-blue-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  <span>Historical Fee Protection</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Updating this class fee will only take effect for subsequent/next monthly billing cycles. All previously generated fee records and historical receipts remain locked and preserved.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-edge-6">
                <button
                  type="button"
                  onClick={() => setIsChangeFeeOpen(false)}
                  className="px-4 py-2 rounded-xl bg-surface-26 border border-edge-31 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md shadow-amber-600/30 cursor-pointer"
                >
                  Update Fee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Merge Sections Modal */}
      {isMergeSectionsOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-13 border border-edge-24 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-edge-6 flex items-center justify-between">
              <h3 className="font-bold text-sm text-white">Merge Sections</h3>
              <button
                type="button"
                onClick={() => setIsMergeSectionsOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                Merge multiple sections into a single primary section.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Target Destination Section
                </label>
                <select
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-26 border border-edge-26 text-white text-xs focus:border-blue-500 focus:outline-none"
                  defaultValue={classInfo.sections[0]}
                >
                  {classInfo.sections.map(s => (
                    <option key={s} value={s}>Section {s}</option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-edge-6">
                <button
                  type="button"
                  onClick={() => setIsMergeSectionsOpen(false)}
                  className="px-4 py-2 rounded-xl bg-surface-26 border border-edge-31 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const primarySec = classInfo.sections[0];
                    const updated: ClassInfo = {
                      ...classInfo,
                      sections: [primarySec],
                      sectionsCount: 1
                    };
                    onUpdateClass(updated);
                    if (onUpdateStudents) {
                      const updatedStudents = students.map(s => {
                        if (studentBelongsToClass(s, classInfo)) {
                          return { ...s, section: primarySec };
                        }
                        return s;
                      });
                      onUpdateStudents(updatedStudents);
                    }
                    setIsMergeSectionsOpen(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer"
                >
                  Merge into Section {classInfo.sections[0]}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Manage Sections Modal */}
      {isManageSectionsOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-13 border border-edge-24 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95" id="modal-manage-sections">
            <div className="px-6 py-4 border-b border-edge-6 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-white">Manage Sections - {classInfo.name}</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Add or remove sections for this class</p>
              </div>
              <button
                type="button"
                onClick={() => setIsManageSectionsOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Current Active Sections */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Active Sections ({manageSectionsList.length})
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {manageSectionsList.map((sec) => {
                    const secCount = getSectionStudentCount(sec);
                    return (
                      <div
                        key={sec}
                        className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-surface-26 border border-edge-26"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-blue-950/60 border border-blue-800/40 flex items-center justify-center text-blue-400 font-bold text-xs">
                            {sec}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white">Section {sec}</div>
                            <div className="text-[11px] text-slate-400">
                              {secCount} enrolled {secCount === 1 ? 'student' : 'students'}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveManageSection(sec)}
                          disabled={manageSectionsList.length <= 1}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            manageSectionsList.length <= 1
                              ? 'text-slate-600 cursor-not-allowed'
                              : 'text-rose-400 hover:text-rose-300 hover:bg-rose-950/30'
                          }`}
                          title={manageSectionsList.length <= 1 ? "At least one section is required" : `Remove Section ${sec}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Add New Section */}
              <div className="pt-2 border-t border-edge-6 space-y-2.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Add New Section
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={manageSectionInput}
                    onChange={(e) => {
                      setManageSectionInput(e.target.value);
                      if (manageSectionError) setManageSectionError('');
                    }}
                    placeholder="e.g. C, Evening, Rose"
                    maxLength={12}
                    className={`flex-1 px-3.5 py-2 rounded-xl bg-surface-26 border text-xs text-white focus:outline-none transition-colors ${
                      manageSectionError
                        ? 'border-rose-500 bg-rose-950/20'
                        : 'border-edge-26 focus:border-blue-500'
                    }`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddManageSection();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleAddManageSection()}
                    className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Section</span>
                  </button>
                </div>

                {/* Quick Add Suggestions */}
                {(() => {
                  const alphabet = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
                  const suggestedNext = alphabet.filter(l => !manageSectionsList.includes(l)).slice(0, 4);
                  if (suggestedNext.length === 0) return null;
                  return (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <span className="text-[11px] text-slate-400">Quick add:</span>
                      {suggestedNext.map(letter => (
                        <button
                          key={letter}
                          type="button"
                          onClick={() => handleAddManageSection(letter)}
                          className="px-2 py-0.5 rounded-md bg-surface-32 hover:bg-blue-600/20 border border-edge-26 hover:border-blue-500/50 text-[11px] font-semibold text-slate-300 hover:text-blue-300 transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Plus className="w-2.5 h-2.5" />
                          <span>Section {letter}</span>
                        </button>
                      ))}
                    </div>
                  );
                })()}

                {/* Validation error */}
                {manageSectionError && (
                  <div className="flex items-center gap-1.5 text-xs font-medium text-rose-400">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span>{manageSectionError}</span>
                  </div>
                )}
              </div>

              {/* Student reassignment notice */}
              {(() => {
                const removedSections = (classInfo.sections || []).filter(
                  s => !manageSectionsList.includes(s)
                );
                const hasStudentsInRemoved = removedSections.some(sec => getSectionStudentCount(sec) > 0);
                if (!hasStudentsInRemoved) return null;
                return (
                  <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-800/40 text-[11px] text-amber-300/90 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-amber-300">Enrolled Students Note: </span>
                      Students enrolled in removed sections will automatically be safely transferred to Section {manageSectionsList[0]}.
                    </div>
                  </div>
                );
              })()}

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-edge-6">
                <button
                  type="button"
                  onClick={() => setIsManageSectionsOpen(false)}
                  className="px-4 py-2 rounded-xl bg-surface-26 border border-edge-31 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveManageSections}
                  disabled={manageSectionsList.length === 0}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* High-Security Deletion Modal for Sections */}
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
