import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calendar, 
  CalendarCheck, 
  Download, 
  FileText, 
  Search, 
  Users, 
  UserCheck, 
  Check, 
  X, 
  Clock, 
  CalendarDays, 
  TrendingUp, 
  ChevronDown, 
  Phone, 
  Video, 
  Building2, 
  AlertCircle,
  Trash2,
  Info,
  Save
} from 'lucide-react';
import { 
  Student, 
  StaffMember, 
  ClassInfo, 
  AttendanceRecord, 
  AttendanceStatus,
  HolidayRecord 
} from '../types';
import { BreadcrumbTrail } from './BreadcrumbTrail';
import { 
  ATTENDANCE_STORAGE_KEY, 
  LAST_ATTENDANCE_DATE_KEY,
  loadAttendance, 
  exportAttendanceToCSV 
} from '../utils/attendanceHelper';
import { loadJSON, saveJSON } from '../utils/storage';
import { AttendanceSheetModal } from './AttendanceSheetModal';

export const HOLIDAYS_STORAGE_KEY = 'schooliee_attendance_holidays_v1';

interface AttendanceModuleProps {
  students: Student[];
  staff: StaffMember[];
  classes: ClassInfo[];
  onBackToOverview?: () => void;
  onSelectStudent?: (student: Student) => void;
  onSelectFamily?: (familyId: string, familyName: string) => void;
  onSelectStaff?: (staff: StaffMember) => void;
  allAttendance?: Record<string, AttendanceRecord[]>;
  onUpdateAllAttendance?: (updated: Record<string, AttendanceRecord[]>) => void;
  holidays?: HolidayRecord[];
  onUpdateHolidays?: (updated: HolidayRecord[]) => void;
  onShowToast?: (message: string) => void;
}

