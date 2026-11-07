import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Users, 
  IdCard, 
  Download, 
  UploadCloud, 
  Plus, 
  CheckCircle2,
  GraduationCap,
  Briefcase,
  DollarSign,
  Video,
  FileText,
  FileSpreadsheet,
  ChevronDown
} from 'lucide-react';
import { 
  Student, 
  FilterState, 
  ActiveTab, 
  StaffMember, 
  StaffFilterState, 
  SalaryBreakdown,
  ClassInfo,
  AttendanceRecord,
  AttendanceStatus,
  HolidayRecord
} from './types';
import { INITIAL_STUDENTS } from './data/initialStudents';
import { INITIAL_STAFF } from './data/initialStaff';
import { INITIAL_CLASSES } from './data/initialClasses';
import { StatCards } from './components/StatCards';
import { FilterBar } from './components/FilterBar';
import { StudentTable } from './components/StudentTable';
import { FamilyView } from './components/FamilyView';
import { IdCardModal } from './components/IdCardModal';
import { BackupModal } from './components/BackupModal';
import { BulkUploadModal } from './components/BulkUploadModal';
import { AddStudentPage } from './components/AddStudentPage';
import { StudentDetailsView } from './components/StudentDetailsView';
import { FamilyDetailsView, FamilyData } from './components/FamilyDetailsView';
import { PdfPreviewModal } from './components/PdfPreviewModal';
import { exportStudentsToCSV, exportFamiliesToCSV } from './utils/csvHelper';
import { groupStudentsIntoFamilies } from './utils/familyHelper';
import { jsPDF } from 'jspdf';

// Classes Component
import { ClassesModule } from './components/ClassesModule';

// Navigation Component
import { VerticalNavBar, AppModule } from './components/VerticalNavBar';

// Staff Components
import { StaffStatCards } from './components/StaffStatCards';
import { StaffFilterBar } from './components/StaffFilterBar';
import { StaffTable } from './components/StaffTable';
import { AddStaffPage } from './components/AddStaffPage';
import { StaffIdCardModal } from './components/StaffIdCardModal';
import { PayStaffModal } from './components/PayStaffModal';
import { StaffBulkUploadModal } from './components/StaffBulkUploadModal';
import { StaffBackupModal } from './components/StaffBackupModal';
import { StaffDetailsView } from './components/StaffDetailsView';
import { StaffSalarySlipsModal, SalarySlipModalViewMode } from './components/StaffSalarySlipsModal';
import { PayStaffPage } from './components/PayStaffPage';
import { PaymentSummaryPage, PaymentSummaryData } from './components/PaymentSummaryPage';
import { AttendanceModule, HOLIDAYS_STORAGE_KEY } from './components/AttendanceModule';
import { FeesModule } from './components/FeesModule';
import { LedgerModule } from './components/LedgerModule';
import { ExamModule } from './components/ExamModule';
import { SettingsModule } from './components/SettingsModule';
import { OverviewModule } from './components/OverviewModule';
import { BreadcrumbTrail } from './components/BreadcrumbTrail';
import { SecurityDeleteModal } from './components/SecurityDeleteModal';
import { SchoolSettings, getSchoolSettings } from './utils/settingsHelper';

import { generateAllIdCards, DEFAULT_SCHOOL, createStudentRegistryPdfDoc, createFamilyRegistryPdfDoc } from './utils/pdfGenerator';
import { generateAllStaffIdCards } from './utils/staffPdfGenerator';
import { exportStaffToCSV } from './utils/staffCsvHelper';
import { ensureUniqueStudentIds } from './utils/studentSanitizer';
import { backfillStudentClassIds, withClassIdFromName } from './utils/classExportHelper';
import { ATTENDANCE_STORAGE_KEY, loadAttendance } from './utils/attendanceHelper';
import { ensureAllLedgers } from './utils/studentFeeLedgerHelper';
import { migrateFeesV2 } from './utils/migrations/migrateFeesV2';
import { disburseSalary, owedMonthsOf, migrateStaffPayStatusV1 } from './utils/payrollService';
import { DEMO, loadJSON, saveJSON, hydrationPromise, isHydrated } from './utils/storage';
import { StorageFaultScreen } from './components/StorageFaultScreen';
import { downloadBackup } from './utils/backup';
import { shrinkDataURL } from './utils/image';
import { putFile, dataURLToBlob } from './utils/blobStore';
import { nextSequential } from './utils/ids';
import { getLedgerTransactions, saveLedgerTransactions } from './utils/ledgerStore';

const STUDENT_STORAGE_KEY = 'schoollee_offline_students_clean_v1';
const STUDENT_LEGACY_KEY = 'schoollee_offline_students_clean_legacy_v1';
const STAFF_STORAGE_KEY = 'schoollee_offline_staff_clean_v1';
const CLASSES_STORAGE_KEY = 'schoollee_classes_clean_v1';

const SEED_DATES = ['2026-09-07','2026-09-08','2026-09-09','2026-09-10','2026-09-11','2026-09-12','2026-09-13'];
export function purgeSeedAttendance() {
  if (localStorage.getItem('schoollee_att_seed_purged_v1')) return;
  const raw = localStorage.getItem(ATTENDANCE_STORAGE_KEY);
  if (raw) {
    try {
      localStorage.setItem(`${ATTENDANCE_STORAGE_KEY}__pre_purge`, raw);      // safety copy
      const all = JSON.parse(raw);
      for (const d of SEED_DATES) {
        if (!all[d]) continue;
        all[d] = all[d].filter((r: any) => r.isManual !== undefined);          // drop seeded rows only
        if (all[d].length === 0) delete all[d];
      }
      localStorage.setItem(ATTENDANCE_STORAGE_KEY, JSON.stringify(all));
    } catch { /* §4 recovery handles corrupt JSON */ }
  }
  localStorage.setItem('schoollee_att_seed_purged_v1', '1');
}

try {
  purgeSeedAttendance();
} catch {
  // ignore storage errors
}

