import React, { useState, useMemo } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  ArrowLeft, 
  Calendar, 
  FileText, 
  CheckCircle2, 
  Layers, 
  Building2,
  Users,
  UserCheck,
  Filter
} from 'lucide-react';
import { Student, StaffMember, ClassInfo, AttendanceRecord } from '../types';
import { DEFAULT_SCHOOL, SchoolInfo } from '../utils/pdfGenerator';
import { getSchoolSettings } from '../utils/settingsHelper';
import { 
  getWeekDays, 
  calculateWeeklyAttendance, 
  generateWeeklyAttendancePdf,
  WeekDayInfo 
} from '../utils/attendanceHelper';
import { countStudentsInClass, findClassByName, studentBelongsToClass } from '../utils/classExportHelper';
import { localISODate } from '../utils/dates';

export type AttendanceSheetScope = 'single_section' | 'class_sections' | 'all_entities';

interface AttendanceSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  classes: ClassInfo[];
  allStudents: Student[];
  allStaff: StaffMember[];
  currentFilteredStudents?: Student[];
  currentFilteredStaff?: StaffMember[];
  initialEntityType?: 'student' | 'staff';
  filterDescription?: string;
  initialDate?: string;
  allAttendance: Record<string, AttendanceRecord[]>;
  schoolInfo?: SchoolInfo;
}