export const AttendanceModule: React.FC<AttendanceModuleProps> = ({
  students,
  staff,
  classes,
  onBackToOverview,
  onSelectStudent,
  onSelectFamily,
  onSelectStaff,
  allAttendance: propAllAttendance,
  onUpdateAllAttendance,
  holidays: propHolidays,
  onUpdateHolidays,
  onShowToast
}) => {
  // Tab state: 'students' | 'staff'
  const [activeTab, setActiveTab] = useState<'students' | 'staff'>('students');

  // Selected date (Defaults to 2026-09-13 to match reference image)
  const [selectedDate, setSelectedDate] = useState<string>('2026-09-13');

  // Attendance Records State (persisted per date)
  const [internalAttendance, setInternalAttendance] = useState<Record<string, AttendanceRecord[]>>(() => loadAttendance());

  const allAttendance = propAllAttendance || internalAttendance;

  const setAllAttendance = (updater: React.SetStateAction<Record<string, AttendanceRecord[]>>) => {
    if (onUpdateAllAttendance && propAllAttendance) {
      const next = typeof updater === 'function' ? updater(propAllAttendance) : updater;
      onUpdateAllAttendance(next);
      saveJSON(ATTENDANCE_STORAGE_KEY, next);
    } else {
      setInternalAttendance(prev => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        saveJSON(ATTENDANCE_STORAGE_KEY, next);
        return next;
      });
    }
  };

  // Holidays State
  const [internalHolidays, setInternalHolidays] = useState<HolidayRecord[]>(() =>
    loadJSON<HolidayRecord[]>(HOLIDAYS_STORAGE_KEY, [], Array.isArray as (v: unknown) => v is HolidayRecord[])
  );

  const holidays = propHolidays || internalHolidays;

  const setHolidays = (updater: React.SetStateAction<HolidayRecord[]>) => {
    if (onUpdateHolidays && propHolidays) {
      const next = typeof updater === 'function' ? updater(propHolidays) : updater;
      onUpdateHolidays(next);
      saveJSON(HOLIDAYS_STORAGE_KEY, next);
    } else {
      setInternalHolidays(prev => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        saveJSON(HOLIDAYS_STORAGE_KEY, next);
        return next;
      });
    }
  };

  // Holiday Modal State
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState<boolean>(false);
  const [holidayReason, setHolidayReason] = useState<string>('Independence Day');
  const [holidayApplyTo, setHolidayApplyTo] = useState<'both' | 'student' | 'staff'>('both');
  const [holidayClass, setHolidayClass] = useState<string>('All Classes');
  const [holidaySection, setHolidaySection] = useState<string>('All Sections');

  // Draft attendance state so changes made to members are committed when clicking Save
  const [draftAttendance, setDraftAttendance] = useState<Record<string, AttendanceRecord[]>>(() => allAttendance);
  const [pendingMemberIds, setPendingMemberIds] = useState<Set<string>>(new Set());
  const [localToast, setLocalToast] = useState<string | null>(null);

  // Sync draftAttendance when saved allAttendance changes externally
  useEffect(() => {
    if (pendingMemberIds.size === 0) {
      setDraftAttendance(allAttendance);
    }
  }, [allAttendance, pendingMemberIds.size]);

  // Save current selected date for profile view synchronization
  useEffect(() => {
    try {
      localStorage.setItem(LAST_ATTENDANCE_DATE_KEY, selectedDate);
    } catch {
      // ignore
    }
  }, [selectedDate]);

  // Saved records for currently selected date
  const dateRecords = useMemo(() => {
    return allAttendance[selectedDate] || [];
  }, [allAttendance, selectedDate]);

  // Draft (working) records for currently selected date
  const draftDateRecords = useMemo(() => {
    return draftAttendance[selectedDate] || [];
  }, [draftAttendance, selectedDate]);

  // Filters state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('All Classes');
  const [selectedSectionFilter, setSelectedSectionFilter] = useState<string>('All Sections');
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState<string>('All Departments');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('All Roles');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('All Status');

  // Modal state
  const [isSheetModalOpen, setIsSheetModalOpen] = useState<boolean>(false);

  // Available sections for chosen class filter
  const availableSectionsForFilter = useMemo(() => {
    if (selectedClassFilter === 'All Classes') return ['All Sections'];
    const target = classes.find(c => c.name.toLowerCase() === selectedClassFilter.toLowerCase());
    if (target && target.sections && target.sections.length > 0) {
      return ['All Sections', ...target.sections];
    }
    const secs = Array.from(new Set(
      students.filter(s => s.class === selectedClassFilter).map(s => s.section).filter(Boolean)
    ));
    return ['All Sections', ...secs];
  }, [selectedClassFilter, classes, students]);

  // Available sections for holiday modal
  const availableSectionsForHoliday = useMemo(() => {
    if (holidayClass === 'All Classes') return ['All Sections'];
    const target = classes.find(c => c.name.toLowerCase() === holidayClass.toLowerCase());
    if (target && target.sections && target.sections.length > 0) {
      return ['All Sections', ...target.sections];
    }
    const secs = Array.from(new Set(
      students.filter(s => s.class?.toLowerCase() === holidayClass.toLowerCase()).map(s => s.section).filter(Boolean)
    ));
    return ['All Sections', ...secs];
  }, [holidayClass, classes, students]);

  // Available departments and roles for staff
  const staffDepartments = useMemo(() => {
    const deps = Array.from(new Set(staff.map(s => s.department).filter(Boolean)));
    return ['All Departments', ...deps];
  }, [staff]);

  const staffRoles = useMemo(() => {
    const rls = Array.from(new Set(staff.map(s => s.role).filter(Boolean)));
    return ['All Roles', ...rls];
  }, [staff]);

  // Helper to get saved record for a member
  const getMemberRecord = (memberId: string): AttendanceRecord | undefined => {
    return dateRecords.find(r => r.id === memberId);
  };

  // Helper to get draft (staged) record for a member
  const getDraftMemberRecord = (memberId: string): AttendanceRecord | undefined => {
    return draftDateRecords.find(r => r.id === memberId);
  };

  // Helper to check if a member has an active holiday
  const getHolidayForMember = (member: Student | StaffMember, type: 'student' | 'staff'): HolidayRecord | undefined => {
    return holidays.find(h => {
      if (h.date !== selectedDate) return false;
      if (h.applyTo !== 'both' && h.applyTo !== type) return false;
      if (type === 'student') {
        const s = member as Student;
        if (h.class && h.class !== 'All Classes' && s.class?.toLowerCase() !== h.class.toLowerCase()) {
          return false;
        }
        if (h.section && h.section !== 'All Sections' && s.section?.toLowerCase() !== h.section.toLowerCase()) {
          return false;
        }
      }
      return true;
    });
  };

  // Helper to check if active view has holiday
  const activeHoliday = useMemo(() => {
    return holidays.find(h => {
      if (h.date !== selectedDate) return false;
      if (h.applyTo !== 'both' && h.applyTo !== (activeTab === 'students' ? 'student' : 'staff')) {
        return false;
      }
      if (activeTab === 'students') {
        if (h.class && h.class !== 'All Classes' && selectedClassFilter !== 'All Classes') {
          if (h.class.toLowerCase() !== selectedClassFilter.toLowerCase()) return false;
        }
        if (h.section && h.section !== 'All Sections' && selectedSectionFilter !== 'All Sections') {
          if (h.section.toLowerCase() !== selectedSectionFilter.toLowerCase()) return false;
        }
      }
      return true;
    });
  }, [holidays, selectedDate, activeTab, selectedClassFilter, selectedSectionFilter]);

  // Reset pending changes when switching dates
  useEffect(() => {
    setDraftAttendance(allAttendance);
    setPendingMemberIds(new Set());
  }, [selectedDate]);

  // Compute unsaved member IDs by comparing draftDateRecords vs dateRecords + pendingMemberIds
  const unsavedMemberIds = useMemo(() => {
    const ids = new Set<string>(pendingMemberIds);
    const savedMap = new Map<string, AttendanceStatus>();
    dateRecords.forEach(r => savedMap.set(r.id, r.status));
    draftDateRecords.forEach(r => {
      const savedStatus = savedMap.get(r.id) || 'not_marked';
      if (r.status !== savedStatus) {
        ids.add(r.id);
      }
    });
    return ids;
  }, [pendingMemberIds, dateRecords, draftDateRecords]);

  // Helper to stage a member's attendance change (committed when clicking Save)
  const handleUpdateStatus = (
    member: Student | StaffMember,
    type: 'student' | 'staff',
    newStatus: AttendanceStatus
  ) => {
    // If holiday is active for this member or view, actions are disabled
    if (getHolidayForMember(member, type) || activeHoliday) {
      return;
    }

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    setDraftAttendance(prev => {
      const currentList = prev[selectedDate] ? [...prev[selectedDate]] : [];
      const existingIdx = currentList.findIndex(r => r.id === member.id);

      const updatedRecord: AttendanceRecord = {
        id: member.id,
        name: member.name,
        type,
        date: selectedDate,
        status: newStatus,
        checkInTime: (newStatus === 'present' || newStatus === 'late') ? currentTime : undefined,
        remarks: newStatus === 'absent' ? 'Absent' : newStatus === 'leave' ? 'Leave' : '-',
        class: (member as Student).class,
        section: (member as Student).section,
        department: (member as StaffMember).department,
        role: (member as StaffMember).role,
        isManual: true // Marked manually! Will not be overridden by Mark All
      };

      if (existingIdx >= 0) {
        currentList[existingIdx] = updatedRecord;
      } else {
        currentList.push(updatedRecord);
      }

      return {
        ...prev,
        [selectedDate]: currentList
      };
    });

    setPendingMemberIds(prev => {
      const next = new Set(prev);
      next.add(member.id);
      return next;
    });
  };

  // Save Button Handler: commits draftAttendance changes to allAttendance & localStorage
  const handleSaveAttendance = () => {
    if (activeHoliday) return;
    setAllAttendance(draftAttendance);
    saveJSON(ATTENDANCE_STORAGE_KEY, draftAttendance);
    try {
      localStorage.setItem(LAST_ATTENDANCE_DATE_KEY, selectedDate);
    } catch (e) {
      console.error(e);
    }
    const changedCount = unsavedMemberIds.size;
    setPendingMemberIds(new Set());
    const tabLabel = activeTab === 'students' ? 'student' : 'staff';
    const msg = changedCount > 0
      ? `Saved ${tabLabel} attendance updates for ${changedCount} member${changedCount === 1 ? '' : 's'} (${selectedDate})`
      : `Saved ${tabLabel} attendance for ${selectedDate}`;
    if (onShowToast) {
      onShowToast(msg);
    } else {
      setLocalToast(msg);
      setTimeout(() => setLocalToast(null), 3000);
    }
  };

  // Bulk Actions
  const handleMarkAllPresent = () => {
    if (activeHoliday) return;
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const targetMembers = activeTab === 'students' ? filteredStudents : filteredStaff;
    const currentList = draftAttendance[selectedDate] ? [...draftAttendance[selectedDate]] : [];
    const changedIds: string[] = [];

    targetMembers.forEach(member => {
      const existingIdx = currentList.findIndex(r => r.id === member.id);
      const existing = existingIdx >= 0 ? currentList[existingIdx] : undefined;

      // Protected: If user manually set this entry or member is in holiday, DO NOT overwrite!
      if (existing?.isManual || getHolidayForMember(member, activeTab === 'students' ? 'student' : 'staff')) {
        return;
      }

      changedIds.push(member.id);

      const rec: AttendanceRecord = {
        id: member.id,
        name: member.name,
        type: activeTab === 'students' ? 'student' : 'staff',
        date: selectedDate,
        status: 'present',
        checkInTime: currentTime,
        remarks: '-',
        class: (member as Student).class,
        section: (member as Student).section,
        department: (member as StaffMember).department,
        role: (member as StaffMember).role,
        isManual: false
      };
      if (existingIdx >= 0) {
        currentList[existingIdx] = rec;
      } else {
        currentList.push(rec);
      }
    });

    setDraftAttendance(prev => ({ ...prev, [selectedDate]: currentList }));

    if (changedIds.length > 0) {
      setPendingMemberIds(prev => {
        const next = new Set(prev);
        changedIds.forEach(id => next.add(id));
        return next;
      });
    }
  };

  const handleMarkAllAbsent = () => {
    if (activeHoliday) return;
    const targetMembers = activeTab === 'students' ? filteredStudents : filteredStaff;
    const currentList = draftAttendance[selectedDate] ? [...draftAttendance[selectedDate]] : [];
    const changedIds: string[] = [];

    targetMembers.forEach(member => {
      const existingIdx = currentList.findIndex(r => r.id === member.id);
      const existing = existingIdx >= 0 ? currentList[existingIdx] : undefined;

      // Protected: If user manually set this entry or member is in holiday, DO NOT overwrite!
      if (existing?.isManual || getHolidayForMember(member, activeTab === 'students' ? 'student' : 'staff')) {
        return;
      }

      changedIds.push(member.id);

      const rec: AttendanceRecord = {
        id: member.id,
        name: member.name,
        type: activeTab === 'students' ? 'student' : 'staff',
        date: selectedDate,
        status: 'absent',
        checkInTime: undefined,
        remarks: '-',
        class: (member as Student).class,
        section: (member as Student).section,
        department: (member as StaffMember).department,
        role: (member as StaffMember).role,
        isManual: false
      };
      if (existingIdx >= 0) {
        currentList[existingIdx] = rec;
      } else {
        currentList.push(rec);
      }
    });

    setDraftAttendance(prev => ({ ...prev, [selectedDate]: currentList }));

    if (changedIds.length > 0) {
      setPendingMemberIds(prev => {
        const next = new Set(prev);
        changedIds.forEach(id => next.add(id));
        return next;
      });
    }
  };

  // Open holiday modal
  const handleOpenHolidayModal = () => {
    setHolidayReason('National Holiday');
    setHolidayApplyTo('both');
    setHolidayClass(selectedClassFilter !== 'All Classes' ? selectedClassFilter : 'All Classes');
    setHolidaySection(selectedSectionFilter !== 'All Sections' ? selectedSectionFilter : 'All Sections');
    setIsHolidayModalOpen(true);
  };

  // Confirm Mark Holiday
  const handleConfirmMarkHoliday = () => {
    if (!holidayReason.trim()) return;

    const newHoliday: HolidayRecord = {
      id: `hol-${Date.now()}`,
      date: selectedDate,
      reason: holidayReason.trim(),
      applyTo: holidayApplyTo,
      class: holidayClass,
      section: holidaySection,
      createdAt: new Date().toISOString()
    };

    setHolidays(prev => [
      ...prev.filter(h => !(h.date === selectedDate && h.applyTo === holidayApplyTo && h.class === holidayClass && h.section === holidaySection)),
      newHoliday
    ]);

    // Automatically set status to leave for affected entities
    setAllAttendance(prev => {
      const currentList = prev[selectedDate] ? [...prev[selectedDate]] : [];

      if (holidayApplyTo === 'both' || holidayApplyTo === 'student') {
        students.forEach(s => {
          if (holidayClass !== 'All Classes' && s.class?.toLowerCase() !== holidayClass.toLowerCase()) {
            return;
          }
          if (holidaySection !== 'All Sections' && s.section?.toLowerCase() !== holidaySection.toLowerCase()) {
            return;
          }
          const idx = currentList.findIndex(r => r.id === s.id);
          const rec: AttendanceRecord = {
            id: s.id,
            name: s.name,
            type: 'student',
            date: selectedDate,
            status: 'leave',
            checkInTime: undefined,
            remarks: `Holiday: ${holidayReason.trim()}`,
            class: s.class,
            section: s.section,
            isManual: false
          };
          if (idx >= 0) {
            currentList[idx] = rec;
          } else {
            currentList.push(rec);
          }
        });
      }

      if (holidayApplyTo === 'both' || holidayApplyTo === 'staff') {
        staff.forEach(st => {
          const idx = currentList.findIndex(r => r.id === st.id);
          const rec: AttendanceRecord = {
            id: st.id,
            name: st.name,
            type: 'staff',
            date: selectedDate,
            status: 'leave',
            checkInTime: undefined,
            remarks: `Holiday: ${holidayReason.trim()}`,
            department: st.department,
            role: st.role,
            isManual: false
          };
          if (idx >= 0) {
            currentList[idx] = rec;
          } else {
            currentList.push(rec);
          }
        });
      }

      return { ...prev, [selectedDate]: currentList };
    });

    setDraftAttendance(prev => {
      const currentList = prev[selectedDate] ? [...prev[selectedDate]] : [];
      if (holidayApplyTo === 'both' || holidayApplyTo === 'student') {
        students.forEach(s => {
          if (holidayClass !== 'All Classes' && s.class?.toLowerCase() !== holidayClass.toLowerCase()) return;
          if (holidaySection !== 'All Sections' && s.section?.toLowerCase() !== holidaySection.toLowerCase()) return;
          const idx = currentList.findIndex(r => r.id === s.id);
          const rec: AttendanceRecord = {
            id: s.id,
            name: s.name,
            type: 'student',
            date: selectedDate,
            status: 'leave',
            checkInTime: undefined,
            remarks: `Holiday: ${holidayReason.trim()}`,
            class: s.class,
            section: s.section,
            isManual: false
          };
          if (idx >= 0) currentList[idx] = rec;
          else currentList.push(rec);
        });
      }
      if (holidayApplyTo === 'both' || holidayApplyTo === 'staff') {
        staff.forEach(st => {
          const idx = currentList.findIndex(r => r.id === st.id);
          const rec: AttendanceRecord = {
            id: st.id,
            name: st.name,
            type: 'staff',
            date: selectedDate,
            status: 'leave',
            checkInTime: undefined,
            remarks: `Holiday: ${holidayReason.trim()}`,
            department: st.department,
            role: st.role,
            isManual: false
          };
          if (idx >= 0) currentList[idx] = rec;
          else currentList.push(rec);
        });
      }
      return { ...prev, [selectedDate]: currentList };
    });

    setPendingMemberIds(new Set());
    setIsHolidayModalOpen(false);
  };

  // Remove Holiday
  const handleRemoveHoliday = (holidayId: string) => {
    setHolidays(prev => prev.filter(h => h.id !== holidayId));
  };

  // Filtered lists
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = s.name.toLowerCase().includes(q);
        const matchId = s.id.toLowerCase().includes(q);
        const matchFamily = (s.family || '').toLowerCase().includes(q);
        const matchPhone = (s.phone || '').includes(q);
        if (!matchName && !matchId && !matchFamily && !matchPhone) return false;
      }
      // Class filter
      if (selectedClassFilter !== 'All Classes' && s.class?.toLowerCase() !== selectedClassFilter.toLowerCase()) {
        return false;
      }
      // Section filter
      if (selectedSectionFilter !== 'All Sections' && s.section?.toLowerCase() !== selectedSectionFilter.toLowerCase()) {
        return false;
      }
      // Status filter
      if (selectedStatusFilter !== 'All Status') {
        const rec = getMemberRecord(s.id);
        const memberStatus = rec?.status || 'not_marked';
        if (selectedStatusFilter.toLowerCase() === 'present' && memberStatus !== 'present') return false;
        if (selectedStatusFilter.toLowerCase() === 'late' && memberStatus !== 'late') return false;
        if (selectedStatusFilter.toLowerCase() === 'absent' && memberStatus !== 'absent') return false;
        if (selectedStatusFilter.toLowerCase() === 'on leave' && memberStatus !== 'leave') return false;
        if (selectedStatusFilter.toLowerCase() === 'not marked' && memberStatus !== 'not_marked') return false;
      }
      return true;
    });
  }, [students, searchQuery, selectedClassFilter, selectedSectionFilter, selectedStatusFilter, dateRecords]);

  const filteredStaff = useMemo(() => {
    return staff.filter(st => {
      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = st.name.toLowerCase().includes(q);
        const matchId = st.id.toLowerCase().includes(q);
        const matchRole = st.role.toLowerCase().includes(q);
        const matchDept = st.department.toLowerCase().includes(q);
        const matchPhone = (st.phone || '').includes(q);
        if (!matchName && !matchId && !matchRole && !matchDept && !matchPhone) return false;
      }
      // Department filter
      if (selectedDepartmentFilter !== 'All Departments' && st.department.toLowerCase() !== selectedDepartmentFilter.toLowerCase()) {
        return false;
      }
      // Role filter
      if (selectedRoleFilter !== 'All Roles' && st.role.toLowerCase() !== selectedRoleFilter.toLowerCase()) {
        return false;
      }
      // Status filter
      if (selectedStatusFilter !== 'All Status') {
        const rec = getMemberRecord(st.id);
        const memberStatus = rec?.status || 'not_marked';
        if (selectedStatusFilter.toLowerCase() === 'present' && memberStatus !== 'present') return false;
        if (selectedStatusFilter.toLowerCase() === 'late' && memberStatus !== 'late') return false;
        if (selectedStatusFilter.toLowerCase() === 'absent' && memberStatus !== 'absent') return false;
        if (selectedStatusFilter.toLowerCase() === 'on leave' && memberStatus !== 'leave') return false;
        if (selectedStatusFilter.toLowerCase() === 'not marked' && memberStatus !== 'not_marked') return false;
      }
      return true;
    });
  }, [staff, searchQuery, selectedDepartmentFilter, selectedRoleFilter, selectedStatusFilter, dateRecords]);

  // Descriptive summary of active filters
  const filterSummary = useMemo(() => {
    if (activeTab === 'students') {
      const parts = [];
      if (selectedClassFilter !== 'All Classes') parts.push(selectedClassFilter);
      if (selectedSectionFilter !== 'All Sections') parts.push(`Sec ${selectedSectionFilter}`);
      if (selectedStatusFilter !== 'All Status') parts.push(selectedStatusFilter);
      if (searchQuery.trim()) parts.push(`"${searchQuery}"`);
      return parts.length > 0 ? parts.join(' • ') : 'All Students';
    } else {
      const parts = [];
      if (selectedDepartmentFilter !== 'All Departments') parts.push(selectedDepartmentFilter);
      if (selectedRoleFilter !== 'All Roles') parts.push(selectedRoleFilter);
      if (selectedStatusFilter !== 'All Status') parts.push(selectedStatusFilter);
      if (searchQuery.trim()) parts.push(`"${searchQuery}"`);
      return parts.length > 0 ? parts.join(' • ') : 'All Staff';
    }
  }, [activeTab, selectedClassFilter, selectedSectionFilter, selectedDepartmentFilter, selectedRoleFilter, selectedStatusFilter, searchQuery]);

  // Statistics Calculation
  const activePool = activeTab === 'students' ? students : staff;
  const stats = useMemo(() => {
    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    let leaveCount = 0;
    let notMarkedCount = 0;

    activePool.forEach(member => {
      const rec = getMemberRecord(member.id);
      const status = rec?.status || 'not_marked';
      if (status === 'present') presentCount++;
      else if (status === 'late') lateCount++;
      else if (status === 'absent') absentCount++;
      else if (status === 'leave') leaveCount++;
      else notMarkedCount++;
    });

    const total = activePool.length || 1;
    // Attendance rate: present + late divided by total
    const rate = ((presentCount + lateCount) / total) * 100;

    return {
      presentCount,
      lateCount,
      absentCount,
      leaveCount,
      notMarkedCount,
      rate: rate.toFixed(2),
      total
    };
  }, [activePool, dateRecords]);

  // Count of eligible members that can be marked by Mark All (excluding manual entries and holidays)
  const unmarkedRemainingCount = useMemo(() => {
    const list = activeTab === 'students' ? filteredStudents : filteredStaff;
    return list.filter(m => {
      const rec = getDraftMemberRecord(m.id);
      const isManual = rec?.isManual;
      const isHoliday = Boolean(getHolidayForMember(m, activeTab === 'students' ? 'student' : 'staff'));
      return !isManual && !isHoliday;
    }).length;
  }, [activeTab, filteredStudents, filteredStaff, draftDateRecords, holidays, selectedDate]);

  // Count of manual entries that are protected
  const manualCount = useMemo(() => {
    const list = activeTab === 'students' ? filteredStudents : filteredStaff;
    return list.filter(m => getDraftMemberRecord(m.id)?.isManual).length;
  }, [activeTab, filteredStudents, filteredStaff, draftDateRecords]);

  // Formatted date string for bulk action subtitle e.g. "Sep 13"
  const shortDateFormatted = useMemo(() => {
    try {
      const d = new Date(selectedDate);
      if (isNaN(d.getTime())) return 'Sep 13';
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[d.getMonth()]} ${d.getDate()}`;
    } catch {
      return 'Sep 13';
    }
  }, [selectedDate]);

  // Export CSV handler
  const handleExportTodayCSV = () => {
    const currentRecords = dateRecords.length > 0 ? dateRecords : [];
    // If no records in storage for today, generate snapshot
    if (currentRecords.length === 0) {
      const snapshot: AttendanceRecord[] = [
        ...students.map(s => ({
          id: s.id,
          name: s.name,
          type: 'student' as const,
          date: selectedDate,
          status: 'not_marked' as AttendanceStatus,
          remarks: '-',
          class: s.class,
          section: s.section
        })),
        ...staff.map(st => ({
          id: st.id,
          name: st.name,
          type: 'staff' as const,
          date: selectedDate,
          status: 'not_marked' as AttendanceStatus,
          remarks: '-',
          department: st.department,
          role: st.role
        }))
      ];
      exportAttendanceToCSV(selectedDate, snapshot);
    } else {
      exportAttendanceToCSV(selectedDate, currentRecords);
    }
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-6 text-slate-100 animate-in fade-in duration-200 select-none">
      {/* ======================================================== */}
      {/* 1. TOP HEADER & BREADCRUMB & TOP BUTTONS                 */}
      {/* ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Attendance
            </h1>
            <div className="w-8 h-8 rounded-lg bg-surface-35 border border-edge-32 flex items-center justify-center text-slate-400">
              <Video className="w-4 h-4" />
            </div>
          </div>
          <BreadcrumbTrail
            items={[
              { label: 'Overview', onClick: onBackToOverview },
              { label: 'Attendance' }
            ]}
          />
        </div>

        {/* Top Action Buttons: Export (CSV) + Generate Attendance Sheet (White) */}
        {/* Note: "donot include the scan qr and leave requests buttons." */}
        <div className="flex items-center gap-2.5">
          {/* Export button */}
          <button
            type="button"
            onClick={handleExportTodayCSV}
            className="h-7.5 px-3 rounded-xl bg-surface-21 hover:bg-edge-7 border border-edge-24 text-slate-200 hover:text-white text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm transition-all box-border"
            id="btn-attendance-export-csv"
            title="Export all attendance data of today in CSV format"
          >
            <Download className="w-3.5 h-3.5 text-slate-300" />
            <span>Export</span>
          </button>

          {/* Generate attendance sheet button (White button with icon) */}
          <button
            type="button"
            onClick={() => setIsSheetModalOpen(true)}
            className="h-7.5 px-3 rounded-xl bg-white hover:bg-slate-100 text-surface-6 text-[11px] font-bold flex items-center gap-1.5 shadow-md shadow-white/10 cursor-pointer transition-all box-border"
            id="btn-open-generate-attendance-sheet"
            title="Generate official printable attendance sheet"
          >
            <FileText className="w-3.5 h-3.5 text-surface-6" />
            <span>Generate attendance sheet</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. STAT CARDS (EXACT MATCH TO REFERENCE IMAGE)          */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Card 1: Attendance Rate (Dark Blue with glow) */}
        <div 
          className="bg-surface-17 border border-[#1e2c42] rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-sm flex flex-col justify-between"
          id="stat-card-rate"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-full bg-blue-900/40 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <UserCheck className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <TrendingUp className="w-3 h-3" />
              <span>+6.9%</span>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-xs font-medium text-slate-400">Attendance Rate</span>
            <div className="text-2xl sm:text-3xl font-extrabold text-white mt-0.5 tracking-tight">
              {stats.rate}%
            </div>
          </div>
        </div>

        {/* Card 2: Absent (Soft Coral/Peach Pastel with bold red text) */}
        <div 
          className="bg-[#fbeae7] border border-[#f5c7be] rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-sm flex flex-col justify-between"
          id="stat-card-absent"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-full bg-[#f6cfc7] flex items-center justify-center text-[#c2410c]">
              <X className="w-5 h-5 stroke-[2.5]" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-xs font-bold text-[#b9382b]">Absent</span>
            <div className="text-2xl sm:text-3xl font-black text-[#991b1b] mt-0.5 tracking-tight">
              {stats.absentCount}
            </div>
          </div>
        </div>

        {/* Card 3: On Leave (Soft Warm Amber Pastel with bold brown/amber text) */}
        <div 
          className="bg-[#fef5dc] border border-[#fae2a0] rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-sm flex flex-col justify-between"
          id="stat-card-leave"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-full bg-[#fae8b4] flex items-center justify-center text-[#b45309]">
              <CalendarDays className="w-5 h-5 stroke-[2.2]" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-xs font-bold text-[#b45309]">On Leave</span>
            <div className="text-2xl sm:text-3xl font-black text-[#92400e] mt-0.5 tracking-tight">
              {stats.leaveCount}
            </div>
          </div>
        </div>

        {/* Card 4: Late (Soft Mint/Cyan Pastel with bold teal text) */}
        <div 
          className="bg-[#dcf6f5] border border-[#b2ebe9] rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-sm flex flex-col justify-between"
          id="stat-card-late"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-full bg-[#c2eeed] flex items-center justify-center text-[#0f766e]">
              <Clock className="w-5 h-5 stroke-[2.2]" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-xs font-bold text-[#0f766e]">Late</span>
            <div className="text-2xl sm:text-3xl font-black text-[#115e59] mt-0.5 tracking-tight">
              {stats.lateCount}
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. FILTER BAR                                           */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        {/* Search student/staff */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={activeTab === 'students' ? 'Search student...' : 'Search staff...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-surface-17 border border-[#1f2c40] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            id="input-attendance-search"
          />
        </div>

        {/* Attendance Date with floating label style */}
        <div className="relative border border-[#1f2c40] rounded-xl bg-surface-17 px-3 py-1.5 flex items-center justify-between">
          <div className="flex-1">
            <span className="text-[10px] text-slate-400 block leading-tight font-medium">
              Attendance Date
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs text-white font-semibold focus:outline-none cursor-pointer w-full"
              id="input-attendance-date-filter"
            />
          </div>
          <Calendar className="w-4 h-4 text-slate-400 shrink-0 pointer-events-none" />
        </div>

        {/* Dropdown 1: Class (for students) / Department (for staff) */}
        {activeTab === 'students' ? (
          <div className="relative">
            <select
              value={selectedClassFilter}
              onChange={(e) => {
                setSelectedClassFilter(e.target.value);
                setSelectedSectionFilter('All Sections');
              }}
              className="w-full px-3 py-2.5 rounded-xl bg-surface-17 border border-[#1f2c40] text-xs text-white focus:outline-none focus:border-blue-500 appearance-none cursor-pointer pr-8"
              id="select-filter-class"
            >
              <option value="All Classes">All Classes</option>
              {classes.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        ) : (
          <div className="relative">
            <select
              value={selectedDepartmentFilter}
              onChange={(e) => setSelectedDepartmentFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-surface-17 border border-[#1f2c40] text-xs text-white focus:outline-none focus:border-blue-500 appearance-none cursor-pointer pr-8"
              id="select-filter-department"
            >
              {staffDepartments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        )}

        {/* Dropdown 2: Section (for students) / Role (for staff) */}
        {activeTab === 'students' ? (
          <div className="relative">
            <select
              value={selectedSectionFilter}
              onChange={(e) => setSelectedSectionFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-surface-17 border border-[#1f2c40] text-xs text-white focus:outline-none focus:border-blue-500 appearance-none cursor-pointer pr-8"
              id="select-filter-section"
            >
              {availableSectionsForFilter.map(sec => (
                <option key={sec} value={sec}>{sec === 'All Sections' ? sec : `Section ${sec}`}</option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        ) : (
          <div className="relative">
            <select
              value={selectedRoleFilter}
              onChange={(e) => setSelectedRoleFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-surface-17 border border-[#1f2c40] text-xs text-white focus:outline-none focus:border-blue-500 appearance-none cursor-pointer pr-8"
              id="select-filter-role"
            >
              {staffRoles.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        )}

        {/* Dropdown 3: All Status */}
        <div className="relative">
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-surface-17 border border-[#1f2c40] text-xs text-white focus:outline-none focus:border-blue-500 appearance-none cursor-pointer pr-8"
            id="select-filter-status"
          >
            <option value="All Status">All Status</option>
            <option value="Present">Present</option>
            <option value="Late">Late</option>
            <option value="Absent">Absent</option>
            <option value="On Leave">On Leave</option>
            <option value="Not Marked">Not Marked</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* ======================================================== */}
      {/* 4. STUDENT / STAFF TABS & HOLIDAY ALERT                 */}
      {/* ======================================================== */}
      {activeHoliday && (
        <div 
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 mb-3.5 rounded-xl bg-[#08243e] border border-[#0e497d] text-white text-xs shadow-md animate-in fade-in"
          id="holiday-status-message-above-tabs"
        >
          <div className="flex items-center gap-2.5">
            <Info className="w-4.5 h-4.5 text-[#38bdf8] shrink-0" />
            <span className="font-medium text-slate-200">
              today is holiday: {activeHoliday.reason} attendance action is disabled
            </span>
            {activeHoliday.class && activeHoliday.class !== 'All Classes' && (
              <span className="px-2 py-0.5 rounded bg-blue-900/60 text-blue-300 text-[10px] font-bold border border-blue-600/30">
                {activeHoliday.class} {activeHoliday.section !== 'All Sections' ? `• Sec ${activeHoliday.section}` : ''}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => handleRemoveHoliday(activeHoliday.id)}
            className="px-3 py-1.5 rounded-lg bg-[#3a1d24] hover:bg-[#4d242e] border border-[#6b2c3a] text-[#f87171] hover:text-[#fca5a5] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shrink-0 self-start sm:self-auto shadow-sm"
            id="btn-remove-holiday-top"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Remove Holiday</span>
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 mb-4 border-b border-[#1c293d] pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('students')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'students'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
              : 'text-slate-400 hover:text-white hover:bg-[#131c2b]'
          }`}
          id="tab-students-attendance"
        >
          <Users className="w-3.5 h-3.5" />
          <span>Student Attendance</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
            activeTab === 'students' ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-400'
          }`}>
            {students.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('staff')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'staff'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
              : 'text-slate-400 hover:text-white hover:bg-[#131c2b]'
          }`}
          id="tab-staff-attendance"
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>Staff Attendance</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
            activeTab === 'staff' ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-400'
          }`}>
            {staff.length}
          </span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* 5. BULK ACTION BAR                                      */}
      {/* ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-[#121a28] border border-[#1e2a3e] rounded-2xl mb-5">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Mark Holiday Button */}
          <button
            type="button"
            onClick={handleOpenHolidayModal}
            disabled={Boolean(activeHoliday)}
            className={`h-7 px-2.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all box-border ${
              activeHoliday
                ? 'bg-[#151c28] border border-[#1f2838] text-slate-500 cursor-not-allowed opacity-60'
                : 'bg-[#2a1b08] hover:bg-[#38240b] border border-[#854d0e]/60 text-[#fde047] cursor-pointer shadow-sm'
            }`}
            id="btn-mark-holiday"
            title={activeHoliday ? `Holiday already active: ${activeHoliday.reason}` : 'Mark Holiday'}
          >
            <Calendar className={`w-3.5 h-3.5 ${activeHoliday ? 'text-slate-500' : 'text-[#fde047]'}`} />
            <span>Mark Holiday</span>
          </button>

          {/* Mark All Present */}
          <button
            type="button"
            onClick={handleMarkAllPresent}
            disabled={Boolean(activeHoliday) || unmarkedRemainingCount === 0}
            className={`h-7 px-2.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all box-border ${
              activeHoliday
                ? 'bg-slate-800/60 border border-slate-700 text-slate-500 cursor-not-allowed opacity-60'
                : unmarkedRemainingCount === 0
                ? 'bg-emerald-950/40 border border-emerald-800/40 text-emerald-600 cursor-not-allowed'
                : 'bg-[#059669] hover:bg-success text-white cursor-pointer shadow-md shadow-emerald-700/25'
            }`}
            id="btn-mark-all-present"
          >
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Mark All Present {unmarkedRemainingCount > 0 ? unmarkedRemainingCount : ''}</span>
          </button>

          {/* Mark All Absent */}
          <button
            type="button"
            onClick={handleMarkAllAbsent}
            disabled={Boolean(activeHoliday) || unmarkedRemainingCount === 0}
            className={`h-7 px-2.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all box-border ${
              activeHoliday
                ? 'bg-slate-800/60 border border-slate-700 text-slate-500 cursor-not-allowed opacity-60'
                : unmarkedRemainingCount === 0
                ? 'bg-red-950/40 border border-red-800/40 text-red-600 cursor-not-allowed'
                : 'bg-[#dc2626] hover:bg-[#ef4444] text-white cursor-pointer shadow-md shadow-red-700/25'
            }`}
            id="btn-mark-all-absent"
          >
            <X className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Mark All Absent {unmarkedRemainingCount > 0 ? unmarkedRemainingCount : ''}</span>
          </button>
        </div>

        {/* Right side of action bar: status information + Save Button on most right */}
        <div className="flex flex-wrap items-center justify-end gap-3 ml-auto">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>
              {activeHoliday
                ? `Holiday in effect: ${activeHoliday.reason}`
                : `Marks remaining as present/absent for ${shortDateFormatted}`}
            </span>
            {!activeHoliday && manualCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-semibold border border-blue-500/30">
                {manualCount} manual protected
              </span>
            )}
          </div>

          {/* Save Button on most right of Mark Holiday row - always available for both Student and Staff Attendance */}
          <button
            type="button"
            onClick={handleSaveAttendance}
            disabled={Boolean(activeHoliday)}
            className={`h-7 px-3.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all box-border ${
              activeHoliday
                ? 'bg-slate-800/60 border border-slate-700 text-slate-500 cursor-not-allowed opacity-60'
                : unsavedMemberIds.size > 0
                ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-md shadow-blue-600/30 ring-1 ring-blue-400'
                : 'bg-[#1a2942] hover:bg-blue-600 text-blue-200 hover:text-white border border-blue-500/40 cursor-pointer shadow-sm'
            }`}
            id="btn-save-attendance"
            title={activeTab === 'students' ? 'Save student attendance' : 'Save staff attendance'}
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save</span>
            {unsavedMemberIds.size > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-white text-[10px] font-extrabold">
                {unsavedMemberIds.size}
              </span>
            )}
          </button>
        </div>
      </div>

      {localToast && (
        <div className="mb-4 px-4 py-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{localToast}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. ATTENDANCE TABLE (STUDENT OR STAFF)                   */}
      {/* ======================================================== */}
      <div className="bg-surface-13 border border-[#1d293d] rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-edge-8 bg-surface-6 text-slate-400 font-semibold uppercase text-[11px] tracking-wider">
                <th className="py-3.5 px-4 font-bold flex items-center gap-1">
                  <span>{activeTab === 'students' ? 'Student Name' : 'Staff Name'}</span>
                  <span className="text-slate-500">↑</span>
                </th>
                <th className="py-3.5 px-4">
                  {activeTab === 'students' ? 'Family' : 'Department & Contact'}
                </th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Remarks</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#172235]">
              {activeTab === 'students' ? (
                filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 italic">
                      No students match the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((s) => {
                    const record = getMemberRecord(s.id);
                    const draftRecord = getDraftMemberRecord(s.id);
                    const status = record?.status || 'not_marked';
                    const draftStatus = draftRecord?.status || 'not_marked';
                    const isPendingSave = unsavedMemberIds.has(s.id) && draftStatus !== status;
                    const checkIn = record?.checkInTime;
                    const studentHoliday = getHolidayForMember(s, 'student') || activeHoliday;
                    const isRowDisabled = Boolean(studentHoliday);

                    return (
                      <tr 
                        key={s.id} 
                        className={`transition-colors ${isRowDisabled ? 'bg-[#0f1522]/60 hover:bg-[#111927]' : 'hover:bg-surface-25'}`}
                        id={`row-student-${s.id}`}
                      >
                        {/* Name + ID Badge */}
                        <td className="py-3.5 px-4">
                          <div>
                            <button
                              type="button"
                              onClick={() => onSelectStudent && onSelectStudent(s)}
                              className="font-bold text-white text-xs hover:text-blue-400 hover:underline cursor-pointer text-left transition-colors"
                              title="View Student Profile"
                            >
                              {s.name} <span className="text-slate-400 font-normal">({s.id})</span>
                            </button>
                          </div>
                          <div className="mt-1 flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onSelectStudent && onSelectStudent(s)}
                              className="inline-block px-2 py-0.5 rounded-md bg-blue-900/40 text-blue-400 border border-blue-600/30 text-[10px] font-semibold hover:bg-blue-800/60 cursor-pointer transition-colors"
                              title="View Student Profile"
                            >
                              {s.id}
                            </button>
                            {s.class && (
                              <span className="text-[10px] text-slate-400 font-medium">
                                {s.class} {s.section ? `(${s.section})` : ''}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Family / Contact */}
                        <td className="py-3.5 px-4">
                          <div>
                            <button
                              type="button"
                              onClick={() => onSelectFamily && onSelectFamily(s.familyId || '', s.family || '')}
                              className="font-medium text-slate-200 hover:text-blue-400 hover:underline cursor-pointer text-left transition-colors text-xs"
                              title="View Family Information"
                            >
                              {s.family || 'Guardian'}
                            </button>
                          </div>
                          {s.familyId && (
                            <button
                              type="button"
                              onClick={() => onSelectFamily && onSelectFamily(s.familyId || '', s.family || '')}
                              className="text-[11px] text-slate-400 hover:text-blue-400 hover:underline block text-left mt-0.5 cursor-pointer"
                              title="View Family Information"
                            >
                              ID: {s.familyId}
                            </button>
                          )}
                          {s.phone && (
                            <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5 font-mono">
                              <Phone className="w-3 h-3 text-slate-500" />
                              <span>{s.phone}</span>
                            </div>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td className="py-3.5 px-4">
                          {status === 'present' ? (
                            <div className="inline-flex flex-col items-start">
                              <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                                PRESENT
                              </span>
                              {checkIn && (
                                <span className="text-[10px] text-slate-400 mt-0.5 ml-1">
                                  In {checkIn}
                                </span>
                              )}
                            </div>
                          ) : status === 'late' ? (
                            <div className="inline-flex flex-col items-start">
                              <span className="px-2.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/40 text-cyan-400 text-[10px] font-black uppercase tracking-wider">
                                LATE
                              </span>
                              {checkIn && (
                                <span className="text-[10px] text-slate-400 mt-0.5 ml-1">
                                  In {checkIn}
                                </span>
                              )}
                            </div>
                          ) : status === 'absent' ? (
                            <span className="px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/40 text-red-400 text-[10px] font-black uppercase tracking-wider">
                              ABSENT
                            </span>
                          ) : status === 'leave' ? (
                            <span className="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 text-[10px] font-black uppercase tracking-wider">
                              LEAVE
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                              NOT MARKED
                            </span>
                          )}
                          {record?.isManual && (
                            <div className="mt-1">
                              <span className="px-1.5 py-0.2 rounded bg-sky-950/80 text-sky-400 border border-sky-800/60 text-[9px] font-bold tracking-wider">
                                Manual
                              </span>
                            </div>
                          )}
                          {isPendingSave && (
                            <div className="mt-1">
                              <span className="px-1.5 py-0.5 rounded bg-blue-950/90 text-blue-300 border border-blue-500/50 text-[9px] font-bold uppercase tracking-wider">
                                Unsaved: {draftStatus.toUpperCase()}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Remarks */}
                        <td className="py-3.5 px-4 text-slate-400">
                          {record?.remarks || '-'}
                        </td>

                        {/* Actions: 4 Buttons (Present, Late, Absent, Leave) */}
                        <td className="py-3.5 px-4">
                          {isRowDisabled ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <span className="h-7 px-2.5 rounded-lg text-[11px] font-semibold bg-surface-17 text-slate-600 border border-edge-4 cursor-not-allowed flex items-center justify-center box-border">
                                Present
                              </span>
                              <span className="h-7 px-2.5 rounded-lg text-[11px] font-semibold bg-surface-17 text-slate-600 border border-edge-4 cursor-not-allowed flex items-center justify-center box-border">
                                Late
                              </span>
                              <span className="h-7 px-2.5 rounded-lg text-[11px] font-semibold bg-surface-17 text-slate-600 border border-edge-4 cursor-not-allowed flex items-center justify-center box-border">
                                Absent
                              </span>
                              <span className="h-7 px-2.5 rounded-lg text-[11px] font-semibold bg-surface-17 text-slate-600 border border-edge-4 cursor-not-allowed flex items-center justify-center box-border">
                                Leave
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Present */}
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(s, 'student', 'present')}
                                className={`h-7 px-2.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all flex items-center justify-center box-border ${
                                  draftStatus === 'present'
                                    ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400'
                                    : 'bg-surface-38 hover:bg-emerald-950/60 text-slate-300 hover:text-emerald-300 border border-edge-30'
                                }`}
                              >
                                Present
                              </button>

                              {/* Late */}
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(s, 'student', 'late')}
                                className={`h-7 px-2.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all flex items-center justify-center box-border ${
                                  draftStatus === 'late'
                                    ? 'bg-cyan-600 text-white shadow-sm ring-1 ring-cyan-400'
                                    : 'bg-surface-38 hover:bg-cyan-950/60 text-slate-300 hover:text-cyan-300 border border-edge-30'
                                }`}
                              >
                                Late
                              </button>

                              {/* Absent */}
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(s, 'student', 'absent')}
                                className={`h-7 px-2.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all flex items-center justify-center box-border ${
                                  draftStatus === 'absent'
                                    ? 'bg-red-600 text-white shadow-sm ring-1 ring-red-400'
                                    : 'bg-surface-38 hover:bg-red-950/60 text-slate-300 hover:text-red-300 border border-edge-30'
                                }`}
                              >
                                Absent
                              </button>

                              {/* Leave */}
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(s, 'student', 'leave')}
                                className={`h-7 px-2.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all flex items-center justify-center box-border ${
                                  draftStatus === 'leave'
                                    ? 'bg-amber-600 text-white shadow-sm ring-1 ring-amber-400'
                                    : 'bg-surface-38 hover:bg-amber-950/60 text-slate-300 hover:text-amber-300 border border-edge-30'
                                }`}
                              >
                                Leave
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )
              ) : (
                /* STAFF ATTENDANCE ROWS */
                filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 italic">
                      No staff members match the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((st) => {
                    const record = getMemberRecord(st.id);
                    const draftRecord = getDraftMemberRecord(st.id);
                    const status = record?.status || 'not_marked';
                    const draftStatus = draftRecord?.status || 'not_marked';
                    const isPendingSave = unsavedMemberIds.has(st.id) && draftStatus !== status;
                    const checkIn = record?.checkInTime;
                    const staffHoliday = getHolidayForMember(st, 'staff') || activeHoliday;
                    const isStaffRowDisabled = Boolean(staffHoliday);

                    return (
                      <tr 
                        key={st.id} 
                        className={`transition-colors ${isStaffRowDisabled ? 'bg-[#0f1522]/60 hover:bg-[#111927]' : 'hover:bg-surface-25'}`}
                        id={`row-staff-${st.id}`}
                      >
                        {/* Name + ID Badge */}
                        <td className="py-3.5 px-4">
                          <div>
                            <button
                              type="button"
                              onClick={() => onSelectStaff && onSelectStaff(st)}
                              className="font-bold text-white text-xs hover:text-indigo-400 hover:underline cursor-pointer text-left transition-colors"
                              title="View Staff Profile"
                            >
                              {st.name} <span className="text-slate-400 font-normal">({st.id})</span>
                            </button>
                          </div>
                          <div className="mt-1">
                            <button
                              type="button"
                              onClick={() => onSelectStaff && onSelectStaff(st)}
                              className="inline-block px-2 py-0.5 rounded-md bg-purple-900/40 text-purple-400 border border-purple-600/30 text-[10px] font-semibold hover:bg-purple-800/60 cursor-pointer transition-colors"
                              title="View Staff Profile"
                            >
                              {st.id}
                            </button>
                          </div>
                        </td>

                        {/* Department / Role / Phone */}
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-200">
                            {st.department}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {st.role} • {st.category}
                          </div>
                          {st.phone && (
                            <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5 font-mono">
                              <Phone className="w-3 h-3 text-slate-500" />
                              <span>{st.phone}</span>
                            </div>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td className="py-3.5 px-4">
                          {status === 'present' ? (
                            <div className="inline-flex flex-col items-start">
                              <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                                PRESENT
                              </span>
                              {checkIn && (
                                <span className="text-[10px] text-slate-400 mt-0.5 ml-1">
                                  In {checkIn}
                                </span>
                              )}
                            </div>
                          ) : status === 'late' ? (
                            <div className="inline-flex flex-col items-start">
                              <span className="px-2.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/40 text-cyan-400 text-[10px] font-black uppercase tracking-wider">
                                LATE
                              </span>
                              {checkIn && (
                                <span className="text-[10px] text-slate-400 mt-0.5 ml-1">
                                  In {checkIn}
                                </span>
                              )}
                            </div>
                          ) : status === 'absent' ? (
                            <span className="px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/40 text-red-400 text-[10px] font-black uppercase tracking-wider">
                              ABSENT
                            </span>
                          ) : status === 'leave' ? (
                            <span className="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 text-[10px] font-black uppercase tracking-wider">
                              LEAVE
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                              NOT MARKED
                            </span>
                          )}
                          {record?.isManual && (
                            <div className="mt-1">
                              <span className="px-1.5 py-0.2 rounded bg-sky-950/80 text-sky-400 border border-sky-800/60 text-[9px] font-bold tracking-wider">
                                Manual
                              </span>
                            </div>
                          )}
                          {isPendingSave && (
                            <div className="mt-1">
                              <span className="px-1.5 py-0.5 rounded bg-blue-950/90 text-blue-300 border border-blue-500/50 text-[9px] font-bold uppercase tracking-wider">
                                Unsaved: {draftStatus.toUpperCase()}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Remarks */}
                        <td className="py-3.5 px-4 text-slate-400">
                          {record?.remarks || '-'}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4">
                          {isStaffRowDisabled ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <span className="h-7 px-2.5 rounded-lg text-[11px] font-semibold bg-surface-17 text-slate-600 border border-edge-4 cursor-not-allowed flex items-center justify-center box-border">
                                Present
                              </span>
                              <span className="h-7 px-2.5 rounded-lg text-[11px] font-semibold bg-surface-17 text-slate-600 border border-edge-4 cursor-not-allowed flex items-center justify-center box-border">
                                Late
                              </span>
                              <span className="h-7 px-2.5 rounded-lg text-[11px] font-semibold bg-surface-17 text-slate-600 border border-edge-4 cursor-not-allowed flex items-center justify-center box-border">
                                Absent
                              </span>
                              <span className="h-7 px-2.5 rounded-lg text-[11px] font-semibold bg-surface-17 text-slate-600 border border-edge-4 cursor-not-allowed flex items-center justify-center box-border">
                                Leave
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Present */}
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(st, 'staff', 'present')}
                                className={`h-7 px-2.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all flex items-center justify-center box-border ${
                                  draftStatus === 'present'
                                    ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400'
                                    : 'bg-surface-38 hover:bg-emerald-950/60 text-slate-300 hover:text-emerald-300 border border-edge-30'
                                }`}
                              >
                                Present
                              </button>

                              {/* Late */}
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(st, 'staff', 'late')}
                                className={`h-7 px-2.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all flex items-center justify-center box-border ${
                                  draftStatus === 'late'
                                    ? 'bg-cyan-600 text-white shadow-sm ring-1 ring-cyan-400'
                                    : 'bg-surface-38 hover:bg-cyan-950/60 text-slate-300 hover:text-cyan-300 border border-edge-30'
                                }`}
                              >
                                Late
                              </button>

                              {/* Absent */}
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(st, 'staff', 'absent')}
                                className={`h-7 px-2.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all flex items-center justify-center box-border ${
                                  draftStatus === 'absent'
                                    ? 'bg-red-600 text-white shadow-sm ring-1 ring-red-400'
                                    : 'bg-surface-38 hover:bg-red-950/60 text-slate-300 hover:text-red-300 border border-edge-30'
                                }`}
                              >
                                Absent
                              </button>

                              {/* Leave */}
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(st, 'staff', 'leave')}
                                className={`h-7 px-2.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all flex items-center justify-center box-border ${
                                  draftStatus === 'leave'
                                    ? 'bg-amber-600 text-white shadow-sm ring-1 ring-amber-400'
                                    : 'bg-surface-38 hover:bg-amber-950/60 text-slate-300 hover:text-amber-300 border border-edge-30'
                                }`}
                              >
                                Leave
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer Save Bar for Student & Staff Attendance */}
        {((activeTab === 'students' && filteredStudents.length > 0) ||
          (activeTab === 'staff' && filteredStaff.length > 0)) && (
          <div className="px-4 py-3 border-t border-edge-8 bg-surface-6 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-400">
              {unsavedMemberIds.size > 0 ? (
                <span className="text-blue-400 font-semibold">
                  {unsavedMemberIds.size} unsaved {activeTab === 'students' ? 'student' : 'staff'} attendance update{unsavedMemberIds.size === 1 ? '' : 's'} staged for {shortDateFormatted}
                </span>
              ) : (
                <span>
                  All {activeTab === 'students' ? 'student' : 'staff'} attendance records for {shortDateFormatted} are up to date
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleSaveAttendance}
              disabled={Boolean(activeHoliday)}
              className={`h-8 px-4 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all box-border ${
                activeHoliday
                  ? 'bg-slate-800/60 border border-slate-700 text-slate-500 cursor-not-allowed opacity-60'
                  : unsavedMemberIds.size > 0
                  ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-md shadow-blue-600/30 ring-1 ring-blue-400'
                  : 'bg-[#1a2942] hover:bg-blue-600 text-blue-200 hover:text-white border border-blue-500/40 cursor-pointer'
              }`}
              id="btn-save-attendance-footer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save {activeTab === 'students' ? 'Student' : 'Staff'} Attendance</span>
              {unsavedMemberIds.size > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-white text-[10px] font-extrabold">
                  {unsavedMemberIds.size}
                </span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 7. MARK HOLIDAY POPUP MODAL                             */}
      {/* ======================================================== */}
      {isHolidayModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-15 border border-edge-13 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 text-white">
            {/* Modal Header */}
            <div className="px-6 py-4.5 border-b border-edge-13 flex items-center justify-between bg-[#0b1120]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-bold">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Mark Holiday</h3>
                  <p className="text-[11px] text-slate-400">Date: {selectedDate}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsHolidayModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs">
              {/* Reason */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">
                  Holiday Reason / Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={holidayReason}
                  onChange={(e) => setHolidayReason(e.target.value)}
                  placeholder="e.g. Independence Day, Eid Holiday, Weather Alert"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-25 border border-edge-30 text-white focus:outline-none focus:border-blue-500 text-xs"
                  id="input-holiday-reason"
                  autoFocus
                />
                {/* Quick suggestions */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {['National Holiday', 'Eid Holiday', 'Winter Break', 'Sports Day', 'Weather Emergency'].map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => setHolidayReason(sug)}
                      className="px-2 py-0.5 rounded-md bg-[#162235] hover:bg-blue-950 text-slate-400 hover:text-blue-300 border border-edge-30 text-[10px] cursor-pointer transition-colors"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>

              {/* Apply To */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">
                  Apply To
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setHolidayApplyTo('both')}
                    className={`py-2 px-3 rounded-xl border text-center font-bold text-xs cursor-pointer transition-all ${
                      holidayApplyTo === 'both'
                        ? 'bg-blue-600/30 border-blue-500 text-white shadow-sm'
                        : 'bg-surface-25 border-edge-30 text-slate-400 hover:text-white'
                    }`}
                  >
                    Both (Default)
                  </button>
                  <button
                    type="button"
                    onClick={() => setHolidayApplyTo('student')}
                    className={`py-2 px-3 rounded-xl border text-center font-bold text-xs cursor-pointer transition-all ${
                      holidayApplyTo === 'student'
                        ? 'bg-blue-600/30 border-blue-500 text-white shadow-sm'
                        : 'bg-surface-25 border-edge-30 text-slate-400 hover:text-white'
                    }`}
                  >
                    Students
                  </button>
                  <button
                    type="button"
                    onClick={() => setHolidayApplyTo('staff')}
                    className={`py-2 px-3 rounded-xl border text-center font-bold text-xs cursor-pointer transition-all ${
                      holidayApplyTo === 'staff'
                        ? 'bg-blue-600/30 border-blue-500 text-white shadow-sm'
                        : 'bg-surface-25 border-edge-30 text-slate-400 hover:text-white'
                    }`}
                  >
                    Staff
                  </button>
                </div>
              </div>

              {/* Class & Section (Disabled if staff only) */}
              {holidayApplyTo !== 'staff' && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1.5">
                      Class
                    </label>
                    <select
                      value={holidayClass}
                      onChange={(e) => {
                        setHolidayClass(e.target.value);
                        setHolidaySection('All Sections');
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-surface-25 border border-edge-30 text-white focus:outline-none focus:border-blue-500 appearance-none cursor-pointer"
                      id="select-holiday-class"
                    >
                      <option value="All Classes">All Classes</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1.5">
                      Section
                    </label>
                    <select
                      value={holidaySection}
                      onChange={(e) => setHolidaySection(e.target.value)}
                      disabled={holidayClass === 'All Classes'}
                      className={`w-full px-3 py-2 rounded-xl border appearance-none ${
                        holidayClass === 'All Classes'
                          ? 'bg-[#0f1724] border-edge-4 text-slate-600 cursor-not-allowed'
                          : 'bg-surface-25 border-edge-30 text-white focus:outline-none focus:border-blue-500 cursor-pointer'
                      }`}
                      id="select-holiday-section"
                    >
                      {availableSectionsForHoliday.map(sec => (
                        <option key={sec} value={sec}>{sec}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="p-3 rounded-xl bg-[#0a1626] border border-[#132f4c] text-slate-300 text-[11px] leading-relaxed">
                ℹ Marking a holiday will disable attendance edits for this date, automatically designate affected members as on leave with holiday remarks, and show a holiday notification banner.
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-edge-13 flex items-center justify-end gap-2.5 bg-[#0b1120]">
              <button
                type="button"
                onClick={() => setIsHolidayModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 font-bold cursor-pointer transition-colors text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmMarkHoliday}
                disabled={!holidayReason.trim()}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                  !holidayReason.trim()
                    ? 'bg-amber-950/40 text-amber-600 border border-amber-800/30 cursor-not-allowed'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer shadow-md shadow-amber-500/25 font-black'
                }`}
                id="btn-confirm-holiday"
              >
                OK / Mark Holiday
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 8. GENERATE ATTENDANCE SHEET MODAL                      */}
      {/* ======================================================== */}
      <AttendanceSheetModal
        isOpen={isSheetModalOpen}
        onClose={() => setIsSheetModalOpen(false)}
        classes={classes}
        allStudents={students}
        allStaff={staff}
        currentFilteredStudents={filteredStudents}
        currentFilteredStaff={filteredStaff}
        initialEntityType={activeTab === 'students' ? 'student' : 'staff'}
        filterDescription={filterSummary}
        initialDate={selectedDate}
        allAttendance={allAttendance}
      />
    </div>
  );
};