export default function App() {
  // Navigation: Overview vs Classes vs Student vs Fees vs Staff vs Attendance
  const [currentModule, setCurrentModule] = useState<AppModule>('overview');
  const [previousModuleForStudentDetails, setPreviousModuleForStudentDetails] = useState<AppModule | null>(null);
  const [targetFeeStudentId, setTargetFeeStudentId] = useState<string | null>(null);

  // ==========================================
  // CLASSES MODULE STATE & PERSISTENCE
  // ==========================================
  const [classes, setClasses] = useState<ClassInfo[]>(() =>
    loadJSON<ClassInfo[]>(CLASSES_STORAGE_KEY, DEMO ? INITIAL_CLASSES : [], Array.isArray as (v: unknown) => v is ClassInfo[])
  );

  // Global Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Non-dismissing red bar when localStorage quota is hit (§5)
  const [storageErr, setStorageErr] = useState<string | null>(null);
  useEffect(() => {
    const h = (e: any) => setStorageErr(e.detail?.key ?? 'unknown');
    window.addEventListener('storageError', h);
    return () => window.removeEventListener('storageError', h);
  }, []);

  // Fix P1-1: save/persist effects stay disarmed until backend hydration
  // has been applied to localStorage. main.tsx already gates the first
  // render on hydration, so normally this is true from the first paint;
  // in the timeout path (backend slower than 3s) the app opened on the
  // local fallback, and the reload effect further down swaps state to the
  // hydrated copy when hydration lands — until then nothing may persist,
  // so stale state can never overwrite the server's fuller copy.
  const [hydrated, setHydrated] = useState<boolean>(() => isHydrated());
  const openedBeforeHydration = useRef(!isHydrated());

  // ==========================================
  // STUDENT MODULE STATE & PERSISTENCE
  // ==========================================
  const [students, setStudents] = useState<Student[]>(() =>
    // Fix P0-3: backfill stable classIds onto legacy name-only student
    // records at load, matched against the classes loaded just above.
    backfillStudentClassIds(
      ensureUniqueStudentIds(loadJSON<Student[]>(STUDENT_STORAGE_KEY, DEMO ? INITIAL_STUDENTS : [], Array.isArray as (v: unknown) => v is Student[])),
      classes
    )
  );

  const [studentFilters, setStudentFilters] = useState<FilterState>({
    class: '',
    search: '',
    status: 'All'
  });

  // Institutional School Profile & Branding Settings
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings>(() => getSchoolSettings());

  useEffect(() => {
    const handleSettingsUpdate = (e: any) => {
      if (e.detail) {
        setSchoolSettings(e.detail);
      } else {
        setSchoolSettings(getSchoolSettings());
      }
    };
    window.addEventListener('schoolSettingsUpdated', handleSettingsUpdate);
    window.addEventListener('storage', handleSettingsUpdate);
    return () => {
      window.removeEventListener('schoolSettingsUpdated', handleSettingsUpdate);
      window.removeEventListener('storage', handleSettingsUpdate);
    };
  }, []);

  const [studentActiveTab, setStudentActiveTab] = useState<ActiveTab>('students');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [activeStudentView, setActiveStudentView] = useState<'directory' | 'add-student' | 'student-details' | 'family-details'>('directory');
  const [selectedStudentForDetails, setSelectedStudentForDetails] = useState<Student | null>(null);
  const [selectedFamilyForDetails, setSelectedFamilyForDetails] = useState<FamilyData | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // Student Modals
  const [isStudentIdCardModalOpen, setIsStudentIdCardModalOpen] = useState(false);
  const [selectedStudentForCard, setSelectedStudentForCard] = useState<Student | null>(null);
  const [isStudentBackupModalOpen, setIsStudentBackupModalOpen] = useState(false);
  const [isStudentBulkUploadModalOpen, setIsStudentBulkUploadModalOpen] = useState(false);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const [pdfPreviewState, setPdfPreviewState] = useState<{
    isOpen: boolean;
    doc: jsPDF | null;
    title: string;
    subtitle?: string;
    fileName: string;
    recordCount: number;
    sectionName: string;
  }>({
    isOpen: false,
    doc: null,
    title: '',
    fileName: '',
    recordCount: 0,
    sectionName: 'Students'
  });

  // Sync Students to localStorage (disarmed until hydrated — Fix P1-1)
  useEffect(() => {
    if (!hydrated) return;
    saveJSON(STUDENT_STORAGE_KEY, students);
  }, [students, hydrated]);

  // Fix P0-3: whenever the classes list changes (class created, imported
  // data replaced, ...), backfill classIds onto any student still carrying
  // only a class NAME that now matches a class. Students whose name matches
  // no class keep classId unset. backfillStudentClassIds returns the same
  // array reference when nothing changes, so this cannot loop.
  useEffect(() => {
    setStudents(prev => backfillStudentClassIds(prev, classes));
  }, [classes]);

  // Sync Classes to localStorage (disarmed until hydrated — Fix P1-1)
  useEffect(() => {
    if (!hydrated) return;
    saveJSON(CLASSES_STORAGE_KEY, classes);
  }, [classes, hydrated]);

  useEffect(() => {
    if (!hydrated) return;   // derives + persists ledger data: wait for hydrated state (Fix P1-1)
    ensureAllLedgers(students, classes);
    migrateFeesV2(students);
  }, [students, classes, hydrated]);
  useEffect(() => {   // month rollover while the tab stays open
    const onVisible = () => document.visibilityState === 'visible' && ensureAllLedgers(students, classes);
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [students, classes]);

  // Unique sorted classes across classes module and students
  const existingClasses = useMemo(() => {
    const set = new Set<string>();
    classes.forEach(c => {
      if (c.name && c.name.trim()) set.add(c.name.trim());
    });
    students.forEach(s => {
      if (s.class && s.class.trim()) set.add(s.class.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [classes, students]);

  const familiesCount = useMemo(() => {
    return new Set(students.map(s => s.familyId || s.family)).size;
  }, [students]);

  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      if (studentFilters.class && student.class.toLowerCase() !== studentFilters.class.toLowerCase()) {
        return false;
      }
      if (studentFilters.status !== 'All' && student.status !== studentFilters.status) {
        return false;
      }
      if (studentFilters.search.trim()) {
        const term = studentFilters.search.toLowerCase().trim();
        const matchesName = student.name.toLowerCase().includes(term);
        const matchesId = student.id.toLowerCase().includes(term);
        const matchesFamily = student.family.toLowerCase().includes(term);
        const matchesFamilyId = student.familyId.toLowerCase().includes(term);
        const matchesClass = student.class.toLowerCase().includes(term);
        if (!matchesName && !matchesId && !matchesFamily && !matchesFamilyId && !matchesClass) {
          return false;
        }
      }
      return true;
    });
  }, [students, studentFilters]);

  // Student Handlers
  const handleStudentFilterChange = (newFilters: Partial<FilterState>) => {
    setStudentFilters(prev => ({ ...prev, ...newFilters }));
  };

  const handleSaveStudent = (studentData: Student) => {
    // Fix P0-3: stamp the stable classId for the class NAME the form
    // submitted, so the record is attached by id from the moment it is saved
    // (this is the single save path for both AddStudentPage and the modal).
    const stamped = withClassIdFromName(studentData, classes);
    if (editingStudent) {
      setStudents(prev => prev.map(s => s.id === editingStudent.id ? stamped : s));
      showToast(`Updated student ${stamped.name}`);
    } else {
      setStudents(prev => ensureUniqueStudentIds([stamped, ...prev]));
      showToast(`Added ${stamped.name} (${stamped.id})`);
    }
    setEditingStudent(null);
    setActiveStudentView('directory');
  };

  const handleEditStudent = (student: Student) => {
    setEditingStudent(student);
    setActiveStudentView('add-student');
  };

  // High-Security Deletion state for critical data entities
  const [securityDeleteTarget, setSecurityDeleteTarget] = useState<{
    type: string;
    name: string;
    details?: string;
    warningNote?: string;
    onExecute: () => void;
  } | null>(null);

  const handleDeleteStudent = (id: string) => {
    const student = students.find(s => s.id === id);
    if (!student) return;
    setSecurityDeleteTarget({
      type: 'Student Record',
      name: `${student.name} (${student.id})`,
      details: `Roll #${student.rollNumber || 'N/A'} • Class ${student.class} - Section ${student.section}`,
      onExecute: () => {
        setStudents(prev => prev.filter(s => s.id !== id));
        setSelectedStudentIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        showToast(`Permanently deleted student record for ${student.name}`);
      }
    });
  };

  const handleBulkDeleteStudents = (studentIds: string[]) => {
    if (studentIds.length === 0) return;
    if (studentIds.length === 1) {
      handleDeleteStudent(studentIds[0]);
      return;
    }
    const idSet = new Set(studentIds);
    const targetStudents = students.filter(s => idSet.has(s.id));
    if (targetStudents.length === 0) return;

    const previewNames = targetStudents
      .slice(0, 3)
      .map(s => `${s.name} (${s.id})`)
      .join(', ');
    const moreCount = targetStudents.length - 3;

    setSecurityDeleteTarget({
      type: `${targetStudents.length} Student Records`,
      name: `${targetStudents.length} Selected Students`,
      details: `${previewNames}${moreCount > 0 ? ` and ${moreCount} more` : ''}`,
      warningNote: `All ${targetStudents.length} selected student records will be permanently removed from the registry.`,
      onExecute: () => {
        setStudents(prev => prev.filter(s => !idSet.has(s.id)));
        setSelectedStudentIds(new Set());
        showToast(`Permanently removed ${targetStudents.length} selected students`);
      }
    });
  };

  const handleUpgradeStudentsClass = (
    studentIds: string[],
    targetClass: string,
    targetSection: string
  ) => {
    if (studentIds.length === 0 || !targetClass) return;
    const idSet = new Set(studentIds);
    // Fix P0-3: moving a student to another class moves their classId too.
    const targetClassId = classes.find(
      c => c.name.toLowerCase().trim() === targetClass.toLowerCase().trim()
    )?.id;
    setStudents(prev =>
      prev.map(s => {
        if (!idSet.has(s.id)) return s;
        const moved: Student = {
          ...s,
          class: targetClass,
          section: targetSection || s.section
        };
        if (targetClassId) moved.classId = targetClassId;
        else delete moved.classId;
        return moved;
      })
    );
    setSelectedStudentIds(new Set());
    showToast(
      `Upgraded ${studentIds.length} ${studentIds.length === 1 ? 'student' : 'students'} to ${targetClass}${
        targetSection ? ` (Section ${targetSection})` : ''
      }`
    );
  };

  const handleToggleStudentStatus = (id: string) => {
    setStudents(prev => prev.map(s => {
      if (s.id === id) {
        const nextStatus = s.status === 'Active' ? 'Inactive' : 'Active';
        showToast(`${s.name} marked as ${nextStatus}`);
        return { ...s, status: nextStatus };
      }
      return s;
    }));
  };

  const handleImportStudents = (newStudents: Student[], mode: 'append' | 'replace') => {
    // Fix P0-3: imported rows reference classes by NAME (CSV) — backfill
    // their stable classIds against the current classes list at save time.
    if (mode === 'replace') {
      const sanitized = backfillStudentClassIds(ensureUniqueStudentIds(newStudents), classes);
      setStudents(sanitized);
      showToast(`Replaced registry with ${sanitized.length} students from CSV`);
    } else {
      setStudents(prev => ensureUniqueStudentIds(backfillStudentClassIds([...newStudents, ...prev], classes)));
      showToast(`Successfully appended ${newStudents.length} students from CSV`);
    }
    setSelectedStudentIds(new Set());
  };

  const handleOpenStudentIdCardModal = (student?: Student) => {
    setSelectedStudentForCard(student || filteredStudents[0] || students[0] || null);
    setIsStudentIdCardModalOpen(true);
  };

  const handleToggleStudentSelect = (id: string) => {
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllStudents = (allIds: string[]) => {
    setSelectedStudentIds(new Set(allIds));
  };

  const handleClearStudentSelection = () => {
    setSelectedStudentIds(new Set());
  };

  const handleBulkDownloadStudentCards = (selected: Student[]) => {
    generateAllIdCards(selected, 'modern-tech', DEFAULT_SCHOOL);
    showToast(`Generating ID Cards for ${selected.length} students...`);
  };

  // Export handlers for current section (students or families)
  const handleExportCurrentSectionCSV = () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    if (studentActiveTab === 'students') {
      const studentsToExport = filteredStudents.length > 0 ? filteredStudents : students;
      exportStudentsToCSV(studentsToExport, `students_backup_${todayStr}.csv`);
      showToast(`Downloaded CSV for ${studentsToExport.length} students`);
    } else {
      const allFamilies = groupStudentsIntoFamilies(students);
      exportFamiliesToCSV(allFamilies, `families_backup_${todayStr}.csv`);
      showToast(`Downloaded CSV for ${allFamilies.length} family accounts`);
    }
  };

  const handleOpenCurrentSectionPdfPreview = () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    if (studentActiveTab === 'students') {
      const studentsToExport = filteredStudents.length > 0 ? filteredStudents : students;
      const doc = createStudentRegistryPdfDoc(studentsToExport, DEFAULT_SCHOOL);
      setPdfPreviewState({
        isOpen: true,
        doc,
        title: 'Student Registry Report',
        subtitle: 'Official printable records registry • Demo School Schoollee Pakistan',
        fileName: `Student_Registry_${todayStr}.pdf`,
        recordCount: studentsToExport.length,
        sectionName: 'Students'
      });
    } else {
      const allFamilies = groupStudentsIntoFamilies(students);
      const doc = createFamilyRegistryPdfDoc(allFamilies, DEFAULT_SCHOOL);
      setPdfPreviewState({
        isOpen: true,
        doc,
        title: 'Family Accounts Directory Report',
        subtitle: 'Official printable accounts directory • Demo School Schoollee Pakistan',
        fileName: `Family_Directory_${todayStr}.pdf`,
        recordCount: allFamilies.length,
        sectionName: 'Families'
      });
    }
  };

  // ==========================================
  // STAFF MODULE STATE & PERSISTENCE
  // ==========================================
  const [staff, setStaff] = useState<StaffMember[]>(() => {
    const loaded = loadJSON<StaffMember[]>(STAFF_STORAGE_KEY, DEMO ? INITIAL_STAFF : [], Array.isArray as (v: unknown) => v is StaffMember[]);
    return migrateStaffPayStatusV1(loaded).staff;
  });

  const [staffFilters, setStaffFilters] = useState<StaffFilterState>({
    category: 'All',
    department: 'All',
    search: '',
    status: 'All',
    payStatus: 'All'
  });

  const [staffActiveTab, setStaffActiveTab] = useState<'all' | 'teachers' | 'support'>('all');
  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<string>>(new Set());
  const [activeStaffView, setActiveStaffView] = useState<'directory' | 'add-staff' | 'staff-details' | 'pay-staff' | 'payment-summary'>('directory');
  const [selectedStaffForDetails, setSelectedStaffForDetails] = useState<StaffMember | null>(null);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [paymentSummaryData, setPaymentSummaryData] = useState<PaymentSummaryData | null>(null);

  // Staff Modals
  const [isStaffIdCardModalOpen, setIsStaffIdCardModalOpen] = useState(false);
  const [selectedStaffForCard, setSelectedStaffForCard] = useState<StaffMember | null>(null);
  const [isPayStaffModalOpen, setIsPayStaffModalOpen] = useState(false);
  const [selectedStaffForPay, setSelectedStaffForPay] = useState<StaffMember | null>(null);
  const [isStaffBulkUploadModalOpen, setIsStaffBulkUploadModalOpen] = useState(false);
  const [isStaffBackupModalOpen, setIsStaffBackupModalOpen] = useState(false);

  // Payroll Month State
  const [payrollMonth, setPayrollMonth] = useState<{ month: string; year: string; monthNumber: string }>({
    month: 'September',
    year: '2026',
    monthNumber: '09'
  });

  // Salary Slips Modal & Options Menu
  const [isSalarySlipModalOpen, setIsSalarySlipModalOpen] = useState(false);
  const [salarySlipModalMode, setSalarySlipModalMode] = useState<SalarySlipModalViewMode>('overall');
  const [selectedStaffForSalarySlip, setSelectedStaffForSalarySlip] = useState<StaffMember | null>(null);
  const [isSalarySlipMenuOpen, setIsSalarySlipMenuOpen] = useState(false);

  const handleOpenSalarySlipModal = (mode: SalarySlipModalViewMode, staffMember?: StaffMember | null) => {
    setSalarySlipModalMode(mode);
    setSelectedStaffForSalarySlip(staffMember || null);
    setIsSalarySlipModalOpen(true);
    setIsSalarySlipMenuOpen(false);
  };

  // ==========================================
  // SHARED ATTENDANCE & HOLIDAY STATE (LIFTED)
  // Ensures Attendance Module, Student Profile, and Staff Profile
  // share the exact same synced data.
  // ==========================================
  const [allAttendance, setAllAttendance] = useState<Record<string, AttendanceRecord[]>>(() => loadAttendance());

  const [holidays, setHolidays] = useState<HolidayRecord[]>(() =>
    loadJSON<HolidayRecord[]>(HOLIDAYS_STORAGE_KEY, [], Array.isArray as (v: unknown) => v is HolidayRecord[])
  );

  // Sync attendance to localStorage (disarmed until hydrated — Fix P1-1)
  useEffect(() => {
    if (!hydrated) return;
    saveJSON(ATTENDANCE_STORAGE_KEY, allAttendance);
  }, [allAttendance, hydrated]);

  // Sync holidays to localStorage (disarmed until hydrated — Fix P1-1)
  useEffect(() => {
    if (!hydrated) return;
    saveJSON(HOLIDAYS_STORAGE_KEY, holidays);
  }, [holidays, hydrated]);

  // Handler for student attendance updates from MemberAttendanceSection
  const handleUpdateStudentAttendance = (
    date: string,
    status: AttendanceStatus,
    checkInTime?: string,
    remarks?: string
  ) => {
    if (!selectedStudentForDetails) return;
    const student = selectedStudentForDetails;
    setAllAttendance(prev => {
      const currentList = prev[date] ? [...prev[date]] : [];
      const existingIdx = currentList.findIndex(r => r.id === student.id);
      const updatedRecord: AttendanceRecord = {
        id: student.id,
        name: student.name,
        type: 'student',
        date,
        status,
        checkInTime,
        remarks: remarks || (status === 'leave' ? 'Approved Leave' : status === 'absent' ? 'Unexcused' : '-'),
        class: student.class,
        section: student.section,
        isManual: true
      };
      if (existingIdx >= 0) {
        currentList[existingIdx] = updatedRecord;
      } else {
        currentList.push(updatedRecord);
      }
      return { ...prev, [date]: currentList };
    });
  };

  // Handler for staff attendance updates from MemberAttendanceSection
  const handleUpdateStaffAttendance = (
    date: string,
    status: AttendanceStatus,
    checkInTime?: string,
    remarks?: string
  ) => {
    if (!selectedStaffForDetails) return;
    const member = selectedStaffForDetails;
    setAllAttendance(prev => {
      const currentList = prev[date] ? [...prev[date]] : [];
      const existingIdx = currentList.findIndex(r => r.id === member.id);
      const updatedRecord: AttendanceRecord = {
        id: member.id,
        name: member.name,
        type: 'staff',
        date,
        status,
        checkInTime,
        remarks: remarks || (status === 'leave' ? 'Approved Leave' : status === 'absent' ? 'Unexcused' : '-'),
        department: member.department,
        role: member.role,
        isManual: true
      };
      if (existingIdx >= 0) {
        currentList[existingIdx] = updatedRecord;
      } else {
        currentList.push(updatedRecord);
      }
      return { ...prev, [date]: currentList };
    });
  };

  // Sync Staff to localStorage (disarmed until hydrated — Fix P1-1)
  useEffect(() => {
    if (!hydrated) return;
    saveJSON(STAFF_STORAGE_KEY, staff);
  }, [staff, hydrated]);

  // Fix P1-1 (timeout path): if this App mounted before hydration landed
  // (main.tsx's 3s fallback let it open on the local cache), reload the
  // main data path from the now-hydrated localStorage so the screen
  // converges on the server's copy instead of keeping the stale one.
  // In the normal path hydration finished before first render, the
  // initializers already read hydrated data, and this only flips the flag.
  useEffect(() => {
    let cancelled = false;
    hydrationPromise.then(() => {
      if (cancelled) return;
      if (openedBeforeHydration.current) {
        openedBeforeHydration.current = false;
        const freshClasses = loadJSON<ClassInfo[]>(CLASSES_STORAGE_KEY, DEMO ? INITIAL_CLASSES : [], Array.isArray as (v: unknown) => v is ClassInfo[]);
        setClasses(freshClasses);
        setStudents(backfillStudentClassIds(
          ensureUniqueStudentIds(loadJSON<Student[]>(STUDENT_STORAGE_KEY, DEMO ? INITIAL_STUDENTS : [], Array.isArray as (v: unknown) => v is Student[])),
          freshClasses
        ));
        setStaff(migrateStaffPayStatusV1(
          loadJSON<StaffMember[]>(STAFF_STORAGE_KEY, DEMO ? INITIAL_STAFF : [], Array.isArray as (v: unknown) => v is StaffMember[])
        ).staff);
        setAllAttendance(loadAttendance());
        setHolidays(loadJSON<HolidayRecord[]>(HOLIDAYS_STORAGE_KEY, [], Array.isArray as (v: unknown) => v is HolidayRecord[]));
      }
      setHydrated(true);
    });
    return () => { cancelled = true; };
  }, []);

  // §5 One-time startup migrations:
  // 1) Shrink existing student/staff photos > 60,000 chars to 256px JPEG
  // 2) Move existing StaffDocument.fileData & LedgerDocument.fileData to IndexedDB
  // Waits for hydration (Fix P1-1): migrating pre-hydration state and then
  // stamping the done-flags would leave the hydrated copy unmigrated.
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    (async () => {
      try {
        if (!localStorage.getItem('schoollee_photos_shrunk_v1')) {
          let studentsChanged = false;
          const nextStudents = await Promise.all(
            students.map(async s => {
              if (s.photo && s.photo.length > 60000) {
                try {
                  const shrunk = await shrinkDataURL(s.photo, 256, 0.7, 'image/jpeg');
                  studentsChanged = true;
                  return { ...s, photo: shrunk };
                } catch {
                  return s;
                }
              }
              return s;
            })
          );
          if (!cancelled && studentsChanged) {
            setStudents(nextStudents);
          }

          let staffChanged = false;
          const nextStaff = await Promise.all(
            staff.map(async m => {
              if (m.photo && m.photo.length > 60000) {
                try {
                  const shrunk = await shrinkDataURL(m.photo, 256, 0.7, 'image/jpeg');
                  staffChanged = true;
                  return { ...m, photo: shrunk };
                } catch {
                  return m;
                }
              }
              return m;
            })
          );
          if (!cancelled && staffChanged) {
            setStaff(nextStaff);
          }
          localStorage.setItem('schoollee_photos_shrunk_v1', '1');
        }

        if (!localStorage.getItem('schoollee_docs_migrated_idb_v1')) {
          let staffDocsMigrated = false;
          const migratedStaff = await Promise.all(
            staff.map(async m => {
              if (!m.documents || m.documents.length === 0) return m;
              let memberChanged = false;
              const docs = await Promise.all(
                m.documents.map(async d => {
                  if (d.fileData) {
                    try {
                      const fileId = d.fileId || nextSequential('FILE');
                      await putFile(fileId, dataURLToBlob(d.fileData));
                      memberChanged = true;
                      staffDocsMigrated = true;
                      const { fileData: _removed, ...rest } = d;
                      return { ...rest, fileId };
                    } catch {
                      return d;
                    }
                  }
                  return d;
                })
              );
              return memberChanged ? { ...m, documents: docs } : m;
            })
          );
          if (!cancelled && staffDocsMigrated) {
            setStaff(migratedStaff);
          }

          const txns = getLedgerTransactions();
          let txnsChanged = false;
          const migratedTxns = await Promise.all(
            txns.map(async t => {
              if (t.document?.fileData) {
                try {
                  const fileId = t.document.fileId || nextSequential('FILE');
                  await putFile(fileId, dataURLToBlob(t.document.fileData));
                  txnsChanged = true;
                  const { fileData: _removed, ...restDoc } = t.document;
                  return { ...t, document: { ...restDoc, fileId } };
                } catch {
                  return t;
                }
              }
              return t;
            })
          );
          if (!cancelled && txnsChanged) {
            saveLedgerTransactions(migratedTxns);
          }
          localStorage.setItem('schoollee_docs_migrated_idb_v1', '1');
        }
      } catch {
        // ignore migration errors
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  // Unique departments for filtering
  const existingDepartments = useMemo(() => {
    const set = new Set<string>();
    staff.forEach(s => {
      if (s.department && s.department.trim()) set.add(s.department.trim());
    });
    return Array.from(set).sort();
  }, [staff]);

  // Teachers count & Other staff count
  const teachersCount = useMemo(() => {
    return staff.filter(s => s.category === 'Teacher' || s.role.toLowerCase().includes('teacher')).length;
  }, [staff]);

  const otherStaffCount = useMemo(() => {
    return staff.length - teachersCount;
  }, [staff, teachersCount]);

  // Filtered staff calculation
  const filteredStaff = useMemo(() => {
    return staff.filter(member => {
      const isTeacher = member.category === 'Teacher' || member.role.toLowerCase().includes('teacher');
      
      // Tab Category filter
      if (staffActiveTab === 'teachers' && !isTeacher) {
        return false;
      }
      if (staffActiveTab === 'support' && isTeacher) {
        return false;
      }

      // Dropdown category
      if (staffFilters.category !== 'All' && member.category !== staffFilters.category) {
        return false;
      }

      // Department filter
      if (staffFilters.department !== 'All' && member.department !== staffFilters.department) {
        return false;
      }

      // Status filter
      if (staffFilters.status !== 'All' && member.status !== staffFilters.status) {
        return false;
      }

      // Search (matches name, id, father name, phone, cnic, role)
      if (staffFilters.search.trim()) {
        const term = staffFilters.search.toLowerCase().trim();
        const matchesName = member.name.toLowerCase().includes(term);
        const matchesId = member.id.toLowerCase().includes(term);
        const matchesFather = (member.fatherName || '').toLowerCase().includes(term);
        const matchesPhone = member.phone.toLowerCase().includes(term);
        const matchesCnic = (member.cnic || '').toLowerCase().includes(term);
        const matchesRole = member.role.toLowerCase().includes(term);
        if (!matchesName && !matchesId && !matchesFather && !matchesPhone && !matchesCnic && !matchesRole) {
          return false;
        }
      }

      return true;
    });
  }, [staff, staffFilters, staffActiveTab]);

  // Staff Handlers
  const handleStaffFilterChange = (newFilters: Partial<StaffFilterState>) => {
    setStaffFilters(prev => ({ ...prev, ...newFilters }));
  };

  const handleSaveStaff = (staffData: StaffMember) => {
    if (editingStaff) {
      setStaff(prev => prev.map(s => s.id === editingStaff.id ? staffData : s));
      showToast(`Updated staff record for ${staffData.name}`);
      if (selectedStaffForDetails?.id === editingStaff.id) {
        setSelectedStaffForDetails(staffData);
        setActiveStaffView('staff-details');
        setEditingStaff(null);
        return;
      }
    } else {
      setStaff(prev => [staffData, ...prev]);
      showToast(`Added ${staffData.name} (${staffData.role})`);
    }
    setEditingStaff(null);
    setActiveStaffView('directory');
  };

  const handleSelectStaffForDetails = (member: StaffMember) => {
    setSelectedStaffForDetails(member);
    setActiveStaffView('staff-details');
  };

  const handleUpdateStaff = (updated: StaffMember) => {
    setStaff(prev => prev.map(s => s.id === updated.id ? updated : s));
    setSelectedStaffForDetails(updated);
  };

  const handleTerminateStaff = (staffId: string) => {
    setStaff(prev => prev.map(s => {
      if (s.id === staffId) {
        const terminatedMember: StaffMember = { ...s, status: 'Terminated' };
        if (selectedStaffForDetails?.id === staffId) {
          setSelectedStaffForDetails(terminatedMember);
        }
        return terminatedMember;
      }
      return s;
    }));
    showToast('Staff member status updated to Terminated');
  };

  const handleEditStaff = (member: StaffMember) => {
    setEditingStaff(member);
    setActiveStaffView('add-staff');
  };

  const handleDeleteStaff = (id: string) => {
    const member = staff.find(s => s.id === id);
    if (!member) return;
    setSecurityDeleteTarget({
      type: 'Staff Member',
      name: `${member.name} (${member.id})`,
      details: `Role: ${member.role} • Department: ${member.department || 'General'}`,
      onExecute: () => {
        setStaff(prev => prev.filter(s => s.id !== id));
        setSelectedStaffIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        if (selectedStaffForDetails?.id === id) {
          setSelectedStaffForDetails(null);
          setActiveStaffView('directory');
        }
        showToast(`Permanently deleted staff record for ${member.name}`);
      }
    });
  };

  const handleToggleStaffStatus = (id: string) => {
    setStaff(prev => prev.map(s => {
      if (s.id === id) {
        let nextStatus: StaffMember['status'] = 'Active';
        if (s.status === 'Active') nextStatus = 'On Leave';
        else if (s.status === 'On Leave') nextStatus = 'Inactive';
        else nextStatus = 'Active';
        showToast(`${s.name} marked as ${nextStatus}`);
        const updated = { ...s, status: nextStatus };
        if (selectedStaffForDetails?.id === id) {
          setSelectedStaffForDetails(updated);
        }
        return updated;
      }
      return s;
    }));
  };

  const handleImportStaff = (newStaff: StaffMember[], mode: 'append' | 'replace') => {
    if (mode === 'replace') {
      setStaff(newStaff);
      showToast(`Replaced registry with ${newStaff.length} staff records from CSV`);
    } else {
      setStaff(prev => [...newStaff, ...prev]);
      showToast(`Successfully appended ${newStaff.length} staff records from CSV`);
    }
    setSelectedStaffIds(new Set());
  };

  // Staff Selection handlers
  const handleToggleStaffSelect = (id: string) => {
    setSelectedStaffIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllStaff = (allIds: string[]) => {
    setSelectedStaffIds(new Set(allIds));
  };

  const handleClearStaffSelection = () => {
    setSelectedStaffIds(new Set());
  };

  // Staff ID Cards Submodule
  const handleOpenStaffIdCardModal = (member?: StaffMember) => {
    setSelectedStaffForCard(member || filteredStaff[0] || staff[0] || null);
    setIsStaffIdCardModalOpen(true);
  };

  // Pay Staff Submodule
  const handleOpenPayStaffModal = (member?: StaffMember) => {
    if (member) {
      setSelectedStaffForPay(member);
    }
    setIsPayStaffModalOpen(true);
  };

  const currentUserLabel = schoolSettings.principalName || schoolSettings.schoolName || 'Accounts Office';

  const handleConfirmSinglePayment = (staffId: string, b: SalaryBreakdown) => {
    setStaff(prev => disburseSalary(prev, new Map([[staffId, [b.month]]]), {
      method: b.paymentMethod,
      date: b.paidDate,
      paidBy: currentUserLabel,
      adjustments: new Map([[staffId, {
        bonus: (b.allowances || 0) + (b.bonus || 0),
        deduction: b.deductions,
        note: b.notes
      }]])
    }));
    showToast(`Salary paid (${b.month})`);
  };

  const handleBulkPayAllPending = () => {
    const plan = new Map<string, string[]>();
    staff.forEach(s => {
      const owed = owedMonthsOf(s);
      if (owed.length) plan.set(s.id, owed);
    });
    if (plan.size === 0) {
      showToast('No pending salaries');
      return;
    }
    setStaff(prev => disburseSalary(prev, plan, { method: 'Bank Transfer', paidBy: currentUserLabel }));
    showToast(`Paid ${plan.size} staff member(s)`);
  };

  const handleBulkPaySelectedStaff = (selected: StaffMember[]) => {
    const plan = new Map<string, string[]>();
    selected.forEach(s => {
      const owed = owedMonthsOf(s);
      if (owed.length) plan.set(s.id, owed);
    });
    if (plan.size === 0) {
      showToast('Selected staff have no owed months');
      return;
    }
    setStaff(prev => disburseSalary(prev, plan, { method: 'Bank Transfer', paidBy: currentUserLabel }));
    showToast(`Paid ${plan.size} staff member(s)`);
  };

  const handleBulkDownloadStaffCards = (selected: StaffMember[]) => {
    generateAllStaffIdCards(selected, 'modern-tech', DEFAULT_SCHOOL);
    showToast(`Generating ID Cards for ${selected.length} staff members...`);
  };

  const handleBulkExportStaff = (selected: StaffMember[]) => {
    exportStaffToCSV(selected, `selected_staff_${new Date().toISOString().slice(0, 10)}.csv`);
    showToast(`Exported ${selected.length} staff records to CSV`);
  };

  return (
    <div className="h-screen bg-abyss text-slate-100 flex flex-row overflow-hidden font-sans selection:bg-blue-600 selection:text-white">
      <StorageFaultScreen />
      {/* 1. Left Vertical Navbar */}
      <VerticalNavBar
        currentModule={currentModule}
        onSelectModule={(mod) => {
          setCurrentModule(mod);
          if (mod === 'students') setActiveStudentView('directory');
          if (mod === 'staff') setActiveStaffView('directory');
        }}
        totalStudents={students.length}
        staffCount={staff.length}
        classesCount={classes.length}
        schoolSettings={schoolSettings}
      />

      {/* 2. Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto bg-canvas">
        {storageErr && (
          <div
            className="w-full bg-rose-600 text-white px-4 py-2.5 text-xs font-bold flex items-center justify-between gap-3 shrink-0 z-50 shadow-lg"
            id="banner-storage-full-error"
          >
            <span>Storage is full. Your latest changes are NOT saved. Download a backup now.</span>
            <button
              type="button"
              onClick={() => downloadBackup()}
              className="px-3 py-1 rounded-lg bg-white text-rose-700 hover:bg-rose-50 font-bold text-xs cursor-pointer shrink-0"
            >
              Download backup
            </button>
          </div>
        )}

        {/* Global Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-5 right-5 z-50 bg-[#182336] border border-blue-500/50 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs animate-in slide-in-from-bottom duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* ========================================== */}
          {/* 0. OVERVIEW MODULE VIEW                    */}
          {/* ========================================== */}
          {currentModule === 'overview' && (
            <OverviewModule
              students={students}
              staff={staff}
              classes={classes}
              allAttendance={allAttendance}
              schoolSettings={schoolSettings}
              onNavigateModule={(mod) => {
                setCurrentModule(mod);
                if (mod === 'students') setActiveStudentView('directory');
                if (mod === 'staff') setActiveStaffView('directory');
              }}
              onSelectStudent={(student) => {
                setSelectedStudentForDetails(student);
                setActiveStudentView('student-details');
                setCurrentModule('students');
              }}
              onNavigateToFamily={() => {
                setStudentActiveTab('families');
                setCurrentModule('students');
              }}
              onOpenAddStudent={() => {
                setEditingStudent(null);
                setActiveStudentView('add-student');
                setCurrentModule('students');
              }}
              onOpenAddStaff={() => {
                setEditingStaff(null);
                setActiveStaffView('add-staff');
                setCurrentModule('staff');
              }}
              onOpenPayStaff={(member) => {
                handleOpenPayStaffModal(member);
              }}
              onOpenFeePayment={() => {
                setCurrentModule('fees');
              }}
              onOpenGenerateChallan={() => {
                setCurrentModule('fees');
              }}
              onOpenIdCards={() => {
                handleOpenStudentIdCardModal();
              }}
              onOpenBackup={() => {
                setIsStudentBackupModalOpen(true);
              }}
              onPayStudentFee={(student) => {
                setTargetFeeStudentId(student.id);
                setCurrentModule('fees');
              }}
              onShowToast={showToast}
            />
          )}

          {/* ========================================== */}
          {/* 1. CLASSES MODULE VIEW                     */}
          {/* ========================================== */}
          {currentModule === 'classes' && (
            <ClassesModule
              classes={classes}
              students={students}
              onUpdateClasses={(updated) => setClasses(updated)}
              onUpdateStudents={(updated) => setStudents(updated)}
              onNavigateToStudentsByClass={(className, sectionName) => {
                setStudentFilters(prev => ({ 
                  ...prev, 
                  class: className,
                  section: sectionName || prev.section 
                }));
                setCurrentModule('students');
                setActiveStudentView('directory');
              }}
              onSelectStudent={(studentId) => {
                const target = students.find(s => s.id === studentId);
                if (target) {
                  setEditingStudent(target);
                  setActiveStudentView('add-student');
                  setCurrentModule('students');
                }
              }}
              onBreadcrumbOverview={() => setCurrentModule('overview')}
            />
          )}

          {/* ========================================== */}
          {/* 1. STUDENT MODULE VIEW                     */}
          {/* ========================================== */}
          {currentModule === 'students' && (
          <>
            {activeStudentView === 'add-student' ? (
              <AddStudentPage
                onBack={() => {
                  setActiveStudentView(selectedStudentForDetails ? 'student-details' : 'directory');
                  setEditingStudent(null);
                }}
                onNavigateOverview={() => setCurrentModule('overview')}
                onNavigateClasses={() => setCurrentModule('classes')}
                onSave={handleSaveStudent}
                editingStudent={editingStudent}
                existingClasses={existingClasses}
                classes={classes}
                totalStudentCount={students.length}
                allStudents={students}
              />
            ) : activeStudentView === 'student-details' && selectedStudentForDetails ? (
              <StudentDetailsView
                student={selectedStudentForDetails}
                onBack={() => {
                  if (previousModuleForStudentDetails) {
                    setCurrentModule(previousModuleForStudentDetails);
                    setPreviousModuleForStudentDetails(null);
                  }
                  setActiveStudentView('directory');
                  setSelectedStudentForDetails(null);
                }}
                onNavigateOverview={() => setCurrentModule('overview')}
                onUpdateStudent={(updated) => {
                  setStudents(prev => prev.map(s => s.id === updated.id ? updated : s));
                  setSelectedStudentForDetails(updated);
                }}
                onOpenEditModal={(student) => {
                  setEditingStudent(student);
                  setActiveStudentView('add-student');
                }}
                onOpenIdCardModal={(student) => handleOpenStudentIdCardModal(student)}
                allAttendance={allAttendance}
                onUpdateAttendance={handleUpdateStudentAttendance}
                holidays={holidays}
              />
            ) : activeStudentView === 'family-details' && selectedFamilyForDetails ? (
              <FamilyDetailsView
                family={selectedFamilyForDetails}
                onBack={() => {
                  if (previousModuleForStudentDetails) {
                    setCurrentModule(previousModuleForStudentDetails);
                    setPreviousModuleForStudentDetails(null);
                  }
                  setActiveStudentView('directory');
                  setSelectedFamilyForDetails(null);
                }}
                onNavigateOverview={() => setCurrentModule('overview')}
                onSelectStudent={(student) => {
                  setSelectedStudentForDetails(student);
                  setActiveStudentView('student-details');
                }}
                onOpenIdCardModal={(student) => handleOpenStudentIdCardModal(student)}
                onUpdateStudent={(updated) => {
                  setStudents(prev => prev.map(s => s.id === updated.id ? updated : s));
                  setSelectedFamilyForDetails(prev => {
                    if (!prev) return null;
                    return {
                      ...prev,
                      students: prev.students.map(s => s.id === updated.id ? updated : s)
                    };
                  });
                }}
                onUpdateFamily={(updatedFamily) => {
                  setSelectedFamilyForDetails(updatedFamily);
                }}
                allAttendance={allAttendance}
              />
            ) : (
              <>
                {/* Top Page Bar: Page Title aligned directly with Action Buttons */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                  <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">
                      Student
                    </h1>
                    <BreadcrumbTrail
                      items={[
                        { label: 'Overview', onClick: () => setCurrentModule('overview') },
                        { label: 'Students' }
                      ]}
                    />
                  </div>

                  {/* Action Buttons aligned with Student page title */}
                  <div className="flex items-center flex-wrap gap-2.5">
                    {/* ID Cards Generator Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenStudentIdCardModal()}
                      className="px-3 py-2 rounded-lg bg-surface-41 hover:bg-surface-48 border border-edge-39 hover:border-blue-500/50 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
                      id="btn-nav-id-cards"
                    >
                      <IdCard className="w-3.5 h-3.5 text-blue-400" />
                      <span>ID Cards</span>
                    </button>

                    {/* Export Dropdown with CSV & PDF Options */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsExportDropdownOpen(prev => !prev)}
                        className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm ${
                          isExportDropdownOpen
                            ? 'bg-[#1f2d44] border-emerald-500 text-white shadow-emerald-500/10'
                            : 'bg-surface-41 hover:bg-surface-48 border-edge-39 hover:border-emerald-500/50 text-slate-200 hover:text-white'
                        }`}
                        id="btn-nav-export"
                        title="Export options: CSV or PDF preview"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Export</span>
                        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-150 ${isExportDropdownOpen ? 'rotate-180 text-emerald-400' : ''}`} />
                      </button>

                      {isExportDropdownOpen && (
                        <>
                          <div 
                            className="fixed inset-0 z-30" 
                            onClick={() => setIsExportDropdownOpen(false)} 
                          />
                          <div 
                            className="absolute right-0 mt-1.5 w-64 rounded-xl bg-[#131926] border border-edge-31 shadow-2xl z-40 py-2 text-xs overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                            id="dropdown-export-menu"
                          >
                            <div className="px-3.5 py-2 border-b border-edge-17 mb-1 bg-[#161f30]">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                  Export Options
                                </span>
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 capitalize">
                                  {studentActiveTab}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                Current section: <strong className="text-white capitalize">{studentActiveTab}</strong>
                              </p>
                            </div>

                            {/* Option 1: CSV */}
                            <button
                              type="button"
                              onClick={() => {
                                setIsExportDropdownOpen(false);
                                handleExportCurrentSectionCSV();
                              }}
                              className="w-full px-3.5 py-2.5 text-left hover:bg-surface-45 flex items-center gap-3 text-slate-200 hover:text-white transition-colors cursor-pointer group"
                              id="btn-export-option-csv"
                            >
                              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/25 transition-colors">
                                <FileSpreadsheet className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-white">CSV</span>
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#1e2c40] text-emerald-400 font-mono">.csv</span>
                                </div>
                                <p className="text-[11px] text-slate-400 truncate">
                                  Download {studentActiveTab === 'students' ? 'students' : 'families'} spreadsheet
                                </p>
                              </div>
                            </button>

                            {/* Option 2: PDF */}
                            <button
                              type="button"
                              onClick={() => {
                                setIsExportDropdownOpen(false);
                                handleOpenCurrentSectionPdfPreview();
                              }}
                              className="w-full px-3.5 py-2.5 text-left hover:bg-surface-45 flex items-center gap-3 text-slate-200 hover:text-white transition-colors cursor-pointer group"
                              id="btn-export-option-pdf"
                            >
                              <div className="w-8 h-8 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center shrink-0 group-hover:bg-red-500/25 transition-colors">
                                <FileText className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-white">PDF</span>
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#1e2c40] text-red-400 font-mono">Preview</span>
                                </div>
                                <p className="text-[11px] text-slate-400 truncate">
                                  Preview & print / save {studentActiveTab === 'students' ? 'students' : 'families'} PDF
                                </p>
                              </div>
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Bulk Upload Button */}
                    <button
                      type="button"
                      onClick={() => setIsStudentBulkUploadModalOpen(true)}
                      className="px-3 py-2 rounded-lg bg-surface-41 hover:bg-surface-48 border border-edge-39 hover:border-purple-500/50 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
                      id="btn-nav-bulk-upload"
                    >
                      <UploadCloud className="w-3.5 h-3.5 text-purple-400" />
                      <span>Bulk Upload</span>
                    </button>

                    {/* Add Student Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingStudent(null);
                        setActiveStudentView('add-student');
                      }}
                      className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-md shadow-blue-600/25"
                      id="btn-nav-add-student"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Add Student</span>
                    </button>
                  </div>
                </div>

                {/* 4 Stat KPI Cards (Display data only) */}
                <StatCards
                  students={students}
                />

                {/* Filter Toolbar (Tabs, Class Filter, Search, Status) */}
                <FilterBar
                  filters={studentFilters}
                  onFilterChange={handleStudentFilterChange}
                  classes={existingClasses}
                  activeTab={studentActiveTab}
                  onTabChange={setStudentActiveTab}
                  totalStudents={students.length}
                  familiesCount={familiesCount}
                  filteredCount={filteredStudents.length}
                />

                {/* View Switcher: Students Table vs Family View */}
                {studentActiveTab === 'students' ? (
                  <StudentTable
                    students={filteredStudents}
                    classes={classes}
                    existingClasses={existingClasses}
                    onOpenIdCardModal={(student) => handleOpenStudentIdCardModal(student)}
                    onEditStudent={handleEditStudent}
                    onDeleteStudent={handleDeleteStudent}
                    onBulkDeleteStudents={handleBulkDeleteStudents}
                    onUpgradeStudentsClass={handleUpgradeStudentsClass}
                    onNavigateToClasses={() => setCurrentModule('classes')}
                    onToggleStatus={handleToggleStudentStatus}
                    selectedIds={selectedStudentIds}
                    onToggleSelect={handleToggleStudentSelect}
                    onSelectAll={handleSelectAllStudents}
                    onClearSelection={handleClearStudentSelection}
                    onBulkDownloadCards={handleBulkDownloadStudentCards}
                    onSelectStudent={(student) => {
                      setSelectedStudentForDetails(student);
                      setActiveStudentView('student-details');
                    }}
                    onSelectFamily={(familyId, familyName) => {
                      const famStudents = students.filter(
                        s => s.familyId === familyId || s.family === familyName
                      );
                      const firstStudent = famStudents[0];
                      setSelectedFamilyForDetails({
                        familyId: familyId || 'F0000',
                        familyName: familyName || 'Family',
                        guardianCnic: firstStudent?.guardianCnic,
                        phone: firstStudent?.phone,
                        whatsapp: firstStudent?.whatsapp,
                        email: firstStudent?.email,
                        address: firstStudent?.address,
                        caste: firstStudent?.caste,
                        guardianOccupation: firstStudent?.guardianOccupation,
                        motherName: firstStudent?.motherName,
                        motherCnic: firstStudent?.motherCnic,
                        motherOccupation: firstStudent?.motherOccupation,
                        students: famStudents
                      });
                      setActiveStudentView('family-details');
                    }}
                  />
                ) : (
                  <FamilyView
                    students={students}
                    onOpenIdCardModal={(student) => handleOpenStudentIdCardModal(student)}
                    onSelectStudent={(student) => {
                      setSelectedStudentForDetails(student);
                      setActiveStudentView('student-details');
                    }}
                    onSelectFamily={(family) => {
                      setSelectedFamilyForDetails(family);
                      setActiveStudentView('family-details');
                    }}
                    onUpdateFamily={(updatedFamily) => {
                      setStudents(prev => prev.map(s => {
                        if (s.familyId === updatedFamily.familyId || s.family === updatedFamily.familyName) {
                          return {
                            ...s,
                            family: updatedFamily.familyName,
                            guardianCnic: updatedFamily.guardianCnic,
                            phone: updatedFamily.phone,
                            whatsapp: updatedFamily.whatsapp,
                            email: updatedFamily.email,
                            address: updatedFamily.address,
                            guardianOccupation: updatedFamily.guardianOccupation,
                            motherName: updatedFamily.motherName,
                            motherCnic: updatedFamily.motherCnic,
                            motherOccupation: updatedFamily.motherOccupation,
                            caste: updatedFamily.caste,
                            religion: updatedFamily.religion
                          };
                        }
                        return s;
                      }));
                      if (selectedFamilyForDetails?.familyId === updatedFamily.familyId) {
                        setSelectedFamilyForDetails(updatedFamily);
                      }
                    }}
                  />
                )}
              </>
            )}
          </>
        )}

        {/* ========================================== */}
        {/* 2. STAFF MODULE VIEW                       */}
        {/* ========================================== */}
        {currentModule === 'staff' && (
          <>
            {activeStaffView === 'add-staff' ? (
              <AddStaffPage
                onBack={() => {
                  setActiveStaffView(selectedStaffForDetails ? 'staff-details' : 'directory');
                  setEditingStaff(null);
                }}
                onNavigateOverview={() => setCurrentModule('overview')}
                onSave={handleSaveStaff}
                editingStaff={editingStaff}
                totalStaffCount={staff.length}
              />
            ) : activeStaffView === 'staff-details' && selectedStaffForDetails ? (
              <StaffDetailsView
                staff={selectedStaffForDetails}
                onBack={() => {
                  setActiveStaffView('directory');
                  setSelectedStaffForDetails(null);
                }}
                onNavigateOverview={() => setCurrentModule('overview')}
                onUpdateStaff={handleUpdateStaff}
                onOpenEditModal={(member) => {
                  setEditingStaff(member);
                  setActiveStaffView('add-staff');
                }}
                onOpenIdCardModal={handleOpenStaffIdCardModal}
                onOpenPayModal={handleOpenPayStaffModal}
                onOpenSalarySlipModal={(member) => handleOpenSalarySlipModal('individual', member)}
                onTerminateStaff={handleTerminateStaff}
                allAttendance={allAttendance}
                onUpdateAttendance={handleUpdateStaffAttendance}
                holidays={holidays}
              />
            ) : activeStaffView === 'payment-summary' ? (
              <PaymentSummaryPage
                summaryData={
                  paymentSummaryData || {
                    month: payrollMonth.month,
                    year: payrollMonth.year,
                    monthNumber: payrollMonth.monthNumber,
                    paymentDate: '11 Sep 2026',
                    paymentMethod: 'Cash',
                    paidStaff: staff.filter(s => s.payStatus === 'Paid').length > 0 
                      ? staff.filter(s => s.payStatus === 'Paid') 
                      : staff,
                    totalSalaryPaid: (staff.filter(s => s.payStatus === 'Paid').length > 0 
                      ? staff.filter(s => s.payStatus === 'Paid') 
                      : staff).reduce((sum, s) => sum + (s.salary || 0), 0),
                    staffPaidCount: (staff.filter(s => s.payStatus === 'Paid').length > 0 
                      ? staff.filter(s => s.payStatus === 'Paid') 
                      : staff).length
                  }
                }
                onBackToStaff={() => setActiveStaffView('directory')}
                onBackToPayStaff={() => setActiveStaffView('pay-staff')}
                onNavigateOverview={() => setCurrentModule('overview')}
                onOpenSalarySlip={(member) => handleOpenSalarySlipModal('individual', member)}
              />
            ) : activeStaffView === 'pay-staff' ? (
              <PayStaffPage
                staffList={staff}
                onUpdateStaff={(updatedList) => setStaff(updatedList)}
                onBackToStaff={() => setActiveStaffView('directory')}
                onNavigateOverview={() => setCurrentModule('overview')}
                month={payrollMonth.month}
                year={payrollMonth.year}
                onOpenSalarySlips={(mode, member) => handleOpenSalarySlipModal(mode, member)}
                initialSelectedStaffId={selectedStaffForPay?.id || null}
                onClearInitialSelectedStaff={() => setSelectedStaffForPay(null)}
                onNavigateToPaymentSummary={(summaryData) => {
                  setPaymentSummaryData(summaryData);
                  setActiveStaffView('payment-summary');
                }}
              />
            ) : (
              <>
                {/* Staff Page Header with Actions Aligned */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-2xl font-bold text-white tracking-tight">
                        Staff
                      </h1>
                      <Video className="w-4 h-4 text-slate-400 inline" />
                    </div>
                    <BreadcrumbTrail
                      items={[
                        { label: 'Overview', onClick: () => setCurrentModule('overview') },
                        { label: 'Staff' }
                      ]}
                    />
                  </div>

                  {/* Action Buttons aligned with Staff page title */}
                  <div className="flex items-center flex-wrap gap-2.5">
                    {/* 1. ID Cards (Blue) */}
                    <button
                      type="button"
                      onClick={() => handleOpenStaffIdCardModal()}
                      className="px-3.5 py-2 rounded-lg bg-[#0e2a4a] hover:bg-[#143a66] border border-[#1d4d82] text-[#38bdf8] text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
                      id="btn-staff-nav-id-cards"
                    >
                      <IdCard className="w-3.5 h-3.5" />
                      <span>ID Cards</span>
                    </button>

                    {/* 2. Salary Slips Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenSalarySlipModal('individual')}
                      className="px-3.5 py-2 rounded-lg bg-surface-16 hover:bg-[#182132] border border-[#1f2a3d] text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
                      id="btn-staff-nav-salary-slips"
                    >
                      <FileText className="w-3.5 h-3.5 text-slate-300" />
                      <span>Salary Slips</span>
                    </button>

                    {/* 3. Export (Dark) */}
                    <button
                      type="button"
                      onClick={() => setIsStaffBackupModalOpen(true)}
                      className="px-3.5 py-2 rounded-lg bg-surface-16 hover:bg-[#182132] border border-[#1f2a3d] text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
                      id="btn-staff-nav-export"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-300" />
                      <span>Export</span>
                    </button>

                    {/* 4. Pay Staff (Dark) */}
                    <button
                      type="button"
                      onClick={() => handleOpenPayStaffModal()}
                      className="px-3.5 py-2 rounded-lg bg-surface-16 hover:bg-[#182132] border border-[#1f2a3d] text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
                      id="btn-staff-nav-pay"
                    >
                      <span>Pay Staff</span>
                    </button>

                    {/* 5. Add Staff (White) */}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingStaff(null);
                        setActiveStaffView('add-staff');
                      }}
                      className="px-3.5 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
                      id="btn-staff-nav-add"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Add Staff</span>
                    </button>
                  </div>
                </div>

                {/* Staff KPI Stat Cards */}
                <StaffStatCards
                  staffList={staff}
                  onFilterCategory={(category) => setStaffFilters(prev => ({ ...prev, category }))}
                  onFilterStatus={(status) => setStaffFilters(prev => ({ ...prev, status: status as any }))}
                  onSelectTab={(tab) => setStaffActiveTab(tab)}
                />

                {/* Staff Filter Bar with Category Tabs and Filters */}
                <StaffFilterBar
                  filters={staffFilters}
                  onFilterChange={handleStaffFilterChange}
                  activeTab={staffActiveTab}
                  onTabChange={setStaffActiveTab}
                  totalCount={staff.length}
                  teachersCount={teachersCount}
                  otherStaffCount={otherStaffCount}
                />

                {/* Staff Data Table */}
                <StaffTable
                  staffList={filteredStaff}
                  onSelectStaff={handleSelectStaffForDetails}
                  onOpenIdCardModal={(member) => handleOpenStaffIdCardModal(member)}
                  onOpenPayModal={(member) => handleOpenPayStaffModal(member)}
                  onOpenSalarySlipModal={(member) => handleOpenSalarySlipModal('individual', member)}
                  onEditStaff={handleEditStaff}
                  onDeleteStaff={handleDeleteStaff}
                  onTerminateStaff={handleTerminateStaff}
                  onToggleStatus={handleToggleStaffStatus}
                />
              </>
            )}
          </>
        )}

        {/* ========================================== */}
        {/* 3. ATTENDANCE MODULE VIEW (Students & Staff)*/}
        {/* ========================================== */}
        {currentModule === 'attendance' && (
          <AttendanceModule
            students={students}
            staff={staff}
            classes={classes}
            onBackToOverview={() => setCurrentModule('overview')}
            onSelectStudent={(student) => {
              setSelectedStudentForDetails(student);
              setCurrentModule('students');
              setActiveStudentView('student-details');
            }}
            onSelectFamily={(familyId, familyName) => {
              const famStudents = students.filter(
                s => s.familyId === familyId || s.family === familyName
              );
              const firstStudent = famStudents[0];
              setSelectedFamilyForDetails({
                familyId: familyId || 'F0000',
                familyName: familyName || 'Family',
                guardianCnic: firstStudent?.guardianCnic,
                phone: firstStudent?.phone,
                whatsapp: firstStudent?.whatsapp,
                email: firstStudent?.email,
                address: firstStudent?.address,
                caste: firstStudent?.caste,
                guardianOccupation: firstStudent?.guardianOccupation,
                motherName: firstStudent?.motherName,
                motherCnic: firstStudent?.motherCnic,
                motherOccupation: firstStudent?.motherOccupation,
                students: famStudents
              });
              setCurrentModule('students');
              setActiveStudentView('family-details');
            }}
            onSelectStaff={(member) => {
              setSelectedStaffForDetails(member);
              setCurrentModule('staff');
              setActiveStaffView('staff-details');
            }}
            allAttendance={allAttendance}
            onUpdateAllAttendance={setAllAttendance}
            holidays={holidays}
            onUpdateHolidays={setHolidays}
            onShowToast={showToast}
          />
        )}

        {/* ========================================== */}
        {/* 4. FEES & FINANCIALS MODULE VIEW           */}
        {/* ========================================== */}
        {currentModule === 'fees' && (
          <FeesModule
            students={students}
            classes={classes}
            onBreadcrumbOverview={() => setCurrentModule('overview')}
            onSelectStudent={(student) => {
              setSelectedStudentForDetails(student);
              setPreviousModuleForStudentDetails('fees');
              setCurrentModule('students');
              setActiveStudentView('student-details');
            }}
            onSelectFamily={(familyId, familyName) => {
              const famStudents = students.filter(
                s => s.familyId === familyId || s.family === familyName
              );
              const firstStudent = famStudents[0];
              setSelectedFamilyForDetails({
                familyId: familyId || 'F0000',
                familyName: familyName || 'Family',
                guardianCnic: firstStudent?.guardianCnic,
                phone: firstStudent?.phone,
                whatsapp: firstStudent?.whatsapp,
                email: firstStudent?.email,
                address: firstStudent?.address,
                caste: firstStudent?.caste,
                guardianOccupation: firstStudent?.guardianOccupation,
                motherName: firstStudent?.motherName,
                motherCnic: firstStudent?.motherCnic,
                motherOccupation: firstStudent?.motherOccupation,
                students: famStudents
              });
              setPreviousModuleForStudentDetails('fees');
              setCurrentModule('students');
              setActiveStudentView('family-details');
            }}
            onShowToast={showToast}
            onOpenLedger={() => setCurrentModule('ledger')}
            onNavigateToClasses={() => setCurrentModule('classes')}
            initialTargetStudentId={targetFeeStudentId}
            onClearInitialTarget={() => setTargetFeeStudentId(null)}
          />
        )}

        {/* ========================================== */}
        {/* 5. LEDGER MODULE VIEW                      */}
        {/* ========================================== */}
        {currentModule === 'ledger' && (
          <LedgerModule
            onBreadcrumbOverview={() => setCurrentModule('overview')}
            onBackToOverview={() => setCurrentModule('fees')}
            onShowToast={showToast}
          />
        )}

        {/* ========================================== */}
        {/* 6. EXAM MODULE VIEW                        */}
        {/* ========================================== */}
        {currentModule === 'exam' && (
          <ExamModule
            classes={classes}
            students={students}
            schoolSettings={schoolSettings}
            onBreadcrumbOverview={() => setCurrentModule('overview')}
            onShowToast={showToast}
          />
        )}

        {/* ========================================== */}
        {/* 7. SETTINGS MODULE VIEW                    */}
        {/* ========================================== */}
        {currentModule === 'settings' && (
          <SettingsModule
            schoolSettings={schoolSettings}
            onUpdateSchoolSettings={(updated) => setSchoolSettings(updated)}
            onShowToast={showToast}
            onBreadcrumbOverview={() => setCurrentModule('overview')}
            students={students}
            classes={classes}
            staff={staff}
            allAttendance={allAttendance}
          />
        )}
      </main>

      {/* ========================================== */}
      {/* MODALS & SUBMODULES                        */}
      {/* ========================================== */}

      {/* Student Modals */}
      <IdCardModal
        isOpen={isStudentIdCardModalOpen}
        onClose={() => setIsStudentIdCardModalOpen(false)}
        student={selectedStudentForCard}
        allStudents={filteredStudents.length > 0 ? filteredStudents : students}
        onSelectStudent={(s) => setSelectedStudentForCard(s)}
      />

      <BackupModal
        isOpen={isStudentBackupModalOpen}
        onClose={() => setIsStudentBackupModalOpen(false)}
        students={filteredStudents.length > 0 ? filteredStudents : students}
        currentSection={studentActiveTab}
        onOpenPdfPreview={(doc, title, fileName, count, sectionName) => {
          setPdfPreviewState({
            isOpen: true,
            doc,
            title,
            fileName,
            recordCount: count,
            sectionName
          });
        }}
      />

      <PdfPreviewModal
        isOpen={pdfPreviewState.isOpen}
        onClose={() => setPdfPreviewState(prev => ({ ...prev, isOpen: false }))}
        pdfDoc={pdfPreviewState.doc}
        title={pdfPreviewState.title}
        subtitle={pdfPreviewState.subtitle}
        fileName={pdfPreviewState.fileName}
        recordCount={pdfPreviewState.recordCount}
        sectionName={pdfPreviewState.sectionName}
      />

      <BulkUploadModal
        isOpen={isStudentBulkUploadModalOpen}
        onClose={() => setIsStudentBulkUploadModalOpen(false)}
        onImportStudents={handleImportStudents}
        currentStudentCount={students.length}
        classes={classes}
        existingStudents={students}
        onNavigateToClasses={() => setCurrentModule('classes')}
      />

      {/* Staff Modals */}
      <StaffIdCardModal
        isOpen={isStaffIdCardModalOpen}
        onClose={() => setIsStaffIdCardModalOpen(false)}
        staff={selectedStaffForCard}
        allStaff={filteredStaff.length > 0 ? filteredStaff : staff}
        onSelectStaff={(s) => setSelectedStaffForCard(s)}
      />

      <PayStaffModal
        isOpen={isPayStaffModalOpen}
        onClose={() => setIsPayStaffModalOpen(false)}
        staff={selectedStaffForPay}
        allStaff={staff}
        onSelectStaff={(s) => setSelectedStaffForPay(s)}
        onConfirmPayment={handleConfirmSinglePayment}
        onBulkPayAllPending={handleBulkPayAllPending}
      />

      <StaffBulkUploadModal
        isOpen={isStaffBulkUploadModalOpen}
        onClose={() => setIsStaffBulkUploadModalOpen(false)}
        onImportStaff={handleImportStaff}
        currentStaffCount={staff.length}
        existingStaff={staff}
      />

      <StaffBackupModal
        isOpen={isStaffBackupModalOpen}
        onClose={() => setIsStaffBackupModalOpen(false)}
        staffList={staff}
      />

      {/* Staff Salary Slips Big Popup Modal */}
      <StaffSalarySlipsModal
        isOpen={isSalarySlipModalOpen}
        onClose={() => setIsSalarySlipModalOpen(false)}
        staffList={staff}
        initialMode={salarySlipModalMode}
        selectedStaffMember={selectedStaffForSalarySlip}
      />

      {/* High-Security Deletion Verification Modal */}
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
    </div>
  );
}