export const AttendanceSheetModal: React.FC<AttendanceSheetModalProps> = ({
  isOpen,
  onClose,
  classes,
  allStudents,
  allStaff,
  initialEntityType = 'student',
  initialDate = localISODate(),
  allAttendance,
  schoolInfo = DEFAULT_SCHOOL
}) => {
  // Config state
  const [selectedDate, setSelectedDate] = useState<string>(initialDate);
  const [entityType, setEntityType] = useState<'student' | 'staff'>(initialEntityType);
  const [scope, setScope] = useState<AttendanceSheetScope>(
    initialEntityType === 'staff' ? 'all_entities' : 'single_section'
  );
  const [selectedClass, setSelectedClass] = useState<string>(classes[0]?.name || '');
  const [selectedSection, setSelectedSection] = useState<string>(classes[0]?.sections?.[0] || '');

  // Preview state (false = config view, true = preview view)
  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(false);
  const [liveSettings, setLiveSettings] = useState(() => getSchoolSettings());
  React.useEffect(() => {
    const handleSettingsChange = () => setLiveSettings(getSchoolSettings());
    window.addEventListener('schoolSettingsUpdated', handleSettingsChange);
    return () => window.removeEventListener('schoolSettingsUpdated', handleSettingsChange);
  }, []);
  const isCompactMono = liveSettings.attendanceRegisterTemplate === 'compact-monochrome';
  // minimal-professional: FULL register structure (same columns/fields as
  // official-weekly) rendered in strict black & white only — black text,
  // thin black borders, white background, no fills and no colour-coded
  // status badges. It is deliberately NOT routed through the compact layout.
  const isMinimalProfessional = liveSettings.attendanceRegisterTemplate === 'minimal-professional';

  // Re-anchor the sheet date to the module's current date each time the
  // modal opens (the modal stays mounted, so the mount-time initializer
  // alone would go stale).
  React.useEffect(() => {
    if (isOpen) {
      setSelectedDate(initialDate);
    }
  }, [isOpen, initialDate]);

  // Sync entity type when initialEntityType changes
  React.useEffect(() => {
    setEntityType(initialEntityType);
    if (initialEntityType === 'staff') {
      setScope('all_entities');
    } else {
      setScope('single_section');
    }
  }, [initialEntityType]);

  // Sync selectedClass when classes change
  React.useEffect(() => {
    if (classes.length > 0 && !classes.some(c => c.name === selectedClass)) {
      setSelectedClass(classes[0].name);
      setSelectedSection(classes[0].sections?.[0] || '');
    } else if (classes.length === 0) {
      setSelectedClass('');
      setSelectedSection('');
    }
  }, [classes, selectedClass]);

  // Compute 7 days of the selected week
  const weekDays = useMemo(() => {
    return getWeekDays(selectedDate);
  }, [selectedDate]);

  const weekRangeLabel = useMemo(() => {
    if (weekDays.length === 0) return '';
    return `${weekDays[0].displayDate} - ${weekDays[weekDays.length - 1].displayDate} (${weekDays[0].date.slice(0, 4)})`;
  }, [weekDays]);

  // The ClassInfo record behind the selected class NAME (Fix P0-3): roster
  // membership is decided by the shared classId-first rule, so attendance
  // lists agree with the classes table even after a class is renamed.
  const selectedClassInfo = selectedClass ? findClassByName(classes, selectedClass) : undefined;
  const matchesSelectedClass = (s: Student): boolean =>
    selectedClassInfo
      ? studentBelongsToClass(s, selectedClassInfo)
      : !!s.class && s.class.toLowerCase().trim() === selectedClass.toLowerCase().trim();

  // Available sections for the currently selected class
  const availableSections = useMemo(() => {
    if (!selectedClass) return [];
    const targetClass = findClassByName(classes, selectedClass);
    if (targetClass && targetClass.sections && targetClass.sections.length > 0) {
      return targetClass.sections;
    }
    const secs = Array.from(new Set(
      allStudents
        .filter(s => targetClass ? studentBelongsToClass(s, targetClass) : (s.class && s.class.toLowerCase().trim() === selectedClass.toLowerCase().trim()))
        .map(s => s.section)
        .filter(Boolean)
    ));
    return secs;
  }, [selectedClass, classes, allStudents]);

  // Target entities based on chosen scope
  const targetEntities = useMemo(() => {
    if (entityType === 'staff') {
      return allStaff;
    }

    // Student scope (shared classId-first membership, Fix P0-3)
    if (scope === 'single_section') {
      return allStudents.filter(
        s => matchesSelectedClass(s) &&
             s.section?.toLowerCase().trim() === selectedSection.toLowerCase().trim()
      );
    }
    if (scope === 'class_sections') {
      return allStudents.filter(s => matchesSelectedClass(s));
    }
    // all_entities
    return [...allStudents].sort((a, b) => (a.class || '').localeCompare(b.class || ''));
  }, [entityType, scope, selectedClass, selectedSection, allStudents, allStaff, selectedClassInfo]);

  // Human readable scope label
  const scopeLabel = useMemo(() => {
    if (entityType === 'staff') {
      return 'All Staff Members';
    }
    if (scope === 'single_section') {
      return `${selectedClass} - Section ${selectedSection}`;
    }
    if (scope === 'class_sections') {
      return `${selectedClass} (All Sections)`;
    }
    return 'All Classes & Students';
  }, [entityType, scope, selectedClass, selectedSection]);

  // Calculate Weekly Attendance Data (with actual attendance reflected and overall numbers)
  const { memberSummaries, totals } = useMemo(() => {
    return calculateWeeklyAttendance(targetEntities, entityType, weekDays, allAttendance);
  }, [targetEntities, entityType, weekDays, allAttendance]);

  if (!isOpen) return null;

  // Handle direct print
  const handlePrint = () => {
    window.print();
  };

  // Handle direct PDF download
  const handleDownloadPdf = () => {
    generateWeeklyAttendancePdf(
      memberSummaries,
      totals,
      weekDays,
      scopeLabel,
      entityType === 'student' ? 'Students' : 'Staff',
      schoolInfo
    );
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      id="modal-generate-attendance-sheet"
    >
      <div className={`bg-surface-15 border border-[#223249] rounded-2xl w-full shadow-2xl overflow-hidden transition-all duration-200 flex flex-col ${
        isPreviewMode ? 'max-w-7xl max-h-[94vh]' : 'max-w-xl'
      }`}>
        {/* ======================================================== */}
        {/* STEP 1: CONFIGURATION POPUP                             */}
        {/* ======================================================== */}
        {!isPreviewMode ? (
          <div>
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-edge-13 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Generate Weekly Attendance Sheet</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Reflects weekly attendance records and overall totals for the selected entities
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-edge-13 flex items-center justify-center transition-colors cursor-pointer"
                id="btn-close-attendance-config"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* 1. Date of Attendance / Week Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-400" />
                    <span>Select Attendance Date (Defines Week)</span>
                  </span>
                  <span className="text-[11px] text-blue-400 font-normal">
                    Week: {weekRangeLabel}
                  </span>
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-29 border border-[#24354f] text-white text-xs focus:border-blue-500 focus:outline-none transition-colors"
                  required
                  id="input-attendance-sheet-date"
                />
              </div>

              {/* 2. Entity Type Switcher (Students vs Staff) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Target Entity
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEntityType('student');
                      setScope('single_section');
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      entityType === 'student'
                        ? 'bg-blue-600 border-blue-500 text-white shadow-sm'
                        : 'bg-surface-29 border-edge-29 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Students ({allStudents.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEntityType('staff');
                      setScope('all_entities');
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      entityType === 'staff'
                        ? 'bg-blue-600 border-blue-500 text-white shadow-sm'
                        : 'bg-surface-29 border-edge-29 text-slate-400 hover:text-white'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Staff Members ({allStaff.length})</span>
                  </button>
                </div>
              </div>

              {/* 3. Scope Radio Selection */}
              <div className="space-y-2.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Select Scope
                </label>

                <div className="space-y-2">
                  {/* Student-specific scopes */}
                  {entityType === 'student' && (
                    <>
                      {/* Option 1: Single Section */}
                      <label 
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          scope === 'single_section'
                            ? 'bg-blue-950/40 border-blue-500/50 ring-1 ring-blue-500/30'
                            : 'bg-surface-29 border-edge-29 hover:border-slate-600'
                        }`}
                      >
                        <input
                          type="radio"
                          name="attendance_scope"
                          value="single_section"
                          checked={scope === 'single_section'}
                          onChange={() => setScope('single_section')}
                          className="mt-0.5 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <div className="text-xs font-bold text-white">Single Section</div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Specific individual class and section register
                          </p>
                        </div>
                      </label>

                      {/* Option 2: All Sections of selected class */}
                      <label 
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          scope === 'class_sections'
                            ? 'bg-blue-950/40 border-blue-500/50 ring-1 ring-blue-500/30'
                            : 'bg-surface-29 border-edge-29 hover:border-slate-600'
                        }`}
                      >
                        <input
                          type="radio"
                          name="attendance_scope"
                          value="class_sections"
                          checked={scope === 'class_sections'}
                          onChange={() => setScope('class_sections')}
                          className="mt-0.5 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <div className="text-xs font-bold text-white">All Sections of Selected Class</div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Combines all sections of a single class
                          </p>
                        </div>
                      </label>
                    </>
                  )}

                  {/* All Classes / All Staff */}
                  <label 
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      scope === 'all_entities'
                        ? 'bg-blue-950/40 border-blue-500/50 ring-1 ring-blue-500/30'
                        : 'bg-surface-29 border-edge-29 hover:border-slate-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="attendance_scope"
                      value="all_entities"
                      checked={scope === 'all_entities'}
                      onChange={() => setScope('all_entities')}
                      className="mt-0.5 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="text-xs font-bold text-white">
                        {entityType === 'student' ? 'All Classes & Students' : 'All Staff Members'}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Full institutional register ({entityType === 'student' ? allStudents.length : allStaff.length} entries)
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* 4. Dynamic Dropdowns according to scope */}
              {scope === 'single_section' && entityType === 'student' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-surface-17 border border-edge-18 animate-in fade-in duration-150">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                      Select Class *
                    </label>
                    <select
                      value={selectedClass}
                      onChange={(e) => {
                        const nextCls = e.target.value;
                        setSelectedClass(nextCls);
                        const clsObj = classes.find(c => c.name === nextCls);
                        setSelectedSection(clsObj?.sections?.[0] || '');
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-[#172236] border border-edge-39 text-white text-xs focus:border-blue-500 focus:outline-none cursor-pointer"
                      id="select-sheet-class"
                    >
                      {classes.length === 0 ? (
                        <option value="">-- No classes available --</option>
                      ) : (
                        classes.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name} ({countStudentsInClass(allStudents, c)} students)
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                      Select Section *
                    </label>
                    <select
                      value={selectedSection}
                      onChange={(e) => setSelectedSection(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#172236] border border-edge-39 text-white text-xs focus:border-blue-500 focus:outline-none cursor-pointer"
                      id="select-sheet-section"
                    >
                      {availableSections.length === 0 ? (
                        <option value="">-- No sections available --</option>
                      ) : (
                        availableSections.map((sec) => (
                          <option key={sec} value={sec}>
                            Section {sec}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>
              )}

              {scope === 'class_sections' && entityType === 'student' && (
                <div className="p-4 rounded-xl bg-surface-17 border border-edge-18 animate-in fade-in duration-150">
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                    Select Class *
                  </label>
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#172236] border border-edge-39 text-white text-xs focus:border-blue-500 focus:outline-none cursor-pointer"
                    id="select-sheet-class-all"
                  >
                    {classes.length === 0 ? (
                      <option value="">-- No classes available --</option>
                    ) : (
                      classes.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name} ({c.sections.length} sections • {countStudentsInClass(allStudents, c)} students)
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}

              {/* Summary note */}
              <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                <span>Selected scope: <strong className="text-white">{scopeLabel}</strong></span>
                <span>Found: <strong className="text-blue-400">{targetEntities.length} Entries</strong></span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-edge-13 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-surface-31 hover:bg-[#1d2b42] border border-[#25364e] text-slate-300 hover:text-white text-xs font-semibold cursor-pointer transition-colors"
                id="btn-cancel-attendance-popup"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setIsPreviewMode(true)}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-600/30 cursor-pointer transition-all"
                id="btn-generate-pdf-action"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Generate PDF</span>
              </button>
            </div>
          </div>
        ) : (
          /* ======================================================== */
          /* STEP 2: WEEKLY PDF PREVIEW & PRINT VIEW                  */
          /* ======================================================== */
          <div className="flex flex-col h-full max-h-[94vh]">
            {/* Top Toolbar (Excluded from print) */}
            <div className="px-6 py-3.5 border-b border-edge-13 bg-[#111928] flex items-center justify-between gap-3 shrink-0 print:hidden">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsPreviewMode(false)}
                  className="px-3 py-1.5 rounded-lg bg-edge-3 hover:bg-[#202e45] text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors border border-[#23334c]"
                  id="btn-back-to-sheet-config"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Settings</span>
                </button>
                <div className="h-4 w-[1px] bg-slate-700 hidden sm:block" />
                <span className="text-xs text-slate-300 hidden sm:inline">
                  Previewing: <strong className="text-white">{scopeLabel}</strong> ({memberSummaries.length} entries • Week of {weekRangeLabel})
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Print / Save PDF Button */}
                <button
                  type="button"
                  onClick={handlePrint}
                  className="h-7.5 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-600/30 transition-colors box-border"
                  id="btn-print-save-pdf"
                  title="Redirect to system print dialog (Save as PDF)"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / Save PDF</span>
                </button>

                {/* Direct Download PDF */}
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="h-7.5 px-2.5 rounded-lg bg-edge-3 hover:bg-[#202e45] border border-edge-34 text-slate-200 hover:text-white text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors box-border"
                  id="btn-download-pdf-direct"
                  title="Download clean generated PDF document"
                >
                  <Download className="w-3.5 h-3.5 text-blue-400" />
                  <span>Download .PDF</span>
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={onClose}
                  className="h-7.5 w-7.5 rounded-lg text-slate-400 hover:text-white hover:bg-edge-3 border border-edge-34 flex items-center justify-center transition-colors cursor-pointer box-border"
                  id="btn-close-attendance-preview"
                  title="Close preview"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Printable Preview Paper Container (Landscape oriented view) */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-900/70 print:p-0 print:bg-white print:overflow-visible">
              <div 
                className={`bg-white rounded-xl shadow-2xl max-w-6xl mx-auto border print:border-none print:shadow-none print:p-0 print:max-w-none print:w-full font-sans ${isMinimalProfessional ? 'text-black border-black p-5 sm:p-6' : 'text-slate-900 border-slate-200 p-6 sm:p-8'}`}
                id="printable-attendance-sheet"
              >
                {/* School Header */}
                <div className={`text-center relative ${isMinimalProfessional ? 'border-b border-black pb-3 mb-3' : 'border-b-2 border-slate-900 pb-3 mb-4'}`}>
                  <div className="flex items-center justify-center gap-2 mb-1">
                    {liveSettings.schoolLogo ? (
                      <img src={liveSettings.schoolLogo} alt={schoolInfo.name} className={`w-8 h-8 object-contain border p-0.5 ${isMinimalProfessional ? 'border-black' : 'rounded-lg border-slate-200'}`} />
                    ) : (
                      <div className={isMinimalProfessional ? 'w-8 h-8 border border-black text-black flex items-center justify-center font-black text-sm' : `w-8 h-8 rounded-lg text-white flex items-center justify-center font-black text-sm shadow-sm ${isCompactMono ? 'bg-black' : 'bg-blue-950'}`}>
                        SCH
                      </div>
                    )}
                    <h1 className={`text-xl sm:text-2xl font-black tracking-tight uppercase ${isMinimalProfessional ? 'text-black' : 'text-slate-950'}`}>
                      {schoolInfo.name}
                    </h1>
                  </div>
                  <p className={`text-xs mt-0.5 font-medium ${isMinimalProfessional ? 'text-black' : 'text-slate-600'}`}>
                    {schoolInfo.campus} • {schoolInfo.address} • Contact: {schoolInfo.phone}
                  </p>
                  <div className="mt-2.5 flex items-center justify-center gap-2">
                    <div className={isMinimalProfessional ? 'inline-block px-4 py-1 border border-black text-black' : `inline-block px-4 py-1 rounded shadow-sm ${isCompactMono ? 'bg-white border-2 border-black text-black' : 'bg-slate-900 text-white'}`}>
                      <span className="text-xs font-bold tracking-wider uppercase">
                        OFFICIAL WEEKLY ATTENDANCE REGISTER ({entityType === 'student' ? 'STUDENTS' : 'STAFF'})
                      </span>
                    </div>
                    <span className={isMinimalProfessional ? 'px-2.5 py-1 border border-black text-[10px] font-bold text-black' : 'px-2.5 py-1 rounded bg-slate-100 border border-slate-300 text-[10px] font-bold text-slate-700'}>
                      SESSION {liveSettings.session || '2026-2027'}
                    </span>
                  </div>
                </div>

                {/* Metadata Row with Overall Numbers */}
                <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 text-xs mb-3 ${isMinimalProfessional ? 'border border-black' : isCompactMono ? 'bg-white border border-black' : 'bg-slate-50 border border-slate-200 rounded-lg'}`}>
                  <div>
                    <span className={`block text-[10px] uppercase font-bold ${isMinimalProfessional ? 'text-black' : 'text-slate-500'}`}>Week Period</span>
                    <span className={`font-bold ${isMinimalProfessional ? 'text-black' : 'text-slate-900'}`}>{weekRangeLabel}</span>
                  </div>
                  <div>
                    <span className={`block text-[10px] uppercase font-bold ${isMinimalProfessional ? 'text-black' : 'text-slate-500'}`}>Scope / Entity</span>
                    <span className={`font-bold ${isMinimalProfessional ? 'text-black' : 'text-slate-900'}`}>{scopeLabel}</span>
                  </div>
                  <div>
                    <span className={`block text-[10px] uppercase font-bold ${isMinimalProfessional ? 'text-black' : 'text-slate-500'}`}>Total Enrolled</span>
                    <span className={`font-bold ${isMinimalProfessional ? 'text-black' : 'text-blue-700'}`}>{memberSummaries.length} Members</span>
                  </div>
                  <div>
                    <span className={`block text-[10px] uppercase font-bold ${isMinimalProfessional ? 'text-black' : 'text-slate-500'}`}>Week Attendance Rate</span>
                    <span className={`font-extrabold ${isMinimalProfessional ? 'text-black' : 'text-emerald-700'}`}>{totals.averageRate}% Avg</span>
                  </div>
                </div>

                {/* Status Key / Legend Box */}
                <div className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[11px] mb-4 ${isMinimalProfessional ? 'border border-black text-black' : isCompactMono ? 'bg-neutral-100 border border-black' : 'bg-slate-100 border border-slate-200 rounded-lg'}`}>
                  <div className={`flex items-center gap-1.5 font-bold ${isMinimalProfessional ? 'text-black' : 'text-slate-800'}`}>
                    <span>Attendance Status Codes:</span>
                  </div>
                  <div className="flex items-center flex-wrap gap-2.5 sm:gap-4">
                    <span className="flex items-center gap-1.5"><strong className={`inline-block w-5 py-0.5 text-center border text-[10px] font-black ${isMinimalProfessional ? 'border-black text-black' : 'rounded bg-emerald-100 border-emerald-300 text-emerald-800'}`}>P</strong> Present</span>
                    <span className="flex items-center gap-1.5"><strong className={`inline-block w-5 py-0.5 text-center border text-[10px] font-black ${isMinimalProfessional ? 'border-black text-black' : 'rounded bg-cyan-100 border-cyan-300 text-cyan-800'}`}>L</strong> Late</span>
                    <span className="flex items-center gap-1.5"><strong className={`inline-block w-5 py-0.5 text-center border text-[10px] font-black ${isMinimalProfessional ? 'border-black text-black' : 'rounded bg-red-100 border-red-300 text-red-800'}`}>A</strong> Absent</span>
                    <span className="flex items-center gap-1.5"><strong className={`inline-block w-5 py-0.5 text-center border text-[10px] font-black ${isMinimalProfessional ? 'border-black text-black' : 'rounded bg-amber-100 border-amber-300 text-amber-800'}`}>Lv</strong> Leave</span>
                    <span className="flex items-center gap-1.5"><strong className={`inline-block w-5 py-0.5 text-center border text-[10px] font-black ${isMinimalProfessional ? 'border-black text-black' : 'rounded bg-slate-200 border-slate-300 text-slate-600'}`}>-</strong> Not Marked</span>
                  </div>
                  <div className={`text-[10px] font-medium ${isMinimalProfessional ? 'text-black' : 'text-slate-500'}`}>
                    Official Institutional Document
                  </div>
                </div>

                {/* Weekly Attendance Table */}
                <div className={`overflow-x-auto mb-6 ${isMinimalProfessional ? 'border border-black' : isCompactMono ? 'border border-black' : 'border border-slate-300 rounded-lg'}`}>
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className={isMinimalProfessional ? "text-black font-bold border-b border-black" : isCompactMono ? "bg-neutral-200 text-black font-bold border-b border-black" : "bg-slate-900 text-white font-semibold"}>
                        <th className={`text-center border-r w-8 ${isMinimalProfessional ? 'py-2 px-2 border-black' : 'py-2.5 px-2 border-slate-700'}`}>#</th>
                        <th className={`border-r w-20 ${isMinimalProfessional ? 'py-2 px-2.5 border-black' : 'py-2.5 px-2.5 border-slate-700'}`}>ID</th>
                        <th className={`border-r ${isMinimalProfessional ? 'py-2 px-3 border-black' : 'py-2.5 px-3 border-slate-700'}`}>Full Name</th>
                        <th className={`border-r ${isMinimalProfessional ? 'py-2 px-2.5 border-black' : 'py-2.5 px-2.5 border-slate-700'}`}>{entityType === 'student' ? 'Father / Family' : 'Role'}</th>
                        <th className={`text-center border-r ${isMinimalProfessional ? 'py-2 px-2.5 border-black' : 'py-2.5 px-2.5 border-slate-700'}`}>{entityType === 'student' ? 'Class & Sec' : 'Department'}</th>
                        {/* 7 Days */}
                        {weekDays.map(d => (
                          <th key={d.date} className={`px-1.5 text-center border-r w-14 font-mono text-[10px] ${isMinimalProfessional ? 'py-2 border-black' : 'py-2.5 border-slate-700'}`}>
                            {d.shortDay}
                          </th>
                        ))}
                        {/* Overall Numbers Columns */}
                        <th className={`px-1.5 text-center border-r w-10 font-bold ${isMinimalProfessional ? 'py-2 border-black text-black' : 'py-2.5 border-slate-700 bg-slate-800 text-emerald-400'}`} title="Total Present">P</th>
                        <th className={`px-1.5 text-center border-r w-10 font-bold ${isMinimalProfessional ? 'py-2 border-black text-black' : 'py-2.5 border-slate-700 bg-slate-800 text-red-400'}`} title="Total Absent">A</th>
                        <th className={`px-1.5 text-center border-r w-10 font-bold ${isMinimalProfessional ? 'py-2 border-black text-black' : 'py-2.5 border-slate-700 bg-slate-800 text-cyan-400'}`} title="Total Late">L</th>
                        <th className={`px-1.5 text-center border-r w-10 font-bold ${isMinimalProfessional ? 'py-2 border-black text-black' : 'py-2.5 border-slate-700 bg-slate-800 text-amber-400'}`} title="Total Leave">Lv</th>
                        <th className={`px-2 text-center w-14 font-bold ${isMinimalProfessional ? 'py-2 text-black' : 'py-2.5 bg-slate-800 text-white'}`} title="Attendance %">Att %</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isMinimalProfessional ? 'divide-black' : 'divide-slate-200'}`}>
                      {memberSummaries.length === 0 ? (
                        <tr>
                          <td colSpan={17} className={`py-8 text-center italic ${isMinimalProfessional ? 'text-black' : 'text-slate-500'}`}>
                            No entries found for the selected scope.
                          </td>
                        </tr>
                      ) : (
                        memberSummaries.map((m, idx) => (
                          <tr key={m.id} className={isMinimalProfessional ? 'bg-white' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                            <td className={`px-2 text-center border-r font-mono font-medium ${isMinimalProfessional ? 'py-1.5 border-black text-black' : 'py-2 border-slate-200 text-slate-500'}`}>
                              {idx + 1}
                            </td>
                            <td className={`px-2.5 border-r font-mono font-bold ${isMinimalProfessional ? 'py-1.5 border-black text-black' : 'py-2 border-slate-200 text-blue-900'}`}>
                              {m.id}
                            </td>
                            <td className={`px-3 border-r font-bold whitespace-nowrap ${isMinimalProfessional ? 'py-1.5 border-black text-black' : 'py-2 border-slate-200 text-slate-900'}`}>
                              {m.name}
                            </td>
                            <td className={`px-2.5 border-r whitespace-nowrap ${isMinimalProfessional ? 'py-1.5 border-black text-black' : 'py-2 border-slate-200 text-slate-700'}`}>
                              {m.secondaryInfo}
                            </td>
                            <td className={`px-2.5 text-center border-r font-medium whitespace-nowrap ${isMinimalProfessional ? 'py-1.5 border-black text-black' : 'py-2 border-slate-200 text-slate-700'}`}>
                              {m.groupInfo}
                            </td>

                            {/* 7 Days of Attendance Reflected from actual data */}
                            {weekDays.map(d => {
                              const dayData = m.dailyStatuses[d.date];
                              const code = dayData?.code || '-';
                              const status = dayData?.status;

                              let badgeClasses = 'text-slate-400';
                              if (isMinimalProfessional) {
                                // Strict B&W: status is a plain black letter/symbol,
                                // at most a thin black border — no fill, no colour.
                                badgeClasses = status && status !== 'not_marked'
                                  ? 'text-black font-black border border-black'
                                  : 'text-black';
                              }
                              else if (status === 'present') badgeClasses = 'bg-emerald-100 text-emerald-800 font-black border border-emerald-300';
                              else if (status === 'late') badgeClasses = 'bg-cyan-100 text-cyan-800 font-black border border-cyan-300';
                              else if (status === 'absent') badgeClasses = 'bg-red-100 text-red-800 font-black border border-red-300';
                              else if (status === 'leave') badgeClasses = 'bg-amber-100 text-amber-800 font-black border border-amber-300';

                              return (
                                <td key={d.date} className={`px-1 text-center border-r ${isMinimalProfessional ? 'py-1.5 border-black' : 'py-2 border-slate-200'}`}>
                                  <span className={`inline-block w-6 py-0.5 text-[10px] ${isMinimalProfessional ? '' : 'rounded'} ${badgeClasses}`}>
                                    {code}
                                  </span>
                                </td>
                              );
                            })}

                            {/* Overall Numbers for this Member */}
                            <td className={`px-1 text-center border-r font-bold ${isMinimalProfessional ? 'py-1.5 border-black text-black' : 'py-2 border-slate-200 text-emerald-700'}`}>
                              {m.totalPresent}
                            </td>
                            <td className={`px-1 text-center border-r font-bold ${isMinimalProfessional ? 'py-1.5 border-black text-black' : 'py-2 border-slate-200 text-red-700'}`}>
                              {m.totalAbsent}
                            </td>
                            <td className={`px-1 text-center border-r font-bold ${isMinimalProfessional ? 'py-1.5 border-black text-black' : 'py-2 border-slate-200 text-cyan-700'}`}>
                              {m.totalLate}
                            </td>
                            <td className={`px-1 text-center border-r font-bold ${isMinimalProfessional ? 'py-1.5 border-black text-black' : 'py-2 border-slate-200 text-amber-700'}`}>
                              {m.totalLeave}
                            </td>
                            <td className={`px-2 text-center font-black ${isMinimalProfessional ? 'py-1.5 text-black' : 'py-2 text-slate-900 bg-slate-100/70'}`}>
                              {m.attendanceRate}%
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>

                    {/* Overall Numbers Footer */}
                    {memberSummaries.length > 0 && (
                      <tfoot>
                        <tr className={isMinimalProfessional ? 'border-t-2 border-black font-bold text-[11px] text-black' : 'bg-slate-100 border-t-2 border-slate-900 font-bold text-[11px] text-slate-900'}>
                          <td colSpan={5} className={`py-2.5 px-3 border-r text-right uppercase tracking-wider ${isMinimalProfessional ? 'border-black' : 'border-slate-300'}`}>
                            Overall Numbers ({memberSummaries.length} Entries):
                          </td>
                          {/* Total Present per day */}
                          {weekDays.map(d => (
                            <td key={d.date} className={`py-2.5 px-1 text-center border-r font-mono text-[10px] ${isMinimalProfessional ? 'border-black text-black' : 'border-slate-300 text-emerald-800'}`}>
                              P: {totals.dayTotals[d.date]?.present || 0}
                            </td>
                          ))}
                          {/* Grand Totals */}
                          <td className={`py-2.5 px-1 text-center border-r ${isMinimalProfessional ? 'border-black text-black' : 'border-slate-300 text-emerald-800'}`}>
                            {totals.grandPresent}
                          </td>
                          <td className={`py-2.5 px-1 text-center border-r ${isMinimalProfessional ? 'border-black text-black' : 'border-slate-300 text-red-800'}`}>
                            {totals.grandAbsent}
                          </td>
                          <td className={`py-2.5 px-1 text-center border-r ${isMinimalProfessional ? 'border-black text-black' : 'border-slate-300 text-cyan-800'}`}>
                            {totals.grandLate}
                          </td>
                          <td className={`py-2.5 px-1 text-center border-r ${isMinimalProfessional ? 'border-black text-black' : 'border-slate-300 text-amber-800'}`}>
                            {totals.grandLeave}
                          </td>
                          <td className={`py-2.5 px-2 text-center font-black ${isMinimalProfessional ? 'text-black' : 'bg-slate-200 text-blue-950'}`}>
                            {totals.averageRate}%
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                {/* Signatures Area */}
                <div className={`pt-6 mt-4 border-t flex items-center justify-between text-xs ${isMinimalProfessional ? 'border-black text-black' : 'border-slate-300 text-slate-800'}`}>
                  <div className="space-y-1 text-center">
                    <div className={`w-52 border-b pb-1 font-semibold ${isMinimalProfessional ? 'border-black text-black' : 'border-slate-400 text-slate-900'}`}>
                      _______________________
                    </div>
                    <span className={`font-semibold text-[10px] uppercase ${isMinimalProfessional ? 'text-black' : 'text-slate-600'}`}>
                      {entityType === 'student' ? 'Class Teacher Signature' : 'Department Incharge Signature'}
                    </span>
                  </div>

                  <div className="space-y-1 text-center">
                    <div className={`w-52 border-b pb-1 font-semibold ${isMinimalProfessional ? 'border-black text-black' : 'border-slate-400 text-slate-900'}`}>
                      _______________________
                    </div>
                    <span className={`font-semibold text-[10px] uppercase ${isMinimalProfessional ? 'text-black' : 'text-slate-600'}`}>Principal / Administrator</span>
                  </div>
                </div>

                {/* Footer Note */}
                <div className={`mt-6 text-center text-[10px] ${isMinimalProfessional ? 'text-black' : 'text-slate-400'}`}>
                  Weekly Attendance Register • Generated via SchoolEx • Official Record
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
