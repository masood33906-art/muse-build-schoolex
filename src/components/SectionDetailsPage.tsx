import React, { useState, useMemo } from 'react';
import { Pencil, ArrowUpDown, ArrowUp, ArrowDown, X, Users, Check } from 'lucide-react';
import { ClassInfo, Student, ClassTimelineEvent } from '../types';
import { BreadcrumbTrail } from './BreadcrumbTrail';

interface SectionDetailsPageProps {
  classInfo: ClassInfo;
  sectionName: string;
  students: Student[];
  onBackToClass: () => void;
  onBackToClasses: () => void;
  onBreadcrumbOverview?: () => void;
  onUpdateClass: (updated: ClassInfo) => void;
  onUpdateStudents: (updatedStudents: Student[]) => void;
  onSelectStudent?: (studentId: string) => void;
}

export const SectionDetailsPage: React.FC<SectionDetailsPageProps> = ({
  classInfo,
  sectionName,
  students,
  onBackToClass,
  onBackToClasses,
  onBreadcrumbOverview,
  onUpdateClass,
  onUpdateStudents,
  onSelectStudent
}) => {
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isEditSectionOpen, setIsEditSectionOpen] = useState(false);
  const [editedSectionName, setEditedSectionName] = useState(sectionName);

  // Filter students belonging to this specific class and section centrally
  const sectionStudents = useMemo(() => {
    return students.filter(s => 
      s.class && 
      s.class.toLowerCase().trim() === classInfo.name.toLowerCase().trim() &&
      (s.section || 'A').toUpperCase() === sectionName.toUpperCase()
    );
  }, [students, classInfo.name, sectionName]);

  // Sort students by name
  const sortedStudents = useMemo(() => {
    return [...sectionStudents].sort((a, b) => {
      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();
      if (sortOrder === 'asc') {
        return nameA.localeCompare(nameB);
      } else {
        return nameB.localeCompare(nameA);
      }
    });
  }, [sectionStudents, sortOrder]);

  const toggleSortOrder = () => {
    setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
  };

  // Handler: Rename / Edit Section centrally
  const handleSaveSectionRename = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = editedSectionName.trim().toUpperCase();
    if (!trimmed || trimmed === sectionName.toUpperCase()) {
      setIsEditSectionOpen(false);
      return;
    }

    const now = new Date();
    const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateFormatted = `${now.getDate().toString().padStart(2, '0')} ${now.toLocaleString('default', { month: 'short' })} ${now.getFullYear()}`;
    const badgeFormatted = `${now.getDate().toString().padStart(2, '0')} ${now.toLocaleString('default', { month: 'short' })}`;

    // 1. Update class sections
    const updatedSections = classInfo.sections.map(s => s === sectionName ? trimmed : s);

    // 2. Add event to class timeline
    const timelineEvent: ClassTimelineEvent = {
      id: `TL-SEC-${Date.now()}`,
      type: 'section_upgraded',
      title: `Section "${sectionName}" renamed to "${trimmed}"`,
      description: `Section renamed by Admin at ${timeFormatted}`,
      date: `${dateFormatted}, ${timeFormatted}`,
      badgeDate: badgeFormatted,
      time: timeFormatted,
      fee: classInfo.fee || 4800,
      author: 'Admin'
    };

    const updatedClass: ClassInfo = {
      ...classInfo,
      sections: updatedSections,
      sectionsCount: updatedSections.length,
      timeline: [timelineEvent, ...(classInfo.timeline || [])]
    };

    // 3. Update all students belonging to this class and section
    const updatedStudents = students.map(s => {
      if (
        s.class &&
        s.class.toLowerCase().trim() === classInfo.name.toLowerCase().trim() &&
        (s.section || 'A').toUpperCase() === sectionName.toUpperCase()
      ) {
        return {
          ...s,
          section: trimmed
        };
      }
      return s;
    });

    onUpdateClass(updatedClass);
    onUpdateStudents(updatedStudents);
    setIsEditSectionOpen(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200" id="section-details-page">
      {/* 1. TOP HEADER & BREADCRUMB */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          {/* Main Large Section Title, e.g. "A" */}
          <h1 className="text-3xl font-bold text-white tracking-tight">
            {sectionName}
          </h1>

          {/* Breadcrumbs: Overview • Classes • [Class] • [Section] */}
          <BreadcrumbTrail
            items={[
              { label: 'Overview', onClick: onBreadcrumbOverview },
              { label: 'Classes', onClick: onBackToClasses },
              { label: classInfo.name, onClick: onBackToClass },
              { label: sectionName }
            ]}
          />
        </div>

        {/* Top Right "Edit Section" Button (White button with pencil icon) */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => {
              setEditedSectionName(sectionName);
              setIsEditSectionOpen(true);
            }}
            className="px-4 py-2 rounded-lg bg-white hover:bg-slate-100 text-[#0c121e] text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md hover:shadow-lg"
            id="btn-edit-section"
          >
            <Pencil className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Edit Section</span>
          </button>
        </div>
      </div>

      {/* 2. STUDENTS CARD & DATA TABLE */}
      <div className="bg-[#0f1624] border border-[#1d273a] rounded-xl shadow-md overflow-hidden">
        {/* Card Header: "Students" */}
        <div className="px-6 py-4 border-b border-[#182336] flex items-center justify-between">
          <h2 className="text-base font-bold text-white tracking-tight">
            Students
          </h2>
          <span className="text-xs text-slate-400 font-medium">
            Total: <strong className="text-white">{sortedStudents.length}</strong> enrolled
          </span>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#182336] text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-[#0d1320]">
                {/* Column 1: Name with Sort toggle */}
                <th scope="col" className="py-3.5 px-6 font-semibold">
                  <button
                    type="button"
                    onClick={toggleSortOrder}
                    className="flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors cursor-pointer group"
                    title="Click to sort by name"
                  >
                    <span>Name</span>
                    {sortOrder === 'asc' ? (
                      <ArrowUp className="w-3.5 h-3.5 text-blue-400" />
                    ) : (
                      <ArrowDown className="w-3.5 h-3.5 text-blue-400" />
                    )}
                  </button>
                </th>

                {/* Column 2: Father Name */}
                <th scope="col" className="py-3.5 px-6 font-semibold">
                  Father Name
                </th>

                {/* Column 3: Cnic No */}
                <th scope="col" className="py-3.5 px-6 font-semibold">
                  Cnic No
                </th>

                {/* Column 4: Date Of Birth */}
                <th scope="col" className="py-3.5 px-6 font-semibold">
                  Date Of Birth
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#162132] text-xs">
              {sortedStudents.length > 0 ? (
                sortedStudents.map((student) => (
                  <tr
                    key={student.id}
                    className="hover:bg-[#141d2d] transition-colors group"
                  >
                    {/* Name + ID underneath */}
                    <td className="py-3.5 px-6">
                      <div className="font-semibold text-white group-hover:text-blue-300 transition-colors">
                        {student.name} ({student.id})
                      </div>
                      <div className="mt-0.5">
                        <button
                          type="button"
                          onClick={() => onSelectStudent && onSelectStudent(student.id)}
                          className="text-[11px] text-blue-400/80 hover:text-blue-300 underline underline-offset-2 cursor-pointer font-mono"
                        >
                          {student.id}
                        </button>
                      </div>
                    </td>

                    {/* Father Name + Family ID underneath */}
                    <td className="py-3.5 px-6">
                      <div className="text-slate-200 font-medium">
                        {student.family || 'Ali Raza'}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {student.familyId || 'F-0010'}
                      </div>
                    </td>

                    {/* Cnic No */}
                    <td className="py-3.5 px-6 text-slate-400">
                      {student.cnic || '-'}
                    </td>

                    {/* Date Of Birth */}
                    <td className="py-3.5 px-6 text-slate-400">
                      {student.dob || '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-12 px-6 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users className="w-8 h-8 text-slate-600" />
                      <p className="font-medium text-slate-300">
                        No students currently enrolled in Section {sectionName} of {classInfo.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        Students added to this class and section will automatically appear here.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. EDIT / RENAME SECTION MODAL */}
      {isEditSectionOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#101726] border border-[#223046] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-[#1b2638] flex items-center justify-between">
              <h3 className="font-bold text-sm text-white">
                Edit Section: {sectionName} ({classInfo.name})
              </h3>
              <button
                type="button"
                onClick={() => setIsEditSectionOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSectionRename} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Section Name *
                </label>
                <input
                  type="text"
                  value={editedSectionName}
                  onChange={(e) => setEditedSectionName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#141d2d] border border-[#233149] text-white text-xs uppercase focus:border-blue-500 focus:outline-none"
                  maxLength={10}
                  required
                  autoFocus
                />
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Renaming this section will automatically update all {sortedStudents.length} enrolled students and record an entry in the class timeline.
                </p>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-[#1b2638]">
                <button
                  type="button"
                  onClick={() => setIsEditSectionOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#141d2d] border border-[#24334a] text-slate-300 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
